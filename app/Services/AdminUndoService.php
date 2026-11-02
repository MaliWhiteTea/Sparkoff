<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Enums\UndoActionType;
use App\Models\ActivityLog;
use App\Models\Announcement;
use App\Models\InventoryItem;
use App\Models\StockMovement;
use App\Models\UndoAction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use LogicException;

class AdminUndoService
{
    public const WINDOW_SECONDS = 60;

    public function __construct(private readonly InventoryStockService $stock) {}

    public function create(
        User $actor,
        UndoActionType $type,
        array $payload,
        ?ActivityLog $originalLog = null,
    ): UndoAction {
        return UndoAction::query()->create([
            'user_id' => $actor->id,
            'type' => $type,
            'payload' => $payload,
            'original_activity_log_id' => $originalLog?->id,
            'expires_at' => now()->addSeconds(self::WINDOW_SECONDS),
        ]);
    }

    public function flash(UndoAction $action): array
    {
        return [
            'url' => route('admin.undo', $action, false),
            'label' => 'Geri al',
            'description' => $action->type->label().' 60 saniye içinde geri alınabilir.',
            'expiresAt' => $action->expires_at->toIso8601String(),
        ];
    }

    public function execute(UndoAction $action, User $actor): void
    {
        DB::transaction(function () use ($action, $actor) {
            $locked = UndoAction::query()->lockForUpdate()->findOrFail($action->id);

            abort_unless($locked->user_id === $actor->id, 404);
            if ($locked->used_at !== null) {
                throw new LogicException('Bu değişiklik daha önce geri alındı.');
            }
            if ($locked->expires_at->isPast()) {
                throw new LogicException('Geri alma süresi doldu.');
            }

            [$subjectType, $subjectId, $fields] = match ($locked->type) {
                UndoActionType::InventoryStockAdjustment => $this->undoStockAdjustment($locked, $actor),
                UndoActionType::InventoryBulkCategory,
                UndoActionType::InventoryBulkLocation,
                UndoActionType::InventoryBulkVisibility => $this->undoInventoryBulkUpdate($locked, $actor),
                UndoActionType::AnnouncementPublication => $this->undoAnnouncementPublication($locked, $actor),
            };

            $log = ActivityLog::query()->create([
                'user_id' => $actor->id,
                'action' => 'undo_applied',
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'changed_fields' => [
                    'undo_type:'.$locked->type->value,
                    'original_log_id:'.($locked->original_activity_log_id ?? 'none'),
                    ...$fields,
                ],
                'created_at' => now(),
            ]);

            $locked->update(['used_at' => now(), 'reversal_activity_log_id' => $log->id]);
        }, 3);
    }

    private function undoStockAdjustment(UndoAction $action, User $actor): array
    {
        abort_unless($actor->hasPermissionTo('inventory.adjust_stock'), 403);
        $movement = StockMovement::query()->lockForUpdate()->find($action->payload['movement_id'] ?? null);
        if (! $movement || $movement->movement_type !== StockMovementType::Adjustment) {
            throw new LogicException('Stok hareketi artık geri alınamıyor.');
        }

        $reversal = $this->stock->reverse($movement, $actor, 'Kısa süreli geri alma işlemi');

        return [StockMovement::class, $reversal->id, ['movement_id:'.$movement->id]];
    }

    private function undoInventoryBulkUpdate(UndoAction $action, User $actor): array
    {
        abort_unless($actor->hasPermissionTo('inventory.update'), 403);
        $field = match ($action->type) {
            UndoActionType::InventoryBulkCategory => 'category_id',
            UndoActionType::InventoryBulkLocation => 'location_id',
            UndoActionType::InventoryBulkVisibility => 'public_visibility',
            default => throw new LogicException('Bu toplu işlem geri alınamaz.'),
        };
        $snapshots = collect($action->payload['items'] ?? []);
        if ($snapshots->isEmpty() || $snapshots->count() > 100) {
            throw new LogicException('Geri alma kaydı geçersiz.');
        }

        $ids = $snapshots->pluck('id')->map(fn ($id) => (int) $id)->sort()->values();
        $items = InventoryItem::query()->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        if ($items->count() !== $ids->count()) {
            throw new LogicException('Malzemelerden biri artık bulunamadığı için işlem geri alınamadı.');
        }

        foreach ($snapshots as $snapshot) {
            $item = $items->get((int) $snapshot['id']);
            if (! $this->sameValue($item->getRawOriginal($field), $snapshot['after'] ?? null)) {
                throw new LogicException('Malzemelerden biri daha sonra değiştirildiği için işlem geri alınamadı.');
            }
        }
        foreach ($snapshots as $snapshot) {
            $items->get((int) $snapshot['id'])->update([$field => $snapshot['before'] ?? null]);
        }

        return [InventoryItem::class, null, ['item_count:'.$snapshots->count(), $field]];
    }

    private function undoAnnouncementPublication(UndoAction $action, User $actor): array
    {
        $announcement = Announcement::query()->lockForUpdate()->find($action->payload['announcement_id'] ?? null);
        if (! $announcement) {
            throw new LogicException('Duyuru artık bulunamadığı için işlem geri alınamadı.');
        }
        $this->authorizeAnnouncementUpdate($announcement, $actor);
        if ($announcement->is_published !== (bool) ($action->payload['after'] ?? null)) {
            throw new LogicException('Duyurunun yayın durumu daha sonra değiştirildiği için işlem geri alınamadı.');
        }

        $announcement->update(['is_published' => (bool) ($action->payload['before'] ?? false)]);

        return [Announcement::class, $announcement->id, ['is_published']];
    }

    private function authorizeAnnouncementUpdate(Announcement $announcement, User $actor): void
    {
        $canPublic = $announcement->audience === 'staff' || $actor->hasPermissionTo('announcements.update');
        $canStaff = $announcement->audience === 'public' || $actor->hasPermissionTo('staff_announcements.update');
        abort_unless($canPublic && $canStaff, 403);
    }

    private function sameValue(mixed $current, mixed $expected): bool
    {
        return $current === $expected || (string) $current === (string) $expected;
    }
}
