import { Link, router, usePage } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

type SharedProps = {
    auth: { user: { name: string; email: string; role: string } };
    flash: { success?: string; warning?: string };
};

export default function AdminLayout({ children }: PropsWithChildren) {
    const page = usePage<SharedProps>();
    const { auth, flash } = page.props;
    const path = page.url.split('?')[0];

    return (
        <div className="admin-page">
            <aside className="admin-sidebar">
                <Link className="admin-brand" href="/yonetim/randevular">
                    <img src="/logo.jpg" alt="Sparkoff logosu" />
                    <span><strong>Sparkoff</strong><small>Yönetim Paneli</small></span>
                </Link>
                <nav><Link className={path.startsWith('/yonetim/randevular') ? 'active' : ''} href="/yonetim/randevular">Randevular</Link><Link className={path.startsWith('/yonetim/takvim') ? 'active' : ''} href="/yonetim/takvim">Takvim</Link>{auth.user.role === 'admin' && <Link className={path.startsWith('/yonetim/ayarlar') ? 'active' : ''} href="/yonetim/ayarlar/yazicilar">Ayarlar</Link>}</nav>
                <div className="admin-user"><strong>{auth.user.name}</strong><small>{auth.user.email}</small><button type="button" onClick={() => router.post('/yonetim/cikis')}>Çıkış yap</button></div>
            </aside>
            <main className="admin-content">
                {flash.success && <div className="admin-flash success">{flash.success}</div>}
                {flash.warning && <div className="admin-flash warning">{flash.warning}</div>}
                {children}
            </main>
        </div>
    );
}
