<?php

namespace App\Http\Controllers;

use App\Enums\PrinterStatus;
use App\Models\BlackoutPeriod;
use App\Models\Filament;
use App\Models\OperatingHour;
use App\Models\Printer;
use App\Models\Setting;
use Inertia\Inertia;
use Inertia\Response;

class PrinterPortalController extends Controller
{
    public function __invoke(): Response
    {
        $calendarStart = now()->startOfDay();
        $calendarEnd = $calendarStart->copy()->addDays(7);
        $now = now();
        $currentBlocks = BlackoutPeriod::query()
            ->where('starts_at', '<=', $now)
            ->where('ends_at', '>', $now)
            ->get();
        $globalBlock = $currentBlocks->firstWhere('printer_id', null);

        return Inertia::render('Printers', [
            'printers' => Printer::query()->orderBy('sort_order')->get()->map(function (Printer $printer) use ($currentBlocks, $globalBlock) {
                $block = $globalBlock ?? $currentBlocks->firstWhere('printer_id', $printer->id);

                return [
                    'code' => $printer->code,
                    'name' => $printer->name,
                    'description' => $printer->description,
                    'status' => $printer->status->value,
                    'statusLabel' => $this->statusLabel($printer->status),
                    'availability' => $this->availability($printer->status, $block?->kind),
                    'availabilityLabel' => $this->availabilityLabel($printer->status, $block?->kind),
                ];
            }),
            'hours' => OperatingHour::query()->orderBy('weekday')->get()->map(fn (OperatingHour $hours) => [
                'weekday' => $hours->weekday,
                'day' => ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][$hours->weekday - 1],
                'isOpen' => $hours->is_open,
                'opensAt' => $this->shortTime($hours->opens_at),
                'closesAt' => $this->shortTime($hours->latest_start_at),
            ]),
            'filamentSummary' => [
                'availableOptions' => Filament::query()->where('is_available', true)->count(),
                'materials' => Filament::query()->where('is_available', true)->distinct()->orderBy('material')->pluck('material'),
            ],
            'contact' => [
                'phone' => Setting::valueOf('workshop.contact_phone'),
                'whatsapp' => Setting::valueOf('workshop.whatsapp_number'),
                'hours' => Setting::valueOf('workshop.contact_hours', 'Atölye çalışma saatleri içinde'),
            ],
            'supportedFormats' => Setting::valueOf('uploads.allowed_extensions', ['gcode', '3mf', 'stl', 'step', 'stp', 'obj']),
            'schedule' => BlackoutPeriod::query()
                ->with('printer:id,code,name')
                ->where('ends_at', '>', $calendarStart)
                ->where('starts_at', '<', $calendarEnd)
                ->orderBy('starts_at')
                ->get()
                ->map(fn (BlackoutPeriod $block) => [
                    'id' => $block->id,
                    'printer' => $block->printer?->name ?? 'Tüm atölye',
                    'printerCode' => $block->printer?->code,
                    'kind' => $block->kind,
                    'kindLabel' => $this->kindLabel($block->kind),
                    'startsAt' => $block->starts_at->toIso8601String(),
                    'endsAt' => $block->ends_at->toIso8601String(),
                    'note' => $block->reason,
                ]),
        ]);
    }

    private function availability(PrinterStatus $status, ?string $blockKind): string
    {
        if ($status !== PrinterStatus::Active) {
            return $status->value;
        }

        return $blockKind ?? 'available';
    }

    private function availabilityLabel(PrinterStatus $status, ?string $blockKind): string
    {
        if ($status !== PrinterStatus::Active) {
            return $this->statusLabel($status);
        }

        return match ($blockKind) {
            'busy' => 'Şu anda dolu',
            'maintenance' => 'Bakımda',
            'closed' => 'Şu anda kapalı',
            default => 'Şu anda boş',
        };
    }

    private function kindLabel(string $kind): string
    {
        return match ($kind) {
            'busy' => 'Dolu',
            'maintenance' => 'Bakım',
            default => 'Kapalı',
        };
    }

    private function shortTime(?string $time): ?string
    {
        return $time ? substr($time, 0, 5) : null;
    }

    private function statusLabel(PrinterStatus $status): string
    {
        return match ($status) {
            PrinterStatus::Active => 'Kullanıma açık',
            PrinterStatus::Maintenance => 'Bakımda',
            PrinterStatus::Inactive => 'Pasif',
        };
    }
}
