import AdminLayout from '@/components/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

type Appointment = {
    publicId: string; name: string; email: string; phone: string; status: string; statusLabel: string; printer: string;
    startsAt: string; endsAt: string; durationMinutes: number; filament: string; note: string | null; canReview: boolean;
    files: { id: number; name: string; size: number; downloadUrl: string }[];
    history: { label: string; note: string | null; actor: string; date: string }[];
};

export default function AppointmentShow({ appointment }: { appointment: Appointment }) {
    const [note, setNote] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    function updateStatus(status: 'approved' | 'rejected') {
        if (status === 'rejected' && !note.trim()) return setError('Reddetme nedenini yazmalısınız.');
        if (!window.confirm(status === 'approved' ? 'Randevuyu onaylamak istiyor musunuz?' : 'Randevuyu reddetmek istiyor musunuz?')) return;
        setProcessing(true);
        setError('');
        router.patch(`/yonetim/randevular/${appointment.publicId}/durum`, { status, note }, {
            preserveScroll: true,
            onError: (errors) => setError(Object.values(errors)[0] ?? 'İşlem tamamlanamadı.'),
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <AdminLayout>
            <Head title={`Randevu · ${appointment.name}`} />
            <Link className="admin-back" href="/yonetim/randevular">← Randevulara dön</Link>
            <header className="admin-title detail"><div><span className="booking-kicker">{appointment.publicId.slice(0, 8).toUpperCase()}</span><h1>{appointment.name}</h1><p>{appointment.email} · {appointment.phone}</p></div><span className={`admin-status status-${appointment.status}`}>{appointment.statusLabel}</span></header>
            <div className="admin-detail-grid">
                <section className="admin-panel admin-detail-card"><h2>Baskı ayrıntıları</h2><dl>
                    <div><dt>Başlangıç</dt><dd>{appointment.startsAt}</dd></div><div><dt>Tahmini bitiş</dt><dd>{appointment.endsAt}</dd></div><div><dt>Süre</dt><dd>{appointment.durationMinutes} dakika</dd></div><div><dt>Yazıcı</dt><dd>{appointment.printer}</dd></div><div><dt>Filament</dt><dd>{appointment.filament}</dd></div><div><dt>Kullanıcı notu</dt><dd>{appointment.note || 'Not eklenmemiş.'}</dd></div>
                </dl><h2>Dosyalar</h2>{appointment.files.map((file) => <a className="admin-file" href={file.downloadUrl} key={file.id}><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span>Güvenli indir ↓</a>)}</section>
                <aside>
                    {appointment.canReview && <section className="admin-panel admin-review"><h2>Randevuyu değerlendir</h2><label className="field"><span>Yönetici notu</span><textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Red nedeni veya kullanıcıya iletilecek not" /></label>{error && <div className="form-error">{error}</div>}<div><button disabled={processing} className="admin-approve" onClick={() => updateStatus('approved')}>Onayla</button><button disabled={processing} className="admin-reject" onClick={() => updateStatus('rejected')}>Reddet</button></div></section>}
                    <section className="admin-panel admin-history"><h2>İşlem geçmişi</h2>{appointment.history.map((item, index) => <article key={index}><i /><div><strong>{item.label}</strong><p>{item.note}</p><small>{item.actor} · {item.date}</small></div></article>)}</section>
                </aside>
            </div>
        </AdminLayout>
    );
}
