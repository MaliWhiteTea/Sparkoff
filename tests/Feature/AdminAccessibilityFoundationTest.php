<?php

namespace Tests\Feature;

use Tests\TestCase;

class AdminAccessibilityFoundationTest extends TestCase
{
    public function test_management_shell_keeps_keyboard_and_screen_reader_contracts(): void
    {
        $layout = file_get_contents(resource_path('js/components/AdminLayout.tsx'));
        $badge = file_get_contents(resource_path('js/components/StatusBadge.tsx'));

        $this->assertStringContainsString('aria-expanded={mobileOpen}', $layout);
        $this->assertStringContainsString('aria-controls="admin-navigation"', $layout);
        $this->assertStringContainsString('aria-label="Yönetim menüsü"', $layout);
        $this->assertStringContainsString('role="separator"', $layout);
        $this->assertStringContainsString('aria-orientation="vertical"', $layout);
        $this->assertStringContainsString('onKeyDown={resizeKey}', $layout);
        $this->assertStringContainsString("event.key === 'ArrowLeft'", $layout);
        $this->assertStringContainsString("event.key === 'ArrowRight'", $layout);
        $this->assertStringContainsString("event.key === 'Escape'", $layout);
        $this->assertStringContainsString('aria-hidden="true"', $badge);
    }

    public function test_management_shell_keeps_tablet_mobile_and_reduced_motion_rules(): void
    {
        $styles = file_get_contents(resource_path('css/admin-shell.css'))
            .file_get_contents(resource_path('css/app.css'));

        $this->assertStringContainsString('@media(max-width:900px)', $styles);
        $this->assertStringContainsString('@media(max-width:600px)', $styles);
        $this->assertStringContainsString('@media(prefers-reduced-motion:reduce)', $styles);
        $this->assertStringContainsString(':focus-visible', $styles);
    }

    public function test_personal_settings_keep_theme_scale_mobile_and_keyboard_contracts(): void
    {
        $layout = file_get_contents(resource_path('js/components/AdminLayout.tsx'));
        $settings = file_get_contents(resource_path('js/pages/Admin/Settings/Personal.tsx'));
        $styles = file_get_contents(resource_path('css/admin-shell.css'))
            .file_get_contents(resource_path('css/app.css'));

        $this->assertStringContainsString('theme-${preferences.theme}', $layout);
        $this->assertStringContainsString('density-${preferences.density}', $layout);
        $this->assertStringContainsString('document.documentElement.dataset.adminScale', $layout);
        $this->assertStringContainsString('type="radio"', $settings);
        $this->assertStringContainsString('<fieldset', $settings);
        $this->assertStringContainsString('@media(prefers-color-scheme:dark)', $styles);
        $this->assertStringContainsString('html[data-admin-scale="large"]', $styles);
        $this->assertStringContainsString('@media(max-width:600px)', $styles);
    }

    public function test_theme_scope_follows_inertia_navigation_and_defaults_to_dark(): void
    {
        $app = file_get_contents(resource_path('js/app.tsx'));
        $settings = file_get_contents(resource_path('js/pages/Admin/Settings/Personal.tsx'));

        $this->assertStringContainsString("router.on('navigate'", $app);
        $this->assertStringContainsString("window.location.pathname.startsWith('/yonetim')", $app);
        $this->assertStringContainsString('!isAdmin && <PublicThemeToggle />', $app);
        $this->assertStringContainsString("theme: 'dark'", $settings);
    }

    public function test_dark_theme_selectors_match_the_admin_root_and_keep_readable_contrast(): void
    {
        $adminStyles = file_get_contents(resource_path('css/admin-shell.css'));
        $publicStyles = file_get_contents(resource_path('css/app.css'));

        $this->assertStringNotContainsString('.theme-dark .admin-page', $adminStyles);
        $this->assertStringNotContainsString('.theme-system .admin-page', $adminStyles);
        $this->assertStringContainsString('.admin-page.theme-dark', $adminStyles);
        $this->assertStringContainsString('.admin-page.theme-system', $adminStyles);
        $this->assertStringContainsString('.public-theme-dark .public-announcements article.announcement-warning', $publicStyles);

        foreach ([
            ['#edf3f7', '#101820'],
            ['#a7b4c0', '#17232e'],
            ['#ebc58f', '#352b1d'],
            ['#f2a8ba', '#38212a'],
        ] as [$foreground, $background]) {
            $this->assertGreaterThanOrEqual(4.5, $this->contrastRatio($foreground, $background));
        }
    }

    public function test_inventory_media_keeps_accessibility_and_safe_link_contracts(): void
    {
        $catalog = file_get_contents(resource_path('js/pages/Materials.tsx'));
        $manager = file_get_contents(resource_path('js/pages/Admin/Inventory/Index.tsx'));
        $styles = file_get_contents(resource_path('css/app.css'));

        $this->assertStringContainsString('alt={medium.altText', $catalog);
        $this->assertStringContainsString('onError={() => setFailed(true)}', $catalog);
        $this->assertStringContainsString('rel="noopener noreferrer"', $catalog);
        $this->assertStringContainsString('aria-label="Medyayı yukarı taşı"', $manager);
        $this->assertStringContainsString('aria-label="Görsel açıklaması"', $manager);
        $this->assertStringContainsString('.material-image-fallback', $styles);
        $this->assertStringContainsString('@media(max-width:600px)', $styles);
    }

    private function contrastRatio(string $foreground, string $background): float
    {
        $luminance = function (string $hex): float {
            $channels = array_map(
                fn (string $channel) => hexdec($channel) / 255,
                str_split(ltrim($hex, '#'), 2),
            );
            $channels = array_map(
                fn (float $channel) => $channel <= 0.04045
                    ? $channel / 12.92
                    : (($channel + 0.055) / 1.055) ** 2.4,
                $channels,
            );

            return 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
        };

        $lighter = max($luminance($foreground), $luminance($background));
        $darker = min($luminance($foreground), $luminance($background));

        return ($lighter + 0.05) / ($darker + 0.05);
    }
}
