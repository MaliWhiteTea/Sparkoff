<?php

namespace App\Models;

use App\Enums\InventoryItemType;
use App\Enums\InventoryTransactionStatus;
use App\Enums\InventoryVisibility;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
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

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    public function scopeWithAvailableQuantity(Builder $query): Builder
    {
        return $query->addSelect('inventory_items.*')->selectSub(
            InventoryTransaction::query()
                ->selectRaw('COALESCE(SUM(quantity - quantity_returned), 0)')
                ->whereColumn('inventory_item_id', 'inventory_items.id')
                ->where('status', InventoryTransactionStatus::Active),
            'quantity_in_use',
        );
    }

    public function scopeWhereAvailable(Builder $query, bool $available = true): Builder
    {
        $operator = $available ? '>' : '<=';

        return $query->where(function (Builder $scope) use ($operator) {
            $scope->where(function (Builder $regular) use ($operator) {
                $regular->where('item_type', '!=', InventoryItemType::FixedAsset)
                    ->where('quantity', $operator, 0);
            })->orWhere(function (Builder $fixedAsset) use ($operator) {
                $fixedAsset->where('item_type', InventoryItemType::FixedAsset)
                    ->whereRaw("inventory_items.quantity {$operator} COALESCE((SELECT SUM(quantity - quantity_returned) FROM inventory_transactions WHERE inventory_transactions.inventory_item_id = inventory_items.id AND inventory_transactions.status = ?), 0)", [InventoryTransactionStatus::Active->value]);
            });
        });
    }

    public function availableQuantity(): string
    {
        if ($this->item_type !== InventoryItemType::FixedAsset) {
            return number_format(max(0, (float) $this->quantity), 3, '.', '');
        }

        $inUse = array_key_exists('quantity_in_use', $this->attributes)
            ? (float) $this->getAttribute('quantity_in_use')
            : (float) $this->transactions()
                ->where('status', InventoryTransactionStatus::Active)
                ->selectRaw('COALESCE(SUM(quantity - quantity_returned), 0) as aggregate')
                ->value('aggregate');

        return number_format(max(0, (float) $this->quantity - $inUse), 3, '.', '');
    }

    public function isLowOnStock(): bool
    {
        return $this->minimum_stock !== null && (float) $this->quantity <= (float) $this->minimum_stock;
    }
}
