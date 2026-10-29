<?php

namespace App\Http\Middleware;

use App\Models\Announcement;
use App\Services\AdminNotificationService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        $user = $request->user();
        $canSeeStaffAnnouncements = $user?->hasPermissionTo('staff_announcements.view') ?? false;
        $staffAnnouncements = $canSeeStaffAnnouncements ? $this->staffAnnouncements($user) : collect();

        return [
            ...parent::share($request),
            'appName' => config('app.name'),
            'features' => [
                'onlineBooking' => (bool) config('features.online_booking'),
            ],
            'auth' => [
                'user' => fn () => $user ? [
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'isSystemAdministrator' => $user->isSystemAdministrator(),
                    'roles' => $user->roles()->pluck('name'),
                    'permissions' => $user->isSystemAdministrator()
                        ? collect(config('permissions'))->flatMap(fn ($permissions) => array_keys($permissions))->values()
                        : $user->roles()->with('permissions:id,key')->get()->flatMap->permissions->pluck('key')->unique()->values(),
                    'interfacePreferences' => $user->interfacePreferences(),
                    'tablePreferences' => $user->table_preferences ?? [],
                    'savedFilters' => $user->saved_filters ?? [],
                    'draftScope' => hash_hmac('sha256', (string) $user->getAuthIdentifier(), (string) config('app.key')),
                ] : null,
            ],
            'staffAnnouncements' => $staffAnnouncements,
            'staffAnnouncementUnreadCount' => $staffAnnouncements->where('isRead', false)->count(),
            'notificationUnreadCount' => fn () => $user && $request->is('yonetim/*')
                ? app(AdminNotificationService::class)->unreadCount($user)
                : 0,
            'flash' => [
                'bookingSubmitted' => fn () => $request->session()->get('booking_submitted'),
                'success' => fn () => $request->session()->get('success'),
                'warning' => fn () => $request->session()->get('warning'),
                'bulkResult' => fn () => $request->session()->get('bulk_result'),
            ],
        ];
    }

    private function staffAnnouncements($user)
    {
        $query = Announcement::query()
            ->visibleToStaffReader($user);

        return $query
            ->with(['readers' => fn ($query) => $query->where('users.id', $user->id)])
            ->orderByDesc('is_pinned')->latest('starts_at')->get()->map(function (Announcement $announcement) {
                $reader = $announcement->readers->first();
                $isRead = $reader && (! $announcement->requires_acknowledgement || $reader->pivot->acknowledged_at);

                return [
                    'id' => $announcement->id, 'title' => $announcement->title, 'body' => $announcement->body,
                    'type' => $announcement->type, 'isPinned' => $announcement->is_pinned,
                    'requiresAcknowledgement' => $announcement->requires_acknowledgement, 'isRead' => (bool) $isRead,
                ];
            });
    }
}
