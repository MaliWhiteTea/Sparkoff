<?php

namespace App\Models;

use App\Enums\PrinterStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Printer extends Model
{
    protected $fillable = ['code', 'name', 'status', 'description', 'sort_order'];

    protected function casts(): array
    {
        return ['status' => PrinterStatus::class];
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function blackoutPeriods(): HasMany
    {
        return $this->hasMany(BlackoutPeriod::class);
    }
}
