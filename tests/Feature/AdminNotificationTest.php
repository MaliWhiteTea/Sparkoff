<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Models\InventoryItem;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_notification_center_requires_an_authenticated_active_panel_user(): void
    {
        $this->getJson(route('admin.notifications.index'))->assertUnauthorized();

        $inactive = $this->userWithPermissions(['inventory.view'], false);
        $this->actingAs($inactive)->getJson(route('admin.notifications.index'))->assertRedirect(route('admin.login'));
    }

    public function test_user_only_receives_notifications_for_authorized_modules(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);
        $this->criticalItem('Kritik Arduino');

        $this->actingAs($viewer)->getJson(route('admin.notifications.index'))
            ->assertOk()
            ->assertJsonPath('unreadCount', 1)
            ->assertJsonCount(1, 'notifications')
            ->assertJsonPath('notifications.0.type', 'critical-stock')
            ->assertJsonPath('notifications.0.isRead', false);

        $this->actingAs($viewer)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('notificationUnreadCount', 1));
    }

    public function test_read_state_is_user_specific_and_a_changed_record_set_becomes_unread_again(): void
    {
        $firstViewer = $this->userWithPermissions(['inventory.view']);
        $secondViewer = $this->userWithPermissions(['inventory.view']);
        $this->criticalItem('Kritik sensör');

        $notification = $this->actingAs($firstViewer)->getJson(route('admin.notifications.index'))->json('notifications.0');
        $this->actingAs($firstViewer)->post(route('admin.notifications.read'), ['key' => $notification['key']])->assertRedirect();

        $this->assertDatabaseHas('admin_notification_reads', [
            'user_id' => $firstViewer->id,
            'notification_key' => $notification['key'],
        ]);
        $this->actingAs($firstViewer)->getJson(route('admin.notifications.index'))->assertJsonPath('unreadCount', 0);
        $this->actingAs($secondViewer)->getJson(route('admin.notifications.index'))->assertJsonPath('unreadCount', 1);

        $this->criticalItem('Kritik motor');
        $this->actingAs($firstViewer)->getJson(route('admin.notifications.index'))
            ->assertJsonPath('unreadCount', 1)
            ->assertJsonPath('notifications.0.isRead', false)
            ->assertJsonMissing(['key' => $notification['key']]);
    }

    public function test_mark_all_only_records_current_authorized_notifications(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $this->criticalItem('Kritik kablo');

        $before = $this->actingAs($admin)->getJson(route('admin.notifications.index'))
            ->assertOk()
            ->json();
        $this->assertSame(2, $before['unreadCount']);

        $this->actingAs($admin)->post(route('admin.notifications.read-all'))->assertRedirect();
        $this->assertDatabaseCount('admin_notification_reads', 2);
        $this->actingAs($admin)->getJson(route('admin.notifications.index'))
            ->assertJsonPath('unreadCount', 0);

        $this->actingAs($admin)->post(route('admin.notifications.read'), ['key' => 'forged-notification-key'])->assertRedirect();
        $this->assertDatabaseCount('admin_notification_reads', 2);
    }

    public function test_resolved_condition_removes_the_notification(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);
        $item = $this->criticalItem('Düzeltilecek stok');
        $this->actingAs($viewer)->getJson(route('admin.notifications.index'))->assertJsonPath('unreadCount', 1);

        $item->update(['quantity' => 20]);

        $this->actingAs($viewer)->getJson(route('admin.notifications.index'))
            ->assertJsonPath('unreadCount', 0)
            ->assertJsonCount(0, 'notifications');
    }

    private function userWithPermissions(array $permissions, bool $active = true): User
    {
        $role = Role::query()->create([
            'name' => 'Bildirim '.Str::random(6),
            'slug' => Str::lower(Str::random(12)),
        ]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => $active]);
        $user->roles()->attach($role);

        return $user;
    }

    private function criticalItem(string $name): InventoryItem
    {
        return InventoryItem::query()->create([
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)),
            'item_type' => InventoryItemType::Consumable,
            'unit' => 'adet',
            'quantity' => 2,
            'minimum_stock' => 3,
            'public_visibility' => InventoryVisibility::Status,
            'is_active' => true,
        ]);
    }
}
