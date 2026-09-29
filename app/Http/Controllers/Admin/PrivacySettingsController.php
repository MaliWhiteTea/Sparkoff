<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PrivacySettingsController extends Controller
{
    public function edit(): Response
    {
        return Inertia::render('Admin/Settings/Privacy', [
            'settings' => [
                'controllerName' => Setting::valueOf('privacy.controller_name', 'Sparkoff Proje Atölyesi’nin bağlı bulunduğu okul yönetimi'),
                'controllerAddress' => Setting::valueOf('privacy.controller_address', ''),
                'contactEmail' => Setting::valueOf('privacy.contact_email', 'atolye@sparkoff.tr'),
                'appointmentRetentionMonths' => (int) Setting::valueOf('privacy.appointment_retention_months', 12),
                'fileRetentionDays' => (int) Setting::valueOf('privacy.file_retention_days', 30),
                'noticeVersion' => Setting::valueOf('privacy.notice_version', '2026-09-29'),
                'isDraft' => (bool) Setting::valueOf('privacy.is_draft', true),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'controller_name' => ['required', 'string', 'max:255'],
            'controller_address' => ['required', 'string', 'max:1000'],
            'contact_email' => ['required', 'email:rfc', 'max:255'],
            'appointment_retention_months' => ['required', 'integer', 'between:1,120'],
            'file_retention_days' => ['required', 'integer', 'between:1,365'],
            'notice_version' => ['required', 'string', 'max:30'],
            'is_draft' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($validated) {
            foreach ([
                'privacy.controller_name' => $validated['controller_name'],
                'privacy.controller_address' => $validated['controller_address'],
                'privacy.contact_email' => mb_strtolower($validated['contact_email']),
                'privacy.appointment_retention_months' => $validated['appointment_retention_months'],
                'privacy.file_retention_days' => $validated['file_retention_days'],
                'privacy.notice_version' => $validated['notice_version'],
                'privacy.is_draft' => $validated['is_draft'],
            ] as $key => $value) {
                Setting::query()->updateOrCreate(['key' => $key], ['value' => $value, 'group' => 'privacy']);
            }
        });

        return back()->with('success', 'KVKK ve saklama ayarları güncellendi.');
    }
}
