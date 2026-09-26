"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  bookingSettings,
  calculateEndTime,
  createDurations,
  createStartTimes,
  formatDuration,
} from "@/config/booking";

const ArrowIcon = ({ back = false }: { back?: boolean }) => (
  <svg className={back ? "back-arrow" : ""} viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h12M11 5l5 5-5 5" />
  </svg>
);

const CheckIcon = () => <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-9" /></svg>;
const UploadIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 15v5h14v-5" /></svg>;

const steps = ["Tarih ve süre", "Baskı dosyası", "Filament", "İletişim", "Kontrol"];
const startTimes = createStartTimes();
const durations = createDurations();

type FormData = {
  date: string;
  startTime: string;
  duration: number;
  file: File | null;
  filamentSource: "workshop" | "own";
  material: string;
  color: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  note: string;
  rulesAccepted: boolean;
};

const initialData: FormData = {
  date: "",
  startTime: "09:00",
  duration: 60,
  file: null,
  filamentSource: "workshop",
  material: "PLA",
  color: "Fark etmez",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  note: "",
  rulesAccepted: false,
};

export default function BookingForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<FormData>(initialData);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const endTime = calculateEndTime(data.date, data.startTime, data.duration);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function validateStep() {
    if (currentStep === 0 && !data.date) return "Lütfen randevu tarihini seçin.";
    if (currentStep === 1 && !data.file) return "Desteklenen formatlardan bir dosya yüklemelisiniz.";
    if (currentStep === 2 && (!data.material || !data.color)) return "Filament bilgilerini tamamlayın.";
    if (currentStep === 3 && (!data.firstName || !data.lastName || !data.email || !data.phone)) return "İletişim alanlarının tamamını doldurun.";
    if (currentStep === 4 && !data.rulesAccepted) return "Randevu kurallarını onaylamalısınız.";
    return "";
  }

  function nextStep() {
    const validationError = validateStep();
    if (validationError) return setError(validationError);
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousStep() {
    setError("");
    setCurrentStep((step) => Math.max(step - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return update("file", null);

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(bookingSettings.allowedFileExtensions as readonly string[]).includes(extension)) {
      event.target.value = "";
      return setError("Yalnızca G-code, 3MF, STL, STEP veya STP dosyası yükleyebilirsiniz.");
    }
    if (file.size > bookingSettings.maximumFileSizeMb * 1024 * 1024) {
      event.target.value = "";
      return setError(`Dosya boyutu ${bookingSettings.maximumFileSizeMb} MB sınırını aşamaz.`);
    }
    update("file", file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateStep();
    if (validationError) return setError(validationError);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (submitted) {
    return (
      <main className="booking-page success-page">
        <div className="success-card">
          <div className="success-icon"><CheckIcon /></div>
          <span className="booking-kicker">RANDEVU TALEBİ HAZIR</span>
          <h1>E-posta doğrulaması bekleniyor</h1>
          <p><strong>{data.email}</strong> adresine gönderilecek bağlantıya tıkladığınızda randevunuz yönetici incelemesine alınacak.</p>
          <div className="success-summary"><span>{data.date} · {data.startTime}</span><span>{formatDuration(data.duration)}</span></div>
          <Link className="booking-primary" href="/">Ana sayfaya dön</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="booking-page">
      <header className="booking-header">
        <Link className="booking-brand" href="/">
          <Image src="/logo.jpg" alt="Sparkoff logosu" width={48} height={48} priority />
          <span><strong>Sparkoff</strong><small>Proje Atölyesi</small></span>
        </Link>
        <Link className="close-booking" href="/">Randevudan çık <span>×</span></Link>
      </header>

      <div className="booking-shell">
        <aside className="booking-sidebar">
          <span className="booking-kicker">YENİ RANDEVU</span>
          <h1>3D yazıcı randevusu oluşturun</h1>
          <p>Bilgilerinizi adım adım tamamlayın. Randevunuz e-posta doğrulamasından sonra incelenecektir.</p>
          <ol className="booking-steps">
            {steps.map((step, index) => (
              <li className={index === currentStep ? "current" : index < currentStep ? "complete" : ""} key={step}>
                <span>{index < currentStep ? <CheckIcon /> : index + 1}</span><strong>{step}</strong>
              </li>
            ))}
          </ol>
        </aside>

        <form className="booking-form" onSubmit={submit}>
          <div className="mobile-progress"><span>Adım {currentStep + 1} / {steps.length}</span><strong>{steps[currentStep]}</strong><i style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} /></div>

          {currentStep === 0 && (
            <section className="form-step">
              <div className="form-heading"><span>01</span><div><h2>Tarih ve süre</h2><p>Baskının başlayacağı zamanı ve tahmini süresini seçin.</p></div></div>
              <div className="field-grid">
                <label className="field full"><span>Randevu tarihi</span><input type="date" min={today} value={data.date} onChange={(e) => update("date", e.target.value)} /></label>
                <label className="field"><span>Başlangıç saati</span><select value={data.startTime} onChange={(e) => update("startTime", e.target.value)}>{startTimes.map((time) => <option key={time}>{time}</option>)}</select></label>
                <label className="field"><span>Tahmini baskı süresi</span><select value={data.duration} onChange={(e) => update("duration", Number(e.target.value))}>{durations.map((minutes) => <option value={minutes} key={minutes}>{formatDuration(minutes)}</option>)}</select></label>
              </div>
              <div className="time-info"><strong>Tahmini bitiş</strong><span>{endTime ?? "Tarih ve süre seçildikten sonra gösterilir"}</span><p>Baskı bitişi atölye çalışma saatlerinin dışına veya ertesi güne sarkabilir.</p></div>
            </section>
          )}

          {currentStep === 1 && (
            <section className="form-step">
              <div className="form-heading"><span>02</span><div><h2>Baskı dosyası</h2><p>Yöneticinin inceleyebilmesi için üretim dosyanızı ekleyin.</p></div></div>
              <label className={`upload-area ${data.file ? "has-file" : ""}`}>
                <input type="file" accept=".gcode,.3mf,.stl,.step,.stp" onChange={handleFile} />
                <div className="upload-icon">{data.file ? <CheckIcon /> : <UploadIcon />}</div>
                <strong>{data.file ? data.file.name : "Dosya seçin veya buraya bırakın"}</strong>
                <span>{data.file ? `${(data.file.size / 1024 / 1024).toFixed(2)} MB` : "GCODE, 3MF, STL, STEP veya STP · En fazla 100 MB"}</span>
              </label>
              <div className="security-note"><strong>Dosya güvenliği</strong><p>Dosyanız yalnızca yetkili atölye yöneticileri tarafından görüntülenir ve sunucuda çalıştırılmaz.</p></div>
            </section>
          )}

          {currentStep === 2 && (
            <section className="form-step">
              <div className="form-heading"><span>03</span><div><h2>Filament tercihi</h2><p>Baskıda kullanılacak filamentin kaynağını ve özelliklerini seçin.</p></div></div>
              <div className="choice-grid">
                <label className={data.filamentSource === "workshop" ? "selected" : ""}><input type="radio" name="source" checked={data.filamentSource === "workshop"} onChange={() => update("filamentSource", "workshop")} /><strong>Atölye filamenti</strong><span>Mevcut atölye stoklarından kullanmak istiyorum.</span></label>
                <label className={data.filamentSource === "own" ? "selected" : ""}><input type="radio" name="source" checked={data.filamentSource === "own"} onChange={() => update("filamentSource", "own")} /><strong>Kendi filamentim</strong><span>Uyumlu filamentimi randevuya getireceğim.</span></label>
              </div>
              <div className="field-grid">
                <label className="field"><span>Malzeme türü</span><select value={data.material} onChange={(e) => update("material", e.target.value)}><option>PLA</option><option>PETG</option><option>ABS</option><option>TPU</option><option>Diğer</option></select></label>
                <label className="field"><span>Renk tercihi</span><select value={data.color} onChange={(e) => update("color", e.target.value)}><option>Fark etmez</option><option>Siyah</option><option>Beyaz</option><option>Kırmızı</option><option>Mavi</option><option>Diğer</option></select></label>
              </div>
            </section>
          )}

          {currentStep === 3 && (
            <section className="form-step">
              <div className="form-heading"><span>04</span><div><h2>İletişim bilgileri</h2><p>Doğrulama ve randevu bildirimleri için bilgilerinizi girin.</p></div></div>
              <div className="field-grid">
                <label className="field"><span>Ad</span><input autoComplete="given-name" value={data.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="Adınız" /></label>
                <label className="field"><span>Soyad</span><input autoComplete="family-name" value={data.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Soyadınız" /></label>
                <label className="field"><span>E-posta</span><input type="email" autoComplete="email" value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="ornek@eposta.com" /></label>
                <label className="field"><span>Telefon numarası</span><input type="tel" autoComplete="tel" value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="05xx xxx xx xx" /><small>Yalnızca randevunuzla ilgili acil ve operasyonel durumlarda kullanılır.</small></label>
                <label className="field full"><span>Yöneticiye not <em>İsteğe bağlı</em></span><textarea value={data.note} onChange={(e) => update("note", e.target.value)} placeholder="Baskınızla ilgili bilinmesi gereken ayrıntıları yazabilirsiniz." rows={4} /></label>
              </div>
              <p className="privacy-copy">Kişisel verilerinizin nasıl işlendiğini <a href="#">Aydınlatma Metni</a> üzerinden inceleyebilirsiniz.</p>
            </section>
          )}

          {currentStep === 4 && (
            <section className="form-step">
              <div className="form-heading"><span>05</span><div><h2>Bilgileri kontrol edin</h2><p>Talebi göndermeden önce randevu ayrıntılarınızı inceleyin.</p></div></div>
              <div className="review-list">
                <div><span>Tarih ve başlangıç</span><strong>{data.date} · {data.startTime}</strong><button type="button" onClick={() => setCurrentStep(0)}>Düzenle</button></div>
                <div><span>Süre ve bitiş</span><strong>{formatDuration(data.duration)}</strong><small>{endTime}</small></div>
                <div><span>Baskı dosyası</span><strong>{data.file?.name}</strong><button type="button" onClick={() => setCurrentStep(1)}>Düzenle</button></div>
                <div><span>Filament</span><strong>{data.filamentSource === "workshop" ? "Atölye filamenti" : "Kendi filamentim"} · {data.material} · {data.color}</strong><button type="button" onClick={() => setCurrentStep(2)}>Düzenle</button></div>
                <div><span>İletişim</span><strong>{data.firstName} {data.lastName}</strong><small>{data.email} · {data.phone}</small><button type="button" onClick={() => setCurrentStep(3)}>Düzenle</button></div>
              </div>
              <label className="rules-check"><input type="checkbox" checked={data.rulesAccepted} onChange={(e) => update("rulesAccepted", e.target.checked)} /><span><strong>Randevu kurallarını okudum.</strong> Başvurunun yönetici onayından sonra kesinleşeceğini biliyorum.</span></label>
            </section>
          )}

          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-actions">
            {currentStep > 0 && <button className="booking-secondary" type="button" onClick={previousStep}><ArrowIcon back /> Geri</button>}
            {currentStep < steps.length - 1 ? <button className="booking-primary" type="button" onClick={nextStep}>Devam et <ArrowIcon /></button> : <button className="booking-primary" type="submit">Randevu talebini gönder <ArrowIcon /></button>}
          </div>
        </form>
      </div>
    </main>
  );
}
