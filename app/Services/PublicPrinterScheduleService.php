<?php

namespace App\Services;

use App\Enums\AppointmentStatus;
use App\Enums\PrinterStatus;
use App\Models\Appointment;
use App\Models\BlackoutPeriod;
use App\Models\Printer;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class PublicPrinterScheduleService
{
    public function hasCurrentGlobalBlackout(CarbonInterface $at): bool
    {
        return BlackoutPeriod::query()
            ->whereNull('printer_id')
            ->where('starts_at', '<=', $at)
            ->where('ends_at', '>', $at)
            ->exists();
    }

    /**
     * @param  Collection<int, Printer>  $printers
     * @return array<int, array{availability: string, availabilityLabel: string}>
     */
    public function currentAvailability(Collection $printers, CarbonInterface $at): array
    {
        $blackouts = BlackoutPeriod::query()
            ->where('starts_at', '<=', $at)
            ->where('ends_at', '>', $at)
            ->get();
        $appointments = Appointment::query()
            ->blocking()
            ->where('starts_at', '<=', $at)
            ->where('ends_at', '>', $at)
            ->get();
        $globalBlackout = $blackouts->firstWhere('printer_id', null);

        return $printers->mapWithKeys(function (Printer $printer) use ($appointments, $blackouts, $globalBlackout) {
            if ($printer->status !== PrinterStatus::Active) {
                return [$printer->id => [
                    'availability' => $printer->status->value,
                    'availabilityLabel' => $this->printerStatusLabel($printer->status),
                ]];
            }

            $blackout = $globalBlackout ?? $blackouts->firstWhere('printer_id', $printer->id);
            if ($blackout) {
                return [$printer->id => [
                    'availability' => $blackout->kind,
                    'availabilityLabel' => $this->blackoutAvailabilityLabel($blackout->kind),
                ]];
            }

            $appointment = $appointments->firstWhere('printer_id', $printer->id);
            if ($appointment) {
                return [$printer->id => [
                    'availability' => 'busy',
                    'availabilityLabel' => $appointment->status === AppointmentStatus::Printing
                        ? 'Baskı yapıyor'
                        : 'Şu anda dolu',
                ]];
            }

            return [$printer->id => [
                'availability' => 'available',
                'availabilityLabel' => 'Şu anda boş',
            ]];
        })->all();
    }

    /** @return list<array<string, mixed>> */
    public function schedule(CarbonInterface $startsAt, CarbonInterface $endsAt): array
    {
        $blackouts = BlackoutPeriod::query()
            ->with('printer:id,code,name')
            ->where('ends_at', '>', $startsAt)
            ->where('starts_at', '<', $endsAt)
            ->get()
            ->map(fn (BlackoutPeriod $block) => [
                'id' => "blackout-{$block->id}",
                'printer' => $block->printer?->name ?? 'Tüm atölye',
                'printerCode' => $block->printer?->code,
                'kind' => $block->kind,
                'kindLabel' => $this->blackoutKindLabel($block->kind),
                'isAllDay' => $block->is_all_day,
                'startsAt' => $block->starts_at->toIso8601String(),
                'endsAt' => $block->ends_at->toIso8601String(),
                'note' => $block->reason,
            ]);

        $appointments = Appointment::query()
            ->with('printer:id,code,name')
            ->blocking()
            ->where('ends_at', '>', $startsAt)
            ->where('starts_at', '<', $endsAt)
            ->get()
            ->map(fn (Appointment $appointment) => [
                'id' => "appointment-{$appointment->id}",
                'printer' => $appointment->printer->name,
                'printerCode' => $appointment->printer->code,
                'kind' => 'busy',
                'kindLabel' => $appointment->status === AppointmentStatus::Printing ? 'Baskı' : 'Randevulu',
                'isAllDay' => false,
                'startsAt' => $appointment->starts_at->toIso8601String(),
                'endsAt' => $appointment->ends_at->toIso8601String(),
                'note' => null,
            ]);

        return $blackouts
            ->concat($appointments)
            ->sortBy('startsAt')
            ->values()
            ->all();
    }

    private function blackoutAvailabilityLabel(string $kind): string
    {
        return match ($kind) {
            'busy' => 'Şu anda dolu',
            'maintenance' => 'Bakımda',
            default => 'Şu anda kapalı',
        };
    }

    private function blackoutKindLabel(string $kind): string
    {
        return match ($kind) {
            'busy' => 'Dolu',
            'maintenance' => 'Bakım',
            default => 'Kapalı',
        };
    }

    private function printerStatusLabel(PrinterStatus $status): string
    {
        return match ($status) {
            PrinterStatus::Active => 'Kullanıma açık',
            PrinterStatus::Maintenance => 'Bakımda',
            PrinterStatus::Inactive => 'Pasif',
        };
    }
}
