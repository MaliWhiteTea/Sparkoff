<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('item_type', 30);
            $table->string('status', 30)->index();
            $table->text('recipient_name')->nullable();
            $table->text('recipient_email')->nullable();
            $table->decimal('quantity', 14, 3);
            $table->decimal('quantity_returned', 14, 3)->default(0);
            $table->timestamp('issued_at')->index();
            $table->timestamp('due_at')->nullable()->index();
            $table->timestamp('completed_at')->nullable()->index();
            $table->timestamp('anonymized_at')->nullable()->index();
            $table->text('notes')->nullable();
            $table->text('closure_note')->nullable();
            $table->timestamps();

            $table->index(['status', 'due_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_transactions');
    }
};
