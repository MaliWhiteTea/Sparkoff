<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Announcement extends Model
{
    protected $fillable = ['title', 'body', 'type', 'placement', 'audience', 'is_published', 'is_pinned', 'requires_acknowledgement', 'starts_at', 'ends_at'];

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'is_pinned' => 'boolean', 'requires_acknowledgement' => 'boolean', 'starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    public function scopeVisibleAt(Builder $query, string $placement): Builder
    {
        return $query
            ->where('is_published', true)
            ->whereIn('audience', ['public', 'both'])
            ->whereIn('placement', ['all', $placement])
            ->where(fn (Builder $scope) => $scope->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn (Builder $scope) => $scope->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }

    public function scopeVisibleToStaffReader(Builder $query, User $user): Builder
    {
        $query
            ->where('is_published', true)
            ->whereIn('audience', ['staff', 'both'])
            ->where(fn (Builder $scope) => $scope->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn (Builder $scope) => $scope->whereNull('ends_at')->orWhere('ends_at', '>', now()));

        if (! $user->isSystemAdministrator()) {
            $roleIds = $user->roles()->pluck('roles.id');
            $query->where(fn (Builder $scope) => $scope
                ->whereDoesntHave('targetRoles')
                ->orWhereHas('targetRoles', fn (Builder $roles) => $roles->whereIn('roles.id', $roleIds)));
        }

        return $query;
    }

    public function targetRoles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'announcement_role');
    }

    public function readers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'announcement_user')->withPivot(['read_at', 'acknowledged_at']);
    }
}
