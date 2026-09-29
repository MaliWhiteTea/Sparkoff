<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Mail\AppointmentTrackingMail;
use App\Models\Appointment;
use App\Models\Printer;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AppointmentVerificationAndTrackingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed();
    }

    public function test_verification_moves_the_request_to_approval_and_sends_a_tracking_link(): void
    {
        Mail::fake();
        $token = Str::random(64);
        $appointment = $this->createPendingAppointment($token);

        $parameters = [
            'publicId' => $appointment->public_id,
            'token' => $token,
        ];

        $this->get(route('booking.verify', $parameters))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('VerificationResult')
                ->where('verified', false)
                ->has('confirmUrl'));

        $this->assertSame(AppointmentStatus::PendingVerification, $appointment->fresh()->status);

        $response = $this->post(route('booking.verify.confirm', $parameters));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('VerificationResult')
            ->where('verified', true)
            ->has('trackingUrl'));

        $appointment->refresh();
        $this->assertSame(AppointmentStatus::PendingApproval, $appointment->status);
        $this->assertNotNull($appointment->email_verified_at);
        $this->assertNull($appointment->verification_token_hash);
        Mail::assertSent(AppointmentTrackingMail::class);
    }

    public function test_tracking_link_displays_the_appointment_and_can_cancel_it(): void
    {
        $trackingToken = Str::random(64);
        $appointment = $this->createVerifiedAppointment($trackingToken);

        $trackingParameters = [
            'publicId' => $appointment->public_id,
            'token' => $trackingToken,
        ];

        $this->get(route('booking.track', $trackingParameters))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('TrackAppointment')
                ->where('appointment.status', AppointmentStatus::PendingApproval->value)
                ->where('appointment.canCancel', true));

        $this->post(route('booking.cancel', $trackingParameters))
            ->assertRedirect(route('booking.track', $trackingParameters));

        $appointment->refresh();
        $this->assertSame(AppointmentStatus::Canceled, $appointment->status);
        $this->assertNotNull($appointment->canceled_at);
    }

    public function test_an_invalid_tracking_token_returns_not_found(): void
    {
        $appointment = $this->createVerifiedAppointment(Str::random(64));

        $this->get(route('booking.track', [
            'publicId' => $appointment->public_id,
            'token' => 'gecersiz-token',
        ]))->assertNotFound();
    }

    public function test_an_expired_verification_link_does_not_activate_the_request(): void
    {
        $token = Str::random(64);
        $appointment = $this->createPendingAppointment($token);
        $appointment->update(['verification_expires_at' => now()->subMinute()]);

        $parameters = [
            'publicId' => $appointment->public_id,
            'token' => $token,
        ];

        $this->get(route('booking.verify', $parameters))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('VerificationResult')
            ->where('verified', false)
            ->where('expired', true));

        $this->assertSame(AppointmentStatus::PendingVerification, $appointment->fresh()->status);

        $this->post(route('booking.verify.confirm', $parameters))->assertOk();

        $this->assertSame(AppointmentStatus::Expired, $appointment->fresh()->status);
    }

    public function test_a_verification_token_cannot_be_used_twice(): void
    {
        Mail::fake();
        $token = Str::random(64);
        $appointment = $this->createPendingAppointment($token);
        $parameters = ['publicId' => $appointment->public_id, 'token' => $token];

        $this->post(route('booking.verify.confirm', $parameters))->assertOk();
        $this->post(route('booking.verify.confirm', $parameters))->assertNotFound();

        $this->assertSame(1, $appointment->statusHistory()
            ->where('to_status', AppointmentStatus::PendingApproval->value)
            ->count());
    }

    private function createPendingAppointment(string $verificationToken): Appointment
    {
        return $this->createAppointment([
            'status' => AppointmentStatus::PendingVerification,
            'verification_token_hash' => hash('sha256', $verificationToken),
            'verification_expires_at' => now()->addMinutes(30),
        ]);
    }

    private function createVerifiedAppointment(string $trackingToken): Appointment
    {
        $appointment = $this->createAppointment([
            'status' => AppointmentStatus::PendingApproval,
            'verification_token_hash' => null,
            'verification_expires_at' => null,
            'email_verified_at' => now(),
            'tracking_token_hash' => hash('sha256', $trackingToken),
        ]);

        $appointment->statusHistory()->create([
            'to_status' => AppointmentStatus::PendingApproval,
            'note' => 'E-posta doğrulandı.',
        ]);

        return $appointment;
    }

    private function createAppointment(array $overrides): Appointment
    {
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $startsAt = CarbonImmutable::now('Europe/Istanbul')->next(CarbonImmutable::MONDAY)->setTime(10, 0);

        return Appointment::query()->create([
            'printer_id' => $printer->id,
            'status' => AppointmentStatus::PendingVerification,
            'first_name' => 'Test',
            'last_name' => 'Kullanıcı',
            'email' => 'test@example.com',
            'phone' => '05550000000',
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->addHours(2),
            'duration_minutes' => 120,
            'filament_source' => FilamentSource::Workshop,
            'filament_material' => 'PLA',
            'filament_color' => 'Siyah',
            'tracking_token_hash' => hash('sha256', Str::random(64)),
            'privacy_notice_version' => 'test',
            'privacy_notice_seen_at' => now(),
            'rules_accepted_at' => now(),
            ...$overrides,
        ]);
    }
}
