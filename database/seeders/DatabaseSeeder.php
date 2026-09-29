<?php

namespace Database\Seeders;

use App\Enums\PrinterStatus;
use App\Models\Filament;
use App\Models\OperatingHour;
use App\Models\Printer;
use App\Models\Setting;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Printer::query()->upsert([
            [
                'code' => 'P-01',
                'name' => 'Atölye Yazıcısı 01',
                'status' => PrinterStatus::Active->value,
                'description' => 'Başlangıçta rezervasyona açık ana yazıcı.',
                'sort_order' => 1,
            ],
            [
                'code' => 'P-02',
                'name' => 'Atölye Yazıcısı 02',
                'status' => PrinterStatus::Maintenance->value,
                'description' => 'Onarım tamamlanana kadar rezervasyona kapalı.',
                'sort_order' => 2,
            ],
        ], ['code'], ['name', 'status', 'description', 'sort_order']);

        foreach ([1, 2, 3, 4, 5, 6, 7] as $weekday) {
            OperatingHour::query()->updateOrCreate(
                ['weekday' => $weekday],
                [
                    'is_open' => true,
                    'opens_at' => '09:00:00',
                    'latest_start_at' => '21:00:00',
                ],
            );
        }

        foreach ([
            ['material' => 'PLA', 'color' => 'Siyah', 'sort_order' => 1],
            ['material' => 'PLA', 'color' => 'Beyaz', 'sort_order' => 2],
            ['material' => 'PLA', 'color' => 'Kırmızı', 'sort_order' => 3],
            ['material' => 'PLA', 'color' => 'Mavi', 'sort_order' => 4],
        ] as $filament) {
            Filament::query()->updateOrCreate(
                ['material' => $filament['material'], 'color' => $filament['color']],
                [
                    'is_available' => true, 'sort_order' => $filament['sort_order'],
                    'diameter_mm' => 1.75, 'spool_weight_grams' => 1000,
                    'nozzle_temp_min' => 190, 'nozzle_temp_max' => 220,
                    'bed_temp_min' => 50, 'bed_temp_max' => 60,
                    'technical_notes' => 'Genel amaçlı, düşük çekme yapan ve başlangıç seviyesi baskılara uygun filament.',
                ],
            );
        }

        foreach ([
            ['key' => 'booking.slot_minutes', 'value' => 30, 'group' => 'booking'],
            ['key' => 'booking.maximum_duration_hours', 'value' => 24, 'group' => 'booking'],
            ['key' => 'booking.verification_hold_minutes', 'value' => 30, 'group' => 'booking'],
            ['key' => 'uploads.maximum_file_size_mb', 'value' => 100, 'group' => 'uploads'],
            ['key' => 'uploads.allowed_extensions', 'value' => ['gcode', '3mf', 'stl', 'step', 'stp', 'obj'], 'group' => 'uploads'],
            ['key' => 'privacy.notice_version', 'value' => '2026-09-29', 'group' => 'privacy'],
            ['key' => 'privacy.controller_name', 'value' => 'Sparkoff Proje Atölyesi’nin bağlı bulunduğu okul yönetimi', 'group' => 'privacy'],
            ['key' => 'privacy.controller_address', 'value' => 'Okulun resmî adresi yönetici panelinden eklenmelidir.', 'group' => 'privacy'],
            ['key' => 'privacy.contact_email', 'value' => 'atolye@sparkoff.tr', 'group' => 'privacy'],
            ['key' => 'privacy.appointment_retention_months', 'value' => 12, 'group' => 'privacy'],
            ['key' => 'privacy.file_retention_days', 'value' => 30, 'group' => 'privacy'],
            ['key' => 'privacy.is_draft', 'value' => true, 'group' => 'privacy'],
        ] as $setting) {
            Setting::query()->updateOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
