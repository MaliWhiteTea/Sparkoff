import { useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { Button } from './ui/kit';

type Table = 'inventory' | 'loans' | 'appointments' | 'feedback' | 'users';
type Definition = { key: string; label: string };

export function useTableColumns(table: Table, definitions: Definition[], enabled = true, reorderable = false): { columns: string[]; visible: (key: string) => boolean; controls: ReactNode } {
  const defaults = definitions.map(column => column.key);
  const [columns, setColumns] = useState<string[]>(defaults);
  const [allowed, setAllowed] = useState<string[]>(defaults);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const key = defaults.join(',');
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    api<{ columns: string[]; allowed: string[] }>(`/org/preferences/table-columns/${table}`).then(result => { if (active) { setAllowed(result.allowed); setColumns(result.columns); setError(''); } }).catch(cause => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [table, enabled, key]);
  const toggle = (name: string) => setColumns(current => current.includes(name) ? current.length > 1 ? current.filter(column => column !== name) : current : [...current, name]);
  const move = (name: string, offset: number) => setColumns(current => { const from = current.indexOf(name); const to = from + offset; if (from < 0 || to < 0 || to >= current.length) return current; const next = [...current]; [next[from], next[to]] = [next[to], next[from]]; return next; });
  const save = async () => {
    setSaving(true); setMessage(''); setError('');
    try { const result = await api<{ columns: string[] }>(`/org/preferences/table-columns/${table}`, { method: 'PUT', body: JSON.stringify({ columns }) }); setColumns(result.columns); setMessage('Görünür alanlar kaydedildi.'); }
    catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  };
  const controls = enabled ? <details className="table-columns"><summary>{reorderable ? 'Alanları ve sırasını düzenle' : 'Görünür alanları düzenle'}</summary><div className="table-columns-body"><p>Alan seçimi yalnız kendi hesabınıza uygulanır.</p><div className="table-column-options">{definitions.filter(definition => allowed.includes(definition.key)).map(definition => { const index = columns.indexOf(definition.key); return <div className="table-column-option" key={definition.key}><label><input type="checkbox" checked={index >= 0} disabled={columns.length === 1 && index >= 0} onChange={() => toggle(definition.key)}/>{definition.label}</label>{reorderable && <div><button type="button" aria-label={`${definition.label} alanını önceye taşı`} disabled={index <= 0} onClick={() => move(definition.key, -1)}>←</button><button type="button" aria-label={`${definition.label} alanını sonraya taşı`} disabled={index < 0 || index === columns.length - 1} onClick={() => move(definition.key, 1)}>→</button></div>}</div>; })}</div><Button onClick={save} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Görünümü kaydet'}</Button>{message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}</div></details> : null;
  return { columns, visible: name => columns.includes(name), controls };
}
