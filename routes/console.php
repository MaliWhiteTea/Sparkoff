<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
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

    User::query()->updateOrCreate(
        ['email' => $data['email']],
        ['name' => $data['name'], 'password' => $data['password'], 'role' => 'admin', 'is_active' => true],
    );

    $this->info("Yönetici hesabı hazır: {$data['email']}");

    return self::SUCCESS;
})->purpose('Yönetici hesabı oluşturur veya günceller');
