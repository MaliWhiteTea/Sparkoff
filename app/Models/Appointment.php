<?php

namespace App\Models;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Appointment extends Model
{
    protected $fillable = [
        'public_id', 'printer_id', 'status', 'first_name', 'last_name', 'email', 'phone',
        'starts_at', 'ends_at', 'duration_minutes', 'filament_source', 'filament_id',
        'filament_material', 'filament_color', 'user_note', 'admin_note',
        'verification_token_hash', 'tracking_token_hash', 'email_verified_at',
        'verification_expires_at', 'canceled_at', 'privacy_notice_version',
        'privacy_notice_seen_at', 'rules_accepted_at',
    ];

    protected static function booted(): void
    {
        static::creating(function (Appointment $appointment) {
            $appointment->public_id ??= (string) Str::uuid();
        });
    }

    protected function casts(): array
    {
        return [
            'status' => AppointmentStatus::class,
            'filament_source' => FilamentSource::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'email_verified_at' => 'datetime',
            'verification_expires_at' => 'datetime',
            'canceled_at' => 'datetime',
            'privacy_notice_seen_at' => 'datetime',
            'rules_accepted_at' => 'datetime',
        ];
    }

    public function scopeOverlapping(Builder $query, int $printerId, mixed $startsAt, mixed $endsAt): Builder
    {
        return $query
            ->where('printer_id', $printerId)
            ->whereIn('status', AppointmentStatus::blockingValues())
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->where(function (Builder $query) {
                $query->where('status', '!=', AppointmentStatus::PendingVerification->value)
                    ->orWhereNull('verification_expires_at')
                    ->orWhere('verification_expires_at', '>', now());
            });
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(Printer::class);
    }

    public function filament(): BelongsTo
    {
        return $this->belongsTo(Filament::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(AppointmentFile::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(AppointmentStatusHistory::class);
    }
}
