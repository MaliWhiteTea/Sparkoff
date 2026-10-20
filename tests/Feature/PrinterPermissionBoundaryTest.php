<?php

namespace Tests\Feature;

use App\Enums\PrinterStatus;
use App\Models\Permission;
use App\Models\Printer;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrinterPermissionBoundaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_status_manager_can_change_status_but_not_printer_details(): void
    {
        $manager = $this->userWithPermissions(['printers.view', 'printers.change_status']);
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();

        $this->actingAs($manager)->patch(route('admin.settings.printers.update', $printer), [
            'name' => $printer->name, 'status' => PrinterStatus::Maintenance->value, 'description' => $printer->description,
        ])->assertSessionHas('success');
        $this->assertSame(PrinterStatus::Maintenance, $printer->fresh()->status);

        $this->actingAs($manager)->patch(route('admin.settings.printers.update', $printer), [
            'name' => 'Yetkisiz isim', 'status' => PrinterStatus::Maintenance->value, 'description' => $printer->description,
        ])->assertForbidden();
        $this->assertNotSame('Yetkisiz isim', $printer->fresh()->name);
    }

    public function test_detail_editor_cannot_change_status_without_status_permission(): void
    {
        $editor = $this->userWithPermissions(['printers.view', 'printers.update']);
        $printer = Printer::query()->where('code', 'P-01')->firstOrFail();

        $this->actingAs($editor)->patch(route('admin.settings.printers.update', $printer), [
            'name' => 'Yeni yazıcı adı', 'status' => PrinterStatus::Maintenance->value, 'description' => $printer->description,
        ])->assertForbidden();
        $this->assertNotSame('Yeni yazıcı adı', $printer->fresh()->name);
    }

    private function userWithPermissions(array $permissions): User
    {
        $role = Role::query()->create(['name' => uniqid('Rol '), 'slug' => uniqid('rol-')]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }
}
