<?php

namespace App\Services;

use App\Enums\PrinterStatus;
use App\Exceptions\SlotUnavailableException;
use App\Models\Appointment;
use App\Models\BlackoutPeriod;
use App\Models\OperatingHour;
use App\Models\Printer;
use App\Models\Setting;
use Carbon\CarbonImmutable;

class AppointmentAvailabilityService
{
    public function assertAvailable(Printer $printer, CarbonImmutable $startsAt, int $durationMinutes): CarbonImmutable
    {
        if ($printer->status !== PrinterStatus::Active) {
            throw new SlotUnavailableException('Seçilen yazıcı şu anda randevuya açık değil.');
        }

        $slotMinutes = (int) Setting::valueOf('booking.slot_minutes', 30);
        $maximumDuration = (int) Setting::valueOf('booking.maximum_duration_hours', 24) * 60;

        if ($durationMinutes < $slotMinutes || $durationMinutes > $maximumDuration || $durationMinutes % $slotMinutes !== 0) {
            throw new SlotUnavailableException('Baskı süresi izin verilen aralığa uygun değil.');
        }

        if ($startsAt->second !== 0 || $startsAt->minute % $slotMinutes !== 0) {
            throw new SlotUnavailableException('Başlangıç saati geçerli zaman adımlarından biri olmalıdır.');
        }

        $operatingHour = OperatingHour::query()->firstWhere('weekday', $startsAt->dayOfWeekIso);

        if (! $operatingHour?->is_open || ! $operatingHour->opens_at || ! $operatingHour->latest_start_at) {
            throw new SlotUnavailableException('Atölye seçilen gün randevuya kapalıdır.');
        }

        $startTime = $startsAt->format('H:i:s');
        if ($startTime < $operatingHour->opens_at || $startTime > $operatingHour->latest_start_at) {
            throw new SlotUnavailableException('Başlangıç saati atölyenin randevu saatleri dışındadır.');
        }

        $endsAt = $startsAt->addMinutes($durationMinutes);

        $hasBlackout = BlackoutPeriod::query()
            ->where(fn ($query) => $query->whereNull('printer_id')->orWhere('printer_id', $printer->id))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->exists();

        if ($hasBlackout) {
            throw new SlotUnavailableException('Seçilen zaman aralığı bakım veya kapalı zamana denk geliyor.');
        }

        if (Appointment::query()->overlapping($printer->id, $startsAt, $endsAt)->exists()) {
            throw new SlotUnavailableException('Seçilen zaman aralığı başka bir randevuyla çakışıyor.');
        }

        return $endsAt;
    }
}
