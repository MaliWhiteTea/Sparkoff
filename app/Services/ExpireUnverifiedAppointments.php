<?php

namespace App\Services;

use App\Enums\AppointmentStatus;
use App\Models\Appointment;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class ExpireUnverifiedAppointments
{
    public function expireDue(CarbonInterface $at): int
    {
        $expiredCount = 0;

        Appointment::query()
            ->where('status', AppointmentStatus::PendingVerification->value)
            ->whereNotNull('verification_expires_at')
            ->where('verification_expires_at', '<=', $at)
            ->select('id')
            ->chunkById(100, function ($appointments) use ($at, &$expiredCount) {
                $expiredCount += DB::transaction(function () use ($appointments, $at) {
                    $lockedAppointments = Appointment::query()
                        ->whereKey($appointments->pluck('id'))
                        ->where('status', AppointmentStatus::PendingVerification->value)
                        ->whereNotNull('verification_expires_at')
                        ->where('verification_expires_at', '<=', $at)
                        ->lockForUpdate()
                        ->get();

                    return $lockedAppointments->sum(
                        fn (Appointment $appointment) => (int) $this->expire($appointment, $at)
                    );
                });
            });

        return $expiredCount;
    }

    public function expire(Appointment $appointment, CarbonInterface $at): bool
    {
        if (! $this->isDue($appointment, $at)) {
            return false;
        }

        $appointment->update([
            'status' => AppointmentStatus::Expired,
            'verification_token_hash' => null,
        ]);
        $appointment->statusHistory()->create([
            'from_status' => AppointmentStatus::PendingVerification,
            'to_status' => AppointmentStatus::Expired,
            'note' => 'E-posta doğrulama süresi doldu.',
        ]);

        return true;
    }

    public function isDue(Appointment $appointment, CarbonInterface $at): bool
    {
        return $appointment->status === AppointmentStatus::PendingVerification
            && $appointment->verification_expires_at !== null
            && $appointment->verification_expires_at->lessThanOrEqualTo($at);
    }
}
