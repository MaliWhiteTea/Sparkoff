<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'code', 'description', 'is_public', 'is_active'])]
class InventoryLocation extends Model
{
    protected function casts(): array
    {
        return ['is_public' => 'boolean', 'is_active' => 'boolean'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(InventoryItem::class, 'location_id');
    }
}
