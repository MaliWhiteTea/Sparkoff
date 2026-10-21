import '../css/app.css';
import '../css/admin-shell.css';

import { createInertiaApp } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import PublicThemeToggle from './components/PublicThemeToggle';

const pages = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx', { eager: true });

createInertiaApp({
    title: (title) => title ? `${title} | Sparkoff Proje Atölyesi` : 'Sparkoff Proje Atölyesi',
    resolve: (name) => pages[`./pages/${name}.tsx`],
    setup({ el, App, props }) {
        const isAdmin = window.location.pathname.startsWith('/yonetim');
        createRoot(el).render(<>{!isAdmin && <PublicThemeToggle />}<App {...props} /></>);
    },
    progress: { color: '#145187' },
});
