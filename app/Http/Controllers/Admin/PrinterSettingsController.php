<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PrinterStatus;
use App\Http\Controllers\Controller;
use App\Models\BlackoutPeriod;
use App\Models\Printer;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PrinterSettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Settings/Printers', [
            'printers' => Printer::query()->orderBy('sort_order')->get()->map(fn (Printer $printer) => [
                'id' => $printer->id,
                'code' => $printer->code,
                'name' => $printer->name,
                'status' => $printer->status->value,
                'description' => $printer->description,
                'appointmentCount' => $printer->appointments()->count(),
            ]),
            'blackouts' => BlackoutPeriod::query()
                ->with('printer')
                ->where('ends_at', '>=', now())
                ->orderBy('starts_at')
                ->get()
                ->map(fn (BlackoutPeriod $blackout) => [
                    'id' => $blackout->id,
                    'printerId' => $blackout->printer_id,
                    'printer' => $blackout->printer?->name ?? 'Tüm atölye',
                    'kind' => $blackout->kind,
                    'kindLabel' => $this->kindLabel($blackout->kind),
                    'isAllDay' => $blackout->is_all_day,
                    'startsAt' => $blackout->starts_at->translatedFormat('d F Y, H:i'),
                    'endsAt' => $blackout->ends_at->translatedFormat('d F Y, H:i'),
                    'startsAtInput' => $blackout->is_all_day ? $blackout->starts_at->format('Y-m-d') : $blackout->starts_at->format('Y-m-d\TH:i'),
                    'endsAtInput' => $blackout->is_all_day ? $blackout->ends_at->copy()->subDay()->format('Y-m-d') : $blackout->ends_at->format('Y-m-d\TH:i'),
                    'reason' => $blackout->reason,
                ]),
            'statusOptions' => [
                ['value' => PrinterStatus::Active->value, 'label' => 'Aktif'],
                ['value' => PrinterStatus::Maintenance->value, 'label' => 'Bakımda'],
                ['value' => PrinterStatus::Inactive->value, 'label' => 'Pasif'],
            ],
            'scheduleKinds' => [
                ['value' => 'busy', 'label' => 'Dolu'],
                ['value' => 'maintenance', 'label' => 'Bakım'],
                ['value' => 'closed', 'label' => 'Kapalı'],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->merge(['code' => mb_strtoupper(trim((string) $request->input('code')))]);

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:20', 'alpha_dash', 'unique:printers,code'],
            'name' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::enum(PrinterStatus::class)],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        Printer::query()->create([
            ...$validated,
            'sort_order' => ((int) Printer::query()->max('sort_order')) + 1,
        ]);

        return back()->with('success', 'Yazıcı eklendi.');
    }

    public function update(Request $request, Printer $printer): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::enum(PrinterStatus::class)],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $printer->update($validated);

        return back()->with('success', "{$printer->code} yazıcısı güncellendi.");
    }

    public function storeBlackout(Request $request): RedirectResponse
    {
        $validated = $this->validateSchedule($request);
        [$startsAt, $endsAt] = $this->scheduleDates($validated);

        if ($this->hasScheduleConflict($validated['printer_id'] ?? null, $startsAt, $endsAt)) {
            return back()->withErrors(['starts_at' => 'Bu yazıcı için seçilen zaman aralığı mevcut bir kayıtla çakışıyor.'])->withInput();
        }

        BlackoutPeriod::query()->create([
            'printer_id' => $validated['printer_id'] ?? null,
            'kind' => $validated['kind'],
            'is_all_day' => $validated['is_all_day'],
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'reason' => $validated['reason'],
        ]);

        return back()->with('success', 'Takvim kaydı eklendi.');
    }

    public function updateBlackout(Request $request, BlackoutPeriod $blackout): RedirectResponse
    {
        $validated = $this->validateSchedule($request);
        [$startsAt, $endsAt] = $this->scheduleDates($validated);

        if ($this->hasScheduleConflict($validated['printer_id'] ?? null, $startsAt, $endsAt, $blackout)) {
            return back()->withErrors(['starts_at' => 'Bu yazıcı için seçilen zaman aralığı mevcut bir kayıtla çakışıyor.'])->withInput();
        }

        $blackout->update([
            'printer_id' => $validated['printer_id'] ?? null,
            'kind' => $validated['kind'],
            'is_all_day' => $validated['is_all_day'],
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'reason' => $validated['reason'],
        ]);

        return back()->with('success', 'Takvim kaydı güncellendi.');
    }

    private function validateSchedule(Request $request): array
    {
        $request->merge(['is_all_day' => $request->boolean('is_all_day')]);

        return $request->validate([
            'printer_id' => ['nullable', 'integer', 'exists:printers,id'],
            'kind' => ['required', Rule::in(['busy', 'maintenance', 'closed'])],
            'is_all_day' => ['required', 'boolean'],
            'starts_at' => ['required', $request->boolean('is_all_day') ? 'date_format:Y-m-d' : 'date_format:Y-m-d\TH:i'],
            'ends_at' => ['required', $request->boolean('is_all_day') ? 'date_format:Y-m-d' : 'date_format:Y-m-d\TH:i', 'after_or_equal:starts_at'],
            'reason' => ['required', 'string', 'max:255'],
        ]);
    }

    private function scheduleDates(array $validated): array
    {
        if ($validated['is_all_day']) {
            return [
                CarbonImmutable::createFromFormat('Y-m-d', $validated['starts_at'], config('app.timezone'))->startOfDay(),
                CarbonImmutable::createFromFormat('Y-m-d', $validated['ends_at'], config('app.timezone'))->addDay()->startOfDay(),
            ];
        }

        return [
            CarbonImmutable::createFromFormat('Y-m-d\TH:i', $validated['starts_at'], config('app.timezone')),
            CarbonImmutable::createFromFormat('Y-m-d\TH:i', $validated['ends_at'], config('app.timezone')),
        ];
    }

    private function hasScheduleConflict(?int $printerId, CarbonImmutable $startsAt, CarbonImmutable $endsAt, ?BlackoutPeriod $except = null): bool
    {
        return BlackoutPeriod::query()
            ->when($except, fn ($query) => $query->whereKeyNot($except->id))
            ->when($printerId !== null, fn ($query) => $query->where(
                fn ($scope) => $scope->whereNull('printer_id')->orWhere('printer_id', $printerId)
            ))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->exists();
    }

    public function destroyBlackout(BlackoutPeriod $blackout): RedirectResponse
    {
        $blackout->delete();

        return back()->with('success', 'Takvim kaydı kaldırıldı.');
    }

    private function kindLabel(string $kind): string
    {
        return match ($kind) {
            'busy' => 'Dolu',
            'maintenance' => 'Bakım',
            default => 'Kapalı',
        };
    }
}
