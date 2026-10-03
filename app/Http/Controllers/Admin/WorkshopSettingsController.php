<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OperatingHour;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WorkshopSettingsController extends Controller
{
    public function edit(): Response
    {
        $hours = OperatingHour::query()->orderBy('weekday')->get()->keyBy('weekday');
        $dayNames = [1 => 'Pazartesi', 2 => 'Salı', 3 => 'Çarşamba', 4 => 'Perşembe', 5 => 'Cuma', 6 => 'Cumartesi', 7 => 'Pazar'];

        return Inertia::render('Admin/Settings/Workshop', [
            'contact' => [
                'phone' => Setting::valueOf('workshop.contact_phone', ''),
                'whatsapp' => Setting::valueOf('workshop.whatsapp_number', ''),
                'email' => Setting::valueOf('workshop.contact_email', ''),
                'hours' => Setting::valueOf('workshop.contact_hours', ''),
            ],
            'hours' => collect($dayNames)->map(fn (string $name, int $weekday) => [
                'weekday' => $weekday,
                'name' => $name,
                'isOpen' => (bool) $hours->get($weekday)?->is_open,
                'opensAt' => $this->shortTime($hours->get($weekday)?->opens_at) ?? '09:00',
                'latestStartAt' => $this->shortTime($hours->get($weekday)?->latest_start_at) ?? '21:00',
            ])->values(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+() .-]+$/'],
            'whatsapp' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+() .-]+$/'],
            'email' => ['nullable', 'email:rfc', 'max:255'],
            'contact_hours' => ['nullable', 'string', 'max:120'],
            'hours' => ['required', 'array', 'size:7'],
            'hours.*.weekday' => ['required', 'integer', 'between:1,7', 'distinct'],
            'hours.*.is_open' => ['required', 'boolean'],
            'hours.*.opens_at' => ['nullable', 'date_format:H:i'],
            'hours.*.latest_start_at' => ['nullable', 'date_format:H:i'],
        ], [
            'phone.regex' => 'Telefon numarası yalnızca rakam ve telefon işaretleri içerebilir.',
            'whatsapp.regex' => 'WhatsApp numarası yalnızca rakam ve telefon işaretleri içerebilir.',
        ]);

        foreach ($validated['hours'] as $index => $day) {
            if (! $day['is_open']) {
                continue;
            }

            if (! $day['opens_at'] || ! $day['latest_start_at']) {
                throw ValidationException::withMessages(["hours.{$index}.opens_at" => 'Açık günlerde saatler zorunludur.']);
            }

            if ($day['latest_start_at'] < $day['opens_at']) {
                throw ValidationException::withMessages(["hours.{$index}.latest_start_at" => 'En geç başlangıç ilk başlangıçtan önce olamaz.']);
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
                'workshop.contact_phone' => $validated['phone'] ?? '',
                'workshop.whatsapp_number' => $validated['whatsapp'] ?? '',
                'workshop.contact_email' => $validated['email'] ?? '',
                'workshop.contact_hours' => $validated['contact_hours'] ?? '',
            ] as $key => $value) {
                Setting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'group' => 'workshop']);
            }
        });

        return back()->with('success', 'Atölye ve iletişim bilgileri güncellendi.');
    }

    private function shortTime(?string $time): ?string
    {
        return $time ? substr($time, 0, 5) : null;
    }
}
