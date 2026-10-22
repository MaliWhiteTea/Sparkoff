import { Link } from '@inertiajs/react';

type Props = {
    isHome?: boolean;
    hasContact?: boolean;
};

export default function PublicHeader({ isHome = false, hasContact = false }: Props) {
    const sectionHref = (section: string) => `${isHome ? '' : '/'}#${section}`;

    return <header className="site-header"><div className="header-inner">
        <Link className="brand" href={isHome ? '#ust' : '/'} aria-label="Sparkoff Proje Atölyesi ana sayfa"><img src="/logo.jpg" alt="Sparkoff logosu" width={56} height={56} /><span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span></Link>
        <nav className="desktop-nav" aria-label="Ana menü"><a href={sectionHref('icerik')}>Atölye</a><a href={sectionHref('hizmetler')}>Hizmetler</a><Link href="/3d-yazicilar">3D Yazıcılar</Link><Link href="/malzemeler">Malzemeler</Link><Link href="/geri-bildirim">Geri bildirim</Link>{hasContact && <a href={sectionHref('iletisim')}>İletişim</a>}</nav>
    </div></header>;
}
