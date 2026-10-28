import AdminLayout from '@/components/AdminLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import SettingsTabs from '@/components/SettingsTabs';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

export default function TestTools({ inventoryCount }: { inventoryCount: number }) {
    const [confirmationStep, setConfirmationStep] = useState<0 | 1 | 2>(0);
    const [confirmationText, setConfirmationText] = useState('');
    const [deleting, setDeleting] = useState(false);
    const closeConfirmation = () => {
        setConfirmationStep(0);
        setConfirmationText('');
    };

    const purgeInventory = () => {
        setDeleting(true);
        router.delete('/yonetim/ayarlar/test-araclari/malzemeler', {
            data: { confirmation: 'TÜM MALZEMELERİ SİL' },
            preserveScroll: true,
            onFinish: () => {
                setDeleting(false);
                closeConfirmation();
            },
        });
    };

    return <AdminLayout><Head title="Test Araçları" /><header className="admin-title"><div><span className="booking-kicker">ANA YÖNETİCİ</span><h1>Test araçları</h1><p>Yalnızca geliştirme ve test sırasında kullanılacak kalıcı veri temizleme işlemleri.</p></div></header><SettingsTabs />
        <section className="admin-panel danger-zone"><div><h2>Malzeme envanterini temizle</h2><p>Kategoriler ve konumlar korunur. Tüm malzemeler; bunlara bağlı stok hareketleri, teslim kayıtları ve medya dosyaları kalıcı olarak silinir.</p><strong>{inventoryCount} malzeme silinecek</strong></div><button type="button" disabled={inventoryCount === 0} onClick={() => setConfirmationStep(1)}>Tüm malzemeleri kalıcı sil</button></section>
        <ConfirmDialog key={confirmationStep} open={confirmationStep === 1} eyebrow="1/2 ONAY" title="Malzeme envanteri silinsin mi?" description={`${inventoryCount} malzemenin tamamı; ilişkili stok hareketleri, teslim kayıtları ve medya dosyalarıyla birlikte silinecek.`} confirmLabel="Devam et" tone="danger" onClose={closeConfirmation} onConfirm={() => setConfirmationStep(2)} />
        <ConfirmDialog key={`final-${confirmationStep}`} open={confirmationStep === 2} eyebrow="2/2 ONAY" title="Kalıcı silmeyi doğrulayın" description="Bu işlem geri alınamaz. Kategori ve konum tanımları korunacak, ancak silinen malzeme ve işlem kayıtları kurtarılamayacak." confirmLabel="Evet, kalıcı olarak sil" tone="danger" processing={deleting} confirmDisabled={confirmationText !== 'TÜM MALZEMELERİ SİL'} onClose={closeConfirmation} onConfirm={purgeInventory}>
            <label className="site-confirm-field"><span>Devam etmek için <strong>TÜM MALZEMELERİ SİL</strong> yazın.</span><input data-dialog-initial-focus value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} autoComplete="off" /></label>
        </ConfirmDialog>
    </AdminLayout>;
}
