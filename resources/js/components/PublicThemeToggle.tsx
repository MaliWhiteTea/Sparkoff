import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'sparkoff.public.theme';

function initialTheme(): Theme {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function PublicThemeToggle() {
    const [theme, setTheme] = useState<Theme>(initialTheme);

    useEffect(() => {
        document.documentElement.classList.toggle('public-theme-dark', theme === 'dark');
        document.documentElement.style.colorScheme = theme;
        window.localStorage.setItem(STORAGE_KEY, theme);

        return () => {
            document.documentElement.classList.remove('public-theme-dark');
            document.documentElement.style.removeProperty('color-scheme');
        };
    }, [theme]);

    const next = theme === 'dark' ? 'light' : 'dark';

    return <button className="public-theme-toggle" type="button" onClick={() => setTheme(next)} aria-label={`${next === 'dark' ? 'Koyu' : 'Açık'} temaya geç`} title={`${next === 'dark' ? 'Koyu' : 'Açık'} temaya geç`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
            {theme === 'dark' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></> : <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />}
        </svg>
        <span>{theme === 'dark' ? 'Açık tema' : 'Koyu tema'}</span>
    </button>;
}
