<?php

namespace App\Services;

use App\Enums\AppointmentStatus;
use App\Enums\FeedbackStatus;
use App\Enums\InventoryTransactionStatus;
use App\Enums\PrinterStatus;
use App\Models\AdminNotificationRead;
use App\Models\Appointment;
use App\Models\FeedbackReport;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\Printer;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class AdminNotificationService
{
    /** @return Collection<int, array{key: string, type: string, title: string, description: string, href: string, tone: string, createdAt: string, isRead: bool}> */
    public function notifications(User $user): Collection
    {
        $permissions = $user->isSystemAdministrator()
            ? collect(config('permissions'))->flatMap(fn ($items) => array_keys($items))
            : $user->roles()->with('permissions:id,key')->get()->flatMap->permissions->pluck('key')->unique();
        $can = fn (string $permission): bool => $permissions->contains($permission);
        $notifications = collect();

        if ($can('inventory.view')) {
            $notifications->push($this->make(
                InventoryItem::query()
                    ->whereNull('archived_at')->where('is_active', true)->whereNotNull('minimum_stock')
                    ->whereColumn('quantity', '<=', 'minimum_stock')->where('quantity', '>', 0),
                'critical-stock', 'Kritik stok',
                fn (int $count) => "{$count} malzeme minimum stok seviyesine ulaştı.",
                route('admin.inventory.index', ['status' => 'low']), 'warning',
            ));
        }
        if ($can('loans.view')) {
            $notifications->push($this->make(
                InventoryTransaction::query()
                    ->where('status', InventoryTransactionStatus::Active)
                    ->whereNotNull('due_at')->where('due_at', '<', now()),
                'overdue-loans', 'Geciken teslimler',
                fn (int $count) => "{$count} açık teslim kaydının iade tarihi geçti.",
                route('admin.loans.index', ['status' => 'overdue']), 'danger',
            ));
        }
        if (config('features.online_booking') && $can('appointments.view')) {
            $notifications->push($this->make(
                Appointment::query()->where('status', AppointmentStatus::PendingApproval),
                'pending-appointments', 'Onay bekleyen randevular',
                fn (int $count) => "{$count} doğrulanmış randevu başvurusu incelenmeyi bekliyor.",
                route('admin.appointments.index', ['status' => AppointmentStatus::PendingApproval->value]), 'info',
            ));
        }
        if ($can('printers.view')) {
            $notifications->push($this->make(
                Printer::query()->where('status', PrinterStatus::Maintenance),
                'maintenance-printers', 'Bakımda yazıcılar',
                fn (int $count) => "{$count} yazıcı bakım nedeniyle kullanıma kapalı.",
                route('admin.settings.printers.index'), 'warning',
            ));
        }
        if ($can('feedback.view')) {
            $notifications->push($this->make(
                FeedbackReport::query()->whereIn('status', [FeedbackStatus::New, FeedbackStatus::Reviewing]),
                'open-feedback', 'Açık talepler',
                fn (int $count) => "{$count} geri bildirim henüz sonuçlandırılmadı.",
                route('admin.feedback.index', ['status' => 'open']), 'info',
            ));
        }

        $notifications = $notifications->filter()->values();
        $readKeys = AdminNotificationRead::query()
            ->where('user_id', $user->id)
            ->whereIn('notification_key', $notifications->pluck('key'))
            ->pluck('notification_key')
            ->all();

        return $notifications
            ->map(fn (array $notification) => [
                ...$notification,
                'isRead' => in_array($notification['key'], $readKeys, true),
            ])
            ->sortByDesc('sortAt')
            ->map(function (array $notification) {
                unset($notification['sortAt']);

                return $notification;
            })
            ->values();
    }

    public function unreadCount(User $user): int
    {
        return $this->notifications($user)->where('isRead', false)->count();
    }

    public function markRead(User $user, string $key): void
    {
        $notification = $this->notifications($user)->firstWhere('key', $key);
        if (! $notification) {
            return;
        }

        DB::transaction(function () use ($key, $notification, $user) {
            AdminNotificationRead::query()
                ->where('user_id', $user->id)
                ->where('notification_key', 'like', $notification['type'].'-%')
                ->where('notification_key', '!=', $key)
                ->delete();
            AdminNotificationRead::query()->updateOrCreate(
                ['user_id' => $user->id, 'notification_key' => $key],
                ['read_at' => now()],
            );
        });
    }

    public function markAllRead(User $user): void
    {
        $keys = $this->notifications($user)->pluck('key');
        if ($keys->isEmpty()) {
            return;
        }

        DB::transaction(function () use ($keys, $user) {
            AdminNotificationRead::query()
                ->where('user_id', $user->id)
                ->whereNotIn('notification_key', $keys)
                ->delete();
            foreach ($keys as $key) {
                AdminNotificationRead::query()->updateOrCreate(
                    ['user_id' => $user->id, 'notification_key' => $key],
                    ['read_at' => now()],
                );
            }
        });
    }

    /** @return array{key: string, type: string, title: string, description: string, href: string, tone: string, createdAt: string, sortAt: int}|null */
    private function make(Builder $query, string $type, string $title, callable $description, string $href, string $tone): ?array
    {
        $aggregate = (clone $query)->selectRaw(
            'COUNT(*) as aggregate_count, COALESCE(SUM(id), 0) as aggregate_sum, COALESCE(MIN(id), 0) as aggregate_min, COALESCE(MAX(id), 0) as aggregate_max, MAX(updated_at) as latest_update',
        )->first();
        $count = (int) $aggregate->aggregate_count;
        if ($count === 0) {
            return null;
        }

        $signature = implode('|', [
            $count,
            $aggregate->aggregate_sum,
            $aggregate->aggregate_min,
            $aggregate->aggregate_max,
            $aggregate->latest_update,
        ]);

        $latestUpdate = Carbon::parse($aggregate->latest_update);

        return [
            'key' => $type.'-'.substr(hash('sha256', $signature), 0, 24),
            'type' => $type,
            'title' => $title,
            'description' => $description($count),
            'href' => $href,
            'tone' => $tone,
            'createdAt' => $latestUpdate->format('d.m.Y H:i'),
            'sortAt' => $latestUpdate->timestamp,
        ];
    }
}
