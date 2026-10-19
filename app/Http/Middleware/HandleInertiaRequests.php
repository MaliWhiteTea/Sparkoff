<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'appName' => config('app.name'),
            'features' => [
                'onlineBooking' => (bool) config('features.online_booking'),
            ],
            'auth' => [
                'user' => fn () => $request->user() ? [
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'role' => $request->user()->role,
                    'roles' => $request->user()->roles()->pluck('name'),
                    'permissions' => $request->user()->role === 'admin' || $request->user()->isSystemAdministrator()
                        ? collect(config('permissions'))->flatMap(fn ($permissions) => array_keys($permissions))->values()
                        : $request->user()->roles()->with('permissions:id,key')->get()->flatMap->permissions->pluck('key')->unique()->values(),
                ] : null,
            ],
            'flash' => [
                'bookingSubmitted' => fn () => $request->session()->get('booking_submitted'),
                'success' => fn () => $request->session()->get('success'),
                'warning' => fn () => $request->session()->get('warning'),
            ],
        ];
    }
}
