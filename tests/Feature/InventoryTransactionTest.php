<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryTransactionStatus;
use App\Enums\InventoryVisibility;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InventoryTransactionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_loan_delivery_and_partial_returns_update_stock_atomically(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::Loanable, 5);

        $this->actingAs($admin)->post(route('admin.loans.store'), [
            'inventory_item_id' => $item->id, 'recipient_name' => 'Ada Lovelace', 'recipient_email' => 'ada@example.com',
            'quantity' => 2, 'due_at' => now()->addDays(2)->format('Y-m-d\TH:i'), 'notes' => 'Proje kullanımı',
        ])->assertSessionHas('success');

        $transaction = InventoryTransaction::query()->firstOrFail();
        $this->assertSame('3.000', $item->fresh()->quantity);
        $this->assertSame(InventoryTransactionStatus::Active, $transaction->status);
        $this->assertStringNotContainsString('Ada Lovelace', (string) $transaction->getRawOriginal('recipient_name'));

        $this->actingAs($admin)->post(route('admin.loans.return', $transaction), ['quantity' => 1, 'note' => 'Kısmi iade'])->assertSessionHas('success');
        $this->assertSame('4.000', $item->fresh()->quantity);
        $this->assertSame('1.000', $transaction->fresh()->quantity_returned);
        $this->assertSame(InventoryTransactionStatus::Active, $transaction->fresh()->status);

        $this->actingAs($admin)->post(route('admin.loans.return', $transaction), ['quantity' => 1, 'note' => 'Tamamlandı'])->assertSessionHas('success');
        $this->assertSame('5.000', $item->fresh()->quantity);
        $this->assertSame(InventoryTransactionStatus::Completed, $transaction->fresh()->status);
    }

    public function test_consumable_delivery_is_completed_immediately_and_reduces_stock(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::Consumable, 10);

        $this->actingAs($admin)->post(route('admin.loans.store'), [
            'inventory_item_id' => $item->id, 'recipient_name' => 'Test Kullanıcı', 'quantity' => 3,
        ])->assertSessionHas('success');

        $this->assertSame('7.000', $item->fresh()->quantity);
        $this->assertSame(InventoryTransactionStatus::Completed, InventoryTransaction::query()->firstOrFail()->status);
    }

    public function test_fixed_asset_usage_does_not_change_stock_and_cannot_exceed_capacity(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::FixedAsset, 1);
        $payload = ['inventory_item_id' => $item->id, 'recipient_name' => 'Test Kullanıcı', 'quantity' => 1];

        $this->actingAs($admin)->post(route('admin.loans.store'), $payload)->assertSessionHas('success');
        $this->actingAs($admin)->post(route('admin.loans.store'), $payload)->assertSessionHasErrors('quantity');

        $this->assertSame('1.000', $item->fresh()->quantity);
        $this->assertDatabaseCount('inventory_transactions', 1);
    }

    public function test_item_type_cannot_change_while_an_active_delivery_exists(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::FixedAsset, 1);
        $delivery = ['inventory_item_id' => $item->id, 'recipient_name' => 'Birinci Kullanıcı', 'quantity' => 1];
        $this->actingAs($admin)->post(route('admin.loans.store'), $delivery)->assertSessionHas('success');

        $this->actingAs($admin)->put(route('admin.inventory.update', $item), [
            'name' => $item->name,
            'sku' => null,
            'category_id' => null,
            'location_id' => null,
            'item_type' => InventoryItemType::Loanable->value,
            'unit' => $item->unit,
            'minimum_stock' => null,
            'public_visibility' => InventoryVisibility::Status->value,
            'description' => null,
            'is_active' => true,
        ])->assertSessionHasErrors('item_type');

        $this->assertSame(InventoryItemType::FixedAsset, $item->fresh()->item_type);
        $this->actingAs($admin)->post(route('admin.loans.store'), [
            ...$delivery,
            'recipient_name' => 'İkinci Kullanıcı',
            'due_at' => now()->addDay()->format('Y-m-d\TH:i'),
        ])->assertSessionHasErrors('quantity');
        $this->assertDatabaseCount('inventory_transactions', 1);
    }

    public function test_fixed_asset_available_quantity_accounts_for_usage_and_partial_returns(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::FixedAsset, 3);
        $this->actingAs($admin)->post(route('admin.loans.store'), [
            'inventory_item_id' => $item->id, 'recipient_name' => 'Test Kullanıcı', 'quantity' => 2,
        ])->assertSessionHas('success');
        $transaction = InventoryTransaction::query()->firstOrFail();

        $this->assertSame('1.000', $item->fresh()->availableQuantity());
        $this->actingAs($admin)->get(route('admin.loans.index'))->assertInertia(fn (Assert $page) => $page
            ->where('items.0.id', $item->id)
            ->where('items.0.quantity', '1.000'));

        $this->actingAs($admin)->post(route('admin.loans.return', $transaction), [
            'quantity' => 1,
            'note' => 'Bir adedi iade edildi.',
        ])->assertSessionHas('success');

        $this->assertSame('2.000', $item->fresh()->availableQuantity());
        $this->actingAs($admin)->get(route('admin.loans.index'))->assertInertia(fn (Assert $page) => $page
            ->where('items.0.quantity', '2.000'));
    }

    public function test_damaged_fixed_asset_is_removed_from_available_stock(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::FixedAsset, 2);
        $this->actingAs($admin)->post(route('admin.loans.store'), [
            'inventory_item_id' => $item->id, 'recipient_name' => 'Test Kullanıcı', 'quantity' => 1,
        ]);
        $transaction = InventoryTransaction::query()->firstOrFail();

        $this->actingAs($admin)->patch(route('admin.loans.close', $transaction), [
            'status' => 'damaged', 'note' => 'Cihaz çalışmıyor.',
        ])->assertSessionHas('success');

        $this->assertSame('1.000', $item->fresh()->quantity);
        $this->assertSame('1.000', $item->fresh()->availableQuantity());
        $this->assertSame(InventoryTransactionStatus::Damaged, $transaction->fresh()->status);
    }

    public function test_personal_data_is_masked_without_separate_permissions(): void
    {
        $viewer = $this->userWithPermissions(['loans.view']);
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::Consumable, 3);
        $this->actingAs($admin)->post(route('admin.loans.store'), ['inventory_item_id' => $item->id, 'recipient_name' => 'Gizli Kişi', 'recipient_email' => 'gizli@example.com', 'quantity' => 1]);

        $this->actingAs($viewer)->get(route('admin.loans.index', ['status' => 'completed']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('transactions.data.0.recipientName', 'Gizli kullanıcı')
                ->where('transactions.data.0.recipientEmail', null)
                ->where('transactions.data.0.notes', null));
    }

    public function test_anonymization_never_touches_active_transactions(): void
    {
        Setting::query()->updateOrCreate(['key' => 'loans.personal_data_retention_days'], ['value' => 7, 'group' => 'privacy']);
        $item = $this->item(InventoryItemType::Loanable, 5);
        $completed = InventoryTransaction::query()->create($this->transactionData($item, ['status' => InventoryTransactionStatus::Completed, 'completed_at' => now()->subDays(8)]));
        $active = InventoryTransaction::query()->create($this->transactionData($item, ['status' => InventoryTransactionStatus::Active, 'completed_at' => null]));

        $this->artisan('loans:anonymize')->assertSuccessful();

        $this->assertNull($completed->fresh()->recipient_name);
        $this->assertNotNull($completed->fresh()->anonymized_at);
        $this->assertSame('Test Kullanıcı', $active->fresh()->recipient_name);
        $this->assertNull($active->fresh()->anonymized_at);
    }

    public function test_default_inventory_moderator_has_delivery_permissions_but_not_sensitive_stock_permissions(): void
    {
        $keys = Role::query()->where('slug', 'inventory-moderator')->firstOrFail()->permissions()->pluck('key')->all();

        $this->assertContains('loans.create', $keys);
        $this->assertContains('loans.receive_return', $keys);
        $this->assertNotContains('inventory.adjust_stock', $keys);
        $this->assertNotContains('inventory.change_item_type', $keys);
    }

    public function test_reseeding_does_not_overwrite_custom_moderator_permissions(): void
    {
        $role = Role::query()->where('slug', 'inventory-moderator')->firstOrFail();
        $role->permissions()->sync(Permission::query()->whereIn('key', ['loans.view', 'loans.create'])->pluck('id'));

        $this->seed(RolePermissionSeeder::class);

        $this->assertEqualsCanonicalizing(['loans.view', 'loans.create'], $role->permissions()->pluck('key')->all());
    }

    public function test_return_cannot_exceed_remaining_quantity(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::Loanable, 5);
        $this->actingAs($admin)->post(route('admin.loans.store'), [
            'inventory_item_id' => $item->id, 'recipient_name' => 'Test Kullanıcı', 'quantity' => 2,
            'due_at' => now()->addDay()->format('Y-m-d\TH:i'),
        ]);
        $transaction = InventoryTransaction::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.loans.return', $transaction), ['quantity' => 3])->assertSessionHasErrors('quantity');

        $this->assertSame('3.000', $item->fresh()->quantity);
        $this->assertSame('0.000', $transaction->fresh()->quantity_returned);
    }

    public function test_return_cannot_exceed_quantity_remaining_after_a_partial_return(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::Loanable, 5);
        $this->actingAs($admin)->post(route('admin.loans.store'), [
            'inventory_item_id' => $item->id, 'recipient_name' => 'Test Kullanıcı', 'quantity' => 2,
            'due_at' => now()->addDay()->format('Y-m-d\TH:i'),
        ]);
        $transaction = InventoryTransaction::query()->firstOrFail();

        $this->actingAs($admin)->post(route('admin.loans.return', $transaction), ['quantity' => 1])->assertSessionHas('success');
        $this->actingAs($admin)->post(route('admin.loans.return', $transaction), ['quantity' => 1.001])
            ->assertSessionHasErrors(['quantity' => 'İade miktarı kalan miktarı aşamaz. En fazla 1 iade edilebilir.']);

        $this->assertSame('4.000', $item->fresh()->quantity);
        $this->assertSame('1.000', $transaction->fresh()->quantity_returned);
        $this->assertSame(InventoryTransactionStatus::Active, $transaction->fresh()->status);
    }

    public function test_damage_reporter_cannot_mark_an_item_as_lost(): void
    {
        $reporter = $this->userWithPermissions(['loans.report_damage']);
        $item = $this->item(InventoryItemType::Loanable, 2);
        $transaction = InventoryTransaction::query()->create($this->transactionData($item, ['status' => InventoryTransactionStatus::Active]));

        $this->actingAs($reporter)->patch(route('admin.loans.close', $transaction), [
            'status' => 'lost', 'note' => 'Yetkisiz kayıp işlemi',
        ])->assertForbidden();

        $this->assertSame(InventoryTransactionStatus::Active, $transaction->fresh()->status);
    }

    public function test_delivery_rejects_blank_name_and_loan_without_due_date(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $item = $this->item(InventoryItemType::Loanable, 2);

        $this->actingAs($admin)->post(route('admin.loans.store'), [
            'inventory_item_id' => $item->id, 'recipient_name' => '   ', 'quantity' => 1,
        ])->assertSessionHasErrors('recipient_name');
        $this->actingAs($admin)->post(route('admin.loans.store'), [
            'inventory_item_id' => $item->id, 'recipient_name' => 'Ada Lovelace', 'quantity' => 1,
        ])->assertSessionHasErrors('due_at');

        $this->assertDatabaseCount('inventory_transactions', 0);
        $this->assertSame('2.000', $item->fresh()->quantity);
    }

    private function item(InventoryItemType $type, float $quantity): InventoryItem
    {
        return InventoryItem::query()->create([
            'name' => 'Test Malzemesi '.uniqid(), 'slug' => uniqid('malzeme-'), 'item_type' => $type,
            'unit' => 'adet', 'quantity' => $quantity, 'public_visibility' => InventoryVisibility::Status, 'is_active' => true,
        ]);
    }

    private function userWithPermissions(array $permissions): User
    {
        $role = Role::query()->create(['name' => uniqid('Rol '), 'slug' => uniqid('rol-')]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function transactionData(InventoryItem $item, array $overrides): array
    {
        return array_merge([
            'inventory_item_id' => $item->id, 'item_type' => $item->item_type, 'recipient_name' => 'Test Kullanıcı',
            'recipient_email' => 'test@example.com', 'quantity' => 1, 'issued_at' => now()->subDays(10),
        ], $overrides);
    }
}
