<?php

namespace App\Http\Controllers;

use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Models\FeedbackReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\File;
use Illuminate\Validation\ValidationException;
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
            'image' => [
                'nullable',
                File::image()->types(['jpg', 'jpeg', 'png', 'webp'])->max(5 * 1024),
                'dimensions:max_width=6000,max_height=6000',
            ],
            'website' => ['nullable', 'max:0'],
        ], [
            'type.required' => 'Bildirim türünü seçin.',
            'type.enum' => 'Geçerli bir bildirim türü seçin.',
            'message.required' => 'Açıklama alanını doldurun.',
            'message.min' => 'Açıklama en az 10 karakter olmalıdır.',
            'message.max' => 'Açıklama en fazla 3000 karakter olabilir.',
            'image.image' => 'Yalnızca geçerli bir görsel yükleyebilirsiniz.',
            'image.mimes' => 'Görsel JPG, PNG veya WebP biçiminde olmalıdır.',
            'image.mimetypes' => 'Görsel JPG, PNG veya WebP biçiminde olmalıdır.',
            'image.max' => 'Görsel en fazla 5 MB olabilir.',
            'image.uploaded' => 'Görsel yüklenemedi. Dosyanın 5 MB sınırını aşmadığını kontrol edin.',
            'image.dimensions' => 'Görsel en fazla 6000 × 6000 piksel olabilir.',
            'website.max' => 'Bildirim gönderilemedi. Lütfen tekrar deneyin.',
        ]);

        $report = FeedbackReport::query()->create([
            'type' => $validated['type'],
            'message' => $validated['message'],
            'status' => FeedbackStatus::New,
        ]);

        if ($request->hasFile('image')) {
            $image = $request->file('image');
            try {
                $path = $image->store("feedback/{$report->id}", 'local');
            } catch (\Throwable $exception) {
                $report->delete();
                report($exception);

                throw ValidationException::withMessages([
                    'image' => 'Görsel kaydedilemedi. Lütfen tekrar deneyin.',
                ]);
            }

            if (! $path) {
                $report->delete();

                throw ValidationException::withMessages([
                    'image' => 'Görsel kaydedilemedi. Lütfen tekrar deneyin.',
                ]);
            }

            try {
                $report->update([
                    'image_path' => $path,
                    'image_original_name' => Str::limit($image->getClientOriginalName(), 240, ''),
                    'image_mime_type' => $image->getMimeType(),
                    'image_size' => $image->getSize(),
                ]);
            } catch (\Throwable $exception) {
                Storage::disk('local')->delete($path);
                $report->delete();

                throw $exception;
            }
        }

        return back()->with('success', 'Bildiriminiz yönetime iletildi. Teşekkür ederiz.');
    }
}
