<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $setting = DB::table('settings')->where('key', 'uploads.allowed_extensions')->first();

        if (! $setting) {
            return;
        }

        $extensions = json_decode($setting->value, true) ?: [];
        if (! in_array('obj', $extensions, true)) {
            $extensions[] = 'obj';
            DB::table('settings')->where('id', $setting->id)->update([
                'value' => json_encode(array_values($extensions)),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $setting = DB::table('settings')->where('key', 'uploads.allowed_extensions')->first();

        if (! $setting) {
            return;
        }

        $extensions = array_values(array_filter(
            json_decode($setting->value, true) ?: [],
            fn (string $extension) => $extension !== 'obj',
        ));

        DB::table('settings')->where('id', $setting->id)->update([
            'value' => json_encode($extensions),
            'updated_at' => now(),
        ]);
    }
};
