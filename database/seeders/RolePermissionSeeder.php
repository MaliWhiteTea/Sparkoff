<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $rolesWereAlreadyProvisioned = Role::query()
            ->where('slug', 'system-administrator')
            ->exists();
        $permissionIds = [];

        foreach (config('permissions') as $module => $permissions) {
            foreach ($permissions as $key => $definition) {
                $permission = Permission::query()->updateOrCreate(
                    ['key' => $key],
                    [
                        'module' => $module,
                        'label' => $definition['label'],
                        'is_sensitive' => $definition['sensitive'] ?? false,
                    ],
                );
                $permissionIds[] = $permission->id;
            }
        }

        $systemAdministrator = Role::query()->updateOrCreate(
            ['slug' => 'system-administrator'],
            [
                'name' => 'Sistem Yöneticisi',
                'description' => 'Tüm modüllere ve sistem ayarlarına erişebilen korunan rol.',
                'is_system' => true,
                'is_protected' => true,
            ],
        );
        $systemAdministrator->permissions()->sync($permissionIds);

        $inventoryModerator = Role::query()->updateOrCreate(
            ['slug' => 'inventory-moderator'],
            [
                'name' => 'Malzeme Moderatörü',
                'description' => 'Malzeme teslim ve iade işlemlerini yürütür.',
                'is_system' => false,
                'is_protected' => false,
            ],
        );
        if ($inventoryModerator->wasRecentlyCreated || $inventoryModerator->permissions()->doesntExist()) {
            $inventoryModerator->permissions()->sync(Permission::query()->whereIn('key', [
                'inventory.view', 'loans.view', 'loans.create', 'loans.receive_return',
                'loans.view_personal_data', 'loans.view_email',
            ])->pluck('id'));
        }

        // This transition is only safe before the first role assignment exists.
        // Re-running the seeder later must not restore a deliberately removed
        // system role merely because an old users.role value is still present.
        if (! $rolesWereAlreadyProvisioned) {
            User::query()
                ->where('role', 'admin')
                ->each(fn (User $user) => $user->roles()->syncWithoutDetaching([$systemAdministrator->id]));
        }

        // The legacy column is retained for schema compatibility, but it is no
        // longer an authorization source.
        User::query()->where('role', 'admin')->update(['role' => 'operator']);
    }
}
