<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PrinterStatus;
use App\Exceptions\SlotUnavailableException;
use App\Http\Controllers\Controller;
use App\Models\BlackoutPeriod;
use App\Models\Printer;
use App\Services\AppointmentAvailabilityService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        $canUpdateDetails = $request->user()->hasPermissionTo('printers.update');
        $canChangeStatus = $request->user()->hasPermissionTo('printers.change_status');

        abort_if(! $canUpdateDetails && ($validated['name'] !== $printer->name || ($validated['description'] ?? null) !== $printer->description), 403);
        abort_if(! $canChangeStatus && $validated['status'] !== $printer->status->value, 403);

        $printer->update($validated);

        return back()->with('success', "{$printer->code} yazıcısı güncellendi.");
    }

    public function storeBlackout(Request $request, AppointmentAvailabilityService $availability): RedirectResponse
    {
        $validated = $this->validateSchedule($request);
        [$startsAt, $endsAt] = $this->scheduleDates($validated);

        try {
            DB::transaction(function () use ($validated, $startsAt, $endsAt, $availability) {
                $this->lockSchedulePrinters($validated['printer_id'] ?? null);
                $availability->assertBlackoutAvailable($validated['printer_id'] ?? null, $startsAt, $endsAt);

                BlackoutPeriod::query()->create([
                    'printer_id' => $validated['printer_id'] ?? null,
                    'kind' => $validated['kind'],
                    'is_all_day' => $validated['is_all_day'],
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                    'reason' => $validated['reason'],
                ]);
            }, 3);
        } catch (SlotUnavailableException $exception) {
            return back()->withErrors(['starts_at' => $exception->getMessage()])->withInput();
        }

        return back()->with('success', 'Takvim kaydı eklendi.');
    }

    public function updateBlackout(Request $request, BlackoutPeriod $blackout, AppointmentAvailabilityService $availability): RedirectResponse
    {
        $validated = $this->validateSchedule($request);
        [$startsAt, $endsAt] = $this->scheduleDates($validated);

        try {
            DB::transaction(function () use ($validated, $startsAt, $endsAt, $blackout, $availability) {
                $this->lockSchedulePrinters($validated['printer_id'] ?? null, $blackout);
                $lockedBlackout = BlackoutPeriod::query()->lockForUpdate()->findOrFail($blackout->id);
                $availability->assertBlackoutAvailable(
                    $validated['printer_id'] ?? null,
                    $startsAt,
                    $endsAt,
                    $lockedBlackout->id,
                );

                $lockedBlackout->update([
                    'printer_id' => $validated['printer_id'] ?? null,
                    'kind' => $validated['kind'],
                    'is_all_day' => $validated['is_all_day'],
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                    'reason' => $validated['reason'],
                ]);
            }, 3);
        } catch (SlotUnavailableException $exception) {
            return back()->withErrors(['starts_at' => $exception->getMessage()])->withInput();
        }

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

    private function lockSchedulePrinters(?int $printerId, ?BlackoutPeriod $existing = null): void
    {
        if ($printerId === null || ($existing && $existing->printer_id === null)) {
            Printer::query()->orderBy('id')->lockForUpdate()->get();

            return;
        }

        $printerIds = collect([$printerId, $existing?->printer_id])->filter()->unique()->sort()->values();
        Printer::query()->whereIn('id', $printerIds)->orderBy('id')->lockForUpdate()->get();
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
