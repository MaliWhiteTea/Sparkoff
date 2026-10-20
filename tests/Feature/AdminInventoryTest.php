<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Models\InventoryItem;
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
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

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
