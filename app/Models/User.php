<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'role', 'is_active', 'interface_preferences', 'table_preferences', 'saved_filters'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'interface_preferences' => 'array',
            'table_preferences' => 'array',
            'saved_filters' => 'array',
        ];
    }

    /** @return array{theme: string, scale: string, density: string, sidebar: string} */
    public function interfacePreferences(): array
    {
        return array_merge([
            'theme' => 'dark',
            'scale' => 'normal',
            'density' => 'normal',
            'sidebar' => 'wide',
        ], $this->interface_preferences ?? []);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function isSystemAdministrator(): bool
    {
        return $this->roles()->where('is_system', true)->exists();
    }

    public function canAccessAdminPanel(): bool
    {
        return $this->roles()->exists();
    }

    public function hasRole(string $slug): bool
    {
        return $this->roles()->where('slug', $slug)->exists();
    }

    public function hasPermissionTo(string $permission): bool
    {
        if ($this->isSystemAdministrator()) {
            return true;
        }

        return $this->roles()
            ->whereHas('permissions', fn ($query) => $query->where('key', $permission))
            ->exists();
    }
}
