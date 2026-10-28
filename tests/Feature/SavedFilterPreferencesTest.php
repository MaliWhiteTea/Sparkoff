<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SavedFilterPreferencesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_user_can_save_and_update_only_their_own_named_filter(): void
    {
        $user = User::factory()->systemAdministrator()->create();
        $other = User::factory()->systemAdministrator()->create();

        $this->actingAs($user)->post(route('admin.saved-filters.store'), [
            'table' => 'inventory',
            'name' => 'Kritik stok',
            'filters' => ['search' => '', 'category' => '', 'type' => '', 'status' => 'low'],
        ])->assertSessionHas('success');

        $saved = $user->fresh()->saved_filters['inventory'];
        $this->assertCount(1, $saved);
        $this->assertTrue(Str::isUuid($saved[0]['id']));
        $this->assertSame('low', $saved[0]['filters']['status']);
        $this->assertNull($other->fresh()->saved_filters);

        $this->actingAs($user)->post(route('admin.saved-filters.store'), [
            'table' => 'inventory',
            'name' => 'kritik STOK',
            'filters' => ['search' => 'Arduino', 'category' => '', 'type' => '', 'status' => 'out'],
        ])->assertSessionHas('success');

        $updated = $user->fresh()->saved_filters['inventory'];
        $this->assertCount(1, $updated);
        $this->assertSame($saved[0]['id'], $updated[0]['id']);
        $this->assertSame('out', $updated[0]['filters']['status']);

        $this->actingAs($user)->get(route('admin.inventory.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('auth.user.savedFilters.inventory.0.name', 'kritik STOK')
                ->where('auth.user.savedFilters.inventory.0.filters.search', 'Arduino'));
    }

    public function test_saved_filters_validate_table_fields_values_and_limit(): void
    {
        $user = User::factory()->systemAdministrator()->create();

        $this->actingAs($user)->post(route('admin.saved-filters.store'), [
            'table' => 'inventory',
            'name' => 'Geçersiz',
            'filters' => ['search' => '', 'category' => '', 'type' => '', 'status' => 'secret', 'password' => 'hidden'],
        ])->assertSessionHasErrors(['filters', 'filters.status']);
        $this->assertNull($user->fresh()->saved_filters);

        $user->update(['saved_filters' => [
            'loans' => collect(range(1, 10))->map(fn (int $index) => [
                'id' => (string) Str::uuid(),
                'name' => "Filtre {$index}",
                'filters' => ['status' => 'active'],
            ])->all(),
        ]]);

        $this->actingAs($user)->post(route('admin.saved-filters.store'), [
            'table' => 'loans',
            'name' => 'On birinci filtre',
            'filters' => ['status' => 'overdue'],
        ])->assertSessionHasErrors('name');
        $this->assertCount(10, $user->fresh()->saved_filters['loans']);
    }

    public function test_filter_permission_and_owner_boundaries_are_enforced(): void
    {
        $limited = $this->panelUserWithoutPermissions();
        $owner = User::factory()->systemAdministrator()->create();
        $other = User::factory()->systemAdministrator()->create();

        $this->actingAs($limited)->post(route('admin.saved-filters.store'), [
            'table' => 'feedback',
            'name' => 'Yeni talepler',
            'filters' => ['status' => 'new'],
        ])->assertForbidden();

        $this->actingAs($owner)->post(route('admin.saved-filters.store'), [
            'table' => 'feedback',
            'name' => 'Yeni talepler',
            'filters' => ['status' => 'new'],
        ])->assertSessionHas('success');
        $filterId = $owner->fresh()->saved_filters['feedback'][0]['id'];

        $this->actingAs($other)
            ->delete(route('admin.saved-filters.destroy', ['table' => 'feedback', 'filterId' => $filterId]))
            ->assertNotFound();
        $this->assertCount(1, $owner->fresh()->saved_filters['feedback']);

        $this->actingAs($owner)
            ->delete(route('admin.saved-filters.destroy', ['table' => 'feedback', 'filterId' => $filterId]))
            ->assertSessionHas('success');
        $this->assertSame([], $owner->fresh()->saved_filters['feedback']);
    }

    public function test_personal_settings_reset_removes_saved_filters(): void
    {
        $user = User::factory()->systemAdministrator()->create([
            'saved_filters' => [
                'appointments' => [[
                    'id' => (string) Str::uuid(),
                    'name' => 'Onay bekleyenler',
                    'filters' => ['search' => '', 'status' => 'pending_approval'],
                ]],
            ],
        ]);

        $this->actingAs($user)->delete(route('admin.settings.personal.destroy'))->assertRedirect();

        $this->assertNull($user->fresh()->saved_filters);
    }

    private function panelUserWithoutPermissions(): User
    {
        $role = Role::query()->create(['name' => 'Sınırlı Yetkili', 'slug' => 'sinirli-yetkili']);
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }
}
