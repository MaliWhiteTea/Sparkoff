<?php

namespace App\Enums;

enum InventoryItemType: string
{
    case Consumable = 'consumable';
    case Loanable = 'loanable';
    case FixedAsset = 'fixed_asset';
}
