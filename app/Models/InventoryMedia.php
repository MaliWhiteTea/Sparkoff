<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

#[Fillable(['inventory_item_id', 'type', 'file_path', 'external_url', 'title', 'alt_text', 'sort_order', 'is_cover'])]
class InventoryMedia extends Model
{
    protected $table = 'inventory_media';

    protected function casts(): array
    {
        return ['is_cover' => 'boolean'];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function publicUrl(): ?string
    {
        return $this->file_path ? Storage::disk('public')->url($this->file_path) : $this->external_url;
    }
}
