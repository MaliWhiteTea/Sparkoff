<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Admin/ActivityLogs', [
            'logs' => ActivityLog::query()->with('user:id,name,email')->latest('id')->limit(200)->get()->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user' => $log->user?->name ?? 'Silinmiş yönetici',
                'action' => match ($log->action) {
                    'created' => 'Oluşturdu',
                    'updated' => 'Güncelledi',
                    'deleted' => 'Sildi',
                    default => $log->action,
                },
                'subject' => class_basename($log->subject_type),
                'subjectId' => $log->subject_id,
                'fields' => $log->changed_fields ?? [],
                'createdAt' => $log->created_at->translatedFormat('d F Y, H:i:s'),
            ]),
        ]);
    }
}
