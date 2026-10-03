import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

const ArrowIcon = () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5" /></svg>;
const PhoneIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h4l2 5-3 2a15 15 0 0 0 5 5l2-3 5 2v4c0 1.7-1.3 3-3 3C9.7 21 3 14.3 3 6c0-1.7 1.3-3 3-3Z" /></svg>;

type Printer = { code: string; name: string; description: string | null; status: 'active' | 'maintenance' | 'inactive'; statusLabel: string; availability: string; availabilityLabel: string };
type Hours = { weekday: number; day: string; isOpen: boolean; opensAt: string | null; closesAt: string | null };
type ScheduleBlock = { id: number; printer: string; printerCode: string | null; kind: 'busy' | 'maintenance' | 'closed'; kindLabel: string; startsAt: string; endsAt: string; note: string | null };
type Props = { printers: Printer[]; hours: Hours[]; filamentSummary: { availableOptions: number; materials: string[] }; contact: { phone: string | null; whatsapp: string | null; hours: string }; supportedFormats: string[]; schedule: ScheduleBlock[] };

export default function Printers({ printers, hours, filamentSummary, contact, supportedFormats, schedule }: Props) {
    const [selectedPrinter, setSelectedPrinter] = useState(printers[0]?.code ?? '');
    const whatsappHref = contact.whatsapp ? `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}` : null;
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + index);
        const end = new Date(date);
        end.setDate(end.getDate() + 1);

        return { date, blocks: schedule.filter((block) => (!block.printerCode || block.printerCode === selectedPrinter) && new Date(block.startsAt) < end && new Date(block.endsAt) > date) };
    });
    const time = (value: string) => new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

    return <main className="printer-portal"><Head title="3D Yazıcılar" /><header className="filaments-header"><Link className="booking-brand" href="/"><img src="/logo.jpg" alt="Sparkoff logosu" /><span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span></Link><Link className="module-home-link" href="/">← Atölye ana sayfası</Link></header>
        <section className="printer-module-hero"><div><span className="eyebrow">3D ÜRETİM MODÜLÜ</span><h1>Yazıcıların güncel durumunu inceleyin.</h1><p>Aktif cihazları, çalışma saatlerini, mevcut filamentleri ve baskı kurallarını kişisel bilgi paylaşmadan görüntüleyin.</p></div><div className="privacy-chip">Bu sayfa sizden kişisel veri veya dosya istemez.</div></section>

        <section className="printer-module-section"><div className="module-section-heading"><div><span className="eyebrow">YAZICILAR</span><h2>Anlık cihaz durumu</h2></div><p>Takvim kayıtları cihaz durumuna anlık olarak yansır.</p></div><div className="public-printer-grid">{printers.map((printer) => <article key={printer.code} className={`public-printer-card state-${printer.status}`}><header><span>{printer.code}</span><strong className={`status ${printer.availability}`}>{printer.availability === 'available' && <i />}{printer.availabilityLabel}</strong></header><h3>{printer.name}</h3><p>{printer.description ?? 'Bu yazıcı için açıklama girilmemiş.'}</p><div className="printer-card-foot">{printer.availability === 'available' ? 'Takvimdeki boş zamanlar için iletişime geçebilirsiniz.' : 'Bu cihaz şu anda kullanıma uygun değil.'}</div></article>)}</div></section>

        <section className="printer-module-section public-schedule"><div className="module-section-heading"><div><span className="eyebrow">7 GÜNLÜK TAKVİM</span><h2>Dolu ve kullanılamayan zamanlar</h2></div><p>Bir yazıcı seçin. Kayıt bulunmayan saatler olası boş zamanı gösterir; kesin kullanım için sorumluyla görüşün.</p></div><div className="schedule-printer-tabs" role="tablist" aria-label="Takvimi görüntülenecek yazıcı">{printers.map((printer) => <button type="button" role="tab" aria-selected={selectedPrinter === printer.code} className={selectedPrinter === printer.code ? 'active' : ''} onClick={() => setSelectedPrinter(printer.code)} key={printer.code}><span>{printer.code}</span><strong>{printer.name}</strong></button>)}</div><div className="schedule-day-grid">{days.map(({ date, blocks }, index) => <article key={date.toISOString()} className={index === 0 ? 'today' : ''}><header><span>{index === 0 ? 'BUGÜN' : date.toLocaleDateString('tr-TR', { weekday: 'long' }).toLocaleUpperCase('tr-TR')}</span><strong>{date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</strong></header><div>{blocks.map((block) => <section className={`schedule-block kind-${block.kind}`} key={block.id}><span>{block.kindLabel}</span><strong>{block.printerCode ? block.printer : 'Tüm atölye'}</strong><time>{time(block.startsAt)}–{time(block.endsAt)}</time>{block.note && <small>{block.note}</small>}</section>)}{blocks.length === 0 && <p className="schedule-empty">Kayıtlı engel yok</p>}</div></article>)}</div></section>

        <section className="printer-info-grid"><article><span className="eyebrow">KULLANIM BAŞLANGICI</span><h2>Haftalık saat aralığı</h2><div className="public-hours-list">{hours.map((item) => <div key={item.weekday}><span>{item.day}</span><strong>{item.isOpen ? `${item.opensAt}–${item.closesAt}` : 'Kapalı'}</strong></div>)}</div></article><article><span className="eyebrow">BASKI HAZIRLIĞI</span><h2>Desteklenen formatlar</h2><div className="format-pills">{supportedFormats.map((format) => <span key={format}>.{format.toUpperCase()}</span>)}</div><p>Gösterilen saatler baskının başlayabileceği aralıktır; baskı bitişi bu saatleri aşabilir. 24 saati aşan baskılar ve özel malzeme ihtiyaçları için önceden atölye sorumlusuyla görüşün.</p></article></section>

        <section className="filament-module-callout"><div><span className="eyebrow">ATÖLYE FİLAMENTLERİ</span><h2>{filamentSummary.availableOptions} kullanılabilir seçenek</h2><p>{filamentSummary.materials.length ? `${filamentSummary.materials.join(', ')} türlerindeki renk ve teknik özellikleri inceleyin.` : 'Şu anda kullanılabilir atölye filamenti bulunmuyor.'}</p></div><Link className="button secondary" href="/filamentler">Filament kataloğu <ArrowIcon /></Link></section>

        <section className="printer-contact-card"><div className="contact-icon"><PhoneIcon /></div><div><span className="eyebrow">RANDEVU VE İLETİŞİM</span><h2>Kullanım zamanını atölye sorumlusuyla belirleyin</h2><p>Çevrimiçi randevu alınmamaktadır. {contact.hours} yüz yüze görüşebilir veya yayımlanmış iletişim kanalını kullanabilirsiniz.</p></div><div className="contact-actions">{contact.phone && <a className="button primary" href={`tel:${contact.phone}`}>{contact.phone}</a>}{whatsappHref && <a className="button secondary" href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a>}{!contact.phone && !whatsappHref && <span>İletişim numarası henüz yayımlanmadı.</span>}</div></section>

        <footer><div className="footer-brand"><img src="/logo.jpg" alt="" width={44} height={44} /><div><strong>Sparkoff</strong><span>Proje Atölyesi</span></div></div><p>3D yazıcı durum ve bilgi sistemi</p><span>© 2026 Sparkoff</span></footer>
    </main>;
}
