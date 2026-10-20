<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Models\Appointment;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AppointmentPermissionBoundaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_appointment_viewer_without_personal_data_permission_receives_masked_identity(): void
    {
        $viewer = $this->userWithPermissions(['appointments.view']);
        $appointment = $this->appointment();

        $this->actingAs($viewer)->get(route('admin.appointments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('appointments.data.0.name', 'Gizli başvuru sahibi')
                ->where('appointments.data.0.email', null));

        $this->actingAs($viewer)->get(route('admin.appointments.show', $appointment->public_id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('appointment.name', 'Gizli başvuru sahibi')
                ->where('appointment.email', null)
                ->has('appointment.files', 0)
                ->has('appointment.actions', 0));
    }

    public function test_calendar_manager_without_personal_data_or_appointment_view_permission_gets_anonymous_unlinked_events(): void
    {
        $manager = $this->userWithPermissions(['printers.manage_schedule']);
        $this->appointment();

        $this->actingAs($manager)->get(route('admin.calendar.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('days', function ($days) {
                    $event = collect($days)->flatMap(fn ($day) => $day['appointments'])->first();

                    return $event['name'] === 'Planlanmış baskı' && $event['publicId'] === null;
                }));
    }

    public function test_review_and_print_status_permissions_are_separated(): void
    {
        Mail::fake();
        $appointment = $this->appointment();
        $reviewer = $this->userWithPermissions(['appointments.view', 'appointments.review']);
        $operator = $this->userWithPermissions(['appointments.view', 'appointments.manage_status']);

        $this->actingAs($reviewer)->get(route('admin.appointments.show', $appointment->public_id))
            ->assertInertia(fn (Assert $page) => $page->has('appointment.actions', 0));
        $this->actingAs($reviewer)->patch(route('admin.appointments.status', $appointment->public_id), [
            'status' => AppointmentStatus::Ready->value,
        ])->assertForbidden();

        $this->actingAs($operator)->get(route('admin.appointments.show', $appointment->public_id))
            ->assertInertia(fn (Assert $page) => $page->where('appointment.actions.0.status', AppointmentStatus::Ready->value));
        $this->actingAs($operator)->patch(route('admin.appointments.status', $appointment->public_id), [
            'status' => AppointmentStatus::Ready->value,
        ])->assertSessionHas('success');
    }

    private function userWithPermissions(array $permissions): User
    {
        $role = Role::query()->create(['name' => Str::random(8), 'slug' => Str::lower(Str::random(12))]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function appointment(): Appointment
    {
        $startsAt = CarbonImmutable::now('Europe/Istanbul')->addDays(3)->setTime(10, 0);

        return Appointment::query()->create([
            'printer_id' => Printer::query()->where('code', 'P-01')->value('id'),
            'status' => AppointmentStatus::Approved,
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'email' => 'ada@example.com',
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->addHours(2),
            'duration_minutes' => 120,
            'filament_source' => FilamentSource::Workshop,
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
