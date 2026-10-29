import { Link } from '@inertiajs/react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';

export type AdminQuickAction = {
    label: string;
    description?: string;
    href?: string;
    onSelect?: () => void;
};

export function focusAdminActionTarget(id: string) {
    window.requestAnimationFrame(() => {
        const target = document.getElementById(id);
        if (!target) return;

        target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        target.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')?.focus({ preventScroll: true });
    });
}

export default function AdminQuickActions({ actions }: { actions: AdminQuickAction[] }) {
    const [open, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        const closeOutside = (event: MouseEvent) => {
            if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
        };
        const closeWithEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setOpen(false);
            trigger.current?.focus();
        };

        document.addEventListener('mousedown', closeOutside);
        window.addEventListener('keydown', closeWithEscape);
        window.requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());

        return () => {
            document.removeEventListener('mousedown', closeOutside);
            window.removeEventListener('keydown', closeWithEscape);
        };
    }, [open]);

    if (actions.length === 0) return null;

    const select = (action: AdminQuickAction) => {
        setOpen(false);
        action.onSelect?.();
    };
    const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
        if (items.length === 0) return;

        event.preventDefault();
        const current = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
        const next = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
    };

    return <div className="admin-quick-actions" ref={container}>
        <button ref={trigger} className="admin-quick-actions-trigger" type="button" aria-haspopup="menu" aria-expanded={open} aria-controls="admin-quick-actions-menu" onClick={() => setOpen((current) => !current)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span>Hızlı işlem</span>
            <b aria-hidden="true">⌄</b>
        </button>
        {open && <div ref={panel} id="admin-quick-actions-menu" className="admin-quick-actions-menu" role="menu" aria-label="Bu sayfadaki hızlı işlemler" onKeyDown={moveFocus}>
            {actions.map((action) => action.href
                ? <Link role="menuitem" href={action.href} onClick={() => setOpen(false)} key={`${action.label}-${action.href}`}><strong>{action.label}</strong>{action.description && <small>{action.description}</small>}</Link>
                : <button role="menuitem" type="button" onClick={() => select(action)} key={action.label}><strong>{action.label}</strong>{action.description && <small>{action.description}</small>}</button>)}
        </div>}
    </div>;
}
