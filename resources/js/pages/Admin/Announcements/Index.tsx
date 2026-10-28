import AdminLayout from '@/components/AdminLayout';
import { hasFormChanged, useUnsavedChanges } from '@/components/UnsavedChangesGuard';
import { useSafeDraft } from '@/hooks/useSafeDraft';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Role = { id: number; name: string };
type Announcement = { id: number; title: string; body: string; type: string; placement: string; audience: 'public' | 'staff' | 'both'; isPublished: boolean; isPinned: boolean; requiresAcknowledgement: boolean; startsAt: string | null; endsAt: string | null; roleIds: number[]; roleNames: string[]; readCount: number; acknowledgedCount: number; canUpdate: boolean; canArchive: boolean };
type Values = { title: string; body: string; type: string; placement: string; audience: 'public' | 'staff' | 'both'; is_published: boolean; is_pinned: boolean; requires_acknowledgement: boolean; starts_at: string; ends_at: string; role_ids: number[] };
type Props = { announcements: Announcement[]; roles: Role[]; capabilities: { createPublic: boolean; createStaff: boolean } };

const empty: Values = { title: '', body: '', type: 'info', placement: 'all', audience: 'public', is_published: true, is_pinned: false, requires_acknowledgement: false, starts_at: '', ends_at: '', role_ids: [] };
const audienceLabels = { public: 'Ziyaretçiler', staff: 'Yönetim paneli', both: 'Ziyaretçiler ve yönetim paneli' };
const typeLabels: Record<string, string> = { info: 'Bilgi', warning: 'Önemli', maintenance: 'Bakım', urgent: 'Acil' };
const draftFields = ['title', 'body', 'type', 'placement', 'audience', 'is_published', 'is_pinned', 'requires_acknowledgement', 'starts_at', 'ends_at', 'role_ids'] as const;

function Fields({ values, setValues, roles, capabilities }: { values: Values; setValues: (values: Values) => void; roles: Role[]; capabilities: Props['capabilities'] }) {
    const toggleRole = (id: number) => setValues({ ...values, role_ids: values.role_ids.includes(id) ? values.role_ids.filter((roleId) => roleId !== id) : [...values.role_ids, id] });
    return <div className="field-grid"><label className="field full"><span>Başlık</span><input value={values.title} maxLength={120} onChange={(event) => setValues({ ...values, title: event.target.value })} required /></label><label className="field full"><span>Metin</span><textarea rows={3} value={values.body} maxLength={1000} onChange={(event) => setValues({ ...values, body: event.target.value })} required /></label>
        <label className="field"><span>Hedef kitle</span><select value={values.audience} onChange={(event) => setValues({ ...values, audience: event.target.value as Values['audience'], role_ids: event.target.value === 'public' ? [] : values.role_ids, requires_acknowledgement: event.target.value === 'public' ? false : values.requires_acknowledgement })}>{capabilities.createPublic && <option value="public">Ziyaretçiler</option>}{capabilities.createStaff && <option value="staff">Yönetim paneli</option>}{capabilities.createPublic && capabilities.createStaff && <option value="both">Ziyaretçiler ve yönetim paneli</option>}</select></label>
        <label className="field"><span>Önem seviyesi</span><select value={values.type} onChange={(event) => setValues({ ...values, type: event.target.value })}><option value="info">Bilgi</option><option value="warning">Önemli</option><option value="maintenance">Bakım</option><option value="urgent">Acil</option></select></label>
        {(values.audience === 'public' || values.audience === 'both') && <label className="field"><span>Ziyaretçiye gösterim yeri</span><select value={values.placement} onChange={(event) => setValues({ ...values, placement: event.target.value })}><option value="all">Tüm sayfalar</option><option value="home">Yalnızca ana sayfa</option><option value="printers">Yalnızca 3D yazıcılar</option></select></label>}
        <label className="field"><span>Başlangıç (isteğe bağlı)</span><input type="datetime-local" value={values.starts_at} onChange={(event) => setValues({ ...values, starts_at: event.target.value })} /></label><label className="field"><span>Bitiş (isteğe bağlı)</span><input type="datetime-local" value={values.ends_at} onChange={(event) => setValues({ ...values, ends_at: event.target.value })} /></label>
        {(values.audience === 'staff' || values.audience === 'both') && <fieldset className="announcement-role-picker full"><legend>Yönetim panelinde kimler görecek?</legend><p>Hiçbir rol seçmezseniz duyuru tüm yetkili kullanıcılara gider.</p><div>{roles.map((role) => <label key={role.id}><input type="checkbox" checked={values.role_ids.includes(role.id)} onChange={() => toggleRole(role.id)} /><span>{role.name}</span></label>)}</div></fieldset>}
        <div className="announcement-toggles full"><label><input type="checkbox" checked={values.is_published} onChange={(event) => setValues({ ...values, is_published: event.target.checked })} /><span>Yayınla</span></label><label><input type="checkbox" checked={values.is_pinned} onChange={(event) => setValues({ ...values, is_pinned: event.target.checked })} /><span>Sabitle</span></label>{values.audience !== 'public' && <label><input type="checkbox" checked={values.requires_acknowledgement} onChange={(event) => setValues({ ...values, requires_acknowledgement: event.target.checked })} /><span>Okundu onayı iste</span></label>}</div>
    </div>;
}

function AnnouncementCard({ announcement, roles, capabilities }: { announcement: Announcement; roles: Role[]; capabilities: Props['capabilities'] }) {
    const initialValues: Values = { title: announcement.title, body: announcement.body, type: announcement.type, placement: announcement.placement, audience: announcement.audience, is_published: announcement.isPublished, is_pinned: announcement.isPinned, requires_acknowledgement: announcement.requiresAcknowledgement, starts_at: announcement.startsAt ?? '', ends_at: announcement.endsAt ?? '', role_ids: announcement.roleIds };
    const [editing, setEditing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [values, setValues] = useState<Values>(initialValues);
    const changed = editing && hasFormChanged(initialValues, values);
    useUnsavedChanges(changed);
    useSafeDraft({ key: `announcements.edit.${announcement.id}`, source: values, fields: draftFields, enabled: changed });
    const save = (event: FormEvent) => { event.preventDefault(); setProcessing(true); router.patch(`/yonetim/duyurular/${announcement.id}`, values, { preserveScroll: true, onSuccess: () => setEditing(false), onFinish: () => setProcessing(false) }); };
    if (editing) return <form className="admin-panel announcement-form" onSubmit={save}><Fields values={values} setValues={setValues} roles={roles} capabilities={capabilities} /><div className="schedule-edit-actions"><button type="button" onClick={() => setEditing(false)}>Vazgeç</button><button disabled={processing}>Kaydet</button></div></form>;

    return <article className={`admin-panel announcement-admin-card announcement-${announcement.type}`}><div><span>{typeLabels[announcement.type]} · {audienceLabels[announcement.audience]}{announcement.isPinned ? ' · SABİT' : ''}</span><h3>{announcement.title}</h3><p>{announcement.body}</p><small>{announcement.isPublished ? 'Yayında' : 'Taslak'}{announcement.roleNames.length ? ` · ${announcement.roleNames.join(', ')}` : announcement.audience !== 'public' ? ' · Tüm yetkililer' : ''}{announcement.audience !== 'public' ? ` · ${announcement.readCount} okundu${announcement.requiresAcknowledgement ? `, ${announcement.acknowledgedCount} onay` : ''}` : ''}</small></div>{(announcement.canUpdate || announcement.canArchive) && <div>{announcement.canUpdate && <button type="button" onClick={() => setEditing(true)}>Düzenle</button>}{announcement.canArchive && <button type="button" className="danger" onClick={() => window.confirm('Duyuru kaldırılsın mı?') && router.delete(`/yonetim/duyurular/${announcement.id}`)}>Kaldır</button>}</div>}</article>;
}

export default function Announcements({ announcements, roles, capabilities }: Props) {
    const initialAudience = capabilities.createPublic ? 'public' : 'staff';
    const initialValues: Values = { ...empty, audience: initialAudience };
    const [values, setValues] = useState<Values>(initialValues);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const changed = hasFormChanged(initialValues, values);
    useUnsavedChanges(changed);
    useSafeDraft({ key: 'announcements.create', source: values, fields: draftFields, enabled: changed });
    const submit = (event: FormEvent) => { event.preventDefault(); setProcessing(true); setError(''); router.post('/yonetim/duyurular', values, { preserveScroll: true, onSuccess: () => setValues({ ...empty, audience: initialAudience }), onError: (errors) => setError(Object.values(errors)[0] ?? 'Duyuru kaydedilemedi.'), onFinish: () => setProcessing(false) }); };

    return <AdminLayout><Head title="Duyurular" /><header className="admin-title"><div><span className="booking-kicker">İÇERİK VE EKİP İLETİŞİMİ</span><h1>Duyurular</h1><p>Ziyaretçilere veya yönetim ekibine yönelik duyuruları tek yerden yönetin.</p></div></header>{error && <div className="form-error settings-error">{error}</div>}{(capabilities.createPublic || capabilities.createStaff) && <form className="admin-panel announcement-form" onSubmit={submit}><h2>Yeni duyuru</h2><Fields values={values} setValues={setValues} roles={roles} capabilities={capabilities} /><button className="settings-submit" disabled={processing}>{processing ? 'Kaydediliyor…' : 'Duyuru oluştur'}</button></form>}<section className="announcement-admin-list">{announcements.map((announcement) => <AnnouncementCard announcement={announcement} roles={roles} capabilities={capabilities} key={announcement.id} />)}{announcements.length === 0 && <div className="admin-panel settings-empty">Henüz görüntüleyebileceğiniz bir duyuru yok.</div>}</section></AdminLayout>;
}
