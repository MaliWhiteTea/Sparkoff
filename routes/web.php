<?php

use App\Http\Controllers\AppointmentController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('Home'))->name('home');
Route::get('/randevu', [AppointmentController::class, 'create'])->name('booking.create');
Route::post('/randevu', [AppointmentController::class, 'store'])->middleware('throttle:5,1')->name('booking.store');
Route::get('/randevu/dogrula/{publicId}/{token}', [AppointmentController::class, 'showVerification'])->middleware('throttle:30,1')->name('booking.verify');
Route::post('/randevu/dogrula/{publicId}/{token}', [AppointmentController::class, 'verify'])->middleware('throttle:10,1')->name('booking.verify.confirm');
Route::get('/randevu/takip/{publicId}/{token}', [AppointmentController::class, 'track'])->middleware('throttle:60,1')->name('booking.track');
Route::post('/randevu/takip/{publicId}/{token}/iptal', [AppointmentController::class, 'cancel'])->middleware('throttle:10,1')->name('booking.cancel');
