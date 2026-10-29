import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

type Notification = {
    key: string;
    type: string;
    title: string;
    description: string;
    href: string;
    tone: 'info' | 'warning' | 'danger';
    createdAt: string;
    isRead: boolean;
};

export default function AdminNotifications({ unreadCount }: { unreadCount: number }) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Notification[]>([]);
    const [count, setCount] = useState(unreadCount);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => setCount(unreadCount), [unreadCount]);
    useEffect(() => {
        const close = (event: MouseEvent) => {
            if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', close);
        window.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', close);
            window.removeEventListener('keydown', escape);
        };
    }, []);
    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setLoading(true);
        setFailed(false);
        fetch('/yonetim/bildirimler', {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            signal: controller.signal,
        }).then((response) => {
            if (!response.ok) throw new Error('Bildirimler alınamadı.');
            return response.json() as Promise<{ notifications: Notification[]; unreadCount: number }>;
        }).then((payload) => {
            setItems(payload.notifications);
            setCount(payload.unreadCount);
        }).catch((error) => {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true);
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [open]);

    const openItem = (item: Notification) => {
        setOpen(false);
        if (item.isRead) {
            router.visit(item.href);
            return;
        }
        router.post('/yonetim/bildirimler/oku', { key: item.key }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setCount((current) => Math.max(0, current - 1));
                setItems((current) => current.map((notification) => notification.key === item.key ? { ...notification, isRead: true } : notification));
                router.visit(item.href);
            },
        });
    };
    const markAllRead = () => router.post('/yonetim/bildirimler/tumunu-oku', {}, {
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => {
            setCount(0);
            setItems((current) => current.map((item) => ({ ...item, isRead: true })));
        },
    });

    return <div className="admin-notifications" ref={container}>
        <button className="admin-notification-trigger" type="button" aria-label={`Sistem bildirimleri${count ? `, ${count} okunmamış` : ''}`} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" /><path d="M9.5 21h5" /></svg>
            {count > 0 && <b>{count > 99 ? '99+' : count}</b>}
        </button>
        {open && <section className="admin-notification-panel" aria-label="Sistem bildirimleri">
            <header><div><strong>Bildirimler</strong><small>Yetkiniz kapsamındaki güncel uyarılar</small></div>{count > 0 && <button type="button" onClick={markAllRead}>Tümünü okundu işaretle</button>}</header>
            <div className="admin-notification-list">
                {loading && <p>Bildirimler yükleniyor…</p>}
                {failed && <p className="error">Bildirimler şu anda alınamadı.</p>}
                {!loading && !failed && items.length === 0 && <p>Şu anda işlem gerektiren bir sistem bildirimi yok.</p>}
                {!loading && !failed && items.map((item) => <button className={`${item.isRead ? 'read' : 'unread'} tone-${item.tone}`} type="button" onClick={() => openItem(item)} key={item.key}>
                    <i aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.description}</small><time>{item.createdAt}</time></span><b aria-hidden="true">→</b>
                </button>)}
            </div>
        </section>}
    </div>;
}
