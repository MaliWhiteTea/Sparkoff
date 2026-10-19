import AdminLayout from '@/components/AdminLayout';
import usePermissions from '@/hooks/usePermissions';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Report = { id: number; type: string; typeLabel: string; message: string; status: string; adminNote: string | null; handler: string | null; createdAt: string; handledAt: string | null };
type PageLink = { url: string | null; label: string; active: boolean };
type Reports = { data: Report[]; links: PageLink[] };

const statusLabels: Record<string, string> = { new: 'Yeni', reviewing: 'İnceleniyor', resolved: 'Çözüldü', archived: 'Arşivlendi' };

function ReportCard({ report, canUpdate }: { report: Report; canUpdate: boolean }) {
    const [status, setStatus] = useState(report.status);
    const [adminNote, setAdminNote] = useState(report.adminNote ?? '');
    function submit(event: FormEvent) { event.preventDefault(); if (canUpdate) router.patch(`/yonetim/talepler/${report.id}`, { status, admin_note: adminNote }, { preserveScroll: true }); }
    return <form className="admin-panel feedback-admin-card" onSubmit={submit}><header><div><span>{report.typeLabel}</span><time>{report.createdAt}</time></div><i className={`feedback-status status-${report.status}`}>{statusLabels[report.status]}</i></header><p>{report.message}</p><div className="field-grid"><label className="field"><span>Durum</span><select disabled={!canUpdate} value={status} onChange={(event) => setStatus(event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>Yönetim notu</span><textarea disabled={!canUpdate} rows={3} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="İç not (isteğe bağlı)" /></label></div><footer><small>{report.handler ? `${report.handler} · ${report.handledAt}` : 'Henüz işleme alınmadı'}</small>{canUpdate && <button>Talebi güncelle</button>}</footer></form>;
}

export default function FeedbackIndex({ reports, filters, counts }: { reports: Reports; filters: { status: string }; counts: Record<string, number> }) {
    const can = usePermissions();
    function filter(status: string) { router.get('/yonetim/talepler', status ? { status } : {}, { preserveState: true, replace: true }); }
    return <AdminLayout><Head title="Talepler" /><header className="admin-title"><div><span className="booking-kicker">GERİ BİLDİRİMLER</span><h1>Talepler</h1><p>Kişisel bilgi alınmadan gönderilen öneri, şikâyet ve hata bildirimlerini yönetin.</p></div></header><section className="admin-metrics"><article><span>YENİ</span><strong>{counts.new}</strong></article><article><span>İNCELENİYOR</span><strong>{counts.reviewing}</strong></article><article><span>ÇÖZÜLDÜ</span><strong>{counts.resolved}</strong></article></section><nav className="feedback-filters" aria-label="Talep filtreleri"><button className={!filters.status ? 'active' : ''} onClick={() => filter('')}>Tümü</button>{Object.entries(statusLabels).map(([value, label]) => <button className={filters.status === value ? 'active' : ''} onClick={() => filter(value)} key={value}>{label}</button>)}</nav><section className="feedback-admin-list">{reports.data.length ? reports.data.map((report) => <ReportCard report={report} canUpdate={can('feedback.update')} key={report.id} />) : <div className="admin-empty">Bu filtrede talep bulunmuyor.</div>}</section><nav className="admin-pagination">{reports.links.map((link, index) => link.url ? <a className={link.active ? 'active' : ''} href={link.url} key={index} dangerouslySetInnerHTML={{ __html: link.label }} /> : <span key={index} dangerouslySetInnerHTML={{ __html: link.label }} />)}</nav></AdminLayout>;
}
