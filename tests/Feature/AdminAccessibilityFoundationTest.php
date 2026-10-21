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
}
