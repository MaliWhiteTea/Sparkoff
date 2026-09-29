<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Filament;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FilamentSettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Settings/Filaments', [
            'filaments' => Filament::query()->orderBy('material')->orderBy('sort_order')->get(),
            'materials' => Filament::query()->orderBy('material')->get()->groupBy('material')->map(fn ($items, string $material) => [
                'material' => $material,
                'isAvailable' => $items->contains(fn (Filament $filament) => $filament->is_available),
                'reason' => $items->firstWhere('is_available', false)?->unavailable_reason,
                'count' => $items->count(),
            ])->values(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateFilament($request);
        $validated['sort_order'] = ((int) Filament::query()->max('sort_order')) + 1;
        Filament::query()->create($validated);

        return back()->with('success', 'Filament seçeneği eklendi.');
    }

    public function update(Request $request, Filament $filament): RedirectResponse
    {
        $filament->update($this->validateFilament($request, $filament));

        return back()->with('success', 'Filament bilgileri güncellendi.');
    }

    public function updateMaterialAvailability(Request $request, string $material): RedirectResponse
    {
        $validated = $request->validate([
            'is_available' => ['required', 'boolean'],
            'reason' => ['nullable', 'string', 'max:500', Rule::requiredIf(! $request->boolean('is_available'))],
        ]);

        $updated = Filament::query()->where('material', $material)->update([
            'is_available' => $validated['is_available'],
            'unavailable_reason' => $validated['is_available'] ? null : $validated['reason'],
        ]);
        abort_if($updated === 0, 404);

        return back()->with('success', "{$material} kullanılabilirliği güncellendi.");
    }

    private function validateFilament(Request $request, ?Filament $filament = null): array
    {
        return $request->validate([
            'material' => ['required', 'string', 'max:40'],
            'color' => [
                'required', 'string', 'max:80',
                Rule::unique('filaments')->where(fn ($query) => $query->where('material', $request->input('material')))->ignore($filament?->id),
            ],
            'brand' => ['nullable', 'string', 'max:100'],
            'diameter_mm' => ['required', 'numeric', 'between:1,3'],
            'spool_weight_grams' => ['nullable', 'integer', 'between:1,10000'],
            'nozzle_temp_min' => ['nullable', 'integer', 'between:100,400'],
            'nozzle_temp_max' => ['nullable', 'integer', 'between:100,400', 'gte:nozzle_temp_min'],
            'bed_temp_min' => ['nullable', 'integer', 'between:0,200'],
            'bed_temp_max' => ['nullable', 'integer', 'between:0,200', 'gte:bed_temp_min'],
            'technical_notes' => ['nullable', 'string', 'max:2000'],
            'is_available' => ['required', 'boolean'],
            'unavailable_reason' => ['nullable', 'string', 'max:500', Rule::requiredIf(! $request->boolean('is_available'))],
        ]);
    }
}
