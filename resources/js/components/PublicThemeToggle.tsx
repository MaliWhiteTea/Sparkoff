import { useEffect, useRef, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sparkoff.public.theme';

function initialTheme(): Theme {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;

    return 'dark';
}

export default function PublicThemeToggle() {
    const [theme, setTheme] = useState<Theme>(initialTheme);
    const transitionTimer = useRef<number | null>(null);

    useEffect(() => {
        document.documentElement.classList.toggle('public-theme-dark', theme === 'dark');
        document.documentElement.style.colorScheme = theme;
        window.localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);
    useEffect(() => {
        return () => {
            if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
            document.documentElement.classList.remove('theme-transitioning');
            document.documentElement.classList.remove('public-theme-dark');
            document.documentElement.style.removeProperty('color-scheme');
        };
    }, []);

    const next = theme === 'dark' ? 'light' : 'dark';
    const changeTheme = () => {
        document.documentElement.classList.add('theme-transitioning');
        if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
        transitionTimer.current = window.setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 240);
        setTheme(next);
    };

    return <button className="public-theme-toggle" type="button" onClick={changeTheme} aria-label={`${next === 'dark' ? 'Koyu' : 'Açık'} temaya geç`} title={`${next === 'dark' ? 'Koyu' : 'Açık'} temaya geç`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
            {theme === 'dark' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />}
        </svg>
        <span>{theme === 'dark' ? 'Açık tema' : 'Koyu tema'}</span>
    </button>;
}
