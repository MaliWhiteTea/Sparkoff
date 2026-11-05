import PublicFooter from '@/components/PublicFooter';
import PublicHeader from '@/components/PublicHeader';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';

type Medium = {
    id: number;
    type: 'image' | 'video' | 'link';
    url: string;
    title: string | null;
    altText: string | null;
    isCover: boolean;
};

type Item = {
    id: number;
    name: string;
    sku: string | null;
    brand: string | null;
    model: string | null;
    category: string;
    location: string | null;
    type: 'consumable' | 'loanable' | 'fixed_asset';
    unit: string;
    description: string | null;
    technicalSpecs: Record<string, string | number>;
    updatedAt: string | null;
    availability: 'available' | 'out';
    quantity: string | null;
    media: Medium[];
};

type PageLink = { url: string | null; label: string; active: boolean };
type Filters = {
    search: string;
    category: string;
    stock: 'all' | 'available' | 'out';
    sort: 'name_asc' | 'name_desc' | 'updated_desc';
    perPage: 12 | 24 | 48;
    favorites: boolean;
};
type Props = {
    items: { data: Item[]; links: PageLink[]; total: number };
    filters: Filters;
    categories: { id: number; name: string }[];
};

const typeLabels = {
    consumable: 'Sarf malzemesi',
    loanable: 'Ödünç verilebilir',
    fixed_asset: 'Demirbaş',
};
const favoriteStorageKey = 'sparkoff:material-favorites:v1';

const paginationLabel = (label: string) => {
    if (label === 'pagination.previous' || label.includes('Previous')) return 'Önceki';
    if (label === 'pagination.next' || label.includes('Next')) return 'Sonraki';

    return label;
};

function MaterialImage({ medium, className }: { medium: Medium; className?: string }) {
    const [failed, setFailed] = useState(false);

    return failed
        ? <span className={`material-image-fallback ${className ?? ''}`} role="img" aria-label={`${medium.altText ?? 'Malzeme görseli'} yüklenemedi`}>Görsel yüklenemedi</span>
        : <img className={className} src={medium.url} alt={medium.altText ?? ''} loading="lazy" onError={() => setFailed(true)} />;
}

export default function Materials({ items, filters, categories }: Props) {
    const [search, setSearch] = useState(filters.search);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
    const [favoritesReady, setFavoritesReady] = useState(false);

    useEffect(() => setSearch(filters.search), [filters.search]);
    useEffect(() => {
        try {
            const stored = JSON.parse(window.localStorage.getItem(favoriteStorageKey) ?? '[]');
            if (Array.isArray(stored)) {
                setFavoriteIds([...new Set(stored.filter((id): id is number => Number.isSafeInteger(id) && id > 0))].slice(0, 100));
            }
        } catch {
            window.localStorage.removeItem(favoriteStorageKey);
        } finally {
            setFavoritesReady(true);
        }
    }, []);

    const apply = (changes: Partial<Filters>, closePanel = false, favoriteOverride = favoriteIds) => {
        const next = { ...filters, search: search.trim(), ...changes };
        const query: Record<string, string | number> = {};

        if (next.search) query.search = next.search;
        if (next.category) query.category = next.category;
        if (next.stock !== 'all') query.stock = next.stock;
        if (next.sort !== 'name_asc') query.sort = next.sort;
        if (next.perPage !== 24) query.per_page = next.perPage;
        if (next.favorites) {
            query.favorites = 1;
            if (favoriteOverride.length > 0) query.favorite_ids = favoriteOverride.join(',');
        }
        if (closePanel) setFiltersOpen(false);

        router.get('/malzemeler', query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        apply({ search }, true);
    };
    const toggleFavorite = (id: number) => {
        const next = favoriteIds.includes(id) ? favoriteIds.filter((favoriteId) => favoriteId !== id) : [...favoriteIds, id].slice(0, 100);
        setFavoriteIds(next);
        try {
            window.localStorage.setItem(favoriteStorageKey, JSON.stringify(next));
        } catch {
            // Favoriler depolama kapalı olsa da mevcut sekmede kullanılabilir.
        }
        if (filters.favorites) apply({ favorites: next.length > 0 }, false, next);
    };
    const activeFilterCount = [filters.search !== '', filters.category !== '', filters.stock !== 'all', filters.favorites].filter(Boolean).length;
    const hasCustomView = activeFilterCount > 0 || filters.sort !== 'name_asc' || filters.perPage !== 24;

    return <main className="materials-page public-page-shell">
        <Head title="Atölye Malzemeleri" />
        <PublicHeader />
        <section className="materials-hero">
            <span>ATÖLYE ENVANTERİ</span>
            <h1>Malzemeler</h1>
            <p>Atölyedeki ekipmanların güncel stok ve kullanım durumunu inceleyin.</p>
        </section>
        <section className="materials-content">
            <div className="materials-filter-toolbar">
                <button
                    className="materials-filter-toggle"
                    type="button"
                    aria-controls="materials-filter-panel"
                    aria-expanded={filtersOpen}
                    onClick={() => setFiltersOpen((open) => !open)}
                >
                    Filtreler{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </button>
                <button
                    className={`materials-stock-toggle ${filters.stock === 'available' ? 'active' : ''}`}
                    type="button"
                    aria-pressed={filters.stock === 'available'}
                    onClick={() => apply({ stock: filters.stock === 'available' ? 'all' : 'available' })}
                >
                    <span aria-hidden="true">✓</span> Yalnız stokta olanlar
                </button>
                <button
                    className={`materials-favorites-toggle ${filters.favorites ? 'active' : ''}`}
                    type="button"
                    aria-pressed={filters.favorites}
                    disabled={!favoritesReady || (favoriteIds.length === 0 && !filters.favorites)}
                    onClick={() => apply({ favorites: !filters.favorites })}
                >
                    <span aria-hidden="true">★</span> Favorilerim ({favoriteIds.length})
                </button>
            </div>

            <form id="materials-filter-panel" className={`materials-filters ${filtersOpen ? 'is-open' : ''}`} onSubmit={submit}>
                <label className="materials-filter-search">
                    <span>Ara</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad, marka, model veya stok kodu…" />
                </label>
                <label>
                    <span>Kategori</span>
                    <select value={filters.category} onChange={(event) => apply({ category: event.target.value })}>
                        <option value="">Tüm kategoriler</option>
                        {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                    </select>
                </label>
                <label>
                    <span>Stok durumu</span>
                    <select value={filters.stock} onChange={(event) => apply({ stock: event.target.value as Filters['stock'] })}>
                        <option value="all">Tümü</option>
                        <option value="available">Stokta var</option>
                        <option value="out">Stokta yok</option>
                    </select>
                </label>
                <label>
                    <span>Sırala</span>
                    <select value={filters.sort} onChange={(event) => apply({ sort: event.target.value as Filters['sort'] })}>
                        <option value="name_asc">Ada göre A–Z</option>
                        <option value="name_desc">Ada göre Z–A</option>
                        <option value="updated_desc">Son güncellenen</option>
                    </select>
                </label>
                <label>
                    <span>Sayfa başına</span>
                    <select value={filters.perPage} onChange={(event) => apply({ perPage: Number(event.target.value) as Filters['perPage'] })}>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                    </select>
                </label>
                <button type="submit">Ara</button>
            </form>

            <div className="materials-result-heading" aria-live="polite">
                <strong>{items.total} malzeme</strong>
                {hasCustomView && <Link href="/malzemeler" replace>Filtreleri ve görünümü temizle</Link>}
            </div>

            {items.data.length > 0
                ? <div className="materials-table-wrap">
                    <table className="materials-table">
                        <thead><tr><th>Malzeme</th><th>Kategori</th><th>Tür</th><th>Konum</th><th>Stok</th></tr></thead>
                        <tbody>{items.data.map((item) => {
                            const cover = item.media.find((medium) => medium.type === 'image' && medium.isCover)
                                ?? item.media.find((medium) => medium.type === 'image');

                            return <tr key={item.id}>
                                <td data-label="Malzeme">
                                    <div className="material-title">
                                        {cover && <MaterialImage medium={cover} />}
                                        <div>
                                            <strong>{item.name}</strong>
                                            {(item.brand || item.model) && <small className="material-brand-model">{[item.brand, item.model].filter(Boolean).join(' · ')}</small>}
                                        </div>
                                        <button
                                            className={`material-favorite ${favoriteIds.includes(item.id) ? 'active' : ''}`}
                                            type="button"
                                            aria-pressed={favoriteIds.includes(item.id)}
                                            aria-label={favoriteIds.includes(item.id) ? `${item.name} malzemesini favorilerden çıkar` : `${item.name} malzemesini favorilere ekle`}
                                            onClick={() => toggleFavorite(item.id)}
                                        >
                                            <span aria-hidden="true">{favoriteIds.includes(item.id) ? '★' : '☆'}</span>
                                        </button>
                                    </div>
                                    {item.description && <p>{item.description}</p>}
                                    {item.updatedAt && <small className="material-updated-at">Son güncelleme: {item.updatedAt}</small>}
                                    {Object.keys(item.technicalSpecs).length > 0 && <details>
                                        <summary>Teknik özellikler ({Object.keys(item.technicalSpecs).length})</summary>
                                        <dl className="material-specs">{Object.entries(item.technicalSpecs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
                                    </details>}
                                    {item.media.length > 0 && <details className="material-media">
                                        <summary>Fotoğraf, video ve bağlantılar ({item.media.length})</summary>
                                        <div>{item.media.map((medium) => <article key={medium.id}>
                                            {medium.type === 'image'
                                                ? <MaterialImage medium={medium} />
                                                : medium.type === 'video'
                                                    ? <video src={medium.url} controls preload="metadata" aria-label={medium.title ?? `${item.name} videosu`} />
                                                    : <a href={medium.url} target="_blank" rel="noopener noreferrer">{medium.title || 'İlgili bağlantıyı aç'} ↗</a>}
                                            {medium.title && medium.type !== 'link' && <small>{medium.title}</small>}
                                        </article>)}</div>
                                    </details>}
                                </td>
                                <td data-label="Kategori">{item.category}</td>
                                <td data-label="Tür">{typeLabels[item.type]}</td>
                                <td data-label="Konum">{item.location ?? '—'}</td>
                                <td data-label="Stok"><div className="material-stock-cell">
                                    <span className={`material-stock ${item.availability}`}>{item.availability === 'available' ? 'Stokta var' : 'Stokta yok'}</span>
                                    {item.quantity !== null
                                        ? <strong className="material-quantity">{Number(item.quantity).toLocaleString('tr-TR')} {item.unit}</strong>
                                        : <small>Miktar belirtilmiyor</small>}
                                </div></td>
                            </tr>;
                        })}</tbody>
                    </table>
                </div>
                : <div className="materials-empty"><h2>Malzeme bulunamadı</h2><p>Arama veya filtreleri değiştirerek tekrar deneyin.</p></div>}

            {items.links.length > 3 && <nav className="materials-pagination" aria-label="Sayfalar">
                {items.links.map((link, index) => !link.url && (index === 0 || index === items.links.length - 1)
                    ? null
                    : link.url
                        ? <Link href={link.url} className={link.active ? 'active' : ''} preserveScroll preserveState key={index}>{paginationLabel(link.label)}</Link>
                        : <span key={index}>{paginationLabel(link.label)}</span>)}
            </nav>}
        </section>
        <PublicFooter />
    </main>;
}
