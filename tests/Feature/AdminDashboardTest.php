<?php

namespace Tests\Feature;

use App\Enums\AppointmentStatus;
use App\Enums\FeedbackStatus;
use App\Enums\FeedbackType;
use App\Enums\FilamentSource;
use App\Enums\InventoryItemType;
use App\Enums\InventoryTransactionStatus;
use App\Enums\InventoryVisibility;
use App\Enums\PrinterStatus;
use App\Models\Appointment;
use App\Models\FeedbackReport;
use App\Models\InventoryItem;
use App\Models\InventoryTransaction;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_dashboard_requires_an_active_panel_account(): void
    {
        $this->get(route('admin.dashboard'))->assertRedirect(route('admin.login'));

        $inactive = $this->userWithPermissions(['inventory.view'], false);
        $this->actingAs($inactive)->get(route('admin.dashboard'))->assertRedirect(route('admin.login'));
    }

    public function test_system_administrator_sees_every_enabled_workspace_module(): void
    {
        $admin = User::factory()->systemAdministrator()->create();

        $this->actingAs($admin)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                ->has('modules', 11)
                ->has('summaries', 5)
                ->where('modules', fn ($modules) => collect($modules)->pluck('key')->all() === [
                    'inventory', 'loans', 'appointments', 'calendar', 'feedback', 'announcements',
                    'printers', 'filaments', 'access', 'history', 'personal',
                ]));
    }

    public function test_limited_user_only_receives_authorized_modules_and_personal_settings(): void
    {
        $user = $this->userWithPermissions(['inventory.view', 'feedback.view']);

        $this->actingAs($user)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('modules', 3)
                ->has('summaries', 2)
                ->where('modules', fn ($modules) => collect($modules)->pluck('key')->all() === [
                    'inventory', 'feedback', 'personal',
                ])
                ->where('summaries', fn ($summaries) => collect($summaries)->pluck('key')->all() === [
                    'critical-stock', 'open-feedback',
                ]));
    }

    public function test_booking_modules_follow_the_feature_flag(): void
    {
        config()->set('features.online_booking', false);
        $user = $this->userWithPermissions(['appointments.view', 'printers.manage_schedule']);

        $this->actingAs($user)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('modules', 1)
                ->has('summaries', 0)
                ->where('modules.0.key', 'personal'));
    }

    public function test_dashboard_summaries_use_the_same_rules_as_their_filtered_lists(): void
    {
        $admin = User::factory()->systemAdministrator()->create();
        Printer::query()->update(['status' => PrinterStatus::Active]);
        $printer = Printer::query()->firstOrFail();
        $printer->update(['status' => PrinterStatus::Maintenance]);

        $critical = $this->inventoryItem('Kritik malzeme', 2, 3);
        $this->inventoryItem('Tükenen malzeme', 0, 3);
        $this->inventoryItem('Yeterli malzeme', 8, 3);

        InventoryTransaction::query()->create([
            'inventory_item_id' => $critical->id,
            'item_type' => InventoryItemType::Loanable,
            'status' => InventoryTransactionStatus::Active,
            'recipient_name' => 'Test kullanıcısı',
            'quantity' => 1,
            'issued_at' => now()->subDays(3),
            'due_at' => now()->subDay(),
        ]);
        InventoryTransaction::query()->create([
            'inventory_item_id' => $critical->id,
            'item_type' => InventoryItemType::Loanable,
            'status' => InventoryTransactionStatus::Active,
            'recipient_name' => 'Test kullanıcısı',
            'quantity' => 1,
            'issued_at' => now(),
            'due_at' => now()->addDay(),
        ]);

        $startsAt = now()->addDays(2)->startOfHour();
        Appointment::query()->create([
            'printer_id' => $printer->id,
            'status' => AppointmentStatus::PendingApproval,
            'first_name' => 'Test',
            'last_name' => 'Kullanıcısı',
            'email' => 'randevu@example.com',
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

        FeedbackReport::query()->create(['type' => FeedbackType::Bug, 'message' => 'Yeni talep', 'status' => FeedbackStatus::New]);
        FeedbackReport::query()->create(['type' => FeedbackType::Suggestion, 'message' => 'İncelenen talep', 'status' => FeedbackStatus::Reviewing]);
        FeedbackReport::query()->create(['type' => FeedbackType::Complaint, 'message' => 'Çözülen talep', 'status' => FeedbackStatus::Resolved]);

        $this->actingAs($admin)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('summaries', function ($summaries) {
                $summaries = collect($summaries)->keyBy('key');

                return $summaries['critical-stock']['count'] === 1
                    && $summaries['critical-stock']['href'] === route('admin.inventory.index', ['status' => 'low'])
                    && $summaries['overdue-loans']['count'] === 1
                    && $summaries['overdue-loans']['href'] === route('admin.loans.index', ['status' => 'overdue'])
                    && $summaries['pending-appointments']['count'] === 1
                    && $summaries['maintenance-printers']['count'] === 1
                    && $summaries['open-feedback']['count'] === 2
                    && $summaries['open-feedback']['href'] === route('admin.feedback.index', ['status' => 'open']);
            }));

        $this->actingAs($admin)->get(route('admin.feedback.index', ['status' => 'open']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.status', 'open')
                ->has('reports.data', 2)
                ->where('reports.data', fn ($reports) => collect($reports)->pluck('status')->sort()->values()->all() === ['new', 'reviewing']));
    }

    private function inventoryItem(string $name, int $quantity, int $minimumStock): InventoryItem
    {
        return InventoryItem::query()->create([
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)),
            'item_type' => InventoryItemType::Loanable,
            'unit' => 'adet',
            'quantity' => $quantity,
            'minimum_stock' => $minimumStock,
            'public_visibility' => InventoryVisibility::Status,
            'is_active' => true,
        ]);
    }

    private function userWithPermissions(array $permissions, bool $active = true): User
    {
        $role = Role::query()->create([
            'name' => 'Panel '.Str::random(6),
            'slug' => Str::lower(Str::random(12)),
        ]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => $active]);
        $user->roles()->attach($role);

        return $user;
    }
}
