<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Announcement;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StaffAnnouncementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_admin_can_target_a_staff_announcement_to_selected_roles(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $targetRole = $this->role('Atölye Ekibi', ['staff_announcements.view']);
        $otherRole = $this->role('Diğer Ekip', ['staff_announcements.view']);
        $target = $this->user($targetRole);
        $other = $this->user($otherRole);

        $this->actingAs($admin)->post(route('admin.announcements.store'), [
            'title' => 'Toplantı', 'body' => 'Yarın saat 10.00’da toplantı yapılacaktır.',
            'type' => 'urgent', 'placement' => 'all', 'audience' => 'staff',
            'is_published' => true, 'is_pinned' => true, 'requires_acknowledgement' => true,
            'role_ids' => [$targetRole->id],
        ])->assertSessionHas('success');

        $announcement = Announcement::query()->sole();
        $this->assertEquals([$targetRole->id], $announcement->targetRoles()->pluck('roles.id')->all());
        $this->actingAs($target)->get(route('admin.announcements.index'))->assertInertia(fn (Assert $page) => $page
            ->has('staffAnnouncements', 1)->where('staffAnnouncementUnreadCount', 1)
            ->has('announcements', 1)
            ->where('staffAnnouncements.0.title', 'Toplantı'));
        $otherResponse = $this->actingAs($other)->get(route('admin.announcements.index'));
        $otherResponse->assertInertia(fn (Assert $page) => $page
            ->has('staffAnnouncements', 0)->has('announcements', 0)
            ->where('staffAnnouncementUnreadCount', 0));
        $otherResponse->assertDontSee('Yarın saat 10.00’da toplantı yapılacaktır.');
        $this->get(route('home'))->assertInertia(fn (Assert $page) => $page->has('announcements', 0));
    }

    public function test_targeted_user_can_acknowledge_and_manager_sees_the_count(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $role = $this->role('Moderatör', ['staff_announcements.view']);
        $user = $this->user($role);
        $announcement = Announcement::query()->create([
            'title' => 'Kural değişikliği', 'body' => 'Yeni teslim kuralını okuyun.', 'type' => 'warning',
            'placement' => 'all', 'audience' => 'staff', 'is_published' => true,
            'requires_acknowledgement' => true,
        ]);
        $announcement->targetRoles()->attach($role);

        $this->actingAs($user)->post(route('admin.announcements.acknowledge', $announcement))->assertSessionHas('success');
        $this->assertDatabaseHas('announcement_user', ['announcement_id' => $announcement->id, 'user_id' => $user->id]);
        $this->assertTrue(ActivityLog::query()->where('user_id', $user->id)->where('subject_id', $announcement->id)->where('action', 'acknowledged')->exists());
        $this->get(route('admin.announcements.index'))->assertInertia(fn (Assert $page) => $page
            ->where('staffAnnouncementUnreadCount', 0)->where('staffAnnouncements.0.isRead', true));
        $this->actingAs($admin)->get(route('admin.announcements.index'))->assertInertia(fn (Assert $page) => $page
            ->where('announcements.0.acknowledgedCount', 1));
    }

    public function test_system_administrator_sees_all_targeted_announcements(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $unrelatedRole = $this->role('Yalnız Belirli Ekip', ['staff_announcements.view']);
        $announcement = Announcement::query()->create([
            'title' => 'Hedefli bilgi', 'body' => 'Yalnız belirli role gönderildi.', 'type' => 'info',
            'placement' => 'all', 'audience' => 'staff', 'is_published' => true,
        ]);
        $announcement->targetRoles()->attach($unrelatedRole);

        $this->actingAs($admin)->get(route('admin.announcements.index'))->assertInertia(fn (Assert $page) => $page
            ->has('staffAnnouncements', 1)->has('announcements', 1)
            ->where('announcements.0.title', 'Hedefli bilgi')
            ->where('staffAnnouncementUnreadCount', 1));
    }

    public function test_staff_announcement_manager_can_see_announcements_targeted_to_other_roles(): void
    {
        $managerRole = $this->role('Duyuru Yöneticisi', ['staff_announcements.view', 'staff_announcements.update']);
        $manager = $this->user($managerRole);
        $targetRole = $this->role('Hedef Ekip', ['staff_announcements.view']);
        $announcement = Announcement::query()->create([
            'title' => 'Yönetilecek taslak', 'body' => 'Henüz hedef ekibe yayınlanmadı.', 'type' => 'info',
            'placement' => 'all', 'audience' => 'staff', 'is_published' => false,
        ]);
        $announcement->targetRoles()->attach($targetRole);

        $this->actingAs($manager)->get(route('admin.announcements.index'))->assertInertia(fn (Assert $page) => $page
            ->has('staffAnnouncements', 0)
            ->has('announcements', 1)
            ->where('announcements.0.title', 'Yönetilecek taslak')
            ->where('announcements.0.roleIds', [$targetRole->id]));
    }

    public function test_untargeted_staff_announcement_is_visible_to_every_staff_reader(): void
    {
        $first = $this->user($this->role('Birinci Ekip', ['staff_announcements.view']));
        $second = $this->user($this->role('İkinci Ekip', ['staff_announcements.view']));
        Announcement::query()->create([
            'title' => 'Genel ekip duyurusu', 'body' => 'Bütün yetkili personele açıktır.', 'type' => 'info',
            'placement' => 'all', 'audience' => 'staff', 'is_published' => true,
        ]);

        foreach ([$first, $second] as $reader) {
            $this->actingAs($reader)->get(route('admin.announcements.index'))->assertInertia(fn (Assert $page) => $page
                ->has('staffAnnouncements', 1)
                ->has('announcements', 1)
                ->where('announcements.0.title', 'Genel ekip duyurusu'));
        }
    }

    public function test_staff_reader_does_not_receive_drafts_future_or_expired_announcements(): void
    {
        $reader = $this->user($this->role('Duyuru Okuyucusu', ['staff_announcements.view']));
        foreach ([
            ['title' => 'Taslak sır', 'is_published' => false],
            ['title' => 'Gelecek sır', 'is_published' => true, 'starts_at' => now()->addHour()],
            ['title' => 'Süresi dolmuş sır', 'is_published' => true, 'ends_at' => now()->subHour()],
        ] as $attributes) {
            Announcement::query()->create([
                'body' => 'Okuyucunun yanıtına girmemeli.', 'type' => 'info', 'placement' => 'all',
                'audience' => 'staff',
                ...$attributes,
            ]);
        }

        $response = $this->actingAs($reader)->get(route('admin.announcements.index'));
        $response->assertInertia(fn (Assert $page) => $page
            ->has('staffAnnouncements', 0)
            ->has('announcements', 0));
        $response->assertDontSee('Okuyucunun yanıtına girmemeli.');
    }

    public function test_future_or_expired_staff_announcement_cannot_be_acknowledged(): void
    {
        $role = $this->role('Okuyucu', ['staff_announcements.view']);
        $user = $this->user($role);
        $future = Announcement::query()->create([
            'title' => 'Gelecek', 'body' => 'Henüz başlamadı.', 'type' => 'info', 'placement' => 'all',
            'audience' => 'staff', 'is_published' => true, 'starts_at' => now()->addHour(),
        ]);
        $expired = Announcement::query()->create([
            'title' => 'Eski', 'body' => 'Süresi bitti.', 'type' => 'info', 'placement' => 'all',
            'audience' => 'staff', 'is_published' => true, 'ends_at' => now()->subHour(),
        ]);

        $this->actingAs($user)->post(route('admin.announcements.acknowledge', $future))->assertNotFound();
        $this->post(route('admin.announcements.acknowledge', $expired))->assertNotFound();
        $this->assertDatabaseCount('announcement_user', 0);
    }

    public function test_public_and_staff_announcement_permissions_cannot_be_crossed(): void
    {
        $staffRole = $this->role('İç Duyuru Yazarı', ['staff_announcements.view', 'staff_announcements.create', 'staff_announcements.update']);
        $staff = $this->user($staffRole);
        $publicRole = $this->role('Kamu Duyuru Yazarı', ['announcements.view', 'announcements.create', 'announcements.update']);
        $public = $this->user($publicRole);

        $publicPayload = ['title' => 'Kamu', 'body' => 'Kamu metni', 'type' => 'info', 'placement' => 'all', 'audience' => 'public', 'is_published' => true];
        $this->actingAs($staff)->post(route('admin.announcements.store'), $publicPayload)->assertForbidden();
        $staffPayload = [...$publicPayload, 'title' => 'İç', 'audience' => 'staff'];
        $this->actingAs($public)->post(route('admin.announcements.store'), $staffPayload)->assertForbidden();
        $this->actingAs($staff)->post(route('admin.announcements.store'), $staffPayload)->assertSessionHas('success');
        $announcement = Announcement::query()->sole();
        $this->actingAs($public)->get(route('admin.announcements.index'))->assertInertia(fn (Assert $page) => $page
            ->has('announcements', 0)->has('staffAnnouncements', 0));
        $this->actingAs($public)->patch(route('admin.announcements.update', $announcement), $publicPayload)->assertForbidden();
        $this->assertSame('İç', $announcement->fresh()->title);
    }

    public function test_public_viewer_cannot_see_internal_targeting_or_read_counts_on_combined_announcement(): void
    {
        $publicRole = $this->role('Kamu Görüntüleyici', ['announcements.view']);
        $publicViewer = $this->user($publicRole);
        $targetRole = $this->role('Hedef Ekip', ['staff_announcements.view']);
        $target = $this->user($targetRole);
        $announcement = Announcement::query()->create([
            'title' => 'Ortak duyuru', 'body' => 'Herkese gösterilir.', 'type' => 'info', 'placement' => 'all',
            'audience' => 'both', 'is_published' => true,
        ]);
        $announcement->targetRoles()->attach($targetRole);
        $announcement->readers()->attach($target, ['read_at' => now()]);

        $this->actingAs($publicViewer)->get(route('admin.announcements.index'))->assertInertia(fn (Assert $page) => $page
            ->where('announcements.0.roleIds', [])->where('announcements.0.roleNames', [])
            ->where('announcements.0.readCount', 0)->where('announcements.0.acknowledgedCount', 0));
    }

    public function test_public_announcement_defaults_remain_backwards_compatible(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $this->actingAs($admin)->post(route('admin.announcements.store'), [
            'title' => 'Genel bilgi', 'body' => 'Atölye bugün açıktır.', 'type' => 'info',
            'placement' => 'home', 'is_published' => true,
        ])->assertSessionHas('success');

        $announcement = Announcement::query()->sole();
        $this->assertSame('public', $announcement->audience);
        $this->get(route('home'))->assertInertia(fn (Assert $page) => $page->where('announcements.0.title', 'Genel bilgi'));
    }

    private function role(string $name, array $permissions): Role
    {
        $role = Role::query()->create(['name' => $name, 'slug' => str($name)->slug().'-'.uniqid()]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));

        return $role;
    }

    private function user(Role $role): User
    {
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }
}
