<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\InventoryItem;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class InventoryImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        Storage::fake('local');
    }

    public function test_import_permission_is_required_for_every_step(): void
    {
        $viewer = $this->userWithPermissions(['inventory.view']);

        $this->actingAs($viewer)->get(route('admin.inventory.import.index'))->assertForbidden();
        $this->actingAs($viewer)->post(route('admin.inventory.import.upload'))->assertForbidden();
        $this->actingAs($viewer)->post(route('admin.inventory.import.preview'))->assertForbidden();
        $this->actingAs($viewer)->post(route('admin.inventory.import.confirm'))->assertForbidden();
    }

    public function test_csv_can_be_mapped_previewed_and_imported_with_initial_stock(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $csv = "Ürün;Kod;Kategori;Konum;Tür;Birim;Miktar;Kritik stok;Görünürlük;Açıklama\nArduino Uno;ARD-01;Elektronik;A Rafı;ödünç;adet;30;5;kesin;Geliştirme kartı\nLehim Teli;LEH-01;Sarf;B Rafı;sarf;makara;4;1;durum;Kurşunsuz\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('envanter.csv', $csv),
        ])->assertSessionHas('success');

        $this->get(route('admin.inventory.import.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Inventory/Import')->where('upload.name', 'envanter.csv')->has('upload.headers', 10));

        $mapping = [
            'Ürün' => 'name', 'Kod' => 'sku', 'Kategori' => 'category', 'Konum' => 'location', 'Tür' => 'type',
            'Birim' => 'unit', 'Miktar' => 'quantity', 'Kritik stok' => 'minimum_stock',
            'Görünürlük' => 'visibility', 'Açıklama' => 'description',
        ];
        $this->post(route('admin.inventory.import.preview'), ['mapping' => $mapping])->assertSessionHas('success');
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 2)->where('analysis.errorCount', 0));
        $this->post(route('admin.inventory.import.confirm'))->assertRedirect(route('admin.inventory.index'));

        $arduino = InventoryItem::query()->where('sku', 'ARD-01')->firstOrFail();
        $this->assertSame('30.000', $arduino->quantity);
        $this->assertSame('loanable', $arduino->item_type->value);
        $this->assertSame('exact', $arduino->public_visibility->value);
        $this->assertDatabaseHas('stock_movements', ['inventory_item_id' => $arduino->id, 'movement_type' => 'initial', 'quantity_change' => 30]);
        $this->assertTrue(ActivityLog::query()->where('action', 'inventory_imported')->exists());
        Storage::disk('local')->assertMissing(session('inventory_import.path', 'missing'));
    }

    public function test_preview_flags_existing_duplicates_and_invalid_rows(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        InventoryItem::query()->create(['name' => 'Arduino Uno', 'slug' => 'arduino-uno', 'sku' => 'ARD-01', 'item_type' => 'consumable', 'unit' => 'adet', 'quantity' => 1, 'public_visibility' => 'status', 'is_active' => true]);
        $csv = "Ad;Kod;Miktar\nArduino Uno;ARD-01;3\n;;-2\nYeni Parça;NP-1;sayı değil\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), ['file' => UploadedFile::fake()->createWithContent('envanter.csv', $csv)]);
        $this->post(route('admin.inventory.import.preview'), ['mapping' => ['Ad' => 'name', 'Kod' => 'sku', 'Miktar' => 'quantity']]);

        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 0)->where('analysis.errorCount', 3)
            ->where('analysis.rows.0.errors.0', 'Envanterde veya dosyada tekrar eden malzeme.')
            ->has('analysis.rows.1.errors', 2)
            ->where('analysis.rows.2.errors.0', 'Miktar sayısal olmalıdır.'));
        $this->post(route('admin.inventory.import.confirm'))->assertSessionHasErrors('import');
        $this->assertDatabaseCount('inventory_items', 1);
    }

    public function test_duplicate_column_mapping_and_non_csv_files_are_rejected(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->create('image.jpg', 10, 'image/jpeg'),
        ])->assertSessionHasErrors('file');

        $this->post(route('admin.inventory.import.preview'), ['mapping' => ['A' => 'name']])->assertSessionHasErrors('file');
    }

    private function userWithPermissions(array $permissions): User
    {
        $role = Role::query()->create(['name' => 'İçe Aktarım '.uniqid(), 'slug' => 'import-'.uniqid()]);
        $role->permissions()->attach(Permission::query()->whereIn('key', $permissions)->pluck('id'));
        $user = User::factory()->create(['role' => 'operator', 'is_active' => true]);
        $user->roles()->attach($role);

        return $user;
    }
}
