<?php

namespace App\Models;

use App\Enums\InventoryItemType;
use App\Enums\InventoryTransactionStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['inventory_item_id', 'issued_by', 'closed_by', 'item_type', 'status', 'recipient_name', 'recipient_email', 'quantity', 'quantity_returned', 'issued_at', 'due_at', 'completed_at', 'anonymized_at', 'notes', 'closure_note'])]
class InventoryTransaction extends Model
{
    protected function casts(): array
    {
        return [
            'item_type' => InventoryItemType::class,
            'status' => InventoryTransactionStatus::class,
            'recipient_name' => 'encrypted',
            'recipient_email' => 'encrypted',
            'quantity' => 'decimal:3',
            'quantity_returned' => 'decimal:3',
            'issued_at' => 'datetime',
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
            'anonymized_at' => 'datetime',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function remainingQuantity(): float
    {
        return round((float) $this->quantity - (float) $this->quantity_returned, 3);
    }
}
