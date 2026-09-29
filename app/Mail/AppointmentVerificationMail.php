<?php

namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentVerificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Appointment $appointment,
        public string $verificationToken,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: '3D yazıcı randevunuzu doğrulayın');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.appointment-verification',
            with: [
                'verificationUrl' => route('booking.verify', [
                    'publicId' => $this->appointment->public_id,
                    'token' => $this->verificationToken,
                ]),
            ],
        );
    }
}
