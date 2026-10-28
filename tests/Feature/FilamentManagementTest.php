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
        $admin = User::factory()->systemAdministrator()->create();

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
        $admin = User::factory()->systemAdministrator()->create();

        $this->actingAs($admin)->patch(route('admin.settings.filaments.material-availability', 'PLA'), [
            'is_available' => false,
            'reason' => '',
        ])->assertSessionHasErrors('reason');

        $this->assertTrue(Filament::query()->where('material', 'PLA')->firstOrFail()->is_available);
    }

    public function test_saving_technical_details_cannot_reopen_a_disabled_material_with_stale_form_data(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $filament = Filament::query()->where('material', 'PLA')->firstOrFail();
        $this->actingAs($admin)->patch(route('admin.settings.filaments.material-availability', 'PLA'), [
            'is_available' => false,
            'reason' => 'Bakım testi',
        ])->assertSessionHas('success');

        $this->actingAs($admin)->patch(route('admin.settings.filaments.update', $filament), [
            'material' => $filament->material,
            'color' => $filament->color,
            'brand' => $filament->brand,
            'diameter_mm' => $filament->diameter_mm,
            'spool_weight_grams' => $filament->spool_weight_grams,
            'nozzle_temp_min' => $filament->nozzle_temp_min,
            'nozzle_temp_max' => $filament->nozzle_temp_max,
            'bed_temp_min' => $filament->bed_temp_min,
            'bed_temp_max' => $filament->bed_temp_max,
            'technical_notes' => 'Teknik bilgi güncellendi.',
            'is_available' => true,
            'unavailable_reason' => null,
        ])->assertSessionHas('success');

        $this->assertSame(0, Filament::query()->where('material', 'PLA')->where('is_available', true)->count());
        $this->assertSame('Teknik bilgi güncellendi.', $filament->fresh()->technical_notes);
        $this->actingAs($admin)->get(route('admin.settings.filaments.index'))->assertInertia(fn (Assert $page) => $page
            ->where('materials.0.isAvailable', false)
            ->where('filaments.0.is_available', false));
    }

    public function test_invalid_technical_details_are_rejected_without_changing_the_filament(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $filament = Filament::query()->firstOrFail();

        $this->actingAs($admin)->patch(route('admin.settings.filaments.update', $filament), [
            'material' => '',
            'color' => $filament->color,
            'diameter_mm' => 1.75,
            'nozzle_temp_min' => 250,
            'nozzle_temp_max' => 200,
        ])->assertSessionHasErrors(['material', 'nozzle_temp_max']);

        $this->assertSame('PLA', $filament->fresh()->material);
        $this->assertSame(220, $filament->fresh()->nozzle_temp_max);
    }
}
