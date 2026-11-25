import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type IconName = 'home' | 'tasks' | 'chat' | 'announce' | 'inventory' | 'printer' | 'members' | 'settings' | 'search' | 'arrow' | 'calendar' | 'spark' | 'box' | 'menu' | 'user' | 'check' | 'clock' | 'chart';
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></>,
    tasks: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 13h8M8 18h5"/></>,
    chat: <><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.6-.8L3 21l1.8-4.9A8.5 8.5 0 1 1 20 11.5Z"/><path d="M8 11h8"/></>,
    announce: <><path d="M3 11v3a2 2 0 0 0 2 2h2l2 5h3l-2-5h2l8 4V5l-8 4H5a2 2 0 0 0-2 2Z"/><path d="M20 9a3 3 0 0 1 0 6"/></>,
    inventory: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/></>,
    printer: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 7h10M8 16h8M9 12h6M12 12v4"/></>,
    members: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2H3ZM16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1h-3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    spark: <><path d="m12 2 1.7 7.3L21 11l-7.3 1.7L12 20l-1.7-7.3L3 11l7.3-1.7L12 2Z"/><path d="m19 18 .5 1.5L21 20l-1.5.5L19 22l-.5-1.5L17 20l1.5-.5L19 18Z"/></>,
    box: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 14h6"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    check: <><path d="m4 12 5 5L20 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    chart: <><path d="M4 20V4M4 20h17M8 16l4-5 3 2 5-7"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
export function BrandLogo() { return <span className="brand-mark" aria-hidden="true"><img src="/logo.jpg" alt=""/></span>; }

export function Backdrop() { return <div className="backdrop" aria-hidden="true"><svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="bd-peach"><stop offset="0" stopColor="#F4A48C" stopOpacity=".30"/><stop offset="1" stopColor="#F4A48C" stopOpacity="0"/></radialGradient><radialGradient id="bd-blue"><stop offset="0" stopColor="#7B8DE8" stopOpacity=".30"/><stop offset="1" stopColor="#7B8DE8" stopOpacity="0"/></radialGradient><radialGradient id="bd-mint"><stop offset="0" stopColor="#A8DEC5" stopOpacity=".14"/><stop offset="1" stopColor="#A8DEC5" stopOpacity="0"/></radialGradient><linearGradient id="bd-s1" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stopColor="#F4A48C" stopOpacity="0"/><stop offset=".45" stopColor="#F4A48C" stopOpacity=".38"/><stop offset="1" stopColor="#F4DC93" stopOpacity="0"/></linearGradient><linearGradient id="bd-s2" x1="1" y1="0" x2="0" y2=".4"><stop offset="0" stopColor="#B9C6F5" stopOpacity="0"/><stop offset=".5" stopColor="#B9C6F5" stopOpacity=".22"/><stop offset="1" stopColor="#B9C6F5" stopOpacity="0"/></linearGradient></defs><circle cx="160" cy="120" r="520" fill="url(#bd-peach)"/><circle cx="1320" cy="560" r="560" fill="url(#bd-blue)"/><circle cx="520" cy="1000" r="420" fill="url(#bd-mint)"/><path d="M-80 150 C 320 30, 700 250, 1080 110 S 1420 40, 1540 120" stroke="url(#bd-s1)" strokeWidth="30" fill="none" opacity=".8"/><path d="M-80 205 C 300 95, 720 300, 1100 165 S 1430 100, 1540 180" stroke="url(#bd-s1)" strokeWidth="5" fill="none" opacity=".5"/><path d="M-80 830 C 320 700, 700 940, 1100 790 S 1440 740, 1540 800" stroke="url(#bd-s2)" strokeWidth="36" fill="none"/><path d="M-80 880 C 300 780, 720 980, 1120 850 S 1440 800, 1540 860" stroke="url(#bd-s1)" strokeWidth="4" fill="none" opacity=".45"/></svg></div>; }

export type Theme = 'dark' | 'light' | 'system';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({ theme: 'dark', setTheme: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('sparkoff-theme');
    return saved === 'light' || saved === 'system' ? saved : 'dark';
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? media.matches ? 'light' : 'dark' : theme; };
    apply();
    localStorage.setItem('sparkoff-theme', theme);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) { return <span className={`badge badge-${tone}`}><span className="badge-dot" aria-hidden="true"/>{children}</span>; }
export function taskStatusLabel(status: string) { return ({ open: 'Açık', active: 'Devam ediyor', done: 'Tamamlandı' } as Record<string, string>)[status] || status; }
export function formatQuantity(value: string | number) { const number = Number(value); return Number.isFinite(number) ? number.toLocaleString('tr-TR', { maximumFractionDigits: 3 }) : String(value); }
export function roleLabel(role: string) { return ({ super_admin: 'Sistem yöneticisi', admin: 'Yönetici', auditor: 'Denetim', lead: 'Sorumlu', advisor: 'Hoca', member: 'Üye' } as Record<string, string>)[role] || role; }
export function materialKindLabel(kind: string) { return ({ consumable: 'Sarf malzemesi', loanable: 'Ödünç verilebilir', equipment: 'Demirbaş' } as Record<string, string>)[kind] || kind; }
export function Screen({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) { return <main className="screen"><header className="screen-head"><div><p className="eyebrow">SPARKOFF</p><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div><div className="screen-actions">{actions}</div></header>{children}</main>; }
export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{title && <h2>{title}</h2>}{children}</section>; }
export function Empty({ children }: { children: ReactNode }) { return <p className="empty">{children}</p>; }
export function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, form }: { children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; variant?: 'primary' | 'quiet'; disabled?: boolean; form?: string }) { return <button type={type} form={form} onClick={onClick} disabled={disabled} className={`button button-${variant}`}>{children}</button>; }
function useDialogFocus<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])].filter(element => element.getClientRects().length > 0);
    (focusable()[0] || dialog)?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return dialogRef;
}
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const dialogRef = useDialogFocus<HTMLElement>(open, onClose);
  if (!open) return null;
  return <div className="sheet-host" role="presentation"><button className="sheet-backdrop" aria-label="Pencereyi kapat" onClick={onClose}/><section ref={dialogRef} className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Kapat">×</button></header><div className="sheet-scroll">{children}</div>{footer && <footer>{footer}</footer>}</section></div>;
}
export function Modal({ open, onClose, title, children, action }: { open: boolean; onClose: () => void; title: string; children: ReactNode; action: ReactNode }) {
  const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);
  return open ? <div className="modal-host"><div className="modal-backdrop" onClick={onClose}/><div ref={dialogRef} className="modal" role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1}><h2>{title}</h2>{children}<div className="row"><Button variant="quiet" onClick={onClose}>Vazgeç</Button>{action}</div></div></div> : null;
}
export function MemberCard({ name, unit, role, email, action }: { name: string; unit: string; role: string; email?: string | null; action?: ReactNode }) {
  return <article className="member-card"><div className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</div><div className="member-info"><strong>{name}</strong><p className="muted">{unit}</p>{email && <small>{email}</small>}</div><div className="member-actions">{role && <Badge>{roleLabel(role)}</Badge>}{action}</div></article>;
}
