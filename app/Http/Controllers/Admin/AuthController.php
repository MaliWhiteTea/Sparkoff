<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    public function create(): Response|RedirectResponse
    {
        if (Auth::check()) {
            return redirect()->to($this->landingUrl(Auth::user()));
        }

        return Inertia::render('Admin/Login');
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt([...$credentials, 'is_active' => true], $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'E-posta adresi veya parola hatalı.',
            ]);
        }

        if (! in_array($request->user()?->role, ['admin', 'operator'], true) && ! $request->user()?->roles()->exists()) {
            Auth::logout();

            throw ValidationException::withMessages([
                'email' => 'E-posta adresi veya parola hatalı.',
            ]);
        }

        $request->session()->regenerate();

        return redirect()->intended($this->landingUrl($request->user()));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('admin.login');
    }

    private function landingUrl(User $user): string
    {
        $destinations = [
            'appointments.view' => 'admin.appointments.index',
            'printers.manage_schedule' => 'admin.calendar.index',
            'printers.view' => 'admin.settings.printers.index',
            'printers.manage_filaments' => 'admin.settings.filaments.index',
            'announcements.view' => 'admin.announcements.index',
            'audit_logs.view' => 'admin.activity-logs',
        ];

        foreach ($destinations as $permission => $route) {
            if (($user->role === 'admin' || $user->hasPermissionTo($permission))
                && (! str_starts_with($route, 'admin.appointments') || config('features.online_booking'))) {
                return route($route);
            }
        }

        return route('home');
    }
}
