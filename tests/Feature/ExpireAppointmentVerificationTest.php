<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Models\Appointment;
use App\Models\Printer;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ExpireAppointmentVerificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-28 12:00:00', 'Europe/Istanbul'));
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_command_expires_only_due_unverified_appointments_idempotently(): void
    {
        $due = $this->appointment(AppointmentStatus::PendingVerification, now());
        $future = $this->appointment(AppointmentStatus::PendingVerification, now()->addMinute());
        $withoutDeadline = $this->appointment(AppointmentStatus::PendingVerification, null);
        $verified = $this->appointment(AppointmentStatus::PendingApproval, now()->subMinute());

        $this->artisan('appointments:expire-verifications')
            ->expectsOutput('1 doğrulama bekleyen randevunun süresi doldu.')
            ->assertSuccessful();
        $this->artisan('appointments:expire-verifications')
            ->expectsOutput('0 doğrulama bekleyen randevunun süresi doldu.')
            ->assertSuccessful();

        $due->refresh();
        $this->assertSame(AppointmentStatus::Expired, $due->status);
        $this->assertNull($due->verification_token_hash);
        $this->assertSame(1, $due->statusHistory()->where('to_status', AppointmentStatus::Expired->value)->count());
        $this->assertSame(AppointmentStatus::PendingVerification, $future->fresh()->status);
        $this->assertSame(AppointmentStatus::PendingVerification, $withoutDeadline->fresh()->status);
        $this->assertSame(AppointmentStatus::PendingApproval, $verified->fresh()->status);
    }

    public function test_expiration_command_is_registered_with_the_scheduler(): void
    {
        $this->artisan('schedule:list')
            ->expectsOutputToContain('appointments:expire-verifications')
            ->assertSuccessful();
    }

    private function appointment(AppointmentStatus $status, mixed $expiresAt): Appointment
    {
        $startsAt = CarbonImmutable::now()->addDay()->setTime(10, 0);

        return Appointment::query()->create([
            'printer_id' => Printer::query()->where('code', 'P-01')->value('id'),
            'status' => $status,
            'first_name' => 'Test',
            'last_name' => 'Kullanıcı',
            'email' => 'test@example.com',
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->addHour(),
            'duration_minutes' => 60,
            'filament_source' => FilamentSource::Own,
            'filament_material' => 'PLA',
            'filament_color' => 'Siyah',
            'verification_token_hash' => hash('sha256', Str::random(64)),
            'verification_expires_at' => $expiresAt,
            'tracking_token_hash' => hash('sha256', Str::random(64)),
            'privacy_notice_version' => 'test',
            'privacy_notice_seen_at' => now(),
            'rules_accepted_at' => now(),
        ]);
    }
}
