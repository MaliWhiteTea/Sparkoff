import { Head, Link } from "@inertiajs/react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { useState } from "react";

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 3h4l2 5-3 2a15 15 0 0 0 5 5l2-3 5 2v4c0 1.7-1.3 3-3 3C9.7 21 3 14.3 3 6c0-1.7 1.3-3 3-3Z" />
  </svg>
);
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 5h14v15H5zM8 3v4M16 3v4M5 10h14M9 14h2M13 14h2M9 17h2" />
  </svg>
);

type Printer = {
  code: string;
  name: string;
  description: string | null;
  status: "active" | "maintenance" | "inactive";
  statusLabel: string;
  availability: string;
  availabilityLabel: string;
};
type Hours = {
  weekday: number;
  day: string;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
};
type ScheduleBlock = {
  id: string;
  printer: string;
  printerCode: string | null;
  kind: "busy" | "maintenance" | "closed";
  kindLabel: string;
  isAllDay: boolean;
  startsAt: string;
  endsAt: string;
  note: string | null;
};
type Announcement = { id: number; title: string; body: string; type: string };
type Props = {
  printers: Printer[];
  hours: Hours[];
  filamentSummary: { availableOptions: number; materials: string[] };
  contact: {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    hours: string | null;
  };
  supportedFormats: string[];
  schedule: ScheduleBlock[];
  announcements: Announcement[];
  features: { onlineBooking: boolean };
};

export default function Printers({
  printers,
  hours,
  filamentSummary,
  contact,
  supportedFormats,
  schedule,
  announcements,
  features,
}: Props) {
  const [selectedPrinter, setSelectedPrinter] = useState(
    printers[0]?.code ?? "",
  );
  const whatsappHref = contact.whatsapp
    ? `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`
    : null;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);

    return {
      date,
      blocks: schedule.filter(
        (block) =>
          (!block.printerCode || block.printerCode === selectedPrinter) &&
          new Date(block.startsAt) < end &&
          new Date(block.endsAt) > date,
      ),
    };
  });
  const time = (value: string) =>
    new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <main className="printer-portal public-page-shell">
      <a className="skip-link" href="#icerik">
        İçeriğe geç
      </a>
      <Head title="3D Yazıcılar" />
      <PublicHeader
        hasContact={Boolean(contact.phone || contact.whatsapp || contact.email)}
      />
      <section className="printer-module-hero" id="icerik">
        <div>
          <h1>3D Yazıcılar</h1>
          <p>Yazıcı durumları, kullanım takvimi ve atölye filamentleri.</p>
        </div>
      </section>
      {announcements.length > 0 && (
        <section
          className="public-announcements printer-announcements"
          aria-label="Duyurular"
        >
          {announcements.map((announcement) => (
            <article
              className={`announcement-${announcement.type}`}
              key={announcement.id}
            >
              <strong>{announcement.title}</strong>
              <p>{announcement.body}</p>
            </article>
          ))}
        </section>
      )}

      <section className="printer-module-section">
        <div className="module-section-heading">
          <div>
            <h2>Anlık durum</h2>
          </div>
        </div>
        <div className="public-printer-grid" role="region" aria-label="Yazıcı durumları" tabIndex={0}>
          {printers.map((printer) => (
            <article
              key={printer.code}
              className={`public-printer-card state-${printer.status}`}
            >
              <header>
                <span>{printer.code}</span>
                <strong className={`status ${printer.availability}`}>
                  {printer.availability === "available" && <i />}
                  {printer.availabilityLabel}
                </strong>
              </header>
              <h3>{printer.name}</h3>
              {printer.description && <p>{printer.description}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="printer-module-section public-schedule">
        <div className="module-section-heading">
          <div>
            <h2>7 günlük takvim</h2>
          </div>
          <p>
            Kayıt olmayan saatler olası boş zamanı gösterir. Kesin kullanım için
            sorumluyla görüşün.
          </p>
        </div>
        <div
          className="schedule-printer-tabs"
          role="tablist"
          aria-label="Takvimi görüntülenecek yazıcı"
        >
          {printers.map((printer) => (
            <button
              type="button"
              role="tab"
              aria-selected={selectedPrinter === printer.code}
              className={selectedPrinter === printer.code ? "active" : ""}
              onClick={() => setSelectedPrinter(printer.code)}
              key={printer.code}
            >
              <span>{printer.code}</span>
              <strong>{printer.name}</strong>
            </button>
          ))}
        </div>
        <div className="schedule-day-grid" role="region" aria-label="Yedi günlük yazıcı takvimi" tabIndex={0}>
          {days.map(({ date, blocks }, index) => (
            <article
              key={date.toISOString()}
              className={index === 0 ? "today" : ""}
            >
              <header>
                <span>
                  {index === 0
                    ? "BUGÜN"
                    : date
                        .toLocaleDateString("tr-TR", { weekday: "long" })
                        .toLocaleUpperCase("tr-TR")}
                </span>
                <strong>
                  {date.toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "short",
                  })}
                </strong>
              </header>
              <div>
                {blocks.map((block) => (
                  <section
                    className={`schedule-block kind-${block.kind}`}
                    key={block.id}
                  >
                    <span>{block.kindLabel}</span>
                    <strong>
                      {block.printerCode ? block.printer : "Tüm atölye"}
                    </strong>
                    <time>
                      {block.isAllDay
                        ? "Tüm gün"
                        : `${time(block.startsAt)}–${time(block.endsAt)}`}
                    </time>
                    {block.note && <small>{block.note}</small>}
                  </section>
                ))}
                {blocks.length === 0 && (
                  <p className="schedule-empty">Kayıt yok</p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="printer-info-grid">
        <article>
          <span className="eyebrow">KULLANIM BAŞLANGICI</span>
          <h2>Haftalık saat aralığı</h2>
          <div className="public-hours-list">
            {hours.map((item) => (
              <div key={item.weekday}>
                <span>{item.day}</span>
                <strong>
                  {item.isOpen ? `${item.opensAt}–${item.closesAt}` : "Kapalı"}
                </strong>
              </div>
            ))}
          </div>
        </article>
        <article>
          <span className="eyebrow">BASKI HAZIRLIĞI</span>
          <h2>Desteklenen formatlar</h2>
          <div className="format-pills">
            {supportedFormats.map((format) => (
              <span key={format}>.{format.toUpperCase()}</span>
            ))}
          </div>
          <p>
            Gösterilen saatler baskının başlayabileceği aralıktır; baskı bitişi
            bu saatleri aşabilir. 24 saati aşan baskılar ve özel malzeme
            ihtiyaçları için önceden atölye sorumlusuyla görüşün.
          </p>
        </article>
      </section>

      <section className="filament-module-callout">
        <div>
          <span className="eyebrow">ATÖLYE FİLAMENTLERİ</span>
          <h2>{filamentSummary.availableOptions} filament seçeneği</h2>
          <p>
            {filamentSummary.materials.length
              ? `${filamentSummary.materials.join(", ")} filamentlerinin renklerini ve baskı özelliklerini inceleyin.`
              : "Şu anda kullanılabilir atölye filamenti bulunmuyor."}
          </p>
        </div>
        <Link className="button secondary" href="/filamentler">
          Filamentleri incele <ArrowIcon />
        </Link>
      </section>

      {(features.onlineBooking ||
        contact.phone ||
        contact.whatsapp ||
        contact.email) && (
        <section className="printer-contact-card">
          <div className="contact-icon">
            {features.onlineBooking ? <CalendarIcon /> : <PhoneIcon />}
          </div>
          <div>
            <span className="eyebrow">
              {features.onlineBooking ? "3D YAZICI RANDEVUSU" : "İLETİŞİM"}
            </span>
            <h2>{features.onlineBooking ? "Yazıcı için randevu oluşturun" : "Atölyeyle iletişime geçin"}</h2>
            <p>{contact.hours || (features.onlineBooking ? "Uygun tarih ve saati seçerek talebinizi atölye sorumlusuna iletin." : "Sorularınız için aşağıdaki iletişim kanallarını kullanın.")}</p>
          </div>
          <div className="contact-actions">
            {features.onlineBooking && (
              <Link className="button primary" href="/randevu">
                Randevu formuna git
              </Link>
            )}
            {!features.onlineBooking && contact.phone && (
              <a className="button primary" href={`tel:${contact.phone}`}>
                {contact.phone}
              </a>
            )}
            {!features.onlineBooking && whatsappHref && (
              <a
                className="button secondary"
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            )}
            {contact.email && (
              <a className="button secondary" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            )}
          </div>
        </section>
      )}

      <PublicFooter />
    </main>
  );
}
