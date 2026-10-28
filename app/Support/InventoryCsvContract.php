<?php

namespace App\Support;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use Illuminate\Support\Str;

final class InventoryCsvContract
{
    public const COLUMNS = [
        'sku' => 'Stok kodu',
        'name' => 'Malzeme',
        'type' => 'Tür',
        'category' => 'Kategori',
        'location_code' => 'Konum kodu',
        'location' => 'Konum',
        'quantity' => 'Miktar',
        'unit' => 'Birim',
        'minimum_stock' => 'Kritik stok',
        'status' => 'Durum',
        'visibility' => 'Katalog görünürlüğü',
        'description' => 'Açıklama',
    ];

    public const TYPE_LABELS = [
        InventoryItemType::Consumable->value => 'Sarf malzemesi',
        InventoryItemType::Loanable->value => 'Ödünç verilebilir',
        InventoryItemType::FixedAsset->value => 'Demirbaş',
    ];

    public const VISIBILITY_LABELS = [
        InventoryVisibility::Exact->value => 'Kesin miktar',
        InventoryVisibility::Status->value => 'Stok durumu',
        InventoryVisibility::Hidden->value => 'Gizli',
    ];

    public const STATUS_LABELS = [
        'active' => 'Aktif',
        'inactive' => 'Pasif',
        'archived' => 'Arşivlendi',
    ];

    public static function typeLabel(InventoryItemType $type): string
    {
        return self::TYPE_LABELS[$type->value];
    }

    public static function visibilityLabel(InventoryVisibility $visibility): string
    {
        return self::VISIBILITY_LABELS[$visibility->value];
    }

    public static function statusLabel(string $status): string
    {
        return self::STATUS_LABELS[$status];
    }

    public static function parseType(string $value): ?string
    {
        $aliases = [
            'sarf' => InventoryItemType::Consumable->value,
            'consumable' => InventoryItemType::Consumable->value,
            'ödünç' => InventoryItemType::Loanable->value,
            'odunc' => InventoryItemType::Loanable->value,
            'loanable' => InventoryItemType::Loanable->value,
            'demirbaş' => InventoryItemType::FixedAsset->value,
            'demirbas' => InventoryItemType::FixedAsset->value,
            'fixed_asset' => InventoryItemType::FixedAsset->value,
        ];

        foreach (self::TYPE_LABELS as $key => $label) {
            $aliases[self::normalize($label)] = $key;
        }

        return $aliases[self::normalize($value)] ?? null;
    }

    public static function parseVisibility(string $value): ?string
    {
        $aliases = [
            'kesin' => InventoryVisibility::Exact->value,
            'exact' => InventoryVisibility::Exact->value,
            'durum' => InventoryVisibility::Status->value,
            'status' => InventoryVisibility::Status->value,
            'gizli' => InventoryVisibility::Hidden->value,
            'hidden' => InventoryVisibility::Hidden->value,
        ];

        foreach (self::VISIBILITY_LABELS as $key => $label) {
            $aliases[self::normalize($label)] = $key;
        }

        return $aliases[self::normalize($value)] ?? null;
    }

    public static function parseStatus(string $value): ?string
    {
        $aliases = ['active' => 'active', 'inactive' => 'inactive', 'archived' => 'archived'];
        foreach (self::STATUS_LABELS as $key => $label) {
            $aliases[self::normalize($label)] = $key;
        }

        return $aliases[self::normalize($value)] ?? null;
    }

    public static function normalize(string $value): string
    {
        return str_replace("\u{0307}", '', Str::lower(trim($value)));
    }
}
