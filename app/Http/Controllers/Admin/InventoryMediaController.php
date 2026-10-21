<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\InventoryMedia;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\ValidationException;

class InventoryMediaController extends Controller
{
    public function store(Request $request, InventoryItem $item): RedirectResponse
    {
        $this->ensureEditable($item);
        $type = $request->validate(['type' => ['required', Rule::in(['image', 'video', 'link'])]])['type'];
        $limit = $type === 'image' ? 12 : ($type === 'video' ? 2 : 8);
        if ($item->media()->where('type', $type)->count() >= $limit) {
            throw ValidationException::withMessages(['media' => "Bu malzeme için en fazla {$limit} {$this->typeLabel($type)} eklenebilir."]);
        }

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:180'],
            'alt_text' => [$type === 'image' ? 'required' : 'nullable', 'string', 'max:180'],
            'file' => [$type === 'image' || $type === 'video' ? 'required' : 'nullable',
                $type === 'image' ? File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(8 * 1024) : File::types(['mp4', 'webm'])->max(50 * 1024)],
            'external_url' => [$type === 'link' ? 'required' : 'nullable', 'url', 'starts_with:https://', 'max:2048'],
        ]);

        $path = null;
        if ($request->hasFile('file')) {
            $path = $request->file('file')->store("inventory-media/{$item->id}", 'public');
        }

        try {
            DB::transaction(function () use ($item, $type, $data, $path) {
                $isCover = $type === 'image' && ! $item->media()->where('type', 'image')->exists();
                $item->media()->create([
                    'type' => $type, 'file_path' => $path, 'external_url' => $data['external_url'] ?? null,
                    'title' => $data['title'] ?? null, 'alt_text' => $data['alt_text'] ?? null,
                    'sort_order' => ((int) $item->media()->max('sort_order')) + 1, 'is_cover' => $isCover,
                ]);
            });
        } catch (\Throwable $exception) {
            if ($path) {
                Storage::disk('public')->delete($path);
            }

            throw $exception;
        }

        return back()->with('success', 'Malzeme medyası eklendi.');
    }

    public function update(Request $request, InventoryItem $item, InventoryMedia $medium): RedirectResponse
    {
        $this->ensureOwned($item, $medium);
        $this->ensureEditable($item);
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:180'],
            'alt_text' => [$medium->type === 'image' ? 'required' : 'nullable', 'string', 'max:180'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:999'],
            'is_cover' => ['required', 'boolean'],
            'external_url' => [$medium->type === 'link' ? 'required' : 'nullable', 'url', 'starts_with:https://', 'max:2048'],
        ]);
        if ($medium->type !== 'image') {
            $data['is_cover'] = false;
        }
        if ($medium->type !== 'link') {
            unset($data['external_url']);
        }

        DB::transaction(function () use ($item, $medium, $data) {
            if ((int) $medium->sort_order !== (int) $data['sort_order']) {
                $item->media()->whereKeyNot($medium->id)->where('sort_order', $data['sort_order'])
                    ->update(['sort_order' => $medium->sort_order]);
            }
            if ($data['is_cover']) {
                $item->media()->where('type', 'image')->whereKeyNot($medium->id)->update(['is_cover' => false]);
            }
            $medium->update($data);
        });

        return back()->with('success', 'Medya bilgileri güncellendi.');
    }

    public function destroy(InventoryItem $item, InventoryMedia $medium): RedirectResponse
    {
        $this->ensureOwned($item, $medium);
        $this->ensureEditable($item);
        $path = $medium->file_path;
        $wasCover = $medium->is_cover;

        DB::transaction(function () use ($item, $medium, $wasCover) {
            $medium->delete();
            $this->normalizeSortOrder($item);
            if ($wasCover) {
                $item->media()->where('type', 'image')->orderBy('sort_order')->first()?->update(['is_cover' => true]);
            }
        });
        if ($path) {
            Storage::disk('public')->delete($path);
        }

        return back()->with('success', 'Malzeme medyası kaldırıldı.');
    }

    private function ensureOwned(InventoryItem $item, InventoryMedia $medium): void
    {
        abort_unless($medium->inventory_item_id === $item->id, 404);
    }

    private function ensureEditable(InventoryItem $item): void
    {
        if ($item->archived_at) {
            throw ValidationException::withMessages(['media' => 'Arşivlenmiş bir malzemenin medyası değiştirilemez.']);
        }
    }

    private function typeLabel(string $type): string
    {
        return match ($type) {
            'image' => 'fotoğraf', 'video' => 'video', default => 'bağlantı',
        };
    }

    private function normalizeSortOrder(InventoryItem $item): void
    {
        $item->media()->orderBy('sort_order')->orderBy('id')->pluck('id')->each(
            fn (int $id, int $index) => InventoryMedia::query()->whereKey($id)->update(['sort_order' => $index + 1])
        );
    }
}
