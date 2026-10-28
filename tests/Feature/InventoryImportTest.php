<?php

namespace Tests\Feature;

use App\Enums\InventoryItemType;
use App\Enums\InventoryVisibility;
use App\Models\ActivityLog;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\InventoryCsvContract;
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

        $importerWithView = $this->userWithPermissions(['inventory.import', 'inventory.view']);
        $this->actingAs($importerWithView)->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('canViewInventory', true));
    }

    public function test_csv_can_be_mapped_previewed_and_imported_with_initial_stock(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $csv = "Ürün;Kod;Kategori;Konum;Tür;Birim;Miktar;Kritik stok;Görünürlük;Açıklama;Eski alan\nArduino Uno;ARD-01;Elektronik;A Rafı;ödünç;adet;30;5;kesin;Geliştirme kartı;yok say\nLehim Teli;LEH-01;Sarf;B Rafı;sarf;makara;4;1;durum;Kurşunsuz;yok say\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('envanter.csv', $csv),
        ])->assertSessionHas('success');

        $this->get(route('admin.inventory.import.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Inventory/Import')
            ->where('upload.name', 'envanter.csv')
            ->has('upload.headers', 11)
            ->where('upload.unmappedHeaders', ['Eski alan']));

        $mapping = [
            'Ürün' => 'name', 'Kod' => 'sku', 'Kategori' => 'category', 'Konum' => 'location', 'Tür' => 'type',
            'Birim' => 'unit', 'Miktar' => 'quantity', 'Kritik stok' => 'minimum_stock',
            'Görünürlük' => 'visibility', 'Açıklama' => 'description',
        ];
        $this->post(route('admin.inventory.import.preview'), ['mapping' => $mapping])->assertSessionHas('success');
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 2)->where('analysis.errorCount', 0));
        $this->post(route('admin.inventory.import.confirm'))
            ->assertRedirect(route('admin.inventory.import.index'))
            ->assertSessionHas('success', '2 malzeme envantere aktarıldı.');
        $this->get(route('admin.inventory.import.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('canViewInventory', false)
            ->where('flash.success', '2 malzeme envantere aktarıldı.')
            ->where('upload', null));
        $this->get(route('admin.inventory.index'))->assertForbidden();

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
            ->where('analysis.rows.2.errors.0', 'Miktar 0 ile 9.999.999.999 arasında ve en fazla üç ondalık basamaklı olmalıdır.'));
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

    public function test_exported_inventory_csv_can_be_uploaded_with_automatic_mapping(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $csv = "Stok kodu,Malzeme,Tür,Kategori,Konum kodu,Konum,Miktar,Birim,Kritik stok,Durum,Katalog görünürlüğü,Açıklama\r\n".
            ",Arduino UNO,Ödünç,Elektronik,A-1,A Rafı,8,adet,2,Aktif,Kesin,Test açıklaması\r\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('sparkoff-envanter.csv', $csv),
        ])->assertSessionHas('success');

        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('upload.mapping.Stok kodu', 'sku')
            ->where('upload.mapping.Malzeme', 'name')
            ->where('upload.mapping.Tür', 'type')
            ->where('upload.mapping.Konum kodu', 'location_code')
            ->where('upload.mapping.Durum', 'status')
            ->where('upload.mapping.Katalog görünürlüğü', 'visibility')
            ->where('upload.mapping.Miktar', 'quantity'));
    }

    public function test_real_export_can_be_imported_without_changing_contract_values(): void
    {
        $operator = $this->userWithPermissions(['inventory.export', 'inventory.import']);
        $category = InventoryCategory::query()->create(['name' => 'Elektronik', 'slug' => 'elektronik']);
        $location = InventoryLocation::query()->create(['name' => 'A Rafı', 'code' => 'A-01']);
        $expected = [];

        foreach (InventoryItemType::cases() as $type) {
            foreach (InventoryVisibility::cases() as $visibility) {
                foreach ([true, false] as $active) {
                    $sku = strtoupper(substr($type->value, 0, 3).'-'.substr($visibility->value, 0, 3).'-'.($active ? 'A' : 'P'));
                    $expected[$sku] = ['type' => $type, 'visibility' => $visibility, 'active' => $active];
                    InventoryItem::query()->create([
                        'category_id' => $category->id,
                        'location_id' => $location->id,
                        'name' => "{$type->value} {$visibility->value} ".($active ? 'aktif' : 'pasif'),
                        'slug' => strtolower($sku),
                        'sku' => $sku,
                        'item_type' => $type,
                        'unit' => 'adet',
                        'quantity' => '1.125',
                        'minimum_stock' => '0.125',
                        'public_visibility' => $visibility,
                        'description' => "Birinci satır\nİkinci satır; ayraçlı",
                        'is_active' => $active,
                    ]);
                }
            }
        }

        $csv = $this->actingAs($operator)
            ->get(route('admin.inventory.export', ['status' => 'all']))
            ->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);

        InventoryItem::query()->delete();
        $this->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('gercek-export.csv', $csv),
        ])->assertSessionHas('success');
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('upload.mapping', array_combine(array_values(InventoryCsvContract::COLUMNS), array_keys(InventoryCsvContract::COLUMNS))));

        $this->post(route('admin.inventory.import.preview'), [
            'mapping' => array_combine(array_values(InventoryCsvContract::COLUMNS), array_keys(InventoryCsvContract::COLUMNS)),
        ])->assertSessionHas('success');
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', count($expected))
            ->where('analysis.errorCount', 0));
        $this->post(route('admin.inventory.import.confirm'))->assertRedirect(route('admin.inventory.import.index'));

        $this->assertDatabaseCount('inventory_items', count($expected));
        foreach ($expected as $sku => $values) {
            $item = InventoryItem::query()->where('sku', $sku)->firstOrFail();
            $this->assertSame($values['type'], $item->item_type);
            $this->assertSame($values['visibility'], $item->public_visibility);
            $this->assertSame($values['active'], $item->is_active);
            $this->assertSame('1.125', $item->quantity);
            $this->assertSame('0.125', $item->minimum_stock);
            $this->assertSame("Birinci satır\nİkinci satır; ayraçlı", $item->description);
            $this->assertSame('A-01', $item->location?->code);
            $this->assertSame('A Rafı', $item->location?->name);
        }
    }

    public function test_unknown_contract_values_and_conflicting_location_are_rejected(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        InventoryLocation::query()->create(['name' => 'Ana Raf', 'code' => 'A-01']);
        $csv = "Malzeme;Tür;Katalog görünürlüğü;Durum;Konum;Konum kodu\n".
            "Tür Hatası;bilinmeyen;Kesin miktar;Aktif;;\n".
            "Görünürlük Hatası;Sarf malzemesi;herkese açık;Aktif;;\n".
            "Durum Hatası;Sarf malzemesi;Gizli;beklemede;;\n".
            "Konum Hatası;Sarf malzemesi;Stok durumu;Aktif;Başka Raf;A-01\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('katı-sozlesme.csv', $csv),
        ])->assertSessionHas('success');
        $this->post(route('admin.inventory.import.preview'), ['mapping' => [
            'Malzeme' => 'name',
            'Tür' => 'type',
            'Katalog görünürlüğü' => 'visibility',
            'Durum' => 'status',
            'Konum' => 'location',
            'Konum kodu' => 'location_code',
        ]])->assertSessionHas('success');

        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 0)
            ->where('analysis.errorCount', 4)
            ->where('analysis.rows.0.errors.0', 'Tür değeri tanınmıyor.')
            ->where('analysis.rows.1.errors.0', 'Katalog görünürlüğü değeri tanınmıyor.')
            ->where('analysis.rows.2.errors.0', 'Durum değeri tanınmıyor.')
            ->where('analysis.rows.3.errors.0', 'Konum kodu mevcut farklı bir konum adına ait.'));
    }

    public function test_utf8_and_utf8_bom_are_accepted_but_windows_1254_is_rejected_before_storage(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);

        foreach (["Malzeme;Miktar\nÖlçü;1\n", "\xEF\xBB\xBFMalzeme;Miktar\nÖlçü;1\n"] as $index => $csv) {
            $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
                'file' => UploadedFile::fake()->createWithContent("utf8-{$index}.csv", $csv),
            ])->assertSessionHas('success');
            $this->delete(route('admin.inventory.import.cancel'))->assertSessionHas('success');
        }

        $windows1254 = "Malzeme;Miktar\n\xD6l\xE7\xFC;1\n";
        $this->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('windows-1254.csv', $windows1254),
        ])->assertSessionHasErrors([
            'file' => 'CSV dosyası UTF-8 kodlamasında olmalıdır. Dosyayı UTF-8 olarak kaydedip yeniden yükleyin.',
        ]);
        $this->assertSame([], Storage::disk('local')->allFiles('inventory-imports'));
    }

    public function test_quantity_precision_and_range_are_validated_before_confirmation(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $csv = "Malzeme;Miktar\n".
            "Sıfır;0\n".
            "Çok küçük;0.0001\n".
            "En küçük;0.001\n".
            "Ondalık virgül;1,25\n".
            "Çok büyük;10000000000\n".
            "Metin;sayı değil\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('miktarlar.csv', $csv),
        ])->assertSessionHas('success');
        $this->post(route('admin.inventory.import.preview'), [
            'mapping' => ['Malzeme' => 'name', 'Miktar' => 'quantity'],
        ])->assertSessionHas('success');
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 3)
            ->where('analysis.errorCount', 3)
            ->where('analysis.rows.1.errors.0', 'Miktar 0 ile 9.999.999.999 arasında ve en fazla üç ondalık basamaklı olmalıdır.')
            ->where('analysis.rows.4.errors.0', 'Miktar 0 ile 9.999.999.999 arasında ve en fazla üç ondalık basamaklı olmalıdır.')
            ->where('analysis.rows.5.errors.0', 'Miktar 0 ile 9.999.999.999 arasında ve en fazla üç ondalık basamaklı olmalıdır.'));

        $this->post(route('admin.inventory.import.confirm'))->assertRedirect(route('admin.inventory.import.index'));
        $this->assertSame('0.000', InventoryItem::query()->where('name', 'Sıfır')->firstOrFail()->quantity);
        $this->assertSame('0.001', InventoryItem::query()->where('name', 'En küçük')->firstOrFail()->quantity);
        $this->assertSame('1.250', InventoryItem::query()->where('name', 'Ondalık virgül')->firstOrFail()->quantity);
        $this->assertDatabaseMissing('inventory_items', ['name' => 'Çok küçük']);
    }

    public function test_malformed_headers_and_row_widths_are_rejected_with_line_number(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $cases = [
            'bos-baslik.csv' => ["Malzeme;;Miktar\nVida;;1\n", 'CSV sütun başlıkları boş veya tekrarlı olamaz.'],
            'tekrar-baslik.csv' => ["Malzeme;MALZEME\nVida;Somun\n", 'CSV sütun başlıkları boş veya tekrarlı olamaz.'],
            'fazla.csv' => ["Malzeme;Miktar\nVida;1;fazla\n", 'CSV 2. satırındaki sütun sayısı başlıklarla eşleşmiyor.'],
            'eksik.csv' => ["Malzeme;Miktar\n\nVida\n", 'CSV 3. satırındaki sütun sayısı başlıklarla eşleşmiyor.'],
        ];

        foreach ($cases as $filename => [$csv, $message]) {
            $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
                'file' => UploadedFile::fake()->createWithContent($filename, $csv),
            ])->assertSessionHasErrors(['file' => $message]);
        }
        $this->assertSame([], Storage::disk('local')->allFiles('inventory-imports'));
    }

    public function test_quoted_delimiters_and_multiline_descriptions_are_preserved(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $csv = "Malzeme;Açıklama;Miktar\n\"Somun; M4\";\"Birinci satır\nİkinci satır, virgüllü\";1\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('tirnakli.csv', $csv),
        ])->assertSessionHas('success');
        $this->post(route('admin.inventory.import.preview'), [
            'mapping' => ['Malzeme' => 'name', 'Açıklama' => 'description', 'Miktar' => 'quantity'],
        ])->assertSessionHas('success');
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 1)
            ->where('analysis.rows.0.name', 'Somun; M4')
            ->where('analysis.rows.0.description', "Birinci satır\nİkinci satır, virgüllü"));
    }

    public function test_duplicate_policy_is_consistent_for_sku_name_case_and_turkish_characters(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $mapping = ['Malzeme' => 'name', 'Stok kodu' => 'sku'];
        $csv = "Malzeme;Stok kodu\nİğne;ABC-1\nİğne;ABC-2\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('ayni-ad.csv', $csv),
        ]);
        $this->post(route('admin.inventory.import.preview'), ['mapping' => $mapping]);
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 2)->where('analysis.errorCount', 0));
        $this->post(route('admin.inventory.import.confirm'))->assertRedirect();

        $this->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('yeni-sku.csv', "Malzeme;Stok kodu\nİĞNE;ABC-3\n"),
        ]);
        $this->post(route('admin.inventory.import.preview'), ['mapping' => $mapping]);
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 1)->where('analysis.errorCount', 0));

        $this->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('tekrar-sku.csv', "Malzeme;Stok kodu\nBaşka;abc-1\n"),
        ]);
        $this->post(route('admin.inventory.import.preview'), ['mapping' => $mapping]);
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 0)
            ->where('analysis.rows.0.errors.0', 'Envanterde veya dosyada tekrar eden malzeme.'));

        $this->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('tekrar-ad.csv', "Malzeme;Stok kodu\niĞNE;\n"),
        ]);
        $this->post(route('admin.inventory.import.preview'), ['mapping' => $mapping]);
        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.validCount', 0)
            ->where('analysis.rows.0.errors.0', 'Envanterde veya dosyada tekrar eden malzeme.'));
    }

    public function test_csv_data_row_limit_accepts_1999_and_2000_but_rejects_2001_without_truncation(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);

        foreach ([1999, 2000] as $rowCount) {
            $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
                'file' => UploadedFile::fake()->createWithContent("{$rowCount}-satir.csv", $this->csvWithRows($rowCount)),
            ])->assertSessionHas('success');
            $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
                ->where('upload.rowCount', $rowCount));
            $this->delete(route('admin.inventory.import.cancel'))->assertSessionHas('success');
        }

        $this->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('2001-satir.csv', $this->csvWithRows(2001)),
        ])->assertSessionHasErrors([
            'file' => 'CSV dosyası en fazla 2.000 veri satırı içerebilir. 2.001. veri satırı işlenmedi.',
        ]);
        $this->assertSame([], Storage::disk('local')->allFiles('inventory-imports'));
    }

    public function test_every_error_remains_accessible_after_the_first_100_preview_rows(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $rows = [];
        for ($index = 1; $index <= 2000; $index++) {
            $quantity = in_array($index, [101, 2000], true) ? 'geçersiz' : '1';
            $rows[] = "Malzeme {$index};{$quantity}";
        }
        $csv = "Malzeme;Miktar\n".implode("\n", $rows)."\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('tum-hatalar.csv', $csv),
        ])->assertSessionHas('success');
        $this->post(route('admin.inventory.import.preview'), [
            'mapping' => ['Malzeme' => 'name', 'Miktar' => 'quantity'],
        ])->assertSessionHas('success');

        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.totalCount', 2000)
            ->where('analysis.validCount', 1998)
            ->where('analysis.errorCount', 2)
            ->has('analysis.rows', 100)
            ->missing('analysis.validRows')
            ->has('analysis.errorRows', 2)
            ->where('analysis.errorRows.0.line', 102)
            ->where('analysis.errorRows.0.name', 'Malzeme 101')
            ->where('analysis.errorRows.1.line', 2001)
            ->where('analysis.errorRows.1.name', 'Malzeme 2000'));
    }

    public function test_error_report_uses_the_physical_start_line_after_blank_and_multiline_records(): void
    {
        $importer = $this->userWithPermissions(['inventory.import']);
        $csv = "Malzeme;Açıklama;Miktar\n\n".
            "İlk;\"Açıklama birinci satır\nAçıklama ikinci satır\";1\n".
            "Hatalı;Tek satır;geçersiz\n";

        $this->actingAs($importer)->post(route('admin.inventory.import.upload'), [
            'file' => UploadedFile::fake()->createWithContent('fiziksel-satir.csv', $csv),
        ])->assertSessionHas('success');
        $this->post(route('admin.inventory.import.preview'), [
            'mapping' => ['Malzeme' => 'name', 'Açıklama' => 'description', 'Miktar' => 'quantity'],
        ])->assertSessionHas('success');

        $this->get(route('admin.inventory.import.index'))->assertInertia(fn (Assert $page) => $page
            ->where('analysis.errorRows.0.line', 5)
            ->where('analysis.errorRows.0.name', 'Hatalı'));
    }

    private function contractMapping(): array
    {
        return array_combine(array_values(InventoryCsvContract::COLUMNS), array_keys(InventoryCsvContract::COLUMNS));
    }

    private function csvWithRows(int $rowCount): string
    {
        $rows = [];
        for ($index = 1; $index <= $rowCount; $index++) {
            $rows[] = "Malzeme {$index};SKU-{$index};1";
        }

        return "Malzeme;Stok kodu;Miktar\n".implode("\n", $rows)."\n";
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
