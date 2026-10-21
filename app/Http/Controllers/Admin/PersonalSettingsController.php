<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PersonalSettingsController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('Admin/Settings/Personal', [
            'preferences' => $request->user()->interfacePreferences(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $preferences = $request->validate([
            'theme' => ['required', Rule::in(['light', 'dark', 'system'])],
            'scale' => ['required', Rule::in(['small', 'normal', 'large'])],
            'density' => ['required', Rule::in(['comfortable', 'normal', 'compact'])],
            'sidebar' => ['required', Rule::in(['wide', 'narrow'])],
        ]);

        $request->user()->update(['interface_preferences' => $preferences]);

        return back()->with('success', 'Kişisel görünüm ayarlarınız kaydedildi.');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->user()->update(['interface_preferences' => null]);

        return back()->with('success', 'Kişisel görünüm ayarlarınız varsayılanlara döndürüldü.');
    }
}
