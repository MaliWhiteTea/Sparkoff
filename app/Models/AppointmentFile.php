<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentFile extends Model
{
    protected $fillable = [
        'appointment_id', 'disk', 'path', 'original_name', 'extension', 'mime_type',
        'size_bytes', 'scheduled_deletion_at', 'deleted_at',
    ];

    protected function casts(): array
    {
        return ['scheduled_deletion_at' => 'datetime', 'deleted_at' => 'datetime'];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }
}
