<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\PrinterStatus;
use App\Mail\AppointmentVerificationMail;
use App\Models\Appointment;
use App\Models\Filament;
use App\Models\Printer;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CreateAppointmentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed();
    }

    public function test_a_valid_request_creates_an_appointment_and_stores_its_file_privately(): void
    {
        Storage::fake('local');
        Mail::fake();

        $payload = $this->validPayload();
        $payload['phone'] = '0555 000 00 00';
        $payload['note'] = 'Bu iki alan sunucu tarafından kaydedilmemeli.';

        $requestStartedAt = now();
        $response = $this->post(route('booking.store'), $payload);

        $response->assertRedirect(route('booking.create'));
        $response->assertSessionHas('booking_submitted');

        $appointment = Appointment::query()->with(['files', 'statusHistory'])->sole();

        $this->assertSame(AppointmentStatus::PendingVerification, $appointment->status);
        $this->assertSame('test@example.com', $appointment->email);
        $this->assertNull($appointment->phone);
        $this->assertNull($appointment->user_note);
        $this->assertCount(1, $appointment->files);
        $this->assertCount(1, $appointment->statusHistory);
        $scheduledDeletionAt = $appointment->files->first()->scheduled_deletion_at->timestamp;
        $this->assertGreaterThanOrEqual($requestStartedAt->copy()->addDays(30)->timestamp, $scheduledDeletionAt);
        $this->assertLessThanOrEqual(now()->addDays(30)->timestamp, $scheduledDeletionAt);
        Storage::disk('local')->assertExists($appointment->files->first()->path);
        Mail::assertSent(AppointmentVerificationMail::class, fn ($mail) => $mail->hasTo('test@example.com'));
    }

    public function test_a_second_request_cannot_reserve_an_overlapping_time(): void
    {
        Storage::fake('local');
        Mail::fake();
        $payload = $this->validPayload();

        $this->post(route('booking.store'), $payload)->assertSessionHasNoErrors();

        $secondPayload = $this->validPayload();
        $this->post(route('booking.store'), $secondPayload)
            ->assertSessionHasErrors('date');

        $this->assertDatabaseCount('appointments', 1);
    }

    public function test_a_request_is_saved_for_the_selected_active_printer(): void
    {
        Storage::fake('local');
        Mail::fake();
        $secondPrinter = Printer::query()->where('code', 'P-02')->firstOrFail();
        $secondPrinter->update(['status' => PrinterStatus::Active]);
        $payload = $this->validPayload();
        $payload['printer_id'] = $secondPrinter->id;

        $this->post(route('booking.store'), $payload)->assertSessionHasNoErrors();

        $this->assertDatabaseHas('appointments', ['printer_id' => $secondPrinter->id]);
    }

    public function test_a_printer_that_becomes_busy_is_rejected_without_reassignment(): void
    {
        Storage::fake('local');
        Mail::fake();
        $firstPrinter = Printer::query()->where('code', 'P-01')->firstOrFail();
        $secondPrinter = Printer::query()->where('code', 'P-02')->firstOrFail();
        $secondPrinter->update(['status' => PrinterStatus::Active]);

        $firstPayload = $this->validPayload();
        $firstPayload['printer_id'] = $secondPrinter->id;
        $this->post(route('booking.store'), $firstPayload)->assertSessionHasNoErrors();

        $secondPayload = $this->validPayload();
        $secondPayload['printer_id'] = $secondPrinter->id;
        $this->post(route('booking.store'), $secondPayload)->assertSessionHasErrors('date');

        $this->assertDatabaseCount('appointments', 1);
        $this->assertDatabaseMissing('appointments', ['printer_id' => $firstPrinter->id]);
    }

    public function test_an_inactive_or_unknown_printer_cannot_be_submitted(): void
    {
        Storage::fake('local');
        $maintenancePrinter = Printer::query()->where('code', 'P-02')->firstOrFail();
        $payload = $this->validPayload();
        $payload['printer_id'] = $maintenancePrinter->id;

        $this->post(route('booking.store'), $payload)->assertSessionHasErrors('printer_id');

        $payload['printer_id'] = 999999;
        $this->post(route('booking.store'), $payload)->assertSessionHasErrors('printer_id');
        $this->assertDatabaseCount('appointments', 0);
    }

    public function test_an_unsupported_file_extension_is_rejected(): void
    {
        Storage::fake('local');
        $payload = $this->validPayload();
        $payload['file'] = UploadedFile::fake()->create('zararli.exe', 10, 'application/octet-stream');

        $this->post(route('booking.store'), $payload)
            ->assertSessionHasErrors('file');

        $this->assertDatabaseCount('appointments', 0);
    }

    public function test_a_file_with_an_allowed_extension_but_invalid_content_is_rejected(): void
    {
        Storage::fake('local');
        $payload = $this->validPayload();
        $payload['file'] = UploadedFile::fake()->createWithContent('zararli.stl', '<?php echo "zararli";');

        $this->post(route('booking.store'), $payload)
            ->assertSessionHasErrors('file');

        $this->assertDatabaseCount('appointments', 0);
    }

    public function test_a_valid_obj_file_is_accepted(): void
    {
        Storage::fake('local');
        Mail::fake();
        $payload = $this->validPayload();
        $payload['file'] = UploadedFile::fake()->createWithContent(
            'model.obj',
            "# Sparkoff test model\nv 0.0 0.0 0.0\nv 1.0 0.0 0.0\nv 0.0 1.0 0.0\nf 1 2 3\n",
        );

        $this->post(route('booking.store'), $payload)->assertSessionHasNoErrors();

        $this->assertDatabaseHas('appointment_files', [
            'original_name' => 'model.obj',
            'extension' => 'obj',
        ]);
    }

    public function test_appointment_creation_is_rate_limited(): void
    {
        Storage::fake('local');
        Mail::fake();

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $payload = $this->validPayload();
            $payload['start_time'] = sprintf('%02d:00', 8 + $attempt);
            $this->post(route('booking.store'), $payload);
        }

        $this->post(route('booking.store'), $this->validPayload())->assertTooManyRequests();
    }

    private function validPayload(): array
    {
        $date = CarbonImmutable::now('Europe/Istanbul')->next(CarbonImmutable::MONDAY);

        return [
            'printer_id' => Printer::query()->where('code', 'P-01')->value('id'),
            'date' => $date->format('Y-m-d'),
            'start_time' => '10:00',
            'duration_minutes' => 120,
            'file' => UploadedFile::fake()->createWithContent(
                'model.stl',
                "solid model\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid model\n",
            ),
            'filament_source' => 'workshop',
            'filament_id' => Filament::query()->where('is_available', true)->value('id'),
            'material' => 'PLA',
            'color' => 'Siyah',
            'first_name' => 'Test',
            'last_name' => 'Kullanıcı',
            'email' => 'TEST@example.com',
            'rules_accepted' => true,
            'privacy_notice_seen' => true,
        ];
    }
}
