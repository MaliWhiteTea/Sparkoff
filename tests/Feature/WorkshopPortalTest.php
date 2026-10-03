<?php

namespace Tests\Feature;

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
    }

    public function test_privacy_page_does_not_claim_that_a_booking_form_collects_data(): void
    {
        $this->get(route('privacy.notice'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('PrivacyNotice')
            ->missing('privacy'));
    }
}
