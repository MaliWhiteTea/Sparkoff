import AdminLayout from '@/components/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Announcement = { id: number; title: string; body: string; type: string; placement: string; isPublished: boolean; startsAt: string | null; endsAt: string | null };
type Values = { title: string; body: string; type: string; placement: string; is_published: boolean; starts_at: string; ends_at: string };
const empty: Values = { title: '', body: '', type: 'info', placement: 'all', is_published: true, starts_at: '', ends_at: '' };

function Fields({ values, setValues }: { values: Values; setValues: (values: Values) => void }) {
    return <div className="field-grid"><label className="field full"><span>Başlık</span><input value={values.title} maxLength={120} onChange={(event) => setValues({ ...values, title: event.target.value })} required /></label><label className="field full"><span>Metin</span><textarea rows={3} value={values.body} maxLength={1000} onChange={(event) => setValues({ ...values, body: event.target.value })} required /></label><label className="field"><span>Tür</span><select value={values.type} onChange={(event) => setValues({ ...values, type: event.target.value })}><option value="info">Bilgi</option><option value="warning">Uyarı</option><option value="maintenance">Bakım</option></select></label><label className="field"><span>Gösterim yeri</span><select value={values.placement} onChange={(event) => setValues({ ...values, placement: event.target.value })}><option value="all">Tüm sayfalar</option><option value="home">Yalnızca ana sayfa</option><option value="printers">Yalnızca 3D yazıcılar</option></select></label><label className="field"><span>Başlangıç (isteğe bağlı)</span><input type="datetime-local" value={values.starts_at} onChange={(event) => setValues({ ...values, starts_at: event.target.value })} /></label><label className="field"><span>Bitiş (isteğe bağlı)</span><input type="datetime-local" value={values.ends_at} onChange={(event) => setValues({ ...values, ends_at: event.target.value })} /></label><label className="day-toggle full"><input type="checkbox" checked={values.is_published} onChange={(event) => setValues({ ...values, is_published: event.target.checked })} /><span>Yayınla</span><small>Kişisel bilgi yazmayın.</small></label></div>;
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
    const [editing, setEditing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [values, setValues] = useState<Values>({ title: announcement.title, body: announcement.body, type: announcement.type, placement: announcement.placement, is_published: announcement.isPublished, starts_at: announcement.startsAt ?? '', ends_at: announcement.endsAt ?? '' });
    function save(event: FormEvent) { event.preventDefault(); setProcessing(true); router.patch(`/yonetim/duyurular/${announcement.id}`, values, { preserveScroll: true, onSuccess: () => setEditing(false), onFinish: () => setProcessing(false) }); }

    if (editing) return <form className="admin-panel announcement-form" onSubmit={save}><Fields values={values} setValues={setValues} /><div className="schedule-edit-actions"><button type="button" onClick={() => setEditing(false)}>Vazgeç</button><button disabled={processing}>Kaydet</button></div></form>;
    return <article className="admin-panel announcement-admin-card"><div><span>{announcement.type} · {announcement.placement}</span><h3>{announcement.title}</h3><p>{announcement.body}</p><small>{announcement.isPublished ? 'Yayında' : 'Gizli'}</small></div><div><button type="button" onClick={() => setEditing(true)}>Düzenle</button><button type="button" className="danger" onClick={() => window.confirm('Duyuru kaldırılsın mı?') && router.delete(`/yonetim/duyurular/${announcement.id}`)}>Kaldır</button></div></article>;
}

export default function Announcements({ announcements }: { announcements: Announcement[] }) {
    const [values, setValues] = useState<Values>(empty);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    function submit(event: FormEvent) { event.preventDefault(); setProcessing(true); setError(''); router.post('/yonetim/duyurular', values, { preserveScroll: true, onSuccess: () => setValues(empty), onError: (errors) => setError(Object.values(errors)[0] ?? 'Duyuru kaydedilemedi.'), onFinish: () => setProcessing(false) }); }

    return <AdminLayout><Head title="Duyurular" /><header className="admin-title"><div><span className="booking-kicker">İÇERİK YÖNETİMİ</span><h1>Duyurular</h1><p>Bakım, kapanış ve bilgilendirmeleri yayımlayın.</p></div></header>{error && <div className="form-error settings-error">{error}</div>}<form className="admin-panel announcement-form" onSubmit={submit}><h2>Yeni duyuru</h2><Fields values={values} setValues={setValues} /><button className="settings-submit" disabled={processing}>{processing ? 'Kaydediliyor…' : 'Duyuru oluştur'}</button></form><section className="announcement-admin-list">{announcements.map((announcement) => <AnnouncementCard announcement={announcement} key={announcement.id} />)}{announcements.length === 0 && <div className="admin-panel settings-empty">Henüz duyuru yok.</div>}</section></AdminLayout>;
}
