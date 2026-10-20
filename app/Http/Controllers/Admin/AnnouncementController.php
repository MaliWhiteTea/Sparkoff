<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Announcement;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    public function index(Request $request): Response
    {
        $canPublic = $this->can($request, 'announcements.view');
        $canStaff = $this->can($request, 'staff_announcements.view');

        return Inertia::render('Admin/Announcements/Index', [
            'announcements' => Announcement::query()
                ->with('targetRoles:id,name')
                ->withCount(['readers', 'readers as acknowledged_count' => fn ($query) => $query->whereNotNull('announcement_user.acknowledged_at')])
                ->when(! ($canPublic && $canStaff), fn ($query) => $query->whereIn('audience', $canPublic ? ['public', 'both'] : ['staff', 'both']))
                ->orderByDesc('is_pinned')->latest()->get()->map(fn (Announcement $announcement) => [
                    'id' => $announcement->id, 'title' => $announcement->title, 'body' => $announcement->body,
                    'type' => $announcement->type, 'placement' => $announcement->placement, 'audience' => $announcement->audience,
                    'isPublished' => $announcement->is_published, 'isPinned' => $announcement->is_pinned,
                    'requiresAcknowledgement' => $announcement->requires_acknowledgement,
                    'startsAt' => $announcement->starts_at?->format('Y-m-d\TH:i'), 'endsAt' => $announcement->ends_at?->format('Y-m-d\TH:i'),
                    'roleIds' => $canStaff ? $announcement->targetRoles->pluck('id') : [],
                    'roleNames' => $canStaff ? $announcement->targetRoles->pluck('name') : [],
                    'readCount' => $canStaff ? $announcement->readers_count : 0,
                    'acknowledgedCount' => $canStaff ? $announcement->acknowledged_count : 0,
                    'canUpdate' => $this->canManageAudience($request, $announcement->audience, 'update'),
                    'canArchive' => $this->canManageAudience($request, $announcement->audience, 'archive'),
                ]),
            'roles' => $canStaff ? Role::query()->orderBy('name')->get(['id', 'name']) : [],
            'capabilities' => [
                'createPublic' => $this->can($request, 'announcements.create'),
                'createStaff' => $this->can($request, 'staff_announcements.create'),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $this->authorizeAudience($request, $data['audience'], 'create');
        $roleIds = $data['role_ids'];
        unset($data['role_ids']);
        DB::transaction(function () use ($data, $roleIds) {
            $announcement = Announcement::query()->create($data);
            $announcement->targetRoles()->sync(in_array($data['audience'], ['staff', 'both'], true) ? $roleIds : []);
            $this->recordAction($announcement, 'updated', ['target_roles']);
        });

        return back()->with('success', 'Duyuru oluşturuldu.');
    }

    public function update(Request $request, Announcement $announcement): RedirectResponse
    {
        $data = $this->validated($request);
        $this->authorizeAudience($request, $announcement->audience, 'update');
        $this->authorizeAudience($request, $data['audience'], 'update');
        $roleIds = $data['role_ids'];
        unset($data['role_ids']);
        DB::transaction(function () use ($announcement, $data, $roleIds) {
            $announcement->update($data);
            $announcement->targetRoles()->sync(in_array($data['audience'], ['staff', 'both'], true) ? $roleIds : []);
            $this->recordAction($announcement, 'updated', ['target_roles']);
        });

        return back()->with('success', 'Duyuru güncellendi.');
    }

    public function destroy(Request $request, Announcement $announcement): RedirectResponse
    {
        $this->authorizeAudience($request, $announcement->audience, 'archive');
        $announcement->delete();

        return back()->with('success', 'Duyuru kaldırıldı.');
    }

    public function acknowledge(Request $request, Announcement $announcement): RedirectResponse
    {
        abort_unless($this->can($request, 'staff_announcements.view') && $this->targetsUser($announcement, $request->user()), 403);
        abort_unless($announcement->is_published && in_array($announcement->audience, ['staff', 'both'], true), 404);
        abort_unless((! $announcement->starts_at || $announcement->starts_at->isPast()) && (! $announcement->ends_at || $announcement->ends_at->isFuture()), 404);
        $now = now();
        $announcement->readers()->syncWithoutDetaching([$request->user()->id => [
            'read_at' => $now, 'acknowledged_at' => $announcement->requires_acknowledgement ? $now : null,
        ]]);
        $this->recordAction($announcement, $announcement->requires_acknowledgement ? 'acknowledged' : 'read', ['staff_announcement']);

        return back()->with('success', $announcement->requires_acknowledgement ? 'Duyuru onaylandı.' : 'Duyuru okundu olarak işaretlendi.');
    }

    private function validated(Request $request): array
    {
        $request->merge([
            'is_published' => $request->boolean('is_published'), 'is_pinned' => $request->boolean('is_pinned'),
            'requires_acknowledgement' => $request->boolean('requires_acknowledgement'),
            'audience' => $request->input('audience', 'public'), 'role_ids' => $request->input('role_ids', []),
        ]);

        return $request->validate([
            'title' => ['required', 'string', 'max:120'], 'body' => ['required', 'string', 'max:1000'],
            'type' => ['required', Rule::in(['info', 'warning', 'maintenance', 'urgent'])],
            'placement' => ['required', Rule::in(['all', 'home', 'printers'])],
            'audience' => ['required', Rule::in(['public', 'staff', 'both'])],
            'is_published' => ['required', 'boolean'], 'is_pinned' => ['required', 'boolean'],
            'requires_acknowledgement' => ['required', 'boolean'],
            'role_ids' => ['array'], 'role_ids.*' => ['integer', 'distinct', 'exists:roles,id'],
            'starts_at' => ['nullable', 'date_format:Y-m-d\TH:i'],
            'ends_at' => ['nullable', 'date_format:Y-m-d\TH:i', 'after:starts_at'],
        ]);
    }

    private function authorizeAudience(Request $request, string $audience, string $action): void
    {
        abort_unless($this->canManageAudience($request, $audience, $action), 403);
    }

    private function canManageAudience(Request $request, string $audience, string $action): bool
    {
        $public = $audience === 'staff' || $this->can($request, "announcements.{$action}");
        $staff = $audience === 'public' || $this->can($request, "staff_announcements.{$action}");

        return $public && $staff;
    }

    private function can(Request $request, string $permission): bool
    {
        return $request->user()->role === 'admin' || $request->user()->hasPermissionTo($permission);
    }

    private function targetsUser(Announcement $announcement, User $user): bool
    {
        return $user->role === 'admin' || $user->isSystemAdministrator()
            || ! $announcement->targetRoles()->exists()
            || $announcement->targetRoles()->whereIn('roles.id', $user->roles()->pluck('roles.id'))->exists();
    }

    private function recordAction(Announcement $announcement, string $action, array $fields): void
    {
        ActivityLog::query()->create([
            'user_id' => auth()->id(), 'action' => $action,
            'subject_type' => $announcement->getMorphClass(), 'subject_id' => $announcement->id,
            'changed_fields' => $fields, 'created_at' => now(),
        ]);
    }
}
