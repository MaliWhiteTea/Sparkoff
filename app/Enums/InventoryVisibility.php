<?php

namespace App\Enums;

enum InventoryVisibility: string
{
    case Exact = 'exact';
    case Status = 'status';
    case Hidden = 'hidden';
}
