<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AppointmentStatus;
use App\Http\Controllers\Controller;
use App\Mail\AppointmentStatusMail;
use App\Models\Appointment;
use App\Models\AppointmentFile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class AppointmentController extends Controller
{
    public function index(Request $request): Response
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(array_column(AppointmentStatus::cases(), 'value'))],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $status = $validated['status'] ?? '';
        $search = trim($validated['search'] ?? '');

        $appointments = Appointment::query()
            ->with('printer')
            ->when($status, fn ($query) => $query->where('status', $status))
            ->when($search, fn ($query) => $query->where(function ($query) use ($search) {
                $query->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('public_id', 'like', "%{$search}%");
            }))
            ->latest('starts_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Appointment $appointment) => [
                'publicId' => $appointment->public_id,
                'name' => "{$appointment->first_name} {$appointment->last_name}",
                'email' => $appointment->email,
                'status' => $appointment->status->value,
                'statusLabel' => $this->statusLabel($appointment->status),
                'printer' => $appointment->printer->name,
                'startsAt' => $appointment->starts_at->translatedFormat('d M Y, H:i'),
                'durationMinutes' => $appointment->duration_minutes,
            ]);

        return Inertia::render('Admin/Appointments/Index', [
            'appointments' => $appointments,
            'filters' => ['status' => $status, 'search' => $search],
            'statusOptions' => collect(AppointmentStatus::cases())->map(fn ($case) => [
                'value' => $case->value,
                'label' => $this->statusLabel($case),
            ]),
            'counts' => [
                'pending' => Appointment::query()->where('status', AppointmentStatus::PendingApproval)->count(),
                'approved' => Appointment::query()->where('status', AppointmentStatus::Approved)->count(),
                'today' => Appointment::query()->whereDate('starts_at', today())->count(),
            ],
        ]);
    }

    public function show(string $publicId): Response
    {
        $appointment = $this->findAppointment($publicId);

        return Inertia::render('Admin/Appointments/Show', [
            'appointment' => [
                'publicId' => $appointment->public_id,
                'name' => "{$appointment->first_name} {$appointment->last_name}",
                'email' => $appointment->email,
                'phone' => $appointment->phone,
                'status' => $appointment->status->value,
                'statusLabel' => $this->statusLabel($appointment->status),
                'printer' => $appointment->printer->name,
                'startsAt' => $appointment->starts_at->translatedFormat('d F Y, H:i'),
                'endsAt' => $appointment->ends_at->translatedFormat('d F Y, H:i'),
                'durationMinutes' => $appointment->duration_minutes,
                'filament' => "{$appointment->filament_source->value} · {$appointment->filament_material} · {$appointment->filament_color}",
                'note' => $appointment->user_note,
                'files' => $appointment->files->map(fn (AppointmentFile $file) => [
                    'id' => $file->id,
                    'name' => $file->original_name,
                    'size' => $file->size_bytes,
                    'downloadUrl' => route('admin.appointments.files.download', [$appointment->public_id, $file]),
                ]),
                'history' => $appointment->statusHistory->map(fn ($history) => [
                    'label' => $this->statusLabel($history->to_status),
                    'note' => $history->note,
                    'actor' => $history->actor?->name ?? 'Sistem',
                    'date' => $history->created_at->translatedFormat('d F Y, H:i'),
                ]),
                'actions' => collect($this->allowedTransitions($appointment->status))->map(fn (AppointmentStatus $status) => [
                    'status' => $status->value,
                    'label' => $this->actionLabel($status),
                    'requiresNote' => in_array($status, [AppointmentStatus::ChangeRequested, AppointmentStatus::Rejected, AppointmentStatus::Failed], true),
                    'tone' => in_array($status, [AppointmentStatus::Rejected, AppointmentStatus::Failed], true) ? 'danger' : 'primary',
                ]),
            ],
        ]);
    }

    public function updateStatus(Request $request, string $publicId): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(array_column(AppointmentStatus::cases(), 'value'))],
            'note' => [
                'nullable',
                'string',
                'max:2000',
                Rule::requiredIf(in_array($request->input('status'), [
                    AppointmentStatus::ChangeRequested->value,
                    AppointmentStatus::Rejected->value,
                    AppointmentStatus::Failed->value,
                ], true)),
            ],
        ]);

        $appointment = DB::transaction(function () use ($publicId, $validated, $request) {
            $appointment = Appointment::query()->where('public_id', $publicId)->lockForUpdate()->firstOrFail();

            $previousStatus = $appointment->status;
            $newStatus = AppointmentStatus::from($validated['status']);
            abort_unless(in_array($newStatus, $this->allowedTransitions($previousStatus), true), 422);

            $note = $validated['note'] ?? $this->defaultStatusNote($newStatus);
            $appointment->update([
                'status' => $newStatus,
                'admin_note' => $validated['note'] ?? $appointment->admin_note,
            ]);
            $appointment->statusHistory()->create([
                'actor_id' => $request->user()->id,
                'from_status' => $previousStatus,
                'to_status' => $newStatus,
                'note' => $note,
            ]);

            return $appointment->fresh('printer');
        });

        try {
            Mail::to($appointment->email)->send(new AppointmentStatusMail($appointment));
        } catch (Throwable $exception) {
            report($exception);

            return back()->with('warning', 'Durum güncellendi ancak bildirim e-postası gönderilemedi.');
        }

        return back()->with('success', 'Randevu durumu güncellendi ve kullanıcıya e-posta gönderildi.');
    }

    public function download(string $publicId, AppointmentFile $file): StreamedResponse
    {
        $appointment = Appointment::query()->where('public_id', $publicId)->firstOrFail();
        abort_unless(
            $file->appointment_id === $appointment->id
                && $file->disk === 'local'
                && Storage::disk('local')->exists($file->path),
            404,
        );

        return Storage::disk('local')->download($file->path, $file->original_name);
    }

    private function findAppointment(string $publicId): Appointment
    {
        return Appointment::query()
            ->with(['printer', 'files', 'statusHistory' => fn ($query) => $query->with('actor')->oldest()])
            ->where('public_id', $publicId)
            ->firstOrFail();
    }

    /** @return list<AppointmentStatus> */
    private function allowedTransitions(AppointmentStatus $status): array
    {
        return match ($status) {
            AppointmentStatus::PendingApproval => [AppointmentStatus::ChangeRequested, AppointmentStatus::Approved, AppointmentStatus::Rejected],
            AppointmentStatus::ChangeRequested => [AppointmentStatus::Approved, AppointmentStatus::Rejected],
            AppointmentStatus::Approved => [AppointmentStatus::Ready],
            AppointmentStatus::Ready => [AppointmentStatus::Printing],
            AppointmentStatus::Printing => [AppointmentStatus::Completed, AppointmentStatus::Failed],
            AppointmentStatus::Failed => [AppointmentStatus::Ready],
            default => [],
        };
    }

    private function actionLabel(AppointmentStatus $status): string
    {
        return match ($status) {
            AppointmentStatus::ChangeRequested => 'Değişiklik iste',
            AppointmentStatus::Approved => 'Randevuyu onayla',
            AppointmentStatus::Rejected => 'Randevuyu reddet',
            AppointmentStatus::Ready => 'Baskıya hazır',
            AppointmentStatus::Printing => 'Baskıyı başlat',
            AppointmentStatus::Completed => 'Tamamlandı olarak işaretle',
            AppointmentStatus::Failed => 'Başarısız olarak işaretle',
            default => $this->statusLabel($status),
        };
    }

    private function defaultStatusNote(AppointmentStatus $status): string
    {
        return match ($status) {
            AppointmentStatus::Approved => 'Randevu yönetici tarafından onaylandı.',
            AppointmentStatus::Ready => 'Baskı hazırlıkları tamamlandı.',
            AppointmentStatus::Printing => '3D baskı başlatıldı.',
            AppointmentStatus::Completed => '3D baskı tamamlandı.',
            default => $this->statusLabel($status),
        };
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
