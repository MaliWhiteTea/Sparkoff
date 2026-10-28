<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Services\ActivityLogPresenter;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    public function __invoke(ActivityLogPresenter $presenter): Response
    {
        return Inertia::render('Admin/ActivityLogs', [
            'logs' => ActivityLog::query()->with('user:id,name,email')->latest('id')->limit(200)->get()->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user' => $log->user?->name ?? 'Silinmiş yönetici',
                'action' => $presenter->action($log->action),
                'subject' => $presenter->subject($log->subject_type),
                'subjectId' => $log->subject_id,
                'fields' => $presenter->fields($log->changed_fields ?? []),
                'createdAt' => $log->created_at->translatedFormat('d F Y, H:i:s'),
            ]),
        ]);
    }
}
