import { Link, usePage } from '@inertiajs/react';

export default function SettingsTabs() {
    const page = usePage<{ features: { onlineBooking: boolean } }>();
    const path = page.url.split('?')[0];

    return <nav className="settings-tabs" aria-label="Ayar bölümleri">
        <Link className={path.includes('/atolye') ? 'active' : ''} href="/yonetim/ayarlar/atolye">Atölye ve iletişim</Link>
        <Link className={path.includes('/yazicilar') ? 'active' : ''} href="/yonetim/ayarlar/yazicilar">Yazıcılar ve bakım</Link>
        <Link className={path.includes('/filamentler') ? 'active' : ''} href="/yonetim/ayarlar/filamentler">Filamentler</Link>
        {page.props.features.onlineBooking && <><Link className={path.includes('/randevu-kurallari') ? 'active' : ''} href="/yonetim/ayarlar/randevu-kurallari">Randevu kuralları</Link><Link className={path.includes('/kvkk') ? 'active' : ''} href="/yonetim/ayarlar/kvkk">KVKK ve saklama</Link></>}
    </nav>;
}
