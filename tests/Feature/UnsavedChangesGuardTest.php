<?php

namespace Tests\Feature;

use Tests\TestCase;

class UnsavedChangesGuardTest extends TestCase
{
    public function test_admin_app_registers_a_shared_unsaved_changes_guard(): void
    {
        $app = file_get_contents(resource_path('js/app.tsx'));
        $guard = file_get_contents(resource_path('js/components/UnsavedChangesGuard.tsx'));

        $this->assertStringContainsString('<UnsavedChangesProvider enabled={isAdmin}>', $app);
        $this->assertStringContainsString("window.addEventListener('beforeunload'", $guard);
        $this->assertStringContainsString("router.on('before'", $guard);
        $this->assertStringContainsString("visit.method !== 'get'", $guard);
        $this->assertStringContainsString('visit.prefetch', $guard);
        $this->assertStringContainsString("visit.url.pathname === '/yonetim/cikis'", $guard);
        $this->assertStringContainsString('<ConfirmDialog', $guard);
        $this->assertStringContainsString('Değişiklikleri bırak ve ayrıl', $guard);

        $dialog = file_get_contents(resource_path('js/components/ConfirmDialog.tsx'));
        $personalSettings = file_get_contents(resource_path('js/pages/Admin/Settings/Personal.tsx'));
        $adminLayout = file_get_contents(resource_path('js/components/AdminLayout.tsx'));
        $this->assertStringContainsString('submissionRef.current = false', $dialog);
        $this->assertStringContainsString('setSubmissionLocked(false)', $dialog);
        $this->assertStringContainsString('form.isDirty || passwordChanged', $personalSettings);
        $this->assertStringContainsString("href: '/yonetim/ayarlar/kisisel', label: 'Ayarlar'", $adminLayout);
    }

    public function test_long_admin_forms_report_dirty_state_to_the_shared_guard(): void
    {
        foreach ([
            'js/pages/Admin/Announcements/Index.tsx',
            'js/pages/Admin/Inventory/Index.tsx',
            'js/pages/Admin/Settings/Personal.tsx',
            'js/pages/Admin/Settings/Workshop.tsx',
            'js/pages/Admin/Settings/BookingRules.tsx',
            'js/pages/Admin/Settings/Privacy.tsx',
            'js/pages/Admin/Settings/Printers.tsx',
            'js/pages/Admin/Settings/Filaments.tsx',
        ] as $path) {
            $source = file_get_contents(resource_path($path));

            $this->assertStringContainsString('useUnsavedChanges(', $source, $path);
        }
    }

    public function test_confirmation_dialog_inherits_the_active_admin_theme(): void
    {
        $dialog = file_get_contents(resource_path('js/components/ConfirmDialog.tsx'));

        $this->assertStringContainsString("['theme-dark', 'theme-system']", $dialog);
        $this->assertStringContainsString('site-confirm-backdrop ${adminTheme', $dialog);
    }
}
