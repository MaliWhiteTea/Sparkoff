<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Filament extends Model
{
    protected $fillable = [
        'material', 'color', 'brand', 'diameter_mm', 'spool_weight_grams',
        'nozzle_temp_min', 'nozzle_temp_max', 'bed_temp_min', 'bed_temp_max',
        'technical_notes', 'is_available', 'unavailable_reason', 'sort_order',
    ];

    protected function casts(): array
    {
        return ['is_available' => 'boolean', 'diameter_mm' => 'decimal:2'];
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }
}
