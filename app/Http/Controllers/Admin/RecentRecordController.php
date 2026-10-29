<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminRecentRecordService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RecentRecordController extends Controller
{
    public function store(Request $request, AdminRecentRecordService $recent): RedirectResponse
    {
        $validated = $request->validate([
            'record_type' => ['required', 'string', Rule::in($recent->supportedTypes())],
            'record_id' => ['required', 'integer', 'min:1'],
        ]);
        $record = $recent->track($request->user(), $validated['record_type'], $validated['record_id']);
        abort_unless($record, 404);

        return redirect()->to($record['href']);
    }
}
