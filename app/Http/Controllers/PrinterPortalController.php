<?php

namespace App\Http\Controllers;

use App\Enums\PrinterStatus;
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
        return Inertia::render('Printers', [
            'printers' => Printer::query()->orderBy('sort_order')->get()->map(fn (Printer $printer) => [
                'code' => $printer->code,
                'name' => $printer->name,
                'description' => $printer->description,
                'status' => $printer->status->value,
                'statusLabel' => $this->statusLabel($printer->status),
            ]),
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
