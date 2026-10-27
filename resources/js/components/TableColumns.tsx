import { router } from '@inertiajs/react';
import { Dispatch, SetStateAction, useState } from 'react';

export type ColumnDefinition = { key: string; label: string };

export function initialTableColumns(stored: string[] | undefined, definitions: ColumnDefinition[]): string[] {
    const allowed = definitions.map((column) => column.key);
    const valid = stored?.filter((column) => allowed.includes(column));
    return valid?.length ? valid : allowed;
}

export default function TableColumns({ table, definitions, active, setActive, reorderable = true }: { table: string; definitions: ColumnDefinition[]; active: string[]; setActive: Dispatch<SetStateAction<string[]>>; reorderable?: boolean }) {
    const [saving, setSaving] = useState(false);
    const toggle = (key: string) => setActive((current) => current.includes(key) ? (current.length > 1 ? current.filter((column) => column !== key) : current) : [...current, key]);
    const move = (key: string, offset: number) => setActive((current) => {
        const from = current.indexOf(key); const to = from + offset;
        if (from < 0 || to < 0 || to >= current.length) return current;
        const next = [...current]; [next[from], next[to]] = [next[to], next[from]]; return next;
    });
    const save = () => {
        setSaving(true);
        router.put('/yonetim/ayarlar/kisisel/tablo', { table, columns: active }, { preserveScroll: true, onFinish: () => setSaving(false) });
    };

    return <details className="table-columns"><summary>{reorderable ? 'Sütunları düzenle' : 'Görünür alanları düzenle'}</summary><div><p>{reorderable ? 'Görünecek sütunları ve sıralarını' : 'Kartlarda görünecek alanları'} yalnız kendi hesabınız için belirleyin.</p>{definitions.map((column) => { const index = active.indexOf(column.key); const visible = index >= 0; return <article key={column.key}><label><input type="checkbox" checked={visible} disabled={visible && active.length === 1} onChange={() => toggle(column.key)} /> {column.label}</label>{reorderable && <div><button type="button" aria-label={`${column.label} sütununu sola taşı`} disabled={!visible || index === 0} onClick={() => move(column.key, -1)}>←</button><button type="button" aria-label={`${column.label} sütununu sağa taşı`} disabled={!visible || index === active.length - 1} onClick={() => move(column.key, 1)}>→</button></div>}</article>;})}<button className="settings-submit" type="button" disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Görünümü kaydet'}</button></div></details>;
}
