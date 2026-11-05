<?php

namespace App\Http\Controllers;

use App\Enums\InventoryVisibility;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class InventoryCatalogController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'integer', 'exists:inventory_categories,id'],
            'stock' => ['nullable', 'in:all,available,out'],
            'sort' => ['nullable', 'in:name_asc,name_desc,updated_desc'],
            'per_page' => ['nullable', 'integer', 'in:12,24,48'],
            'favorites' => ['nullable', 'boolean'],
            'favorite_ids' => ['nullable', 'string', 'max:1200', 'regex:/^\d+(?:,\d+)*$/'],
        ]);
        $search = trim((string) ($filters['search'] ?? ''));
        $sort = $filters['sort'] ?? 'name_asc';
        $perPage = (int) ($filters['per_page'] ?? 24);
        $favoritesOnly = $request->boolean('favorites');
        $favoriteIds = collect(explode(',', (string) ($filters['favorite_ids'] ?? '')))
            ->filter(fn (string $id) => $id !== '')
            ->map(fn (string $id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->take(100)
            ->values()
            ->all();

        $itemsQuery = InventoryItem::query()
            ->withAvailableQuantity()
            ->with(['category:id,name', 'location:id,name,is_public', 'media'])
            ->whereNull('archived_at')
            ->where('is_active', true)
            ->where('public_visibility', '!=', InventoryVisibility::Hidden->value)
            ->when($search !== '', function ($query) use ($search) {
                foreach (preg_split('/\s+/u', $search, -1, PREG_SPLIT_NO_EMPTY) as $term) {
                    $query->where(function ($nested) use ($term) {
                        $nested->where('name', 'like', "%{$term}%")
                            ->orWhere('sku', 'like', "%{$term}%")
                            ->orWhere('brand', 'like', "%{$term}%")
                            ->orWhere('model', 'like', "%{$term}%")
                            ->orWhere('description', 'like', "%{$term}%")
                            ->orWhereHas('category', fn ($category) => $category->where('name', 'like', "%{$term}%"));
                    });
                }
            })
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category_id', $category))
            ->when($favoritesOnly, fn ($query) => $favoriteIds === [] ? $query->whereRaw('1 = 0') : $query->whereIn('inventory_items.id', $favoriteIds))
            ->when(($filters['stock'] ?? 'all') === 'available', fn ($query) => $query->whereAvailable())
            ->when(($filters['stock'] ?? 'all') === 'out', fn ($query) => $query->whereAvailable(false));

        match ($sort) {
            'name_desc' => $itemsQuery->orderByDesc('name')->orderByDesc('id'),
            'updated_desc' => $itemsQuery->orderByDesc('updated_at')->orderByDesc('id'),
            default => $itemsQuery->orderBy('name')->orderBy('id'),
        };

        $items = $itemsQuery
            ->paginate($perPage)
            ->withQueryString()
            ->through(function (InventoryItem $item) {
                $availableQuantity = $item->availableQuantity();

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'brand' => $item->brand,
                    'model' => $item->model,
                    'category' => $item->category?->name ?? 'Diğer',
                    'location' => $item->location?->is_public ? $item->location->name : null,
                    'type' => $item->item_type->value,
                    'unit' => $item->unit,
                    'description' => $item->description,
                    'technicalSpecs' => $item->technical_specs ?? [],
                    'updatedAt' => $item->updated_at?->format('d.m.Y'),
                    'availability' => (float) $availableQuantity > 0 ? 'available' : 'out',
                    'quantity' => $item->public_visibility === InventoryVisibility::Exact ? $availableQuantity : null,
                    'media' => $item->media->map(fn ($medium) => [
                        'id' => $medium->id, 'type' => $medium->type, 'url' => $medium->publicUrl(),
                        'title' => $medium->title, 'altText' => $medium->alt_text, 'isCover' => $medium->is_cover,
                    ]),
                ];
            });

        return Inertia::render('Materials', [
            'items' => $items,
            'filters' => [
                'search' => $search,
                'category' => (string) ($filters['category'] ?? ''),
                'stock' => $filters['stock'] ?? 'all',
                'sort' => $sort,
                'perPage' => $perPage,
                'favorites' => $favoritesOnly,
            ],
            'categories' => InventoryCategory::query()
                ->where('is_active', true)
                ->whereHas('items', fn ($query) => $query
                    ->whereNull('archived_at')
                    ->where('is_active', true)
                    ->where('public_visibility', '!=', InventoryVisibility::Hidden->value))
                ->orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
