<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Enums\StockMovementType;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\StockMovement;
use App\Services\InventoryStockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

class InventoryFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_item_keeps_classification_location_stock_and_public_details(): void
    {
        $category = InventoryCategory::query()->create(['name' => 'Geliştirme Kartları', 'slug' => 'gelistirme-kartlari']);
        $location = InventoryLocation::query()->create(['name' => 'Elektronik Rafı', 'code' => 'E-R01']);

        $item = InventoryItem::query()->create([
            'category_id' => $category->id,
            'location_id' => $location->id,
            'name' => 'Arduino Uno',
            'slug' => 'arduino-uno',
            'sku' => 'ARD-UNO',
            'item_type' => InventoryItemType::Loanable,
            'unit' => 'adet',
            'quantity' => 30,
            'minimum_stock' => 5,
            'public_visibility' => InventoryVisibility::Exact,
            'technical_specs' => ['model' => 'R3', 'gerilim' => '5V'],
            'image_path' => 'inventory/arduino-uno.webp',
        ]);

        $this->assertSame($category->id, $item->category->id);
        $this->assertSame($location->id, $item->location->id);
        $this->assertSame(InventoryItemType::Loanable, $item->item_type);
        $this->assertSame(InventoryVisibility::Exact, $item->public_visibility);
        $this->assertSame('R3', $item->technical_specs['model']);
        $this->assertFalse($item->isLowOnStock());
    }

    public function test_stock_movement_can_point_to_the_movement_it_reverses(): void
    {
        $item = InventoryItem::query()->create([
            'name' => 'PLA Filament',
            'slug' => 'pla-filament',
            'item_type' => InventoryItemType::Consumable,
            'unit' => 'gram',
            'quantity' => 750,
            'public_visibility' => InventoryVisibility::Status,
        ]);
        $delivery = StockMovement::query()->create([
            'inventory_item_id' => $item->id,
            'movement_type' => StockMovementType::Delivery,
            'quantity_change' => -250,
            'balance_after' => 750,
            'reason' => 'Proje kullanımı',
        ]);
        $reversal = StockMovement::query()->create([
            'inventory_item_id' => $item->id,
            'reversed_movement_id' => $delivery->id,
            'movement_type' => StockMovementType::Reversal,
            'quantity_change' => 250,
            'balance_after' => 1000,
            'reason' => 'Hatalı işlem geri alındı',
        ]);

        $this->assertTrue($reversal->reversedMovement->is($delivery));
        $this->assertTrue($delivery->reversals->first()->is($reversal));
    }

    public function test_stock_service_updates_locked_balance_and_can_reverse_the_movement_once(): void
    {
        $item = InventoryItem::query()->create([
            'name' => 'Arduino Uno',
            'slug' => 'arduino-uno',
            'item_type' => InventoryItemType::Loanable,
            'quantity' => 30,
            'public_visibility' => InventoryVisibility::Exact,
        ]);
        $service = app(InventoryStockService::class);

        $delivery = $service->adjust($item, -1, StockMovementType::Delivery, reason: 'Ödünç verildi');
        $reversal = $service->reverse($delivery, reason: 'Teslim kaydı iptal edildi');

        $this->assertSame('30.000', $item->fresh()->quantity);
        $this->assertSame('-1.000', $delivery->quantity_change);
        $this->assertSame('1.000', $reversal->quantity_change);
        $this->assertSame($delivery->id, $reversal->reversed_movement_id);

        $this->expectException(LogicException::class);
        $service->reverse($delivery);
    }

    public function test_stock_service_prevents_a_negative_balance(): void
    {
        $item = InventoryItem::query()->create([
            'name' => 'Lehim Teli',
            'slug' => 'lehim-teli',
            'item_type' => InventoryItemType::Consumable,
            'quantity' => 2,
            'public_visibility' => InventoryVisibility::Status,
        ]);

        $this->expectException(LogicException::class);
        app(InventoryStockService::class)->adjust($item, -3, StockMovementType::Delivery);

        $this->assertSame('2.000', $item->fresh()->quantity);
    }
}
