<?php

namespace App\Providers;

use App\Models\Announcement;
use App\Models\BlackoutPeriod;
use App\Models\Filament;
use App\Models\Printer;
use App\Models\Setting;
use App\Observers\AuditableObserver;
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
        foreach ([Announcement::class, BlackoutPeriod::class, Filament::class, Printer::class, Setting::class] as $model) {
            $model::observe(AuditableObserver::class);
        }
    }
}
