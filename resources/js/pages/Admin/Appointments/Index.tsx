import AdminLayout from '@/components/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Appointment = { publicId: string; name: string; email: string; status: string; statusLabel: string; printer: string; startsAt: string; durationMinutes: number };
type LinkItem = { url: string | null; label: string; active: boolean };
type Props = {
    appointments: { data: Appointment[]; links: LinkItem[]; total: number };
    filters: { status: string; search: string };
    statusOptions: { value: string; label: string }[];
    counts: { pending: number; approved: number; today: number };
};

export default function AppointmentIndex({ appointments, filters, statusOptions, counts }: Props) {
    const [search, setSearch] = useState(filters.search);

    function filter(event: FormEvent) {
        event.preventDefault();
        router.get('/yonetim/randevular', { search, status: filters.status }, { preserveState: true, replace: true });
    }

    function changeStatus(status: string) {
        router.get('/yonetim/randevular', { search, status }, { preserveState: true, replace: true });
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
                    <form onSubmit={filter}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad, e-posta veya randevu numarası" /><button>Arayın</button></form>
                    <select value={filters.status} onChange={(event) => changeStatus(event.target.value)}><option value="">Tüm durumlar</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                </div>
                <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Kullanıcı</th><th>Başlangıç</th><th>Yazıcı</th><th>Durum</th><th /></tr></thead><tbody>
                    {appointments.data.map((appointment) => <tr key={appointment.publicId}><td><strong>{appointment.name}</strong><small>{appointment.email}</small></td><td><strong>{appointment.startsAt}</strong><small>{appointment.durationMinutes} dakika</small></td><td>{appointment.printer}</td><td><span className={`admin-status status-${appointment.status}`}>{appointment.statusLabel}</span></td><td><Link href={`/yonetim/randevular/${appointment.publicId}`}>İncele →</Link></td></tr>)}
                    {appointments.data.length === 0 && <tr><td colSpan={5} className="admin-empty">Bu filtrelerle eşleşen randevu bulunamadı.</td></tr>}
                </tbody></table></div>
                {appointments.links.length > 3 && <div className="admin-pagination">{appointments.links.map((link, index) => link.url ? <Link key={index} className={link.active ? 'active' : ''} href={link.url} dangerouslySetInnerHTML={{ __html: link.label }} /> : <span key={index} dangerouslySetInnerHTML={{ __html: link.label }} />)}</div>}
            </section>
        </AdminLayout>
    );
}
