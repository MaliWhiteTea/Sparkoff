import AdminLayout from '@/components/AdminLayout';
import SettingsTabs from '@/components/SettingsTabs';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Day = { weekday: number; name: string; isOpen: boolean; opensAt: string; latestStartAt: string };
type Contact = { phone: string; whatsapp: string; email: string; hours: string };
type Props = { contact: Contact; hours: Day[] };

export default function WorkshopSettings({ contact: initialContact, hours: initialHours }: Props) {
    const [contact, setContact] = useState(initialContact);
    const [hours, setHours] = useState(initialHours);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    function updateDay(index: number, changes: Partial<Day>) {
        setHours((current) => current.map((day, dayIndex) => dayIndex === index ? { ...day, ...changes } : day));
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        setProcessing(true);
        setError('');
        router.put('/yonetim/ayarlar/atolye', {
            phone: contact.phone,
            whatsapp: contact.whatsapp,
            email: contact.email,
            contact_hours: contact.hours,
            hours: hours.map((day) => ({ weekday: day.weekday, is_open: day.isOpen, opens_at: day.opensAt, latest_start_at: day.latestStartAt })),
        }, {
            preserveScroll: true,
            onError: (errors) => setError(Object.values(errors)[0] ?? 'Ayarlar kaydedilemedi.'),
            onFinish: () => setProcessing(false),
        });
    }

    return <AdminLayout>
        <Head title="Atölye ve İletişim Ayarları" />
        <header className="admin-title"><div><span className="booking-kicker">SİSTEM AYARLARI</span><h1>Atölye ve iletişim</h1><p>Halka açık iletişim kanallarını ve yazıcı kullanım başlangıç saatlerini yönetin.</p></div></header>
        <SettingsTabs />
        <form onSubmit={submit}>
            {error && <div className="form-error settings-error" role="alert">{error}</div>}
            <section className="admin-panel rules-panel"><div className="settings-heading"><div><h2>İletişim bilgileri</h2><p>Boş bırakılan alanlar sitede gösterilmez. WhatsApp için ülke koduyla numara girin.</p></div></div><div className="field-grid">
                <label className="field"><span>Telefon</span><input inputMode="tel" value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} placeholder="+90 5xx xxx xx xx" /></label>
                <label className="field"><span>WhatsApp</span><input inputMode="tel" value={contact.whatsapp} onChange={(event) => setContact({ ...contact, whatsapp: event.target.value })} placeholder="+90 5xx xxx xx xx" /></label>
                <label className="field"><span>E-posta</span><input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} placeholder="atolye@example.com" /></label>
                <label className="field"><span>Ulaşılabilir saatler</span><input value={contact.hours} onChange={(event) => setContact({ ...contact, hours: event.target.value })} placeholder="Hafta içi 10.00–17.00" /></label>
            </div></section>
            <section className="admin-panel rules-panel"><div className="settings-heading"><div><h2>Yazıcı kullanım saatleri</h2><p>Saatler baskının bitişini değil, başlayabileceği aralığı belirtir.</p></div></div><div className="hours-list">{hours.map((day, index) => <article className={!day.isOpen ? 'closed' : ''} key={day.weekday}>
                <label className="day-toggle"><input type="checkbox" checked={day.isOpen} onChange={(event) => updateDay(index, { isOpen: event.target.checked })} /><span>{day.name}</span><small>{day.isOpen ? 'Açık' : 'Kapalı'}</small></label>
                <label className="field"><span>İlk başlangıç</span><input type="time" disabled={!day.isOpen} value={day.opensAt} onChange={(event) => updateDay(index, { opensAt: event.target.value })} /></label>
                <label className="field"><span>En geç başlangıç</span><input type="time" disabled={!day.isOpen} value={day.latestStartAt} onChange={(event) => updateDay(index, { latestStartAt: event.target.value })} /></label>
            </article>)}</div></section>
            <div className="settings-save-bar"><div><strong>Değişiklikler halka açık sayfalara hemen yansır.</strong><span>İletişim bilgilerini yayımlamadan önce doğrulayın.</span></div><button disabled={processing}>{processing ? 'Kaydediliyor…' : 'Ayarları kaydet'}</button></div>
        </form>
    </AdminLayout>;
}
