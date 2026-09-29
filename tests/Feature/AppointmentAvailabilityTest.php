<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Enums\PrinterStatus;
use App\Exceptions\SlotUnavailableException;
use App\Models\Appointment;
use App\Models\BlackoutPeriod;
use App\Models\OperatingHour;
use App\Models\Printer;
use App\Services\AppointmentAvailabilityService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AppointmentAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private Printer $printer;

    private AppointmentAvailabilityService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->printer = Printer::query()->create([
            'code' => 'P-01',
            'name' => 'Test Yazıcısı',
            'status' => PrinterStatus::Active,
        ]);

        OperatingHour::query()->create([
            'weekday' => 1,
            'is_open' => true,
            'opens_at' => '09:00:00',
            'latest_start_at' => '21:00:00',
        ]);

        $this->service = app(AppointmentAvailabilityService::class);
    }

    public function test_a_24_hour_print_can_start_at_21_and_finish_next_day(): void
    {
        $start = CarbonImmutable::parse('2026-10-05 21:00:00', 'Europe/Istanbul');

        $end = $this->service->assertAvailable($this->printer, $start, 24 * 60);

        $this->assertSame('2026-10-06 21:00:00', $end->format('Y-m-d H:i:s'));
    }

    public function test_a_start_after_21_is_rejected(): void
    {
        $this->expectException(SlotUnavailableException::class);

        $this->service->assertAvailable(
            $this->printer,
            CarbonImmutable::parse('2026-10-05 21:30:00', 'Europe/Istanbul'),
            60,
        );
    }

    public function test_a_maintenance_printer_is_rejected(): void
    {
        $this->printer->update(['status' => PrinterStatus::Maintenance]);

        $this->expectException(SlotUnavailableException::class);

        $this->service->assertAvailable(
            $this->printer->fresh(),
            CarbonImmutable::parse('2026-10-05 10:00:00', 'Europe/Istanbul'),
            60,
        );
    }

    public function test_an_overlapping_appointment_is_rejected_but_adjacent_time_is_allowed(): void
    {
        $this->createAppointment('2026-10-05 10:00:00', '2026-10-05 12:00:00');

        try {
            $this->service->assertAvailable(
                $this->printer,
                CarbonImmutable::parse('2026-10-05 11:30:00', 'Europe/Istanbul'),
                60,
            );
            $this->fail('Çakışan randevu reddedilmeliydi.');
        } catch (SlotUnavailableException) {
            $this->assertTrue(true);
        }

        $end = $this->service->assertAvailable(
            $this->printer,
            CarbonImmutable::parse('2026-10-05 12:00:00', 'Europe/Istanbul'),
            60,
        );

        $this->assertSame('13:00', $end->format('H:i'));
    }

    public function test_availability_endpoint_only_returns_non_conflicting_start_times(): void
    {
        $this->createAppointment('2026-10-05 10:00:00', '2026-10-05 12:00:00');

        $this->getJson(route('booking.availability', [
            'date' => '2026-10-05',
            'duration_minutes' => 60,
        ]))
            ->assertOk()
            ->assertJsonPath('printer.code', 'P-01')
            ->assertJsonMissing(['10:00'])
            ->assertJsonMissing(['11:30'])
            ->assertJsonFragment(['12:00']);
    }

    public function test_a_blackout_period_is_rejected(): void
    {
        BlackoutPeriod::query()->create([
            'printer_id' => $this->printer->id,
            'starts_at' => '2026-10-05 13:00:00',
            'ends_at' => '2026-10-05 15:00:00',
            'reason' => 'Bakım',
        ]);

        $this->expectException(SlotUnavailableException::class);

        $this->service->assertAvailable(
            $this->printer,
            CarbonImmutable::parse('2026-10-05 14:00:00', 'Europe/Istanbul'),
            60,
        );
    }

    private function createAppointment(string $startsAt, string $endsAt): Appointment
    {
        return Appointment::query()->create([
            'printer_id' => $this->printer->id,
            'status' => AppointmentStatus::Approved,
            'first_name' => 'Test',
            'last_name' => 'Kullanıcı',
            'email' => 'test@example.com',
            'phone' => '05550000000',
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'duration_minutes' => 120,
            'filament_source' => FilamentSource::Own,
            'filament_material' => 'PLA',
            'filament_color' => 'Siyah',
            'tracking_token_hash' => hash('sha256', Str::random(64)),
            'privacy_notice_version' => 'test',
            'privacy_notice_seen_at' => now(),
            'rules_accepted_at' => now(),
        ]);
    }
}
