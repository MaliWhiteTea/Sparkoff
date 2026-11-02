<?php

namespace App\Models;

use App\Enums\UndoActionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'type', 'payload', 'original_activity_log_id', 'reversal_activity_log_id',
    'expires_at', 'used_at',
])]
class UndoAction extends Model
{
    protected function casts(): array
    {
        return [
            'type' => UndoActionType::class,
            'payload' => 'array',
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function originalActivityLog(): BelongsTo
    {
        return $this->belongsTo(ActivityLog::class, 'original_activity_log_id');
    }

    public function reversalActivityLog(): BelongsTo
    {
        return $this->belongsTo(ActivityLog::class, 'reversal_activity_log_id');
    }
}
