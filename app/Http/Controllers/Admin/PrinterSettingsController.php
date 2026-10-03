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
                    'printer' => $blackout->printer?->name ?? 'Tüm atölye',
                    'kind' => $blackout->kind,
                    'kindLabel' => $this->kindLabel($blackout->kind),
                    'startsAt' => $blackout->starts_at->translatedFormat('d F Y, H:i'),
                    'endsAt' => $blackout->ends_at->translatedFormat('d F Y, H:i'),
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
        $validated = $request->validate([
            'printer_id' => ['nullable', 'integer', 'exists:printers,id'],
            'kind' => ['required', Rule::in(['busy', 'maintenance', 'closed'])],
            'starts_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'ends_at' => ['required', 'date_format:Y-m-d\TH:i', 'after:starts_at'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $printerId = $validated['printer_id'] ?? null;
        $startsAt = CarbonImmutable::createFromFormat('Y-m-d\TH:i', $validated['starts_at'], config('app.timezone'));
        $endsAt = CarbonImmutable::createFromFormat('Y-m-d\TH:i', $validated['ends_at'], config('app.timezone'));
        $hasConflict = BlackoutPeriod::query()
            ->when($printerId !== null, fn ($query) => $query->where(
                fn ($scope) => $scope->whereNull('printer_id')->orWhere('printer_id', $printerId)
            ))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->exists();

        if ($hasConflict) {
            return back()->withErrors(['starts_at' => 'Bu yazıcı için seçilen zaman aralığı mevcut bir kayıtla çakışıyor.'])->withInput();
        }

        BlackoutPeriod::query()->create([
            'printer_id' => $validated['printer_id'] ?? null,
            'kind' => $validated['kind'],
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'reason' => $validated['reason'],
        ]);

        return back()->with('success', 'Takvim kaydı eklendi.');
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
