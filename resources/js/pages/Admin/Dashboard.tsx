import AdminLayout from '@/components/AdminLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { ReactElement } from 'react';

type Module = {
    key: string;
    title: string;
    description: string;
    href: string;
    icon: string;
};

type Summary = {
    key: string;
    title: string;
    description: string;
    href: string;
    count: number;
    tone: 'info' | 'warning' | 'danger';
};

type RecentRecord = {
    type: string;
    label: string;
    title: string;
    description: string;
    href: string;
    viewedAt: string;
};

function ModuleIcon({ name }: { name: string }) {
    const paths: Record<string, ReactElement> = {
        inventory: <><path d="M4 7h16v13H4z" /><path d="M7 4h10v3M8 11h8" /></>,
        loans: <><path d="M5 6h14v14H5z" /><path d="M8 3v6M16 3v6M8 13h8" /></>,
        appointments: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h3M13 14h3" /></>,
        feedback: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
        announcements: <><path d="m4 13 3-2V7l10-4v16L7 15v-4" /><path d="M7 15v5h4v-4" /></>,
        printers: <><rect x="4" y="7" width="16" height="11" rx="2" /><path d="M8 7V3h8v4M8 14h8M9 18v3h6v-3" /></>,
        filaments: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M18 17v4h3" /></>,
        access: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 8h5M18.5 5.5v5" /></>,
        history: <><path d="M4 12a8 8 0 1 0 2-5.3L4 9" /><path d="M4 4v5h5M12 8v5l3 2" /></>,
        settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7L0 10.5v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2.3h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z" transform="translate(2 -1) scale(.83)" /></>,
    };

    return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function Dashboard({ modules, summaries, recentRecords }: { modules: Module[]; summaries: Summary[]; recentRecords: RecentRecord[] }) {
    const page = usePage<{ auth: { user: { name: string; roles: string[] } } }>();
    const user = page.props.auth.user;

    return <AdminLayout>
        <Head title="Genel Bakış" />
        <header className="admin-title admin-overview-title">
            <div>
                <span className="booking-kicker">YÖNETİM ÇALIŞMA ALANI</span>
                <h1>Merhaba, {user.name}</h1>
                <p>Yetkilerinize göre kullanabileceğiniz modüller burada bir araya getirildi.</p>
            </div>
            <span>{user.roles.join(' · ')}</span>
        </header>
        {summaries.length > 0 && <section className="admin-overview-alerts" aria-labelledby="overview-alerts-title">
            <div className="admin-overview-heading">
                <div><h2 id="overview-alerts-title">Dikkat gerekenler</h2><p>Yetkiniz kapsamındaki güncel kayıt özetleri.</p></div>
            </div>
            <div className="admin-summary-grid">
                {summaries.map((summary) => <Link className={`admin-summary-card tone-${summary.tone}`} href={summary.href} key={summary.key}>
                    <span>{summary.title}</span>
                    <strong>{summary.count}</strong>
                    <small>{summary.description}</small>
                    <b>Kayıtları incele <span aria-hidden="true">→</span></b>
                </Link>)}
            </div>
        </section>}
        {recentRecords.length > 0 && <section className="admin-recent-section" aria-labelledby="recent-records-title">
            <div className="admin-overview-heading">
                <div><h2 id="recent-records-title">Son görüntülenenler</h2><p>Size özel, içerik saklamayan kayıt geçmişi.</p></div>
            </div>
            <div className="admin-recent-grid">
                {recentRecords.map((record, index) => <Link className="admin-recent-card" href={record.href} key={`${record.type}-${record.href}-${index}`}>
                    <span className={`type-${record.type}`}>{record.label}</span>
                    <strong>{record.title}</strong>
                    <small>{record.description}</small>
                    <time>{record.viewedAt}</time>
                </Link>)}
            </div>
        </section>}
        <section className="admin-overview-heading">
            <div><h2>Çalışma alanların</h2><p>{modules.length} modüle erişiminiz bulunuyor.</p></div>
        </section>
        <div className="admin-workspace-grid">
            {modules.map((module) => <Link className="admin-panel admin-workspace-card" href={module.href} key={module.key}>
                <span className="admin-workspace-icon"><ModuleIcon name={module.icon} /></span>
                <div><h2>{module.title}</h2><p>{module.description}</p></div>
                <strong>Modülü aç <span aria-hidden="true">→</span></strong>
            </Link>)}
        </div>
    </AdminLayout>;
}
