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

        User::query()
            ->where('role', 'admin')
            ->each(fn (User $user) => $user->roles()->syncWithoutDetaching([$systemAdministrator->id]));
    }
}
