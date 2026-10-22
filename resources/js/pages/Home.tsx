import { Head, Link } from '@inertiajs/react';
import PublicFooter from '@/components/PublicFooter';
import PublicHeader from '@/components/PublicHeader';

const ArrowIcon = () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>;
const CubeIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></svg>;
const MaterialIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></svg>;
const ClockIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;

type Printer = { code: string; name: string; description: string | null; status: 'active' | 'maintenance' | 'inactive'; availability: string; availabilityLabel: string };
type Announcement = { id: number; title: string; body: string; type: string };
type Props = { workshop: { isOpen: boolean; statusLabel: string; hours: string; daysLabel: string }; printers: Printer[]; contact: { phone: string | null; whatsapp: string | null; email: string | null; hours: string | null }; announcements: Announcement[]; features: { onlineBooking: boolean } };

export default function Home({ workshop, printers, contact, announcements, features }: Props) {
    const availableCount = printers.filter((printer) => printer.availability === 'available').length;
    const whatsappHref = contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` : null;

    return <main id="ust" className="portal-home public-page-shell"><a className="skip-link" href="#icerik">İçeriğe geç</a>
        <Head title="Sparkoff Proje Atölyesi" />
        <PublicHeader isHome hasContact={Boolean(contact.phone || contact.whatsapp || contact.email)} />

        <section className="portal-hero" id="icerik">
            <div className="portal-hero-copy"><h1>Sparkoff Proje Atölyesi</h1><div className="hero-actions"><Link className="button primary" href="/3d-yazicilar">3D yazıcılar <ArrowIcon /></Link><Link className="button secondary" href="/malzemeler">Malzemeler <ArrowIcon /></Link></div></div>
            <aside className="portal-status-card" aria-label="Atölye durumu"><div className="portal-status-top"><span className={`open-badge ${workshop.isOpen ? '' : 'closed'}`}><i /> {workshop.isOpen ? 'Açık' : 'Kapalı'}</span><small>CANLI ATÖLYE DURUMU</small></div><h2>{workshop.statusLabel}</h2><div className="portal-status-row"><ClockIcon /><div><span>Bugünkü kullanım başlangıç aralığı</span><strong>{workshop.hours}</strong></div></div><div className={`portal-printer-summary ${availableCount === 0 ? 'unavailable' : ''}`}>{availableCount > 0 ? <><strong>{availableCount}</strong><span>yazıcı kullanılabilir</span></> : <strong>Yazıcılar meşgul veya bakımda</strong>}</div><Link href="/3d-yazicilar">Ayrıntılı durumu görüntüle <ArrowIcon /></Link></aside>
        </section>

        {announcements.length > 0 && <section className="public-announcements" aria-label="Duyurular">{announcements.map((announcement) => <article className={`announcement-${announcement.type}`} key={announcement.id}><strong>{announcement.title}</strong><p>{announcement.body}</p></article>)}</section>}

        <section className="booking-whatsapp-callout" aria-label="3D yazıcı randevusu"><div><span>3D YAZICI RANDEVUSU</span><h2>{features.onlineBooking ? 'Uygun zamanı seçerek çevrimiçi talep oluşturun.' : 'Randevular WhatsApp üzerinden alınır.'}</h2><p>{features.onlineBooking ? 'Talebiniz e-posta doğrulamasının ardından yönetici onayına gönderilir.' : 'Takvimden uygun zamanı kontrol ettikten sonra atölye sorumlusuna ulaşın.'}</p></div>{features.onlineBooking ? <Link className="button primary" href="/randevu">Randevu oluştur <ArrowIcon /></Link> : whatsappHref && <a className="button primary" href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp’tan yaz <ArrowIcon /></a>}</section>

        <section className="portal-services section" id="hizmetler"><div className="section-title compact"><h2>Atölye olanakları</h2></div><div className="service-card-grid">
            <Link className="service-card active" href="/3d-yazicilar"><div className="service-icon"><CubeIcon /></div><h3>3D Yazıcılar</h3><p>Yazıcıların durumunu, müsaitlik bilgisini, filamentleri ve baskı kurallarını görüntüleyin.</p><strong>Modüle git <ArrowIcon /></strong></Link>
            <Link className="service-card active" href="/malzemeler" id="malzemeler"><div className="service-icon"><MaterialIcon /></div><h3>Malzemeler</h3><p>Arduino, sensör, motor ve diğer atölye malzemelerinin güncel stok durumunu inceleyin.</p><strong>Kataloğa git <ArrowIcon /></strong></Link>
        </div></section>

        <section className="portal-printers section"><div className="section-title compact"><h2>Yazıcı durumu</h2></div><div className="printer-list">{printers.map((printer) => <article className={`printer-row ${printer.availability !== 'available' ? 'muted-row' : ''}`} key={printer.code}><span className="printer-code">{printer.code}</span><div><strong>{printer.name}</strong><span>{printer.description ?? 'Açıklama bulunmuyor'}</span></div><span className={`status ${printer.availability}`}>{printer.availability === 'available' && <i />} {printer.availabilityLabel}</span></article>)}</div></section>

        {(contact.phone || contact.whatsapp || contact.email) && <section className="help portal-contact" id="iletisim"><div><h2>İletişim</h2>{contact.hours && <p>{contact.hours}</p>}</div><div className="contact-actions">{contact.phone && <a className="button primary" href={`tel:${contact.phone}`}>{contact.phone}</a>}{whatsappHref && <a className="button secondary" href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a>}{contact.email && <a className="button secondary" href={`mailto:${contact.email}`}>{contact.email}</a>}</div></section>}

        <PublicFooter />
        <Link className="mobile-booking" href="/3d-yazicilar">3D yazıcıları incele <ArrowIcon /></Link>
    </main>;
}
