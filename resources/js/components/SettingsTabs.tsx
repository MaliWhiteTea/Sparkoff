import { Link, usePage } from '@inertiajs/react';

export default function SettingsTabs() {
    const path = usePage().url.split('?')[0];

    return <nav className="settings-tabs" aria-label="Ayar bölümleri">
        <Link className={path.includes('/randevu-kurallari') ? 'active' : ''} href="/yonetim/ayarlar/randevu-kurallari">Randevu kuralları</Link>
        <Link className={path.includes('/yazicilar') ? 'active' : ''} href="/yonetim/ayarlar/yazicilar">Yazıcılar ve bakım</Link>
        <Link className={path.includes('/filamentler') ? 'active' : ''} href="/yonetim/ayarlar/filamentler">Filamentler</Link>
    </nav>;
}
