<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request, AdminNotificationService $notifications): JsonResponse
    {
        $items = $notifications->notifications($request->user());

        return response()->json([
            'notifications' => $items,
            'unreadCount' => $items->where('isRead', false)->count(),
        ]);
    }

    public function read(Request $request, AdminNotificationService $notifications): RedirectResponse
    {
        $validated = $request->validate([
            'key' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9-]+$/'],
        ]);
        $notifications->markRead($request->user(), $validated['key']);

        return back();
    }

    public function readAll(Request $request, AdminNotificationService $notifications): RedirectResponse
    {
        $notifications->markAllRead($request->user());

        return back();
    }
}
