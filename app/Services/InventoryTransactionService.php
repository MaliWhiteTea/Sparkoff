<?php

namespace App\Services;

use App\Enums\InventoryItemType;
use App\Enums\InventoryTransactionStatus;
use App\Enums\StockMovementType;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use LogicException;

class InventoryTransactionService
{
    public function __construct(private InventoryStockService $stock) {}

    public function issue(InventoryItem $item, User $actor, string $name, ?string $email, float $quantity, ?CarbonImmutable $dueAt, ?string $notes): InventoryTransaction
    {
        return DB::transaction(function () use ($item, $actor, $name, $email, $quantity, $dueAt, $notes) {
            $item = InventoryItem::query()->lockForUpdate()->findOrFail($item->id);
            if ($item->archived_at || ! $item->is_active) {
                throw new LogicException('Pasif veya arşivlenmiş malzeme teslim edilemez.');
            }
            if ($quantity <= 0) {
                throw new LogicException('Miktar sıfırdan büyük olmalıdır.');
            }
            if ($item->item_type === InventoryItemType::Loanable && ! $dueAt) {
                throw new LogicException('Ödünç malzeme için beklenen iade tarihi zorunludur.');
            }
            if ($quantity > (float) $item->availableQuantity()) {
                throw new LogicException($item->item_type === InventoryItemType::FixedAsset
                    ? 'Kullanımdaki demirbaş miktarı mevcut miktarı aşamaz.'
                    : 'Teslim miktarı kullanılabilir stok miktarını aşamaz.');
            }

            $completed = $item->item_type === InventoryItemType::Consumable;
            $transaction = InventoryTransaction::query()->create([
                'inventory_item_id' => $item->id, 'issued_by' => $actor->id, 'item_type' => $item->item_type,
                'status' => $completed ? InventoryTransactionStatus::Completed : InventoryTransactionStatus::Active,
                'recipient_name' => $name, 'recipient_email' => $email, 'quantity' => $quantity,
                'issued_at' => now(), 'due_at' => $item->item_type === InventoryItemType::Loanable ? $dueAt : null,
                'completed_at' => $completed ? now() : null, 'notes' => $notes,
            ]);
            if ($item->item_type !== InventoryItemType::FixedAsset) {
                $this->stock->adjust($item, -$quantity, StockMovementType::Delivery, $actor, 'Malzeme teslimi', $transaction);
            }

            return $transaction->refresh();
        }, 3);
    }

    public function receiveReturn(InventoryTransaction $transaction, User $actor, float $quantity, ?string $note): InventoryTransaction
    {
        return DB::transaction(function () use ($transaction, $actor, $quantity, $note) {
            $transaction = InventoryTransaction::query()->lockForUpdate()->findOrFail($transaction->id);
            if ($transaction->status !== InventoryTransactionStatus::Active) {
                throw new LogicException('Bu kayıt artık aktif değil.');
            }
            if ($quantity <= 0 || $quantity > $transaction->remainingQuantity()) {
                throw new LogicException('İade miktarı kalan miktarı aşamaz ve sıfırdan büyük olmalıdır.');
            }

            if ($transaction->item_type === InventoryItemType::Loanable) {
                $this->stock->adjust($transaction->inventory_item_id, $quantity, StockMovementType::Return, $actor, $note ?: 'Malzeme iadesi', $transaction);
            }
            $returned = round((float) $transaction->quantity_returned + $quantity, 3);
            $completed = $returned >= (float) $transaction->quantity;
            $transaction->update([
                'quantity_returned' => $returned, 'status' => $completed ? InventoryTransactionStatus::Completed : InventoryTransactionStatus::Active,
                'completed_at' => $completed ? now() : null, 'closed_by' => $completed ? $actor->id : null,
                'closure_note' => $note ?: $transaction->closure_note,
            ]);

            return $transaction->refresh();
        }, 3);
    }

    public function closeAs(InventoryTransaction $transaction, User $actor, InventoryTransactionStatus $status, string $note): InventoryTransaction
    {
        if (! in_array($status, [InventoryTransactionStatus::Damaged, InventoryTransactionStatus::Lost], true)) {
            throw new LogicException('Geçersiz kapanış durumu.');
        }

        return DB::transaction(function () use ($transaction, $actor, $status, $note) {
            $transaction = InventoryTransaction::query()->lockForUpdate()->findOrFail($transaction->id);
            if ($transaction->status !== InventoryTransactionStatus::Active) {
                throw new LogicException('Bu kayıt artık aktif değil.');
            }
            if ($transaction->item_type === InventoryItemType::FixedAsset && $transaction->remainingQuantity() > 0) {
                $this->stock->adjust($transaction->inventory_item_id, -$transaction->remainingQuantity(), StockMovementType::Adjustment, $actor, "Demirbaş {$status->value}: {$note}", $transaction);
            }
            $transaction->update(['status' => $status, 'completed_at' => now(), 'closed_by' => $actor->id, 'closure_note' => $note]);

            return $transaction->refresh();
        });
    }
}
