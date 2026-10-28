<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AppointmentStatus;
use App\Enums\FeedbackStatus;
use App\Enums\InventoryItemType;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SavedFilterController extends Controller
{
    private const TABLE_PERMISSIONS = [
        'inventory' => 'inventory.view',
        'loans' => 'loans.view',
        'appointments' => 'appointments.view',
        'feedback' => 'feedback.view',
    ];

    public function store(Request $request): RedirectResponse
    {
        $request->merge(['name' => trim((string) $request->input('name'))]);
        $table = $request->validate([
            'table' => ['required', Rule::in(array_keys(self::TABLE_PERMISSIONS))],
        ])['table'];
        $this->authorizeTable($request, $table);

        $filterRules = $this->filterRules($table);
        $filterKeys = collect(array_keys($filterRules))
            ->map(fn (string $key) => Str::after($key, 'filters.'))
            ->all();
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:40'],
            'filters' => ['required', 'array:'.implode(',', $filterKeys)],
            ...$filterRules,
        ]);
        $filters = collect($filterKeys)->mapWithKeys(fn (string $key) => [
            $key => (string) ($validated['filters'][$key] ?? ''),
        ])->all();

        $preferences = $request->user()->saved_filters ?? [];
        $saved = collect($preferences[$table] ?? [])->filter(fn ($filter) => is_array($filter))->values();
        $existingIndex = $saved->search(fn (array $filter) => mb_strtolower((string) ($filter['name'] ?? '')) === mb_strtolower($validated['name']));

        if ($existingIndex === false && $saved->count() >= 10) {
            throw ValidationException::withMessages([
                'name' => 'Her liste için en fazla 10 kayıtlı filtre oluşturabilirsiniz.',
            ]);
        }

        $entry = [
            'id' => $existingIndex === false ? (string) Str::uuid() : $saved[$existingIndex]['id'],
            'name' => $validated['name'],
            'filters' => $filters,
        ];

        if ($existingIndex === false) {
            $saved->push($entry);
        } else {
            $saved->put($existingIndex, $entry);
        }

        $preferences[$table] = $saved->values()->all();
        $request->user()->update(['saved_filters' => $preferences]);

        return back()->with('success', $existingIndex === false
            ? 'Filtre görünümü hesabınıza kaydedildi.'
            : 'Kayıtlı filtre görünümü güncellendi.');
    }

    public function destroy(Request $request, string $table, string $filterId): RedirectResponse
    {
        abort_unless(array_key_exists($table, self::TABLE_PERMISSIONS) && Str::isUuid($filterId), 404);
        $this->authorizeTable($request, $table);

        $preferences = $request->user()->saved_filters ?? [];
        $saved = collect($preferences[$table] ?? [])->filter(fn ($filter) => is_array($filter));
        abort_unless($saved->contains(fn (array $filter) => ($filter['id'] ?? null) === $filterId), 404);

        $preferences[$table] = $saved
            ->reject(fn (array $filter) => ($filter['id'] ?? null) === $filterId)
            ->values()
            ->all();
        $request->user()->update(['saved_filters' => $preferences]);

        return back()->with('success', 'Kayıtlı filtre silindi.');
    }

    private function authorizeTable(Request $request, string $table): void
    {
        abort_unless($request->user()->hasPermissionTo(self::TABLE_PERMISSIONS[$table]), 403);
    }

    /** @return array<string, array<int, mixed>> */
    private function filterRules(string $table): array
    {
        return match ($table) {
            'inventory' => [
                'filters.search' => ['nullable', 'string', 'max:100'],
                'filters.category' => ['nullable', 'integer', 'exists:inventory_categories,id'],
                'filters.type' => ['nullable', Rule::enum(InventoryItemType::class)],
                'filters.status' => ['required', Rule::in(['all', 'active', 'inactive', 'low', 'out', 'archived'])],
            ],
            'loans' => [
                'filters.status' => ['required', Rule::in(['active', 'overdue', 'completed', 'damaged', 'lost'])],
            ],
            'appointments' => [
                'filters.search' => ['nullable', 'string', 'max:100'],
                'filters.status' => ['nullable', Rule::enum(AppointmentStatus::class)],
            ],
            'feedback' => [
                'filters.status' => ['nullable', Rule::enum(FeedbackStatus::class)],
            ],
        };
    }
}
