<?php

namespace App\Mail;

use App\Enums\AppointmentStatus;
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
        return new Envelope(subject: match ($this->appointment->status) {
            AppointmentStatus::Approved => '3D yazıcı randevunuz onaylandı',
            AppointmentStatus::ChangeRequested => '3D yazıcı randevunuz için değişiklik gerekiyor',
            AppointmentStatus::Rejected => '3D yazıcı randevu talebiniz sonuçlandı',
            AppointmentStatus::Ready => '3D baskınız için hazırlık tamamlandı',
            AppointmentStatus::Printing => '3D baskınız başladı',
            AppointmentStatus::Completed => '3D baskınız tamamlandı',
            AppointmentStatus::Failed => '3D baskınızla ilgili önemli güncelleme',
            default => '3D yazıcı randevunuzla ilgili güncelleme',
        });
    }

    public function content(): Content
    {
        return new Content(view: 'mail.appointment-status', with: [
            'title' => match ($this->appointment->status) {
                AppointmentStatus::Approved => 'Randevunuz onaylandı',
                AppointmentStatus::ChangeRequested => 'Randevunuz için değişiklik gerekiyor',
                AppointmentStatus::Rejected => 'Randevu talebiniz reddedildi',
                AppointmentStatus::Ready => 'Baskınız hazırlanmaya hazır',
                AppointmentStatus::Printing => 'Baskınız başladı',
                AppointmentStatus::Completed => 'Baskınız tamamlandı',
                AppointmentStatus::Failed => 'Baskınız tamamlanamadı',
                default => 'Randevunuz güncellendi',
            },
            'message' => match ($this->appointment->status) {
                AppointmentStatus::ChangeRequested => 'Randevu talebinizin ilerleyebilmesi için yönetici notundaki değişikliği yapmanız gerekiyor.',
                AppointmentStatus::Ready => 'Dosyanız ve yazıcı hazırlıkları tamamlandı.',
                AppointmentStatus::Printing => 'Dosyanız 3D yazıcıda basılmaya başladı.',
                AppointmentStatus::Completed => '3D baskı işleminiz başarıyla tamamlandı.',
                AppointmentStatus::Failed => '3D baskı işlemi tamamlanamadı. Ayrıntılar için yönetici notunu inceleyin.',
                default => 'Randevu talebiniz yönetici tarafından güncellendi.',
            },
        ]);
    }
}
