import AdminLayout from '@/components/AdminLayout';
import { Head } from '@inertiajs/react';

type Log = { id: number; user: string; action: string; subject: string; subjectId: number | null; fields: string[]; createdAt: string };

export default function ActivityLogs({ logs }: { logs: Log[] }) {
    return <AdminLayout><Head title="İşlem Geçmişi" /><header className="admin-title"><div><span className="booking-kicker">GÜVENLİK</span><h1>İşlem geçmişi</h1><p>Son 200 yönetici değişikliği. Parolalar ve hassas alan değerleri kaydedilmez.</p></div></header><section className="activity-log-list">{logs.map((log) => <article className="admin-panel" key={log.id}><time>{log.createdAt}</time><div><strong>{log.user}</strong><span>{log.subject}{log.subjectId !== null && ` #${log.subjectId}`} · {log.action}</span>{log.fields.length > 0 && <small>Ayrıntılar: {log.fields.join(', ')}</small>}</div></article>)}{logs.length === 0 && <div className="admin-panel settings-empty">Henüz kayıtlı yönetici işlemi yok.</div>}</section></AdminLayout>;
}
