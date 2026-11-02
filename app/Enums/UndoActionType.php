<?php

namespace App\Enums;

enum UndoActionType: string
{
    case InventoryStockAdjustment = 'inventory_stock_adjustment';
    case InventoryBulkCategory = 'inventory_bulk_category';
    case InventoryBulkLocation = 'inventory_bulk_location';
    case InventoryBulkVisibility = 'inventory_bulk_visibility';
    case AnnouncementPublication = 'announcement_publication';

    public function label(): string
    {
        return match ($this) {
            self::InventoryStockAdjustment => 'Stok düzeltmesi',
            self::InventoryBulkCategory => 'Kategori değişikliği',
            self::InventoryBulkLocation => 'Konum değişikliği',
            self::InventoryBulkVisibility => 'Katalog görünürlüğü değişikliği',
            self::AnnouncementPublication => 'Duyuru yayın durumu',
        };
    }
}
