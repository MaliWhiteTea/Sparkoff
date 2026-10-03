import AdminLayout from '@/components/AdminLayout';
import { Head } from '@inertiajs/react';

type Log = { id: number; user: string; action: string; subject: string; subjectId: number | null; fields: string[]; createdAt: string };
const labels: Record<string, string> = { Announcement: 'Duyuru', BlackoutPeriod: 'Takvim kaydı', Filament: 'Filament', Printer: 'Yazıcı', Setting: 'Ayar' };

export default function ActivityLogs({ logs }: { logs: Log[] }) {
    return <AdminLayout><Head title="İşlem Geçmişi" /><header className="admin-title"><div><span className="booking-kicker">GÜVENLİK</span><h1>İşlem geçmişi</h1><p>Son 200 yönetici değişikliği. Alan değerleri ve parolalar kaydedilmez.</p></div></header><section className="activity-log-list">{logs.map((log) => <article className="admin-panel" key={log.id}><time>{log.createdAt}</time><div><strong>{log.user}</strong><span>{labels[log.subject] ?? log.subject} #{log.subjectId} · {log.action}</span>{log.fields.length > 0 && <small>Alanlar: {log.fields.join(', ')}</small>}</div></article>)}{logs.length === 0 && <div className="admin-panel settings-empty">Henüz kayıtlı yönetici işlemi yok.</div>}</section></AdminLayout>;
}
