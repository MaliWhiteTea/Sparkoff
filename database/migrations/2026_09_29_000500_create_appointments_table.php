<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('printer_id')->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->string('status', 40)->default('pending_verification')->index();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email')->index();
            $table->string('phone', 30);
            $table->dateTime('starts_at')->index();
            $table->dateTime('ends_at')->index();
            $table->unsignedSmallInteger('duration_minutes');
            $table->string('filament_source', 20);
            $table->foreignId('filament_id')->nullable()->constrained()->nullOnDelete();
            $table->string('filament_material', 40)->nullable();
            $table->string('filament_color', 80)->nullable();
            $table->text('user_note')->nullable();
            $table->text('admin_note')->nullable();
            $table->string('verification_token_hash', 64)->nullable()->unique();
            $table->string('tracking_token_hash', 64)->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('verification_expires_at')->nullable()->index();
            $table->timestamp('canceled_at')->nullable();
            $table->string('privacy_notice_version', 30);
            $table->timestamp('privacy_notice_seen_at');
            $table->timestamp('rules_accepted_at');
            $table->timestamps();

            $table->index(['printer_id', 'starts_at', 'ends_at'], 'appointments_availability_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
