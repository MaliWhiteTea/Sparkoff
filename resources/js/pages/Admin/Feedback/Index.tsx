import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import ListSort from '@/components/ListSort';
import SavedFilters from '@/components/SavedFilters';
import TableColumns, { ColumnDefinition, initialTableColumns } from '@/components/TableColumns';
import usePermissions from '@/hooks/usePermissions';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Report = { id: number; type: string; typeLabel: string; message: string; status: string; adminNote: string | null; handler: string | null; createdAt: string; handledAt: string | null };
type PageLink = { url: string | null; label: string; active: boolean };
type Reports = { data: Report[]; links: PageLink[] };

const statusLabels: Record<string, string> = { new: 'Yeni', reviewing: 'İnceleniyor', resolved: 'Çözüldü', archived: 'Arşivlendi' };
const filterLabels: Record<string, string> = { open: 'Açık', ...statusLabels };

function ReportCard({ report, canUpdate, columns }: { report: Report; canUpdate: boolean; columns: string[] }) {
    const [status, setStatus] = useState(report.status);
    const [adminNote, setAdminNote] = useState(report.adminNote ?? '');
    function submit(event: FormEvent) { event.preventDefault(); if (canUpdate) router.patch(`/yonetim/talepler/${report.id}`, { status, admin_note: adminNote }, { preserveScroll: true }); }
    return <form className="admin-panel feedback-admin-card" onSubmit={submit}><header><div>{columns.includes('type') && <span>{report.typeLabel}</span>}{columns.includes('created_at') && <time>{report.createdAt}</time>}</div>{columns.includes('status') && <StatusBadge status={report.status} label={statusLabels[report.status]} />}</header>{columns.includes('message') && <p>{report.message}</p>}<div className="field-grid"><label className="field"><span>Durum</span><select disabled={!canUpdate} value={status} onChange={(event) => setStatus(event.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="field"><span>Yönetim notu</span><textarea disabled={!canUpdate} rows={3} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="İç not (isteğe bağlı)" /></label></div><footer>{columns.includes('handler') && <small>{report.handler ? `${report.handler} · ${report.handledAt}` : 'Henüz işleme alınmadı'}</small>}{canUpdate && <button>Talebi güncelle</button>}</footer></form>;
}

export default function FeedbackIndex({ reports, filters, counts }: { reports: Reports; filters: { status: string; sort: string; direction: string }; counts: Record<string, number> }) {
    const can = usePermissions();
    const page = usePage<{ auth: { user: { tablePreferences: Record<string, string[]> } } }>();
    const columnDefinitions: ColumnDefinition[] = [{ key: 'type', label: 'Bildirim türü' }, { key: 'message', label: 'Mesaj' }, { key: 'status', label: 'Durum' }, { key: 'created_at', label: 'Gönderim zamanı' }, { key: 'handler', label: 'İşlem yapan' }];
    const [columns, setColumns] = useState(() => initialTableColumns(page.props.auth.user.tablePreferences.feedback, columnDefinitions));
    function filter(status: string) { router.get('/yonetim/talepler', { ...filters, status }, { preserveState: true, preserveScroll: true, replace: true }); }
    return <AdminLayout><Head title="Talepler" /><header className="admin-title"><div><span className="booking-kicker">GERİ BİLDİRİMLER</span><h1>Talepler</h1><p>Kişisel bilgi alınmadan gönderilen öneri, şikâyet ve hata bildirimlerini yönetin.</p></div></header><section className="admin-metrics"><article><span>YENİ</span><strong>{counts.new}</strong></article><article><span>İNCELENİYOR</span><strong>{counts.reviewing}</strong></article><article><span>ÇÖZÜLDÜ</span><strong>{counts.resolved}</strong></article></section><nav className="feedback-filters" aria-label="Talep filtreleri"><button className={!filters.status ? 'active' : ''} onClick={() => filter('')}>Tümü</button>{Object.entries(filterLabels).map(([value, label]) => <button className={filters.status === value ? 'active' : ''} onClick={() => filter(value)} key={value}>{label}</button>)}</nav><SavedFilters table="feedback" path="/yonetim/talepler" current={{ status: filters.status }} /><ListSort sort={filters.sort} direction={filters.direction} options={[{ value: 'created_at', label: 'Gönderim zamanı' }, { value: 'handled_at', label: 'İşlem zamanı' }, { value: 'status', label: 'Durum' }, { value: 'type', label: 'Bildirim türü' }]} /><TableColumns table="feedback" definitions={columnDefinitions} active={columns} setActive={setColumns} reorderable={false} /><section className="feedback-admin-list">{reports.data.length ? reports.data.map((report) => <ReportCard report={report} canUpdate={can('feedback.update')} columns={columns} key={report.id} />) : <div className="admin-empty">Bu filtrede talep bulunmuyor.</div>}</section><nav className="admin-pagination">{reports.links.map((link, index) => !link.url && (index === 0 || index === reports.links.length - 1) ? null : link.url ? <Link className={link.active ? 'active' : ''} href={link.url} preserveScroll preserveState key={index} dangerouslySetInnerHTML={{ __html: link.label }} /> : <span key={index} dangerouslySetInnerHTML={{ __html: link.label }} />)}</nav></AdminLayout>;
}
