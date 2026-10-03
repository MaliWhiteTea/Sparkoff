<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Announcements/Index', [
            'announcements' => Announcement::query()->latest()->get()->map(fn (Announcement $announcement) => [
                'id' => $announcement->id,
                'title' => $announcement->title,
                'body' => $announcement->body,
                'type' => $announcement->type,
                'placement' => $announcement->placement,
                'isPublished' => $announcement->is_published,
                'startsAt' => $announcement->starts_at?->format('Y-m-d\TH:i'),
                'endsAt' => $announcement->ends_at?->format('Y-m-d\TH:i'),
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        Announcement::query()->create($this->validated($request));

        return back()->with('success', 'Duyuru oluşturuldu.');
    }

    public function update(Request $request, Announcement $announcement): RedirectResponse
    {
        $announcement->update($this->validated($request));

        return back()->with('success', 'Duyuru güncellendi.');
    }

    public function destroy(Announcement $announcement): RedirectResponse
    {
        $announcement->delete();

        return back()->with('success', 'Duyuru kaldırıldı.');
    }

    private function validated(Request $request): array
    {
        $request->merge(['is_published' => $request->boolean('is_published')]);

        return $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:1000'],
            'type' => ['required', Rule::in(['info', 'warning', 'maintenance'])],
            'placement' => ['required', Rule::in(['all', 'home', 'printers'])],
            'is_published' => ['required', 'boolean'],
            'starts_at' => ['nullable', 'date_format:Y-m-d\TH:i'],
            'ends_at' => ['nullable', 'date_format:Y-m-d\TH:i', 'after:starts_at'],
        ]);
    }
}
