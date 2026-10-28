<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Models\ActivityLog;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InventoryBulkUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_editor_can_bulk_update_category_location_and_visibility_with_one_audit_summary_each(): void
    {
        $editor = $this->userWithPermissions(['inventory.update']);
        $items = collect([$this->item('Bir'), $this->item('İki')]);
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik']);
        $location = InventoryLocation::query()->create(['name' => 'Ana Raf', 'code' => 'R-01']);

        $this->actingAs($editor)->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'category', 'item_ids' => $items->pluck('id')->all(),
            'category_id' => $category->id, 'confirmed' => true,
        ])->assertSessionHas('success');
        $this->assertSame(2, InventoryItem::query()->where('category_id', $category->id)->count());

        $this->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'location', 'item_ids' => $items->pluck('id')->all(),
            'location_id' => $location->id, 'confirmed' => true,
        ])->assertSessionHas('success');
        $this->assertSame(2, InventoryItem::query()->where('location_id', $location->id)->count());

        $this->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'visibility', 'item_ids' => $items->pluck('id')->all(),
            'public_visibility' => InventoryVisibility::Hidden->value, 'confirmed' => true,
        ])->assertSessionHas('success');
        $this->assertSame(2, InventoryItem::query()->where('public_visibility', InventoryVisibility::Hidden)->count());

        $logs = ActivityLog::query()->where('user_id', $editor->id)->get();
        $this->assertSame([
            'inventory_bulk_category_updated',
            'inventory_bulk_location_updated',
            'inventory_bulk_visibility_updated',
        ], $logs->pluck('action')->all());
        $this->assertTrue($logs->every(fn (ActivityLog $log) => array_slice($log->changed_fields, 0, 2) === ['item_count:2', 'failure_count:0']));
    }

    public function test_archiver_can_bulk_archive_without_deleting_history(): void
    {
        $archiver = $this->userWithPermissions(['inventory.archive']);
        $items = collect([$this->item('Bir'), $this->item('İki')]);

        $this->actingAs($archiver)->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'archive', 'item_ids' => $items->pluck('id')->all(), 'confirmed' => true,
        ])->assertSessionHas('success');

        $this->assertSame(2, InventoryItem::query()->whereNotNull('archived_at')->where('is_active', false)->count());
        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $archiver->id,
            'action' => 'inventory_bulk_archive_updated',
            'subject_type' => InventoryItem::class,
            'subject_id' => null,
        ]);
        $this->assertSame(
            ['item_count:2', 'failure_count:0', 'is_active', 'archived_at'],
            ActivityLog::query()->where('action', 'inventory_bulk_archive_updated')->sole()->changed_fields,
        );
    }

    public function test_bulk_operations_enforce_operation_specific_permissions(): void
    {
        $item = $this->item('Yetki sınırı');
        $editor = $this->userWithPermissions(['inventory.update']);
        $archiver = $this->userWithPermissions(['inventory.archive']);
        $viewer = $this->userWithPermissions(['inventory.view']);

        $payload = ['item_ids' => [$item->id], 'confirmed' => true];
        $this->actingAs($editor)->patch(route('admin.inventory.bulk-update'), [...$payload, 'operation' => 'archive'])->assertForbidden();
        $this->actingAs($archiver)->patch(route('admin.inventory.bulk-update'), [...$payload, 'operation' => 'visibility', 'public_visibility' => 'hidden'])->assertForbidden();
        $this->actingAs($viewer)->patch(route('admin.inventory.bulk-update'), [...$payload, 'operation' => 'location', 'location_id' => null])->assertForbidden();

        $this->assertNull($item->fresh()->archived_at);
        $this->assertSame(InventoryVisibility::Status, $item->fresh()->public_visibility);
        $this->assertDatabaseCount('activity_logs', 0);
    }

    public function test_bulk_update_is_confirmed_and_reports_partial_failures(): void
    {
        $editor = $this->userWithPermissions(['inventory.update', 'inventory.view']);
        $active = $this->item('Aktif');
        $archived = $this->item('Arşivli', ['is_active' => false, 'archived_at' => now()]);

        $this->actingAs($editor)->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'visibility', 'item_ids' => [$active->id], 'public_visibility' => 'hidden',
        ])->assertSessionHasErrors('confirmed');
        $missingId = max($active->id, $archived->id) + 100;
        $this->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'visibility', 'item_ids' => [$active->id, $archived->id, $missingId],
            'public_visibility' => 'hidden', 'confirmed' => true,
        ])->assertSessionHas('warning')
            ->assertSessionHas('bulk_result', fn (array $result) => $result['successCount'] === 1
                && $result['failureCount'] === 2
                && $result['failures'][0]['name'] === 'Arşivli'
                && $result['failures'][1]['id'] === $missingId);

        $this->assertSame(InventoryVisibility::Hidden, $active->fresh()->public_visibility);
        $this->assertSame(InventoryVisibility::Status, $archived->fresh()->public_visibility);
        $this->assertSame(
            ['item_count:1', 'failure_count:2', 'public_visibility'],
            ActivityLog::query()->sole()->changed_fields,
        );
        $this->get(route('admin.inventory.index'))->assertInertia(fn (Assert $page) => $page
            ->where('flash.bulkResult.successCount', 1)
            ->where('flash.bulkResult.failureCount', 2)
            ->where('flash.bulkResult.failures.0.name', 'Arşivli'));
    }

    public function test_partial_failure_report_hides_item_names_without_inventory_view_permission(): void
    {
        $editor = $this->userWithPermissions(['inventory.update']);
        $archived = $this->item('Gizli arşiv adı', ['is_active' => false, 'archived_at' => now()]);

        $this->actingAs($editor)->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'visibility', 'item_ids' => [$archived->id],
            'public_visibility' => 'hidden', 'confirmed' => true,
        ])->assertSessionHas('bulk_result', fn (array $result) => $result['successCount'] === 0
            && $result['failureCount'] === 1
            && $result['failures'][0]['name'] === "Kayıt #{$archived->id}");
    }

    private function userWithPermissions(array $permissions): User
    {
        $role = Role::query()->create(['name' => 'Toplu İşlem '.uniqid(), 'slug' => 'toplu-'.uniqid()]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function item(string $name, array $overrides = []): InventoryItem
    {
        return InventoryItem::query()->create([
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'item_type' => InventoryItemType::Consumable,
            'unit' => 'adet',
            'quantity' => 5,
            'public_visibility' => InventoryVisibility::Status,
            'is_active' => true,
            ...$overrides,
        ]);
    }
}
