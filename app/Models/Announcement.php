<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class Announcement extends Model
{
    protected $fillable = ['title', 'body', 'type', 'placement', 'is_published', 'starts_at', 'ends_at'];

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    public function scopeVisibleAt(Builder $query, string $placement): Builder
    {
        return $query
            ->where('is_published', true)
            ->whereIn('placement', ['all', $placement])
            ->where(fn (Builder $scope) => $scope->whereNull('starts_at')->orWhere('starts_at', '<=', now()))
            ->where(fn (Builder $scope) => $scope->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }
}
