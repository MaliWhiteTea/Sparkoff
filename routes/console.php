<?php

use App\Models\InventoryTransaction;
use App\Models\Role;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Validator;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('admin:create {email} {--name=} {--password=}', function () {
    $password = $this->option('password') ?: $this->secret('Yönetici parolası (en az 12 karakter)');
    $data = [
        'name' => $this->option('name') ?: 'Atölye Yöneticisi',
        'email' => mb_strtolower(trim($this->argument('email'))),
        'password' => $password,
    ];

    $validator = Validator::make($data, [
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'email', 'max:255'],
        'password' => ['required', 'string', 'min:12'],
    ]);

    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $error) {
            $this->error($error);
        }

        return self::FAILURE;
    }

    $this->newLine();
    $this->line("E-posta: <info>{$data['email']}</info>");
    $this->line("Ad:      <info>{$data['name']}</info>");

    if (! $this->confirm('Bu bilgilerle yönetici hesabı kaydedilsin mi?', true)) {
        $this->warn('İşlem iptal edildi; hiçbir kayıt değiştirilmedi.');

        return self::SUCCESS;
    }

    $user = User::query()->updateOrCreate(
        ['email' => $data['email']],
        ['name' => $data['name'], 'password' => $data['password'], 'role' => 'operator', 'is_active' => true],
    );

    $systemAdministrator = Role::query()->where('slug', 'system-administrator')->first();
    if ($systemAdministrator) {
        $user->roles()->syncWithoutDetaching([$systemAdministrator->id]);
    }

    $this->info("Yönetici hesabı hazır: {$data['email']}");

    return self::SUCCESS;
})->purpose('Yönetici hesabı oluşturur veya günceller');

Artisan::command('admin:check', function () {
    $hasActiveAdministrator = User::query()
        ->where('is_active', true)
        ->whereHas('roles', fn ($query) => $query->where('is_system', true))
        ->exists();

    if (! $hasActiveAdministrator) {
        $this->error('Aktif yönetici hesabı bulunamadı.');

        return self::FAILURE;
    }

    $this->info('Aktif yönetici hesabı mevcut.');

    return self::SUCCESS;
})->purpose('Aktif bir yönetici hesabının bulunduğunu doğrular');

Artisan::command('loans:anonymize', function () {
    $days = max(1, (int) Setting::valueOf('loans.personal_data_retention_days', 30));
    $count = InventoryTransaction::query()
        ->whereNotNull('completed_at')->whereNull('anonymized_at')->where('completed_at', '<=', now()->subDays($days))
        ->update(['recipient_name' => null, 'recipient_email' => null, 'notes' => null, 'closure_note' => null, 'anonymized_at' => now()]);
    $this->info("{$count} tamamlanmış teslim kaydı anonimleştirildi.");

    return self::SUCCESS;
})->purpose('Saklama süresi dolan tamamlanmış teslim kayıtlarındaki kişisel verileri siler');

Schedule::command('loans:anonymize')->dailyAt('03:10')->withoutOverlapping();
