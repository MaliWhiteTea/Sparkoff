<?php

namespace App\Enums;

enum InventoryTransactionStatus: string
{
    case Active = 'active';
    case Completed = 'completed';
    case Damaged = 'damaged';
    case Lost = 'lost';
}
