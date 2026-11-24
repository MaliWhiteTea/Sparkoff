import { useEffect, useState } from 'react';
import { api } from './api';
import { Badge, Button, Card, Empty, Screen, formatQuantity } from './ui/kit';

type Medium = { id: number; type: string; url: string; title: string | null; altText: string | null; isCover: boolean };
type Material = { id: number; legacyMaterialId: number | null; name: string; sku: string | null; brand: string | null; model: string | null; categoryId: number | null; category: string; categoryActive: boolean | null; location: string | null; kind: string; unit: string; description: string | null; technicalSpecs: Record<string, string | number>; updatedAt: string | null; availability: 'available' | 'out'; quantity: string | null; media: Medium[] };
type Filters = { search: string; category: number; stock: 'all' | 'available' | 'out'; sort: 'name_asc' | 'name_desc' | 'updated_desc'; perPage: 12 | 24 | 48; favorites: boolean; page: number };
const storageKey = 'sparkoff:material-favorites:v2';
const sourceStorageKey = 'sparkoff:material-favorites:v1';
const defaults: Filters = { search: '', category: 0, stock: 'all', sort: 'name_asc', perPage: 24, favorites: false, page: 1 };
const validIds = (value: unknown): number[] => Array.isArray(value) ? [...new Set(value.filter((id): id is number => Number.isSafeInteger(id) && id > 0))].slice(0, 100) : [];
function CatalogImage({ medium, name }: { medium: Medium; name: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="catalog-image-fallback" role="img" aria-label={`${medium.altText || name} görseli yüklenemedi`}>Görsel yüklenemedi</span> : <img className="material-cover" src={medium.url} alt={medium.altText || name} loading="lazy" onError={() => setFailed(true)}/>;
}
function initialFilters(): Filters {
  const q = new URLSearchParams(location.search);
  const stock = q.get('stock'); const sort = q.get('sort'); const perPage = Number(q.get('per_page')); const page = Number(q.get('page'));
  return { search: (q.get('search') || '').slice(0, 100), category: Number(q.get('category')) > 0 ? Number(q.get('category')) : 0, stock: stock === 'available' || stock === 'out' ? stock : 'all', sort: sort === 'name_desc' || sort === 'updated_desc' ? sort : 'name_asc', perPage: perPage === 12 || perPage === 48 ? perPage : 24, favorites: q.get('favorites') === '1', page: Number.isSafeInteger(page) && page > 0 ? page : 1 };
}
function syncQuery(filters: Filters) {
  const q = new URLSearchParams();
  if (filters.search) q.set('search', filters.search);
  if (filters.category) q.set('category', String(filters.category));
  if (filters.stock !== 'all') q.set('stock', filters.stock);
  if (filters.sort !== 'name_asc') q.set('sort', filters.sort);
  if (filters.perPage !== 24) q.set('per_page', String(filters.perPage));
  if (filters.favorites) q.set('favorites', '1');
  if (filters.page > 1) q.set('page', String(filters.page));
  history.replaceState(history.state, '', `/malzemeler${q.size ? `?${q}` : ''}`);
}
export function PublicMaterials() {
  const [items, setItems] = useState<Material[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [searchDraft, setSearchDraft] = useState(() => initialFilters().search);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  useEffect(() => { const restore = () => { const next = initialFilters(); setFilters(next); setSearchDraft(next.search); }; window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore); }, []);
  useEffect(() => {
    let active = true;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) { setFavorites(validIds(JSON.parse(stored))); setFavoritesReady(true); return; }
      const legacy = validIds(JSON.parse(localStorage.getItem(sourceStorageKey) || '[]'));
      if (!legacy.length) { setFavoritesReady(true); return; }
      api<{ map: { id: number; legacyId: number }[] }>(`/public/materials/legacy-map?ids=${legacy.join(',')}`).then(result => {
        if (!active) return;
        const selected = validIds(result.map.map(item => item.id));
        setFavorites(selected);
        try { localStorage.setItem(storageKey, JSON.stringify(selected)); } catch { /* Bu sekmedeki seçim korunur. */ }
        setFavoritesReady(true);
      }).catch(() => { if (active) setFavoritesReady(true); });
    } catch { setFavoritesReady(true); }
    return () => { active = false; };
  }, []);
  const favoriteKey = favorites.join(',');
  useEffect(() => {
    if (!favoritesReady) return;
    let active = true;
    const q = new URLSearchParams({ search: filters.search, category: String(filters.category), stock: filters.stock, sort: filters.sort, per_page: String(filters.perPage), page: String(filters.page), favorites: filters.favorites ? '1' : '0' });
    if (filters.favorites && favoriteKey) q.set('favorite_ids', favoriteKey);
    api<{ materials: Material[]; total: number; categories: { id: number; name: string }[] }>(`/public/materials/search?${q}`).then(result => { if (active) { setItems(result.materials); setTotal(result.total); setCategories(result.categories); setLoaded(true); setError(''); } }).catch(cause => { if (active) { setError((cause as Error).message); setLoaded(true); } });
    return () => { active = false; };
  }, [filters, favoritesReady, favoriteKey]);
  const change = (next: Partial<Filters>) => setFilters(current => { const updated = { ...current, ...next, page: Object.hasOwn(next, 'page') ? next.page! : 1 }; syncQuery(updated); return updated; });
  const toggleFavorite = (id: number) => {
    const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id].slice(0, 100);
    setFavorites(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Bu sekmedeki seçim korunur. */ }
    if (!next.length && filters.favorites) change({ favorites: false });
  };
  const pages = Math.max(1, Math.ceil(total / filters.perPage));
  const page = Math.min(filters.page, pages);
  const visible = items;
  const typeLabel: Record<string, string> = { consumable: 'Sarf malzemesi', loanable: 'Ödünç verilebilir', equipment: 'Demirbaş' };
  return <Screen title="Malzemeler" subtitle="Atölyedeki ekipmanların stok ve kullanım durumunu inceleyin.">
    <Card title="Katalogda ara" className="catalog-controls"><form className="catalog-filter-grid" onSubmit={event => { event.preventDefault(); change({ search: searchDraft.trim() }); }}>
      <label>Arama<input type="search" maxLength={100} value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Ad, marka, model veya stok kodu…"/></label>
      <label>Kategori<select value={filters.category} onChange={event => change({ category: Number(event.target.value) })}><option value={0}>Tüm kategoriler</option>{categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Stok durumu<select value={filters.stock} onChange={event => change({ stock: event.target.value as Filters['stock'] })}><option value="all">Tümü</option><option value="available">Stokta var</option><option value="out">Stokta yok</option></select></label>
      <label>Sırala<select value={filters.sort} onChange={event => change({ sort: event.target.value as Filters['sort'] })}><option value="name_asc">Ada göre A–Z</option><option value="name_desc">Ada göre Z–A</option><option value="updated_desc">Son güncellenen</option></select></label>
      <label>Sayfa başına<select value={filters.perPage} onChange={event => change({ perPage: Number(event.target.value) as Filters['perPage'] })}><option value={12}>12</option><option value={24}>24</option><option value={48}>48</option></select></label>
      <Button type="submit">Ara</Button>
    </form><div className="catalog-toolbar"><button type="button" className="button button-quiet" disabled={!favoritesReady || (!favorites.length && !filters.favorites)} onClick={() => change({ favorites: !filters.favorites })} aria-pressed={filters.favorites}>★ Favorilerim ({favorites.length})</button><Button variant="quiet" onClick={() => { setSearchDraft(''); change(defaults); }}>Filtreleri temizle</Button><span role="status">{total} malzeme</span></div></Card>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="grid catalog-grid">{visible.map(item => {
      const cover = item.media.find(medium => medium.type === 'image' && medium.isCover) || item.media.find(medium => medium.type === 'image');
      const otherMedia = item.media.filter(medium => medium.id !== cover?.id);
      const favorite = favorites.includes(item.id);
      return <Card key={item.id} title={item.name} className="catalog-card"><div className="catalog-card-head"><Badge>{typeLabel[item.kind] || item.kind}</Badge><button type="button" className="catalog-favorite" aria-pressed={favorite} aria-label={favorite ? `${item.name} malzemesini favorilerden çıkar` : `${item.name} malzemesini favorilere ekle`} disabled={!favoritesReady} onClick={() => toggleFavorite(item.id)}>{favorite ? '★' : '☆'}</button></div>
        {cover && <CatalogImage medium={cover} name={item.name}/>}
        {(item.brand || item.model) && <p>{[item.brand, item.model].filter(Boolean).join(' · ')}</p>}
        <p>{item.category} · {item.location || 'Konum belirtilmedi'}</p>
        <p><Badge tone={item.availability === 'available' ? 'good' : 'warn'}>{item.availability === 'available' ? 'Stokta var' : 'Stokta yok'}</Badge>{item.quantity !== null && <strong> · {formatQuantity(item.quantity)} {item.unit}</strong>}</p>
        {item.description && <p>{item.description}</p>}
        {item.updatedAt && <small>Son güncelleme: {new Date(item.updatedAt).toLocaleDateString('tr-TR')}</small>}
        {item.technicalSpecs && Object.keys(item.technicalSpecs).length > 0 && <details><summary>Teknik özellikler ({Object.keys(item.technicalSpecs).length})</summary><dl className="catalog-specs">{Object.entries(item.technicalSpecs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></details>}
        {otherMedia.length > 0 && <details><summary>Fotoğraf, video ve bağlantılar ({otherMedia.length})</summary>{otherMedia.map(medium => medium.type === 'image' ? <CatalogImage key={medium.id} medium={medium} name={item.name}/> : medium.type === 'video' ? <video key={medium.id} src={medium.url} controls preload="metadata" aria-label={medium.title || `${item.name} videosu`} className="material-video"/> : <p key={medium.id}><a href={medium.url} target="_blank" rel="noopener noreferrer">{medium.title || 'İlgili bağlantı'} ↗</a></p>)}</details>}
      </Card>;
    })}</div>
    {loaded && !visible.length && <Empty>Bu ölçütlerde malzeme yok.</Empty>}
    {pages > 1 && <nav className="catalog-pagination" aria-label="Malzeme sayfaları"><Button variant="quiet" disabled={page <= 1} onClick={() => change({ page: page - 1 })}>Önceki</Button><span>{page} / {pages}</span><Button variant="quiet" disabled={page >= pages} onClick={() => change({ page: page + 1 })}>Sonraki</Button></nav>}
  </Screen>;
}
