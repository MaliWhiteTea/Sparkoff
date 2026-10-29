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
use App\Services\AdminRecentRecordService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminRecentRecordTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_tracking_requires_an_active_panel_user_and_supported_record_type(): void
    {
        $this->post(route('admin.recent-records.store'), ['record_type' => 'inventory', 'record_id' => 1])
            ->assertRedirect(route('admin.login'));

        $viewer = $this->userWithPermissions(['inventory.view']);
        $this->actingAs($viewer)->post(route('admin.recent-records.store'), ['record_type' => 'secret', 'record_id' => 1])
            ->assertSessionHasErrors('record_type');
        $this->actingAs($viewer)->post(route('admin.recent-records.store'), ['record_type' => 'inventory', 'record_id' => 999999])
            ->assertNotFound();
        $this->assertDatabaseCount('recently_viewed_records', 0);
    }

    public function test_appointment_history_is_user_specific_and_stores_no_personal_content(): void
    {
        $viewer = $this->userWithPermissions(['appointments.view', 'appointments.view_personal_data']);
        $otherViewer = $this->userWithPermissions(['appointments.view']);
        $appointment = $this->appointment();

        $this->actingAs($viewer)->get(route('admin.appointments.show', $appointment->public_id))->assertOk();

        $row = DB::table('recently_viewed_records')->sole();
        $this->assertSame($viewer->id, $row->user_id);
        $this->assertSame('appointment', $row->record_type);
        $this->assertSame($appointment->id, $row->record_id);
        $columns = array_keys((array) $row);
        $this->assertNotContains('title', $columns);
        $this->assertNotContains('description', $columns);
        $this->assertNotContains('name', $columns);
        $this->assertNotContains('email', $columns);

        $dashboard = $this->actingAs($viewer)->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('recentRecords', 1)
                ->where('recentRecords.0.type', 'appointment')
                ->where('recentRecords.0.title', 'Randevu '.Str::upper(Str::substr($appointment->public_id, 0, 8))));
        $this->assertStringNotContainsString('Ada Lovelace', $dashboard->getContent());
        $this->assertStringNotContainsString('ada.recent@example.com', $dashboard->getContent());

        $this->actingAs($otherViewer)->get(route('admin.dashboard'))
            ->assertInertia(fn (Assert $page) => $page->has('recentRecords', 0));
    }

    public function test_revoked_permission_hides_history_and_prevents_tracking(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);
        $item = $this->inventoryItem('Yetki testi');
        $this->actingAs($viewer)->post(route('admin.recent-records.store'), [
            'record_type' => 'inventory', 'record_id' => $item->id,
        ])->assertRedirect();

        $viewer->roles()->firstOrFail()->permissions()->detach();

        $this->actingAs($viewer)->get(route('admin.dashboard'))
            ->assertInertia(fn (Assert $page) => $page->has('recentRecords', 0));
        $this->actingAs($viewer)->post(route('admin.recent-records.store'), [
            'record_type' => 'inventory', 'record_id' => $item->id,
        ])->assertNotFound();
    }

    public function test_tracking_is_deduplicated_and_retains_only_the_latest_twenty_references(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);
        $recent = app(AdminRecentRecordService::class);
        $first = $this->inventoryItem('Parça 1');
        $recent->track($viewer, 'inventory', $first->id);
        $recent->track($viewer, 'inventory', $first->id);
        $this->assertDatabaseCount('recently_viewed_records', 1);

        foreach (range(2, 21) as $index) {
            $item = $this->inventoryItem("Parça {$index}");
            $recent->track($viewer, 'inventory', $item->id);
        }

        $this->assertDatabaseCount('recently_viewed_records', 20);
        $this->assertDatabaseMissing('recently_viewed_records', [
            'user_id' => $viewer->id,
            'record_type' => 'inventory',
            'record_id' => $first->id,
        ]);
    }

    public function test_invalid_recent_references_do_not_hide_older_accessible_records(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);
        $recent = app(AdminRecentRecordService::class);

        foreach (range(1, 9) as $index) {
            $recent->track($viewer, 'inventory', $this->inventoryItem("Geçerli parça {$index}")->id);
        }

        $latestId = DB::table('recently_viewed_records')
            ->where('user_id', $viewer->id)
            ->latest('viewed_at')
            ->latest('id')
            ->value('id');
        DB::table('recently_viewed_records')
            ->where('id', $latestId)
            ->update(['record_id' => 999999]);

        $this->assertCount(8, $recent->recent($viewer));
    }

    private function userWithPermissions(array $permissions): User
    {
        $role = Role::query()->create([
            'name' => 'Geçmiş '.Str::random(6),
            'slug' => Str::lower(Str::random(12)),
        ]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }

    private function inventoryItem(string $name): InventoryItem
    {
        return InventoryItem::query()->create([
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(5)),
            'item_type' => InventoryItemType::Consumable,
            'unit' => 'adet',
            'quantity' => 3,
            'public_visibility' => InventoryVisibility::Status,
            'is_active' => true,
        ]);
    }

    private function appointment(): Appointment
    {
        $startsAt = now()->addDays(2)->startOfHour();

        return Appointment::query()->create([
            'printer_id' => Printer::query()->where('code', 'P-01')->value('id'),
            'status' => AppointmentStatus::PendingApproval,
            'first_name' => 'Ada',
            'last_name' => 'Lovelace',
            'email' => 'ada.recent@example.com',
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
