import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

export type UndoNotice = {
    url: string;
    label: string;
    description: string;
    expiresAt: string;
};

export default function AdminUndoNotice({ notice }: { notice: UndoNotice }) {
    const [visible, setVisible] = useState(() => new Date(notice.expiresAt).getTime() > Date.now());
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        setVisible(new Date(notice.expiresAt).getTime() > Date.now());
        const remaining = new Date(notice.expiresAt).getTime() - Date.now();
        if (remaining <= 0) return;
        const timer = window.setTimeout(() => setVisible(false), remaining);

        return () => window.clearTimeout(timer);
    }, [notice.expiresAt, notice.url]);

    if (!visible) return null;

    return <div className="admin-undo-notice" role="status">
        <div><strong>Değişiklik kaydedildi</strong><span>{notice.description}</span></div>
        <button type="button" disabled={processing} onClick={() => {
            setProcessing(true);
            router.post(notice.url, {}, {
                preserveScroll: true,
                onError: () => setProcessing(false),
                onFinish: () => setProcessing(false),
            });
        }}>{processing ? 'Geri alınıyor…' : notice.label}</button>
    </div>;
}
