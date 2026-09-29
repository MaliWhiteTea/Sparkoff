<?php

namespace App\Http\Controllers;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Enums\PrinterStatus;
use App\Exceptions\SlotUnavailableException;
use App\Http\Requests\StoreAppointmentRequest;
use App\Models\Appointment;
use App\Models\Filament;
use App\Models\Printer;
use App\Models\Setting;
use App\Services\AppointmentAvailabilityService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
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
            $appointment = DB::transaction(function () use ($validated, $startsAt, $request, $availability, &$storedPath) {
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

                return $appointment;
            }, 3);
        } catch (SlotUnavailableException $exception) {
            throw ValidationException::withMessages(['date' => $exception->getMessage()]);
        } catch (Throwable $exception) {
            if ($storedPath) {
                Storage::disk('local')->delete($storedPath);
            }

            throw $exception;
        }

        return to_route('booking.create')->with('booking_submitted', [
            'publicId' => $appointment->public_id,
            'email' => $appointment->email,
        ]);
    }
}
