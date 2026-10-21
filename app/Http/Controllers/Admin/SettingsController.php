<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        return redirect()->route('admin.settings.personal.edit');
    }
}
