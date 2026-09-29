<?php

namespace App\Http\Controllers;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Enums\PrinterStatus;
use App\Exceptions\SlotUnavailableException;
use App\Http\Requests\StoreAppointmentRequest;
use App\Mail\AppointmentTrackingMail;
use App\Mail\AppointmentVerificationMail;
use App\Models\Appointment;
use App\Models\Filament;
use App\Models\Printer;
use App\Models\Setting;
use App\Services\AppointmentAvailabilityService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class AppointmentController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Booking', [
            'settings' => [
                'maximumDurationHours' => (int) Setting::valueOf('booking.maximum_duration_hours', 24),
                'slotMinutes' => (int) Setting::valueOf('booking.slot_minutes', 30),
            ],
        ]);
    }

    public function availability(Request $request, AppointmentAvailabilityService $availability): JsonResponse
    {
        $maximumDuration = (int) Setting::valueOf('booking.maximum_duration_hours', 24) * 60;
        $validated = $request->validate([
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'duration_minutes' => ['required', 'integer', 'min:30', "max:{$maximumDuration}"],
        ]);

        $printer = Printer::query()
            ->where('status', PrinterStatus::Active->value)
            ->orderBy('sort_order')
            ->first();

        if (! $printer) {
            return response()->json(['slots' => [], 'printer' => null]);
        }

        $date = CarbonImmutable::createFromFormat('Y-m-d', $validated['date'], config('app.timezone'))->startOfDay();

        return response()->json([
            'slots' => $availability->availableStartTimes($printer, $date, (int) $validated['duration_minutes']),
            'printer' => ['code' => $printer->code, 'name' => $printer->name],
        ]);
    }

    public function store(
        StoreAppointmentRequest $request,
        AppointmentAvailabilityService $availability,
    ): RedirectResponse {
        $validated = $request->validated();
        $startsAt = CarbonImmutable::createFromFormat(
            'Y-m-d H:i',
            "{$validated['date']} {$validated['start_time']}",
            config('app.timezone'),
        );

        $storedPath = null;

        try {
            [$appointment, $verificationToken] = DB::transaction(function () use ($validated, $startsAt, $request, $availability, &$storedPath) {
                $printer = Printer::query()
                    ->where('status', PrinterStatus::Active->value)
                    ->orderBy('sort_order')
                    ->lockForUpdate()
                    ->firstOrFail();

                $endsAt = $availability->assertAvailable($printer, $startsAt, $validated['duration_minutes']);
                $verificationToken = Str::random(64);

                $filament = $validated['filament_source'] === FilamentSource::Workshop->value
                    ? Filament::query()
                        ->where('is_available', true)
                        ->where('material', $validated['material'])
                        ->when($validated['color'] !== 'Fark etmez', fn ($query) => $query->where('color', $validated['color']))
                        ->first()
                    : null;

                $appointment = Appointment::query()->create([
                    'printer_id' => $printer->id,
                    'status' => AppointmentStatus::PendingVerification,
                    'first_name' => $validated['first_name'],
                    'last_name' => $validated['last_name'],
                    'email' => Str::lower($validated['email']),
                    'phone' => $validated['phone'],
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                    'duration_minutes' => $validated['duration_minutes'],
                    'filament_source' => $validated['filament_source'],
                    'filament_id' => $filament?->id,
                    'filament_material' => $validated['material'],
                    'filament_color' => $validated['color'],
                    'user_note' => $validated['note'] ?? null,
                    'verification_token_hash' => hash('sha256', $verificationToken),
                    'tracking_token_hash' => hash('sha256', Str::random(64)),
                    'verification_expires_at' => now()->addMinutes((int) Setting::valueOf('booking.verification_hold_minutes', 30)),
                    'privacy_notice_version' => Setting::valueOf('privacy.notice_version', '2026-09-29'),
                    'privacy_notice_seen_at' => now(),
                    'rules_accepted_at' => now(),
                ]);

                $file = $request->file('file');
                $extension = strtolower($file->getClientOriginalExtension());
                $storedPath = $file->storeAs(
                    "appointments/{$appointment->public_id}",
                    Str::uuid().".{$extension}",
                    'local',
                );

                $appointment->files()->create([
                    'disk' => 'local',
                    'path' => $storedPath,
                    'original_name' => $file->getClientOriginalName(),
                    'extension' => $extension,
                    'mime_type' => $file->getMimeType(),
                    'size_bytes' => $file->getSize(),
                ]);

                $appointment->statusHistory()->create([
                    'to_status' => AppointmentStatus::PendingVerification,
                    'note' => 'Randevu talebi oluşturuldu; e-posta doğrulaması bekleniyor.',
                ]);

                return [$appointment, $verificationToken];
            }, 3);
        } catch (SlotUnavailableException $exception) {
            throw ValidationException::withMessages(['date' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }

            throw $exception;
        }

        try {
            Mail::to($appointment->email)->send(new AppointmentVerificationMail($appointment, $verificationToken));
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($storedPath);
            $appointment->delete();
            report($exception);

            throw ValidationException::withMessages([
                'email' => 'Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin.',
            ]);
        }

        return to_route('booking.create')->with('booking_submitted', [
            'publicId' => $appointment->public_id,
            'email' => $appointment->email,
        ]);
    }

    public function showVerification(string $publicId, string $token): Response
    {
        $appointment = Appointment::query()
            ->where('public_id', $publicId)
            ->firstOrFail();

        abort_unless(
            $appointment->verification_token_hash
                && hash_equals($appointment->verification_token_hash, hash('sha256', $token)),
            404,
        );

        abort_unless($appointment->status === AppointmentStatus::PendingVerification, 404);

        return Inertia::render('VerificationResult', [
            'verified' => false,
            'expired' => $appointment->verification_expires_at?->isPast() ?? true,
            'message' => $appointment->verification_expires_at?->isPast()
                ? 'Doğrulama bağlantısının süresi dolmuş. Yeni bir randevu talebi oluşturabilirsiniz.'
                : 'Randevu talebinizi yönetici incelemesine göndermek için doğrulamayı tamamlayın.',
            'confirmUrl' => route('booking.verify.confirm', compact('publicId', 'token')),
        ]);
    }

    public function verify(string $publicId, string $token): Response
    {
        $trackingToken = Str::random(64);

        $result = DB::transaction(function () use ($publicId, $token, $trackingToken) {
            $lockedAppointment = Appointment::query()
                ->where('public_id', $publicId)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless(
                $lockedAppointment->status === AppointmentStatus::PendingVerification
                    && $lockedAppointment->verification_token_hash
                    && hash_equals($lockedAppointment->verification_token_hash, hash('sha256', $token)),
                404,
            );

            if ($lockedAppointment->verification_expires_at?->isPast()) {
                $lockedAppointment->update([
                    'status' => AppointmentStatus::Expired,
                    'verification_token_hash' => null,
                ]);
                $lockedAppointment->statusHistory()->create([
                    'from_status' => AppointmentStatus::PendingVerification,
                    'to_status' => AppointmentStatus::Expired,
                    'note' => 'E-posta doğrulama süresi doldu.',
                ]);

                return ['expired' => true, 'appointment' => $lockedAppointment];
            }

            $lockedAppointment->update([
                'status' => AppointmentStatus::PendingApproval,
                'email_verified_at' => now(),
                'verification_token_hash' => null,
                'verification_expires_at' => null,
                'tracking_token_hash' => hash('sha256', $trackingToken),
            ]);
            $lockedAppointment->statusHistory()->create([
                'from_status' => AppointmentStatus::PendingVerification,
                'to_status' => AppointmentStatus::PendingApproval,
                'note' => 'E-posta adresi doğrulandı; yönetici onayı bekleniyor.',
            ]);

            return ['expired' => false, 'appointment' => $lockedAppointment];
        });

        /** @var Appointment $appointment */
        $appointment = $result['appointment'];

        if ($result['expired']) {
            return Inertia::render('VerificationResult', [
                'verified' => false,
                'expired' => true,
                'message' => 'Doğrulama bağlantısının süresi dolmuş. Yeni bir randevu talebi oluşturabilirsiniz.',
            ]);
        }

        $appointment->refresh()->load('printer');

        try {
            Mail::to($appointment->email)->send(new AppointmentTrackingMail($appointment, $trackingToken));
        } catch (Throwable $exception) {
            report($exception);
        }

        return Inertia::render('VerificationResult', [
            'verified' => true,
            'expired' => false,
            'message' => 'E-posta adresiniz doğrulandı. Randevu talebiniz yönetici incelemesine alındı.',
            'trackingUrl' => route('booking.track', [
                'publicId' => $appointment->public_id,
                'token' => $trackingToken,
            ]),
        ]);
    }

    public function track(string $publicId, string $token): Response
    {
        $appointment = $this->findTrackableAppointment($publicId, $token);

        return Inertia::render('TrackAppointment', [
            'appointment' => [
                'publicId' => $appointment->public_id,
                'status' => $appointment->status->value,
                'statusLabel' => $this->statusLabel($appointment->status),
                'printer' => $appointment->printer->name,
                'startsAt' => $appointment->starts_at->translatedFormat('d F Y, H:i'),
                'endsAt' => $appointment->ends_at->translatedFormat('d F Y, H:i'),
                'durationMinutes' => $appointment->duration_minutes,
                'filament' => "{$appointment->filament_material} · {$appointment->filament_color}",
                'fileName' => $appointment->files->first()?->original_name,
                'canCancel' => ! in_array($appointment->status, [
                    AppointmentStatus::Completed,
                    AppointmentStatus::Canceled,
                    AppointmentStatus::Rejected,
                    AppointmentStatus::Expired,
                ], true),
                'history' => $appointment->statusHistory->map(fn ($history) => [
                    'status' => $history->to_status->value,
                    'label' => $this->statusLabel($history->to_status),
                    'note' => $history->note,
                    'date' => $history->created_at->translatedFormat('d F Y, H:i'),
                ]),
            ],
            'cancelUrl' => route('booking.cancel', [
                'publicId' => $appointment->public_id,
                'token' => $token,
            ]),
        ]);
    }

    public function cancel(Request $request, string $publicId, string $token): RedirectResponse
    {
        $appointment = DB::transaction(function () use ($publicId, $token) {
            $appointment = Appointment::query()
                ->where('public_id', $publicId)
                ->whereNotNull('email_verified_at')
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless(
                is_string($appointment->tracking_token_hash)
                    && hash_equals($appointment->tracking_token_hash, hash('sha256', $token)),
                404,
            );

            if (! in_array($appointment->status, [
                AppointmentStatus::Completed,
                AppointmentStatus::Canceled,
                AppointmentStatus::Rejected,
                AppointmentStatus::Expired,
            ], true)) {
                $previousStatus = $appointment->status;
                $appointment->update([
                    'status' => AppointmentStatus::Canceled,
                    'canceled_at' => now(),
                ]);
                $appointment->statusHistory()->create([
                    'from_status' => $previousStatus,
                    'to_status' => AppointmentStatus::Canceled,
                    'note' => 'Randevu kullanıcı tarafından iptal edildi.',
                ]);
            }

            return $appointment;
        });

        return redirect()->route('booking.track', [
            'publicId' => $appointment->public_id,
            'token' => $token,
        ]);
    }

    private function findTrackableAppointment(string $publicId, string $token): Appointment
    {
        $appointment = Appointment::query()
            ->with(['printer', 'files', 'statusHistory' => fn ($query) => $query->oldest()])
            ->where('public_id', $publicId)
            ->whereNotNull('email_verified_at')
            ->firstOrFail();

        abort_unless(
            is_string($appointment->tracking_token_hash)
                && hash_equals($appointment->tracking_token_hash, hash('sha256', $token)),
            404,
        );

        return $appointment;
    }

    private function statusLabel(AppointmentStatus $status): string
    {
        return match ($status) {
            AppointmentStatus::PendingVerification => 'E-posta doğrulaması bekleniyor',
            AppointmentStatus::PendingApproval => 'Yönetici onayı bekleniyor',
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
