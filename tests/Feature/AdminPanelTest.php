<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Mail\AppointmentStatusMail;
use App\Models\Appointment;
use App\Models\Printer;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_guest_cannot_open_admin_appointments(): void
    {
        $this->get(route('admin.appointments.index'))->assertRedirect(route('admin.login'));
        $this->get(route('admin.calendar.index'))->assertRedirect(route('admin.login'));
    }

    public function test_active_admin_can_log_in_and_view_appointments(): void
    {
        $admin = $this->admin();
        $appointment = $this->appointment();

        $this->post(route('admin.login.store'), [
            'email' => $admin->email,
            'password' => 'guvenli-test-parolasi',
        ])->assertRedirect(route('admin.appointments.index'));

        $this->get(route('admin.appointments.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Appointments/Index')
                ->where('appointments.data.0.publicId', $appointment->public_id));
    }

    public function test_inactive_admin_cannot_log_in(): void
    {
        $admin = $this->admin(['is_active' => false]);

        $this->post(route('admin.login.store'), [
            'email' => $admin->email,
            'password' => 'guvenli-test-parolasi',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_an_active_user_without_an_admin_role_cannot_log_in(): void
    {
        $user = $this->admin(['role' => 'student']);

        $this->post(route('admin.login.store'), [
            'email' => $user->email,
            'password' => 'guvenli-test-parolasi',
        ])->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_admin_can_approve_an_appointment_and_action_is_logged(): void
    {
        Mail::fake();
        $admin = $this->admin();
        $appointment = $this->appointment();

        $this->actingAs($admin)->patch(route('admin.appointments.status', $appointment->public_id), [
            'status' => AppointmentStatus::Approved->value,
            'note' => 'Dosya baskıya uygundur.',
        ])->assertSessionHas('success');

        $this->assertSame(AppointmentStatus::Approved, $appointment->fresh()->status);
        $this->assertDatabaseHas('appointment_status_histories', [
            'appointment_id' => $appointment->id,
            'actor_id' => $admin->id,
            'to_status' => AppointmentStatus::Approved->value,
        ]);
        Mail::assertSent(AppointmentStatusMail::class, fn ($mail) => $mail->hasTo($appointment->email));
    }

    public function test_operational_statuses_must_follow_the_defined_order(): void
    {
        Mail::fake();
        $admin = $this->admin();
        $appointment = $this->appointment();
        $appointment->update(['status' => AppointmentStatus::Approved]);
        $route = route('admin.appointments.status', $appointment->public_id);

        $this->actingAs($admin)->patch($route, ['status' => AppointmentStatus::Completed->value])
            ->assertUnprocessable();
        $this->assertSame(AppointmentStatus::Approved, $appointment->fresh()->status);

        foreach ([AppointmentStatus::Ready, AppointmentStatus::Printing, AppointmentStatus::Completed] as $status) {
            $this->actingAs($admin)->patch($route, ['status' => $status->value])
                ->assertSessionHas('success');
            $this->assertSame($status, $appointment->fresh()->status);
        }

        $this->assertSame(3, $appointment->statusHistory()
            ->whereIn('to_status', [
                AppointmentStatus::Ready->value,
                AppointmentStatus::Printing->value,
                AppointmentStatus::Completed->value,
            ])->count());
    }

    public function test_change_request_requires_an_explanation(): void
    {
        $admin = $this->admin();
        $appointment = $this->appointment();

        $this->actingAs($admin)->patch(route('admin.appointments.status', $appointment->public_id), [
            'status' => AppointmentStatus::ChangeRequested->value,
        ])->assertSessionHasErrors('note');

        $this->assertSame(AppointmentStatus::PendingApproval, $appointment->fresh()->status);
    }

    public function test_only_authenticated_admin_can_download_an_appointment_file(): void
    {
        Storage::fake('local');
        $admin = $this->admin();
        $appointment = $this->appointment();
        $path = "appointments/{$appointment->public_id}/model.stl";
        Storage::disk('local')->put($path, 'solid model');
        $file = $appointment->files()->create([
            'disk' => 'local', 'path' => $path, 'original_name' => 'model.stl',
            'extension' => 'stl', 'mime_type' => 'application/octet-stream', 'size_bytes' => 11,
        ]);
        $url = route('admin.appointments.files.download', [$appointment->public_id, $file]);

        $this->get($url)->assertRedirect(route('admin.login'));
        $this->actingAs($admin)->get($url)->assertDownload('model.stl');
    }

    public function test_private_appointment_files_are_not_exposed_by_a_storage_route(): void
    {
        $this->assertFalse(config('filesystems.disks.local.serve'));
        $this->assertFalse(app('router')->getRoutes()->hasNamedRoute('storage.local'));
    }

    public function test_calendar_displays_an_overnight_print_on_both_days(): void
    {
        $admin = $this->admin();
        $appointment = $this->appointment();
        $start = CarbonImmutable::now('Europe/Istanbul')->next(CarbonImmutable::MONDAY)->setTime(22, 0);
        $appointment->update([
            'status' => AppointmentStatus::Approved,
            'starts_at' => $start,
            'ends_at' => $start->addHours(5),
            'duration_minutes' => 300,
        ]);

        $this->actingAs($admin)->get(route('admin.calendar.index', [
            'date' => $start->format('Y-m-d'),
            'view' => 'week',
        ]))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Calendar')
            ->has('days', 7)
            ->where('days.0.appointments.0.publicId', $appointment->public_id)
            ->where('days.0.appointments.0.continuesNext', true)
            ->where('days.1.appointments.0.publicId', $appointment->public_id)
            ->where('days.1.appointments.0.continuesFromPrevious', true));
    }

    public function test_calendar_rejects_an_invalid_view(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.calendar.index', ['view' => 'year']))
            ->assertSessionHasErrors('view');
    }

    private function admin(array $overrides = []): User
    {
        return User::query()->create([
            'name' => 'Test Yöneticisi',
            'email' => 'admin@example.com',
            'password' => 'guvenli-test-parolasi',
            'role' => 'admin',
            'is_active' => true,
            ...$overrides,
        ]);
    }

    private function appointment(): Appointment
    {
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();
        $startsAt = CarbonImmutable::now('Europe/Istanbul')->addDays(3)->setTime(10, 0);

        $appointment = Appointment::query()->create([
            'printer_id' => $printer->id,
            'status' => AppointmentStatus::PendingApproval,
            'first_name' => 'Ada', 'last_name' => 'Lovelace',
            'email' => 'ada@example.com', 'phone' => '05550000000',
            'starts_at' => $startsAt, 'ends_at' => $startsAt->addHours(2), 'duration_minutes' => 120,
            'filament_source' => FilamentSource::Workshop, 'filament_material' => 'PLA', 'filament_color' => 'Siyah',
            'tracking_token_hash' => hash('sha256', Str::random(64)), 'email_verified_at' => now(),
            'privacy_notice_version' => 'test', 'privacy_notice_seen_at' => now(), 'rules_accepted_at' => now(),
        ]);
        $appointment->statusHistory()->create(['to_status' => AppointmentStatus::PendingApproval, 'note' => 'Test']);

        return $appointment;
    }
}
