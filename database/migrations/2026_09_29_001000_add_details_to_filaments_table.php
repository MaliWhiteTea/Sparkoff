<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('filaments', function (Blueprint $table) {
            $table->string('unavailable_reason')->nullable()->after('is_available');
            $table->decimal('diameter_mm', 4, 2)->default(1.75)->after('brand');
            $table->unsignedSmallInteger('spool_weight_grams')->nullable()->after('diameter_mm');
            $table->unsignedSmallInteger('nozzle_temp_min')->nullable()->after('spool_weight_grams');
            $table->unsignedSmallInteger('nozzle_temp_max')->nullable()->after('nozzle_temp_min');
            $table->unsignedSmallInteger('bed_temp_min')->nullable()->after('nozzle_temp_max');
            $table->unsignedSmallInteger('bed_temp_max')->nullable()->after('bed_temp_min');
            $table->text('technical_notes')->nullable()->after('bed_temp_max');
        });

        DB::table('filaments')->where('material', 'PLA')->update([
            'spool_weight_grams' => 1000,
            'nozzle_temp_min' => 190,
            'nozzle_temp_max' => 220,
            'bed_temp_min' => 50,
            'bed_temp_max' => 60,
            'technical_notes' => 'Genel amaçlı, düşük koku ve kolay baskı alınabilen filament.',
        ]);
    }

    public function down(): void
    {
        Schema::table('filaments', function (Blueprint $table) {
            $table->dropColumn([
                'unavailable_reason', 'diameter_mm', 'spool_weight_grams',
                'nozzle_temp_min', 'nozzle_temp_max', 'bed_temp_min', 'bed_temp_max', 'technical_notes',
            ]);
        });
    }
};
