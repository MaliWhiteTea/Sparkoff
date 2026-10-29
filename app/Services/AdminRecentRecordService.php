<?php

namespace App\Services;

use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Models\Appointment;
use App\Models\FeedbackReport;
use App\Models\Filament;
use App\Models\InventoryItem;
use App\Models\Printer;
use App\Models\RecentlyViewedRecord;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminRecentRecordService
{
    private const RETAINED_RECORDS = 20;

    /** @return list<string> */
    public function supportedTypes(): array
    {
        return ['inventory', 'appointment', 'printer', 'filament', 'feedback', 'user'];
    }

    /** @return array{type: string, label: string, title: string, description: string, href: string}|null */
    public function track(User $user, string $type, int $recordId): ?array
    {
        $record = $this->resolve($type, $recordId, $this->permissions($user));
        if (! $record) {
            return null;
        }

        DB::transaction(function () use ($recordId, $type, $user) {
            RecentlyViewedRecord::query()->updateOrCreate(
                ['user_id' => $user->id, 'record_type' => $type, 'record_id' => $recordId],
                ['viewed_at' => now()],
            );

            $retainedIds = RecentlyViewedRecord::query()
                ->where('user_id', $user->id)
                ->latest('viewed_at')->latest('id')
                ->limit(self::RETAINED_RECORDS)
                ->pluck('id');
            RecentlyViewedRecord::query()
                ->where('user_id', $user->id)
                ->whereNotIn('id', $retainedIds)
                ->delete();
        });

        return $record;
    }

    /** @return Collection<int, array{type: string, label: string, title: string, description: string, href: string, viewedAt: string}> */
    public function recent(User $user, int $limit = 8): Collection
    {
        $permissions = $this->permissions($user);

        return RecentlyViewedRecord::query()
            ->where('user_id', $user->id)
            ->latest('viewed_at')->latest('id')
            ->limit(self::RETAINED_RECORDS)
            ->get()
            ->map(function (RecentlyViewedRecord $viewed) use ($permissions) {
                $record = $this->resolve($viewed->record_type, $viewed->record_id, $permissions);

                return $record ? [
                    ...$record,
                    'viewedAt' => $viewed->viewed_at->format('d.m.Y H:i'),
                ] : null;
            })
            ->filter()
            ->take(min(max($limit, 1), self::RETAINED_RECORDS))
            ->values();
    }

    private function permissions(User $user): Collection
    {
        return $user->isSystemAdministrator()
            ? collect(config('permissions'))->flatMap(fn ($items) => array_keys($items))
            : $user->roles()->with('permissions:id,key')->get()->flatMap->permissions->pluck('key')->unique();
    }

    /** @return array{type: string, label: string, title: string, description: string, href: string}|null */
    private function resolve(string $type, int $recordId, Collection $permissions): ?array
    {
        $can = fn (string $permission): bool => $permissions->contains($permission);

        return match ($type) {
            'inventory' => $can('inventory.view') ? $this->inventory($recordId) : null,
            'appointment' => config('features.online_booking') && $can('appointments.view') ? $this->appointment($recordId) : null,
            'printer' => $can('printers.view') ? $this->printer($recordId) : null,
            'filament' => $can('printers.manage_filaments') ? $this->filament($recordId) : null,
            'feedback' => $can('feedback.view') ? $this->feedback($recordId) : null,
            'user' => $can('users.view') ? $this->user($recordId) : null,
            default => null,
        };
    }

    private function inventory(int $id): ?array
    {
        $item = InventoryItem::query()->find($id);
        if (! $item) {
            return null;
        }
        $status = $item->archived_at ? 'archived' : ($item->is_active ? 'active' : 'inactive');

        return $this->result('inventory', 'Malzeme', $item->name, "{$item->quantity} {$item->unit}", route('admin.inventory.index', [
            'search' => $item->sku ?: $item->name,
            'status' => $status,
        ]));
    }

    private function appointment(int $id): ?array
    {
        $appointment = Appointment::query()->with('printer:id,name')->find($id);
        if (! $appointment) {
            return null;
        }
        $reference = Str::upper(Str::substr($appointment->public_id, 0, 8));

        return $this->result(
            'appointment', 'Randevu', "Randevu {$reference}",
            $appointment->printer->name.' · '.$appointment->starts_at->format('d.m.Y H:i'),
            route('admin.appointments.show', $appointment->public_id),
        );
    }

    private function printer(int $id): ?array
    {
        $printer = Printer::query()->find($id);

        return $printer ? $this->result(
            'printer', 'Yazıcı', "{$printer->code} · {$printer->name}",
            match ($printer->status->value) {
                'active' => 'Aktif',
                'maintenance' => 'Bakımda',
                default => 'Pasif',
            },
            route('admin.settings.printers.index')."#printer-{$printer->id}",
        ) : null;
    }

    private function filament(int $id): ?array
    {
        $filament = Filament::query()->find($id);

        return $filament ? $this->result(
            'filament', 'Filament', "{$filament->material} · {$filament->color}",
            $filament->is_available ? 'Kullanılabilir' : 'Kullanıma kapalı',
            route('admin.settings.filaments.index')."#filament-{$filament->id}",
        ) : null;
    }

    private function feedback(int $id): ?array
    {
        $feedback = FeedbackReport::query()->find($id);
        if (! $feedback) {
            return null;
        }
        $type = match ($feedback->type) {
            FeedbackType::Suggestion => 'Öneri',
            FeedbackType::Complaint => 'Şikâyet',
            FeedbackType::Bug => 'Hata bildirimi',
        };
        $status = match ($feedback->status) {
            FeedbackStatus::New => 'Yeni',
            FeedbackStatus::Reviewing => 'İnceleniyor',
            FeedbackStatus::Resolved => 'Çözüldü',
            FeedbackStatus::Archived => 'Arşivlendi',
        };

        return $this->result(
            'feedback', 'Talep', "Geri bildirim #{$feedback->id}", "{$type} · {$status}",
            route('admin.feedback.index', ['status' => $feedback->status->value])."#feedback-{$feedback->id}",
        );
    }

    private function user(int $id): ?array
    {
        $user = User::query()->find($id);

        return $user ? $this->result(
            'user', 'Kullanıcı', "Yetkili kullanıcı #{$user->id}",
            $user->is_active ? 'Aktif hesap' : 'Pasif hesap',
            route('admin.access.index')."#user-{$user->id}",
        ) : null;
    }

    /** @return array{type: string, label: string, title: string, description: string, href: string} */
    private function result(string $type, string $label, string $title, string $description, string $href): array
    {
        return compact('type', 'label', 'title', 'description', 'href');
    }
}
