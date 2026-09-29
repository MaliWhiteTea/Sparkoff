import AdminLayout from '@/components/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

type Appointment = {
    publicId: string; name: string; email: string; phone: string; status: string; statusLabel: string; printer: string;
    startsAt: string; endsAt: string; durationMinutes: number; filament: string; note: string | null;
    actions: { status: string; label: string; requiresNote: boolean; tone: 'primary' | 'danger' }[];
    files: { id: number; name: string; size: number; downloadUrl: string }[];
    history: { label: string; note: string | null; actor: string; date: string }[];
};

export default function AppointmentShow({ appointment }: { appointment: Appointment }) {
    const [note, setNote] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    function updateStatus(action: Appointment['actions'][number]) {
        if (action.requiresNote && !note.trim()) return setError(`${action.label} işlemi için yönetici notu yazmalısınız.`);
        if (!window.confirm(`“${action.label}” işlemini uygulamak istiyor musunuz?`)) return;
        setProcessing(true);
        setError('');
        router.patch(`/yonetim/randevular/${appointment.publicId}/durum`, { status: action.status, note }, {
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
                    {appointment.actions.length > 0 && <section className="admin-panel admin-review"><h2>Sonraki işlem</h2><label className="field"><span>Yönetici notu</span><textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Kullanıcıya iletilecek açıklama veya operasyon notu" /></label><p className="admin-review-hint">Değişiklik, red ve başarısız baskı işlemlerinde not zorunludur.</p>{error && <div className="form-error">{error}</div>}<div>{appointment.actions.map((action) => <button disabled={processing} className={action.tone === 'danger' ? 'admin-reject' : 'admin-approve'} onClick={() => updateStatus(action)} key={action.status}>{action.label}</button>)}</div></section>}
                    <section className="admin-panel admin-history"><h2>İşlem geçmişi</h2>{appointment.history.map((item, index) => <article key={index}><i /><div><strong>{item.label}</strong><p>{item.note}</p><small>{item.actor} · {item.date}</small></div></article>)}</section>
                </aside>
            </div>
        </AdminLayout>
    );
}
