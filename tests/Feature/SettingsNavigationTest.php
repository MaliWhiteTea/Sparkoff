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

    public function test_settings_entry_redirects_an_administrator_to_personal_settings(): void
    {
        $admin = User::factory()->systemAdministrator()->create();

        $this->actingAs($admin)->get(route('admin.settings.index'))
            ->assertRedirect(route('admin.settings.personal.edit'));
    }

    public function test_settings_entry_redirects_limited_user_to_personal_settings(): void
    {
        $role = Role::query()->create(['name' => 'Filament Sorumlusu', 'slug' => 'filament-sorumlusu']);
        $role->permissions()->attach(Permission::query()->where('key', 'printers.manage_filaments')->value('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        $this->actingAs($user)->get(route('admin.settings.index'))
            ->assertRedirect(route('admin.settings.personal.edit'));
    }

    public function test_access_only_user_reaches_personal_settings_from_settings_entry(): void
    {
        $role = Role::query()->create(['name' => 'Kullanıcı Görüntüleyici', 'slug' => 'ayar-kullanici-goruntuleyici']);
        $role->permissions()->attach(Permission::query()->where('key', 'users.view')->value('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        $this->actingAs($user)->get(route('admin.settings.index'))
            ->assertRedirect(route('admin.settings.personal.edit'));
    }

    public function test_every_active_panel_user_can_open_personal_settings(): void
    {
        $user = $this->panelUser();

        $this->actingAs($user)->get(route('admin.settings.personal.edit'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Admin/Settings/Personal')
                ->where('preferences.theme', 'system')
                ->where('preferences.scale', 'normal')
                ->where('preferences.density', 'normal')
                ->where('preferences.sidebar', 'wide'));
    }

    public function test_user_can_save_only_their_own_interface_preferences(): void
    {
        $user = $this->panelUser();
        $other = User::factory()->create(['role' => 'operator', 'is_active' => true]);

        $this->actingAs($user)->put(route('admin.settings.personal.update'), [
            'theme' => 'dark', 'scale' => 'large', 'density' => 'compact', 'sidebar' => 'narrow',
        ])->assertRedirect();

        $this->assertSame([
            'theme' => 'dark', 'scale' => 'large', 'density' => 'compact', 'sidebar' => 'narrow',
        ], $user->fresh()->interface_preferences);
        $this->assertNull($other->fresh()->interface_preferences);
    }

    public function test_invalid_interface_preferences_are_rejected(): void
    {
        $user = $this->panelUser();

        $this->actingAs($user)->from(route('admin.settings.personal.edit'))->put(route('admin.settings.personal.update'), [
            'theme' => 'neon', 'scale' => 'huge', 'density' => 'none', 'sidebar' => 'hidden',
        ])->assertRedirect(route('admin.settings.personal.edit'))->assertSessionHasErrors(['theme', 'scale', 'density', 'sidebar']);

        $this->assertNull($user->fresh()->interface_preferences);
    }

    public function test_user_can_reset_interface_preferences(): void
    {
        $user = $this->panelUser([
            'interface_preferences' => ['theme' => 'dark', 'scale' => 'large', 'density' => 'compact', 'sidebar' => 'narrow'],
        ]);

        $this->actingAs($user)->delete(route('admin.settings.personal.destroy'))->assertRedirect();

        $this->assertNull($user->fresh()->interface_preferences);
        $this->assertSame('system', $user->fresh()->interfacePreferences()['theme']);
    }

    public function test_user_without_system_permissions_cannot_open_system_settings_directly(): void
    {
        $user = $this->panelUser();

        $this->actingAs($user)->get(route('admin.settings.workshop.edit'))->assertForbidden();
        $this->actingAs($user)->get(route('admin.settings.printers.index'))->assertForbidden();
        $this->actingAs($user)->get(route('admin.settings.filaments.index'))->assertForbidden();
        $this->actingAs($user)->get(route('admin.access.index'))->assertForbidden();
    }

    public function test_user_can_store_personal_table_columns(): void
    {
        $user = User::factory()->systemAdministrator()->create();

        $this->actingAs($user)->put(route('admin.settings.personal.table.update'), [
            'table' => 'appointments', 'columns' => ['status', 'starts_at', 'applicant'],
        ])->assertSessionHas('success');

        $this->assertSame(['status', 'starts_at', 'applicant'], $user->fresh()->table_preferences['appointments']);
    }

    public function test_sensitive_table_column_requires_matching_permission(): void
    {
        $role = Role::query()->create(['name' => 'Randevu Görüntüleyici', 'slug' => 'randevu-goruntuleyici']);
        $role->permissions()->attach(Permission::query()->where('key', 'appointments.view')->value('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        $this->actingAs($user)->put(route('admin.settings.personal.table.update'), [
            'table' => 'appointments', 'columns' => ['starts_at', 'applicant'],
        ])->assertSessionHasErrors('columns.1');
        $this->assertNull($user->fresh()->table_preferences);

        $this->actingAs($user)->put(route('admin.settings.personal.table.update'), [
            'table' => 'appointments', 'columns' => ['status', 'starts_at'],
        ])->assertSessionHas('success');
    }

    public function test_loan_recipient_column_requires_personal_data_permission(): void
    {
        $role = Role::query()->create(['name' => 'Teslim Görüntüleyici', 'slug' => 'teslim-goruntuleyici']);
        $role->permissions()->attach(Permission::query()->where('key', 'loans.view')->value('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        $this->actingAs($user)->put(route('admin.settings.personal.table.update'), [
            'table' => 'loans', 'columns' => ['item', 'recipient'],
        ])->assertSessionHasErrors('columns.1');
        $this->assertNull($user->fresh()->table_preferences);

        $this->actingAs($user)->put(route('admin.settings.personal.table.update'), [
            'table' => 'loans', 'columns' => ['item', 'status'],
        ])->assertSessionHas('success');
    }

    public function test_table_preferences_reject_unknown_tables_columns_and_duplicates(): void
    {
        $user = User::factory()->systemAdministrator()->create();

        $this->actingAs($user)->put(route('admin.settings.personal.table.update'), [
            'table' => 'secrets', 'columns' => ['password'],
        ])->assertSessionHasErrors('table');
        $this->actingAs($user)->put(route('admin.settings.personal.table.update'), [
            'table' => 'users', 'columns' => ['name', 'password'],
        ])->assertSessionHasErrors('columns.1');
        $this->actingAs($user)->put(route('admin.settings.personal.table.update'), [
            'table' => 'users', 'columns' => ['name', 'name'],
        ])->assertSessionHasErrors('columns.1');
    }

    private function panelUser(array $attributes = []): User
    {
        $user = User::factory()->create([
            'role' => 'operator',
            'is_active' => true,
            ...$attributes,
        ]);
        $user->roles()->attach(Role::query()->create([
            'name' => "Panel Kullanıcısı {$user->id}",
            'slug' => "panel-kullanicisi-{$user->id}",
        ]));

        return $user;
    }
}
