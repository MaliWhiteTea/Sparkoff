<?php

namespace Tests\Feature;

use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DatabaseCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_mysql_compatible_databases_use_utf8mb4_for_turkish_data(): void
    {
        $driver = DB::connection()->getDriverName();

        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            $this->markTestSkipped('Bu kabul kontrolü yalnız MySQL ve MariaDB üzerinde çalışır.');
        }

        $database = DB::connection()->getDatabaseName();
        $schema = DB::selectOne(
            'select default_character_set_name as charset_name, default_collation_name as collation_name
             from information_schema.schemata where schema_name = ?',
            [$database],
        );

        $this->assertNotNull($schema);
        $this->assertSame('utf8mb4', strtolower($schema->charset_name));
        $this->assertStringStartsWith('utf8mb4_', strtolower($schema->collation_name));

        $tables = DB::select(
            "select table_name, table_collation from information_schema.tables
             where table_schema = ? and table_type = 'BASE TABLE'",
            [$database],
        );

        $this->assertNotEmpty($tables);
        foreach ($tables as $table) {
            $table = array_change_key_case((array) $table, CASE_LOWER);
            $this->assertStringStartsWith(
                'utf8mb4_',
                strtolower($table['table_collation']),
                "{$table['table_name']} tablosu utf8mb4 collation kullanmıyor.",
            );
        }

        $setting = Setting::query()->create([
            'key' => 'acceptance.turkish_text',
            'value' => ['message' => 'İğdır, çığ, ölçü, Şule'],
            'group' => 'acceptance',
        ]);

        $this->assertSame('İğdır, çığ, ölçü, Şule', $setting->fresh()->value['message']);
    }
}
