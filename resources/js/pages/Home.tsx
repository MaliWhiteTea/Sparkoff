import { Head, Link } from '@inertiajs/react';

const ArrowIcon = () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>;
const CubeIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>;
const PartsIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v5M17 3v5M5 8h14v10H5zM8 18v3M12 18v3M16 18v3" /><path d="M9 12h6M12 10v4" /></svg>;
const ClockIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;

type Printer = { code: string; name: string; description: string | null; status: 'active' | 'maintenance' | 'inactive'; statusLabel: string };
type Props = { workshop: { isOpen: boolean; statusLabel: string; hours: string; daysLabel: string }; printers: Printer[] };

export default function Home({ workshop, printers }: Props) {
    const activeCount = printers.filter((printer) => printer.status === 'active').length;

    return <main id="ust" className="portal-home">
        <Head title="Sparkoff Proje Atölyesi" />
        <header className="site-header"><div className="header-inner">
            <a className="brand" href="#ust" aria-label="Sparkoff Proje Atölyesi ana sayfa"><img src="/logo.jpg" alt="Sparkoff logosu" width={56} height={56} /><span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span></a>
            <nav className="desktop-nav" aria-label="Ana menü"><a href="#atolye">Atölye</a><a href="#hizmetler">Hizmetler</a><Link href="/3d-yazicilar">3D Yazıcılar</Link><a href="#iletisim">İletişim</a></nav>
            <Link className="header-button" href="/3d-yazicilar">Yazıcı durumları <ArrowIcon /></Link>
        </div></header>

        <section className="portal-hero" id="atolye">
            <div className="portal-hero-copy"><span className="eyebrow">SPARKOFF PROJE ATÖLYESİ</span><h1>Fikirlerin üretime dönüştüğü atölye.</h1><p>3D üretimden elektronik prototiplemeye kadar atölye kaynaklarını keşfedin, güncel durumları görün ve üretmeye başlayın.</p><div className="hero-actions"><Link className="button primary" href="/3d-yazicilar">3D yazıcıları incele <ArrowIcon /></Link><a className="button secondary" href="#hizmetler">Tüm hizmetler</a></div></div>
            <aside className="portal-status-card" aria-label="Atölye durumu"><div className="portal-status-top"><span className={`open-badge ${workshop.isOpen ? '' : 'closed'}`}><i /> {workshop.isOpen ? 'Açık' : 'Kapalı'}</span><small>CANLI ATÖLYE DURUMU</small></div><h2>{workshop.statusLabel}</h2><div className="portal-status-row"><ClockIcon /><div><span>Bugünkü kullanım başlangıç aralığı</span><strong>{workshop.hours}</strong></div></div><div className="portal-printer-summary"><strong>{activeCount}/{printers.length}</strong><span>yazıcı şu anda aktif</span></div><Link href="/3d-yazicilar">Ayrıntılı durumu görüntüle <ArrowIcon /></Link></aside>
        </section>

        <section className="portal-services section" id="hizmetler"><div className="section-title compact"><span className="eyebrow">ATÖLYE HİZMETLERİ</span><h2>İhtiyacınız olan alana geçin</h2><p>Her modül, atölyedeki kaynakların güncel ve anlaşılır biçimde görüntülenmesi için tasarlanır.</p></div><div className="service-card-grid">
            <Link className="service-card active" href="/3d-yazicilar"><div className="service-icon"><CubeIcon /></div><span className="service-state">KULLANIMA AÇIK</span><h3>3D Yazıcılar</h3><p>Yazıcıların durumunu, müsaitlik bilgisini, filamentleri ve baskı kurallarını görüntüleyin.</p><strong>Modüle git <ArrowIcon /></strong></Link>
            <article className="service-card coming"><div className="service-icon"><PartsIcon /></div><span className="service-state">YAKINDA</span><h3>Malzeme ve Ekipman</h3><p>Arduino, sensör, motor ve diğer atölye ekipmanlarının güncel stok durumunu inceleyin.</p><strong>Hazırlanıyor</strong></article>
        </div></section>

        <section className="portal-printers section"><div className="section-title compact"><span className="eyebrow">HIZLI DURUM</span><h2>Atölyedeki yazıcılar</h2><p>Ayrıntılı müsaitlik için 3D Yazıcılar modülünü açın.</p></div><div className="printer-list">{printers.map((printer) => <article className={`printer-row ${printer.status !== 'active' ? 'muted-row' : ''}`} key={printer.code}><span className="printer-code">{printer.code}</span><div><strong>{printer.name}</strong><span>{printer.description ?? 'Açıklama bulunmuyor'}</span></div><span className={`status ${printer.status}`}>{printer.status === 'active' && <i />} {printer.statusLabel}</span></article>)}</div></section>

        <section className="help portal-contact" id="iletisim"><div><span className="eyebrow">İLETİŞİM</span><h2>Atölye hakkında konuşalım</h2></div><p>3D yazıcı kullanımı ve diğer atölye imkânları için atölye sorumlusuyla yüz yüze iletişime geçebilirsiniz. Telefon ve WhatsApp bilgileri yakında eklenecektir.</p><Link className="button secondary" href="/3d-yazicilar">Yazıcı bilgileri</Link></section>

        <footer><div className="footer-brand"><img src="/logo.jpg" alt="" width={44} height={44} /><div><strong>Sparkoff</strong><span>Proje Atölyesi</span></div></div><p>Üretim · prototipleme · paylaşım</p><span>© 2026 Sparkoff Proje Atölyesi</span></footer>
        <Link className="mobile-booking" href="/3d-yazicilar">3D yazıcıları incele <ArrowIcon /></Link>
    </main>;
}
