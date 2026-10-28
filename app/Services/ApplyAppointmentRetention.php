<?php

namespace App\Services;

use App\Enums\AppointmentStatus;
use App\Models\ActivityLog;
use App\Models\Appointment;
use App\Models\AppointmentFile;
use App\Models\Setting;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ApplyAppointmentRetention
{
    /**
     * @return array{files_deleted: int, appointments_deleted: int, file_schedules_created: int, failures: int}
     */
    public function apply(CarbonInterface $now): array
    {
        $appointmentMonths = max(1, (int) Setting::valueOf('privacy.appointment_retention_months', 12));
        $fileDays = max(1, (int) Setting::valueOf('privacy.file_retention_days', 30));
        $result = [
            'files_deleted' => 0,
            'appointments_deleted' => 0,
            'file_schedules_created' => 0,
            'failures' => 0,
        ];

        AppointmentFile::query()
            ->whereNull('deleted_at')
            ->whereNull('scheduled_deletion_at')
            ->orderBy('id')
            ->chunkById(100, function ($files) use ($fileDays, &$result) {
                foreach ($files as $file) {
                    $file->update(['scheduled_deletion_at' => $file->created_at->copy()->addDays($fileDays)]);
                    $result['file_schedules_created']++;
                }
            });

        AppointmentFile::query()
            ->whereNull('deleted_at')
            ->where('scheduled_deletion_at', '<=', $now)
            ->whereHas('appointment', fn ($query) => $query
                ->whereNull('retention_exempt_until')
                ->orWhere('retention_exempt_until', '<=', $now))
            ->orderBy('id')
            ->chunkById(100, function ($files) use ($now, &$result) {
                foreach ($files as $file) {
                    if ($this->deleteFile($file, $now)) {
                        $result['files_deleted']++;
                    } else {
                        $result['failures']++;
                    }
                }
            });

        Appointment::query()
            ->whereIn('status', AppointmentStatus::retentionEligibleValues())
            ->where('ends_at', '<=', $now->copy()->subMonthsNoOverflow($appointmentMonths))
            ->where(function ($query) use ($now) {
                $query->whereNull('retention_exempt_until')
                    ->orWhere('retention_exempt_until', '<=', $now);
            })
            ->with('files')
            ->orderBy('id')
            ->chunkById(50, function ($appointments) use ($now, &$result) {
                foreach ($appointments as $appointment) {
                    $canDelete = true;

                    foreach ($appointment->files->whereNull('deleted_at') as $file) {
                        if ($this->deleteFile($file, $now)) {
                            $result['files_deleted']++;
                        } else {
                            $result['failures']++;
                            $canDelete = false;
                        }
                    }

                    if ($canDelete) {
                        $appointment->delete();
                        $result['appointments_deleted']++;
                    }
                }
            });

        if (array_sum($result) > 0) {
            ActivityLog::query()->create([
                'action' => 'retention_applied',
                'subject_type' => Appointment::class,
                'changed_fields' => [
                    ...$result,
                    'appointment_retention_months' => $appointmentMonths,
                    'file_retention_days' => $fileDays,
                ],
                'created_at' => $now,
            ]);
        }

        return $result;
    }

    private function deleteFile(AppointmentFile $file, CarbonInterface $now): bool
    {
        try {
            $disk = Storage::disk($file->disk);

            if ($disk->exists($file->path) && ! $disk->delete($file->path)) {
                return false;
            }

            $file->update(['deleted_at' => $now]);

            return true;
        } catch (Throwable $exception) {
            report($exception);

            return false;
        }
    }
}
