import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Item = { id: number; name: string; sku: string | null; category: string; location: string | null; type: 'consumable' | 'loanable' | 'fixed_asset'; unit: string; description: string | null; technicalSpecs: Record<string, string | number>; availability: 'available' | 'out'; quantity: string | null };
type PageLink = { url: string | null; label: string; active: boolean };
type Props = { items: { data: Item[]; links: PageLink[]; total: number }; filters: { search: string; category: string; stock: string }; categories: { id: number; name: string }[] };
const typeLabels = { consumable: 'Sarf malzemesi', loanable: 'Ödünç verilebilir', fixed_asset: 'Demirbaş' };

export default function Materials({ items, filters, categories }: Props) {
    const [search, setSearch] = useState(filters.search);
    const apply = (changes: Partial<Props['filters']>) => router.get('/malzemeler', { ...filters, search, ...changes }, { preserveState: true, replace: true });
    const submit = (event: FormEvent) => { event.preventDefault(); apply({ search }); };

    return <main className="materials-page"><Head title="Atölye Malzemeleri" />
        <header className="filaments-header"><Link className="booking-brand" href="/"><img src="/logo.jpg" alt="Sparkoff logosu" /><span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span></Link><Link className="booking-primary" href="/">Ana sayfa</Link></header>
        <section className="materials-hero"><span>ATÖLYE ENVANTERİ</span><h1>Malzemeler</h1><p>Atölyedeki ekipmanların güncel stok ve kullanım durumunu inceleyin.</p></section>
        <section className="materials-content">
            <form className="materials-filters" onSubmit={submit}><label><span>Ara</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Arduino, sensör, motor…" /></label><label><span>Kategori</span><select value={filters.category} onChange={(event) => apply({ category: event.target.value })}><option value="">Tüm kategoriler</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label><span>Stok durumu</span><select value={filters.stock} onChange={(event) => apply({ stock: event.target.value })}><option value="all">Tümü</option><option value="available">Stokta var</option><option value="out">Stokta yok</option></select></label><button>Ara</button></form>
            <div className="materials-result-heading"><strong>{items.total} malzeme</strong>{(filters.search || filters.category || filters.stock !== 'all') && <Link href="/malzemeler">Filtreleri temizle</Link>}</div>
            <section className="materials-grid">{items.data.map((item) => <article className="material-item-card" key={item.id}><header><div><span>{item.category}</span><h2>{item.name}</h2></div><strong className={item.availability}>{item.availability === 'available' ? 'Stokta var' : 'Stokta yok'}</strong></header><div className="material-meta"><span>{typeLabels[item.type]}</span>{item.sku && <span>Kod: {item.sku}</span>}{item.location && <span>Konum: {item.location}</span>}</div>{item.description && <p>{item.description}</p>}<footer>{item.quantity !== null ? <strong>{Number(item.quantity).toLocaleString('tr-TR')} {item.unit}</strong> : <span>Miktar bilgisi için atölye sorumlusuna ulaşın.</span>}</footer>{Object.keys(item.technicalSpecs).length > 0 && <details><summary>Teknik özellikler</summary><dl>{Object.entries(item.technicalSpecs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details>}</article>)}{items.data.length === 0 && <div className="materials-empty"><h2>Malzeme bulunamadı</h2><p>Arama veya filtreleri değiştirerek tekrar deneyin.</p></div>}</section>
            {items.links.length > 3 && <nav className="materials-pagination" aria-label="Sayfalar">{items.links.map((link, index) => link.url ? <Link href={link.url} className={link.active ? 'active' : ''} key={index} dangerouslySetInnerHTML={{ __html: link.label }} /> : <span key={index} dangerouslySetInnerHTML={{ __html: link.label }} />)}</nav>}
        </section>
        <footer><div className="footer-brand"><img src="/logo.jpg" alt="" width={44} height={44} /><div><strong>Sparkoff</strong><span>Proje Atölyesi</span></div></div><Link className="footer-feedback" href="/geri-bildirim">Öneri, şikâyet veya hata bildir</Link><span>© 2026 Sparkoff</span></footer>
    </main>;
}
