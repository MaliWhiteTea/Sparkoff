<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Models\Appointment;
use App\Models\BlackoutPeriod;
use App\Models\Printer;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SchedulingIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-01 12:00:00', 'Europe/Istanbul'));
        Mail::fake();
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_failed_appointment_can_only_return_to_ready_when_printer_interval_is_free(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $start = CarbonImmutable::parse('2026-10-05 10:00:00', 'Europe/Istanbul');
        $failed = $this->appointment($printer, $start, AppointmentStatus::Failed);
        $blocking = $this->appointment($printer, $start, AppointmentStatus::Approved);

        $this->actingAs($admin)->patch(route('admin.appointments.status', $failed->public_id), [
            'status' => AppointmentStatus::Ready->value,
        ])->assertSessionHasErrors('status');
        $this->assertSame(AppointmentStatus::Failed, $failed->fresh()->status);

        $blocking->update(['status' => AppointmentStatus::Canceled]);
        $this->patch(route('admin.appointments.status', $failed->public_id), [
            'status' => AppointmentStatus::Ready->value,
        ])->assertSessionHas('success');
        $this->assertSame(AppointmentStatus::Ready, $failed->fresh()->status);
    }

    public function test_failed_appointment_cannot_return_to_ready_during_maintenance(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $start = CarbonImmutable::parse('2026-10-05 14:00:00', 'Europe/Istanbul');
        $failed = $this->appointment($printer, $start, AppointmentStatus::Failed);
        BlackoutPeriod::query()->create([
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'starts_at' => $start,
            'ends_at' => $start->addHours(2),
            'reason' => 'Planlı bakım',
        ]);

        $this->actingAs($admin)->patch(route('admin.appointments.status', $failed->public_id), [
            'status' => AppointmentStatus::Ready->value,
        ])->assertSessionHasErrors('status');
        $this->assertSame(AppointmentStatus::Failed, $failed->fresh()->status);
    }

    public function test_maintenance_cannot_overlap_a_blocking_appointment_but_can_start_at_its_end(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $start = CarbonImmutable::parse('2026-10-05 10:00:00', 'Europe/Istanbul');
        $this->appointment($printer, $start, AppointmentStatus::Approved);

        foreach ([$printer->id, null] as $printerId) {
            $this->actingAs($admin)->post(route('admin.settings.blackouts.store'), [
                'printer_id' => $printerId,
                'kind' => 'maintenance',
                'is_all_day' => false,
                'starts_at' => $start->addHour()->format('Y-m-d\TH:i'),
                'ends_at' => $start->addHours(3)->format('Y-m-d\TH:i'),
                'reason' => $printerId ? 'Yazıcı bakımı' : 'Atölye bakımı',
            ])->assertSessionHasErrors('starts_at');
        }
        $this->assertDatabaseCount('blackout_periods', 0);

        $this->post(route('admin.settings.blackouts.store'), [
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'is_all_day' => false,
            'starts_at' => $start->addHours(2)->format('Y-m-d\TH:i'),
            'ends_at' => $start->addHours(3)->format('Y-m-d\TH:i'),
            'reason' => 'Randevu sonrası bakım',
        ])->assertSessionHas('success');
        $this->assertDatabaseCount('blackout_periods', 1);

        $blackout = BlackoutPeriod::query()->sole();
        $this->patch(route('admin.settings.blackouts.update', $blackout), [
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'is_all_day' => false,
            'starts_at' => $start->addHour()->format('Y-m-d\TH:i'),
            'ends_at' => $start->addHours(3)->format('Y-m-d\TH:i'),
            'reason' => 'Çakışan güncelleme',
        ])->assertSessionHasErrors('starts_at');
        $this->assertSame($start->addHours(2)->format('Y-m-d H:i:s'), $blackout->fresh()->starts_at->format('Y-m-d H:i:s'));
    }

    public function test_admin_calendar_includes_printer_and_global_blackout_periods(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $start = CarbonImmutable::parse('2026-10-05 13:00:00', 'Europe/Istanbul');
        BlackoutPeriod::query()->create([
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'starts_at' => $start,
            'ends_at' => $start->addHour(),
            'reason' => 'Nozul bakımı',
        ]);
        BlackoutPeriod::query()->create([
            'printer_id' => null,
            'kind' => 'closed',
            'starts_at' => $start->addHours(2),
            'ends_at' => $start->addHours(3),
            'reason' => 'Atölye kapalı',
        ]);

        $this->actingAs($admin)->get(route('admin.calendar.index', [
            'date' => $start->format('Y-m-d'),
            'view' => 'day',
        ]))->assertInertia(fn (Assert $page) => $page
            ->has('days.0.appointments', 2)
            ->where('days.0.appointments.0.status', 'maintenance')
            ->where('days.0.appointments.0.name', 'Nozul bakımı')
            ->where('days.0.appointments.0.printer', $printer->name)
            ->where('days.0.appointments.1.status', 'closed')
            ->where('days.0.appointments.1.name', 'Atölye kapalı')
            ->where('days.0.appointments.1.printer', 'Tüm atölye'));
    }

    private function appointment(Printer $printer, CarbonImmutable $startsAt, AppointmentStatus $status): Appointment
    {
        return Appointment::query()->create([
            'printer_id' => $printer->id,
            'status' => $status,
            'first_name' => 'Test',
            'last_name' => 'Kullanıcı',
            'email' => Str::random(8).'@example.com',
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->addHours(2),
            'duration_minutes' => 120,
            'filament_source' => FilamentSource::Own,
            'filament_material' => 'PLA',
            'filament_color' => 'Siyah',
            'tracking_token_hash' => hash('sha256', Str::random(64)),
            'email_verified_at' => now(),
            'privacy_notice_version' => 'test',
            'privacy_notice_seen_at' => now(),
            'rules_accepted_at' => now(),
        ]);
    }
}
