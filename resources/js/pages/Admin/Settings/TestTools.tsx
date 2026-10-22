import AdminLayout from '@/components/AdminLayout';
import SettingsTabs from '@/components/SettingsTabs';
import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export default function TestTools({ inventoryCount }: { inventoryCount: number }) {
    const [confirmationStep, setConfirmationStep] = useState<0 | 1 | 2>(0);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!confirmationStep) return;
        const close = (event: KeyboardEvent) => event.key === 'Escape' && setConfirmationStep(0);
        document.addEventListener('keydown', close);
        return () => document.removeEventListener('keydown', close);
    }, [confirmationStep]);

    const purgeInventory = () => {
        setDeleting(true);
        router.delete('/yonetim/ayarlar/test-araclari/malzemeler', {
            data: { confirmation: 'TÜM MALZEMELERİ SİL' },
            preserveScroll: true,
            onFinish: () => {
                setDeleting(false);
                setConfirmationStep(0);
            },
        });
    };

    return <AdminLayout><Head title="Test Araçları" /><header className="admin-title"><div><span className="booking-kicker">ANA YÖNETİCİ</span><h1>Test araçları</h1><p>Yalnızca geliştirme ve test sırasında kullanılacak kalıcı veri temizleme işlemleri.</p></div></header><SettingsTabs />
        <section className="admin-panel danger-zone"><div><h2>Malzeme envanterini temizle</h2><p>Kategoriler ve konumlar korunur. Tüm malzemeler; bunlara bağlı stok hareketleri, teslim kayıtları ve medya dosyaları kalıcı olarak silinir.</p><strong>{inventoryCount} malzeme silinecek</strong></div><button type="button" disabled={inventoryCount === 0} onClick={() => setConfirmationStep(1)}>Tüm malzemeleri kalıcı sil</button></section>
        {confirmationStep > 0 && <div className="site-confirm-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmationStep(0)}><section className="site-confirm" role="dialog" aria-modal="true" aria-labelledby="purge-confirm-title" aria-describedby="purge-confirm-description"><span>{confirmationStep}/2 ONAY</span><h2 id="purge-confirm-title">{confirmationStep === 1 ? 'Malzeme envanteri silinsin mi?' : 'Son kez onaylayın'}</h2><p id="purge-confirm-description">{confirmationStep === 1 ? `${inventoryCount} malzemenin tamamı; ilişkili stok hareketleri, teslim kayıtları ve medya dosyalarıyla birlikte silinecek.` : 'Bu işlem geri alınamaz. Kategori ve konum tanımları korunacak, ancak silinen malzeme ve işlem kayıtları kurtarılamayacak.'}</p><div className="site-confirm-actions"><button type="button" className="secondary" disabled={deleting} onClick={() => setConfirmationStep(0)}>Vazgeç</button>{confirmationStep === 1 ? <button type="button" className="danger" autoFocus onClick={() => setConfirmationStep(2)}>Devam et</button> : <button type="button" className="danger" autoFocus disabled={deleting} onClick={purgeInventory}>{deleting ? 'Siliniyor…' : 'Evet, kalıcı olarak sil'}</button>}</div></section></div>}
    </AdminLayout>;
}
