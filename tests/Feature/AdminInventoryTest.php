<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminInventoryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_inventory_viewer_can_list_and_filter_items_without_movement_data(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);
        InventoryItem::query()->create($this->itemData(['name' => 'Arduino Uno', 'slug' => 'arduino-uno', 'sku' => 'ARD-01']));
        InventoryItem::query()->create($this->itemData(['name' => 'Breadboard', 'slug' => 'breadboard', 'sku' => 'BRD-01']));

        $this->actingAs($viewer)->get(route('admin.inventory.index', ['search' => 'Arduino']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Inventory/Index')
                ->has('items.data', 1)
                ->where('items.data.0.name', 'Arduino Uno')
                ->where('recentMovements', []));
    }

    public function test_inactive_item_can_be_found_and_reactivated_from_inactive_or_all_filters(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view', 'inventory.update']);
        $inactive = InventoryItem::query()->create($this->itemData([
            'name' => 'Pasif Test Malzemesi',
            'quantity' => 10,
            'minimum_stock' => 1,
            'is_active' => false,
        ]));
        InventoryItem::query()->create($this->itemData(['name' => 'Aktif Test Malzemesi', 'quantity' => 10]));

        $this->actingAs($viewer)->get(route('admin.inventory.index', ['status' => 'inactive', 'search' => 'Pasif Test']))
            ->assertInertia(fn (Assert $page) => $page
                ->has('items.data', 1)
                ->where('items.data.0.id', $inactive->id)
                ->where('summary.total', 1)
                ->where('summary.inactive', 1));

        $this->actingAs($viewer)->get(route('admin.inventory.index', ['status' => 'all', 'search' => 'Pasif Test']))
            ->assertInertia(fn (Assert $page) => $page
                ->has('items.data', 1)
                ->where('items.data.0.id', $inactive->id));

        foreach (['active', 'low', 'out', 'archived'] as $status) {
            $this->actingAs($viewer)->get(route('admin.inventory.index', ['status' => $status, 'search' => 'Pasif Test']))
                ->assertInertia(fn (Assert $page) => $page->has('items.data', 0));
        }

        $this->actingAs($viewer)->put(route('admin.inventory.update', $inactive), [
            'name' => $inactive->name, 'sku' => null, 'category_id' => null, 'location_id' => null,
            'item_type' => $inactive->item_type->value, 'unit' => $inactive->unit, 'minimum_stock' => 1,
            'public_visibility' => $inactive->public_visibility->value, 'description' => null, 'is_active' => true,
        ])->assertSessionHas('success');
        $this->assertTrue($inactive->fresh()->is_active);
    }

    public function test_authorized_user_can_create_an_item_with_audited_initial_stock(): void
    {
        $staff = $this->userWithPermissions(['inventory.create']);

        $this->actingAs($staff)->post(route('admin.inventory.store'), [
            'name' => 'Arduino Uno', 'sku' => 'ARD-01', 'category_id' => null, 'location_id' => null,
            'item_type' => 'loanable', 'unit' => 'adet', 'quantity' => '30', 'minimum_stock' => '5',
            'public_visibility' => 'exact', 'description' => 'Geliştirme kartı', 'is_active' => true,
        ])->assertSessionHas('success');

        $item = InventoryItem::query()->where('sku', 'ARD-01')->firstOrFail();
        $this->assertSame('30.000', $item->quantity);
        $this->assertDatabaseHas('stock_movements', [
            'inventory_item_id' => $item->id, 'user_id' => $staff->id,
            'movement_type' => 'initial', 'quantity_change' => 30,
        ]);
    }

    public function test_item_creation_uses_the_same_thousandth_precision_as_stock_service(): void
    {
        $staff = $this->userWithPermissions(['inventory.create']);
        $data = [
            'name' => 'Hassas Malzeme', 'sku' => 'HAS-01', 'category_id' => null, 'location_id' => null,
            'item_type' => 'consumable', 'unit' => 'adet', 'quantity' => '0.0001', 'minimum_stock' => '0.0001',
            'public_visibility' => 'status', 'description' => null, 'is_active' => true,
        ];

        $this->actingAs($staff)->post(route('admin.inventory.store'), $data)
            ->assertSessionHasErrors(['quantity', 'minimum_stock']);
        $this->assertDatabaseMissing('inventory_items', ['sku' => 'HAS-01']);

        $this->post(route('admin.inventory.store'), [
            ...$data, 'quantity' => '0.001', 'minimum_stock' => '0',
        ])->assertSessionHas('success');
        $this->assertSame('0.001', InventoryItem::query()->where('sku', 'HAS-01')->firstOrFail()->quantity);
    }

    public function test_stock_adjustment_requires_permission_and_reason_and_cannot_go_negative(): void
    {
        $item = InventoryItem::query()->create($this->itemData(['quantity' => 3]));
        $viewer = $this->userWithPermissions(['inventory.view']);
        $manager = $this->userWithPermissions(['inventory.adjust_stock']);

        $this->actingAs($viewer)->post(route('admin.inventory.stock.adjust', $item), ['quantity_change' => 1, 'reason' => 'Sayım'])->assertForbidden();
        $this->actingAs($manager)->post(route('admin.inventory.stock.adjust', $item), ['quantity_change' => -4, 'reason' => 'Sayım farkı'])->assertSessionHasErrors('quantity_change');
        $this->assertSame('3.000', $item->fresh()->quantity);

        $this->actingAs($manager)->post(route('admin.inventory.stock.adjust', $item), ['quantity_change' => -2, 'reason' => 'Sayım farkı'])->assertSessionHas('success');
        $this->assertSame('1.000', $item->fresh()->quantity);
    }

    public function test_item_editor_cannot_change_sensitive_item_type_without_permission(): void
    {
        $item = InventoryItem::query()->create($this->itemData(['item_type' => InventoryItemType::Loanable]));
        $editor = $this->userWithPermissions(['inventory.update']);

        $this->actingAs($editor)->put(route('admin.inventory.update', $item), [
            'name' => 'Güncel ad', 'sku' => null, 'category_id' => null, 'location_id' => null,
            'item_type' => 'consumable', 'unit' => 'adet', 'minimum_stock' => null,
            'public_visibility' => 'status', 'description' => null, 'is_active' => true,
        ])->assertSessionHas('success');

        $this->assertSame(InventoryItemType::Loanable, $item->fresh()->item_type);
        $this->assertSame('Güncel ad', $item->fresh()->name);
    }

    public function test_archived_item_cannot_be_edited_or_have_stock_adjusted(): void
    {
        $item = InventoryItem::query()->create($this->itemData(['archived_at' => now(), 'is_active' => false]));
        $admin = User::factory()->systemAdministrator()->create();

        $this->actingAs($admin)->post(route('admin.inventory.stock.adjust', $item), ['quantity_change' => 1, 'reason' => 'Test'])->assertSessionHasErrors('quantity_change');
        $this->actingAs($admin)->put(route('admin.inventory.update', $item), [
            'name' => 'Değişmemeli', 'sku' => null, 'category_id' => null, 'location_id' => null,
            'item_type' => 'consumable', 'unit' => 'adet', 'minimum_stock' => null,
            'public_visibility' => 'status', 'description' => null, 'is_active' => false,
        ])->assertSessionHasErrors('item');

        $this->assertNotSame('Değişmemeli', $item->fresh()->name);
        $this->assertDatabaseCount('stock_movements', 0);
    }

    public function test_inventory_only_user_lands_on_inventory_after_login(): void
    {
        $staff = $this->userWithPermissions(['inventory.view'], 'envanter@example.com', 'guvenli-test-parolasi');

        $this->post(route('admin.login.store'), ['email' => $staff->email, 'password' => 'guvenli-test-parolasi'])
            ->assertRedirect(route('admin.inventory.index'));
    }

    public function test_category_and_location_managers_can_edit_and_deactivate_definitions(): void
    {
        $manager = $this->userWithPermissions(['inventory.manage_categories', 'inventory.manage_locations']);
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik']);
        $location = InventoryLocation::query()->create(['name' => 'Ana Raf', 'code' => 'R-01']);

        $this->actingAs($manager)->patch(route('admin.inventory.categories.update', $category), [
            'name' => 'Elektronik Kartlar', 'description' => 'Kart ve modüller', 'is_active' => false,
        ])->assertSessionHas('success');
        $this->actingAs($manager)->patch(route('admin.inventory.locations.update', $location), [
            'name' => 'Elektronik Rafı', 'code' => ' e-r01 ', 'description' => null,
            'is_public' => false, 'is_active' => false,
        ])->assertSessionHas('success');

        $this->assertDatabaseHas('inventory_categories', ['id' => $category->id, 'name' => 'Elektronik Kartlar', 'is_active' => false]);
        $this->assertDatabaseHas('inventory_locations', ['id' => $location->id, 'code' => 'E-R01', 'is_public' => false, 'is_active' => false]);
    }

    public function test_inventory_export_requires_permission_and_respects_filters(): void
    {
        InventoryItem::query()->create($this->itemData(['name' => 'Arduino Uno', 'slug' => 'arduino-uno', 'item_type' => InventoryItemType::Loanable]));
        InventoryItem::query()->create($this->itemData(['name' => 'Lehim Teli', 'slug' => 'lehim-teli', 'item_type' => InventoryItemType::Consumable]));
        $viewer = $this->userWithPermissions(['inventory.view']);
        $exporter = $this->userWithPermissions(['inventory.export']);

        $this->actingAs($viewer)->get(route('admin.inventory.export'))->assertForbidden();
        $response = $this->actingAs($exporter)->get(route('admin.inventory.export', ['type' => 'loanable']));
        $response->assertOk()->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $csv = $response->streamedContent();

        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertStringContainsString('Arduino Uno', $csv);
        $this->assertStringNotContainsString('Lehim Teli', $csv);
    }

    public function test_inventory_export_neutralizes_spreadsheet_formulas(): void
    {
        InventoryItem::query()->create($this->itemData(['name' => '=HYPERLINK("https://example.test")', 'slug' => 'zararli']));
        $exporter = $this->userWithPermissions(['inventory.export']);

        $csv = $this->actingAs($exporter)->get(route('admin.inventory.export'))->streamedContent();

        $this->assertStringContainsString("'=HYPERLINK", $csv);
        $this->assertStringNotContainsString(';=HYPERLINK', $csv);
    }

    private function userWithPermissions(array $permissions, ?string $email = null, string $password = 'password'): User
    {
        $role = Role::query()->create(['name' => 'Test Rolü '.uniqid(), 'slug' => 'test-'.uniqid()]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['email' => $email ?? uniqid('staff-').'@example.com', 'password' => $password, 'role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function itemData(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Test Malzemesi', 'slug' => 'test-'.uniqid(), 'item_type' => InventoryItemType::Consumable,
            'unit' => 'adet', 'quantity' => 0, 'minimum_stock' => null,
            'public_visibility' => InventoryVisibility::Status, 'is_active' => true,
        ], $overrides);
    }
}
