<?php

namespace App\Mail;

use App\Models\Appointment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AppointmentStatusMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Appointment $appointment) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->appointment->status->value === 'approved'
            ? '3D yazıcı randevunuz onaylandı'
            : '3D yazıcı randevunuzla ilgili güncelleme');
    }

    public function content(): Content
    {
        return new Content(view: 'mail.appointment-status');
    }
}
