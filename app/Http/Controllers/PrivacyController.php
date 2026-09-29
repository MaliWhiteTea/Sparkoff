<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Inertia\Inertia;
use Inertia\Response;

class PrivacyController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('PrivacyNotice', [
            'privacy' => [
                'controllerName' => Setting::valueOf('privacy.controller_name', 'Sparkoff Proje Atölyesi’nin bağlı bulunduğu okul yönetimi'),
                'address' => Setting::valueOf('privacy.controller_address', 'Okulun resmî adresi yönetici panelinden eklenmelidir.'),
                'contactEmail' => Setting::valueOf('privacy.contact_email', 'atolye@sparkoff.tr'),
                'appointmentRetentionMonths' => (int) Setting::valueOf('privacy.appointment_retention_months', 12),
                'fileRetentionDays' => (int) Setting::valueOf('privacy.file_retention_days', 30),
                'noticeVersion' => Setting::valueOf('privacy.notice_version', '2026-09-29'),
                'isDraft' => (bool) Setting::valueOf('privacy.is_draft', true),
            ],
        ]);
    }
}
