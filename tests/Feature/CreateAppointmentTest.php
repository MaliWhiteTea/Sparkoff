<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Mail\AppointmentVerificationMail;
use App\Models\Appointment;
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

        $response = $this->post(route('booking.store'), $this->validPayload());

        $response->assertRedirect(route('booking.create'));
        $response->assertSessionHas('booking_submitted');

        $appointment = Appointment::query()->with(['files', 'statusHistory'])->sole();

        $this->assertSame(AppointmentStatus::PendingVerification, $appointment->status);
        $this->assertSame('test@example.com', $appointment->email);
        $this->assertCount(1, $appointment->files);
        $this->assertCount(1, $appointment->statusHistory);
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
            'date' => $date->format('Y-m-d'),
            'start_time' => '10:00',
            'duration_minutes' => 120,
            'file' => UploadedFile::fake()->createWithContent(
                'model.stl',
                "solid model\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid model\n",
            ),
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
