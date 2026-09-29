import { Head, Link } from "@inertiajs/react";

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
    <path d="M8 13h3v3H8z" />
  </svg>
);

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v5h14v-5" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 6h18v13H3V6Zm0 1 9 7 9-7" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-9" /></svg>
);

const steps = [
  { icon: <CalendarIcon />, title: "Uygun zamanı seçin", text: "Takvimde yalnızca müsait olan gün ve saatleri görüntüleyin." },
  { icon: <UploadIcon />, title: "Dosyanızı yükleyin", text: "G-code, 3MF, STL veya STEP dosyanızı randevuya ekleyin." },
  { icon: <MailIcon />, title: "E-postadan takip edin", text: "Başvurunuzu doğrulayın ve tüm durum değişikliklerini takip edin." },
];

type HomeProps = {
  workshop: { isOpen: boolean; statusLabel: string; hours: string; daysLabel: string };
  nextSlot: { label: string; printer: string } | null;
  printers: { code: string; name: string; description: string | null; status: "active" | "maintenance" | "inactive"; statusLabel: string }[];
};

export default function Home({ workshop, nextSlot, printers }: HomeProps) {
  return (
    <main id="ust">
      <Head title="3D Yazıcı Randevu Sistemi" />
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#ust" aria-label="Sparkoff Proje Atölyesi ana sayfa">
            <img src="/logo.jpg" alt="Sparkoff logosu" width={56} height={56} />
            <span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span>
          </a>

          <nav className="desktop-nav" aria-label="Ana menü">
            <a href="#nasil-calisir">Nasıl çalışır?</a>
            <a href="#yazicilar">Yazıcılar</a>
            <a href="#yardim">Yardım</a>
          </nav>

          <Link className="header-button" href="/randevu">Randevu oluştur <ArrowIcon /></Link>
        </div>
      </header>

      <section className="hero" id="randevu">
        <div className="hero-copy">
          <span className="eyebrow">SPARKOFF PROJE ATÖLYESİ</span>
          <h1>3D yazıcı randevusu</h1>
          <p>Uygun zamanı seçin, baskı dosyanızı yükleyin ve başvurunuzu e-posta üzerinden kolayca takip edin.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/randevu">Randevu oluştur <ArrowIcon /></Link>
            <a className="button secondary" href="#yardim">Randevumu takip et</a>
          </div>
          <ul className="benefit-list" aria-label="Hizmet özellikleri">
            <li><CheckIcon /> Ücretsiz</li>
            <li><CheckIcon /> Üyelik gerektirmez</li>
            <li><CheckIcon /> E-posta ile doğrulama</li>
          </ul>
        </div>

        <aside className="availability-card" aria-label="Atölye ve yazıcı durumu">
          <div className="card-heading">
            <div className="calendar-mark"><CalendarIcon /></div>
            <div><span>ATÖLYE DURUMU</span><strong>{workshop.statusLabel}</strong></div>
            <span className={`open-badge ${workshop.isOpen ? "" : "closed"}`}><i /> {workshop.isOpen ? "Açık" : "Kapalı"}</span>
          </div>
          <div className="hours-row">
            <ClockIcon />
            <div><span>Randevu başlangıç aralığı</span><strong>{workshop.hours}</strong></div>
            <small>{workshop.daysLabel}</small>
          </div>
          <div className="next-slot">
            <span>EN YAKIN UYGUN ZAMAN</span>
            <strong>{nextSlot?.label ?? "Uygun zaman bulunamadı"}</strong>
            <p>{nextSlot?.printer ?? "Aktif yazıcı veya uygun saat bulunmuyor"}</p>
            <Link href="/randevu">Uygun saatleri görüntüle <ArrowIcon /></Link>
          </div>
          <p className="card-note">Saatler yönetici tarafından güncellenebilir. Randevunuz onaylandıktan sonra e-posta ile bilgilendirilirsiniz.</p>
        </aside>
      </section>

      <section className="section process" id="nasil-calisir">
        <div className="section-title">
          <span className="eyebrow">NASIL ÇALIŞIR?</span>
          <h2>Üç adımda randevu oluşturun</h2>
          <p>Üyelik açmadan kısa bir form ile başvurunuzu tamamlayabilirsiniz.</p>
        </div>
        <div className="steps">
          {steps.map((step, index) => (
            <article className="step" key={step.title}>
              <span className="step-count">{String(index + 1).padStart(2, "0")}</span>
              <div className="step-icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section printers" id="yazicilar">
        <div className="section-title compact">
          <span className="eyebrow">YAZICILAR</span>
          <h2>Güncel yazıcı durumu</h2>
          <p>Rezervasyon sırasında yalnızca kullanıma açık yazıcılar seçilebilir.</p>
        </div>
        <div className="printer-list">
          {printers.map((printer) => (
            <article className={`printer-row ${printer.status !== "active" ? "muted-row" : ""}`} key={printer.code}>
              <span className="printer-code">{printer.code}</span>
              <div><strong>{printer.name}</strong><span>{printer.description ?? (printer.status === "active" ? "Randevu alınabilir" : "Geçici olarak kullanılamıyor")}</span></div>
              <span className={`status ${printer.status}`}>{printer.status === "active" && <i />} {printer.statusLabel}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="help" id="yardim">
        <div><span className="eyebrow">YARDIM</span><h2>Randevunuzla ilgili desteğe mi ihtiyacınız var?</h2></div>
        <p>Randevu sonrasında size gönderilen bağlantı üzerinden durumunuzu görüntüleyebilir veya randevunuzu iptal edebilirsiniz.</p>
        <a className="button secondary" href="mailto:atolye@okul.edu.tr">Atölyeye ulaşın</a>
      </section>

      <footer>
        <div className="footer-brand">
          <img src="/logo.jpg" alt="" width={44} height={44} />
          <div><strong>Sparkoff</strong><span>Proje Atölyesi</span></div>
        </div>
        <p>3D yazıcı randevu sistemi</p>
        <span>© 2026 Sparkoff Proje Atölyesi</span>
      </footer>

      <Link className="mobile-booking" href="/randevu">Randevu oluştur <ArrowIcon /></Link>
    </main>
  );
}
