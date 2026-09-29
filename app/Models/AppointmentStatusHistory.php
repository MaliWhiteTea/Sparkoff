<?php

namespace App\Models;

use App\Enums\AppointmentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppointmentStatusHistory extends Model
{
    protected $fillable = ['appointment_id', 'actor_id', 'from_status', 'to_status', 'note'];

    protected function casts(): array
    {
        return ['from_status' => AppointmentStatus::class, 'to_status' => AppointmentStatus::class];
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
