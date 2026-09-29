<?php

namespace App\Http\Controllers;

use App\Models\Filament;
use Inertia\Inertia;
use Inertia\Response;

class FilamentController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Filaments', [
            'materials' => Filament::query()->orderBy('material')->orderBy('sort_order')->get()
                ->groupBy('material')->map(fn ($items, string $material) => [
                    'material' => $material,
                    'isAvailable' => $items->contains(fn (Filament $filament) => $filament->is_available),
                    'unavailableReason' => $items->firstWhere('is_available', false)?->unavailable_reason,
                    'options' => $items->map(fn (Filament $filament) => $this->serialize($filament))->values(),
                ])->values(),
        ]);
    }

    private function serialize(Filament $filament): array
    {
        return [
            'id' => $filament->id, 'color' => $filament->color, 'brand' => $filament->brand,
            'isAvailable' => $filament->is_available, 'unavailableReason' => $filament->unavailable_reason,
            'diameterMm' => $filament->diameter_mm, 'spoolWeightGrams' => $filament->spool_weight_grams,
            'nozzleTemperature' => $this->range($filament->nozzle_temp_min, $filament->nozzle_temp_max),
            'bedTemperature' => $this->range($filament->bed_temp_min, $filament->bed_temp_max),
            'technicalNotes' => $filament->technical_notes,
        ];
    }

    private function range(?int $minimum, ?int $maximum): ?string
    {
        return $minimum !== null && $maximum !== null ? "{$minimum}–{$maximum} °C" : null;
    }
}
