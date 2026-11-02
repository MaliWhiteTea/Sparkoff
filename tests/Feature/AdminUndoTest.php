<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Enums\StockMovementType;
use App\Enums\UndoActionType;
use App\Models\Announcement;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\UndoAction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminUndoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_stock_adjustment_can_be_undone_once_with_linked_audit_records(): void
    {
        $operator = $this->userWithPermissions(['inventory.adjust_stock']);
        $item = $this->item();

        $response = $this->actingAs($operator)->post(route('admin.inventory.stock.adjust', $item), [
            'quantity_change' => 2,
            'reason' => 'Sayım düzeltmesi',
        ]);

        $response->assertSessionHas('undo', fn (array $undo) => $undo['label'] === 'Geri al'
            && str_starts_with($undo['url'], '/yonetim/geri-al/')
            && str_contains($undo['description'], '60 saniye'));
        $this->assertSame('7.000', $item->fresh()->quantity);
        $action = UndoAction::query()->sole();
        $this->assertSame(UndoActionType::InventoryStockAdjustment, $action->type);
        $this->assertNotNull($action->original_activity_log_id);

        $this->post(route('admin.undo', $action))->assertSessionHas('success', 'Değişiklik güvenli şekilde geri alındı.');

        $this->assertSame('5.000', $item->fresh()->quantity);
        $action->refresh();
        $this->assertNotNull($action->used_at);
        $this->assertNotNull($action->reversal_activity_log_id);
        $originalMovement = StockMovement::query()->where('movement_type', StockMovementType::Adjustment)->sole();
        $this->assertDatabaseHas('stock_movements', [
            'movement_type' => StockMovementType::Reversal->value,
            'reversed_movement_id' => $originalMovement->id,
        ]);
        $this->assertDatabaseHas('activity_logs', [
            'id' => $action->reversal_activity_log_id,
            'action' => 'undo_applied',
            'user_id' => $operator->id,
        ]);

        $this->post(route('admin.undo', $action))->assertSessionHas('warning', 'Bu değişiklik daha önce geri alındı.');
        $this->assertSame('5.000', $item->fresh()->quantity);
    }

    public function test_bulk_category_location_and_visibility_changes_restore_exact_snapshots(): void
    {
        $editor = $this->userWithPermissions(['inventory.update']);
        $items = collect([$this->item('Bir'), $this->item('İki')]);
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik']);
        $location = InventoryLocation::query()->create(['name' => 'Raf', 'code' => 'R-01']);

        foreach ([
            ['operation' => 'category', 'field' => 'category_id', 'value' => $category->id],
            ['operation' => 'location', 'field' => 'location_id', 'value' => $location->id],
            ['operation' => 'visibility', 'field' => 'public_visibility', 'value' => InventoryVisibility::Hidden->value],
        ] as $case) {
            $payload = [
                'operation' => $case['operation'],
                'item_ids' => $items->pluck('id')->all(),
                'confirmed' => true,
                $case['field'] => $case['value'],
            ];
            $response = $this->actingAs($editor)->patch(route('admin.inventory.bulk-update'), $payload);
            $response->assertSessionHas('undo');
            $action = UndoAction::query()->latest('id')->firstOrFail();
            $this->assertSame(2, count($action->payload['items']));

            $this->post(route('admin.undo', $action))->assertSessionHas('success');
            foreach ($items as $item) {
                $restored = $item->fresh();
                if ($case['field'] === 'public_visibility') {
                    $this->assertSame(InventoryVisibility::Status, $restored->public_visibility);
                } else {
                    $this->assertNull($restored->{$case['field']});
                }
            }
        }
    }

    public function test_single_safe_item_field_change_is_undoable_but_mixed_edit_is_not(): void
    {
        $editor = $this->userWithPermissions(['inventory.update']);
        $item = $this->item();
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik']);

        $this->actingAs($editor)->put(route('admin.inventory.update', $item), $this->itemPayload($item, [
            'category_id' => $category->id,
        ]))->assertSessionHas('undo');
        $action = UndoAction::query()->sole();
        $this->post(route('admin.undo', $action))->assertSessionHas('success');
        $this->assertNull($item->fresh()->category_id);

        $this->put(route('admin.inventory.update', $item), $this->itemPayload($item, [
            'category_id' => $category->id,
            'description' => 'Aynı anda içerik değişti',
        ]))->assertSessionMissing('undo');
        $this->assertDatabaseCount('undo_actions', 1);
    }

    public function test_undo_refuses_expired_foreign_or_conflicting_actions(): void
    {
        $editor = $this->userWithPermissions(['inventory.update']);
        $other = $this->userWithPermissions(['inventory.update']);
        $item = $this->item();
        $first = InventoryCategory::query()->create(['name' => 'Birinci', 'slug' => 'birinci']);
        $second = InventoryCategory::query()->create(['name' => 'İkinci', 'slug' => 'ikinci']);

        $this->actingAs($editor)->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'category', 'item_ids' => [$item->id], 'category_id' => $first->id, 'confirmed' => true,
        ]);
        $action = UndoAction::query()->sole();

        $this->actingAs($other)->post(route('admin.undo', $action))->assertNotFound();
        $item->update(['category_id' => $second->id]);
        $this->actingAs($editor)->post(route('admin.undo', $action))
            ->assertSessionHas('warning', 'Malzemelerden biri daha sonra değiştirildiği için işlem geri alınamadı.');
        $this->assertSame($second->id, $item->fresh()->category_id);

        $item->update(['category_id' => $first->id]);
        $action->update(['expires_at' => now()->subSecond()]);
        $this->post(route('admin.undo', $action))->assertSessionHas('warning', 'Geri alma süresi doldu.');
        $this->assertNull($action->fresh()->used_at);
    }

    public function test_undo_rechecks_permission_at_execution_time(): void
    {
        $operator = $this->userWithPermissions(['inventory.adjust_stock']);
        $item = $this->item();
        $this->actingAs($operator)->post(route('admin.inventory.stock.adjust', $item), [
            'quantity_change' => 1, 'reason' => 'Geçici düzeltme',
        ]);
        $action = UndoAction::query()->sole();
        $operator->roles()->firstOrFail()->permissions()->detach();

        $this->post(route('admin.undo', $action))->assertForbidden();

        $this->assertSame('6.000', $item->fresh()->quantity);
        $this->assertNull($action->fresh()->used_at);
        $this->assertDatabaseCount('stock_movements', 1);
    }

    public function test_only_publication_only_announcement_edit_is_undoable(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $announcement = Announcement::query()->create([
            'title' => 'Duyuru', 'body' => 'Duyuru metni', 'type' => 'info',
            'placement' => 'all', 'audience' => 'public', 'is_published' => true,
        ]);

        $this->actingAs($admin)->patch(route('admin.announcements.update', $announcement), $this->announcementPayload([
            'is_published' => false,
        ]))->assertSessionHas('undo');
        $action = UndoAction::query()->sole();
        $this->assertSame(UndoActionType::AnnouncementPublication, $action->type);
        $this->post(route('admin.undo', $action))->assertSessionHas('success');
        $this->assertTrue($announcement->fresh()->is_published);

        $this->patch(route('admin.announcements.update', $announcement), $this->announcementPayload([
            'title' => 'Yeni başlık',
            'is_published' => false,
        ]))->assertSessionMissing('undo');
        $this->assertDatabaseCount('undo_actions', 1);
    }

    public function test_archive_and_sensitive_action_types_are_not_directly_undoable(): void
    {
        $this->assertSame([
            'inventory_stock_adjustment',
            'inventory_bulk_category',
            'inventory_bulk_location',
            'inventory_bulk_visibility',
            'announcement_publication',
        ], array_column(UndoActionType::cases(), 'value'));

        $archiver = $this->userWithPermissions(['inventory.archive']);
        $item = $this->item();
        $this->actingAs($archiver)->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'archive', 'item_ids' => [$item->id], 'confirmed' => true,
        ])->assertSessionMissing('undo');
        $this->assertDatabaseCount('undo_actions', 0);

        $editor = $this->userWithPermissions(['inventory.update']);
        $activeItem = $this->item('Aynı görünürlük');
        $this->actingAs($editor)->patch(route('admin.inventory.bulk-update'), [
            'operation' => 'visibility', 'item_ids' => [$activeItem->id],
            'public_visibility' => InventoryVisibility::Status->value, 'confirmed' => true,
        ])->assertSessionMissing('undo');
        $this->assertDatabaseCount('undo_actions', 0);
    }

    private function userWithPermissions(array $permissions): User
    {
        $role = Role::query()->create(['name' => 'Geri Alma '.uniqid(), 'slug' => 'geri-alma-'.uniqid()]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function item(string $name = 'Test malzemesi'): InventoryItem
    {
        return InventoryItem::query()->create([
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'item_type' => InventoryItemType::Consumable,
            'unit' => 'adet',
            'quantity' => 5,
            'public_visibility' => InventoryVisibility::Status,
            'is_active' => true,
        ]);
    }

    private function itemPayload(InventoryItem $item, array $overrides = []): array
    {
        return [
            'name' => $item->name, 'sku' => $item->sku, 'category_id' => $item->category_id,
            'location_id' => $item->location_id, 'item_type' => $item->item_type->value,
            'unit' => $item->unit, 'minimum_stock' => $item->minimum_stock,
            'public_visibility' => $item->public_visibility->value,
            'description' => $item->description, 'is_active' => $item->is_active,
            ...$overrides,
        ];
    }

    private function announcementPayload(array $overrides = []): array
    {
        return [
            'title' => 'Duyuru', 'body' => 'Duyuru metni', 'type' => 'info',
            'placement' => 'all', 'audience' => 'public', 'is_published' => true,
            'is_pinned' => false, 'requires_acknowledgement' => false, 'role_ids' => [],
            'starts_at' => null, 'ends_at' => null,
            ...$overrides,
        ];
    }
}
