<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Enums\PrinterStatus;
use App\Mail\AppointmentStatusMail;
use App\Models\ActivityLog;
use App\Models\Announcement;
use App\Models\Appointment;
use App\Models\BlackoutPeriod;
use App\Models\Printer;
use App\Models\Setting;
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
        ])->assertRedirect(route('admin.settings.printers.index'));

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

    public function test_only_admin_role_can_manage_printer_settings(): void
    {
        $operator = $this->admin(['role' => 'operator']);

        $this->actingAs($operator)
            ->get(route('admin.settings.printers.index'))
            ->assertForbidden();
    }

    public function test_admin_can_update_public_contact_and_operating_hours(): void
    {
        $admin = $this->admin();
        $hours = collect(range(1, 7))->map(fn (int $weekday) => [
            'weekday' => $weekday,
            'is_open' => $weekday <= 5,
            'opens_at' => '10:00',
            'latest_start_at' => '18:00',
        ])->all();

        $this->actingAs($admin)->put(route('admin.settings.workshop.update'), [
            'phone' => '+90 532 000 00 00',
            'whatsapp' => '+90 532 000 00 00',
            'email' => 'iletisim@sparkoff.tr',
            'contact_hours' => 'Hafta içi 10.00–18.00',
            'hours' => $hours,
        ])->assertSessionHas('success');

        $this->assertSame('+90 532 000 00 00', Setting::valueOf('workshop.contact_phone'));
        $this->assertSame('iletisim@sparkoff.tr', Setting::valueOf('workshop.contact_email'));
        $this->assertDatabaseHas('operating_hours', ['weekday' => 6, 'is_open' => false]);

        $this->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('contact.phone', '+90 532 000 00 00')
            ->where('contact.email', 'iletisim@sparkoff.tr'));
    }

    public function test_admin_can_update_a_printer_and_add_a_blackout_period(): void
    {
        $admin = $this->admin();
        $printer = Printer::query()->where('code', 'P-02')->firstOrFail();

        $this->actingAs($admin)->patch(route('admin.settings.printers.update', $printer), [
            'name' => 'Yedek Yazıcı',
            'status' => PrinterStatus::Active->value,
            'description' => 'Onarımı tamamlandı.',
        ])->assertSessionHas('success');

        $this->assertSame(PrinterStatus::Active, $printer->fresh()->status);

        $start = CarbonImmutable::now('Europe/Istanbul')->addDay()->setTime(12, 0);
        $this->actingAs($admin)->post(route('admin.settings.blackouts.store'), [
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'starts_at' => $start->format('Y-m-d\TH:i'),
            'ends_at' => $start->addHours(2)->format('Y-m-d\TH:i'),
            'reason' => 'Planlı bakım',
        ])->assertSessionHas('success');

        $this->assertDatabaseHas('blackout_periods', [
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'reason' => 'Planlı bakım',
        ]);
    }

    public function test_admin_cannot_add_an_overlapping_schedule_block(): void
    {
        $admin = $this->admin();
        $printer = Printer::query()->firstOrFail();
        $start = CarbonImmutable::now('Europe/Istanbul')->addDay()->setTime(12, 0);

        BlackoutPeriod::query()->create([
            'printer_id' => $printer->id,
            'kind' => 'busy',
            'starts_at' => $start,
            'ends_at' => $start->addHours(2),
            'reason' => 'Baskı sürüyor',
        ]);

        $this->actingAs($admin)->post(route('admin.settings.blackouts.store'), [
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'starts_at' => $start->addHour()->format('Y-m-d\TH:i'),
            'ends_at' => $start->addHours(3)->format('Y-m-d\TH:i'),
            'reason' => 'Bakım',
        ])->assertSessionHasErrors('starts_at');

        $this->assertDatabaseCount('blackout_periods', 1);
    }

    public function test_admin_can_remove_a_blackout_period(): void
    {
        $admin = $this->admin();
        $blackout = BlackoutPeriod::query()->create([
            'printer_id' => null,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDays(2),
            'reason' => 'Tatil',
        ]);

        $this->actingAs($admin)
            ->delete(route('admin.settings.blackouts.destroy', $blackout))
            ->assertSessionHas('success');

        $this->assertModelMissing($blackout);
    }

    public function test_admin_can_create_and_update_an_all_day_schedule_block(): void
    {
        $admin = $this->admin();
        $printer = Printer::query()->firstOrFail();
        $date = now()->addDays(3)->format('Y-m-d');

        $this->actingAs($admin)->post(route('admin.settings.blackouts.store'), [
            'printer_id' => $printer->id,
            'kind' => 'maintenance',
            'is_all_day' => true,
            'starts_at' => $date,
            'ends_at' => $date,
            'reason' => 'Tüm gün bakım',
        ])->assertSessionHas('success');

        $block = BlackoutPeriod::query()->sole();
        $this->assertTrue($block->is_all_day);
        $this->assertSame(24.0, $block->starts_at->diffInHours($block->ends_at));

        $this->actingAs($admin)->patch(route('admin.settings.blackouts.update', $block), [
            'printer_id' => $printer->id,
            'kind' => 'closed',
            'is_all_day' => true,
            'starts_at' => $date,
            'ends_at' => now()->addDays(4)->format('Y-m-d'),
            'reason' => 'İki gün kapalı',
        ])->assertSessionHas('success');

        $this->assertDatabaseHas('blackout_periods', ['id' => $block->id, 'kind' => 'closed', 'reason' => 'İki gün kapalı']);
    }

    public function test_admin_can_manage_a_public_announcement(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->post(route('admin.announcements.store'), [
            'title' => 'Planlı bakım',
            'body' => 'P-01 bugün bakımdadır.',
            'type' => 'maintenance',
            'placement' => 'printers',
            'is_published' => true,
            'starts_at' => now()->subHour()->format('Y-m-d\TH:i'),
            'ends_at' => now()->addDay()->format('Y-m-d\TH:i'),
        ])->assertSessionHas('success');

        $announcement = Announcement::query()->sole();
        $this->get(route('printers.public'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('announcements', 1)
            ->where('announcements.0.title', 'Planlı bakım'));
        $this->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page->has('announcements', 0));

        $this->actingAs($admin)->patch(route('admin.announcements.update', $announcement), [
            'title' => 'Bakım tamamlandı',
            'body' => 'Yazıcı yeniden kullanıma açıldı.',
            'type' => 'info',
            'placement' => 'all',
            'is_published' => false,
        ])->assertSessionHas('success');

        $this->assertFalse($announcement->fresh()->is_published);
    }

    public function test_admin_changes_are_recorded_without_field_values(): void
    {
        $admin = $this->admin();
        $printer = Printer::query()->firstOrFail();

        $this->actingAs($admin)->patch(route('admin.settings.printers.update', $printer), [
            'name' => 'Güncel Yazıcı',
            'status' => PrinterStatus::Active->value,
            'description' => 'Yeni açıklama',
        ])->assertSessionHas('success');

        $log = ActivityLog::query()->latest('id')->firstOrFail();
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('updated', $log->action);
        $this->assertContains('name', $log->changed_fields);
        $this->assertStringNotContainsString('Güncel Yazıcı', json_encode($log->changed_fields));

        $this->actingAs($admin)->get(route('admin.activity-logs'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Admin/ActivityLogs')
            ->has('logs', 1));
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
