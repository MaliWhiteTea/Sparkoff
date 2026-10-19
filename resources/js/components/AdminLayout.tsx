import { Link, router, usePage } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

type SharedProps = {
    auth: { user: { name: string; email: string; role: string; roles: string[]; permissions: string[] } };
    flash: { success?: string; warning?: string };
    features: { onlineBooking: boolean };
};

export default function AdminLayout({ children }: PropsWithChildren) {
    const page = usePage<SharedProps>();
    const { auth, flash, features } = page.props;
    const path = page.url.split('?')[0];
    const can = (permission: string) => auth.user.permissions.includes(permission);
    const home = can('appointments.view') && features.onlineBooking ? '/yonetim/randevular' : can('printers.view') ? '/yonetim/ayarlar/yazicilar' : can('printers.manage_filaments') ? '/yonetim/ayarlar/filamentler' : can('announcements.view') ? '/yonetim/duyurular' : '/';

    return (
        <div className="admin-page">
            <aside className="admin-sidebar">
                <Link className="admin-brand" href={home}>
                    <img src="/logo.jpg" alt="Sparkoff logosu" />
                    <span><strong>Sparkoff</strong><small>Yönetim Paneli</small></span>
                </Link>
                <nav>{features.onlineBooking && can('appointments.view') && <Link className={path.includes('/randevular') ? 'active' : ''} href="/yonetim/randevular">Randevular</Link>}{features.onlineBooking && can('printers.manage_schedule') && <Link className={path.includes('/takvim') ? 'active' : ''} href="/yonetim/takvim">Randevu takvimi</Link>}{can('printers.view') && <Link className={path.includes('/ayarlar/yazicilar') ? 'active' : ''} href="/yonetim/ayarlar/yazicilar">Yazıcılar</Link>}{can('printers.manage_filaments') && <Link className={path.includes('/ayarlar/filamentler') ? 'active' : ''} href="/yonetim/ayarlar/filamentler">Filamentler</Link>}{can('announcements.view') && <Link className={path.includes('/duyurular') ? 'active' : ''} href="/yonetim/duyurular">Duyurular</Link>}{can('audit_logs.view') && <Link className={path.includes('/islem-gecmisi') ? 'active' : ''} href="/yonetim/islem-gecmisi">İşlem geçmişi</Link>}</nav>
                <div className="admin-user"><strong>{auth.user.name}</strong><small>{auth.user.roles.join(', ') || auth.user.email}</small><button type="button" onClick={() => router.post('/yonetim/cikis')}>Çıkış yap</button></div>
            </aside>
            <main className="admin-content">
                {flash.success && <div className="admin-flash success">{flash.success}</div>}
                {flash.warning && <div className="admin-flash warning">{flash.warning}</div>}
                {children}
            </main>
        </div>
    );
}
