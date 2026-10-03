<?php

namespace Tests\Feature;

use App\Models\BlackoutPeriod;
use App\Models\Printer;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            ->assertHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
            ->where('schedule.0.id', $block->id)
            ->where('schedule.0.kind', 'busy')
            ->where('schedule.0.note', 'Baskı sürüyor')
            ->where('printers.0.availability', 'busy')
            ->where('printers.0.availabilityLabel', 'Şu anda dolu')
            ->missing('schedule.0.user'));
    }

    public function test_privacy_page_does_not_claim_that_a_booking_form_collects_data(): void
    {
        $this->get(route('privacy.notice'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('PrivacyNotice')
            ->missing('privacy'));
    }
}
