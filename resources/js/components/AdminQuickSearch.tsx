import { Link, router } from '@inertiajs/react';
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';

type SearchResult = { id: string; module: string; title: string; description: string; href: string; recordType: string; recordId: number };

export default function AdminQuickSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const groupedResults = useMemo(() => results.reduce<Map<string, SearchResult[]>>((groups, result) => {
        groups.set(result.module, [...(groups.get(result.module) ?? []), result]);
        return groups;
    }, new Map()), [results]);

    useEffect(() => {
        const shortcut = (event: globalThis.KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen((current) => !current);
            }
            if (event.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', shortcut);
        return () => window.removeEventListener('keydown', shortcut);
    }, []);

    useEffect(() => {
        if (open) return;
        setQuery('');
        setResults([]);
        setLoading(false);
        setFailed(false);
        setActiveIndex(0);
    }, [open]);

    useEffect(() => {
        const normalized = query.trim();
        if (!open || normalized.length < 2) {
            setResults([]);
            setLoading(false);
            setFailed(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setFailed(false);
            try {
                const response = await fetch(`/yonetim/hizli-arama?q=${encodeURIComponent(normalized)}`, {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error('Arama isteği başarısız oldu.');
                const payload = await response.json() as { results: SearchResult[] };
                setResults(payload.results);
                setActiveIndex(0);
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    setResults([]);
                    setFailed(true);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 250);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [open, query]);

    const openResult = (result: SearchResult) => {
        setOpen(false);
        router.post('/yonetim/son-goruntulenenler', { record_type: result.recordType, record_id: result.recordId });
    };
    const selectResult = () => {
        const result = results[activeIndex];
        if (result) openResult(result);
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === 'Enter' && results.length > 0) {
            event.preventDefault();
            selectResult();
        }
    };
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value);

    return <>
        <button className="admin-quick-search-trigger" type="button" onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
            <span>Modüllerde hızlı ara</span><kbd>Ctrl K</kbd>
        </button>
        {open && <div className="admin-search-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
            <section className="admin-search-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-search-title">
                <header>
                    <div><strong id="admin-search-title">Hızlı arama</strong><small>Yalnızca yetkili olduğunuz kayıtlar gösterilir.</small></div>
                    <button type="button" onClick={() => setOpen(false)} aria-label="Aramayı kapat">×</button>
                </header>
                <label className="admin-search-input">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
                    <span className="sr-only">Modüllerde ara</span>
                    <input autoFocus value={query} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="Malzeme, randevu, yazıcı, filament veya talep ara…" aria-controls="admin-search-results" aria-activedescendant={results[activeIndex] ? `quick-${results[activeIndex].id}` : undefined} />
                </label>
                <div className="admin-search-results" id="admin-search-results" aria-live="polite">
                    {query.trim().length < 2 && <p className="admin-search-state">Aramak için en az 2 karakter yazın.</p>}
                    {loading && <p className="admin-search-state">Aranıyor…</p>}
                    {failed && <p className="admin-search-state error">Arama şu anda tamamlanamadı. Tekrar deneyin.</p>}
                    {!loading && !failed && query.trim().length >= 2 && results.length === 0 && <p className="admin-search-state">Yetkiniz kapsamındaki modüllerde sonuç bulunamadı.</p>}
                    {!loading && [...groupedResults.entries()].map(([module, items]) => <section className="admin-search-group" key={module}>
                        <h2>{module}</h2>
                        {items.map((result) => {
                            const index = results.findIndex((item) => item.id === result.id);
                            return <Link id={`quick-${result.id}`} className={index === activeIndex ? 'active' : ''} href={result.href} onFocus={() => setActiveIndex(index)} onClick={(event) => { event.preventDefault(); openResult(result); }} key={result.id}>
                                <span><strong>{result.title}</strong><small>{result.description}</small></span><b aria-hidden="true">→</b>
                            </Link>;
                        })}
                    </section>)}
                </div>
                <footer><span>↑↓ Sonuç seç</span><span>Enter Aç</span><span>Esc Kapat</span></footer>
            </section>
        </div>}
    </>;
}
