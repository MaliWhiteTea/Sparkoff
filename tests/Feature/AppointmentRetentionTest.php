<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Models\ActivityLog;
use App\Models\Appointment;
use App\Models\AppointmentFile;
use App\Models\Printer;
use App\Models\Setting;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AppointmentRetentionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Storage::fake('local');
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-28 12:00:00', 'Europe/Istanbul'));

        Setting::query()->where('key', 'privacy.appointment_retention_months')->firstOrFail()->update(['value' => 2]);
        Setting::query()->where('key', 'privacy.file_retention_days')->firstOrFail()->update(['value' => 10]);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_retention_command_applies_file_and_appointment_policies_idempotently(): void
    {
        $active = $this->appointment(AppointmentStatus::Approved, now()->subMonths(4), now()->subMonths(3));
        $oldTerminal = $this->appointment(AppointmentStatus::Completed, now()->subMonths(4), now()->subMonths(3));
        $recentTerminal = $this->appointment(AppointmentStatus::Completed, now()->subMonths(2), now()->subMonth());
        $held = $this->appointment(
            AppointmentStatus::Canceled,
            now()->subMonths(4),
            now()->subMonths(3),
            now()->addDay(),
        );
        $fileOwner = $this->appointment(AppointmentStatus::PendingApproval, now()->subDay(), now()->addDay());

        $oldTerminalFile = $this->file($oldTerminal, 'old-terminal.stl', now()->addDay());
        $heldFile = $this->file($held, 'held.stl', now()->subDay());
        $dueFile = $this->file($fileOwner, 'due.stl');
        $futureFile = $this->file($fileOwner, 'future.stl');
        DB::table('appointment_files')->where('id', $dueFile->id)->update([
            'created_at' => now()->subDays(11),
            'updated_at' => now()->subDays(11),
        ]);
        DB::table('appointment_files')->where('id', $futureFile->id)->update([
            'created_at' => now()->subDays(5),
            'updated_at' => now()->subDays(5),
        ]);

        $this->artisan('appointments:apply-retention')
            ->expectsOutput('2 model dosyası silindi, 1 randevu kaydı temizlendi.')
            ->assertSuccessful();

        $this->assertModelExists($active);
        $this->assertModelMissing($oldTerminal);
        $this->assertModelExists($recentTerminal);
        $this->assertModelExists($held);
        $this->assertNotNull($dueFile->fresh()->deleted_at);
        $this->assertNull($futureFile->fresh()->deleted_at);
        $this->assertSame(
            now()->addDays(5)->timestamp,
            $futureFile->fresh()->scheduled_deletion_at->timestamp,
        );
        Storage::disk('local')->assertMissing($oldTerminalFile->path);
        Storage::disk('local')->assertMissing($dueFile->path);
        Storage::disk('local')->assertExists($heldFile->path);
        Storage::disk('local')->assertExists($futureFile->path);

        $log = ActivityLog::query()->where('action', 'retention_applied')->sole();
        $this->assertSame(2, $log->changed_fields['files_deleted']);
        $this->assertSame(1, $log->changed_fields['appointments_deleted']);
        $this->assertSame(2, $log->changed_fields['file_schedules_created']);
        $this->assertSame(2, $log->changed_fields['appointment_retention_months']);
        $this->assertSame(10, $log->changed_fields['file_retention_days']);

        $this->artisan('appointments:apply-retention')
            ->expectsOutput('0 model dosyası silindi, 0 randevu kaydı temizlendi.')
            ->assertSuccessful();
        $this->assertSame(1, ActivityLog::query()->where('action', 'retention_applied')->count());
    }

    public function test_retention_command_is_registered_with_the_scheduler(): void
    {
        $this->artisan('schedule:list')
            ->expectsOutputToContain('appointments:apply-retention')
            ->assertSuccessful();
    }

    private function appointment(
        AppointmentStatus $status,
        CarbonInterface $startsAt,
        CarbonInterface $endsAt,
        ?CarbonInterface $retentionExemptUntil = null,
    ): Appointment {
        return Appointment::query()->create([
            'printer_id' => Printer::query()->where('code', 'P-01')->value('id'),
            'status' => $status,
            'first_name' => 'Saklama',
            'last_name' => 'Testi',
            'email' => 'saklama@example.com',
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'duration_minutes' => max(30, $startsAt->diffInMinutes($endsAt)),
            'filament_source' => FilamentSource::Own,
            'filament_material' => 'PLA',
            'filament_color' => 'Siyah',
            'tracking_token_hash' => hash('sha256', (string) $startsAt->timestamp.$status->value),
            'privacy_notice_version' => 'test',
            'privacy_notice_seen_at' => now(),
            'rules_accepted_at' => now(),
            'retention_exempt_until' => $retentionExemptUntil,
            'retention_exemption_reason' => $retentionExemptUntil ? 'Devam eden uyuşmazlık' : null,
        ]);
    }

    private function file(
        Appointment $appointment,
        string $path,
        ?CarbonInterface $scheduledDeletionAt = null,
    ): AppointmentFile {
        Storage::disk('local')->put($path, 'test model');

        return $appointment->files()->create([
            'disk' => 'local',
            'path' => $path,
            'original_name' => $path,
            'extension' => 'stl',
            'mime_type' => 'application/octet-stream',
            'size_bytes' => 10,
            'scheduled_deletion_at' => $scheduledDeletionAt,
        ]);
    }
}
