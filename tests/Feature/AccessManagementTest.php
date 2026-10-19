<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AccessManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_system_administrator_can_create_a_role_with_selected_permissions(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($admin)->post(route('admin.roles.store'), [
            'name' => 'Malzeme Sorumlusu',
            'description' => 'Teslim ve iade işlemleri',
            'permissions' => ['inventory.view', 'loans.create', 'loans.receive_return'],
        ])->assertSessionHas('success');

        $role = Role::query()->where('slug', 'malzeme-sorumlusu')->firstOrFail();
        $this->assertEqualsCanonicalizing(
            ['inventory.view', 'loans.create', 'loans.receive_return'],
            $role->permissions()->pluck('key')->all(),
        );
        $this->assertTrue(ActivityLog::query()->where('subject_type', Role::class)->where('subject_id', $role->id)->whereJsonContains('changed_fields', 'permissions')->exists());
    }

    public function test_authorized_manager_can_create_a_user_with_multiple_roles(): void
    {
        $managerRole = Role::query()->create(['name' => 'Erişim Yöneticisi', 'slug' => 'access-manager']);
        $managerRole->permissions()->attach(Permission::query()->whereIn('key', ['users.create', 'roles.assign'])->pluck('id'));
        $manager = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $manager->roles()->attach($managerRole);
        $printerRole = Role::query()->create(['name' => 'Yazıcı Görevlisi', 'slug' => 'printer-operator']);
        $assignedRoles = [Role::query()->where('slug', 'inventory-moderator')->value('id'), $printerRole->id];

        $this->actingAs($manager)->post(route('admin.users.store'), [
            'name' => 'Yeni Görevli',
            'email' => 'gorevli@example.com',
            'password' => 'guvenli-gecici-parola',
            'role_ids' => $assignedRoles,
        ])->assertSessionHas('success');

        $user = User::query()->where('email', 'gorevli@example.com')->firstOrFail();
        $this->assertCount(2, $user->roles);
        $this->assertTrue(ActivityLog::query()->where('subject_type', User::class)->where('subject_id', $user->id)->whereJsonContains('changed_fields', 'roles')->exists());
    }

    public function test_the_last_active_system_administrator_cannot_lose_system_access(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $systemRole = Role::query()->where('is_system', true)->firstOrFail();
        $moderatorRole = Role::query()->where('slug', 'inventory-moderator')->firstOrFail();
        $admin->roles()->attach($systemRole);

        $this->actingAs($admin)->put(route('admin.users.update', $admin), [
            'name' => $admin->name,
            'email' => $admin->email,
            'password' => '',
            'is_active' => true,
            'role_ids' => [$moderatorRole->id],
        ])->assertSessionHasErrors('role_ids');

        $this->assertTrue($admin->fresh()->isSystemAdministrator());
    }

    public function test_a_role_manager_cannot_assign_the_protected_system_role(): void
    {
        $managerRole = Role::query()->create(['name' => 'Erişim Yöneticisi', 'slug' => 'restricted-access-manager']);
        $managerRole->permissions()->attach(Permission::query()->whereIn('key', ['users.create', 'roles.assign'])->pluck('id'));
        $manager = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $manager->roles()->attach($managerRole);
        $systemRole = Role::query()->where('is_system', true)->firstOrFail();

        $this->actingAs($manager)->post(route('admin.users.store'), [
            'name' => 'Yetki Yükseltme Denemesi',
            'email' => 'yetki@example.com',
            'password' => 'guvenli-gecici-parola',
            'role_ids' => [$systemRole->id],
        ])->assertForbidden();

        $this->assertDatabaseMissing('users', ['email' => 'yetki@example.com']);
    }

    public function test_protected_system_role_cannot_be_changed_or_deleted(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $role = Role::query()->where('is_system', true)->firstOrFail();

        $this->actingAs($admin)->put(route('admin.roles.update', $role), [
            'name' => 'Değiştirildi',
            'description' => '',
            'permissions' => [],
        ])->assertForbidden();

        $this->actingAs($admin)->delete(route('admin.roles.destroy', $role))->assertForbidden();
    }

    public function test_user_viewer_can_open_access_page_without_role_details(): void
    {
        $role = Role::query()->create(['name' => 'Kullanıcı Görüntüleyici', 'slug' => 'kullanici-goruntuleyici']);
        $role->permissions()->attach(Permission::query()->where('key', 'users.view')->value('id'));
        $viewer = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $viewer->roles()->attach($role);

        $this->actingAs($viewer)->get(route('admin.access.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('users')
                ->where('permissionGroups', []));
    }
}
