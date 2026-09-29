<?php

namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentTrackingMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment,
        public string $trackingToken,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: '3D yazıcı randevu talebiniz alındı');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.appointment-tracking',
            with: [
                'trackingUrl' => route('booking.track', [
                    'publicId' => $this->appointment->public_id,
                    'token' => $this->trackingToken,
                ]),
            ],
        );
    }
}
