import React, { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError, api, setCsrf } from './api';
import { getDemoRole, resetDemo, setDemoRole } from './demo';
import { AdminAnnouncements, AdminFeedback, AdminInventory, AdminMembers, AdminPrinters, AdminTasks, AdminWorkshop, AdminPrivacy, AdminBookingSettings } from './admin';
import { Backdrop, Badge, BrandLogo, Button, Card, Empty, Icon, type IconName, Screen, Sheet, ThemeProvider, useTheme, formatQuantity, roleLabel, taskStatusLabel } from './ui/kit';
import { GraphyBars } from './ui/Graphy';
import type { Permission, Tab } from '../shared/schema';
import { defaultInterfacePreferences, interfacePreferences, type InterfacePreferences } from './preferences';
import { PublicMaterials } from './public-materials';
import { canOpenAdmin, canOpenAdminAnnouncements, canOpenAdminInventory, canOpenAdminMembers, canOpenAdminPrinters, firstAdminRoute } from './navigation';
import './style.css';

type Me = { user: { id: number; name: string; email: string; role: string; preferences: unknown }; tabs: Tab[]; permissions: Permission[]; scopes: { manageIds: number[]; accessIds: number[]; viewIds: number[] } };
const publicNav = [['/', 'Ana sayfa'], ['/yazicilar', 'Yazıcılar'], ['/randevu', 'Randevu'], ['/malzemeler', 'Malzemeler'], ['/geri-bildirim', 'Geri bildirim']];
const memberNav: [string, string, Tab][] = [['/app/home', 'Ana sayfa', 'home'], ['/app/tasks', 'Görevler', 'tasks'], ['/app/chat', 'Sohbet', 'chat'], ['/app/announcements', 'Duyurular', 'announcements'], ['/app/inventory', 'Envanter', 'inventory']];
const adminNav: [string, string, Tab][] = [['/admin/overview', 'Genel bakış', 'board'], ['/admin/tasks', 'Görevler', 'tasks'], ['/admin/inventory', 'Envanter', 'inventory'], ['/admin/printers', 'Yazıcılar', 'board'], ['/admin/chat', 'Sohbet', 'chat'], ['/admin/members', 'Üyeler', 'members'], ['/admin/announce', 'Duyurular', 'announcements'], ['/admin/feedback', 'Geri bildirimler', 'board'], ['/admin/workshop', 'Atölye ve iletişim', 'board'], ['/admin/privacy', 'KVKK', 'board'], ['/admin/booking-settings', 'Randevu kuralları', 'board'], ['/admin/system', 'Sistem', 'board']];
function navIcon(path: string): IconName { if (path.includes('task')) return 'tasks'; if (path.includes('chat')) return 'chat'; if (path.includes('announce') || path.includes('feedback')) return 'announce'; if (path.includes('inventory')) return 'inventory'; if (path.includes('printer')) return 'printer'; if (path.includes('members')) return 'members'; if (path.includes('system')) return 'settings'; return 'home'; }
function usePath() { const [path, setPath] = useState(location.pathname); useEffect(() => { const change = () => setPath(location.pathname); addEventListener('popstate', change); return () => removeEventListener('popstate', change); }, []); const go = (to: string) => { history.pushState({}, '', to); setPath(to); window.scrollTo(0, 0); }; return [path, go] as const; }
function Link({ to, go, children, active }: { to: string; go: (s: string) => void; children: ReactNode; active?: boolean }) { return <a href={to} aria-current={active ? 'page' : undefined} onClick={e => { e.preventDefault(); go(to); }}>{children}</a>; }
function useData<T>(path: string, enabled = true, interval = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const reload = () => {
    if (!enabled) return;
    const current = ++requestId.current;
    api<T>(path).then(result => {
      if (current === requestId.current) { setData(result); setError(''); }
    }).catch(cause => {
      if (current === requestId.current) setError((cause as Error).message);
    });
  };
  useEffect(() => {
    setError('');
    reload();
    const worker = enabled && interval ? new Worker('/tick.js') : null;
    if (worker) {
      worker.onmessage = () => { if (!document.hidden) reload(); };
      worker.postMessage({ type: 'start', interval });
    }
    return () => { requestId.current++; worker?.terminate(); };
  }, [path, enabled, interval]);
  return { data, error, reload };
}
function Shell({ me, go, path, children, onLogout, onPreferences }: { me: Me; go: (s: string) => void; path: string; children: ReactNode; onLogout: () => Promise<void>; onPreferences: (preferences: unknown) => void }) {
  const [quick, setQuick] = useState(false); const [logoutError, setLogoutError] = useState(''); const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sparkoff-nav-closed') === '1'); const [width, setWidth] = useState(272); const [navSearch, setNavSearch] = useState('');
  const isAdmin = path.startsWith('/admin'); const privileged = me.user.role === 'super_admin'; const systemAccess = me.permissions.includes('audit_logs_view') || me.permissions.includes('privacy_settings_update'); const nav = (isAdmin ? adminNav : memberNav).filter(([route, , tab]) => (route !== '/admin/system' || systemAccess) && (route !== '/admin/feedback' || me.permissions.includes('feedback_view')) && (route !== '/admin/inventory' || canOpenAdminInventory(me)) && (route !== '/admin/members' || canOpenAdminMembers(me)) && (route !== '/admin/printers' || canOpenAdminPrinters(me)) && (route !== '/admin/workshop' || me.permissions.includes('workshop_settings_update')) && (route !== '/admin/privacy' || me.permissions.includes('privacy_settings_update')) && (route !== '/admin/booking-settings' || me.permissions.includes('system_settings_update')) && (route !== '/admin/announce' || canOpenAdminAnnouncements(me)) && (privileged || me.tabs.includes(tab) || route === '/admin/system' && systemAccess || route === '/admin/feedback' && me.permissions.includes('feedback_view') || route === '/admin/workshop' && me.permissions.includes('workshop_settings_update') || route === '/admin/privacy' && me.permissions.includes('privacy_settings_update') || route === '/admin/booking-settings' && me.permissions.includes('system_settings_update') || route === '/admin/printers' && canOpenAdminPrinters(me) || route === '/admin/announce' && canOpenAdminAnnouncements(me)));
  const shownNav = nav.filter(([, label]) => label.toLocaleLowerCase('tr-TR').includes(navSearch.toLocaleLowerCase('tr-TR')));
  const { theme, setTheme } = useTheme();
  useEffect(() => { setCollapsed(interfacePreferences(me.user.preferences).sidebar === 'narrow'); }, [me.user.preferences]);
  useEffect(() => { localStorage.setItem('sparkoff-nav-closed', collapsed ? '1' : '0'); }, [collapsed]);
  useEffect(() => { setLogoutError(''); }, [path]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCollapsed(false); document.getElementById('nav-search')?.focus(); } }; addEventListener('keydown', key); return () => removeEventListener('keydown', key); }, []);
  const handleLogout = async () => {
    setLogoutError('');
    try { await onLogout(); setQuick(false); }
    catch { setLogoutError('Çıkış yapılamadı. Bağlantıyı kontrol edip yeniden deneyin.'); }
  };
  const startResize = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const start = event.clientX; const original = width;
    document.documentElement.classList.add('nav-resizing');
    const move = (e: PointerEvent) => { e.preventDefault(); setWidth(Math.min(360, Math.max(180, original + e.clientX - start))); };
    const end = () => { document.documentElement.classList.remove('nav-resizing'); removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); removeEventListener('blur', end); };
    addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end); addEventListener('blur', end);
  };
  return <div className="shell" style={{ '--sidebar-width': `${collapsed ? 78 : width}px` } as React.CSSProperties}>
    <aside className={`side-nav ${collapsed ? 'closed' : ''}`}><div className="brand"><BrandLogo/>{!collapsed && <strong>SPARKOFF</strong>}<button className="collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}>{collapsed ? '›' : '‹'}</button></div>{!collapsed && <div className="nav-search"><Icon name="search" size={18}/><input id="nav-search" aria-label="Sayfa ara" placeholder="Sayfa ara" value={navSearch} onChange={e => setNavSearch(e.target.value)}/><kbd>⌘K</kbd></div>}<nav aria-label="Ana menü"><p className="overline">ANA</p>{shownNav.slice(0, 2).map(([to, label]) => <Link key={to} to={to} go={go} active={path === to}><Icon name={navIcon(to)}/><span>{!collapsed && label}</span></Link>)}{shownNav.length > 2 && <p className="overline">ÇALIŞMA ALANI</p>}{shownNav.slice(2).map(([to, label]) => <Link key={to} to={to} go={go} active={path === to}><Icon name={navIcon(to)}/><span>{!collapsed && label}</span></Link>)}</nav><div className="side-bottom">{canOpenAdmin(me) && <Link to={isAdmin ? '/app/home' : firstAdminRoute(me)} go={go}><Icon name={isAdmin ? 'home' : 'chart'}/>{!collapsed && (isAdmin ? 'Üye ekranı' : 'Yönetim')}</Link>}<Link to="/app/profile" go={go}><Icon name="user"/>{!collapsed && 'Profilim'}</Link><button onClick={() => void handleLogout()}><Icon name="arrow"/>{!collapsed && 'Çıkış'}</button><div className="sn-user"><span className="avatar">{me.user.name.charAt(0)}</span>{!collapsed && <div><b>{me.user.name}</b><small>{roleLabel(me.user.role)}</small></div>}</div></div><div className="resize-handle" role="separator" aria-label="Menü genişliği" tabIndex={0} onPointerDown={startResize} onKeyDown={e => { if (e.key === 'ArrowRight') setWidth(Math.min(360, width + 10)); if (e.key === 'ArrowLeft') setWidth(Math.max(180, width - 10)); }}/></aside>
    <div className="shell-content"><div className="mobile-brand"><BrandLogo/><strong>SPARKOFF</strong></div>{children}</div>
    <nav className="mobile-island" aria-label="Mobil menü">{nav.slice(0, 2).map(([to, label]) => <Link key={to} to={to} go={go} active={path === to}><Icon name={navIcon(to)} size={22}/><span>{label}</span></Link>)}<button className="orb" onClick={() => setQuick(true)} aria-label="Hızlı menü">+</button>{nav.slice(2, 4).map(([to, label]) => <Link key={to} to={to} go={go} active={path === to}><Icon name={navIcon(to)} size={22}/><span>{label}</span></Link>)}</nav>
    {logoutError && <p className="logout-error" role="alert">{logoutError}</p>}
    <Sheet open={quick} onClose={() => setQuick(false)} title="Hızlı geçiş">
      <button className="profile-link" onClick={() => { go('/app/profile'); setQuick(false); }}>◉ &nbsp; Profilim ve ayarlarım</button>
      {canOpenAdmin(me) && <button className="quick-link" onClick={() => { go(isAdmin ? '/app/home' : firstAdminRoute(me)); setQuick(false); }}>{isAdmin ? 'Üye ekranı' : 'Yönetim'}</button>}
      {nav.map(([to, label]) => <button key={to} className="quick-link" aria-current={path === to ? 'page' : undefined} onClick={() => { go(to); setQuick(false); }}>{label}</button>)}
      <button className="quick-link" onClick={async () => { const next: InterfacePreferences = { ...interfacePreferences(me.user.preferences), theme: theme === 'dark' ? 'light' : 'dark' }; try { const result = await api<{ preferences: unknown }>('/org/preferences/interface', { method: 'PATCH', body: JSON.stringify(next) }); onPreferences(result.preferences); setTheme(next.theme); } catch { go('/app/profile'); } setQuick(false); }}>{theme === 'dark' ? 'Arka plan ışıklarını kıs' : 'Arka plan ışıklarını aç'}</button>
      <button className="quick-link" onClick={() => void handleLogout()}>Çıkış yap</button>
    </Sheet>
  </div>;
}
function PublicLayout({ go, path, children }: { go: (s: string) => void; path: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [path]);
  return <div className="public-layout"><header className="public-header">
    <Link to="/" go={go}><BrandLogo/> SPARKOFF</Link>
    <button className="public-menu-toggle" type="button" aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'} aria-controls="public-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span/><span/><span/></button>
    <nav id="public-navigation" className={menuOpen ? 'open' : ''} aria-label="Ziyaretçi menüsü">{publicNav.map(([to, label]) => <Link key={to} to={to} go={go} active={path === to}>{label}</Link>)}<span className="public-mobile-login"><Link to="/giris" go={go} active={path === '/giris'}>Üye girişi ↗</Link></span></nav>
    <Link to="/giris" go={go}>Üye girişi ↗</Link>
  </header>{children}<footer className="public-footer"><span>Sparkoff</span><Link to="/geri-bildirim" go={go}>Bir fikrin mi var? Yaz bize ↗</Link><Link to="/kvkk" go={go}>KVKK</Link></footer></div>;
}
function PublicContactCard({ contact }: { contact: { phone: string; whatsapp: string; email: string; contactHours: string } }) {
  const phone = contact.phone?.trim();
  const whatsapp = contact.whatsapp?.trim();
  const email = contact.email?.trim();
  const hours = contact.contactHours?.trim();
  const phoneDigits = phone?.replace(/\D/g, '') || '';
  const phoneHref = phoneDigits.length >= 7 ? `tel:${phone?.startsWith('+') ? '+' : ''}${phoneDigits}` : null;
  const whatsappDigits = whatsapp?.replace(/\D/g, '') || '';
  const whatsappInternational = whatsappDigits.length === 11 && whatsappDigits.startsWith('0') ? `90${whatsappDigits.slice(1)}` : whatsappDigits;
  if (!phone && !whatsapp && !email && !hours) return null;
  return <Card title="İletişim" className="public-contact">
    <p className="contact-intro">Atölyeye ulaşmak için size uygun kanalı seçin.</p>
    <div className="contact-channels">
      {phone && <div className="contact-channel"><span className="contact-label">Telefon</span><strong>{phone}</strong>{phoneHref && <a href={phoneHref} aria-label={`${phone} numarasını ara`}>Ara <span aria-hidden="true">↗</span></a>}</div>}
      {whatsapp && <div className="contact-channel"><span className="contact-label">WhatsApp</span><strong>{whatsapp}</strong>{whatsappInternational && <a href={`https://wa.me/${whatsappInternational}`} target="_blank" rel="noopener noreferrer" aria-label={`${whatsapp} numarasına WhatsApp mesajı gönder`}>Mesaj gönder <span aria-hidden="true">↗</span></a>}</div>}
      {email && <div className="contact-channel"><span className="contact-label">E-posta</span><strong>{email}</strong><a href={`mailto:${email}`} aria-label={`${email} adresine e-posta gönder`}>E-posta yaz <span aria-hidden="true">↗</span></a></div>}
    </div>
    {hours && <p className="contact-hours"><span>İletişim saatleri</span><strong>{hours}</strong></p>}
  </Card>;
}
function WorkshopArt() { return <div className="hero-art"><div className="hero-orbit"/><svg viewBox="0 0 440 330" role="img" aria-label="3D yazıcı ve üretim modeli illüstrasyonu"><defs><linearGradient id="art-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C9D1E4" stopOpacity=".9"/><stop offset="1" stopColor="#7B8DE8" stopOpacity=".45"/></linearGradient><linearGradient id="art-print" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F4DC93"/><stop offset=".6" stopColor="#F4A48C"/><stop offset="1" stopColor="#CB7792"/></linearGradient><linearGradient id="art-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".18"/><stop offset="1" stopColor="#FFFFFF" stopOpacity=".03"/></linearGradient></defs><ellipse cx="220" cy="291" rx="175" ry="25" fill="#070E20" opacity=".44"/><path d="M86 53h268l-23 217H109L86 53Z" fill="url(#art-glass)" stroke="url(#art-frame)" strokeWidth="4"/><path d="M86 53 113 32h214l27 21H86Z" fill="#344264" stroke="url(#art-frame)" strokeWidth="4"/><path d="M109 269h222l18 19H91l18-19Z" fill="#283653" stroke="url(#art-frame)" strokeWidth="3"/><path d="M123 88h194M131 88v154M309 88v154" stroke="#9BA9CE" strokeOpacity=".8" strokeWidth="4" strokeLinecap="round"/><path d="M133 107h175" stroke="#B9C6F5" strokeWidth="6" strokeLinecap="round"/><rect x="197" y="98" width="48" height="27" rx="8" fill="#3B496B" stroke="#D5DCEF" strokeWidth="3"/><path d="M211 125h20l-4 17h-12l-4-17Z" fill="#AEBBE1"/><path d="M221 141v25" stroke="#F4A48C" strokeWidth="3" strokeDasharray="4 5"/><path d="M130 242h180l-17 16H147l-17-16Z" fill="#576684" stroke="#B9C6F5" strokeWidth="2"/><path d="m168 235 20-59 34-26 31 26 19 59H168Z" fill="url(#art-print)" stroke="#FFD7AF" strokeWidth="3"/><path d="m188 176 34 22 31-22M222 198v37M168 235h104" fill="none" stroke="#FFE4BB" strokeWidth="3" opacity=".72"/><circle cx="222" cy="68" r="6" fill="#A8DEC5"/><circle cx="310" cy="76" r="4" fill="#F4A48C"/><path d="M115 69h58M271 69h52" stroke="#A5B4D3" strokeOpacity=".6" strokeWidth="2"/></svg></div>; }
function bookingDate(offset: number) {
  const day = new Date(Date.now() + offset * 86_400_000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(day).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function BookingPage({ go }: { go: (s: string) => void }) {
  const config = useData<{ enabled: boolean; slotMinutes?: number; maximumDurationHours?: number; maximumFileSizeMb?: number; allowedExtensions?: string[]; noticeVersion?: string }>('/printers/booking-config');
  const printers = useData<{ filaments: { id: number; name: string; color: string | null; available: boolean }[] }>('/printers/public', Boolean(config.data?.enabled));
  const [date, setDate] = useState(() => bookingDate(0));
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [printerId, setPrinterId] = useState(0);
  const [startTime, setStartTime] = useState('');
  const [availability, setAvailability] = useState<{ printers: { id: number; name: string; slots: string[] }[] } | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [refreshAvailability, setRefreshAvailability] = useState(0);
  const [filamentSource, setFilamentSource] = useState<'workshop' | 'own'>('workshop');
  const [filamentId, setFilamentId] = useState(0);
  const [material, setMaterial] = useState('');
  const [color, setColor] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [privacyNoticeSeen, setPrivacyNoticeSeen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<{ publicId: string; email: string } | null>(null);
  useEffect(() => { if (config.data?.slotMinutes) setDurationMinutes(config.data.slotMinutes); }, [config.data?.slotMinutes]);
  useEffect(() => {
    setAvailability(null); setAvailabilityError(''); setPrinterId(0); setStartTime('');
    if (!config.data?.enabled || !date || !durationMinutes) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ printers: { id: number; name: string; slots: string[] }[] }>(`/printers/availability?date=${date}&durationMinutes=${durationMinutes}`, { signal: controller.signal })
        .then(setAvailability).catch(err => { if (err.name !== 'AbortError') setAvailabilityError(err.message); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [config.data?.enabled, date, durationMinutes, refreshAvailability]);
  if (config.error) return <Screen title="Randevu"><Card><p role="alert">{config.error}</p></Card></Screen>;
  if (!config.data) return <Screen title="Randevu"><Card><p>Randevu bilgileri yükleniyor…</p></Card></Screen>;
  if (!config.data.enabled) return <Screen title="Randevu" subtitle="Çevrimiçi başvuru henüz açılmadı."><Card><p>Randevu sistemi güvenli kabul testleri tamamlandığında açılacak.</p><Button onClick={() => go('/yazicilar')}>Yazıcıları incele</Button></Card></Screen>;
  if (submitted) return <Screen title="Talebiniz alındı"><Card><p>{submitted.email} adresine doğrulama bağlantısı gönderdik. Bağlantıyı süresi dolmadan açarak talebinizi yönetici incelemesine iletin.</p><p>Başvuru numarası: <strong>{submitted.publicId}</strong></p></Card></Screen>;
  const slots = availability?.printers.find(item => item.id === printerId)?.slots ?? [];
  return <Screen title="3D yazıcı randevusu" subtitle="Uygun saat seçip baskı dosyanızı gönderin."><Card><form onSubmit={async e => {
    e.preventDefault();
    if (!file || !printerId || !startTime) { setError('Yazıcı, saat ve model dosyası seçin.'); return; }
    const form = new FormData();
    for (const [key, value] of Object.entries({ printerId, date, startTime, durationMinutes, filamentSource, firstName, lastName, email, rulesAccepted, privacyNoticeSeen })) form.set(key, String(value));
    if (filamentSource === 'workshop') form.set('filamentId', String(filamentId));
    else { form.set('material', material); form.set('color', color); }
    form.set('file', file);
    setBusy(true); setError('');
    try { setSubmitted(await api<{ publicId: string; email: string }>('/printers/request', { method: 'POST', body: form })); }
    catch (err) { setError((err as Error).message); if ((err as Error).message.includes('müsait')) setRefreshAvailability(value => value + 1); }
    finally { setBusy(false); }
  }}>
    <div className="grid"><label>Tarih<input type="date" value={date} min={bookingDate(0)} max={bookingDate(6)} onChange={e => setDate(e.target.value)} required/></label><label>Baskı süresi (dakika)<input type="number" min={config.data.slotMinutes} max={(config.data.maximumDurationHours ?? 24) * 60} step={config.data.slotMinutes} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} required/></label></div>
    {availabilityError && <p role="alert">{availabilityError}</p>}
    {availability && availability.printers.every(item => item.slots.length === 0) && <p className="muted">Bu tarih ve süre için uygun saat yok. Başka bir gün veya süre seçin.</p>}
    {printers.error && <p role="alert">{printers.error}</p>}
    <div className="grid"><label>Yazıcı<select value={printerId || ''} onChange={e => { setPrinterId(Number(e.target.value)); setStartTime(''); }} required><option value="">Yazıcı seçin</option>{availability?.printers.map(item => <option key={item.id} value={item.id} disabled={!item.slots.length}>{item.name}{!item.slots.length ? ' · uygun saat yok' : ''}</option>)}</select></label><label>Başlangıç saati<select value={startTime} onChange={e => setStartTime(e.target.value)} required><option value="">Saat seçin</option>{slots.map(slot => <option key={slot} value={slot}>{slot}</option>)}</select></label></div>
    <label>Filament kaynağı<select value={filamentSource} onChange={e => setFilamentSource(e.target.value as 'workshop' | 'own')}><option value="workshop">Atölye filamenti</option><option value="own">Kendi filamentim</option></select></label>
    {filamentSource === 'workshop' ? <label>Atölye filamenti<select value={filamentId || ''} onChange={e => setFilamentId(Number(e.target.value))} required><option value="">Filament seçin</option>{printers.data?.filaments.filter(item => item.available).map(item => <option key={item.id} value={item.id}>{item.name} · {item.color}</option>)}</select></label> : <div className="grid"><label>Malzeme<input value={material} maxLength={40} onChange={e => setMaterial(e.target.value)} required/></label><label>Renk<input value={color} maxLength={80} onChange={e => setColor(e.target.value)} required/></label></div>}
    <label>Baskı dosyası ({config.data.allowedExtensions?.map(item => `.${item}`).join(', ')}, en fazla {config.data.maximumFileSizeMb} MB)<input type="file" accept={config.data.allowedExtensions?.map(item => `.${item}`).join(',')} onChange={e => setFile(e.target.files?.[0] || null)} required/></label>
    <div className="grid"><label>Ad<input value={firstName} maxLength={100} onChange={e => setFirstName(e.target.value)} required/></label><label>Soyad<input value={lastName} maxLength={100} onChange={e => setLastName(e.target.value)} required/></label></div>
    <label>E-posta<input type="email" value={email} maxLength={255} onChange={e => setEmail(e.target.value)} required/></label>
    <label><input type="checkbox" checked={rulesAccepted} onChange={e => setRulesAccepted(e.target.checked)} required/>Randevu kurallarını okudum; başvurunun yönetici onayından sonra kesinleşeceğini biliyorum.</label>
    <label><input type="checkbox" checked={privacyNoticeSeen} onChange={e => setPrivacyNoticeSeen(e.target.checked)} required/><a href="/kvkk" target="_blank" rel="noopener noreferrer">KVKK aydınlatma metnini</a> (sürüm {config.data.noticeVersion}) gördüm.</label>
    <p className="muted">KVKK bilgilendirmesi açık rıza talebi değildir.</p>
    {error && <p role="alert">{error}</p>}<Button type="submit" disabled={busy || !availability}>Talebi gönder</Button>
  </form></Card></Screen>;
}
function PublicPage({ path, go }: { path: string; go: (s: string) => void }) {
  const printers = useData<{ printers: { id: number; name: string; status: string }[]; filaments: { id: number; name: string; color: string; brand?: string | null; diameterMm?: string; available?: boolean; unavailableReason?: string | null }[] }>('/printers/public', path === '/yazicilar');
  const news = useData<{ announcements: { id: number; title: string; body: string }[] }>('/announce/public', path === '/');
  const printerNews = useData<{ announcements: { id: number; title: string; body: string }[] }>('/announce/public?placement=printers', path === '/yazicilar');
  const workshop = useData<{ contact: { phone: string; whatsapp: string; email: string; contactHours: string } }>('/workshop', path === '/');
  const privacy = useData<{ controllerName: string; controllerAddress: string; contactEmail: string; appointmentRetentionMonths: number; fileRetentionDays: number; noticeVersion: string; isDraft: boolean }>('/public/privacy', path === '/kvkk');
  const [feedback, setFeedback] = useState(''); const [kind, setKind] = useState('suggestion'); const [feedbackImage, setFeedbackImage] = useState<File | null>(null); const [sent, setSent] = useState(false); const [error, setError] = useState('');
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const feedbackSubmitting = useRef(false);
  useEffect(() => { setSent(false); setError(''); }, [path]);
  if (path === '/') return <main className="screen public-home"><div className="hero"><div className="hero-copy"><span className="eyebrow">SPARKOFF</span><h2>Fikirlerin<br/><em>hayat bulduğu yer.</em></h2><p>Üretmek, denemek ve paylaşmak için bir araya gel. Atölyedeki yazıcıları ve malzemeleri keşfet.</p><div className="hero-actions"><Button onClick={() => go('/yazicilar')}>Yazıcıları keşfet <Icon name="arrow" size={18}/></Button><Button variant="quiet" onClick={() => go('/malzemeler')}>Malzemelere bak</Button></div></div><WorkshopArt/></div><div className="grid"><Card title="3D yazıcılar" className="feature-card"><div className="tile-icon"><Icon name="printer"/></div><p>Yazıcıların durumunu ve uygun filamentleri gör.</p><Button variant="quiet" onClick={() => go('/yazicilar')}>Yazıcıları aç →</Button></Card><Card title="Malzeme kataloğu" className="feature-card"><div className="tile-icon"><Icon name="inventory"/></div><p>Üretim için ihtiyacın olanları atölyede bul.</p><Button variant="quiet" onClick={() => go('/malzemeler')}>Kataloğa git →</Button></Card><Card title="Bize yaz" className="feature-card"><div className="tile-icon"><Icon name="chat"/></div><p>Önerini paylaş, bir sorunu veya fikrini ilet.</p><Button variant="quiet" onClick={() => go('/geri-bildirim')}>Geri bildirim →</Button></Card></div><Card title="Atölyeden haberler" className="news-card">{news.data?.announcements.length ? news.data.announcements.map(a => <article key={a.id} className="list-item"><strong>{a.title}</strong><p>{a.body}</p></article>) : <Empty>Henüz duyuru yok.</Empty>}</Card>{workshop.data && <PublicContactCard contact={workshop.data.contact}/>}</main>;
  if (path === '/kvkk') return <Screen title="3D yazıcı randevu başvuruları" subtitle={privacy.data ? `KVKK aydınlatma metni · Sürüm ${privacy.data.noticeVersion}` : 'KVKK aydınlatma metni'}>
    {privacy.error && <Card><p role="alert">{privacy.error}</p></Card>}
    {privacy.data && <div className="legal-document">
      {privacy.data.isDraft && <Card><Badge tone="warn">Bu metin yönetici tarafından taslak olarak işaretlenmiştir.</Badge></Card>}
      <Card title="Veri sorumlusu ve iletişim"><p>Randevu başvurusu kapsamında işlenen kişisel veriler bakımından veri sorumlusu: <strong>{privacy.data.controllerName}</strong>.</p>{privacy.data.controllerAddress && <p>Adres: {privacy.data.controllerAddress}</p>}<p>Başvuru ve bilgi talepleri: <a href={`mailto:${privacy.data.contactEmail}`}>{privacy.data.contactEmail}</a></p></Card>
      <Card title="İşlenen bilgiler"><p>Ad, soyad ve e-posta adresi; seçilen tarih, saat ve süre; yüklenen 3D model dosyası; filamentin kullanıcıya mı atölyeye mi ait olduğu ile filament türü ve rengi işlenir. Telefon numarası ve serbest açıklama alınmaz.</p></Card>
      <Card title="İşleme amacı"><p>Bilgiler randevu talebini doğrulamak, baskının teknik uygunluğunu değerlendirmek, uygun yazıcı ve zamanı planlamak, başvurunun durumunu e-posta ile bildirmek ve atölye işleyişini yürütmek amacıyla kullanılır.</p></Card>
      <Card title="Toplama yöntemi ve hukuki sebep"><p>Veriler, randevu formunun kullanıcı tarafından doldurulması yoluyla elektronik ortamda elde edilir. İşleme faaliyeti; talep edilen atölye hizmetinin kurulması ve yürütülmesi ile hizmetin güvenli ve düzenli biçimde planlanmasına ilişkin meşru menfaatler kapsamında, 6698 sayılı Kanun’un 5. maddesindeki ilgili işleme şartlarına dayanır.</p></Card>
      <Card title="Aktarım ve güvenlik"><p>Bilgiler herkese açık takvimde yayımlanmaz. Yalnızca yetkili yöneticiler erişebilir. Barındırma ve e-posta hizmeti sağlayıcıları, hizmetin teknik olarak sunulması ölçüsünde verilere erişebilir.</p></Card>
      <Card title="Saklama süresi"><p>Sonlanmış randevu kayıtları, randevu bitişinden itibaren en fazla {privacy.data.appointmentRetentionMonths} ay; yüklenen baskı dosyaları ise yükleme tarihinden itibaren en fazla {privacy.data.fileRetentionDays} gün saklanır. Devam eden hizmete ait kayıtlar işlem sonuçlanıncaya kadar korunur. Hukuki bir zorunluluk veya uyuşmazlık bulunması hâlinde ilgili kayıtlar tanımlanan istisna süresi boyunca saklanabilir.</p></Card>
      <Card title="Haklarınız"><p>6698 sayılı Kanun’un 11. maddesi kapsamındaki bilgi edinme, düzeltme, silme ve diğer taleplerinizi yukarıdaki iletişim adresine iletebilirsiniz.</p></Card>
    </div>}
  </Screen>;
  if (path === '/yazicilar') return <Screen title="3D yazıcılar" subtitle="Yazıcı durumu ve kullanılabilir filamentler."><div className="grid">{printers.data?.printers.map(p => <Card key={p.id} title={p.name}><Badge tone={p.status === 'active' ? 'good' : 'warn'}>{p.status === 'active' ? 'Kullanılabilir' : p.status === 'maintenance' ? 'Bakımda' : 'Pasif'}</Badge></Card>)}</div><Card title="Filamentler">{printers.data?.filaments.map(f => <div className="list-item" key={f.id}><strong>{f.name} · {f.color}</strong><p>{[f.brand, f.diameterMm ? `${f.diameterMm} mm` : null].filter(Boolean).join(' · ')}</p>{f.available === false && <Badge tone="warn">{f.unavailableReason || 'Kullanılamıyor'}</Badge>}</div>)}</Card>{printerNews.data && printerNews.data.announcements.length > 0 && <Card title="Yazıcı duyuruları">{printerNews.data.announcements.map(item => <article className="list-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p></article>)}</Card>}</Screen>;
  if (path === '/malzemeler') return <PublicMaterials/>;
  if (path !== '/geri-bildirim') return <Screen title="Sayfa bulunamadı"><Card><Button onClick={() => go('/')}>Ana sayfaya dön</Button></Card></Screen>;
  return <Screen title="Geri bildirim" subtitle="Öneri, şikâyet veya hata bildirin."><Card><form onSubmit={async (e: FormEvent) => {
    e.preventDefault();
    if (feedbackSubmitting.current) return;
    feedbackSubmitting.current = true;
    setFeedbackBusy(true);
    const element = e.currentTarget as HTMLFormElement;
    try {
      const form = new FormData();
      form.set('kind', kind);
      form.set('message', feedback);
      if (feedbackImage) form.set('image', feedbackImage);
      await api('/public/feedback', { method: 'POST', body: form });
      setSent(true);
      setFeedback('');
      setFeedbackImage(null);
      element.reset();
      setError('');
    } catch (err) { setSent(false); setError((err as Error).message); }
    finally { feedbackSubmitting.current = false; setFeedbackBusy(false); }
  }}><label>Tür<select value={kind} onChange={e => { setKind(e.target.value); setSent(false); }}><option value="suggestion">Öneri</option><option value="complaint">Şikâyet</option><option value="bug">Hata</option></select></label><label>Mesaj<textarea value={feedback} onChange={e => { setFeedback(e.target.value); setSent(false); }} required minLength={10} maxLength={3000}/></label><label>Görsel (isteğe bağlı, en fazla 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setFeedbackImage(e.target.files?.[0] || null); setSent(false); }}/></label>{error && <p role="alert">{error}</p>}{sent && <p role="status">Geri bildiriminiz alındı.</p>}<Button type="submit" disabled={feedbackBusy}>{feedbackBusy ? 'Gönderiliyor…' : 'Gönder'}</Button></form></Card></Screen>;
}
type TrackedAppointment = { publicId: string; status: string; statusLabel: string; printer: string | null; startsAt: string | null; endsAt: string | null; durationMinutes: number | null; filament: string; fileName: string | null; canCancel: boolean; history: { status: string; label: string; note: string | null; date: string }[] };
function VerifyAppointment({ path, go }: { path: string; go: (s: string) => void }) {
  const parts = path.split('/');
  const endpoint = `/printers/verification/${encodeURIComponent(parts[3] || '')}/${encodeURIComponent(parts[4] || '')}`;
  const { data, error } = useData<{ expired: boolean }>(endpoint);
  const [result, setResult] = useState<{ verified?: boolean; expired?: boolean; trackingUrl?: string; emailSent?: boolean } | null>(null);
  const [submitError, setSubmitError] = useState('');
  return <Screen title="Randevu doğrulama" subtitle="E-posta adresinizi doğrulayın."><Card>
    {error && <p role="alert">{error}</p>}
    {data?.expired || result?.expired ? <p>Doğrulama bağlantısının süresi dolmuş. Yeni bir randevu talebi oluşturabilirsiniz.</p> : null}
    {data && !data.expired && !result && <><p>Talebinizi yönetici incelemesine göndermek için doğrulamayı tamamlayın.</p><Button onClick={async () => { try { setResult(await api(endpoint, { method: 'POST' })); setSubmitError(''); } catch (err) { setSubmitError((err as Error).message); } }}>E-postamı doğrula</Button></>}
    {result?.verified && <><p>Adresiniz doğrulandı. Talebiniz yönetici incelemesinde.</p>{result.emailSent === false && <p role="alert">Takip e-postası gönderilemedi; takip bağlantınızı kaydedin.</p>}<Button onClick={() => go(result.trackingUrl!)}>Randevu durumunu görüntüle</Button></>}
    {submitError && <p role="alert">{submitError}</p>}
  </Card></Screen>;
}
function TrackAppointment({ path }: { path: string }) {
  const parts = path.split('/');
  const endpoint = `/printers/tracking/${encodeURIComponent(parts[3] || '')}/${encodeURIComponent(parts[4] || '')}`;
  const { data, error, reload } = useData<{ appointment: TrackedAppointment }>(endpoint);
  const [cancelError, setCancelError] = useState('');
  const appointment = data?.appointment;
  const date = (value: string | null) => value ? new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'long', timeStyle: 'short' }) : '—';
  return <Screen title="Randevu takibi" subtitle={appointment ? `Başvuru ${appointment.publicId}` : undefined}>
    {error && <Card><p role="alert">{error}</p></Card>}
    {appointment && <div className="grid"><Card title="Durum"><Badge tone={appointment.status === 'completed' ? 'good' : appointment.status === 'rejected' || appointment.status === 'canceled' ? 'bad' : 'warn'}>{appointment.statusLabel}</Badge><p>Yazıcı: {appointment.printer || '—'}</p><p>Başlangıç: {date(appointment.startsAt)}</p><p>Bitiş: {date(appointment.endsAt)}</p><p>Süre: {appointment.durationMinutes ?? '—'} dakika</p><p>Filament: {appointment.filament || '—'}</p><p>Model dosyası: {appointment.fileName || '—'}</p>{appointment.canCancel && <Button variant="quiet" onClick={async () => { if (!confirm('Randevu talebinizi iptal etmek istiyor musunuz?')) return; try { await api(endpoint + '/cancel', { method: 'POST' }); setCancelError(''); reload(); } catch (err) { setCancelError((err as Error).message); } }}>Talebi iptal et</Button>}{cancelError && <p role="alert">{cancelError}</p>}</Card><Card title="Durum geçmişi">{appointment.history.map((item, index) => <div className="list-item" key={index}><strong>{item.label}</strong><p>{item.note}</p><small>{date(item.date)}</small></div>)}</Card></div>}
  </Screen>;
}
function Login({ onLogin }: { onLogin: (me: Me) => void }) { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); return <div className="login"><Card><img className="login-logo" src="/logo.jpg" alt="Sparkoff logosu"/><h2>Sparkoff üye girişi</h2><form onSubmit={async e => { e.preventDefault(); try { const data = await api<{ csrfToken: string }>('/org/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setCsrf(data.csrfToken); onLogin(await api<Me>('/org/me')); } catch (err) { setError((err as Error).message); } }}><label>E-posta<input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></label><label>Parola<input type="password" value={password} onChange={e => setPassword(e.target.value)} required/></label>{error && <p role="alert">{error}</p>}<Button type="submit">Giriş yap</Button></form><p><a href="/aktivasyon">Aktivasyon kodum var →</a></p></Card></div>; }
function Activation({ onLogin }: { onLogin: (me: Me) => void }) { const [code, setCode] = useState(''); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); return <div className="login"><Card><img className="login-logo" src="/logo.jpg" alt="Sparkoff logosu"/><h2>Üyeliği etkinleştir</h2><form onSubmit={async e => { e.preventDefault(); try { const data = await api<{ csrfToken: string }>('/org/activate', { method: 'POST', body: JSON.stringify({ code, name, email, password }) }); setCsrf(data.csrfToken); onLogin(await api<Me>('/org/me')); } catch (err) { setError((err as Error).message); } }}><label>10 karakterli kod<input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={10} required/></label><label>Ad soyad<input value={name} onChange={e => setName(e.target.value)} required/></label><label>E-posta<input type="email" value={email} onChange={e => setEmail(e.target.value)} required/></label><label>Parola<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} required/></label><p className="muted">En az 12 karakter, büyük ve küçük harf ile rakam kullanın.</p>{error && <p role="alert">{error}</p>}<Button type="submit">Hesabı aç</Button></form><p><a href="/giris">Girişe dön</a></p></Card></div>; }
function Profile({ me, onPreferences }: { me: Me; onPreferences: (preferences: unknown) => void }) {
  const [settings, setSettings] = useState<InterfacePreferences>(() => interfacePreferences(me.user.preferences));
  useEffect(() => { setSettings(interfacePreferences(me.user.preferences)); }, [me.user.preferences]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async (method: 'PATCH' | 'DELETE') => {
    setSaving(true); setSettingsError(''); setSettingsMessage('');
    try {
      const result = await api<{ preferences: unknown }>('/org/preferences' + (method === 'PATCH' ? '/interface' : ''), { method, ...(method === 'PATCH' ? { body: JSON.stringify(settings) } : {}) });
      onPreferences(result.preferences);
      if (method === 'DELETE') setSettings(defaultInterfacePreferences);
      setSettingsMessage(method === 'PATCH' ? 'Görünüm ayarları kaydedildi.' : 'Görünüm ayarları ve kayıtlı filtreler sıfırlandı.');
    } catch (err) { setSettingsError((err as Error).message); }
    finally { setSaving(false); }
  };
  const field = <K extends keyof InterfacePreferences>(key: K, value: InterfacePreferences[K]) => setSettings(old => ({ ...old, [key]: value }));
  return <Screen title="Profilim ve ayarlarım" subtitle={me.user.email}><div className="grid">
    <Card title="Hesap"><p>{me.user.name} · <Badge>{roleLabel(me.user.role)}</Badge></p><p className="muted">Güvenilir cihazlar ve bildirim ayarları hazırlanıyor.</p></Card>
    <Card title="Görünüm ayarları"><form onSubmit={e => { e.preventDefault(); void save('PATCH'); }}>
      <label>Tema<select value={settings.theme} onChange={e => field('theme', e.target.value as InterfacePreferences['theme'])}><option value="dark">Koyu</option><option value="light">Açık</option><option value="system">Sistem</option></select></label>
      <label>Metin ölçeği<select value={settings.scale} onChange={e => field('scale', e.target.value as InterfacePreferences['scale'])}><option value="small">Küçük</option><option value="normal">Normal</option><option value="large">Büyük</option></select></label>
      <label>Yerleşim yoğunluğu<select value={settings.density} onChange={e => field('density', e.target.value as InterfacePreferences['density'])}><option value="comfortable">Rahat</option><option value="normal">Normal</option><option value="compact">Sıkı</option></select></label>
      <label>Yan menü<select value={settings.sidebar} onChange={e => field('sidebar', e.target.value as InterfacePreferences['sidebar'])}><option value="wide">Geniş</option><option value="narrow">Dar</option></select></label>
      {settingsError && <p role="alert">{settingsError}</p>}{settingsMessage && <p role="status">{settingsMessage}</p>}
      <div className="row"><Button type="submit" disabled={saving}>Kaydet</Button><Button variant="quiet" disabled={saving} onClick={() => void save('DELETE')}>Tercihleri sıfırla</Button></div>
    </form></Card>
    <Card title="Parolamı değiştir"><form onSubmit={async e => { e.preventDefault(); try { await api('/org/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }); setCsrf(''); location.assign('/giris'); } catch (err) { setError((err as Error).message); } }}><label>Mevcut parola<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required/></label><label>Yeni parola<input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} required/></label><p className="muted">En az 12 karakter, büyük ve küçük harf ile rakam.</p>{error && <p role="alert">{error}</p>}<Button type="submit">Parolayı değiştir</Button></form></Card>
  </div></Screen>;
}
function MemberPage({ path, me, onPreferences = () => {} }: { path: string; me: Me; onPreferences?: (preferences: unknown) => void }) {
  const canSeeTasks = me.tabs.includes('tasks');
  const canSeeAnnouncements = me.tabs.includes('announcements');
  const tasks = useData<{ tasks: { id: number; title: string; status: string; progress: number }[] }>('/tasks', canSeeTasks && (path.endsWith('/tasks') || path.endsWith('/home')), path.endsWith('/home') ? 30000 : 0);
  const announcements = useData<{ announcements: { id: number; title: string; body: string; requiresAcknowledgement: boolean; canAcknowledge: boolean; acknowledgedAt: string | null }[]; events: { id: number; title: string; startsAt: string }[] }>('/announce', canSeeAnnouncements && (path.endsWith('/announcements') || path.endsWith('/home')), path.endsWith('/home') ? 30000 : 0);
  const [announcementError, setAnnouncementError] = useState('');
  const [inventoryPage, setInventoryPage] = useState(1);
  const inventory = useData<{ materials: { id: number; name: string; quantity: string | null; availability: string; kind: string; unit: string }[]; total: number; page: number; pageSize: number }>(`/public/materials/search?page=${inventoryPage}&per_page=24`, path.endsWith('/inventory'));
  const [channels, setChannels] = useState<{ id: number; name: string }[]>([]); const [channelId, setChannelId] = useState(0); const [message, setMessage] = useState(''); const [messages, setMessages] = useState<{ id: number; body: string; userId: number }[]>([]);
  useEffect(() => { if (path.endsWith('/chat')) api<{ channels: { id: number; name: string }[] }>('/chat/channels').then(data => { setChannels(data.channels); setChannelId(id => id || data.channels[0]?.id || 0); }).catch(() => {}); }, [path]);
  useEffect(() => { if (!path.endsWith('/chat') || !channelId) return; let cursor = 0; const worker = new Worker('/tick.js'); const poll = () => api<{ messages: { id: number; body: string; userId: number }[]; cursor: number }>(`/chat/${channelId}/messages?since=${cursor}`).then(data => { cursor = data.cursor; setMessages(old => [...old, ...data.messages].slice(-100)); }).catch(() => {}); setMessages([]); poll(); worker.onmessage = () => { if (!document.hidden) poll(); }; worker.postMessage({ type: 'start', interval: 4000 }); return () => worker.terminate(); }, [path, channelId]);
  if (path.endsWith('/home')) return <Screen title={`Merhaba, ${me.user.name}`} subtitle="Atölyedeki güncel durumunuz.">{canSeeTasks || canSeeAnnouncements ? <><div className="grid">{canSeeTasks && <Card title="Aktif görevlerim"><strong className="big-number">{tasks.data ? tasks.data.tasks.filter(t => t.status !== 'done').length : '—'}</strong></Card>}{canSeeAnnouncements && <Card title="Yaklaşan etkinlikler"><strong className="big-number">{announcements.data ? announcements.data.events.length : '—'}</strong></Card>}</div>{canSeeAnnouncements && <Card title="Son duyurular">{announcements.data ? announcements.data.announcements.slice(0, 5).map(a => <p key={a.id}>{a.title}</p>) : null}{announcements.data && !announcements.data.announcements.length && <Empty>Duyuru yok.</Empty>}</Card>}</> : <Card><Empty>Üye ana sayfasında gösterebileceğiniz görev veya duyuru yok.</Empty></Card>}</Screen>;
  if (path.endsWith('/tasks')) return <Screen title="Görevlerim" subtitle="Atanan işler ve ilerleme."><Card>{tasks.data?.tasks.map(t => <div className="list-item task-item" key={t.id}><div className="resource-row"><div className="resource-copy"><strong>{t.title}</strong><p>İlerleme %{t.progress}</p></div><div className="resource-actions"><Badge tone={t.status === 'done' ? 'good' : 'warn'}>{taskStatusLabel(t.status)}</Badge></div></div><input aria-label={`${t.title} ilerleme`} type="range" min="0" max="100" value={t.progress} onChange={async e => { await api(`/tasks/${t.id}/progress`, { method: 'PATCH', body: JSON.stringify({ progress: Number(e.target.value) }) }); tasks.reload(); }}/></div>)}{!tasks.data?.tasks.length && <Empty>Atanmış görev yok.</Empty>}</Card></Screen>;
  if (path.endsWith('/chat')) return <Screen title="Sohbet" subtitle="Birim kanalları ve odalar."><div className="chat-layout"><Card title="Kanallar">{channels.map(ch => <button className={channelId === ch.id ? 'selected-channel' : 'quick-link'} key={ch.id} onClick={() => setChannelId(ch.id)}>{ch.name}</button>)}</Card><Card title={channels.find(ch => ch.id === channelId)?.name || 'Mesajlar'}><div className="messages">{messages.map(m => <div className="message" key={m.id}><small>Üye #{m.userId}</small><p>{m.body}</p></div>)}</div><form className="row" onSubmit={async e => { e.preventDefault(); if (!message.trim()) return; await api('/chat/messages', { method: 'POST', body: JSON.stringify({ unitId: channelId, body: message }) }); setMessage(''); }}><input aria-label="Mesaj" value={message} onChange={e => setMessage(e.target.value)}/><Button type="submit">Gönder</Button></form></Card></div></Screen>;
  if (path.endsWith('/announcements')) return <Screen title="Duyurular" subtitle="Size gösterilen duyurular ve etkinlikler."><Card>{announcements.data?.announcements.map(a => <article className="list-item" key={a.id}><strong>{a.title}</strong><p>{a.body}</p>{a.canAcknowledge && a.requiresAcknowledgement && (a.acknowledgedAt ? <Badge tone="good">Okundu onaylandı</Badge> : <Button variant="quiet" onClick={async () => { try { await api(`/announce/${a.id}/acknowledge`, { method: 'POST' }); setAnnouncementError(''); announcements.reload(); } catch (error) { setAnnouncementError((error as Error).message); } }}>Okudum, onaylıyorum</Button>)}</article>)}{!announcements.data?.announcements.length && <Empty>Henüz duyuru yok.</Empty>}{announcementError && <p role="alert" className="form-error">{announcementError}</p>}</Card></Screen>;
  if (path.endsWith('/inventory')) {
    const inventoryRows = inventory.data?.page === inventoryPage ? inventory.data : null;
    const inventoryPages = Math.max(1, Math.ceil((inventory.data?.total || 0) / 24));
    return <Screen title="Envanter" subtitle="Atölye malzemeleri.">
      {!inventoryRows && !inventory.error && <p role="status">Malzemeler yükleniyor…</p>}
      <div className="grid">{inventoryRows?.materials.map(m => <Card key={m.id} title={m.name}>{m.availability === 'available' ? 'Stokta var' : 'Stokta yok'}{m.quantity !== null ? ` · ${formatQuantity(m.quantity)} ${m.unit}` : ''}</Card>)}</div>
      {inventory.error && <p role="alert" className="form-error">{inventory.error}</p>}
      {inventoryRows && !inventoryRows.materials.length && <Empty>Görüntülenecek malzeme yok.</Empty>}
      {inventoryPages > 1 && <nav className="catalog-pagination" aria-label="Envanter sayfaları"><Button variant="quiet" disabled={inventoryPage <= 1} onClick={() => setInventoryPage(page => page - 1)}>Önceki</Button><span>{inventoryPage} / {inventoryPages}</span><Button variant="quiet" disabled={inventoryPage >= inventoryPages} onClick={() => setInventoryPage(page => page + 1)}>Sonraki</Button></nav>}
    </Screen>;
  }
  return <Profile me={me} onPreferences={onPreferences}/>;
}
function AdminSystem({ permissions }: { permissions: string[] }) {
  const canViewPrivacy = permissions.includes('privacy_settings_update');
  const canViewLogs = permissions.includes('audit_logs_view');
  const logs = useData<{ logs: { id: number; action: string; entity: string; createdAt: string }[] }>('/activity/logs', canViewLogs);
  const privacy = useData<{ retentionDays: number }>('/activity/privacy/loans', canViewPrivacy);
  const appointmentPrivacy = useData<{ fileRetentionDays: number; appointmentRetentionMonths: number }>('/activity/privacy/appointments', canViewPrivacy);
  const [days, setDays] = useState(30);
  const [fileDays, setFileDays] = useState(30);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (privacy.data) setDays(privacy.data.retentionDays); }, [privacy.data?.retentionDays]);
  useEffect(() => { if (appointmentPrivacy.data) setFileDays(appointmentPrivacy.data.fileRetentionDays); }, [appointmentPrivacy.data?.fileRetentionDays]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try { await api('/activity/privacy/loans', { method: 'PUT', body: JSON.stringify({ retentionDays: days }) }); setError(''); setMessage('Saklama süresi kaydedildi.'); privacy.reload(); logs.reload(); }
    catch (cause) { setMessage(''); setError((cause as Error).message); }
  };
  const saveFileDays = async (event: FormEvent) => {
    event.preventDefault();
    try { await api('/activity/privacy/appointments', { method: 'PUT', body: JSON.stringify({ fileRetentionDays: fileDays }) }); setError(''); setMessage('Model dosyası saklama süresi kaydedildi.'); appointmentPrivacy.reload(); logs.reload(); }
    catch (cause) { setMessage(''); setError((cause as Error).message); }
  };
  return <Screen title="Sistem" subtitle="Veri saklama ve işlem geçmişi."><div className="grid">
    {canViewPrivacy && <><Card title="Teslim kayıtlarında kişisel veriler"><p>Kapanan teslimlerin ad, e-posta ve notları belirlenen süre sonunda temizlenir. Açık teslimler bu işlemden etkilenmez.</p><form onSubmit={save}><label>Saklama süresi (gün)<input type="number" min={1} max={36500} step={1} value={days} onChange={event => setDays(Number(event.target.value))} required/></label><Button type="submit">Süreyi kaydet</Button></form>{message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}{privacy.error && <p role="alert" className="form-error">{privacy.error}</p>}</Card><Card title="Randevu model dosyaları"><p>Dosyalar belirlenen süre sonunda günlük temizlikte silinir. İleri tarihli saklama istisnası olan randevular ertelenir.</p><form onSubmit={saveFileDays}><label>Dosya saklama süresi (gün)<input type="number" min={1} max={365} step={1} value={fileDays} onChange={event => setFileDays(Number(event.target.value))} required/></label><Button type="submit">Süreyi kaydet</Button></form>{appointmentPrivacy.error && <p role="alert" className="form-error">{appointmentPrivacy.error}</p>}</Card></>}
    {canViewLogs && <Card title="Son işlemler">{logs.data?.logs.map(log => <div className="list-item" key={log.id}><strong>{log.action}</strong> · {log.entity} <small>{new Date(log.createdAt).toLocaleString('tr-TR')}</small></div>)}{logs.data && !logs.data.logs.length && <Empty>İşlem kaydı yok.</Empty>}{logs.error && <p role="alert" className="form-error">{logs.error}</p>}</Card>}
  </div></Screen>;
}
function AdminPage({ path, me }: { path: string; me: Me }) {
  const overview = path === '/admin/overview';
  const canSeeTasks = me.tabs.includes('tasks');
  const canSeeInventory = canOpenAdminInventory(me);
  const canSeeAnnouncements = me.tabs.includes('announcements');
  const tasks = useData<{ tasks: { id: number; title: string; progress: number; status: string }[] }>('/tasks', overview && canSeeTasks);
  const inventory = useData<{ total: number }>('/inventory/count', overview && canSeeInventory);
  const announce = useData<{ announcements: { id: number; title: string; body: string }[] }>('/announce', overview && canSeeAnnouncements);
  if (path === '/admin/members') return <AdminMembers currentUserId={me.user.id} globalRole={me.user.role} permissions={me.permissions}/>;
  if (path === '/admin/system') return <AdminSystem permissions={me.permissions}/>;
  if (path === '/admin/tasks') return <AdminTasks manageableUnitIds={me.scopes.manageIds}/>;
  if (path === '/admin/inventory') return <AdminInventory globalRole={me.user.role} permissions={me.permissions}/>;
  if (path === '/admin/printers') return <AdminPrinters globalRole={me.user.role} permissions={me.permissions}/>;
  if (path === '/admin/announce') return <AdminAnnouncements permissions={me.permissions}/>;
  if (path === '/admin/feedback') return <AdminFeedback permissions={me.permissions}/>;
  if (path === '/admin/workshop') return <AdminWorkshop permissions={me.permissions}/>;
  if (path === '/admin/privacy') return <AdminPrivacy permissions={me.permissions}/>;
  if (path === '/admin/booking-settings') return <AdminBookingSettings permissions={me.permissions}/>;
  if (path === '/admin/chat') return <MemberPage path="/app/chat" me={me}/>;
  const allTasks = tasks.data?.tasks || [];
  const taskCounts = [allTasks.filter(t => t.status === 'open').length, allTasks.filter(t => t.status === 'active').length, allTasks.filter(t => t.status === 'done').length];
  return <Screen title="Genel bakış" subtitle="Atölyedeki işleri bir bakışta gör.">
    <div className="overview-intro card"><div><span className="eyebrow">ÇALIŞMA ALANI</span><h2>Bugün atölyede<br/>neler oluyor?</h2><p>Erişiminiz olan alanların güncel durumunu buradan takip edin.</p></div><div className="intro-mark"><BrandLogo/></div></div>
    {canSeeTasks || canSeeInventory || canSeeAnnouncements ? <>
      <div className="kpi-grid">
        {canSeeTasks && <Card className="metric-card"><div className="metric-icon"><Icon name="tasks"/></div><span>Aktif görevler</span><strong className="big-number">{tasks.data ? allTasks.filter(t => t.status !== 'done').length.toLocaleString('tr-TR') : '—'}</strong><small>İş akışı</small></Card>}
        {canSeeInventory && <Card className="metric-card"><div className="metric-icon"><Icon name="inventory"/></div><span>Malzemeler</span><strong className="big-number">{inventory.data ? inventory.data.total.toLocaleString('tr-TR') : '—'}</strong><small>Envanter kaydı</small></Card>}
        {canSeeAnnouncements && <Card className="metric-card"><div className="metric-icon"><Icon name="announce"/></div><span>Duyurular</span><strong className="big-number">{announce.data ? announce.data.announcements.length.toLocaleString('tr-TR') : '—'}</strong><small>Yayında</small></Card>}
      </div>
      <div className="overview-grid">
        {canSeeTasks && <Card title="Görev durumu" className="card-deep"><GraphyBars values={taskCounts} label="Açık, devam eden ve biten görevler"/><div className="chart-legend"><span><i className="dot yellow"/> Açık {taskCounts[0]}</span><span><i className="dot salmon"/> Devam {taskCounts[1]}</span><span><i className="dot mint"/> Bitti {taskCounts[2]}</span></div></Card>}
        {canSeeAnnouncements && <Card title="Son duyurular"><div className="overview-news">{announce.data?.announcements.slice(0, 3).map(item => <article className="list-item" key={item.id}><span className="tile-icon"><Icon name="announce" size={18}/></span><div><strong>{item.title}</strong><p>{item.body}</p></div></article>)}{announce.data && !announce.data.announcements.length && <Empty>Duyuru yok.</Empty>}</div></Card>}
      </div>
    </> : <Card><Empty>Bu alanda gösterebileceğiniz görev, envanter veya duyuru verisi yok.</Empty></Card>}
  </Screen>;
}
function App() {
  const [path, go] = usePath();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const { setTheme } = useTheme();
  useEffect(() => { api<Me>('/org/me').then(setMe).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!me) return;
    const settings = interfacePreferences(me.user.preferences);
    setTheme(settings.theme);
    document.documentElement.dataset.scale = settings.scale;
    document.documentElement.dataset.density = settings.density;
  }, [me?.user.preferences, setTheme]);
  const onPreferences = (preferences: unknown) => setMe(current => current ? { ...current, user: { ...current.user, preferences } } : current);
  useEffect(() => {
    if (!me) return;
    if (path.startsWith('/admin') && !canOpenAdmin(me)) { go('/app/home'); return; }
    if (path === '/admin/system' && !me.permissions.includes('audit_logs_view') && !me.permissions.includes('privacy_settings_update')) { go(firstAdminRoute(me)); return; }
    if (path === '/admin/inventory' && !canOpenAdminInventory(me)) { go(firstAdminRoute(me)); return; }
    if (path === '/admin/members' && !canOpenAdminMembers(me)) { go(firstAdminRoute(me)); return; }
    if (path === '/admin/printers' && !canOpenAdminPrinters(me)) { go(firstAdminRoute(me)); return; }
    if (path === '/admin/feedback' && !me.permissions.includes('feedback_view')) { go(firstAdminRoute(me)); return; }
    if (path === '/admin/workshop' && !me.permissions.includes('workshop_settings_update')) { go(firstAdminRoute(me)); return; }
    if (path === '/admin/privacy' && !me.permissions.includes('privacy_settings_update')) { go(firstAdminRoute(me)); return; }
    if (path === '/admin/booking-settings' && !me.permissions.includes('system_settings_update')) { go(firstAdminRoute(me)); return; }
    if (path === '/admin/announce' && !canOpenAdminAnnouncements(me)) { go(firstAdminRoute(me)); return; }
    if (me.user.role === 'super_admin') return;
    const entry = [...memberNav, ...adminNav].find(([route]) => route === path);
    if (entry && !me.tabs.includes(entry[2]) && !(path === '/admin/system' && (me.permissions.includes('audit_logs_view') || me.permissions.includes('privacy_settings_update'))) && !(path === '/admin/feedback' && me.permissions.includes('feedback_view')) && !(path === '/admin/workshop' && me.permissions.includes('workshop_settings_update')) && !(path === '/admin/privacy' && me.permissions.includes('privacy_settings_update')) && !(path === '/admin/booking-settings' && me.permissions.includes('system_settings_update')) && !(path === '/admin/printers' && canOpenAdminPrinters(me)) && !(path === '/admin/announce' && canOpenAdminAnnouncements(me))) go(memberNav.find(([, , tab]) => me.tabs.includes(tab))?.[0] || '/app/profile');
  }, [path, me]);
  const logout = async () => { try { await api('/org/logout', { method: 'POST' }); } catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; } setMe(null); setCsrf(''); go('/giris'); };
  const loggedIn = (data: Me) => { setMe(data); go('/app/home'); };
  if (loading) return <div className="boot">Sparkoff yükleniyor…</div>;
  if (path === '/giris') return <Login onLogin={loggedIn}/>;
  if (path === '/aktivasyon') return <Activation onLogin={loggedIn}/>;
  if (!path.startsWith('/app') && !path.startsWith('/admin')) return <PublicLayout path={path} go={go}>{path.startsWith('/randevu/takip/') ? <TrackAppointment path={path}/> : path.startsWith('/randevu/dogrula/') ? <VerifyAppointment path={path} go={go}/> : path === '/randevu' ? <BookingPage go={go}/> : <PublicPage path={path} go={go}/>}</PublicLayout>;
  if (!me) return <Login onLogin={loggedIn}/>;
  if (path.startsWith('/admin') && !canOpenAdmin(me)) return null;
  return <Shell me={me} path={path} go={go} onLogout={logout} onPreferences={onPreferences}>{path.startsWith('/admin') ? <AdminPage path={path} me={me}/> : <MemberPage path={path} me={me} onPreferences={onPreferences}/>}</Shell>;
}

function DemoBanner() { return <div className="demo-banner" role="status"><strong>V2 ÖRNEK MOD</strong><span>Veriler yalnız bu tarayıcıda.</span><label>Rol<select value={getDemoRole()} onChange={event => setDemoRole(event.target.value as ReturnType<typeof getDemoRole>)}><option value="super_admin">Sistem yöneticisi</option><option value="admin">Yönetici</option><option value="auditor">Denetim</option><option value="lead">Sorumlu</option><option value="advisor">Hoca</option><option value="member">Üye</option></select></label><button onClick={resetDemo}>Örnek veriyi sıfırla</button></div>; }
createRoot(document.getElementById('root')!).render(<ThemeProvider><Backdrop/>{import.meta.env.VITE_DEMO_MODE === 'true' && <DemoBanner/>}<App/></ThemeProvider>);
