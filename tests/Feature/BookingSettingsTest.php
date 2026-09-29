<?php

namespace Tests\Feature;

use App\Models\OperatingHour;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BookingSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_update_every_booking_rule_and_booking_form_receives_them(): void
    {
        $admin = User::query()->create([
            'name' => 'Yönetici', 'email' => 'admin@sparkoff.tr', 'password' => 'guvenli-test-parolasi',
            'role' => 'admin', 'is_active' => true,
        ]);
        $hours = collect(range(1, 7))->map(fn (int $weekday) => [
            'weekday' => $weekday,
            'is_open' => $weekday !== 7,
            'opens_at' => '10:00',
            'latest_start_at' => '20:00',
        ])->all();

        $this->actingAs($admin)->put(route('admin.settings.booking.update'), [
            'hours' => $hours,
            'slot_minutes' => 15,
            'maximum_duration_hours' => 48,
            'verification_hold_minutes' => 60,
            'maximum_file_size_mb' => 25,
            'allowed_extensions' => ['stl', '3mf'],
        ])->assertSessionHas('success');

        $sunday = OperatingHour::query()->where('weekday', 7)->firstOrFail();
        $this->assertFalse($sunday->is_open);
        $this->assertNull($sunday->opens_at);
        $this->assertSame(15, Setting::valueOf('booking.slot_minutes'));
        $this->assertSame(48, Setting::valueOf('booking.maximum_duration_hours'));
        $this->assertSame(60, Setting::valueOf('booking.verification_hold_minutes'));
        $this->assertSame(25, Setting::valueOf('uploads.maximum_file_size_mb'));
        $this->assertSame(['stl', '3mf'], Setting::valueOf('uploads.allowed_extensions'));

        $this->get(route('booking.create'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Booking')
            ->where('settings.slotMinutes', 15)
            ->where('settings.maximumDurationHours', 48)
            ->where('settings.maximumFileSizeMb', 25)
            ->where('settings.allowedFileExtensions', ['stl', '3mf']));
    }

    public function test_open_day_rejects_a_latest_start_before_opening_time(): void
    {
        $admin = User::query()->create([
            'name' => 'Yönetici', 'email' => 'admin@sparkoff.tr', 'password' => 'guvenli-test-parolasi',
            'role' => 'admin', 'is_active' => true,
        ]);
        $hours = collect(range(1, 7))->map(fn (int $weekday) => [
            'weekday' => $weekday, 'is_open' => true, 'opens_at' => '18:00', 'latest_start_at' => '09:00',
        ])->all();

        $this->actingAs($admin)->put(route('admin.settings.booking.update'), [
            'hours' => $hours,
            'slot_minutes' => 30,
            'maximum_duration_hours' => 24,
            'verification_hold_minutes' => 30,
            'maximum_file_size_mb' => 100,
            'allowed_extensions' => ['stl'],
        ])->assertSessionHasErrors('hours.0.latest_start_at');

        $this->assertSame('09:00:00', OperatingHour::query()->where('weekday', 1)->value('opens_at'));
    }
}
