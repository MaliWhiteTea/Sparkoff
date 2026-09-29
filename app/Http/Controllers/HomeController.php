<?php

namespace App\Http\Controllers;

use App\Enums\PrinterStatus;
use App\Models\BlackoutPeriod;
use App\Models\OperatingHour;
use App\Models\Printer;
use App\Services\AppointmentAvailabilityService;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(AppointmentAvailabilityService $availability): Response
    {
        $timezone = config('app.timezone');
        $now = CarbonImmutable::now($timezone);
        $printers = Printer::query()->orderBy('sort_order')->get();
        $activePrinters = $printers->filter(fn (Printer $printer) => $printer->status === PrinterStatus::Active);
        $todayHours = OperatingHour::query()->firstWhere('weekday', $now->dayOfWeekIso);
        $globallyClosedNow = BlackoutPeriod::query()
            ->whereNull('printer_id')
            ->where('starts_at', '<=', $now)
            ->where('ends_at', '>', $now)
            ->exists();

        $nextSlot = null;
        foreach (range(0, 14) as $dayOffset) {
            $date = $now->addDays($dayOffset)->startOfDay();

            foreach ($activePrinters as $printer) {
                $slots = $availability->availableStartTimes($printer, $date, 60);
                if ($slots === []) {
                    continue;
                }

                $candidate = CarbonImmutable::createFromFormat('Y-m-d H:i', "{$date->format('Y-m-d')} {$slots[0]}", $timezone);
                if (! $nextSlot || $candidate->lessThan($nextSlot['dateTime'])) {
                    $nextSlot = ['dateTime' => $candidate, 'printer' => $printer];
                }
            }

            if ($nextSlot) {
                break;
            }
        }

        return Inertia::render('Home', [
            'workshop' => [
                'isOpen' => (bool) $todayHours?->is_open && $activePrinters->isNotEmpty() && ! $globallyClosedNow,
                'statusLabel' => $globallyClosedNow ? 'Geçici olarak kapalı' : ((bool) $todayHours?->is_open ? 'Bugün açık' : 'Bugün kapalı'),
                'hours' => $todayHours?->is_open
                    ? $this->formatTime($todayHours->opens_at).'–'.$this->formatTime($todayHours->latest_start_at)
                    : 'Randevu başlangıcı kapalı',
                'daysLabel' => $this->daysLabel(),
            ],
            'nextSlot' => $nextSlot ? [
                'label' => $nextSlot['dateTime']->translatedFormat('l, H.i'),
                'printer' => $nextSlot['printer']->name,
            ] : null,
            'printers' => $printers->map(fn (Printer $printer) => [
                'code' => $printer->code,
                'name' => $printer->name,
                'description' => $printer->description,
                'status' => $printer->status->value,
                'statusLabel' => match ($printer->status) {
                    PrinterStatus::Active => 'Kullanıma açık',
                    PrinterStatus::Maintenance => 'Bakımda',
                    PrinterStatus::Inactive => 'Pasif',
                },
            ]),
        ]);
    }

    private function formatTime(?string $time): string
    {
        return $time ? str_replace(':', '.', substr($time, 0, 5)) : '—';
    }

    private function daysLabel(): string
    {
        $openDays = OperatingHour::query()->where('is_open', true)->orderBy('weekday')->pluck('weekday')->all();

        return match ($openDays) {
            [1, 2, 3, 4, 5, 6, 7] => 'Her gün',
            [1, 2, 3, 4, 5] => 'Hafta içi',
            default => count($openDays).' gün açık',
        };
    }
}
