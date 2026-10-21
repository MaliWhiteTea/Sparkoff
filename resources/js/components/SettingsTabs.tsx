import { Link, usePage } from '@inertiajs/react';
import ListSort from './ListSort';

export default function SettingsTabs() {
    const page = usePage<{ features: { onlineBooking: boolean }; auth: { user: { permissions: string[] } }; sorting?: { userSort: string; userDirection: string; roleSort: string; roleDirection: string } }>();
    const path = page.url.split('?')[0];
    const can = (permission: string) => page.props.auth.user.permissions.includes(permission);

    return <><nav className="settings-tabs" aria-label="Ayar bölümleri">
        <Link className={path.includes('/kisisel') ? 'active' : ''} href="/yonetim/ayarlar/kisisel">Kişisel ayarlar</Link>
        {can('workshop_settings.update') && <Link className={path.includes('/atolye') ? 'active' : ''} href="/yonetim/ayarlar/atolye">Atölye ve iletişim</Link>}
        {can('printers.view') && <Link className={path.includes('/yazicilar') ? 'active' : ''} href="/yonetim/ayarlar/yazicilar">Yazıcılar ve bakım</Link>}
        {can('printers.manage_filaments') && <Link className={path.includes('/filamentler') ? 'active' : ''} href="/yonetim/ayarlar/filamentler">Filamentler</Link>}
        {page.props.features.onlineBooking && (can('system_settings.update') || can('printers.manage_hours')) && <Link className={path.includes('/randevu-kurallari') ? 'active' : ''} href="/yonetim/ayarlar/randevu-kurallari">Randevu kuralları</Link>}
        {page.props.features.onlineBooking && can('privacy_settings.update') && <Link className={path.includes('/kvkk') ? 'active' : ''} href="/yonetim/ayarlar/kvkk">KVKK ve saklama</Link>}
        {(can('users.view') || can('roles.view')) && <Link className={path.includes('/yetkiler') ? 'active' : ''} href="/yonetim/yetkiler">Kullanıcılar ve roller</Link>}
    </nav>{path.includes('/yetkiler') && page.props.sorting && <div className="access-sort-controls"><ListSort label="Kullanıcı sıralaması" sort={page.props.sorting.userSort} direction={page.props.sorting.userDirection} sortKey="user_sort" directionKey="user_direction" options={[{ value: 'name', label: 'Kullanıcı adı' }, { value: 'email', label: 'E-posta' }, { value: 'is_active', label: 'Hesap durumu' }, { value: 'created_at', label: 'Oluşturulma zamanı' }]} /><ListSort label="Rol sıralaması" sort={page.props.sorting.roleSort} direction={page.props.sorting.roleDirection} sortKey="role_sort" directionKey="role_direction" options={[{ value: 'name', label: 'Rol adı' }, { value: 'users_count', label: 'Kullanıcı sayısı' }, { value: 'created_at', label: 'Oluşturulma zamanı' }]} /></div>}</>;
}
