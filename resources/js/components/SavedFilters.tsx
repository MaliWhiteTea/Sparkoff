import ConfirmDialog from '@/components/ConfirmDialog';
import { router, usePage } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

type SavedFilter = {
    id: string;
    name: string;
    filters: Record<string, string>;
};

type Props = {
    table: 'inventory' | 'loans' | 'appointments' | 'feedback';
    path: string;
    current: Record<string, string>;
};

export default function SavedFilters({ table, path, current }: Props) {
    const page = usePage<{ auth: { user: { savedFilters?: Record<string, SavedFilter[]> } } }>();
    const saved = page.props.auth.user.savedFilters?.[table] ?? [];
    const [selectedId, setSelectedId] = useState('');
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const selected = useMemo(() => saved.find((filter) => filter.id === selectedId), [saved, selectedId]);

    const apply = () => {
        if (selected) {
            router.get(path, selected.filters, {
                preserveScroll: true,
                preserveState: false,
                replace: true,
            });
        }
    };

    const save = (event: FormEvent) => {
        event.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        router.post('/yonetim/kisisel-filtreler', { table, name: name.trim(), filters: current }, {
            preserveScroll: true,
            onSuccess: () => setName(''),
            onFinish: () => setSaving(false),
        });
    };

    const remove = () => {
        if (!selected) return;
        setDeleting(true);
        router.delete(`/yonetim/kisisel-filtreler/${table}/${selected.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setSelectedId('');
                setConfirmingDelete(false);
            },
            onFinish: () => setDeleting(false),
        });
    };

    return <section className="saved-filters" aria-label="Kayıtlı filtre görünümleri">
        <div className="saved-filter-picker">
            <label><span>Kayıtlı filtre</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Bir görünüm seçin</option>{saved.map((filter) => <option value={filter.id} key={filter.id}>{filter.name}</option>)}</select></label>
            <button type="button" disabled={!selected} onClick={apply}>Uygula</button>
            <button type="button" disabled={!selected} onClick={() => setConfirmingDelete(true)}>Kaydı sil</button>
            <button type="button" onClick={() => router.get(path, {}, { preserveScroll: true, preserveState: false, replace: true })}>Varsayılana dön</button>
        </div>
        <form onSubmit={save}>
            <label><span>Geçerli filtreyi kaydet</span><input value={name} minLength={2} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Örn. Kritik stok" /></label>
            <button type="submit" disabled={saving || name.trim().length < 2}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
        </form>
        <ConfirmDialog
            open={confirmingDelete}
            eyebrow="KİŞİSEL FİLTRE"
            title="Kayıtlı filtre silinsin mi?"
            description={selected ? `“${selected.name}” yalnızca sizin hesabınızdan kaldırılacak.` : ''}
            confirmLabel="Filtreyi sil"
            tone="danger"
            processing={deleting}
            onClose={() => setConfirmingDelete(false)}
            onConfirm={remove}
        />
    </section>;
}
