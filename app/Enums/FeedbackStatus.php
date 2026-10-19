<?php

namespace App\Enums;

enum FeedbackStatus: string
{
    case New = 'new';
    case Reviewing = 'reviewing';
    case Resolved = 'resolved';
    case Archived = 'archived';
}
