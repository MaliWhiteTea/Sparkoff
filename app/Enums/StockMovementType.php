<?php

namespace App\Enums;

enum StockMovementType: string
{
    case Initial = 'initial';
    case Adjustment = 'adjustment';
    case Delivery = 'delivery';
    case Return = 'return';
    case Reversal = 'reversal';
}
