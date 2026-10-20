<?php

use App\Http\Controllers\Admin\AccessController as AdminAccessController;
use App\Http\Controllers\Admin\ActivityLogController as AdminActivityLogController;
use App\Http\Controllers\Admin\AnnouncementController as AdminAnnouncementController;
use App\Http\Controllers\Admin\AppointmentController as AdminAppointmentController;
use App\Http\Controllers\Admin\AuthController as AdminAuthController;
use App\Http\Controllers\Admin\BookingSettingsController as AdminBookingSettingsController;
use App\Http\Controllers\Admin\CalendarController as AdminCalendarController;
use App\Http\Controllers\Admin\FeedbackController as AdminFeedbackController;
use App\Http\Controllers\Admin\FilamentSettingsController as AdminFilamentSettingsController;
use App\Http\Controllers\Admin\InventoryController as AdminInventoryController;
use App\Http\Controllers\Admin\InventoryTransactionController as AdminInventoryTransactionController;
use App\Http\Controllers\Admin\PrinterSettingsController as AdminPrinterSettingsController;
use App\Http\Controllers\Admin\PrivacySettingsController as AdminPrivacySettingsController;
use App\Http\Controllers\Admin\SettingsController as AdminSettingsController;
use App\Http\Controllers\Admin\WorkshopSettingsController as AdminWorkshopSettingsController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\FilamentController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\InventoryCatalogController;
use App\Http\Controllers\PrinterPortalController;
use App\Http\Controllers\PrivacyController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');
Route::get('/filamentler', [FilamentController::class, 'index'])->name('filaments.index');
Route::get('/malzemeler', InventoryCatalogController::class)->name('materials.index');
Route::get('/kvkk-aydinlatma', PrivacyController::class)->name('privacy.notice');
Route::get('/3d-yazicilar', PrinterPortalController::class)->name('printers.public');
Route::get('/geri-bildirim', [FeedbackController::class, 'create'])->name('feedback.create');
Route::post('/geri-bildirim', [FeedbackController::class, 'store'])->middleware('throttle:5,1')->name('feedback.store');

Route::middleware('booking.enabled')->group(function () {
    Route::get('/randevu', [AppointmentController::class, 'create'])->name('booking.create');
    Route::get('/randevu/musaitlik', [AppointmentController::class, 'availability'])->middleware('throttle:60,1')->name('booking.availability');
    Route::post('/randevu', [AppointmentController::class, 'store'])->middleware('throttle:5,1')->name('booking.store');
    Route::get('/randevu/dogrula/{publicId}/{token}', [AppointmentController::class, 'showVerification'])->middleware('throttle:30,1')->name('booking.verify');
    Route::post('/randevu/dogrula/{publicId}/{token}', [AppointmentController::class, 'verify'])->middleware('throttle:10,1')->name('booking.verify.confirm');
    Route::get('/randevu/takip/{publicId}/{token}', [AppointmentController::class, 'track'])->middleware('throttle:60,1')->name('booking.track');
    Route::post('/randevu/takip/{publicId}/{token}/iptal', [AppointmentController::class, 'cancel'])->middleware('throttle:10,1')->name('booking.cancel');
});

Route::prefix('yonetim')->name('admin.')->group(function () {
    Route::get('/giris', [AdminAuthController::class, 'create'])->name('login');
    Route::post('/giris', [AdminAuthController::class, 'store'])->middleware('throttle:5,1')->name('login.store');

    Route::middleware(['auth', 'admin.active'])->group(function () {
        Route::post('/cikis', [AdminAuthController::class, 'destroy'])->name('logout');
        Route::get('/islem-gecmisi', AdminActivityLogController::class)->middleware('permission:audit_logs.view')->name('activity-logs');
        Route::get('/talepler', [AdminFeedbackController::class, 'index'])->middleware('permission:feedback.view')->name('feedback.index');
        Route::patch('/talepler/{feedback}', [AdminFeedbackController::class, 'update'])->middleware('permission:feedback.update')->name('feedback.update');
        Route::get('/envanter', [AdminInventoryController::class, 'index'])->middleware('permission:inventory.view')->name('inventory.index');
        Route::get('/envanter-disa-aktar', [AdminInventoryController::class, 'export'])->middleware('permission:inventory.export')->name('inventory.export');
        Route::post('/envanter', [AdminInventoryController::class, 'store'])->middleware('permission:inventory.create')->name('inventory.store');
        Route::put('/envanter/{item}', [AdminInventoryController::class, 'update'])->middleware('permission:inventory.update')->name('inventory.update');
        Route::patch('/envanter/{item}/arsiv', [AdminInventoryController::class, 'archive'])->middleware('permission:inventory.archive')->name('inventory.archive');
        Route::post('/envanter/{item}/stok', [AdminInventoryController::class, 'adjustStock'])->middleware('permission:inventory.adjust_stock')->name('inventory.stock.adjust');
        Route::post('/envanter-kategorileri', [AdminInventoryController::class, 'storeCategory'])->middleware('permission:inventory.manage_categories')->name('inventory.categories.store');
        Route::patch('/envanter-kategorileri/{category}', [AdminInventoryController::class, 'updateCategory'])->middleware('permission:inventory.manage_categories')->name('inventory.categories.update');
        Route::post('/envanter-konumlari', [AdminInventoryController::class, 'storeLocation'])->middleware('permission:inventory.manage_locations')->name('inventory.locations.store');
        Route::patch('/envanter-konumlari/{location}', [AdminInventoryController::class, 'updateLocation'])->middleware('permission:inventory.manage_locations')->name('inventory.locations.update');
        Route::get('/teslimler', [AdminInventoryTransactionController::class, 'index'])->middleware('permission:loans.view')->name('loans.index');
        Route::post('/teslimler', [AdminInventoryTransactionController::class, 'store'])->middleware('permission:loans.create')->name('loans.store');
        Route::post('/teslimler/{transaction}/iade', [AdminInventoryTransactionController::class, 'receiveReturn'])->middleware('permission:loans.receive_return')->name('loans.return');
        Route::patch('/teslimler/{transaction}/kapat', [AdminInventoryTransactionController::class, 'close'])->middleware('permission.any:loans.report_damage,loans.report_lost')->name('loans.close');
        Route::get('/yetkiler', [AdminAccessController::class, 'index'])->middleware('permission.any:roles.view,users.view')->name('access.index');
        Route::post('/roller', [AdminAccessController::class, 'storeRole'])->middleware('permission:roles.create')->name('roles.store');
        Route::put('/roller/{role}', [AdminAccessController::class, 'updateRole'])->middleware('permission:roles.update')->name('roles.update');
        Route::delete('/roller/{role}', [AdminAccessController::class, 'destroyRole'])->middleware('permission:roles.delete')->name('roles.destroy');
        Route::post('/kullanicilar', [AdminAccessController::class, 'storeUser'])->middleware(['permission:users.create', 'permission:roles.assign'])->name('users.store');
        Route::put('/kullanicilar/{user}', [AdminAccessController::class, 'updateUser'])->middleware('permission.any:users.update,users.disable,users.reset_password,roles.assign')->name('users.update');
        Route::get('/duyurular', [AdminAnnouncementController::class, 'index'])->middleware('permission:announcements.view')->name('announcements.index');
        Route::post('/duyurular', [AdminAnnouncementController::class, 'store'])->middleware('permission:announcements.create')->name('announcements.store');
        Route::patch('/duyurular/{announcement}', [AdminAnnouncementController::class, 'update'])->middleware('permission:announcements.update')->name('announcements.update');
        Route::delete('/duyurular/{announcement}', [AdminAnnouncementController::class, 'destroy'])->middleware('permission:announcements.archive')->name('announcements.destroy');
        Route::middleware('booking.enabled')->group(function () {
            Route::get('/takvim', [AdminCalendarController::class, 'index'])->middleware('permission:printers.manage_schedule')->name('calendar.index');
            Route::get('/randevular', [AdminAppointmentController::class, 'index'])->middleware('permission:appointments.view')->name('appointments.index');
            Route::get('/randevular/{publicId}', [AdminAppointmentController::class, 'show'])->middleware('permission:appointments.view')->name('appointments.show');
            Route::patch('/randevular/{publicId}/durum', [AdminAppointmentController::class, 'updateStatus'])->middleware('permission.any:appointments.review,appointments.manage_status')->name('appointments.status');
            Route::get('/randevular/{publicId}/dosyalar/{file}', [AdminAppointmentController::class, 'download'])->middleware('permission:appointments.download_file')->name('appointments.files.download');
        });

        Route::prefix('ayarlar')->name('settings.')->group(function () {
            Route::get('/', AdminSettingsController::class)->name('index');
            Route::middleware('booking.enabled')->group(function () {
                Route::get('/randevu-kurallari', [AdminBookingSettingsController::class, 'edit'])->middleware('permission.any:system_settings.update,printers.manage_hours')->name('booking.edit');
                Route::put('/randevu-kurallari', [AdminBookingSettingsController::class, 'update'])->middleware('permission.any:system_settings.update,printers.manage_hours')->name('booking.update');
                Route::get('/kvkk', [AdminPrivacySettingsController::class, 'edit'])->middleware('permission:privacy_settings.update')->name('privacy.edit');
                Route::put('/kvkk', [AdminPrivacySettingsController::class, 'update'])->middleware('permission:privacy_settings.update')->name('privacy.update');
            });
            Route::get('/yazicilar', [AdminPrinterSettingsController::class, 'index'])->middleware('permission:printers.view')->name('printers.index');
            Route::post('/yazicilar', [AdminPrinterSettingsController::class, 'store'])->middleware('permission:printers.create')->name('printers.store');
            Route::patch('/yazicilar/{printer}', [AdminPrinterSettingsController::class, 'update'])->middleware('permission.any:printers.update,printers.change_status')->name('printers.update');
            Route::post('/kapali-zamanlar', [AdminPrinterSettingsController::class, 'storeBlackout'])->middleware('permission:printers.manage_schedule')->name('blackouts.store');
            Route::patch('/kapali-zamanlar/{blackout}', [AdminPrinterSettingsController::class, 'updateBlackout'])->middleware('permission:printers.manage_schedule')->name('blackouts.update');
            Route::delete('/kapali-zamanlar/{blackout}', [AdminPrinterSettingsController::class, 'destroyBlackout'])->middleware('permission:printers.manage_schedule')->name('blackouts.destroy');
            Route::get('/filamentler', [AdminFilamentSettingsController::class, 'index'])->middleware('permission:printers.manage_filaments')->name('filaments.index');
            Route::post('/filamentler', [AdminFilamentSettingsController::class, 'store'])->middleware('permission:printers.manage_filaments')->name('filaments.store');
            Route::patch('/filamentler/{filament}', [AdminFilamentSettingsController::class, 'update'])->middleware('permission:printers.manage_filaments')->name('filaments.update');
            Route::patch('/filament-turleri/{material}/kullanilabilirlik', [AdminFilamentSettingsController::class, 'updateMaterialAvailability'])->middleware('permission:printers.manage_filaments')->name('filaments.material-availability');
            Route::get('/atolye', [AdminWorkshopSettingsController::class, 'edit'])->middleware('permission:workshop_settings.update')->name('workshop.edit');
            Route::put('/atolye', [AdminWorkshopSettingsController::class, 'update'])->middleware('permission:workshop_settings.update')->name('workshop.update');
        });
    });
});
