<?php

namespace App\Models;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'category_id', 'location_id', 'name', 'slug', 'sku', 'item_type', 'unit', 'quantity',
    'minimum_stock', 'public_visibility', 'description', 'technical_specs', 'image_path',
    'is_active', 'archived_at',
])]
class InventoryItem extends Model
{
    protected function casts(): array
    {
        return [
            'item_type' => InventoryItemType::class,
            'public_visibility' => InventoryVisibility::class,
            'quantity' => 'decimal:3',
            'minimum_stock' => 'decimal:3',
            'technical_specs' => 'array',
            'is_active' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(InventoryCategory::class, 'category_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(InventoryLocation::class, 'location_id');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(InventoryMedia::class)->orderBy('sort_order')->orderBy('id');
    }

    public function isLowOnStock(): bool
    {
        return $this->minimum_stock !== null && (float) $this->quantity <= (float) $this->minimum_stock;
    }
}
