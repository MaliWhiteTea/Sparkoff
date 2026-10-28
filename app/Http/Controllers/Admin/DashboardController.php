<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $permissions = $user->isSystemAdministrator()
            ? collect(config('permissions'))->flatMap(fn ($items) => array_keys($items))
            : $user->roles()->with('permissions:id,key')->get()->flatMap->permissions->pluck('key')->unique();

        $modules = collect($this->modules())
            ->filter(fn (array $module) => (! ($module['booking'] ?? false) || config('features.online_booking'))
                && (empty($module['permissions']) || collect($module['permissions'])->contains(fn (string $permission) => $permissions->contains($permission))))
            ->map(function (array $module) {
                unset($module['permissions'], $module['booking']);
                $module['href'] = route($module['route']);
                unset($module['route']);

                return $module;
            })
            ->values();

        return Inertia::render('Admin/Dashboard', [
            'modules' => $modules,
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function modules(): array
    {
        return [
            ['key' => 'inventory', 'title' => 'Malzeme envanteri', 'description' => 'Stokları, kategorileri, konumları ve malzeme medyasını yönetin.', 'route' => 'admin.inventory.index', 'icon' => 'inventory', 'permissions' => ['inventory.view']],
            ['key' => 'loans', 'title' => 'Teslim ve iadeler', 'description' => 'Teslimleri, kısmi iadeleri, gecikmeleri ve kapanış durumlarını izleyin.', 'route' => 'admin.loans.index', 'icon' => 'loans', 'permissions' => ['loans.view']],
            ['key' => 'appointments', 'title' => 'Randevular', 'description' => 'Doğrulanmış talepleri inceleyin ve baskı durumlarını yönetin.', 'route' => 'admin.appointments.index', 'icon' => 'appointments', 'permissions' => ['appointments.view'], 'booking' => true],
            ['key' => 'calendar', 'title' => 'Randevu takvimi', 'description' => 'Yazıcı kullanımını, kapalı zamanları ve planlanmış baskıları görün.', 'route' => 'admin.calendar.index', 'icon' => 'calendar', 'permissions' => ['printers.manage_schedule'], 'booking' => true],
            ['key' => 'feedback', 'title' => 'Talepler', 'description' => 'Öneri, şikâyet ve hata bildirimlerini inceleyip sonuçlandırın.', 'route' => 'admin.feedback.index', 'icon' => 'feedback', 'permissions' => ['feedback.view']],
            ['key' => 'announcements', 'title' => 'Duyurular', 'description' => 'Kamu ve yönetim duyurularını hedef kitleleriyle birlikte yönetin.', 'route' => 'admin.announcements.index', 'icon' => 'announcements', 'permissions' => ['announcements.view', 'staff_announcements.view']],
            ['key' => 'printers', 'title' => 'Yazıcılar', 'description' => 'Yazıcı bilgilerini, durumlarını ve bakım takvimini düzenleyin.', 'route' => 'admin.settings.printers.index', 'icon' => 'printers', 'permissions' => ['printers.view']],
            ['key' => 'filaments', 'title' => 'Filamentler', 'description' => 'Atölye filamentlerini ve teknik baskı bilgilerini güncelleyin.', 'route' => 'admin.settings.filaments.index', 'icon' => 'filaments', 'permissions' => ['printers.manage_filaments']],
            ['key' => 'access', 'title' => 'Kullanıcılar ve roller', 'description' => 'Yetkili hesapları, rolleri ve izin sınırlarını yönetin.', 'route' => 'admin.access.index', 'icon' => 'access', 'permissions' => ['users.view', 'roles.view']],
            ['key' => 'history', 'title' => 'İşlem geçmişi', 'description' => 'Kritik yönetim işlemlerini ve güvenli değişiklik özetlerini inceleyin.', 'route' => 'admin.activity-logs', 'icon' => 'history', 'permissions' => ['audit_logs.view']],
            ['key' => 'personal', 'title' => 'Kişisel ayarlar', 'description' => 'Tema, arayüz ölçeği, tablo yoğunluğu ve menü görünümünüzü seçin.', 'route' => 'admin.settings.personal.edit', 'icon' => 'settings', 'permissions' => []],
        ];
    }
}
