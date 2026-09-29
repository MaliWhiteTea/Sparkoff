import { Link, router, usePage } from '@inertiajs/react';
import { PropsWithChildren } from 'react';

type SharedProps = {
    auth: { user: { name: string; email: string; role: string } };
    flash: { success?: string; warning?: string };
};

export default function AdminLayout({ children }: PropsWithChildren) {
    const { auth, flash } = usePage<SharedProps>().props;

    return (
        <div className="admin-page">
            <aside className="admin-sidebar">
                <Link className="admin-brand" href="/yonetim/randevular">
                    <img src="/logo.jpg" alt="Sparkoff logosu" />
                    <span><strong>Sparkoff</strong><small>Yönetim Paneli</small></span>
                </Link>
                <nav><Link href="/yonetim/randevular">Randevular</Link><span>Takvim <small>Yakında</small></span><span>Ayarlar <small>Yakında</small></span></nav>
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
