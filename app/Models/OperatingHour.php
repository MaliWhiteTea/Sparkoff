<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OperatingHour extends Model
{
    protected $fillable = ['weekday', 'is_open', 'opens_at', 'latest_start_at'];

    protected function casts(): array
    {
        return ['is_open' => 'boolean'];
    }
}
