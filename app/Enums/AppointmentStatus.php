<?php

namespace App\Enums;

enum AppointmentStatus: string
{
    case PendingVerification = 'pending_verification';
    case PendingApproval = 'pending_approval';
    case ChangeRequested = 'change_requested';
    case Approved = 'approved';
    case Ready = 'ready';
    case Printing = 'printing';
    case Completed = 'completed';
    case Failed = 'failed';
    case Rejected = 'rejected';
    case Canceled = 'canceled';
    case Expired = 'expired';

    public static function blockingValues(): array
    {
        return [
            self::PendingVerification->value,
            self::PendingApproval->value,
            self::ChangeRequested->value,
            self::Approved->value,
            self::Ready->value,
            self::Printing->value,
        ];
    }
}
