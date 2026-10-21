<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AccessController extends Controller
{
    public function index(Request $request): Response
    {
        $canViewRoles = $request->user()->role === 'admin' || $request->user()->hasPermissionTo('roles.view');
        $canViewUsers = $request->user()->role === 'admin' || $request->user()->hasPermissionTo('users.view');
        $sorting = $request->validate([
            'user_sort' => ['nullable', Rule::in(['name', 'email', 'is_active', 'created_at'])],
            'user_direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'role_sort' => ['nullable', Rule::in(['name', 'users_count', 'created_at'])],
            'role_direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);
        $userSort = $sorting['user_sort'] ?? 'name';
        $userDirection = $sorting['user_direction'] ?? 'asc';
        $roleSort = $sorting['role_sort'] ?? 'name';
        $roleDirection = $sorting['role_direction'] ?? 'asc';

        return Inertia::render('Admin/Access/Index', [
            'roles' => Role::query()->withCount('users')->when($canViewRoles, fn ($query) => $query->with('permissions:id,key'))->orderByDesc('is_system')->orderBy($roleSort, $roleDirection)->orderBy('id')->get()->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'isSystem' => $role->is_system,
                'isProtected' => $role->is_protected,
                'userCount' => $role->users_count,
                'permissions' => $canViewRoles ? $role->permissions->pluck('key') : [],
            ]),
            'permissionGroups' => $canViewRoles ? Permission::query()->orderBy('module')->orderBy('label')->get()->groupBy('module')->map(fn ($permissions) => $permissions->map(fn (Permission $permission) => [
                'key' => $permission->key,
                'label' => $permission->label,
                'isSensitive' => $permission->is_sensitive,
            ])->values()) : (object) [],
            'users' => $canViewUsers ? User::query()->with('roles:id,name')->orderBy($userSort, $userDirection)->orderBy('id')->get()->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'isActive' => $user->is_active,
                'roles' => $user->roles->map(fn (Role $role) => ['id' => $role->id, 'name' => $role->name]),
            ]) : [],
            'sorting' => [
                'userSort' => $userSort, 'userDirection' => $userDirection,
                'roleSort' => $roleSort, 'roleDirection' => $roleDirection,
            ],
        ]);
    }

    public function storeRole(Request $request): RedirectResponse
    {
        $validated = $this->validateRole($request);
        $role = Role::query()->create([
            'name' => $validated['name'],
            'slug' => $this->uniqueSlug($validated['name']),
            'description' => $validated['description'] ?? null,
        ]);
        $role->permissions()->sync($this->permissionIds($validated['permissions'] ?? []));
        $this->recordRelationChange($role, 'permissions');

        return back()->with('success', 'Rol oluşturuldu.');
    }

    public function updateRole(Request $request, Role $role): RedirectResponse
    {
        abort_if($role->is_protected, 403, 'Korunan Sistem Yöneticisi rolü değiştirilemez.');
        $validated = $this->validateRole($request);
        $role->update(['name' => $validated['name'], 'description' => $validated['description'] ?? null]);
        $role->permissions()->sync($this->permissionIds($validated['permissions'] ?? []));
        $this->recordRelationChange($role, 'permissions');

        return back()->with('success', 'Rol ve yetkileri güncellendi.');
    }

    public function destroyRole(Role $role): RedirectResponse
    {
        abort_if($role->is_protected, 403, 'Korunan roller silinemez.');
        if ($role->users()->exists()) {
            throw ValidationException::withMessages(['role' => 'Bu rol kullanıcılar tarafından kullanılıyor; önce kullanıcı atamalarını kaldırın.']);
        }
        $role->delete();

        return back()->with('success', 'Rol kaldırıldı.');
    }

    public function storeUser(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12'],
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'distinct', 'exists:roles,id'],
        ]);

        $this->authorizeSystemRoleAssignment($request, $validated['role_ids']);

        DB::transaction(function () use ($validated) {
            $user = User::query()->create([
                'name' => $validated['name'],
                'email' => Str::lower($validated['email']),
                'password' => $validated['password'],
                'role' => 'operator',
                'is_active' => true,
            ]);
            $user->roles()->sync($validated['role_ids']);
            $this->recordRelationChange($user, 'roles');
        });

        return back()->with('success', 'Yetkili kullanıcı oluşturuldu.');
    }

    public function updateUser(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')->ignore($user)],
            'password' => ['nullable', 'string', 'min:12'],
            'is_active' => ['required', 'boolean'],
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'distinct', 'exists:roles,id'],
        ]);

        $can = fn (string $permission) => $request->user()->role === 'admin' || $request->user()->hasPermissionTo($permission);
        $submittedRoleIds = collect($validated['role_ids'])->map(fn ($id) => (int) $id)->sort()->values()->all();
        $currentRoleIds = $user->roles()->pluck('roles.id')->map(fn ($id) => (int) $id)->sort()->values()->all();

        abort_if(! $can('users.update') && ($validated['name'] !== $user->name || Str::lower($validated['email']) !== $user->email), 403);
        abort_if(! $can('users.disable') && (bool) $validated['is_active'] !== $user->is_active, 403);
        abort_if(! $can('users.reset_password') && ! empty($validated['password']), 403);
        abort_if(! $can('roles.assign') && $submittedRoleIds !== $currentRoleIds, 403);

        $this->authorizeSystemRoleAssignment($request, $validated['role_ids'], $user);

        $systemRoleId = Role::query()->where('is_system', true)->value('id');
        $removesSystemAccess = $user->roles()->where('is_system', true)->exists()
            && (! $validated['is_active'] || ! in_array($systemRoleId, $validated['role_ids'], true));

        if ($removesSystemAccess && ! User::query()->where('is_active', true)->whereKeyNot($user->id)->whereHas('roles', fn ($query) => $query->where('is_system', true))->exists()) {
            throw ValidationException::withMessages(['role_ids' => 'Son aktif Sistem Yöneticisi pasifleştirilemez veya bu rolden çıkarılamaz.']);
        }

        DB::transaction(function () use ($validated, $user) {
            $attributes = [
                'name' => $validated['name'],
                'email' => Str::lower($validated['email']),
                'is_active' => $validated['is_active'],
            ];
            if (! empty($validated['password'])) {
                $attributes['password'] = $validated['password'];
            }
            $user->update($attributes);
            $user->roles()->sync($validated['role_ids']);
            $this->recordRelationChange($user, 'roles');
        });

        return back()->with('success', 'Kullanıcı ve rol atamaları güncellendi.');
    }

    private function validateRole(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', 'distinct', 'exists:permissions,key'],
        ]);
    }

    private function permissionIds(array $keys): array
    {
        return Permission::query()->whereIn('key', $keys)->pluck('id')->all();
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'rol';
        $slug = $base;
        $counter = 2;
        while (Role::query()->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    private function authorizeSystemRoleAssignment(Request $request, array $roleIds, ?User $target = null): void
    {
        $touchesSystemRole = Role::query()->whereIn('id', $roleIds)->where('is_system', true)->exists()
            || $target?->roles()->where('is_system', true)->exists();

        abort_if(
            $touchesSystemRole && $request->user()?->role !== 'admin' && ! $request->user()?->isSystemAdministrator(),
            403,
            'Sistem Yöneticisi rolünü yalnızca başka bir Sistem Yöneticisi atayabilir.',
        );
    }

    private function recordRelationChange(Role|User $subject, string $relation): void
    {
        ActivityLog::query()->create([
            'user_id' => auth()->id(),
            'action' => 'updated',
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->getKey(),
            'changed_fields' => [$relation],
            'created_at' => now(),
        ]);
    }
}
