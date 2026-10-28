<?php

namespace Tests\Feature;

use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\InventoryMedia;
use App\Models\InventoryTransaction;
use App\Models\Role;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InventoryPurgeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_only_system_administrator_can_access_purge_tools(): void
    {
        $legacyAdmin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $legacyAdmin->roles()->attach(Role::query()->create([
            'name' => 'Yetkisiz Panel Rolü',
            'slug' => 'yetkisiz-panel-rolu',
        ]));
        $item = $this->item('Korunan malzeme');

        $this->actingAs($legacyAdmin)->get(route('admin.settings.test-tools.index'))->assertForbidden();
        $this->actingAs($legacyAdmin)->delete(route('admin.inventory.destroy', $item), ['confirmation' => (string) $item->id])->assertForbidden();
        $this->actingAs($legacyAdmin)->delete(route('admin.settings.test-tools.inventory.destroy-all'), ['confirmation' => 'TÜM MALZEMELERİ SİL'])->assertForbidden();
        $this->assertDatabaseHas('inventory_items', ['id' => $item->id]);
    }

    public function test_system_administrator_can_permanently_delete_one_item_and_related_test_data(): void
    {
        Storage::fake('public');
        $admin = $this->systemAdministrator();
        $item = $this->item('Silinecek malzeme');
        StockMovement::query()->create(['inventory_item_id' => $item->id, 'movement_type' => 'initial', 'quantity_change' => 2, 'balance_after' => 2]);
        InventoryTransaction::query()->create(['inventory_item_id' => $item->id, 'issued_by' => $admin->id, 'item_type' => 'loanable', 'status' => 'active', 'recipient_name' => 'Test Kişisi', 'quantity' => 1, 'issued_at' => now()]);
        Storage::disk('public')->put("inventory-media/{$item->id}/test.jpg", 'test');
        InventoryMedia::query()->create(['inventory_item_id' => $item->id, 'type' => 'image', 'file_path' => "inventory-media/{$item->id}/test.jpg", 'alt_text' => 'Test']);

        $this->actingAs($admin)->delete(route('admin.inventory.destroy', $item), ['confirmation' => (string) $item->id])
            ->assertRedirect()->assertSessionHas('success');

        $this->assertDatabaseMissing('inventory_items', ['id' => $item->id]);
        $this->assertDatabaseMissing('stock_movements', ['inventory_item_id' => $item->id]);
        $this->assertDatabaseMissing('inventory_transactions', ['inventory_item_id' => $item->id]);
        $this->assertDatabaseMissing('inventory_media', ['inventory_item_id' => $item->id]);
        Storage::disk('public')->assertMissing("inventory-media/{$item->id}/test.jpg");
        $this->assertDatabaseHas('activity_logs', ['user_id' => $admin->id, 'action' => 'inventory_test_data_purged']);
    }

    public function test_bulk_purge_requires_exact_confirmation_and_keeps_definitions(): void
    {
        $admin = $this->systemAdministrator();
        InventoryCategory::query()->create(['name' => 'Test kategorisi', 'slug' => 'test-kategorisi']);
        InventoryLocation::query()->create(['name' => 'Test konumu', 'code' => 'TEST']);
        $this->item('Birinci malzeme');
        $this->item('İkinci malzeme');

        $this->actingAs($admin)->get(route('admin.settings.test-tools.index'))
            ->assertOk()->assertInertia(fn (Assert $page) => $page->component('Admin/Settings/TestTools')->where('inventoryCount', 2));
        $this->actingAs($admin)->delete(route('admin.settings.test-tools.inventory.destroy-all'), ['confirmation' => 'eminim'])
            ->assertSessionHasErrors('confirmation');
        $this->assertDatabaseCount('inventory_items', 2);

        $this->actingAs($admin)->delete(route('admin.settings.test-tools.inventory.destroy-all'), ['confirmation' => 'TÜM MALZEMELERİ SİL'])
            ->assertRedirect()->assertSessionHas('success');
        $this->assertDatabaseCount('inventory_items', 0);
        $this->assertDatabaseCount('inventory_categories', 1);
        $this->assertDatabaseCount('inventory_locations', 1);
        $this->actingAs($admin)->get(route('admin.activity-logs'))->assertInertia(fn (Assert $page) => $page
            ->where('logs.0.action', 'Test malzemelerini kalıcı olarak temizledi')
            ->where('logs.0.subject', 'Malzeme')
            ->where('logs.0.subjectId', null)
            ->where('logs.0.fields', ['Silinen malzeme: 2', 'Silinen teslim kaydı: 0', 'Silinen stok hareketi: 0']));
    }

    private function systemAdministrator(): User
    {
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach(Role::query()->where('is_system', true)->firstOrFail());

        return $user;
    }

    private function item(string $name): InventoryItem
    {
        return InventoryItem::query()->create([
            'category_id' => null, 'location_id' => null, 'name' => $name, 'slug' => str($name)->slug().'-'.uniqid(),
            'item_type' => 'loanable', 'unit' => 'adet', 'quantity' => 2, 'public_visibility' => 'status', 'is_active' => true,
        ]);
    }
}
