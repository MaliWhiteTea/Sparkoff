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
        ], [
            'type.required' => 'Bildirim türünü seçin.',
            'type.enum' => 'Geçerli bir bildirim türü seçin.',
            'message.required' => 'Açıklama alanını doldurun.',
            'message.min' => 'Açıklama en az 10 karakter olmalıdır.',
            'message.max' => 'Açıklama en fazla 3000 karakter olabilir.',
            'website.max' => 'Bildirim gönderilemedi. Lütfen tekrar deneyin.',
        ]);

        FeedbackReport::query()->create([
            'type' => $validated['type'],
            'message' => $validated['message'],
            'status' => FeedbackStatus::New,
        ]);

        return back()->with('success', 'Bildiriminiz yönetime iletildi. Teşekkür ederiz.');
    }
}
