import { Link } from '@inertiajs/react';

export default function PublicFooter() {
    return <footer className="public-footer">
        <div className="footer-brand"><img src="/logo.jpg" alt="" width={44} height={44} /><div><strong>Sparkoff</strong><span>Proje Atölyesi</span></div></div>
        <Link className="footer-feedback" href="/geri-bildirim">Öneri, şikâyet veya hata bildir</Link>
        <span>© {new Date().getFullYear()} Sparkoff Proje Atölyesi</span>
    </footer>;
}
