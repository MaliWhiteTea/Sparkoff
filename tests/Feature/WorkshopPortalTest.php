<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Models\Appointment;
use App\Models\BlackoutPeriod;
use App\Models\Printer;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class WorkshopPortalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_public_printer_portal_exposes_only_operational_information(): void
    {
        $this->get(route('printers.public'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Printers')
            ->has('printers', 2)
            ->has('hours', 7)
            ->has('filamentSummary')
            ->missing('appointments')
            ->missing('users'));
    }

    public function test_online_booking_is_disabled_when_the_feature_flag_is_off(): void
    {
        config()->set('features.online_booking', false);

        $this->get(route('booking.create'))->assertRedirect(route('printers.public'));
        $this->post(route('booking.store'))->assertNotFound();
        $this->get('/randevu/takip/gecersiz/gecersiz')->assertNotFound();
    }

    public function test_public_responses_include_security_headers(): void
    {
        $this->get(route('home'))
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
            ->assertHeaderMissing('X-Powered-By');
    }

    public function test_public_portal_shows_anonymous_schedule_blocks(): void
    {
        $printer = Printer::query()->firstOrFail();
        $block = BlackoutPeriod::query()->create([
            'printer_id' => $printer->id,
            'kind' => 'busy',
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHours(3),
            'reason' => 'Baskı sürüyor',
        ]);

        $this->get(route('printers.public'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('schedule', 1)
            ->where('schedule.0.id', "blackout-{$block->id}")
            ->where('schedule.0.kind', 'busy')
            ->where('schedule.0.note', 'Baskı sürüyor')
            ->where('printers.0.availability', 'busy')
            ->where('printers.0.availabilityLabel', 'Şu anda dolu')
            ->missing('schedule.0.user'));
    }

    public function test_public_pages_show_a_current_print_without_exposing_personal_data(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-28 12:00:00', 'Europe/Istanbul'));
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $appointment = $this->appointment(
            $printer,
            AppointmentStatus::Printing,
            now()->subHour(),
            now()->addHours(2),
        );

        $this->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('printers.0.availability', 'busy')
            ->where('printers.0.availabilityLabel', 'Baskı yapıyor'));

        $this->get(route('printers.public'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('printers.0.availability', 'busy')
            ->where('printers.0.availabilityLabel', 'Baskı yapıyor')
            ->where('schedule.0.id', "appointment-{$appointment->id}")
            ->where('schedule.0.kind', 'busy')
            ->where('schedule.0.kindLabel', 'Baskı')
            ->where('schedule.0.note', null)
            ->missing('schedule.0.email')
            ->missing('schedule.0.name')
            ->missing('schedule.0.publicId'));
    }

    public function test_non_blocking_appointments_are_absent_from_public_status_and_schedule(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-28 12:00:00', 'Europe/Istanbul'));
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();

        foreach ([AppointmentStatus::Canceled, AppointmentStatus::Rejected, AppointmentStatus::Completed, AppointmentStatus::Failed] as $status) {
            $this->appointment($printer, $status, now()->subHour(), now()->addHour());
        }

        $this->get(route('printers.public'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('printers.0.availability', 'available')
            ->where('printers.0.availabilityLabel', 'Şu anda boş')
            ->has('schedule', 0));
    }

    public function test_an_overnight_appointment_is_exposed_as_one_anonymous_interval(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-28 12:00:00', 'Europe/Istanbul'));
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $appointment = $this->appointment(
            $printer,
            AppointmentStatus::Approved,
            CarbonImmutable::parse('2026-10-28 23:00:00', 'Europe/Istanbul'),
            CarbonImmutable::parse('2026-10-29 03:00:00', 'Europe/Istanbul'),
        );

        $this->get(route('printers.public'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('schedule', 1)
            ->where('schedule.0.id', "appointment-{$appointment->id}")
            ->where('schedule.0.startsAt', '2026-10-28T23:00:00+03:00')
            ->where('schedule.0.endsAt', '2026-10-29T03:00:00+03:00'));
    }

    public function test_an_appointment_ending_now_is_free_but_one_starting_now_is_busy(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-28 12:00:00', 'Europe/Istanbul'));
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $this->appointment($printer, AppointmentStatus::Approved, now()->subHours(2), now());

        $this->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('printers.0.availability', 'available'));

        $this->appointment($printer, AppointmentStatus::Approved, now(), now()->addHour());

        $this->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('printers.0.availability', 'busy'));
    }

    public function test_manual_schedule_remains_public_when_online_booking_is_disabled(): void
    {
        config()->set('features.online_booking', false);
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        BlackoutPeriod::query()->create([
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'starts_at' => now()->addHour(),
            'ends_at' => now()->addHours(2),
            'reason' => 'Planlı bakım',
        ]);

        $this->get(route('printers.public'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('schedule', 1)
            ->where('schedule.0.kind', 'maintenance')
            ->where('schedule.0.note', 'Planlı bakım'));
    }

    public function test_privacy_page_exposes_the_configured_booking_notice(): void
    {
        $this->get(route('privacy.notice'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('PrivacyNotice')
            ->has('privacy')
            ->where('privacy.noticeVersion', '2026-10-16'));
    }

    private function appointment(
        Printer $printer,
        AppointmentStatus $status,
        mixed $startsAt,
        mixed $endsAt,
    ): Appointment {
        return Appointment::query()->create([
            'printer_id' => $printer->id,
            'status' => $status,
            'first_name' => 'Gizli',
            'last_name' => 'Kullanıcı',
            'email' => 'gizli@example.com',
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'duration_minutes' => 60,
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
