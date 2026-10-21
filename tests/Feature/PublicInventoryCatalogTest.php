<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
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
        $this->item('HC-SR04 Sensör', InventoryVisibility::Status, 4, $category);
        $this->item('Gizli Parça', InventoryVisibility::Hidden, 99, $category);
        $archived = $this->item('Arşiv Parça', InventoryVisibility::Exact, 2, $category);
        $archived->update(['is_active' => false, 'archived_at' => now()]);

        $this->get(route('materials.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Materials')
            ->has('items.data', 2)
            ->where('items.data.0.id', $exact->id)
            ->where('items.data.0.quantity', '30.000')
            ->where('items.data.0.location', null)
            ->where('items.data.1.quantity', null));
    }

    public function test_catalog_search_and_filters_work_together(): void
    {
        $electronics = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik', 'is_active' => true]);
        $mechanics = InventoryCategory::query()->create(['name' => 'Mekanik', 'slug' => 'mekanik', 'is_active' => true]);
        $wanted = $this->item('Arduino Uno R3', InventoryVisibility::Status, 5, $electronics);
        $this->item('Arduino Nano', InventoryVisibility::Status, 0, $electronics);
        $this->item('Lineer Rulman', InventoryVisibility::Status, 5, $mechanics);

        $this->get(route('materials.index', ['search' => 'Arduino R3', 'category' => $electronics->id, 'stock' => 'available']))
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 1)
            ->where('items.data.0.id', $wanted->id)
            ->where('filters.search', 'Arduino R3'));
    }

    public function test_catalog_rejects_invalid_filters(): void
    {
        $this->get(route('materials.index', ['stock' => 'secret']))->assertSessionHasErrors('stock');
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
