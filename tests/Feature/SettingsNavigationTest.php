<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsNavigationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_settings_entry_redirects_an_administrator_to_the_first_available_section(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($admin)->get(route('admin.settings.index'))
            ->assertRedirect(route('admin.settings.workshop.edit'));
    }

    public function test_settings_entry_respects_limited_user_permissions(): void
    {
        $role = Role::query()->create(['name' => 'Filament Sorumlusu', 'slug' => 'filament-sorumlusu']);
        $role->permissions()->attach(Permission::query()->where('key', 'printers.manage_filaments')->value('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        $this->actingAs($user)->get(route('admin.settings.index'))
            ->assertRedirect(route('admin.settings.filaments.index'));
    }
}
