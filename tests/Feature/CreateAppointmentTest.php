<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Models\Appointment;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
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

        $response = $this->post(route('booking.store'), $this->validPayload());

        $response->assertRedirect(route('booking.create'));
        $response->assertSessionHas('booking_submitted');

        $appointment = Appointment::query()->with(['files', 'statusHistory'])->sole();

        $this->assertSame(AppointmentStatus::PendingVerification, $appointment->status);
        $this->assertSame('test@example.com', $appointment->email);
        $this->assertCount(1, $appointment->files);
        $this->assertCount(1, $appointment->statusHistory);
        Storage::disk('local')->assertExists($appointment->files->first()->path);
    }

    public function test_a_second_request_cannot_reserve_an_overlapping_time(): void
    {
        Storage::fake('local');
        $payload = $this->validPayload();

        $this->post(route('booking.store'), $payload)->assertSessionHasNoErrors();

        $secondPayload = $this->validPayload();
        $this->post(route('booking.store'), $secondPayload)
            ->assertSessionHasErrors('date');

        $this->assertDatabaseCount('appointments', 1);
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

    private function validPayload(): array
    {
        $date = CarbonImmutable::now('Europe/Istanbul')->next(CarbonImmutable::MONDAY);

        return [
            'date' => $date->format('Y-m-d'),
            'start_time' => '10:00',
            'duration_minutes' => 120,
            'file' => UploadedFile::fake()->create('model.stl', 100, 'application/octet-stream'),
            'filament_source' => 'workshop',
            'material' => 'PLA',
            'color' => 'Siyah',
            'first_name' => 'Test',
            'last_name' => 'Kullanıcı',
            'email' => 'TEST@example.com',
            'phone' => '0555 000 00 00',
            'note' => 'Test baskısı',
            'rules_accepted' => true,
            'privacy_notice_seen' => true,
        ];
    }
}
