<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Admin/ActivityLogs', [
            'logs' => ActivityLog::query()->with('user:id,name,email')->latest('id')->limit(200)->get()->map(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user' => $log->user?->name ?? 'Silinmiş yönetici',
                'action' => match ($log->action) {
                    'created' => 'Oluşturdu',
                    'updated' => 'Güncelledi',
                    'deleted' => 'Sildi',
                    'acknowledged' => 'Okuduğunu onayladı',
                    'inventory_imported' => 'Envanteri CSV dosyasından içe aktardı',
                    'inventory_test_data_purged' => 'Test malzemelerini kalıcı olarak temizledi',
                    default => str($log->action)->replace('_', ' ')->title()->toString(),
                },
                'subject' => class_basename($log->subject_type),
                'subjectId' => $log->subject_id,
                'fields' => $this->formatFields($log->changed_fields ?? []),
                'createdAt' => $log->created_at->translatedFormat('d F Y, H:i:s'),
            ]),
        ]);
    }

    private function formatFields(array $fields): array
    {
        $labels = [
            'category_id' => 'Kategori', 'closed_by' => 'Kapatan kullanıcı', 'completed_at' => 'Tamamlanma zamanı',
            'created_count' => 'Eklenen malzeme', 'description' => 'Açıklama', 'due_at' => 'Beklenen iade',
            'id' => 'Kayıt numarası', 'interface_preferences' => 'Arayüz tercihleri', 'inventory_item_id' => 'Malzeme',
            'is_active' => 'Aktiflik', 'issued_at' => 'Teslim zamanı', 'issued_by' => 'Teslim eden',
            'item_type' => 'Malzeme türü', 'items' => 'Silinen malzeme', 'location_id' => 'Konum',
            'minimum_stock' => 'Minimum stok', 'movements' => 'Silinen stok hareketi', 'name' => 'Ad',
            'notes' => 'Notlar', 'public_visibility' => 'Katalog görünürlüğü', 'quantity' => 'Miktar',
            'quantity_returned' => 'İade edilen miktar', 'recipient_email' => 'Alıcı e-postası',
            'recipient_name' => 'Alıcı adı', 'roles' => 'Roller', 'sku' => 'Stok kodu',
            'slug' => 'Adres adı', 'source_file' => 'Kaynak dosya', 'status' => 'Durum',
            'transactions' => 'Silinen teslim kaydı', 'unit' => 'Birim',
        ];

        return collect($fields)->map(function ($value, $key) use ($labels) {
            if (is_int($key)) {
                [$field, $detail] = array_pad(explode(':', (string) $value, 2), 2, null);

                return ($labels[$field] ?? str($field)->replace('_', ' ')->title()).($detail !== null ? ": {$detail}" : '');
            }

            $label = $labels[$key] ?? str((string) $key)->replace('_', ' ')->title();

            return "{$label}: {$value}";
        })->values()->all();
    }
}
