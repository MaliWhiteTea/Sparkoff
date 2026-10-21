<?php

namespace App\Providers;

use App\Listeners\PreventDestructiveDatabaseCommands;
use App\Models\Announcement;
use App\Models\BlackoutPeriod;
use App\Models\FeedbackReport;
use App\Models\Filament;
use App\Models\InventoryCategory;
use App\Models\InventoryItem;
use App\Models\InventoryLocation;
use App\Models\InventoryMedia;
use App\Models\InventoryTransaction;
use App\Models\Printer;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use App\Observers\AuditableObserver;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Event::listen(CommandStarting::class, PreventDestructiveDatabaseCommands::class);

        foreach ([Announcement::class, BlackoutPeriod::class, FeedbackReport::class, Filament::class, InventoryCategory::class, InventoryItem::class, InventoryLocation::class, InventoryMedia::class, InventoryTransaction::class, Printer::class, Role::class, Setting::class, User::class] as $model) {
            $model::observe(AuditableObserver::class);
        }
    }
}
