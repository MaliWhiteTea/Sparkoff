<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Filament extends Model
{
    protected $fillable = ['material', 'color', 'brand', 'is_available', 'sort_order'];

    protected function casts(): array
    {
        return ['is_available' => 'boolean'];
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }
}
