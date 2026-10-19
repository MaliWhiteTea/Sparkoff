<?php

namespace App\Enums;

enum FeedbackType: string
{
    case Suggestion = 'suggestion';
    case Complaint = 'complaint';
    case Bug = 'bug';
}
