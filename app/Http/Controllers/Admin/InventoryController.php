<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Enums\StockMovementType;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\InventoryMedia;
use App\Models\InventoryTransaction;
use App\Models\StockMovement;
use App\Services\InventoryStockService;
use App\Support\InventoryCsvContract;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use LogicException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $this->validatedFilters($request);

        $sorts = ['name' => 'name', 'quantity' => 'quantity', 'minimum_stock' => 'minimum_stock', 'updated_at' => 'updated_at'];
        $sort = $filters['sort'] ?? 'name';
        $direction = $filters['direction'] ?? 'asc';
        $items = $this->filteredItems($filters)
            ->with(['category:id,name', 'location:id,name,code', 'media'])
            ->orderBy($sorts[$sort], $direction)->orderBy('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (InventoryItem $item) => $this->itemData($item));

        $unarchived = InventoryItem::query()->whereNull('archived_at');

        return Inertia::render('Admin/Inventory/Index', [
            'items' => $items,
            'filters' => [
                'search' => $filters['search'] ?? '',
                'category' => isset($filters['category']) ? (string) $filters['category'] : '',
                'type' => $filters['type'] ?? '',
                'status' => $filters['status'] ?? 'active',
                'sort' => $sort, 'direction' => $direction,
            ],
            'summary' => [
                'total' => (clone $unarchived)->where('is_active', true)->count(),
                'inactive' => (clone $unarchived)->where('is_active', false)->count(),
                'low' => (clone $unarchived)->where('is_active', true)->whereNotNull('minimum_stock')->whereColumn('quantity', '<=', 'minimum_stock')->where('quantity', '>', 0)->count(),
                'out' => (clone $unarchived)->where('is_active', true)->where('quantity', '<=', 0)->count(),
                'archived' => InventoryItem::query()->whereNotNull('archived_at')->count(),
            ],
            'categories' => InventoryCategory::query()->orderBy('sort_order')->orderBy('name')->get()->map(fn ($category) => [
                'id' => $category->id, 'name' => $category->name, 'description' => $category->description,
                'isActive' => $category->is_active, 'itemCount' => $category->items()->count(),
            ]),
            'locations' => InventoryLocation::query()->orderBy('name')->get()->map(fn ($location) => [
                'id' => $location->id, 'name' => $location->name, 'code' => $location->code,
                'description' => $location->description, 'isPublic' => $location->is_public,
                'isActive' => $location->is_active, 'itemCount' => $location->items()->count(),
            ]),
            'recentMovements' => $request->user()->hasPermissionTo('inventory.view_movements')
                ? StockMovement::query()->with(['item:id,name,unit', 'user:id,name'])->latest()->limit(15)->get()->map(fn ($movement) => [
                    'id' => $movement->id, 'item' => $movement->item->name, 'unit' => $movement->item->unit,
                    'type' => $movement->movement_type->value, 'change' => $movement->quantity_change,
                    'balance' => $movement->balance_after, 'reason' => $movement->reason,
                    'actor' => $movement->user?->name ?? 'Sistem', 'createdAt' => $movement->created_at->format('d.m.Y H:i'),
                ]) : [],
        ]);
    }

    public function store(Request $request, InventoryStockService $stock): RedirectResponse
    {
        $data = $this->validatedItem($request, true);
        $quantity = $data['quantity'];
        unset($data['quantity']);

        DB::transaction(function () use ($data, $quantity, $request, $stock) {
            $item = InventoryItem::query()->create([...$data, 'slug' => $this->uniqueSlug($data['name']), 'quantity' => 0]);
            if ((float) $quantity > 0) {
                $stock->adjust($item, $quantity, StockMovementType::Initial, $request->user(), 'İlk stok kaydı');
            }
        });

        return back()->with('success', 'Malzeme envantere eklendi.');
    }

    public function export(Request $request): StreamedResponse
    {
        $filters = $this->validatedFilters($request);
        $items = $this->filteredItems($filters)
            ->with(['category:id,name', 'location:id,name,code'])
            ->orderBy('name')
            ->get();

        return response()->streamDownload(function () use ($items) {
            $output = fopen('php://output', 'wb');
            fwrite($output, "\xEF\xBB\xBF");
            fputcsv($output, array_values(InventoryCsvContract::COLUMNS), ';', '"', '');

            foreach ($items as $item) {
                fputcsv($output, array_map($this->safeCsvValue(...), [
                    $item->sku, $item->name, InventoryCsvContract::typeLabel($item->item_type), $item->category?->name,
                    $item->location?->code, $item->location?->name, $item->quantity, $item->unit,
                    $item->minimum_stock, InventoryCsvContract::statusLabel($item->archived_at ? 'archived' : ($item->is_active ? 'active' : 'inactive')),
                    InventoryCsvContract::visibilityLabel($item->public_visibility), $item->description,
                ]), ';', '"', '');
            }

            fclose($output);
        }, 'sparkoff-envanter-'.now()->format('Y-m-d-His').'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    public function update(Request $request, InventoryItem $item): RedirectResponse
    {
        $data = $this->validatedItem($request, false, $item);
        if (! $request->user()->hasPermissionTo('inventory.change_item_type')) {
            unset($data['item_type']);
        }

        DB::transaction(function () use ($item, $data) {
            $lockedItem = InventoryItem::query()->lockForUpdate()->findOrFail($item->id);
            if ($lockedItem->archived_at) {
                throw ValidationException::withMessages(['item' => 'Arşivlenmiş bir malzeme düzenlenemez.']);
            }
            if (isset($data['item_type'])
                && $data['item_type'] !== $lockedItem->item_type->value
                && $lockedItem->transactions()->where('status', 'active')->exists()) {
                throw ValidationException::withMessages([
                    'item_type' => 'Aktif teslimi bulunan malzemenin türü değiştirilemez. Önce teslim kaydını kapatın.',
                ]);
            }
            $lockedItem->update($data);
        }, 3);

        return back()->with('success', 'Malzeme bilgileri güncellendi.');
    }

    public function bulkUpdate(Request $request): RedirectResponse
    {
        $operation = $request->validate([
            'operation' => ['required', Rule::in(['category', 'location', 'visibility', 'archive'])],
        ])['operation'];
        $permission = $operation === 'archive' ? 'inventory.archive' : 'inventory.update';
        abort_unless($request->user()->hasPermissionTo($permission), 403);

        $data = $request->validate([
            'item_ids' => ['required', 'array', 'min:1', 'max:100'],
            'item_ids.*' => ['required', 'integer', 'distinct'],
            'confirmed' => ['required', 'accepted'],
        ]);
        $data['operation'] = $operation;

        $changes = match ($data['operation']) {
            'category' => ['category_id' => $request->validate([
                'category_id' => ['present', 'nullable', 'integer', 'exists:inventory_categories,id'],
            ])['category_id']],
            'location' => ['location_id' => $request->validate([
                'location_id' => ['present', 'nullable', 'integer', 'exists:inventory_locations,id'],
            ])['location_id']],
            'visibility' => ['public_visibility' => $request->validate([
                'public_visibility' => ['required', Rule::enum(InventoryVisibility::class)],
            ])['public_visibility']],
            'archive' => ['is_active' => false, 'archived_at' => now()],
        };
        $ids = collect($data['item_ids'])->map(fn ($id) => (int) $id)->sort()->values();

        $result = DB::transaction(function () use ($ids, $changes, $data, $request) {
            $items = InventoryItem::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $canSeeNames = $request->user()->hasPermissionTo('inventory.view');
            $failures = collect();
            $eligibleIds = collect();

            foreach ($ids as $id) {
                $item = $items->get($id);
                if (! $item) {
                    $failures->push(['id' => $id, 'name' => "Kayıt #{$id}", 'reason' => 'Malzeme artık bulunamadı.']);

                    continue;
                }
                if ($item->archived_at !== null) {
                    $failures->push([
                        'id' => $id,
                        'name' => $canSeeNames ? $item->name : "Kayıt #{$id}",
                        'reason' => $data['operation'] === 'archive'
                            ? 'Malzeme zaten arşivlenmiş.'
                            : 'Arşivlenmiş malzeme düzenlenemez.',
                    ]);

                    continue;
                }
                $eligibleIds->push($id);
            }

            if ($eligibleIds->isNotEmpty()) {
                InventoryItem::query()->whereIn('id', $eligibleIds)->update($changes);
            }
            $fields = match ($data['operation']) {
                'category' => ['category_id'],
                'location' => ['location_id'],
                'visibility' => ['public_visibility'],
                'archive' => ['is_active', 'archived_at'],
            };
            ActivityLog::query()->create([
                'user_id' => $request->user()->id,
                'action' => "inventory_bulk_{$data['operation']}_updated",
                'subject_type' => InventoryItem::class,
                'subject_id' => null,
                'changed_fields' => ["item_count:{$eligibleIds->count()}", "failure_count:{$failures->count()}", ...$fields],
                'created_at' => now(),
            ]);

            return [
                'operation' => $data['operation'],
                'successCount' => $eligibleIds->count(),
                'failureCount' => $failures->count(),
                'failures' => $failures->values()->all(),
            ];
        }, 3);

        $message = match ($data['operation']) {
            'category' => 'Seçili malzemelerin kategorisi güncellendi.',
            'location' => 'Seçili malzemelerin konumu güncellendi.',
            'visibility' => 'Seçili malzemelerin katalog görünürlüğü güncellendi.',
            'archive' => 'Seçili malzemeler arşivlendi; hareket geçmişleri korundu.',
        };

        $response = back()->with('bulk_result', $result);
        if ($result['failureCount'] === 0) {
            return $response->with('success', $message);
        }
        if ($result['successCount'] === 0) {
            return $response->with('warning', 'Toplu işlem uygulanamadı. Atlanan kayıtların nedenlerini inceleyin.');
        }

        return $response->with('warning', "{$result['successCount']} malzeme güncellendi, {$result['failureCount']} kayıt atlandı.");
    }

    public function archive(InventoryItem $item): RedirectResponse
    {
        if (! $item->archived_at) {
            $item->update(['is_active' => false, 'archived_at' => now()]);
        }

        return back()->with('success', 'Malzeme arşivlendi; hareket geçmişi korundu.');
    }

    public function testTools(): Response
    {
        return Inertia::render('Admin/Settings/TestTools', [
            'inventoryCount' => InventoryItem::query()->count(),
        ]);
    }

    public function destroy(Request $request, InventoryItem $item): RedirectResponse
    {
        $request->validate(['confirmation' => ['required', 'string', Rule::in([(string) $item->id])]]);
        $name = $item->name;
        $this->purgeItems(collect([$item]), $request);

        return back()->with('success', "{$name} ve ilişkili test kayıtları kalıcı olarak silindi.");
    }

    public function destroyAll(Request $request): RedirectResponse
    {
        $request->validate([
            'confirmation' => ['required', 'string', Rule::in(['TÜM MALZEMELERİ SİL'])],
        ]);
        $count = InventoryItem::query()->count();
        $this->purgeItems(InventoryItem::query()->get(), $request);

        return back()->with('success', "{$count} malzeme ve ilişkili test kayıtları kalıcı olarak silindi.");
    }

    public function adjustStock(Request $request, InventoryItem $item, InventoryStockService $stock): RedirectResponse
    {
        $data = $request->validate([
            'quantity_change' => ['required', 'numeric', 'not_in:0', 'between:-9999999999,9999999999'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ]);
        if ($item->archived_at) {
            throw ValidationException::withMessages(['quantity_change' => 'Arşivlenmiş malzemenin stoku değiştirilemez.']);
        }
        try {
            $stock->adjust($item, $data['quantity_change'], StockMovementType::Adjustment, $request->user(), $data['reason']);
        } catch (LogicException $exception) {
            throw ValidationException::withMessages(['quantity_change' => $exception->getMessage()]);
        }

        return back()->with('success', 'Stok hareketi kaydedildi.');
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        $data = $this->validatedCategory($request);
        InventoryCategory::query()->create([...$data, 'slug' => $this->uniqueSlug($data['name'], InventoryCategory::class)]);

        return back()->with('success', 'Kategori oluşturuldu.');
    }

    public function updateCategory(Request $request, InventoryCategory $category): RedirectResponse
    {
        $category->update($this->validatedCategory($request));

        return back()->with('success', 'Kategori güncellendi.');
    }

    public function storeLocation(Request $request): RedirectResponse
    {
        InventoryLocation::query()->create($this->validatedLocation($request));

        return back()->with('success', 'Konum oluşturuldu.');
    }

    public function updateLocation(Request $request, InventoryLocation $location): RedirectResponse
    {
        $location->update($this->validatedLocation($request, $location));

        return back()->with('success', 'Konum güncellendi.');
    }

    private function validatedItem(Request $request, bool $creating, ?InventoryItem $item = null): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:180'],
            'sku' => ['nullable', 'string', 'max:100', Rule::unique('inventory_items')->ignore($item)],
            'category_id' => ['nullable', 'integer', 'exists:inventory_categories,id'],
            'location_id' => ['nullable', 'integer', 'exists:inventory_locations,id'],
            'item_type' => ['required', Rule::enum(InventoryItemType::class)],
            'unit' => ['required', 'string', 'max:30'],
            'minimum_stock' => ['nullable', 'numeric', 'decimal:0,3', 'min:0', 'max:9999999999'],
            'public_visibility' => ['required', Rule::enum(InventoryVisibility::class)],
            'description' => ['nullable', 'string', 'max:3000'],
            'is_active' => ['required', 'boolean'],
        ];
        if ($creating) {
            $rules['quantity'] = ['required', 'numeric', 'decimal:0,3', 'min:0', 'max:9999999999'];
        }
        $request->merge(['is_active' => $request->boolean('is_active')]);

        return $request->validate($rules);
    }

    private function validatedFilters(Request $request): array
    {
        return $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'integer', 'exists:inventory_categories,id'],
            'type' => ['nullable', Rule::enum(InventoryItemType::class)],
            'status' => ['nullable', Rule::in(['all', 'active', 'inactive', 'low', 'out', 'archived'])],
            'sort' => ['nullable', Rule::in(['name', 'quantity', 'minimum_stock', 'updated_at'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);
    }

    private function filteredItems(array $filters)
    {
        return InventoryItem::query()
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(fn ($nested) => $nested->where('name', 'like', "%{$search}%")->orWhere('sku', 'like', "%{$search}%"));
            })
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category_id', $category))
            ->when($filters['type'] ?? null, fn ($query, $type) => $query->where('item_type', $type))
            ->when(($filters['status'] ?? null) === 'all', fn ($query) => $query->whereNull('archived_at'))
            ->when(($filters['status'] ?? 'active') === 'active', fn ($query) => $query->whereNull('archived_at')->where('is_active', true))
            ->when(($filters['status'] ?? null) === 'inactive', fn ($query) => $query->whereNull('archived_at')->where('is_active', false))
            ->when(($filters['status'] ?? null) === 'archived', fn ($query) => $query->whereNotNull('archived_at'))
            ->when(($filters['status'] ?? null) === 'out', fn ($query) => $query->whereNull('archived_at')->where('is_active', true)->where('quantity', '<=', 0))
            ->when(($filters['status'] ?? null) === 'low', fn ($query) => $query->whereNull('archived_at')->where('is_active', true)->whereNotNull('minimum_stock')->whereColumn('quantity', '<=', 'minimum_stock')->where('quantity', '>', 0));
    }

    private function safeCsvValue(mixed $value): string
    {
        $value = (string) ($value ?? '');

        return preg_match('/^[=+\-@]/u', $value) ? "'{$value}" : $value;
    }

    private function validatedCategory(Request $request): array
    {
        $request->merge(['is_active' => $request->boolean('is_active')]);

        return $request->validate(['name' => ['required', 'string', 'max:120'], 'description' => ['nullable', 'string', 'max:1000'], 'is_active' => ['required', 'boolean']]);
    }

    private function validatedLocation(Request $request, ?InventoryLocation $location = null): array
    {
        $request->merge([
            'code' => mb_strtoupper(trim((string) $request->input('code'))),
            'is_public' => $request->boolean('is_public'),
            'is_active' => $request->boolean('is_active'),
        ]);

        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['required', 'string', 'max:50', Rule::unique('inventory_locations')->ignore($location)],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_public' => ['required', 'boolean'], 'is_active' => ['required', 'boolean'],
        ]);
    }

    private function uniqueSlug(string $name, string $model = InventoryItem::class): string
    {
        $base = Str::slug($name) ?: 'malzeme';
        $slug = $base;
        for ($suffix = 2; $model::query()->where('slug', $slug)->exists(); $suffix++) {
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }

    private function purgeItems($items, Request $request): void
    {
        $ids = $items->pluck('id');
        if ($ids->isEmpty()) {
            return;
        }

        $paths = InventoryMedia::query()->whereIn('inventory_item_id', $ids)->whereNotNull('file_path')->pluck('file_path');
        $legacyPaths = $items->pluck('image_path')->filter();
        $itemCount = $ids->count();
        $transactionCount = InventoryTransaction::query()->whereIn('inventory_item_id', $ids)->count();
        $movementCount = StockMovement::query()->whereIn('inventory_item_id', $ids)->count();

        DB::transaction(function () use ($ids, $request, $itemCount, $transactionCount, $movementCount) {
            InventoryTransaction::query()->whereIn('inventory_item_id', $ids)->delete();
            StockMovement::query()->whereIn('inventory_item_id', $ids)->delete();
            InventoryMedia::query()->whereIn('inventory_item_id', $ids)->delete();
            InventoryItem::query()->whereIn('id', $ids)->delete();
            ActivityLog::query()->create([
                'user_id' => $request->user()->id,
                'action' => 'inventory_test_data_purged',
                'subject_type' => InventoryItem::class,
                'subject_id' => null,
                'changed_fields' => ["items:{$itemCount}", "transactions:{$transactionCount}", "movements:{$movementCount}"],
                'created_at' => now(),
            ]);
        });

        Storage::disk('public')->delete($paths->merge($legacyPaths)->all());
        $ids->each(fn (int $id) => Storage::disk('public')->deleteDirectory("inventory-media/{$id}"));
    }

    private function itemData(InventoryItem $item): array
    {
        return [
            'id' => $item->id, 'name' => $item->name, 'sku' => $item->sku,
            'categoryId' => $item->category_id, 'category' => $item->category?->name,
            'locationId' => $item->location_id, 'location' => $item->location ? "{$item->location->code} · {$item->location->name}" : null,
            'itemType' => $item->item_type->value, 'unit' => $item->unit, 'quantity' => $item->quantity,
            'minimumStock' => $item->minimum_stock, 'publicVisibility' => $item->public_visibility->value,
            'description' => $item->description, 'isActive' => $item->is_active,
            'isLow' => $item->isLowOnStock(), 'isArchived' => $item->archived_at !== null,
            'media' => $item->media->map(fn ($medium) => [
                'id' => $medium->id, 'type' => $medium->type, 'url' => $medium->publicUrl(),
                'title' => $medium->title, 'altText' => $medium->alt_text,
                'sortOrder' => $medium->sort_order, 'isCover' => $medium->is_cover,
            ]),
        ];
    }
}
