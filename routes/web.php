<?php

use App\Http\Controllers\Admin\AppointmentController as AdminAppointmentController;
use App\Http\Controllers\Admin\AuthController as AdminAuthController;
use App\Http\Controllers\Admin\BookingSettingsController as AdminBookingSettingsController;
use App\Http\Controllers\Admin\CalendarController as AdminCalendarController;
use App\Http\Controllers\Admin\PrinterSettingsController as AdminPrinterSettingsController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');
Route::get('/randevu', [AppointmentController::class, 'create'])->name('booking.create');
Route::get('/randevu/musaitlik', [AppointmentController::class, 'availability'])->middleware('throttle:60,1')->name('booking.availability');
Route::post('/randevu', [AppointmentController::class, 'store'])->middleware('throttle:5,1')->name('booking.store');
Route::get('/randevu/dogrula/{publicId}/{token}', [AppointmentController::class, 'showVerification'])->middleware('throttle:30,1')->name('booking.verify');
Route::post('/randevu/dogrula/{publicId}/{token}', [AppointmentController::class, 'verify'])->middleware('throttle:10,1')->name('booking.verify.confirm');
Route::get('/randevu/takip/{publicId}/{token}', [AppointmentController::class, 'track'])->middleware('throttle:60,1')->name('booking.track');
Route::post('/randevu/takip/{publicId}/{token}/iptal', [AppointmentController::class, 'cancel'])->middleware('throttle:10,1')->name('booking.cancel');

Route::prefix('yonetim')->name('admin.')->group(function () {
    Route::get('/giris', [AdminAuthController::class, 'create'])->name('login');
    Route::post('/giris', [AdminAuthController::class, 'store'])->middleware('throttle:5,1')->name('login.store');

    Route::middleware(['auth', 'admin.active'])->group(function () {
        Route::post('/cikis', [AdminAuthController::class, 'destroy'])->name('logout');
        Route::get('/takvim', [AdminCalendarController::class, 'index'])->name('calendar.index');
        Route::get('/randevular', [AdminAppointmentController::class, 'index'])->name('appointments.index');
        Route::get('/randevular/{publicId}', [AdminAppointmentController::class, 'show'])->name('appointments.show');
        Route::patch('/randevular/{publicId}/durum', [AdminAppointmentController::class, 'updateStatus'])->name('appointments.status');
        Route::get('/randevular/{publicId}/dosyalar/{file}', [AdminAppointmentController::class, 'download'])->name('appointments.files.download');

        Route::prefix('ayarlar')->name('settings.')->middleware('admin.only')->group(function () {
            Route::get('/randevu-kurallari', [AdminBookingSettingsController::class, 'edit'])->name('booking.edit');
            Route::put('/randevu-kurallari', [AdminBookingSettingsController::class, 'update'])->name('booking.update');
            Route::get('/yazicilar', [AdminPrinterSettingsController::class, 'index'])->name('printers.index');
            Route::post('/yazicilar', [AdminPrinterSettingsController::class, 'store'])->name('printers.store');
            Route::patch('/yazicilar/{printer}', [AdminPrinterSettingsController::class, 'update'])->name('printers.update');
            Route::post('/kapali-zamanlar', [AdminPrinterSettingsController::class, 'storeBlackout'])->name('blackouts.store');
            Route::delete('/kapali-zamanlar/{blackout}', [AdminPrinterSettingsController::class, 'destroyBlackout'])->name('blackouts.destroy');
        });
    });
});
