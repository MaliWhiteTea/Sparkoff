<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['key', 'value', 'group'];

    protected function casts(): array
    {
        return ['value' => 'json'];
    }

    public static function valueOf(string $key, mixed $default = null): mixed
    {
        return static::query()->firstWhere('key', $key)?->value ?? $default;
    }
}
