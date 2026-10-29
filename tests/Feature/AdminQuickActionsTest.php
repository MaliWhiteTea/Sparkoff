<?php

namespace Tests\Feature;

use Tests\TestCase;

class AdminQuickActionsTest extends TestCase
{
    public function test_quick_action_menu_keeps_accessible_keyboard_contracts(): void
    {
        $component = file_get_contents(resource_path('js/components/AdminQuickActions.tsx'));
        $layout = file_get_contents(resource_path('js/components/AdminLayout.tsx'));

        $this->assertStringContainsString('aria-haspopup="menu"', $component);
        $this->assertStringContainsString('aria-expanded={open}', $component);
        $this->assertStringContainsString('role="menu"', $component);
        $this->assertStringContainsString('role="menuitem"', $component);
        $this->assertStringContainsString("event.key !== 'Escape'", $component);
        $this->assertStringContainsString("'ArrowDown', 'ArrowUp', 'Home', 'End'", $component);
        $this->assertStringContainsString('prefers-reduced-motion: reduce', $component);
        $this->assertStringContainsString('<AdminQuickActions actions={quickActions} />', $layout);
    }

    public function test_quick_actions_are_wired_to_permissions_and_real_targets(): void
    {
        $files = [
            'Inventory/Index.tsx' => ['inventory.create', 'inventory.import', 'yeni-malzeme'],
            'InventoryTransactions/Index.tsx' => ['loans.create', 'yeni-teslim'],
            'Access/Index.tsx' => ['users.create', 'roles.assign', 'roles.create', 'yeni-kullanici', 'yeni-rol'],
            'Announcements/Index.tsx' => ['capabilities.createPublic', 'capabilities.createStaff', 'yeni-duyuru'],
            'Settings/Printers.tsx' => ['printers.create', 'printers.manage_schedule', 'yeni-yazici', 'yeni-kapali-zaman'],
            'Settings/Filaments.tsx' => ['yeni-filament'],
        ];

        foreach ($files as $path => $needles) {
            $source = file_get_contents(resource_path("js/pages/Admin/{$path}"));

            foreach ($needles as $needle) {
                $this->assertStringContainsString($needle, $source, "{$path} hızlı işlem bağlantısı eksik: {$needle}");
            }

            $this->assertStringContainsString('quickActions={quickActions}', $source);
        }
    }
}
