import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Button } from './ui/kit';

type Table = 'inventory' | 'loans' | 'appointments' | 'feedback';
type Entry = { id: string; name: string; filters: Record<string, string | number> };

export function SavedFilters({ table, current, onApply }: { table: Table; current: Record<string, string | number>; onApply: (filters: Record<string, string | number>) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<{ filters: Entry[] }>(`/org/preferences/saved-filters/${table}`).then(result => { if (active) { setEntries(result.filters); setError(''); } }).catch(cause => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [table]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await api<{ filters: Entry[]; savedId: string }>(`/org/preferences/saved-filters/${table}`, { method: 'POST', body: JSON.stringify({ name, filters: current }) });
      setEntries(result.filters); setSelected(result.savedId); setName(''); setError(''); setMessage('Filtre kaydedildi.');
    } catch (cause) { setError((cause as Error).message); setMessage(''); }
  };
  const remove = async () => {
    if (!selected) return;
    try {
      const result = await api<{ filters: Entry[] }>(`/org/preferences/saved-filters/${table}/${selected}`, { method: 'DELETE' });
      setEntries(result.filters); setSelected(''); setError(''); setMessage('Kayıtlı filtre silindi.');
    } catch (cause) { setError((cause as Error).message); setMessage(''); }
  };
  return <div className="saved-filters">
    <div className="saved-filter-actions"><label>Kayıtlı filtre<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">Seçin</option>{entries.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><Button variant="quiet" disabled={!selected} onClick={() => { const entry = entries.find(item => item.id === selected); if (entry) { onApply(entry.filters); setMessage(`${entry.name} uygulandı.`); } }}>Uygula</Button><Button variant="quiet" disabled={!selected} onClick={remove}>Sil</Button></div>
    <form className="saved-filter-actions" onSubmit={save}><label>Görünüm adı<input value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={40} placeholder="Bu filtreyi adlandırın" required/></label><Button type="submit">Filtreyi kaydet</Button></form>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
