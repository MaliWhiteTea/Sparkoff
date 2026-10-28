<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    public function create(): Response|RedirectResponse
    {
        if (Auth::check()) {
            return to_route('admin.dashboard');
        }

        return Inertia::render('Admin/Login');
    }

    public function store(Request $request): RedirectResponse
    {
        if ($request->has('email')) {
            $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);
        }

        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt([...$credentials, 'is_active' => true], $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'E-posta adresi veya parola hatalı.',
            ]);
        }

        if (! $request->user()?->canAccessAdminPanel()) {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => 'E-posta adresi veya parola hatalı.',
            ]);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('admin.dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('admin.login');
    }
}
