import AdminLayout from '@/components/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';

type CalendarAppointment = {
    publicId: string; name: string; printer: string; status: string; statusLabel: string;
    startTime: string; endTime: string; continuesFromPrevious: boolean; continuesNext: boolean;
};
type CalendarDay = { date: string; weekday: string; dayLabel: string; isToday: boolean; appointments: CalendarAppointment[] };
type Props = { view: 'week' | 'day'; referenceDate: string; rangeLabel: string; previousDate: string; nextDate: string; today: string; days: CalendarDay[] };

export default function AdminCalendar({ view, referenceDate, rangeLabel, previousDate, nextDate, today, days }: Props) {
    function navigate(date: string, nextView = view) {
        router.get('/yonetim/takvim', { date, view: nextView }, { preserveState: true, replace: true });
    }

    return (
        <AdminLayout>
            <Head title="Randevu Takvimi" />
            <header className="admin-title calendar-title"><div><span className="booking-kicker">ATÖLYE PLANI</span><h1>Takvim</h1><p>Baskıların günlük ve haftalık çalışma planı.</p></div><div className="calendar-view-switch"><button className={view === 'day' ? 'active' : ''} onClick={() => navigate(referenceDate, 'day')}>Gün</button><button className={view === 'week' ? 'active' : ''} onClick={() => navigate(referenceDate, 'week')}>Hafta</button></div></header>
            <section className="calendar-toolbar admin-panel"><button onClick={() => navigate(previousDate)} aria-label="Önceki dönem">←</button><button className="calendar-today" onClick={() => navigate(today)}>Bugün</button><strong>{rangeLabel}</strong><button onClick={() => navigate(nextDate)} aria-label="Sonraki dönem">→</button></section>
            <section className={`admin-calendar ${view}`}>
                {days.map((day) => <article className={`calendar-day ${day.isToday ? 'today' : ''}`} key={day.date}>
                    <header><span>{day.weekday}</span><strong>{day.dayLabel}</strong>{day.isToday && <small>BUGÜN</small>}</header>
                    <div className="calendar-day-body">
                        {day.appointments.map((appointment) => <Link className={`calendar-event status-${appointment.status}`} href={`/yonetim/randevular/${appointment.publicId}`} key={`${day.date}-${appointment.publicId}`}>
                            <div><strong>{appointment.startTime}–{appointment.endTime}</strong><span className={`admin-status status-${appointment.status}`}>{appointment.statusLabel}</span></div>
                            <h2>{appointment.name}</h2><p>{appointment.printer}</p>
                            {(appointment.continuesFromPrevious || appointment.continuesNext) && <small>{appointment.continuesFromPrevious ? 'Önceki günden devam ediyor' : 'Sonraki güne devam ediyor'}</small>}
                        </Link>)}
                        {day.appointments.length === 0 && <div className="calendar-empty">Planlanmış baskı yok</div>}
                    </div>
                </article>)}
            </section>
        </AdminLayout>
    );
}
