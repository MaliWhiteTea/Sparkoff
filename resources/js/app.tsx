import '../css/app.css';
import '../css/admin-shell.css';

import { createInertiaApp, router } from '@inertiajs/react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import PublicThemeToggle from './components/PublicThemeToggle';
import UnsavedChangesProvider from './components/UnsavedChangesGuard';

const pages = import.meta.glob<{ default: ComponentType }>('./pages/**/*.tsx', { eager: true });

createInertiaApp({
    title: (title) => title ? `${title} | Sparkoff Proje Atölyesi` : 'Sparkoff Proje Atölyesi',
    resolve: (name) => pages[`./pages/${name}.tsx`],
    setup({ el, App, props }) {
        function AppRoot() {
            const [pathname, setPathname] = useState(() => window.location.pathname);
            const isAdmin = pathname.startsWith('/yonetim');
            const isAdminLogin = pathname === '/yonetim' || pathname === '/yonetim/giris';

            useEffect(() => router.on('navigate', () => {
                setPathname(window.location.pathname);
            }), []);

            return <UnsavedChangesProvider enabled={isAdmin && !isAdminLogin}>
                {(!isAdmin || isAdminLogin) && <PublicThemeToggle />}
                <App {...props} />
            </UnsavedChangesProvider>;
        }

        createRoot(el).render(<AppRoot />);
    },
    progress: { color: '#145187' },
});
