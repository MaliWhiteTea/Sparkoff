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
use App\Services\InventoryStockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class InventoryImportController extends Controller
{
    private const SESSION_KEY = 'inventory_import';

    private const FIELDS = [
        'name' => 'Malzeme adı (zorunlu)', 'sku' => 'Stok kodu', 'category' => 'Kategori',
        'location' => 'Konum', 'type' => 'Tür', 'unit' => 'Birim', 'quantity' => 'Miktar',
        'minimum_stock' => 'Kritik stok', 'visibility' => 'Katalog görünürlüğü', 'description' => 'Açıklama',
    ];

    public function index(Request $request): Response
    {
        $state = $this->state($request);
        $rows = $state ? $this->readCsv($state['path']) : [];
        $analysis = $state && isset($state['mapping']) ? $this->analyze($rows, $state['mapping']) : null;

        return Inertia::render('Admin/Inventory/Import', [
            'upload' => $state ? [
                'name' => $state['name'], 'headers' => array_keys($rows[0] ?? []),
                'sample' => array_slice($rows, 0, 5), 'mapping' => $state['mapping'] ?? $this->suggestMapping(array_keys($rows[0] ?? [])),
            ] : null,
            'fields' => self::FIELDS,
            'analysis' => $analysis,
        ]);
    }

    public function upload(Request $request): RedirectResponse
    {
        $data = $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:2048']]);
        $this->clearState($request);
        $path = $data['file']->storeAs('inventory-imports', Str::uuid().'.csv', 'local');
        try {
            $rows = $this->readCsv($path);
        } catch (ValidationException $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }
        if ($rows === []) {
            Storage::disk('local')->delete($path);
            throw ValidationException::withMessages(['file' => 'CSV dosyasında başlık ve en az bir veri satırı bulunmalıdır.']);
        }
        $request->session()->put(self::SESSION_KEY, [
            'path' => $path, 'name' => $data['file']->getClientOriginalName(), 'user_id' => $request->user()->id,
        ]);

        return back()->with('success', 'Dosya okundu. Sütunları eşleyip ön izleme oluşturun.');
    }

    public function preview(Request $request): RedirectResponse
    {
        $state = $this->requiredState($request);
        $mapping = $request->validate([
            'mapping' => ['required', 'array'],
            'mapping.*' => ['nullable', 'string', Rule::in(array_keys(self::FIELDS))],
        ])['mapping'];
        $headers = array_keys($this->readCsv($state['path'])[0] ?? []);
        if (array_diff(array_keys($mapping), $headers) !== []) {
            throw ValidationException::withMessages(['mapping' => 'Dosyada bulunmayan bir sütun gönderildi.']);
        }
        $selected = array_values(array_filter($mapping));
        if (! in_array('name', $selected, true)) {
            throw ValidationException::withMessages(['mapping' => 'Malzeme adı alanını bir CSV sütunuyla eşleyin.']);
        }
        if (count($selected) !== count(array_unique($selected))) {
            throw ValidationException::withMessages(['mapping' => 'Bir alan birden fazla sütunla eşlenemez.']);
        }
        $state['mapping'] = $mapping;
        $request->session()->put(self::SESSION_KEY, $state);

        return back()->with('success', 'Ön izleme hazırlandı.');
    }

    public function confirm(Request $request, InventoryStockService $stock): RedirectResponse
    {
        $state = $this->requiredState($request);
        abort_unless(isset($state['mapping']), 422);
        $analysis = $this->analyze($this->readCsv($state['path']), $state['mapping']);
        if ($analysis['validCount'] === 0) {
            throw ValidationException::withMessages(['import' => 'İçe aktarılabilecek geçerli satır bulunamadı.']);
        }

        DB::transaction(function () use ($analysis, $request, $stock) {
            foreach ($analysis['validRows'] as $row) {
                $categoryId = $this->categoryId($row['category']);
                $locationId = $this->locationId($row['location']);
                $quantity = $row['quantity'];
                $item = InventoryItem::query()->create([
                    'category_id' => $categoryId, 'location_id' => $locationId, 'name' => $row['name'],
                    'slug' => $this->uniqueSlug($row['name']), 'sku' => $row['sku'], 'item_type' => $row['type'],
                    'unit' => $row['unit'], 'quantity' => 0, 'minimum_stock' => $row['minimum_stock'],
                    'public_visibility' => $row['visibility'], 'description' => $row['description'], 'is_active' => true,
                ]);
                if ($quantity > 0) {
                    $stock->adjust($item, $quantity, StockMovementType::Initial, $request->user(), 'CSV içe aktarma');
                }
            }
            ActivityLog::query()->create([
                'user_id' => $request->user()->id, 'action' => 'inventory_imported',
                'subject_type' => InventoryItem::class, 'subject_id' => null,
                'changed_fields' => ['created_count' => $analysis['validCount'], 'source_file' => $this->state($request)['name']],
                'created_at' => now(),
            ]);
        });
        $count = $analysis['validCount'];
        $this->clearState($request);

        return redirect()->route('admin.inventory.index')->with('success', "{$count} malzeme envantere aktarıldı.");
    }

    public function cancel(Request $request): RedirectResponse
    {
        $this->clearState($request);

        return back()->with('success', 'İçe aktarma taslağı silindi.');
    }

    private function analyze(array $rows, array $mapping): array
    {
        $valid = [];
        $preview = [];
        $seen = [];
        foreach ($rows as $index => $source) {
            $raw = [];
            foreach ($mapping as $header => $field) {
                if ($field) {
                    $raw[$field] = trim((string) ($source[$header] ?? ''));
                }
            }
            $row = $this->normalizeRow($raw);
            $errors = [];
            if ($row['name'] === '') {
                $errors[] = 'Malzeme adı boş.';
            }
            if ($row['quantity'] < 0 || $row['minimum_stock'] < 0) {
                $errors[] = 'Miktarlar negatif olamaz.';
            }
            foreach (['quantity' => 'Miktar', 'minimum_stock' => 'Kritik stok'] as $field => $label) {
                if (($raw[$field] ?? '') !== '' && ! is_numeric(str_replace(',', '.', $raw[$field]))) {
                    $errors[] = "{$label} sayısal olmalıdır.";
                }
            }
            $duplicateKey = $row['sku'] ? 'sku:'.Str::lower($row['sku']) : 'name:'.Str::lower($row['name']);
            if (isset($seen[$duplicateKey]) || ($row['sku'] && InventoryItem::query()->where('sku', $row['sku'])->exists()) || InventoryItem::query()->whereRaw('LOWER(name) = ?', [Str::lower($row['name'])])->exists()) {
                $errors[] = 'Envanterde veya dosyada tekrar eden malzeme.';
            }
            $seen[$duplicateKey] = true;
            if ($errors === []) {
                $valid[] = $row;
            }
            $preview[] = ['line' => $index + 2, ...$row, 'errors' => $errors];
        }

        return ['validCount' => count($valid), 'errorCount' => count($preview) - count($valid), 'rows' => array_slice($preview, 0, 100), 'validRows' => $valid];
    }

    private function normalizeRow(array $row): array
    {
        $number = fn (string $key, float $default = 0) => is_numeric(str_replace(',', '.', $row[$key] ?? '')) ? (float) str_replace(',', '.', $row[$key]) : $default;
        $type = match (Str::lower($row['type'] ?? '')) {
            'ödünç', 'odunc', 'loanable' => InventoryItemType::Loanable->value,
            'demirbaş', 'demirbas', 'fixed_asset' => InventoryItemType::FixedAsset->value,
            default => InventoryItemType::Consumable->value,
        };
        $visibility = match (Str::lower($row['visibility'] ?? '')) {
            'kesin', 'exact' => InventoryVisibility::Exact->value,
            'gizli', 'hidden' => InventoryVisibility::Hidden->value,
            default => InventoryVisibility::Status->value,
        };

        return [
            'name' => trim($row['name'] ?? ''), 'sku' => ($row['sku'] ?? '') !== '' ? trim($row['sku']) : null,
            'category' => trim($row['category'] ?? ''), 'location' => trim($row['location'] ?? ''),
            'type' => $type, 'unit' => trim($row['unit'] ?? '') ?: 'adet', 'quantity' => $number('quantity'),
            'minimum_stock' => ($row['minimum_stock'] ?? '') !== '' ? $number('minimum_stock') : null,
            'visibility' => $visibility, 'description' => ($row['description'] ?? '') !== '' ? trim($row['description']) : null,
        ];
    }

    private function readCsv(string $path): array
    {
        $handle = fopen(Storage::disk('local')->path($path), 'rb');
        if (! $handle) {
            return [];
        }
        $first = fgets($handle);
        if ($first === false) {
            fclose($handle);

            return [];
        }
        $delimiter = substr_count($first, ';') >= substr_count($first, ',') ? ';' : ',';
        rewind($handle);
        $headers = fgetcsv($handle, 0, $delimiter, '"', '');
        $headers = array_map(fn ($value) => trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $value)), $headers ?: []);
        if ($headers === [] || count(array_unique($headers)) !== count($headers)) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'CSV sütun başlıkları boş veya tekrarlı olamaz.']);
        }
        $rows = [];
        while (($values = fgetcsv($handle, 0, $delimiter, '"', '')) !== false && count($rows) < 2000) {
            if (count(array_filter($values, fn ($value) => trim((string) $value) !== '')) === 0) {
                continue;
            }
            $values = array_pad(array_slice($values, 0, count($headers)), count($headers), '');
            $rows[] = array_combine($headers, $values);
        }
        fclose($handle);

        return $rows;
    }

    private function suggestMapping(array $headers): array
    {
        $aliases = ['malzeme' => 'name', 'malzeme adı' => 'name', 'urun' => 'name', 'ürün' => 'name', 'stok kodu' => 'sku', 'kod' => 'sku', 'kategori' => 'category', 'konum' => 'location', 'yer' => 'location', 'tür' => 'type', 'tur' => 'type', 'birim' => 'unit', 'miktar' => 'quantity', 'adet' => 'quantity', 'kritik stok' => 'minimum_stock', 'minimum stok' => 'minimum_stock', 'görünürlük' => 'visibility', 'aciklama' => 'description', 'açıklama' => 'description'];

        return collect($headers)->mapWithKeys(fn ($header) => [$header => $aliases[Str::lower(trim($header))] ?? ''])->all();
    }

    private function categoryId(string $name): ?int
    {
        if ($name === '') {
            return null;
        }

        return InventoryCategory::query()->firstOrCreate(['name' => $name], ['slug' => $this->uniqueDefinitionSlug($name, InventoryCategory::class), 'is_active' => true])->id;
    }

    private function locationId(string $name): ?int
    {
        if ($name === '') {
            return null;
        }

        return InventoryLocation::query()->firstOrCreate(['name' => $name], ['code' => $this->uniqueLocationCode($name), 'is_public' => true, 'is_active' => true])->id;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'malzeme';
        $slug = $base;
        for ($i = 2; InventoryItem::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    private function uniqueDefinitionSlug(string $name, string $model): string
    {
        $base = Str::slug($name) ?: 'kategori';
        $slug = $base;
        for ($i = 2; $model::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }

    private function uniqueLocationCode(string $name): string
    {
        $base = Str::upper(Str::slug($name, '-')) ?: 'KONUM';
        $code = Str::limit($base, 45, '');
        for ($i = 2; InventoryLocation::query()->where('code', $code)->exists(); $i++) {
            $code = Str::limit($base, 40, '')."-{$i}";
        }

        return $code;
    }

    private function state(Request $request): ?array
    {
        $state = $request->session()->get(self::SESSION_KEY);

        return $state && ($state['user_id'] ?? null) === $request->user()->id && Storage::disk('local')->exists($state['path']) ? $state : null;
    }

    private function requiredState(Request $request): array
    {
        return $this->state($request) ?? throw ValidationException::withMessages(['file' => 'İçe aktarma dosyası bulunamadı; tekrar yükleyin.']);
    }

    private function clearState(Request $request): void
    {
        if ($state = $this->state($request)) {
            Storage::disk('local')->delete($state['path']);
        }
        $request->session()->forget(self::SESSION_KEY);
    }
}
