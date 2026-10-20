<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('announcements', function (Blueprint $table) {
            $table->string('audience', 20)->default('public')->index()->after('placement');
            $table->boolean('is_pinned')->default(false)->after('is_published');
            $table->boolean('requires_acknowledgement')->default(false)->after('is_pinned');
        });
        Schema::create('announcement_role', function (Blueprint $table) {
            $table->foreignId('announcement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('role_id')->constrained()->cascadeOnDelete();
            $table->primary(['announcement_id', 'role_id']);
        });
        Schema::create('announcement_user', function (Blueprint $table) {
            $table->foreignId('announcement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('read_at');
            $table->timestamp('acknowledged_at')->nullable();
            $table->primary(['announcement_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcement_user');
        Schema::dropIfExists('announcement_role');
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropColumn(['audience', 'is_pinned', 'requires_acknowledgement']);
        });
    }
};
