import AdminLayout from '@/components/AdminLayout';
import SettingsTabs from '@/components/SettingsTabs';
import { Head, router } from '@inertiajs/react';

export default function TestTools({ inventoryCount }: { inventoryCount: number }) {
    const purgeInventory = () => {
        if (!window.confirm(`${inventoryCount} malzemenin tamamı ve ilişkili stok/teslim kayıtları kalıcı olarak silinecek. Emin misiniz?`)) return;
        if (!window.confirm('Bu işlem geri alınamaz. Tüm malzemeleri silmek istediğinizi ikinci kez onaylıyor musunuz?')) return;
        router.delete('/yonetim/ayarlar/test-araclari/malzemeler', {
            data: { confirmation: 'TÜM MALZEMELERİ SİL' },
            preserveScroll: true,
        });
    };

    return <AdminLayout><Head title="Test Araçları" /><header className="admin-title"><div><span className="booking-kicker">ANA YÖNETİCİ</span><h1>Test araçları</h1><p>Yalnızca geliştirme ve test sırasında kullanılacak kalıcı veri temizleme işlemleri.</p></div></header><SettingsTabs />
        <section className="admin-panel danger-zone"><div><h2>Malzeme envanterini temizle</h2><p>Kategoriler ve konumlar korunur. Tüm malzemeler; bunlara bağlı stok hareketleri, teslim kayıtları ve medya dosyaları kalıcı olarak silinir.</p><strong>{inventoryCount} malzeme silinecek</strong></div><button type="button" disabled={inventoryCount === 0} onClick={purgeInventory}>Tüm malzemeleri kalıcı sil</button></section>
    </AdminLayout>;
}
