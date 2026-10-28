<?php

namespace App\Http\Controllers;

use App\Enums\PrinterStatus;
use App\Models\Announcement;
use App\Models\Filament;
use App\Models\OperatingHour;
use App\Models\Printer;
use App\Models\Setting;
use App\Services\PublicPrinterScheduleService;
use Carbon\CarbonImmutable;
use Inertia\Inertia;
use Inertia\Response;

class PrinterPortalController extends Controller
{
    public function __invoke(PublicPrinterScheduleService $publicSchedule): Response
    {
        $now = CarbonImmutable::now(config('app.timezone'));
        $calendarStart = $now->startOfDay();
        $calendarEnd = $calendarStart->addDays(7);
        $printers = Printer::query()->orderBy('sort_order')->get();
        $availabilityByPrinter = $publicSchedule->currentAvailability($printers, $now);

        return Inertia::render('Printers', [
            'printers' => $printers->map(function (Printer $printer) use ($availabilityByPrinter) {
                return [
                    'code' => $printer->code,
                    'name' => $printer->name,
                    'description' => $printer->description,
                    'status' => $printer->status->value,
                    'statusLabel' => $this->statusLabel($printer->status),
                    ...$availabilityByPrinter[$printer->id],
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
                'email' => Setting::valueOf('workshop.contact_email'),
                'hours' => Setting::valueOf('workshop.contact_hours'),
            ],
            'supportedFormats' => Setting::valueOf('uploads.allowed_extensions', ['gcode', '3mf', 'stl', 'step', 'stp', 'obj']),
            'announcements' => Announcement::query()->visibleAt('printers')->latest('starts_at')->get()->map(fn (Announcement $announcement) => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'body' => $announcement->body,
                'type' => $announcement->type,
            ]),
            'schedule' => $publicSchedule->schedule($calendarStart, $calendarEnd),
        ]);
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
