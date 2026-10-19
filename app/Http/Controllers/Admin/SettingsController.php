<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $user = $request->user();
        $can = fn (string $permission) => $user->role === 'admin' || $user->hasPermissionTo($permission);

        $destinations = [
            ['permission' => 'workshop_settings.update', 'route' => 'admin.settings.workshop.edit', 'enabled' => true],
            ['permission' => 'printers.view', 'route' => 'admin.settings.printers.index', 'enabled' => true],
            ['permission' => 'printers.manage_filaments', 'route' => 'admin.settings.filaments.index', 'enabled' => true],
            ['permission' => 'system_settings.update', 'route' => 'admin.settings.booking.edit', 'enabled' => (bool) config('features.online_booking')],
            ['permission' => 'privacy_settings.update', 'route' => 'admin.settings.privacy.edit', 'enabled' => (bool) config('features.online_booking')],
        ];

        foreach ($destinations as $destination) {
            if ($destination['enabled'] && $can($destination['permission'])) {
                return redirect()->route($destination['route']);
            }
        }

        abort(403, 'Erişebileceğiniz bir ayar bölümü bulunmuyor.');
    }
}
