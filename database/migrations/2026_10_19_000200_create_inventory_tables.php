<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('inventory_locations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('code', 50)->unique();
            $table->text('description')->nullable();
            $table->boolean('is_public')->default(true);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained('inventory_categories')->nullOnDelete();
            $table->foreignId('location_id')->nullable()->constrained('inventory_locations')->nullOnDelete();
            $table->string('name', 180);
            $table->string('slug', 200)->unique();
            $table->string('sku', 100)->nullable()->unique();
            $table->string('item_type', 30)->index();
            $table->string('unit', 30)->default('adet');
            $table->decimal('quantity', 14, 3)->default(0);
            $table->decimal('minimum_stock', 14, 3)->nullable();
            $table->string('public_visibility', 20)->default('status')->index();
            $table->text('description')->nullable();
            $table->json('technical_specs')->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('archived_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('reversed_movement_id')->nullable()->constrained('stock_movements')->nullOnDelete();
            $table->string('movement_type', 30)->index();
            $table->decimal('quantity_change', 14, 3);
            $table->decimal('balance_after', 14, 3);
            $table->string('reason', 500)->nullable();
            $table->nullableMorphs('source');
            $table->timestamps();

            $table->index(['inventory_item_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('inventory_locations');
        Schema::dropIfExists('inventory_categories');
    }
};
