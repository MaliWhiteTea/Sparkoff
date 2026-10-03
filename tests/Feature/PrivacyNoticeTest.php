<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PrivacyNoticeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_privacy_notice_is_publicly_accessible(): void
    {
        $this->get(route('privacy.notice'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('PrivacyNotice')
            ->missing('privacy'));
    }

    public function test_only_an_admin_can_open_privacy_settings(): void
    {
        $this->get(route('admin.settings.privacy.edit'))->assertRedirect(route('admin.login'));

        $user = User::factory()->create(['role' => 'student', 'is_active' => true]);
        $this->actingAs($user)->get(route('admin.settings.privacy.edit'))->assertRedirect(route('admin.login'));
    }

    public function test_admin_can_update_privacy_and_retention_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($admin)->put(route('admin.settings.privacy.update'), [
            'controller_name' => 'Örnek Mesleki ve Teknik Anadolu Lisesi',
            'controller_address' => 'Örnek Mahallesi, İstanbul',
            'contact_email' => 'KVKK@SPARKOFF.TR',
            'appointment_retention_months' => 6,
            'file_retention_days' => 14,
            'notice_version' => '2026-10-01',
            'is_draft' => false,
        ])->assertSessionHas('success');

        $this->assertSame('Örnek Mesleki ve Teknik Anadolu Lisesi', Setting::valueOf('privacy.controller_name'));
        $this->assertSame('kvkk@sparkoff.tr', Setting::valueOf('privacy.contact_email'));
        $this->assertSame(14, Setting::valueOf('privacy.file_retention_days'));
        $this->assertFalse(Setting::valueOf('privacy.is_draft'));
    }
}
