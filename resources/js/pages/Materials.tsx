import { Head, Link, router } from '@inertiajs/react';
import PublicFooter from '@/components/PublicFooter';
import { FormEvent, useState } from 'react';

type Item = { id: number; name: string; sku: string | null; category: string; location: string | null; type: 'consumable' | 'loanable' | 'fixed_asset'; unit: string; description: string | null; technicalSpecs: Record<string, string | number>; availability: 'available' | 'out'; quantity: string | null };
type PageLink = { url: string | null; label: string; active: boolean };
type Props = { items: { data: Item[]; links: PageLink[]; total: number }; filters: { search: string; category: string; stock: string }; categories: { id: number; name: string }[] };
const typeLabels = { consumable: 'Sarf malzemesi', loanable: 'Ödünç verilebilir', fixed_asset: 'Demirbaş' };

export default function Materials({ items, filters, categories }: Props) {
    const [search, setSearch] = useState(filters.search);
    const apply = (changes: Partial<Props['filters']>) => router.get('/malzemeler', { ...filters, search, ...changes }, { preserveState: true, preserveScroll: true, replace: true });
    const submit = (event: FormEvent) => { event.preventDefault(); apply({ search }); };

    return <main className="materials-page public-page-shell"><Head title="Atölye Malzemeleri" />
        <header className="filaments-header"><Link className="booking-brand" href="/"><img src="/logo.jpg" alt="Sparkoff logosu" /><span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span></Link><Link className="booking-primary" href="/">Ana sayfa</Link></header>
        <section className="materials-hero"><span>ATÖLYE ENVANTERİ</span><h1>Malzemeler</h1><p>Atölyedeki ekipmanların güncel stok ve kullanım durumunu inceleyin.</p></section>
        <section className="materials-content">
            <form className="materials-filters" onSubmit={submit}><label><span>Ara</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Arduino, sensör, motor…" /></label><label><span>Kategori</span><select value={filters.category} onChange={(event) => apply({ category: event.target.value })}><option value="">Tüm kategoriler</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label><span>Stok durumu</span><select value={filters.stock} onChange={(event) => apply({ stock: event.target.value })}><option value="all">Tümü</option><option value="available">Stokta var</option><option value="out">Stokta yok</option></select></label><button>Ara</button></form>
            <div className="materials-result-heading"><strong>{items.total} malzeme</strong>{(filters.search || filters.category || filters.stock !== 'all') && <Link href="/malzemeler">Filtreleri temizle</Link>}</div>
            {items.data.length > 0 ? <div className="materials-table-wrap"><table className="materials-table"><thead><tr><th>Malzeme</th><th>Kategori</th><th>Tür</th><th>Konum</th><th>Stok</th></tr></thead><tbody>{items.data.map((item) => <tr key={item.id}><td data-label="Malzeme"><strong>{item.name}</strong>{item.sku && <small>Kod: {item.sku}</small>}{item.description && <p>{item.description}</p>}{Object.keys(item.technicalSpecs).length > 0 && <details><summary>Teknik özellikler</summary><dl>{Object.entries(item.technicalSpecs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details>}</td><td data-label="Kategori">{item.category}</td><td data-label="Tür">{typeLabels[item.type]}</td><td data-label="Konum">{item.location ?? '—'}</td><td data-label="Stok"><div className="material-stock-cell"><span className={`material-stock ${item.availability}`}>{item.availability === 'available' ? 'Stokta var' : 'Stokta yok'}</span>{item.quantity !== null ? <strong className="material-quantity">{Number(item.quantity).toLocaleString('tr-TR')} {item.unit}</strong> : <small>Miktar belirtilmiyor</small>}</div></td></tr>)}</tbody></table></div> : <div className="materials-empty"><h2>Malzeme bulunamadı</h2><p>Arama veya filtreleri değiştirerek tekrar deneyin.</p></div>}
            {items.links.length > 3 && <nav className="materials-pagination" aria-label="Sayfalar">{items.links.map((link, index) => link.url ? <Link href={link.url} className={link.active ? 'active' : ''} preserveScroll preserveState key={index} dangerouslySetInnerHTML={{ __html: link.label }} /> : <span key={index} dangerouslySetInnerHTML={{ __html: link.label }} />)}</nav>}
        </section>
        <PublicFooter />
    </main>;
}
