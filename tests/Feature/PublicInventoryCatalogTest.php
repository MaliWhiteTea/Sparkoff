<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryTransactionStatus;
use App\Enums\InventoryVisibility;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\InventoryTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PublicInventoryCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_only_exposes_active_public_items_and_respects_quantity_visibility(): void
    {
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik', 'is_active' => true]);
        $privateLocation = InventoryLocation::query()->create(['name' => 'Gizli Dolap', 'code' => 'GD-1', 'is_public' => false, 'is_active' => true]);
        $exact = $this->item('Arduino Uno', InventoryVisibility::Exact, 30, $category, $privateLocation);
        $exact->update(['brand' => 'Arduino', 'model' => 'UNO R3']);
        $this->item('HC-SR04 Sensör', InventoryVisibility::Status, 4, $category);
        $this->item('Gizli Parça', InventoryVisibility::Hidden, 99, $category);
        $archived = $this->item('Arşiv Parça', InventoryVisibility::Exact, 2, $category);
        $archived->update(['is_active' => false, 'archived_at' => now()]);

        $this->get(route('materials.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Materials')
            ->has('items.data', 2)
            ->where('items.data.0.id', $exact->id)
            ->where('items.data.0.quantity', '30.000')
            ->where('items.data.0.brand', 'Arduino')
            ->where('items.data.0.model', 'UNO R3')
            ->where('items.data.0.updatedAt', $exact->updated_at->format('d.m.Y'))
            ->where('items.data.0.location', null)
            ->where('items.data.1.quantity', null));
    }

    public function test_catalog_search_and_filters_work_together(): void
    {
        $electronics = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik', 'is_active' => true]);
        $mechanics = InventoryCategory::query()->create(['name' => 'Mekanik', 'slug' => 'mekanik', 'is_active' => true]);
        $wanted = $this->item('Geliştirme Kartı', InventoryVisibility::Status, 5, $electronics);
        $wanted->update(['brand' => 'Arduino', 'model' => 'UNO R3']);
        $this->item('Arduino Nano', InventoryVisibility::Status, 0, $electronics);
        $this->item('Lineer Rulman', InventoryVisibility::Status, 5, $mechanics);

        $this->get(route('materials.index', ['search' => 'Arduino R3', 'category' => $electronics->id, 'stock' => 'available']))
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 1)
            ->where('items.data.0.id', $wanted->id)
            ->where('items.data.0.brand', 'Arduino')
            ->where('items.data.0.model', 'UNO R3')
            ->where('filters.search', 'Arduino R3'));
    }

    public function test_fully_used_fixed_asset_is_out_of_stock_in_catalog_and_stock_filters(): void
    {
        $category = InventoryCategory::query()->create(['name' => 'Cihazlar', 'slug' => 'cihazlar', 'is_active' => true]);
        $item = $this->item('Atölye Tableti', InventoryVisibility::Exact, 1, $category);
        $item->update(['item_type' => InventoryItemType::FixedAsset]);
        InventoryTransaction::query()->create([
            'inventory_item_id' => $item->id,
            'item_type' => InventoryItemType::FixedAsset,
            'status' => InventoryTransactionStatus::Active,
            'recipient_name' => 'Test Kullanıcı',
            'quantity' => 1,
            'quantity_returned' => 0,
            'issued_at' => now(),
        ]);

        $this->get(route('materials.index'))->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 1)
            ->where('items.data.0.availability', 'out')
            ->where('items.data.0.quantity', '0.000'));
        $this->get(route('materials.index', ['stock' => 'available']))->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 0));
        $this->get(route('materials.index', ['stock' => 'out']))->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 1)
            ->where('items.data.0.id', $item->id));
    }

    public function test_catalog_rejects_invalid_filters(): void
    {
        $this->get(route('materials.index', [
            'stock' => 'secret', 'sort' => 'quantity_desc', 'per_page' => 13,
        ]))->assertSessionHasErrors(['stock', 'sort', 'per_page']);
    }

    public function test_catalog_sorting_page_size_and_query_string_are_preserved(): void
    {
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik', 'is_active' => true]);
        foreach (range(1, 13) as $number) {
            $this->item('Malzeme '.str_pad((string) $number, 2, '0', STR_PAD_LEFT), InventoryVisibility::Status, 1, $category);
        }

        $this->get(route('materials.index', [
            'category' => $category->id,
            'stock' => 'available',
            'sort' => 'name_desc',
            'per_page' => 12,
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 12)
            ->where('items.total', 13)
            ->where('items.data.0.name', 'Malzeme 13')
            ->where('filters.category', (string) $category->id)
            ->where('filters.stock', 'available')
            ->where('filters.sort', 'name_desc')
            ->where('filters.perPage', 12)
            ->where('items.next_page_url', fn (?string $url) => $url !== null
                && str_contains($url, 'category='.$category->id)
                && str_contains($url, 'stock=available')
                && str_contains($url, 'sort=name_desc')
                && str_contains($url, 'per_page=12')));

        InventoryItem::query()->where('name', 'Malzeme 01')->update(['updated_at' => now()->addMinute()]);
        $this->get(route('materials.index', ['sort' => 'updated_desc']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.sort', 'updated_desc')
                ->where('items.data.0.name', 'Malzeme 01'));
    }

    public function test_browser_favorite_ids_filter_public_catalog_without_exposing_hidden_items(): void
    {
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik', 'is_active' => true]);
        $first = $this->item('Birinci Favori', InventoryVisibility::Status, 1, $category);
        $second = $this->item('İkinci Favori', InventoryVisibility::Status, 1, $category);
        $hidden = $this->item('Gizli Favori', InventoryVisibility::Hidden, 1, $category);

        $this->get(route('materials.index', [
            'favorites' => 1,
            'favorite_ids' => "{$second->id},{$hidden->id}",
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('filters.favorites', true)
            ->has('items.data', 1)
            ->where('items.data.0.id', $second->id));

        $this->get(route('materials.index', ['favorites' => 1]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 0));
        $this->get(route('materials.index', ['favorites' => 1, 'favorite_ids' => "{$first->id},bozuk"]))
            ->assertSessionHasErrors('favorite_ids');
    }

    public function test_catalog_exposes_accessible_media_without_internal_file_paths(): void
    {
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik', 'is_active' => true]);
        $item = $this->item('Arduino Uno', InventoryVisibility::Status, 5, $category);
        $item->media()->create(['type' => 'image', 'file_path' => 'inventory-media/1/arduino.jpg', 'alt_text' => 'Arduino kartı', 'is_cover' => true]);
        $item->media()->create(['type' => 'link', 'external_url' => 'https://docs.example.com/arduino', 'title' => 'Teknik belge']);

        $this->get(route('materials.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('items.data.0.media', 2)
            ->where('items.data.0.media.0.type', 'image')
            ->where('items.data.0.media.0.altText', 'Arduino kartı')
            ->where('items.data.0.media.0.url', url('/storage/inventory-media/1/arduino.jpg'))
            ->missing('items.data.0.media.0.file_path')
            ->where('items.data.0.media.1.url', 'https://docs.example.com/arduino'));
    }

    private function item(string $name, InventoryVisibility $visibility, float $quantity, InventoryCategory $category, ?InventoryLocation $location = null): InventoryItem
    {
        return InventoryItem::query()->create([
            'category_id' => $category->id, 'location_id' => $location?->id,
            'name' => $name, 'slug' => str($name)->slug().'-'.fake()->unique()->numberBetween(1, 99999),
            'item_type' => InventoryItemType::Consumable, 'unit' => 'adet', 'quantity' => $quantity,
            'public_visibility' => $visibility, 'is_active' => true,
        ]);
    }
}
