<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('blackout_periods', function (Blueprint $table) {
            $table->boolean('is_all_day')->default(false)->after('kind');
        });
    }

    public function down(): void
    {
        Schema::table('blackout_periods', function (Blueprint $table) {
            $table->dropColumn('is_all_day');
        });
    }
};
