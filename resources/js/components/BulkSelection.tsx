import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';

export type SelectionId = number | string;

export function usePageSelection(visibleIds: SelectionId[]) {
    const [selectedIds, setSelectedIds] = useState<SelectionId[]>([]);
    const visibleKey = visibleIds.map((id) => `${typeof id}:${id}`).join('|');
    const visible = useMemo(() => new Set(visibleIds), [visibleKey]);
    const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

    useEffect(() => {
        setSelectedIds((current) => current.filter((id) => visible.has(id)));
    }, [visible]);

    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
    const partiallySelected = !allSelected && visibleIds.some((id) => selected.has(id));
    const toggle = (id: SelectionId) => setSelectedIds((current) => current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : visible.has(id) ? [...current, id] : current);
    const setSelected = (id: SelectionId, checked: boolean) => setSelectedIds((current) => checked
        ? current.includes(id) || !visible.has(id) ? current : [...current, id]
        : current.filter((selectedId) => selectedId !== id));
    const togglePage = () => setSelectedIds(allSelected ? [] : [...visibleIds]);
    const clear = () => setSelectedIds([]);

    return {
        selectedIds,
        selected,
        selectedCount: selectedIds.length,
        pageCount: visibleIds.length,
        allSelected,
        partiallySelected,
        toggle,
        setSelected,
        togglePage,
        clear,
    };
}

export function SelectionCheckbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
    return <label className="record-selection" title={label}>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="sr-only">{label}</span>
    </label>;
}

export default function BulkSelection({
    selectedCount,
    pageCount,
    allSelected,
    partiallySelected,
    onTogglePage,
    onClear,
    children,
}: {
    selectedCount: number;
    pageCount: number;
    allSelected: boolean;
    partiallySelected: boolean;
    onTogglePage: () => void;
    onClear: () => void;
    children?: ReactNode;
}) {
    const selectAllRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = partiallySelected;
    }, [partiallySelected]);

    return <section className={`bulk-selection ${selectedCount > 0 ? 'has-selection' : ''}`} aria-label="Toplu kayıt seçimi">
        <label className="bulk-selection-all">
            <input ref={selectAllRef} type="checkbox" checked={allSelected} disabled={pageCount === 0} onChange={onTogglePage} />
            <span>Bu sayfadakileri seç</span>
        </label>
        <p aria-live="polite"><strong>{selectedCount}</strong> kayıt seçildi</p>
        {children && <div className="bulk-selection-actions">{children}</div>}
        <button type="button" disabled={selectedCount === 0} onClick={onClear}>Seçimi temizle</button>
    </section>;
}
