<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\InventoryItem;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use LogicException;

class InventoryStockService
{
    public function adjust(
        InventoryItem|int $item,
        float|int|string $quantityChange,
        StockMovementType $type,
        ?User $actor = null,
        ?string $reason = null,
        ?Model $source = null,
    ): StockMovement {
        $itemId = $item instanceof InventoryItem ? $item->getKey() : $item;
        $changeInThousandths = $this->toThousandths($quantityChange);

        if ($changeInThousandths === 0) {
            throw new InvalidArgumentException('Stok değişim miktarı sıfır olamaz.');
        }

        return DB::transaction(function () use ($itemId, $changeInThousandths, $type, $actor, $reason, $source) {
            $lockedItem = InventoryItem::query()->lockForUpdate()->findOrFail($itemId);
            $balanceInThousandths = $this->toThousandths($lockedItem->quantity) + $changeInThousandths;

            if ($balanceInThousandths < 0) {
                throw new LogicException('Stok miktarı sıfırın altına düşürülemez.');
            }

            $balance = $this->fromThousandths($balanceInThousandths);
            $change = $this->fromThousandths($changeInThousandths);
            $lockedItem->update(['quantity' => $balance]);

            return StockMovement::query()->create([
                'inventory_item_id' => $lockedItem->id,
                'user_id' => $actor?->id,
                'movement_type' => $type,
                'quantity_change' => $change,
                'balance_after' => $balance,
                'reason' => $reason,
                'source_type' => $source?->getMorphClass(),
                'source_id' => $source?->getKey(),
            ]);
        }, 3);
    }

    public function reverse(StockMovement|int $movement, ?User $actor = null, ?string $reason = null): StockMovement
    {
        $movementId = $movement instanceof StockMovement ? $movement->getKey() : $movement;

        return DB::transaction(function () use ($movementId, $actor, $reason) {
            $original = StockMovement::query()->lockForUpdate()->findOrFail($movementId);

            if ($original->movement_type === StockMovementType::Reversal) {
                throw new LogicException('Bir ters işlem tekrar geri alınamaz.');
            }

            if ($original->reversals()->exists()) {
                throw new LogicException('Bu stok hareketi daha önce geri alınmış.');
            }

            $reversal = $this->adjust(
                $original->inventory_item_id,
                -$this->toThousandths($original->quantity_change) / 1000,
                StockMovementType::Reversal,
                $actor,
                $reason ?? 'Stok hareketi geri alındı.',
                $original,
            );
            $reversal->update(['reversed_movement_id' => $original->id]);

            return $reversal->refresh();
        }, 3);
    }

    private function toThousandths(float|int|string $quantity): int
    {
        if (! is_numeric($quantity)) {
            throw new InvalidArgumentException('Stok miktarı sayısal olmalıdır.');
        }

        return (int) round((float) $quantity * 1000);
    }

    private function fromThousandths(int $quantity): string
    {
        return number_format($quantity / 1000, 3, '.', '');
    }
}
