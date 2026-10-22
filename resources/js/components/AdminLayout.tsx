import { Link, router, usePage } from '@inertiajs/react';
import { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent, PropsWithChildren, ReactElement, useEffect, useRef, useState } from 'react';

type Preferences = { theme: 'light' | 'dark' | 'system'; scale: 'small' | 'normal' | 'large'; density: 'comfortable' | 'normal' | 'compact'; sidebar: 'wide' | 'narrow' };
type SharedProps = {
    auth: { user: { name: string; email: string; role: string; roles: string[]; permissions: string[]; isSystemAdministrator: boolean; interfacePreferences: Preferences } };
    flash: { success?: string; warning?: string };
    features: { onlineBooking: boolean };
    staffAnnouncements: { id: number; title: string; body: string; type: string; isPinned: boolean; requiresAcknowledgement: boolean; isRead: boolean }[];
    staffAnnouncementUnreadCount: number;
};
type NavItem = { href: string; label: string; icon: string; active: boolean; count?: number };

const DEFAULT_WIDTH = 245;
const MIN_WIDTH = 210;
const MAX_WIDTH = 380;
const WIDTH_KEY = 'sparkoff.admin.sidebar.width';
const clamp = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
const storedSidebarWidth = () => {
    if (typeof window === 'undefined') return DEFAULT_WIDTH;
    const storedWidth = Number.parseInt(localStorage.getItem(WIDTH_KEY) ?? '', 10);
    return Number.isFinite(storedWidth) ? clamp(storedWidth) : DEFAULT_WIDTH;
};

function MenuIcon({ name }: { name: string }) {
    const paths: Record<string, ReactElement> = {
        inventory: <><path d="M4 7h16v13H4z" /><path d="M7 4h10v3M8 11h8" /></>,
        loans: <><path d="M5 6h14v14H5z" /><path d="M8 3v6M16 3v6M8 13h8" /></>,
        appointments: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h3M13 14h3" /></>,
        feedback: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
        announcements: <><path d="m4 13 3-2V7l10-4v16L7 15v-4" /><path d="M7 15v5h4v-4" /></>,
        history: <><path d="M4 12a8 8 0 1 0 2-5.3L4 9" /><path d="M4 4v5h5M12 8v5l3 2" /></>,
        settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7L0 10.5v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2.3h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z" transform="translate(2 -1) scale(.83)" /></>,
    };
    return <svg className="admin-nav-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function AdminLayout({ children }: PropsWithChildren) {
    const page = usePage<SharedProps>();
    const { auth, flash, features, staffAnnouncements, staffAnnouncementUnreadCount } = page.props;
    const path = page.url.split('?')[0];
    const can = (permission: string) => auth.user.permissions.includes(permission);
    const preferences = auth.user.interfacePreferences;
    const [sidebarWidth, setSidebarWidth] = useState(storedSidebarWidth);
    const [collapsed, setCollapsed] = useState(preferences.sidebar === 'narrow');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [resizing, setResizing] = useState(false);
    const widthRef = useRef(sidebarWidth);
    const previousTheme = useRef(preferences.theme);
    const themeTimer = useRef<number | null>(null);

    useEffect(() => { setCollapsed(preferences.sidebar === 'narrow'); }, [preferences.sidebar]);
    useEffect(() => {
        if (previousTheme.current === preferences.theme) return;
        previousTheme.current = preferences.theme;
        document.documentElement.classList.add('theme-transitioning');
        if (themeTimer.current !== null) window.clearTimeout(themeTimer.current);
        themeTimer.current = window.setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 240);
    }, [preferences.theme]);
    useEffect(() => () => {
        if (themeTimer.current !== null) window.clearTimeout(themeTimer.current);
        document.documentElement.classList.remove('theme-transitioning');
    }, []);
    useEffect(() => {
        document.documentElement.dataset.adminScale = preferences.scale;
        return () => { delete document.documentElement.dataset.adminScale; };
    }, [preferences.scale]);
    useEffect(() => { setMobileOpen(false); }, [path]);
    useEffect(() => {
        if (!mobileOpen) return;
        const close = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false);
        document.body.classList.add('admin-menu-open');
        window.addEventListener('keydown', close);
        return () => { document.body.classList.remove('admin-menu-open'); window.removeEventListener('keydown', close); };
    }, [mobileOpen]);

    const saveWidth = (width: number) => { const next = clamp(width); widthRef.current = next; setSidebarWidth(next); localStorage.setItem(WIDTH_KEY, String(next)); };
    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        router.put('/yonetim/ayarlar/kisisel', { ...preferences, sidebar: next ? 'narrow' : 'wide' }, { preserveScroll: true, preserveState: true });
    };
    const resizeMove = (event: PointerEvent<HTMLDivElement>) => { if (resizing) { widthRef.current = clamp(event.clientX); setSidebarWidth(widthRef.current); } };
    const resizeEnd = (event: PointerEvent<HTMLDivElement>) => { if (!resizing) return; setResizing(false); event.currentTarget.releasePointerCapture(event.pointerId); saveWidth(widthRef.current); };
    const resizeKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); saveWidth(sidebarWidth + (event.key === 'ArrowRight' ? 10 : -10)); }
        if (event.key === 'Home') { event.preventDefault(); saveWidth(DEFAULT_WIDTH); }
    };

    const home = can('appointments.view') && features.onlineBooking ? '/yonetim/randevular'
        : can('printers.manage_schedule') && features.onlineBooking ? '/yonetim/takvim'
            : can('loans.view') ? '/yonetim/teslimler'
                : can('inventory.view') ? '/yonetim/envanter'
                    : can('feedback.view') ? '/yonetim/talepler'
                        : can('announcements.view') || can('staff_announcements.view') ? '/yonetim/duyurular'
                            : can('roles.view') || can('users.view') ? '/yonetim/yetkiler'
                                : can('audit_logs.view') ? '/yonetim/islem-gecmisi'
                                    : '/yonetim/ayarlar';
    const navItems: NavItem[] = [
        can('inventory.view') && { href: '/yonetim/envanter', label: 'Malzeme envanteri', icon: 'inventory', active: path.includes('/envanter') },
        can('loans.view') && { href: '/yonetim/teslimler', label: 'Teslim ve iadeler', icon: 'loans', active: path.includes('/teslimler') },
        features.onlineBooking && can('appointments.view') && { href: '/yonetim/randevular', label: 'Randevular', icon: 'appointments', active: path.includes('/randevular') },
        features.onlineBooking && can('printers.manage_schedule') && { href: '/yonetim/takvim', label: 'Randevu takvimi', icon: 'calendar', active: path.includes('/takvim') },
        can('feedback.view') && { href: '/yonetim/talepler', label: 'Talepler', icon: 'feedback', active: path.includes('/talepler') },
        (can('announcements.view') || can('staff_announcements.view')) && { href: '/yonetim/duyurular', label: 'Duyurular', icon: 'announcements', active: path.includes('/duyurular'), count: staffAnnouncementUnreadCount },
        can('audit_logs.view') && { href: '/yonetim/islem-gecmisi', label: 'İşlem geçmişi', icon: 'history', active: path.includes('/islem-gecmisi') },
        { href: '/yonetim/ayarlar', label: 'Ayarlar', icon: 'settings', active: path.startsWith('/yonetim/ayarlar') || path.includes('/yetkiler') },
    ].filter(Boolean) as NavItem[];
    const style = { '--admin-sidebar-width': `${collapsed ? 82 : sidebarWidth}px` } as CSSProperties;

    return <div className={`admin-page theme-${preferences.theme} scale-${preferences.scale} density-${preferences.density} ${collapsed ? 'sidebar-collapsed' : ''} ${resizing ? 'sidebar-resizing' : ''}`} style={style}>
        <header className="admin-mobile-bar"><Link className="admin-mobile-brand" href={home}><img src="/logo.jpg" alt="" /><strong>Sparkoff</strong></Link><button type="button" aria-expanded={mobileOpen} aria-controls="admin-navigation" onClick={() => setMobileOpen(!mobileOpen)}><span /> <span /> <span /><b>{mobileOpen ? 'Menüyü kapat' : 'Menüyü aç'}</b></button></header>
        {mobileOpen && <button className="admin-sidebar-overlay" type="button" aria-label="Menüyü kapat" onClick={() => setMobileOpen(false)} />}
        <aside className={`admin-sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Yönetim menüsü">
            <div className="admin-sidebar-head"><Link className="admin-brand" href={home}><img src="/logo.jpg" alt="Sparkoff logosu" /><span><strong>Sparkoff</strong><small>Yönetim Paneli</small></span></Link><button className="admin-sidebar-collapse" type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'} title={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}><svg viewBox="0 0 20 20" aria-hidden="true"><path d={collapsed ? 'm7 4 6 6-6 6' : 'm13 4-6 6 6 6'} /></svg></button></div>
            <nav id="admin-navigation">{navItems.map((item) => <Link className={item.active ? 'active' : ''} href={item.href} key={item.href} title={collapsed ? item.label : undefined}><MenuIcon name={item.icon} /><span>{item.label}</span>{Boolean(item.count) && <b className="admin-nav-count">{item.count}</b>}</Link>)}</nav>
            <div className="admin-user"><div><strong>{auth.user.name}</strong><small>{auth.user.roles.join(', ') || auth.user.email}</small></div><button type="button" onClick={() => router.post('/yonetim/cikis')} title="Çıkış yap"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 4H3v12h5M12 6l4 4-4 4M6 10h10" /></svg><span>Çıkış yap</span></button></div>
            <div className="admin-sidebar-resizer" role="separator" aria-label="Menü genişliğini ayarla" aria-orientation="vertical" aria-valuemin={MIN_WIDTH} aria-valuemax={MAX_WIDTH} aria-valuenow={sidebarWidth} tabIndex={collapsed ? -1 : 0} onDoubleClick={() => saveWidth(DEFAULT_WIDTH)} onKeyDown={resizeKey} onPointerDown={(event) => { if (collapsed) return; setResizing(true); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={resizeMove} onPointerUp={resizeEnd} onPointerCancel={resizeEnd} />
        </aside>
        <main className="admin-content">
            {flash.success && <div className="admin-flash success">{flash.success}</div>}{flash.warning && <div className="admin-flash warning">{flash.warning}</div>}
            {staffAnnouncements.filter((announcement) => !announcement.isRead).map((announcement) => <section className={`staff-announcement staff-${announcement.type}`} key={announcement.id}><div><span>{announcement.isPinned ? 'SABİTLENMİŞ DUYURU' : 'YÖNETİM DUYURUSU'}</span><strong>{announcement.title}</strong><p>{announcement.body}</p></div><button type="button" onClick={() => router.post(`/yonetim/duyurular/${announcement.id}/okundu`, {}, { preserveScroll: true })}>{announcement.requiresAcknowledgement ? 'Okudum, onaylıyorum' : 'Okundu işaretle'}</button></section>)}
            {children}
        </main>
    </div>;
}
