import AdminLayout from '@/components/AdminLayout';
import StatusBadge from '@/components/StatusBadge';
import ListSort from '@/components/ListSort';
import TableColumns, { ColumnDefinition, initialTableColumns } from '@/components/TableColumns';
import { useRememberListUrl } from '@/hooks/useListReturnUrl';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Appointment = { publicId: string; name: string; email: string | null; status: string; statusLabel: string; printer: string; startsAt: string; durationMinutes: number };
type LinkItem = { url: string | null; label: string; active: boolean };
type Props = {
    appointments: { data: Appointment[]; links: LinkItem[]; total: number };
    filters: { status: string; search: string; sort: string; direction: string };
    statusOptions: { value: string; label: string }[];
    counts: { pending: number; approved: number; today: number };
};

export default function AppointmentIndex({ appointments, filters, statusOptions, counts }: Props) {
    const page = usePage<{ auth: { user: { permissions: string[]; tablePreferences: Record<string, string[]> } } }>();
    const canSeeApplicant = page.props.auth.user.permissions.includes('appointments.view_personal_data');
    const columnDefinitions: ColumnDefinition[] = [
        ...(canSeeApplicant ? [{ key: 'applicant', label: 'Başvuru sahibi' }] : []),
        { key: 'starts_at', label: 'Başlangıç' }, { key: 'duration', label: 'Süre' },
        { key: 'printer', label: 'Yazıcı' }, { key: 'status', label: 'Durum' },
    ];
    const [columns, setColumns] = useState(() => initialTableColumns(page.props.auth.user.tablePreferences.appointments, columnDefinitions));
    const [search, setSearch] = useState(filters.search);
    useRememberListUrl('appointments', usePage().url);

    function filter(event: FormEvent) {
        event.preventDefault();
        router.get('/yonetim/randevular', { ...filters, search }, { preserveState: true, preserveScroll: true, replace: true });
    }

    function changeStatus(status: string) {
        router.get('/yonetim/randevular', { ...filters, search, status }, { preserveState: true, preserveScroll: true, replace: true });
    }

    return (
        <AdminLayout>
            <Head title="Randevu Yönetimi" />
            <header className="admin-title"><div><span className="booking-kicker">ATÖLYE OPERASYONU</span><h1>Randevular</h1><p>{appointments.total} randevu kaydı bulunuyor.</p></div></header>
            <section className="admin-metrics">
                <article><span>ONAY BEKLEYEN</span><strong>{counts.pending}</strong></article>
                <article><span>ONAYLANAN</span><strong>{counts.approved}</strong></article>
                <article><span>BUGÜN BAŞLAYAN</span><strong>{counts.today}</strong></article>
            </section>
            <section className="admin-panel">
                <div className="admin-filters">
                    <form onSubmit={filter}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Randevu numarası, ad veya e-posta" /><button>Arayın</button></form>
                    <select value={filters.status} onChange={(event) => changeStatus(event.target.value)}><option value="">Tüm durumlar</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                </div>
                <ListSort sort={filters.sort} direction={filters.direction} options={[{ value: 'starts_at', label: 'Başlangıç zamanı' }, { value: 'created_at', label: 'Başvuru zamanı' }, { value: 'status', label: 'Durum' }, { value: 'duration_minutes', label: 'Süre' }]} />
                <TableColumns table="appointments" definitions={columnDefinitions} active={columns} setActive={setColumns} />
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map((column) => <th key={column}>{columnDefinitions.find((definition) => definition.key === column)?.label}</th>)}<th><span className="sr-only">İşlem</span></th></tr></thead><tbody>
                    {appointments.data.map((appointment) => <tr key={appointment.publicId}>{columns.map((column) => <td key={column}>{column === 'applicant' ? <><strong>{appointment.name}</strong>{appointment.email && <small>{appointment.email}</small>}</> : column === 'starts_at' ? <strong>{appointment.startsAt}</strong> : column === 'duration' ? `${appointment.durationMinutes} dakika` : column === 'printer' ? appointment.printer : <StatusBadge status={appointment.status} label={appointment.statusLabel} />}</td>)}<td><Link href={`/yonetim/randevular/${appointment.publicId}`}>İncele →</Link></td></tr>)}
                    {appointments.data.length === 0 && <tr><td colSpan={columns.length + 1} className="admin-empty">Bu filtrelerle eşleşen randevu bulunamadı.</td></tr>}
                </tbody></table></div>
                {appointments.links.length > 3 && <div className="admin-pagination">{appointments.links.map((link, index) => link.url ? <Link key={index} className={link.active ? 'active' : ''} href={link.url} preserveScroll preserveState dangerouslySetInnerHTML={{ __html: link.label }} /> : <span key={index} dangerouslySetInnerHTML={{ __html: link.label }} />)}</div>}
            </section>
        </AdminLayout>
    );
}
