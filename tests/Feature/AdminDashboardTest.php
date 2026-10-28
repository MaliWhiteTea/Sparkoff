<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_dashboard_requires_an_active_panel_account(): void
    {
        $this->get(route('admin.dashboard'))->assertRedirect(route('admin.login'));

        $inactive = $this->userWithPermissions(['inventory.view'], false);
        $this->actingAs($inactive)->get(route('admin.dashboard'))->assertRedirect(route('admin.login'));
    }

    public function test_system_administrator_sees_every_enabled_workspace_module(): void
    {
        $admin = User::factory()->systemAdministrator()->create();

        $this->actingAs($admin)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->has('modules', 11)
                ->where('modules', fn ($modules) => collect($modules)->pluck('key')->all() === [
                    'inventory', 'loans', 'appointments', 'calendar', 'feedback', 'announcements',
                    'printers', 'filaments', 'access', 'history', 'personal',
                ]));
    }

    public function test_limited_user_only_receives_authorized_modules_and_personal_settings(): void
    {
        $user = $this->userWithPermissions(['inventory.view', 'feedback.view']);

        $this->actingAs($user)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('modules', 3)
                ->where('modules', fn ($modules) => collect($modules)->pluck('key')->all() === [
                    'inventory', 'feedback', 'personal',
                ]));
    }

    public function test_booking_modules_follow_the_feature_flag(): void
    {
        config()->set('features.online_booking', false);
        $user = $this->userWithPermissions(['appointments.view', 'printers.manage_schedule']);

        $this->actingAs($user)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('modules', 1)
                ->where('modules.0.key', 'personal'));
    }

    private function userWithPermissions(array $permissions, bool $active = true): User
    {
        $role = Role::query()->create([
            'name' => 'Panel '.Str::random(6),
            'slug' => Str::lower(Str::random(12)),
        ]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => $active]);
        $user->roles()->attach($role);

        return $user;
    }
}
