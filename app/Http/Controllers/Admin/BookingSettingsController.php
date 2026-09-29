<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OperatingHour;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class BookingSettingsController extends Controller
{
    private const SUPPORTED_EXTENSIONS = ['gcode', '3mf', 'stl', 'step', 'stp'];

    public function edit(): Response
    {
        $hours = OperatingHour::query()->orderBy('weekday')->get()->keyBy('weekday');
        $dayNames = [1 => 'Pazartesi', 2 => 'Salı', 3 => 'Çarşamba', 4 => 'Perşembe', 5 => 'Cuma', 6 => 'Cumartesi', 7 => 'Pazar'];

        return Inertia::render('Admin/Settings/BookingRules', [
            'hours' => collect($dayNames)->map(fn (string $name, int $weekday) => [
                'weekday' => $weekday,
                'name' => $name,
                'isOpen' => (bool) $hours->get($weekday)?->is_open,
                'opensAt' => $this->shortTime($hours->get($weekday)?->opens_at) ?? '09:00',
                'latestStartAt' => $this->shortTime($hours->get($weekday)?->latest_start_at) ?? '21:00',
            ])->values(),
            'settings' => [
                'slotMinutes' => (int) Setting::valueOf('booking.slot_minutes', 30),
                'maximumDurationHours' => (int) Setting::valueOf('booking.maximum_duration_hours', 24),
                'verificationHoldMinutes' => (int) Setting::valueOf('booking.verification_hold_minutes', 30),
                'maximumFileSizeMb' => (int) Setting::valueOf('uploads.maximum_file_size_mb', 100),
                'allowedExtensions' => Setting::valueOf('uploads.allowed_extensions', self::SUPPORTED_EXTENSIONS),
            ],
            'supportedExtensions' => self::SUPPORTED_EXTENSIONS,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'hours' => ['required', 'array', 'size:7'],
            'hours.*.weekday' => ['required', 'integer', 'between:1,7', 'distinct'],
            'hours.*.is_open' => ['required', 'boolean'],
            'hours.*.opens_at' => ['nullable', 'date_format:H:i'],
            'hours.*.latest_start_at' => ['nullable', 'date_format:H:i'],
            'slot_minutes' => ['required', 'integer', Rule::in([15, 30, 60])],
            'maximum_duration_hours' => ['required', 'integer', 'between:1,168'],
            'verification_hold_minutes' => ['required', 'integer', 'between:10,1440'],
            'maximum_file_size_mb' => ['required', 'integer', 'between:1,500'],
            'allowed_extensions' => ['required', 'array', 'min:1'],
            'allowed_extensions.*' => ['required', 'string', 'distinct', Rule::in(self::SUPPORTED_EXTENSIONS)],
        ]);

        foreach ($validated['hours'] as $index => $day) {
            if (! $day['is_open']) {
                continue;
            }

            if (! $day['opens_at'] || ! $day['latest_start_at']) {
                throw ValidationException::withMessages(["hours.{$index}.opens_at" => 'Açık günlerde başlangıç saatleri zorunludur.']);
            }

            if ($day['latest_start_at'] < $day['opens_at']) {
                throw ValidationException::withMessages(["hours.{$index}.latest_start_at" => 'En geç başlangıç saati açılış saatinden önce olamaz.']);
            }
        }

        DB::transaction(function () use ($validated) {
            foreach ($validated['hours'] as $day) {
                OperatingHour::query()->updateOrCreate(
                    ['weekday' => $day['weekday']],
                    [
                        'is_open' => $day['is_open'],
                        'opens_at' => $day['is_open'] ? $day['opens_at'].':00' : null,
                        'latest_start_at' => $day['is_open'] ? $day['latest_start_at'].':00' : null,
                    ],
                );
            }

            foreach ([
                ['key' => 'booking.slot_minutes', 'value' => $validated['slot_minutes'], 'group' => 'booking'],
                ['key' => 'booking.maximum_duration_hours', 'value' => $validated['maximum_duration_hours'], 'group' => 'booking'],
                ['key' => 'booking.verification_hold_minutes', 'value' => $validated['verification_hold_minutes'], 'group' => 'booking'],
                ['key' => 'uploads.maximum_file_size_mb', 'value' => $validated['maximum_file_size_mb'], 'group' => 'uploads'],
                ['key' => 'uploads.allowed_extensions', 'value' => array_values($validated['allowed_extensions']), 'group' => 'uploads'],
            ] as $setting) {
                Setting::query()->updateOrCreate(['key' => $setting['key']], $setting);
            }
        });

        return back()->with('success', 'Randevu kuralları güncellendi.');
    }

    private function shortTime(?string $time): ?string
    {
        return $time ? substr($time, 0, 5) : null;
    }
}
