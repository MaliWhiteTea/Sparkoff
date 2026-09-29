<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('filaments', function (Blueprint $table) {
            $table->id();
            $table->string('material', 40);
            $table->string('color', 80);
            $table->string('brand')->nullable();
            $table->boolean('is_available')->default(true)->index();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['material', 'color']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('filaments');
    }
};
