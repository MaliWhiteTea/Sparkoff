<?php

namespace App\Http\Controllers;

use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Models\FeedbackReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class FeedbackController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Feedback');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::enum(FeedbackType::class)],
            'message' => ['required', 'string', 'min:10', 'max:3000'],
            'website' => ['nullable', 'max:0'],
        ]);

        FeedbackReport::query()->create([
            'type' => $validated['type'],
            'message' => $validated['message'],
            'status' => FeedbackStatus::New,
        ]);

        return back()->with('success', 'Bildiriminiz yönetime iletildi. Teşekkür ederiz.');
    }
}
