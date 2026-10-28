<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->timestamp('retention_exempt_until')->nullable()->index()->after('rules_accepted_at');
            $table->string('retention_exemption_reason')->nullable()->after('retention_exempt_until');
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex(['retention_exempt_until']);
            $table->dropColumn(['retention_exempt_until', 'retention_exemption_reason']);
        });
    }
};
