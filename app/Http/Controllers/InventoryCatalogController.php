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
        ]);
        $search = trim((string) ($filters['search'] ?? ''));

        $items = InventoryItem::query()
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
                            ->orWhere('description', 'like', "%{$term}%")
                            ->orWhereHas('category', fn ($category) => $category->where('name', 'like', "%{$term}%"));
                    });
                }
            })
            ->when($filters['category'] ?? null, fn ($query, $category) => $query->where('category_id', $category))
            ->when(($filters['stock'] ?? 'all') === 'available', fn ($query) => $query->whereAvailable())
            ->when(($filters['stock'] ?? 'all') === 'out', fn ($query) => $query->whereAvailable(false))
            ->orderBy('name')
            ->paginate(24)
            ->withQueryString()
            ->through(function (InventoryItem $item) {
                $availableQuantity = $item->availableQuantity();

                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'category' => $item->category?->name ?? 'Diğer',
                    'location' => $item->location?->is_public ? $item->location->name : null,
                    'type' => $item->item_type->value,
                    'unit' => $item->unit,
                    'description' => $item->description,
                    'technicalSpecs' => $item->technical_specs ?? [],
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
            'filters' => ['search' => $search, 'category' => (string) ($filters['category'] ?? ''), 'stock' => $filters['stock'] ?? 'all'],
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
