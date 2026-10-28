<?php

namespace App\Services;

class ActivityLogPresenter
{
    private const ACTIONS = [
        'created' => 'Oluşturdu',
        'updated' => 'Güncelledi',
        'deleted' => 'Sildi',
        'read' => 'Okudu',
        'acknowledged' => 'Okuduğunu onayladı',
        'inventory_imported' => 'Envanteri CSV dosyasından içe aktardı',
        'inventory_test_data_purged' => 'Test malzemelerini kalıcı olarak temizledi',
        'retention_applied' => 'Veri saklama politikasını uyguladı',
    ];

    private const SUBJECTS = [
        'Announcement' => 'Duyuru',
        'Appointment' => 'Randevu',
        'BlackoutPeriod' => 'Takvim kaydı',
        'FeedbackReport' => 'Geri bildirim',
        'Filament' => 'Filament',
        'InventoryCategory' => 'Malzeme kategorisi',
        'InventoryItem' => 'Malzeme',
        'InventoryLocation' => 'Malzeme konumu',
        'InventoryMedia' => 'Malzeme medyası',
        'InventoryTransaction' => 'Teslim kaydı',
        'Printer' => 'Yazıcı',
        'Role' => 'Rol',
        'Setting' => 'Ayar',
        'User' => 'Kullanıcı',
    ];

    private const FIELDS = [
        'audience' => 'Hedef kitle', 'body' => 'İçerik', 'category_id' => 'Kategori',
        'closed_by' => 'Kapatan kullanıcı', 'completed_at' => 'Tamamlanma zamanı',
        'created_count' => 'Eklenen malzeme', 'description' => 'Açıklama', 'due_at' => 'Beklenen iade',
        'email' => 'E-posta', 'id' => 'Kayıt numarası', 'interface_preferences' => 'Arayüz tercihleri',
        'inventory_item_id' => 'Malzeme', 'is_active' => 'Aktiflik', 'is_pinned' => 'Sabitleme',
        'is_published' => 'Yayın durumu', 'issued_at' => 'Teslim zamanı', 'issued_by' => 'Teslim eden',
        'item_type' => 'Malzeme türü', 'items' => 'Silinen malzeme', 'location_id' => 'Konum',
        'minimum_stock' => 'Minimum stok', 'movements' => 'Silinen stok hareketi', 'name' => 'Ad',
        'notes' => 'Notlar', 'permissions' => 'İzinler', 'placement' => 'Gösterim yeri',
        'public_visibility' => 'Katalog görünürlüğü', 'quantity' => 'Miktar',
        'quantity_returned' => 'İade edilen miktar', 'recipient_email' => 'Alıcı e-postası',
        'recipient_name' => 'Alıcı adı', 'requires_acknowledgement' => 'Onay gereksinimi',
        'roles' => 'Roller', 'sku' => 'Stok kodu', 'slug' => 'Adres adı',
        'source_file' => 'Kaynak dosya', 'staff_announcement' => 'Yönetim duyurusu',
        'status' => 'Durum', 'table_preferences' => 'Tablo tercihleri', 'target_roles' => 'Hedef roller',
        'title' => 'Başlık', 'transactions' => 'Silinen teslim kaydı', 'type' => 'Tür', 'unit' => 'Birim',
        'appointments_deleted' => 'Silinen randevu', 'files_deleted' => 'Silinen model dosyası',
        'file_schedules_created' => 'Planlanan dosya silme işlemi', 'failures' => 'Ertelenen hata',
        'appointment_retention_months' => 'Randevu saklama süresi (ay)',
        'file_retention_days' => 'Dosya saklama süresi (gün)',
    ];

    private const SENSITIVE_FIELDS = [
        'password', 'remember_token', 'verification_token_hash', 'tracking_token_hash',
    ];

    public function action(string $action): string
    {
        return self::ACTIONS[$action] ?? 'İşlem ('.$this->readableCode($action).')';
    }

    public function subject(?string $subjectType): string
    {
        $subject = class_basename((string) $subjectType);

        return self::SUBJECTS[$subject] ?? 'Kayıt türü ('.$this->readableCode($subject).')';
    }

    /** @return list<string> */
    public function fields(array $fields): array
    {
        return collect($fields)
            ->reject(function ($value, $key) {
                $field = is_int($key) ? explode(':', (string) $value, 2)[0] : (string) $key;

                return in_array($field, self::SENSITIVE_FIELDS, true);
            })
            ->map(function ($value, $key) {
                if (is_int($key)) {
                    [$field, $detail] = array_pad(explode(':', (string) $value, 2), 2, null);

                    return $this->field($field).($detail !== null ? ": {$detail}" : '');
                }

                return $this->field((string) $key).": {$value}";
            })
            ->values()
            ->all();
    }

    private function field(string $field): string
    {
        return self::FIELDS[$field] ?? 'Alan ('.$this->readableCode($field).')';
    }

    private function readableCode(string $code): string
    {
        return str($code)->replace(['_', '-'], ' ')->squish()->toString() ?: 'bilinmiyor';
    }
}
