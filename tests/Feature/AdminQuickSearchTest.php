<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FilamentSource;
use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Models\Appointment;
use App\Models\InventoryItem;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminQuickSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_quick_search_requires_an_authenticated_panel_user_and_a_valid_query(): void
    {
        $this->getJson(route('admin.quick-search', ['q' => 'Arduino']))->assertUnauthorized();

        $viewer = $this->userWithPermissions(['inventory.view']);
        $this->actingAs($viewer)->getJson(route('admin.quick-search', ['q' => 'a']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
        $this->actingAs($viewer)->getJson(route('admin.quick-search', ['q' => '%%__']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
    }

    public function test_results_only_include_modules_the_user_can_view(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);
        InventoryItem::query()->create($this->itemData('Gizli Motor Malzemesi'));
        Printer::query()->firstOrFail()->update(['name' => 'Gizli Motor Yazıcısı']);

        $this->actingAs($viewer)->getJson(route('admin.quick-search', ['q' => 'Gizli Motor']))
            ->assertOk()
            ->assertJsonPath('results.0.module', 'Malzemeler')
            ->assertJsonPath('results.0.title', 'Gizli Motor Malzemesi')
            ->assertJsonCount(1, 'results');
    }

    public function test_appointment_identity_is_only_searchable_and_visible_with_personal_data_permission(): void
    {
        $appointment = $this->appointment();
        $viewer = $this->userWithPermissions(['appointments.view']);

        $this->actingAs($viewer)->getJson(route('admin.quick-search', ['q' => 'Ada Lovelace']))
            ->assertOk()
            ->assertJsonCount(0, 'results');

        $reference = Str::substr($appointment->public_id, 0, 8);
        $maskedResponse = $this->actingAs($viewer)->getJson(route('admin.quick-search', ['q' => $reference]))
            ->assertOk()
            ->assertJsonCount(1, 'results');
        $this->assertStringNotContainsString('Ada Lovelace', $maskedResponse->getContent());
        $this->assertStringNotContainsString('ada.quick@example.com', $maskedResponse->getContent());

        $personalViewer = $this->userWithPermissions(['appointments.view', 'appointments.view_personal_data']);
        $this->actingAs($personalViewer)->getJson(route('admin.quick-search', ['q' => 'Ada Lovelace']))
            ->assertOk()
            ->assertJsonCount(1, 'results')
            ->assertJsonPath('results.0.module', 'Randevular')
            ->assertJsonPath('results.0.title', 'Ada Lovelace')
            ->assertJsonFragment(['description' => 'ada.quick@example.com · Atölye Yazıcısı 01 · '.$appointment->starts_at->format('d.m.Y H:i')]);
    }

    public function test_user_identity_search_requires_the_sensitive_users_view_permission(): void
    {
        User::factory()->create(['name' => 'Nehir Arama Hedefi', 'email' => 'nehir.quick@example.com']);
        $inventoryViewer = $this->userWithPermissions(['inventory.view']);
        $userViewer = $this->userWithPermissions(['users.view']);

        $this->actingAs($inventoryViewer)->getJson(route('admin.quick-search', ['q' => 'Nehir Arama']))
            ->assertOk()
            ->assertJsonCount(0, 'results');

        $this->actingAs($userViewer)->getJson(route('admin.quick-search', ['q' => 'Nehir Arama']))
            ->assertOk()
            ->assertJsonPath('results.0.module', 'Kullanıcılar')
            ->assertJsonPath('results.0.title', 'Nehir Arama Hedefi')
            ->assertJsonFragment(['description' => 'nehir.quick@example.com · Aktif hesap']);
    }

    public function test_each_module_is_limited_to_five_results(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);
        foreach (range(1, 6) as $index) {
            InventoryItem::query()->create($this->itemData("Limit Parçası {$index}"));
        }

        $this->actingAs($viewer)->getJson(route('admin.quick-search', ['q' => 'Limit Parçası']))
            ->assertOk()
            ->assertJsonCount(5, 'results');
    }

    private function userWithPermissions(array $permissions): User
    {
        $role = Role::query()->create([
            'name' => 'Arama '.Str::random(6),
            'slug' => Str::lower(Str::random(12)),
        ]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function itemData(string $name): array
    {
        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)),
            'sku' => 'Q-'.Str::upper(Str::random(7)),
            'item_type' => InventoryItemType::Loanable,
            'unit' => 'adet',
            'quantity' => 4,
            'public_visibility' => InventoryVisibility::Status,
            'is_active' => true,
        ];
    }

    private function appointment(): Appointment
    {
        $startsAt = now()->addDays(3)->startOfHour();

        return Appointment::query()->create([
            'printer_id' => Printer::query()->where('code', 'P-01')->value('id'),
            'status' => AppointmentStatus::PendingApproval,
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'email' => 'ada.quick@example.com',
            'phone' => '05550000000',
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addHour(),
            'duration_minutes' => 60,
            'filament_source' => FilamentSource::Workshop,
            'filament_material' => 'PLA',
            'filament_color' => 'Siyah',
            'tracking_token_hash' => hash('sha256', Str::random(64)),
            'email_verified_at' => now(),
            'privacy_notice_version' => 'test',
            'privacy_notice_seen_at' => now(),
            'rules_accepted_at' => now(),
        ]);
    }
}
