import { Link } from '@inertiajs/react';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';

type Props = {
    isHome?: boolean;
    hasContact?: boolean;
};

export default function PublicHeader({ isHome = false, hasContact = false }: Props) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const menuRef = useRef<HTMLElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const sectionHref = (section: string) => `${isHome ? '' : '/'}#${section}`;
    const closeMobileMenu = (returnFocus = false) => {
        setMobileOpen(false);
        if (returnFocus) window.requestAnimationFrame(() => toggleRef.current?.focus());
    };

    useEffect(() => {
        if (!mobileOpen) return;

        document.body.classList.add('public-menu-open');
        const firstLink = menuRef.current?.querySelector<HTMLElement>('a');
        firstLink?.focus();
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') closeMobileMenu(true);
        };
        const desktop = window.matchMedia('(min-width: 901px)');
        const closeOnDesktop = () => desktop.matches && closeMobileMenu();
        window.addEventListener('keydown', closeOnEscape);
        desktop.addEventListener('change', closeOnDesktop);

        return () => {
            document.body.classList.remove('public-menu-open');
            window.removeEventListener('keydown', closeOnEscape);
            desktop.removeEventListener('change', closeOnDesktop);
        };
    }, [mobileOpen]);

    const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Tab') return;
        const links = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('a') ?? []);
        if (links.length === 0) return;
        const first = links[0];
        const last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return <header className={`site-header ${mobileOpen ? 'menu-open' : ''}`}><div className="header-inner">
        <Link className="brand" href={isHome ? '#ust' : '/'} aria-label="Sparkoff Proje Atölyesi ana sayfa"><img src="/logo.jpg" alt="Sparkoff logosu" width={56} height={56} /><span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span></Link>
        <button ref={toggleRef} className="public-menu-toggle" type="button" aria-expanded={mobileOpen} aria-controls="public-navigation" aria-label={mobileOpen ? 'Menüyü kapat' : 'Menüyü aç'} onClick={() => setMobileOpen((open) => !open)}><span /><span /><span /></button>
        {mobileOpen && <button className="public-menu-overlay" type="button" aria-label="Menüyü kapat" onClick={() => closeMobileMenu(true)} />}
        <nav ref={menuRef} id="public-navigation" className={`desktop-nav ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Ana menü" onKeyDown={trapFocus}><a href={sectionHref('icerik')} onClick={() => closeMobileMenu(true)}>Atölye</a><a href={sectionHref('hizmetler')} onClick={() => closeMobileMenu(true)}>Hizmetler</a><Link href="/3d-yazicilar" onClick={() => closeMobileMenu(true)}>3D Yazıcılar</Link><Link href="/malzemeler" onClick={() => closeMobileMenu(true)}>Malzemeler</Link><Link href="/geri-bildirim" onClick={() => closeMobileMenu(true)}>Geri bildirim</Link>{hasContact && <a href={sectionHref('iletisim')} onClick={() => closeMobileMenu(true)}>İletişim</a>}</nav>
    </div></header>;
}
