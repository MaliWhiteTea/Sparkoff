import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

type HistoryItem = {
    status: string;
    label: string;
    note: string | null;
    date: string;
};

type Appointment = {
    publicId: string;
    status: string;
    statusLabel: string;
    printer: string;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    filament: string;
    fileName: string | null;
    canCancel: boolean;
    history: HistoryItem[];
};

export default function TrackAppointment({ appointment, cancelUrl }: { appointment: Appointment; cancelUrl: string }) {
    const [canceling, setCanceling] = useState(false);

    function cancelAppointment() {
        if (!window.confirm('Randevunuzu iptal etmek istediğinizden emin misiniz?')) return;

        setCanceling(true);
        router.post(cancelUrl, {}, { onFinish: () => setCanceling(false) });
    }

    return (
        <main className="tracking-page">
            <Head title="Randevu Takibi" />
            <header className="tracking-header">
                <Link href="/" className="tracking-brand">
                    <img src="/logo.jpg" alt="Sparkoff logosu" />
                    <span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span>
                </Link>
                <span className="tracking-reference">Randevu: {appointment.publicId.slice(0, 8).toUpperCase()}</span>
            </header>

            <div className="tracking-shell">
                <section className="tracking-main">
                    <span className="booking-kicker">RANDEVU TAKİBİ</span>
                    <h1>{appointment.statusLabel}</h1>
                    <p className="tracking-intro">Randevunuzla ilgili güncel bilgiler ve işlem geçmişi aşağıda yer alıyor.</p>

                    <div className={`current-status status-${appointment.status}`}>
                        <span className="status-dot" />
                        <div><small>GÜNCEL DURUM</small><strong>{appointment.statusLabel}</strong></div>
                    </div>

                    <div className="timeline">
                        {appointment.history.map((item, index) => (
                            <article key={`${item.status}-${index}`}>
                                <span className="timeline-dot" />
                                <div><strong>{item.label}</strong><p>{item.note}</p><small>{item.date}</small></div>
                            </article>
                        ))}
                    </div>
                </section>

                <aside className="tracking-details">
                    <h2>Randevu ayrıntıları</h2>
                    <dl>
                        <div><dt>Yazıcı</dt><dd>{appointment.printer}</dd></div>
                        <div><dt>Başlangıç</dt><dd>{appointment.startsAt}</dd></div>
                        <div><dt>Tahmini bitiş</dt><dd>{appointment.endsAt}</dd></div>
                        <div><dt>Baskı süresi</dt><dd>{appointment.durationMinutes} dakika</dd></div>
                        <div><dt>Filament</dt><dd>{appointment.filament}</dd></div>
                        <div><dt>Dosya</dt><dd>{appointment.fileName}</dd></div>
                    </dl>
                    {appointment.canCancel && (
                        <button className="cancel-button" type="button" disabled={canceling} onClick={cancelAppointment}>
                            {canceling ? 'İptal ediliyor…' : 'Randevuyu iptal et'}
                        </button>
                    )}
                    <p className="tracking-security">Bu sayfanın bağlantısı randevunuza özel ve gizlidir. Başkalarıyla paylaşmayın.</p>
                </aside>
            </div>
        </main>
    );
}
