import AdminLayout from '@/components/AdminLayout';
import SettingsTabs from '@/components/SettingsTabs';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Printer = { id: number; code: string; name: string; status: string; description: string | null; appointmentCount: number };
type Blackout = { id: number; printerId: number | null; printer: string; kind: string; kindLabel: string; isAllDay: boolean; startsAt: string; endsAt: string; startsAtInput: string; endsAtInput: string; reason: string };
type StatusOption = { value: string; label: string };
type Props = { printers: Printer[]; blackouts: Blackout[]; statusOptions: StatusOption[]; scheduleKinds: StatusOption[] };

function PrinterCard({ printer, statusOptions }: { printer: Printer; statusOptions: StatusOption[] }) {
    const [name, setName] = useState(printer.name);
    const [status, setStatus] = useState(printer.status);
    const [description, setDescription] = useState(printer.description ?? '');
    const [processing, setProcessing] = useState(false);

    function save(event: FormEvent) {
        event.preventDefault();
        setProcessing(true);
        router.patch(`/yonetim/ayarlar/yazicilar/${printer.id}`, { name, status, description }, { preserveScroll: true, onFinish: () => setProcessing(false) });
    }

    return <form className="printer-settings-card" onSubmit={save}>
        <header><div><span>{printer.code}</span><strong>{printer.name}</strong></div><span className={`printer-state state-${status}`}>{statusOptions.find((option) => option.value === status)?.label}</span></header>
        <label className="field"><span>Yazıcı adı</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field"><span>Durum</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label className="field"><span>Açıklama</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <div className="printer-card-actions"><small>{printer.appointmentCount} randevu kaydı</small><button disabled={processing}>{processing ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</button></div>
    </form>;
}

function ScheduleItem({ item, printers, scheduleKinds }: { item: Blackout; printers: Printer[]; scheduleKinds: StatusOption[] }) {
    const [editing, setEditing] = useState(false);
    const [values, setValues] = useState({ printer_id: item.printerId?.toString() ?? '', kind: item.kind, is_all_day: item.isAllDay, starts_at: item.startsAtInput, ends_at: item.endsAtInput, reason: item.reason });
    const [processing, setProcessing] = useState(false);

    function save(event: FormEvent) {
        event.preventDefault();
        setProcessing(true);
        router.patch(`/yonetim/ayarlar/kapali-zamanlar/${item.id}`, values, { preserveScroll: true, onSuccess: () => setEditing(false), onFinish: () => setProcessing(false) });
    }

    if (!editing) return <article className="admin-panel"><div><span>{item.kindLabel} · {item.printer}</span><strong>{item.reason}</strong><small>{item.isAllDay ? 'Tüm gün' : `${item.startsAt} → ${item.endsAt}`}</small></div><div className="schedule-admin-actions"><button type="button" onClick={() => setEditing(true)}>Düzenle</button><button type="button" onClick={() => window.confirm('Takvim kaydını kaldırmak istiyor musunuz?') && router.delete(`/yonetim/ayarlar/kapali-zamanlar/${item.id}`, { preserveScroll: true })}>Kaldır</button></div></article>;

    return <form className="admin-panel schedule-edit-form" onSubmit={save}><div className="field-grid"><label className="field"><span>Yazıcı</span><select value={values.printer_id} onChange={(event) => setValues({ ...values, printer_id: event.target.value })}><option value="">Tüm atölye</option>{printers.map((printer) => <option value={printer.id} key={printer.id}>{printer.code} · {printer.name}</option>)}</select></label><label className="field"><span>Durum</span><select value={values.kind} onChange={(event) => setValues({ ...values, kind: event.target.value })}>{scheduleKinds.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}</select></label><label className="day-toggle full"><input type="checkbox" checked={values.is_all_day} onChange={(event) => setValues({ ...values, is_all_day: event.target.checked, starts_at: '', ends_at: '' })} /><span>Tüm gün</span></label><label className="field"><span>Başlangıç</span><input type={values.is_all_day ? 'date' : 'datetime-local'} value={values.starts_at} onChange={(event) => setValues({ ...values, starts_at: event.target.value })} required /></label><label className="field"><span>Bitiş</span><input type={values.is_all_day ? 'date' : 'datetime-local'} value={values.ends_at} onChange={(event) => setValues({ ...values, ends_at: event.target.value })} required /></label><label className="field full"><span>Not</span><input value={values.reason} onChange={(event) => setValues({ ...values, reason: event.target.value })} required /></label></div><div className="schedule-edit-actions"><button type="button" onClick={() => setEditing(false)}>Vazgeç</button><button disabled={processing}>{processing ? 'Kaydediliyor…' : 'Kaydet'}</button></div></form>;
}

export default function PrinterSettings({ printers, blackouts, statusOptions, scheduleKinds }: Props) {
    const [newPrinter, setNewPrinter] = useState({ code: '', name: '', status: 'inactive', description: '' });
    const [blackout, setBlackout] = useState({ printer_id: '', kind: 'busy', is_all_day: false, starts_at: '', ends_at: '', reason: '' });
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    function submitPrinter(event: FormEvent) {
        event.preventDefault(); setProcessing(true); setError('');
        router.post('/yonetim/ayarlar/yazicilar', newPrinter, {
            preserveScroll: true,
            onSuccess: () => setNewPrinter({ code: '', name: '', status: 'inactive', description: '' }),
            onError: (errors) => setError(Object.values(errors)[0] ?? 'Yazıcı eklenemedi.'),
            onFinish: () => setProcessing(false),
        });
    }

    function submitBlackout(event: FormEvent) {
        event.preventDefault(); setProcessing(true); setError('');
        router.post('/yonetim/ayarlar/kapali-zamanlar', { ...blackout, printer_id: blackout.printer_id || null }, {
            preserveScroll: true,
            onSuccess: () => setBlackout({ printer_id: '', kind: 'busy', is_all_day: false, starts_at: '', ends_at: '', reason: '' }),
            onError: (errors) => setError(Object.values(errors)[0] ?? 'Kapalı zaman eklenemedi.'),
            onFinish: () => setProcessing(false),
        });
    }

    return <AdminLayout>
        <Head title="Yazıcı ve Bakım Ayarları" />
        <header className="admin-title"><div><span className="booking-kicker">SİSTEM AYARLARI</span><h1>Yazıcılar ve takvim</h1><p>Cihaz durumlarını ve halka açık kullanım takvimini yönetin.</p></div></header>
        <SettingsTabs />
        {error && <div className="form-error" role="alert">{error}</div>}
        <section className="settings-section"><div className="settings-heading"><div><h2>Yazıcılar</h2><p>Bakımda veya pasif cihazlar halka açık sayfada kullanılamaz olarak gösterilir.</p></div></div><div className="printer-settings-grid">{printers.map((printer) => <PrinterCard printer={printer} statusOptions={statusOptions} key={printer.id} />)}</div></section>
        <section className="settings-grid-two">
            <form className="admin-panel settings-form" onSubmit={submitPrinter}><h2>Yeni yazıcı ekle</h2><div className="field-grid"><label className="field"><span>Kısa kod</span><input value={newPrinter.code} onChange={(event) => setNewPrinter({ ...newPrinter, code: event.target.value })} placeholder="P-03" required /></label><label className="field"><span>Durum</span><select value={newPrinter.status} onChange={(event) => setNewPrinter({ ...newPrinter, status: event.target.value })}>{statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label><label className="field full"><span>Yazıcı adı</span><input value={newPrinter.name} onChange={(event) => setNewPrinter({ ...newPrinter, name: event.target.value })} required /></label><label className="field full"><span>Açıklama</span><textarea rows={3} value={newPrinter.description} onChange={(event) => setNewPrinter({ ...newPrinter, description: event.target.value })} /></label></div><button className="settings-submit" disabled={processing}>Yazıcı ekle</button></form>
            <form className="admin-panel settings-form" onSubmit={submitBlackout}><h2>Takvime zaman ekle</h2><div className="field-grid"><label className="field"><span>Kapsam</span><select value={blackout.printer_id} onChange={(event) => setBlackout({ ...blackout, printer_id: event.target.value })}><option value="">Tüm atölye</option>{printers.map((printer) => <option value={printer.id} key={printer.id}>{printer.code} · {printer.name}</option>)}</select></label><label className="field"><span>Durum</span><select value={blackout.kind} onChange={(event) => setBlackout({ ...blackout, kind: event.target.value })}>{scheduleKinds.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}</select></label><label className="day-toggle full"><input type="checkbox" checked={blackout.is_all_day} onChange={(event) => setBlackout({ ...blackout, is_all_day: event.target.checked, starts_at: '', ends_at: '' })} /><span>Tüm gün veya birden fazla gün</span></label><label className="field"><span>Başlangıç</span><input type={blackout.is_all_day ? 'date' : 'datetime-local'} value={blackout.starts_at} onChange={(event) => setBlackout({ ...blackout, starts_at: event.target.value })} required /></label><label className="field"><span>Bitiş</span><input type={blackout.is_all_day ? 'date' : 'datetime-local'} value={blackout.ends_at} onChange={(event) => setBlackout({ ...blackout, ends_at: event.target.value })} required /></label><label className="field full"><span>Herkese açık not</span><input value={blackout.reason} onChange={(event) => setBlackout({ ...blackout, reason: event.target.value })} placeholder="Baskı sürüyor, planlı bakım…" required /></label></div><button className="settings-submit" disabled={processing}>Takvime ekle</button></form>
        </section>
        <section className="settings-section"><div className="settings-heading"><div><h2>Yaklaşan takvim kayıtları</h2><p>Yalnızca cihaz, durum, saat ve herkese açık not yayımlanır.</p></div></div><div className="blackout-list">{blackouts.map((item) => <ScheduleItem item={item} printers={printers} scheduleKinds={scheduleKinds} key={item.id} />)}{blackouts.length === 0 && <div className="admin-panel settings-empty">Yaklaşan takvim kaydı bulunmuyor.</div>}</div></section>
    </AdminLayout>;
}
