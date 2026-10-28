<?php

namespace App\Http\Controllers;

use App\Enums\PrinterStatus;
use App\Models\Announcement;
use App\Models\OperatingHour;
use App\Models\Printer;
use App\Models\Setting;
use App\Services\PublicPrinterScheduleService;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(PublicPrinterScheduleService $publicSchedule): Response
    {
        $timezone = config('app.timezone');
        $now = CarbonImmutable::now($timezone);
        $printers = Printer::query()->orderBy('sort_order')->get();
        $activePrinters = $printers->filter(fn (Printer $printer) => $printer->status === PrinterStatus::Active);
        $availabilityByPrinter = $publicSchedule->currentAvailability($printers, $now);
        $todayHours = OperatingHour::query()->firstWhere('weekday', $now->dayOfWeekIso);
        $globallyClosedNow = $publicSchedule->hasCurrentGlobalBlackout($now);
        $isWithinHours = (bool) $todayHours?->is_open
            && $todayHours->opens_at
            && $todayHours->latest_start_at
            && $now->format('H:i:s') >= $todayHours->opens_at
            && $now->format('H:i:s') <= $todayHours->latest_start_at;

        return Inertia::render('Home', [
            'workshop' => [
                'isOpen' => $isWithinHours && $activePrinters->isNotEmpty() && ! $globallyClosedNow,
                'statusLabel' => $globallyClosedNow
                    ? 'Geçici olarak kapalı'
                    : ($isWithinHours ? 'Şu anda açık' : ((bool) $todayHours?->is_open ? 'Şu anda kapalı' : 'Bugün kapalı')),
                'hours' => $todayHours?->is_open
                    ? $this->formatTime($todayHours->opens_at).'–'.$this->formatTime($todayHours->latest_start_at)
                    : 'Bugün kapalı',
                'daysLabel' => $this->daysLabel(),
            ],
            'contact' => [
                'phone' => Setting::valueOf('workshop.contact_phone'),
                'whatsapp' => Setting::valueOf('workshop.whatsapp_number'),
                'email' => Setting::valueOf('workshop.contact_email'),
                'hours' => Setting::valueOf('workshop.contact_hours'),
            ],
            'announcements' => Announcement::query()->visibleAt('home')->latest('starts_at')->get()->map(fn (Announcement $announcement) => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'body' => $announcement->body,
                'type' => $announcement->type,
            ]),
            'printers' => $printers->map(function (Printer $printer) use ($availabilityByPrinter) {
                return [
                    'code' => $printer->code,
                    'name' => $printer->name,
                    'description' => $printer->description,
                    'status' => $printer->status->value,
                    ...$availabilityByPrinter[$printer->id],
                ];
            }),
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
