<?php

namespace App\Models;

use App\Enums\StockMovementType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable([
    'inventory_item_id', 'user_id', 'reversed_movement_id', 'movement_type',
    'quantity_change', 'balance_after', 'reason', 'source_type', 'source_id',
])]
class StockMovement extends Model
{
    protected function casts(): array
    {
        return [
            'movement_type' => StockMovementType::class,
            'quantity_change' => 'decimal:3',
            'balance_after' => 'decimal:3',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reversedMovement(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reversed_movement_id');
    }

    public function reversals(): HasMany
    {
        return $this->hasMany(self::class, 'reversed_movement_id');
    }

    public function source(): MorphTo
    {
        return $this->morphTo();
    }
}
