<?php

namespace App\Http\Controllers\Admin;

use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Http\Controllers\Controller;
use App\Models\FeedbackReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FeedbackController extends Controller
{
    public function index(Request $request): Response
    {
        $status = $request->string('status')->toString();
        $reports = FeedbackReport::query()
            ->with('handler:id,name')
            ->when($status, fn ($query) => $query->where('status', $status))
            ->latest()
            ->paginate(30)
            ->withQueryString()
            ->through(fn (FeedbackReport $report) => [
                'id' => $report->id,
                'type' => $report->type->value,
                'typeLabel' => match ($report->type) {
                    FeedbackType::Suggestion => 'Öneri',
                    FeedbackType::Complaint => 'Şikâyet',
                    FeedbackType::Bug => 'Hata bildirimi',
                },
                'message' => $report->message,
                'status' => $report->status->value,
                'adminNote' => $report->admin_note,
                'handler' => $report->handler?->name,
                'createdAt' => $report->created_at->translatedFormat('d F Y, H:i'),
                'handledAt' => $report->handled_at?->translatedFormat('d F Y, H:i'),
            ]);

        return Inertia::render('Admin/Feedback/Index', [
            'reports' => $reports,
            'filters' => ['status' => $status],
            'counts' => [
                'new' => FeedbackReport::query()->where('status', FeedbackStatus::New)->count(),
                'reviewing' => FeedbackReport::query()->where('status', FeedbackStatus::Reviewing)->count(),
                'resolved' => FeedbackReport::query()->where('status', FeedbackStatus::Resolved)->count(),
            ],
        ]);
    }

    public function update(Request $request, FeedbackReport $feedback): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::enum(FeedbackStatus::class)],
            'admin_note' => ['nullable', 'string', 'max:3000'],
        ]);
        $status = FeedbackStatus::from($validated['status']);

        $feedback->update([
            'status' => $status,
            'admin_note' => $validated['admin_note'] ?? null,
            'handled_by' => $request->user()->id,
            'handled_at' => $status === FeedbackStatus::New ? null : now(),
        ]);

        return back()->with('success', 'Talep güncellendi.');
    }
}
