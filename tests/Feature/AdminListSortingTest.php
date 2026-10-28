<?php

namespace Tests\Feature;

use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Enums\InventoryItemType;
use App\Enums\InventoryTransactionStatus;
use App\Enums\InventoryVisibility;
use App\Models\FeedbackReport;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminListSortingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_inventory_feedback_users_and_loans_follow_requested_sorting(): void
    {
        $admin = User::factory()->systemAdministrator()->create(['name' => 'Yetkili']);
        $low = $this->item('Az stok', 2);
        $high = $this->item('Çok stok', 20);

        $this->actingAs($admin)->get(route('admin.inventory.index', ['sort' => 'quantity', 'direction' => 'desc']))
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('filters.sort', 'quantity')->where('filters.direction', 'desc')
            ->where('items.data.0.id', $high->id)->where('items.data.1.id', $low->id));

        $old = FeedbackReport::query()->create(['type' => FeedbackType::Suggestion, 'message' => 'Eski', 'status' => FeedbackStatus::New]);
        $new = FeedbackReport::query()->create(['type' => FeedbackType::Bug, 'message' => 'Yeni', 'status' => FeedbackStatus::New]);
        $old->update(['created_at' => now()->subDay()]);
        $this->actingAs($admin)->get(route('admin.feedback.index', ['sort' => 'created_at', 'direction' => 'asc']))
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('reports.data.0.id', $old->id)->where('reports.data.1.id', $new->id));

        User::factory()->create(['name' => 'Zeynep', 'role' => 'operator', 'is_active' => true]);
        User::factory()->create(['name' => 'Ahmet', 'role' => 'operator', 'is_active' => true]);
        $this->actingAs($admin)->get(route('admin.access.index', ['user_sort' => 'name', 'user_direction' => 'desc']))
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('sorting.userSort', 'name')->where('sorting.userDirection', 'desc')
            ->where('users.0.name', 'Zeynep'));

        $early = InventoryTransaction::query()->create($this->transactionData($low, now()->subDay()));
        $late = InventoryTransaction::query()->create($this->transactionData($high, now()));
        $this->actingAs($admin)->get(route('admin.loans.index', ['sort' => 'issued_at', 'direction' => 'asc']))
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('transactions.data.0.id', $early->id)->where('transactions.data.1.id', $late->id));
    }

    public function test_all_management_lists_reject_unapproved_sort_columns_and_directions(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        $requests = [
            route('admin.inventory.index', ['sort' => 'name desc; drop table users', 'direction' => 'sideways']),
            route('admin.loans.index', ['sort' => 'recipient_name', 'direction' => 'sideways']),
            route('admin.feedback.index', ['sort' => 'message', 'direction' => 'sideways']),
            route('admin.access.index', ['user_sort' => 'password', 'user_direction' => 'sideways']),
        ];
        if (config('features.online_booking')) {
            $requests[] = route('admin.appointments.index', ['sort' => 'email', 'direction' => 'sideways']);
        }

        foreach ($requests as $url) {
            $this->actingAs($admin)->get($url)->assertSessionHasErrors();
        }
    }

    private function item(string $name, int $quantity): InventoryItem
    {
        return InventoryItem::query()->create([
            'name' => $name, 'slug' => str($name)->slug().'-'.uniqid(), 'item_type' => InventoryItemType::Loanable,
            'unit' => 'adet', 'quantity' => $quantity, 'public_visibility' => InventoryVisibility::Status, 'is_active' => true,
        ]);
    }

    private function transactionData(InventoryItem $item, $issuedAt): array
    {
        return [
            'inventory_item_id' => $item->id, 'item_type' => $item->item_type, 'status' => InventoryTransactionStatus::Active,
            'recipient_name' => 'Test Kullanıcı', 'quantity' => 1, 'quantity_returned' => 0, 'issued_at' => $issuedAt,
        ];
    }
}
