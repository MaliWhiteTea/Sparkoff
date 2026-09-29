<?php

namespace Tests\Feature;

use App\Models\Filament;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FilamentManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_temporarily_disable_a_material_with_a_reason(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($admin)->patch(route('admin.settings.filaments.material-availability', 'PLA'), [
            'is_available' => false,
            'reason' => 'Yazıcının kapağı onarımda.',
        ])->assertSessionHas('success');

        $plaCount = Filament::query()->where('material', 'PLA')->count();
        $this->assertGreaterThan(0, $plaCount);
        $this->assertSame(0, Filament::query()->where('material', 'PLA')->where('is_available', true)->count());
        $this->assertSame($plaCount, Filament::query()->where('material', 'PLA')->where('unavailable_reason', 'Yazıcının kapağı onarımda.')->count());
    }

    public function test_disabled_filaments_are_hidden_from_booking_but_explained_in_the_catalog(): void
    {
        Filament::query()->where('material', 'PLA')->update([
            'is_available' => false,
            'unavailable_reason' => 'Geçici bakım nedeniyle kapalı.',
        ]);

        $this->get(route('booking.create'))->assertInertia(fn (Assert $page) => $page
            ->component('Booking')
            ->has('filaments', 0));

        $this->get(route('filaments.index'))->assertInertia(fn (Assert $page) => $page
            ->component('Filaments')
            ->where('materials.0.material', 'PLA')
            ->where('materials.0.isAvailable', false)
            ->where('materials.0.unavailableReason', 'Geçici bakım nedeniyle kapalı.'));
    }

    public function test_disabling_a_material_requires_a_reason(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($admin)->patch(route('admin.settings.filaments.material-availability', 'PLA'), [
            'is_available' => false,
            'reason' => '',
        ])->assertSessionHasErrors('reason');

        $this->assertTrue(Filament::query()->where('material', 'PLA')->firstOrFail()->is_available);
    }
}
