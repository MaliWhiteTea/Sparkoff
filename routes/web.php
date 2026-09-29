<?php

use App\Http\Controllers\Admin\AppointmentController as AdminAppointmentController;
use App\Http\Controllers\Admin\AuthController as AdminAuthController;
use App\Http\Controllers\Admin\CalendarController as AdminCalendarController;
use App\Http\Controllers\AppointmentController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('Home'))->name('home');
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
    });
});
