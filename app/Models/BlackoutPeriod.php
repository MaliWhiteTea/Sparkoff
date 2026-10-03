<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlackoutPeriod extends Model
{
    protected $fillable = ['printer_id', 'kind', 'is_all_day', 'starts_at', 'ends_at', 'reason'];

    protected function casts(): array
    {
        return ['is_all_day' => 'boolean', 'starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class);
    }
}
