type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const tones: Record<string, Tone> = {
    active: 'success', available: 'success', approved: 'success', ready: 'success', completed: 'success', resolved: 'success', open: 'success',
    new: 'info', busy: 'info', printing: 'info',
    pending: 'warning', pending_approval: 'warning', reviewing: 'warning', low: 'warning', maintenance: 'warning', overdue: 'warning',
    inactive: 'neutral', archived: 'neutral', closed: 'neutral',
    rejected: 'danger', canceled: 'danger', expired: 'danger', failed: 'danger', damaged: 'danger', lost: 'danger', out: 'danger',
};

export default function StatusBadge({ status, label, tone }: { status: string; label: string; tone?: Tone }) {
    const resolvedTone = tone ?? tones[status] ?? 'neutral';

    return <span className={`status-badge tone-${resolvedTone}`} data-status={status}><i aria-hidden="true" />{label}</span>;
}
