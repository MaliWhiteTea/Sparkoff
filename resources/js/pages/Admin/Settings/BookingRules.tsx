import AdminLayout from '@/components/AdminLayout';
import SettingsTabs from '@/components/SettingsTabs';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Day = { weekday: number; name: string; isOpen: boolean; opensAt: string; latestStartAt: string };
type Props = {
    hours: Day[];
    settings: { slotMinutes: number; maximumDurationHours: number; verificationHoldMinutes: number; maximumFileSizeMb: number; allowedExtensions: string[] };
    supportedExtensions: string[];
};

export default function BookingRules({ hours: initialHours, settings, supportedExtensions }: Props) {
    const [hours, setHours] = useState(initialHours);
    const [values, setValues] = useState(settings);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    function updateDay(index: number, changes: Partial<Day>) {
        setHours((current) => current.map((day, dayIndex) => dayIndex === index ? { ...day, ...changes } : day));
    }

    function toggleExtension(extension: string) {
        setValues((current) => ({
            ...current,
            allowedExtensions: current.allowedExtensions.includes(extension)
                ? current.allowedExtensions.filter((item) => item !== extension)
                : [...current.allowedExtensions, extension],
        }));
    }

    function submit(event: FormEvent) {
        event.preventDefault();
        setProcessing(true);
        setError('');
        router.put('/yonetim/ayarlar/randevu-kurallari', {
            hours: hours.map((day) => ({ weekday: day.weekday, is_open: day.isOpen, opens_at: day.opensAt, latest_start_at: day.latestStartAt })),
            slot_minutes: values.slotMinutes,
            maximum_duration_hours: values.maximumDurationHours,
            verification_hold_minutes: values.verificationHoldMinutes,
            maximum_file_size_mb: values.maximumFileSizeMb,
            allowed_extensions: values.allowedExtensions,
        }, {
            preserveScroll: true,
            onError: (errors) => setError(Object.values(errors)[0] ?? 'Ayarlar kaydedilemedi.'),
            onFinish: () => setProcessing(false),
        });
    }

    return <AdminLayout>
        <Head title="Randevu Kuralları" />
        <header className="admin-title"><div><span className="booking-kicker">SİSTEM AYARLARI</span><h1>Randevu kuralları</h1><p>Çalışma düzenini, süreleri ve dosya yükleme sınırlarını yönetin.</p></div></header>
        <SettingsTabs />
        <form onSubmit={submit}>
            {error && <div className="form-error settings-error" role="alert">{error}</div>}
            <section className="admin-panel rules-panel"><div className="settings-heading"><div><h2>Çalışma günleri ve saatleri</h2><p>Saatler baskının bitişini değil, başlayabileceği aralığı belirler.</p></div></div>
                <div className="hours-list">{hours.map((day, index) => <article className={!day.isOpen ? 'closed' : ''} key={day.weekday}>
                    <label className="day-toggle"><input type="checkbox" checked={day.isOpen} onChange={(event) => updateDay(index, { isOpen: event.target.checked })} /><span>{day.name}</span><small>{day.isOpen ? 'Açık' : 'Kapalı'}</small></label>
                    <label className="field"><span>İlk başlangıç</span><input type="time" disabled={!day.isOpen} value={day.opensAt} onChange={(event) => updateDay(index, { opensAt: event.target.value })} /></label>
                    <label className="field"><span>En geç başlangıç</span><input type="time" disabled={!day.isOpen} value={day.latestStartAt} onChange={(event) => updateDay(index, { latestStartAt: event.target.value })} /></label>
                </article>)}</div>
            </section>
            <div className="rules-settings-grid">
                <section className="admin-panel rules-panel"><div className="settings-heading"><div><h2>Süre ve doğrulama</h2><p>Randevu seçiminde kullanılan temel zaman kuralları.</p></div></div><div className="field-grid">
                    <label className="field"><span>Zaman adımı</span><select value={values.slotMinutes} onChange={(event) => setValues({ ...values, slotMinutes: Number(event.target.value) })}><option value={15}>15 dakika</option><option value={30}>30 dakika</option><option value={60}>60 dakika</option></select></label>
                    <label className="field"><span>Maksimum baskı süresi</span><input type="number" min={1} max={168} value={values.maximumDurationHours} onChange={(event) => setValues({ ...values, maximumDurationHours: Number(event.target.value) })} /><small>Saat cinsinden; baskı bitişi çalışma saatini aşabilir.</small></label>
                    <label className="field full"><span>E-posta doğrulama süresi</span><input type="number" min={10} max={1440} value={values.verificationHoldMinutes} onChange={(event) => setValues({ ...values, verificationHoldMinutes: Number(event.target.value) })} /><small>Dakika cinsinden; doğrulanmayan talep bu süre boyunca saati tutar.</small></label>
                </div></section>
                <section className="admin-panel rules-panel"><div className="settings-heading"><div><h2>Dosya yükleme</h2><p>Kullanıcıların yükleyebileceği üretim dosyalarını sınırlayın.</p></div></div>
                    <label className="field"><span>Maksimum dosya boyutu</span><input type="number" min={1} max={500} value={values.maximumFileSizeMb} onChange={(event) => setValues({ ...values, maximumFileSizeMb: Number(event.target.value) })} /><small>MB cinsinden. cPanel PHP limiti de en az bu değer kadar olmalıdır.</small></label>
                    <div className="extension-options"><span>İzin verilen formatlar</span><div>{supportedExtensions.map((extension) => <label className={values.allowedExtensions.includes(extension) ? 'selected' : ''} key={extension}><input type="checkbox" checked={values.allowedExtensions.includes(extension)} onChange={() => toggleExtension(extension)} />.{extension.toUpperCase()}</label>)}</div></div>
                </section>
            </div>
            <div className="settings-save-bar"><div><strong>Değişiklikler tüm randevu akışına uygulanır.</strong><span>Mevcut randevular değiştirilmez.</span></div><button disabled={processing}>{processing ? 'Kaydediliyor…' : 'Randevu kurallarını kaydet'}</button></div>
        </form>
    </AdminLayout>;
}
