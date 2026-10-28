<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SafeDraftStorageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_each_administrator_receives_a_stable_private_draft_scope(): void
    {
        $first = User::factory()->systemAdministrator()->create();
        $second = User::factory()->systemAdministrator()->create();
        $firstScope = hash_hmac('sha256', (string) $first->id, (string) config('app.key'));
        $secondScope = hash_hmac('sha256', (string) $second->id, (string) config('app.key'));

        $this->assertNotSame($firstScope, $secondScope);

        $this->actingAs($first)->get(route('admin.inventory.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('auth.user.draftScope', $firstScope));

        $this->actingAs($second)->get(route('admin.inventory.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('auth.user.draftScope', $secondScope));
    }

    public function test_safe_draft_hook_keeps_version_timestamp_allowlist_and_debounce_contracts(): void
    {
        $hook = file_get_contents(resource_path('js/hooks/useSafeDraft.ts'));

        $this->assertStringContainsString('const DRAFT_VERSION = 1', $hook);
        $this->assertStringContainsString('updatedAt: new Date().toISOString()', $hook);
        $this->assertStringContainsString('fields.map((field) => [field, source[field]])', $hook);
        $this->assertStringContainsString('WRITE_DELAY_MS', $hook);
        $this->assertStringContainsString('window.localStorage.setItem(storageKey', $hook);
        $this->assertStringContainsString('if (wasEnabled.current)', $hook);
        $this->assertStringContainsString('MAX_AGE_MS', $hook);
        $this->assertStringContainsString('Date.now() - updatedAt > MAX_AGE_MS', $hook);
        $this->assertStringContainsString('Object.prototype.hasOwnProperty.call(parsed.value, field)', $hook);
        $this->assertStringContainsString('clearDraft', $hook);
    }

    public function test_approved_admin_forms_use_safe_draft_storage(): void
    {
        foreach ([
            'js/pages/Admin/Announcements/Index.tsx',
            'js/pages/Admin/Inventory/Index.tsx',
            'js/pages/Admin/Settings/Workshop.tsx',
            'js/pages/Admin/Settings/BookingRules.tsx',
            'js/pages/Admin/Settings/Privacy.tsx',
            'js/pages/Admin/Settings/Printers.tsx',
            'js/pages/Admin/Settings/Filaments.tsx',
        ] as $path) {
            $source = file_get_contents(resource_path($path));

            $this->assertStringContainsString('useSafeDraft(', $source, $path);
            $this->assertStringContainsString('DraftRecoveryNotice', $source, $path);
        }
    }

    public function test_draft_recovery_notice_offers_explicit_restore_and_discard_actions(): void
    {
        $notice = file_get_contents(resource_path('js/components/DraftRecoveryNotice.tsx'));
        $styles = file_get_contents(resource_path('css/admin-shell.css'));

        $this->assertStringContainsString('Kaydedilmemiş taslak bulundu', $notice);
        $this->assertStringContainsString('Taslağı geri yükle', $notice);
        $this->assertStringContainsString('Taslağı sil', $notice);
        $this->assertStringContainsString('onRestore', $notice);
        $this->assertStringContainsString('onDiscard', $notice);
        $this->assertStringContainsString('.admin-draft-notice', $styles);
        $this->assertStringContainsString('@media(max-width:650px)', $styles);
    }
}
