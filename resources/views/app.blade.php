<!DOCTYPE html>
<html lang="tr">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="Sparkoff Proje Atölyesi 3D yazıcı randevu sistemi">
        <link rel="icon" href="/logo.jpg">
        <script>
            if (!window.location.pathname.startsWith('/yonetim')) {
                try {
                    const theme = localStorage.getItem('sparkoff.public.theme');
                    const dark = theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches);
                    document.documentElement.classList.toggle('public-theme-dark', dark);
                    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
                } catch (_) {}
            }
        </script>
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body>
        @inertia
    </body>
</html>
