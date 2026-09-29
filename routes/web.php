<?php

use App\Http\Controllers\AppointmentController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('Home'))->name('home');
Route::get('/randevu', [AppointmentController::class, 'create'])->name('booking.create');
Route::post('/randevu', [AppointmentController::class, 'store'])->name('booking.store');
