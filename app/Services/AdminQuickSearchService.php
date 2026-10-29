<?php

namespace App\Services;

use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Models\Appointment;
use App\Models\FeedbackReport;
use App\Models\Filament;
use App\Models\InventoryItem;
use App\Models\Printer;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class AdminQuickSearchService
{
    private const MODULE_LIMIT = 5;

    /** @return Collection<int, array{id: string, module: string, title: string, description: string, href: string}> */
    public function search(User $user, string $query): Collection
    {
        $terms = collect(preg_split('/\s+/u', $query, -1, PREG_SPLIT_NO_EMPTY))
            ->take(5)
            ->values()
            ->all();
        $permissions = $user->isSystemAdministrator()
            ? collect(config('permissions'))->flatMap(fn ($items) => array_keys($items))
            : $user->roles()->with('permissions:id,key')->get()->flatMap->permissions->pluck('key')->unique();
        $can = fn (string $permission): bool => $permissions->contains($permission);
        $results = collect();

        if ($can('inventory.view')) {
            $results->push(...$this->inventory($terms));
        }
        if (config('features.online_booking') && $can('appointments.view')) {
            $results->push(...$this->appointments($terms, $can('appointments.view_personal_data')));
        }
        if ($can('printers.view')) {
            $results->push(...$this->printers($terms));
        }
        if ($can('printers.manage_filaments')) {
            $results->push(...$this->filaments($terms));
        }
        if ($can('feedback.view')) {
            $results->push(...$this->feedback($terms));
        }
        if ($can('users.view')) {
            $results->push(...$this->users($terms));
        }

        return $results->values();
    }

    private function inventory(array $terms): Collection
    {
        return $this->matching(InventoryItem::query(), $terms, ['name', 'sku', 'description'])
            ->orderByDesc('updated_at')->limit(self::MODULE_LIMIT)->get()
            ->map(function (InventoryItem $item) {
                $status = $item->archived_at ? 'archived' : ($item->is_active ? 'active' : 'inactive');

                return $this->result(
                    "inventory-{$item->id}",
                    'Malzemeler',
                    $item->name,
                    collect([$item->sku, number_format((float) $item->quantity, 3, ',', '.').' '.$item->unit])->filter()->join(' · '),
                    route('admin.inventory.index', ['search' => $item->sku ?: $item->name, 'status' => $status]),
                );
            });
    }

    private function appointments(array $terms, bool $canViewPersonalData): Collection
    {
        $columns = ['public_id', 'filament_material', 'filament_color'];
        if ($canViewPersonalData) {
            $columns = [...$columns, 'first_name', 'last_name', 'email'];
        }

        return $this->matching(Appointment::query()->with('printer:id,name'), $terms, $columns)
            ->orderByDesc('starts_at')->limit(self::MODULE_LIMIT)->get()
            ->map(function (Appointment $appointment) use ($canViewPersonalData) {
                $reference = Str::upper(Str::substr($appointment->public_id, 0, 8));
                $title = $canViewPersonalData
                    ? trim("{$appointment->first_name} {$appointment->last_name}")
                    : "Randevu {$reference}";
                $description = collect([
                    $canViewPersonalData ? $appointment->email : null,
                    $appointment->printer->name,
                    $appointment->starts_at->format('d.m.Y H:i'),
                ])->filter()->join(' · ');

                return $this->result(
                    "appointment-{$appointment->id}",
                    'Randevular',
                    $title,
                    $description,
                    route('admin.appointments.show', $appointment->public_id),
                );
            });
    }

    private function printers(array $terms): Collection
    {
        return $this->matching(Printer::query(), $terms, ['code', 'name', 'description'])
            ->orderBy('sort_order')->limit(self::MODULE_LIMIT)->get()
            ->map(fn (Printer $printer) => $this->result(
                "printer-{$printer->id}",
                'Yazıcılar',
                "{$printer->code} · {$printer->name}",
                match ($printer->status->value) {
                    'active' => 'Aktif',
                    'maintenance' => 'Bakımda',
                    default => 'Pasif',
                },
                route('admin.settings.printers.index')."#printer-{$printer->id}",
            ));
    }

    private function filaments(array $terms): Collection
    {
        return $this->matching(Filament::query(), $terms, ['material', 'color', 'brand'])
            ->orderBy('material')->orderBy('sort_order')->limit(self::MODULE_LIMIT)->get()
            ->map(fn (Filament $filament) => $this->result(
                "filament-{$filament->id}",
                'Filamentler',
                "{$filament->material} · {$filament->color}",
                collect([$filament->brand, $filament->is_available ? 'Kullanılabilir' : 'Kullanıma kapalı'])->filter()->join(' · '),
                route('admin.settings.filaments.index')."#filament-{$filament->id}",
            ));
    }

    private function feedback(array $terms): Collection
    {
        return $this->matching(FeedbackReport::query(), $terms, ['message', 'admin_note'])
            ->latest()->limit(self::MODULE_LIMIT)->get()
            ->map(fn (FeedbackReport $report) => $this->result(
                "feedback-{$report->id}",
                'Talepler',
                Str::limit($report->message, 72),
                $this->feedbackType($report->type).' · '.$this->feedbackStatus($report->status),
                route('admin.feedback.index', ['status' => $report->status->value])."#feedback-{$report->id}",
            ));
    }

    private function users(array $terms): Collection
    {
        return $this->matching(User::query(), $terms, ['name', 'email'])
            ->orderBy('name')->limit(self::MODULE_LIMIT)->get()
            ->map(fn (User $user) => $this->result(
                "user-{$user->id}",
                'Kullanıcılar',
                $user->name,
                $user->email.' · '.($user->is_active ? 'Aktif hesap' : 'Pasif hesap'),
                route('admin.access.index')."#user-{$user->id}",
            ));
    }

    private function matching(Builder $query, array $terms, array $columns): Builder
    {
        foreach ($terms as $term) {
            $pattern = '%'.str_replace(['%', '_'], '', $term).'%';
            $query->where(function (Builder $nested) use ($columns, $pattern) {
                foreach ($columns as $index => $column) {
                    $method = $index === 0 ? 'where' : 'orWhere';
                    $nested->{$method}($column, 'like', $pattern);
                }
            });
        }

        return $query;
    }

    private function feedbackType(FeedbackType $type): string
    {
        return match ($type) {
            FeedbackType::Suggestion => 'Öneri',
            FeedbackType::Complaint => 'Şikâyet',
            FeedbackType::Bug => 'Hata bildirimi',
        };
    }

    private function feedbackStatus(FeedbackStatus $status): string
    {
        return match ($status) {
            FeedbackStatus::New => 'Yeni',
            FeedbackStatus::Reviewing => 'İnceleniyor',
            FeedbackStatus::Resolved => 'Çözüldü',
            FeedbackStatus::Archived => 'Arşivlendi',
        };
    }

    /** @return array{id: string, module: string, title: string, description: string, href: string} */
    private function result(string $id, string $module, string $title, string $description, string $href): array
    {
        return compact('id', 'module', 'title', 'description', 'href');
    }
}
