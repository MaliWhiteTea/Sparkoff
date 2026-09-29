<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AppointmentStatus;
use App\Http\Controllers\Controller;
use App\Models\Appointment;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CalendarController extends Controller
{
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
            'view' => ['nullable', Rule::in(['week', 'day'])],
        ]);

        $timezone = config('app.timezone');
        $view = $validated['view'] ?? 'week';
        $reference = isset($validated['date'])
            ? CarbonImmutable::createFromFormat('Y-m-d', $validated['date'], $timezone)->startOfDay()
            : CarbonImmutable::now($timezone)->startOfDay();
        $periodStart = $view === 'day' ? $reference : $reference->startOfWeek();
        $periodEnd = $periodStart->addDays($view === 'day' ? 1 : 7);

        $appointments = Appointment::query()
            ->with('printer')
            ->whereNotIn('status', [
                AppointmentStatus::PendingVerification->value,
                AppointmentStatus::Rejected->value,
                AppointmentStatus::Canceled->value,
                AppointmentStatus::Expired->value,
            ])
            ->where('starts_at', '<', $periodEnd)
            ->where('ends_at', '>', $periodStart)
            ->orderBy('starts_at')
            ->get();

        $days = collect(range(0, $view === 'day' ? 0 : 6))->map(function (int $offset) use ($periodStart, $appointments) {
            $dayStart = $periodStart->addDays($offset);
            $dayEnd = $dayStart->addDay();

            return [
                'date' => $dayStart->format('Y-m-d'),
                'weekday' => $dayStart->translatedFormat('l'),
                'dayLabel' => $dayStart->translatedFormat('d M'),
                'isToday' => $dayStart->isToday(),
                'appointments' => $appointments
                    ->filter(fn (Appointment $appointment) => $appointment->starts_at->lt($dayEnd) && $appointment->ends_at->gt($dayStart))
                    ->map(function (Appointment $appointment) use ($dayStart, $dayEnd) {
                        $continuesFromPrevious = $appointment->starts_at->lt($dayStart);
                        $continuesNext = $appointment->ends_at->gt($dayEnd);

                        return [
                            'publicId' => $appointment->public_id,
                            'name' => "{$appointment->first_name} {$appointment->last_name}",
                            'printer' => $appointment->printer->name,
                            'status' => $appointment->status->value,
                            'statusLabel' => $this->statusLabel($appointment->status),
                            'startTime' => $continuesFromPrevious ? '00:00' : $appointment->starts_at->format('H:i'),
                            'endTime' => $continuesNext ? '24:00' : $appointment->ends_at->format('H:i'),
                            'continuesFromPrevious' => $continuesFromPrevious,
                            'continuesNext' => $continuesNext,
                        ];
                    })->values(),
            ];
        });

        $step = $view === 'day' ? 1 : 7;

        return Inertia::render('Admin/Calendar', [
            'view' => $view,
            'referenceDate' => $reference->format('Y-m-d'),
            'rangeLabel' => $view === 'day'
                ? $periodStart->translatedFormat('d F Y, l')
                : $periodStart->translatedFormat('d M').' – '.$periodEnd->subDay()->translatedFormat('d M Y'),
            'previousDate' => $reference->subDays($step)->format('Y-m-d'),
            'nextDate' => $reference->addDays($step)->format('Y-m-d'),
            'today' => CarbonImmutable::now($timezone)->format('Y-m-d'),
            'days' => $days,
        ]);
    }

    private function statusLabel(AppointmentStatus $status): string
    {
        return match ($status) {
            AppointmentStatus::PendingVerification => 'E-posta doğrulaması bekleniyor',
            AppointmentStatus::PendingApproval => 'Onay bekliyor',
            AppointmentStatus::ChangeRequested => 'Değişiklik istendi',
            AppointmentStatus::Approved => 'Onaylandı',
            AppointmentStatus::Ready => 'Baskıya hazır',
            AppointmentStatus::Printing => 'Basılıyor',
            AppointmentStatus::Completed => 'Tamamlandı',
            AppointmentStatus::Failed => 'Baskı başarısız',
            AppointmentStatus::Rejected => 'Reddedildi',
            AppointmentStatus::Canceled => 'İptal edildi',
            AppointmentStatus::Expired => 'Süresi doldu',
        };
    }
}
