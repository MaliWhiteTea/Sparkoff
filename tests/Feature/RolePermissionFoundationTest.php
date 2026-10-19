<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RolePermissionFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_seed_creates_a_protected_system_administrator_with_every_permission(): void
    {
        $this->seed();

        $role = Role::query()->where('slug', 'system-administrator')->firstOrFail();

        $this->assertTrue($role->is_system);
        $this->assertTrue($role->is_protected);
        $this->assertSame(Permission::query()->count(), $role->permissions()->count());
    }

    public function test_a_user_can_receive_permissions_from_multiple_roles(): void
    {
        $this->seed();

        $inventoryRole = Role::query()->create(['name' => 'Stok Görevlisi', 'slug' => 'stock-officer']);
        $printerRole = Role::query()->create(['name' => 'Yazıcı Görevlisi', 'slug' => 'printer-officer']);
        $inventoryRole->permissions()->attach(Permission::query()->where('key', 'loans.create')->value('id'));
        $printerRole->permissions()->attach(Permission::query()->where('key', 'printers.manage_schedule')->value('id'));

        $user = User::factory()->create(['role' => 'operator']);
        $user->roles()->attach([$inventoryRole->id, $printerRole->id]);

        $this->assertTrue($user->hasPermissionTo('loans.create'));
        $this->assertTrue($user->hasPermissionTo('printers.manage_schedule'));
        $this->assertFalse($user->hasPermissionTo('roles.update'));
    }

    public function test_existing_legacy_administrators_are_migrated_to_the_system_role(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->seed();

        $this->assertTrue($admin->fresh()->isSystemAdministrator());
        $this->assertTrue($admin->fresh()->hasPermissionTo('roles.update'));
    }

    public function test_a_panel_user_cannot_open_a_route_without_its_permission(): void
    {
        $this->seed();
        $role = Role::query()->create(['name' => 'Sınırlı Görevli', 'slug' => 'limited-operator']);
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        $this->actingAs($user)
            ->get(route('admin.activity-logs'))
            ->assertForbidden();
    }

    public function test_a_panel_user_can_open_a_route_through_a_role_permission(): void
    {
        $this->seed();
        $role = Role::query()->create(['name' => 'Denetçi', 'slug' => 'auditor']);
        $role->permissions()->attach(Permission::query()->where('key', 'audit_logs.view')->value('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        $this->actingAs($user)
            ->get(route('admin.activity-logs'))
            ->assertOk();
    }

    public function test_an_inactive_user_is_rejected_even_when_the_role_has_permission(): void
    {
        $this->seed();
        $role = Role::query()->create(['name' => 'Denetçi', 'slug' => 'inactive-auditor']);
        $role->permissions()->attach(Permission::query()->where('key', 'audit_logs.view')->value('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => false]);
        $user->roles()->attach($role);

        $this->actingAs($user)
            ->get(route('admin.activity-logs'))
            ->assertRedirect(route('admin.login'));
    }
}
