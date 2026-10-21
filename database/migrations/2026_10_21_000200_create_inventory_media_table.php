<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);
            $table->string('file_path')->nullable();
            $table->string('external_url', 2048)->nullable();
            $table->string('title', 180)->nullable();
            $table->string('alt_text', 180)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_cover')->default(false);
            $table->timestamps();

            $table->index(['inventory_item_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_media');
    }
};
