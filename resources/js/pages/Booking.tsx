import { Head, Link, router } from "@inertiajs/react";
import PublicFooter from "@/components/PublicFooter";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  calculateEndTime,
  createDurations,
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
type FormData = {
  printerId: number | null;
  date: string;
  startTime: string;
  duration: number;
  file: File | null;
  filamentSource: "workshop" | "own";
  filamentId: number | null;
  material: string;
  color: string;
  firstName: string;
  lastName: string;
  email: string;
  rulesAccepted: boolean;
};

const initialData: FormData = {
  printerId: null,
  date: "",
  startTime: "09:00",
  duration: 60,
  file: null,
  filamentSource: "workshop",
  filamentId: null,
  material: "PLA",
  color: "Fark etmez",
  firstName: "",
  lastName: "",
  email: "",
  rulesAccepted: false,
};

type BookingProps = {
  settings: {
    maximumDurationHours: number;
    slotMinutes: number;
    maximumFileSizeMb: number;
    effectiveMaximumFileSizeMb: number;
    configuredMaximumFileSizeMb: number;
    serverMaximumFileSizeMb: number;
    allowedFileExtensions: string[];
  };
  filaments: { id: number; material: string; color: string; brand: string | null; diameterMm: string; nozzleTemperature: string | null; bedTemperature: string | null; technicalNotes: string | null }[];
};

type AvailablePrinter = {
  id: number;
  code: string;
  name: string;
  slots: string[];
};

export default function BookingForm({ settings, filaments }: BookingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<FormData>(initialData);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<AvailablePrinter[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityVersion, setAvailabilityVersion] = useState(0);

  const durations = useMemo(() => createDurations(settings.maximumDurationHours, settings.slotMinutes), [settings]);
  const today = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);
  const endTime = calculateEndTime(data.date, data.startTime, data.duration);
  const selectedFilament = filaments.find((filament) => filament.id === data.filamentId) ?? null;
  const selectedPrinter = availablePrinters.find((printer) => printer.id === data.printerId) ?? null;
  const availableSlots = selectedPrinter?.slots ?? [];

  useEffect(() => {
    if (data.filamentSource === "workshop" && !data.filamentId && filaments[0]) {
      setData((current) => ({ ...current, filamentId: filaments[0].id }));
    }
  }, [data.filamentSource, data.filamentId, filaments]);

  useEffect(() => {
    if (!data.date) {
      setAvailablePrinters([]);
      setLoadingSlots(false);
      setData((current) => ({ ...current, printerId: null, startTime: "" }));
      return;
    }

    const controller = new AbortController();
    setLoadingSlots(true);

    fetch(`/randevu/musaitlik?date=${encodeURIComponent(data.date)}&duration_minutes=${data.duration}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Müsait saatler alınamadı.");
        return response.json() as Promise<{ printers: AvailablePrinter[] }>;
      })
      .then(({ printers }) => {
        setAvailablePrinters(printers);
        setData((current) => ({
          ...current,
          ...(() => {
            const printer = printers.find((item) => item.id === current.printerId)
              ?? printers.find((item) => item.slots.length > 0)
              ?? printers[0]
              ?? null;
            const slots = printer?.slots ?? [];

            return {
              printerId: printer?.id ?? null,
              startTime: slots.includes(current.startTime) ? current.startTime : (slots[0] ?? ""),
            };
          })(),
        }));
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setAvailablePrinters([]);
        setData((current) => ({ ...current, printerId: null, startTime: "" }));
        setError("Müsait saatler yüklenemedi. Lütfen tekrar deneyin.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSlots(false);
      });

    return () => controller.abort();
  }, [data.date, data.duration, availabilityVersion]);

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function selectPrinter(printerId: number) {
    const printer = availablePrinters.find((item) => item.id === printerId) ?? null;
    setData((current) => ({
      ...current,
      printerId: printer?.id ?? null,
      startTime: printer?.slots.includes(current.startTime) ? current.startTime : (printer?.slots[0] ?? ""),
    }));
    setError("");
  }

  function validateStep() {
    if (currentStep === 0 && !data.date) return "Lütfen randevu tarihini seçin.";
    if (currentStep === 0 && !data.printerId) return "Lütfen kullanılabilir bir yazıcı seçin.";
    if (currentStep === 0 && (loadingSlots || !data.startTime)) return loadingSlots ? "Müsait saatler yükleniyor." : "Bu tarih ve süre için müsait başlangıç saati bulunmuyor.";
    if (currentStep === 1 && !data.file) return "Desteklenen formatlardan bir dosya yüklemelisiniz.";
    if (currentStep === 2 && data.filamentSource === "workshop" && !data.filamentId) return "Şu anda kullanılabilir atölye filamenti bulunmuyor.";
    if (currentStep === 2 && data.filamentSource === "own" && (!data.material || !data.color)) return "Filament bilgilerini tamamlayın.";
    if (currentStep === 3 && (!data.firstName || !data.lastName || !data.email)) return "Ad, soyad ve e-posta alanlarını doldurun.";
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
    if (!settings.allowedFileExtensions.includes(extension)) {
      event.target.value = "";
      setData((current) => ({ ...current, file: null }));
      return setError(`İzin verilen dosya türleri: ${settings.allowedFileExtensions.map((item) => item.toUpperCase()).join(", ")}.`);
    }
    if (file.size > settings.effectiveMaximumFileSizeMb * 1024 * 1024) {
      event.target.value = "";
      setData((current) => ({ ...current, file: null }));
      return setError(`Dosya boyutu ${settings.effectiveMaximumFileSizeMb} MB sınırını aşamaz.`);
    }
    update("file", file);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateStep();
    if (validationError) return setError(validationError);

    setProcessing(true);
    router.post("/randevu", {
      printer_id: data.printerId,
      date: data.date,
      start_time: data.startTime,
      duration_minutes: data.duration,
      file: data.file,
      filament_source: data.filamentSource,
      filament_id: data.filamentId,
      material: data.material,
      color: data.color,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      rules_accepted: data.rulesAccepted,
      privacy_notice_seen: true,
    }, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      onError: (errors) => {
        if (errors.date || errors.printer_id) {
          setCurrentStep(0);
          setAvailabilityVersion((version) => version + 1);
        }
        setError(Object.values(errors)[0] ?? "Randevu talebi kaydedilemedi.");
      },
      onFinish: () => setProcessing(false),
    });
  }

  if (submitted) {
    return (
      <main className="booking-page success-page public-page-shell">
        <Head title="E-posta Doğrulaması" />
        <div className="success-card">
          <div className="success-icon"><CheckIcon /></div>
          <span className="booking-kicker">RANDEVU TALEBİ HAZIR</span>
          <h1>E-posta doğrulaması bekleniyor</h1>
          <p><strong>{data.email}</strong> adresine gönderilecek bağlantıya tıkladığınızda randevunuz yönetici incelemesine alınacak.</p>
          <div className="success-summary"><span>{data.date} · {data.startTime}</span><span>{selectedPrinter?.code} · {selectedPrinter?.name}</span><span>{formatDuration(data.duration)}</span></div>
          <Link className="booking-primary" href="/">Ana sayfaya dön</Link>
        </div>
        <PublicFooter />
      </main>
    );
  }

  return (
    <main className="booking-page public-page-shell">
      <Head title="Randevu Oluştur" />
      <header className="booking-header">
        <Link className="booking-brand" href="/">
          <img src="/logo.jpg" alt="Sparkoff logosu" width={48} height={48} />
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
                <label className="field"><span>3D yazıcı</span><select value={data.printerId ?? ""} disabled={!data.date || loadingSlots || availablePrinters.length === 0} onChange={(e) => selectPrinter(Number(e.target.value))}><option value="">{loadingSlots ? "Yazıcılar yükleniyor…" : availablePrinters.length === 0 ? "Randevuya açık yazıcı yok" : "Yazıcı seçin"}</option>{availablePrinters.map((printer) => <option value={printer.id} key={printer.id}>{printer.code} · {printer.name}</option>)}</select><small>{selectedPrinter ? `${selectedPrinter.slots.length} uygun başlangıç saati` : "Önce tarih ve süre seçin."}</small></label>
                <label className="field"><span>Başlangıç saati</span><select value={data.startTime} disabled={!data.date || loadingSlots || availableSlots.length === 0} onChange={(e) => update("startTime", e.target.value)}><option value="">{loadingSlots ? "Müsait saatler yükleniyor…" : availableSlots.length === 0 ? "Müsait saat bulunamadı" : "Saat seçin"}</option>{availableSlots.map((time) => <option value={time} key={time}>{time}</option>)}</select><small>{data.date && !loadingSlots ? `${availableSlots.length} uygun başlangıç saati` : "Önce tarih ve süre seçin."}</small></label>
                <label className="field full"><span>Tahmini baskı süresi</span><select value={data.duration} onChange={(e) => update("duration", Number(e.target.value))}>{durations.map((minutes) => <option value={minutes} key={minutes}>{formatDuration(minutes)}</option>)}</select></label>
              </div>
              <div className="time-info"><strong>Tahmini bitiş</strong><span>{endTime ?? "Tarih ve süre seçildikten sonra gösterilir"}</span><p>Baskı bitişi atölye çalışma saatlerinin dışına veya ertesi güne sarkabilir.</p><p className="long-print-note">24 saati aşan baskılar için randevu oluşturmadan önce atölye yöneticileriyle iletişime geçin.</p></div>
            </section>
          )}

          {currentStep === 1 && (
            <section className="form-step">
              <div className="form-heading"><span>02</span><div><h2>Baskı dosyası</h2><p>Yöneticinin inceleyebilmesi için üretim dosyanızı ekleyin.</p></div></div>
              <label className={`upload-area ${data.file ? "has-file" : ""}`}>
                <input type="file" accept={settings.allowedFileExtensions.map((extension) => `.${extension}`).join(",")} onChange={handleFile} />
                <div className="upload-icon">{data.file ? <CheckIcon /> : <UploadIcon />}</div>
                <strong>{data.file ? data.file.name : "Dosya seçin veya buraya bırakın"}</strong>
                <span>{data.file ? `${(data.file.size / 1024 / 1024).toFixed(2)} MB` : `${settings.allowedFileExtensions.map((item) => item.toUpperCase()).join(", ")} · En fazla ${settings.effectiveMaximumFileSizeMb} MB`}</span>
              </label>
              <div className="security-note"><strong>Dosya güvenliği</strong><p>Dosyanız yalnızca yetkili atölye yöneticileri tarafından görüntülenir ve sunucuda çalıştırılmaz.</p></div>
              {settings.serverMaximumFileSizeMb < settings.configuredMaximumFileSizeMb && <div className="upload-limit-warning"><strong>Sunucu yükleme sınırı: {settings.serverMaximumFileSizeMb} MB</strong><p>Uygulama ayarı {settings.configuredMaximumFileSizeMb} MB olsa da PHP sunucu limiti daha düşük. Daha büyük dosyalar için yöneticiyle iletişime geçin.</p></div>}
            </section>
          )}

          {currentStep === 2 && (
            <section className="form-step">
              <div className="form-heading"><span>03</span><div><h2>Filament tercihi</h2><p>Baskıda kullanılacak filamentin kaynağını ve özelliklerini seçin.</p></div></div>
              <div className="choice-grid">
                <label className={data.filamentSource === "workshop" ? "selected" : ""}><input type="radio" name="source" checked={data.filamentSource === "workshop"} onChange={() => update("filamentSource", "workshop")} /><strong>Atölye filamenti</strong><span>Mevcut ve kullanıma açık atölye stoklarından seçin.</span></label>
                <label className={data.filamentSource === "own" ? "selected" : ""}><input type="radio" name="source" checked={data.filamentSource === "own"} onChange={() => update("filamentSource", "own")} /><strong>Kendi filamentim</strong><span>Uyumlu filamentimi randevuya getireceğim.</span></label>
              </div>
              {data.filamentSource === "workshop" ? <div className="workshop-filament-picker"><label className="field"><span>Mevcut filament</span><select value={data.filamentId ?? ""} onChange={(e) => update("filamentId", Number(e.target.value))}><option value="" disabled>Filament seçin</option>{filaments.map((filament) => <option value={filament.id} key={filament.id}>{filament.material} · {filament.color}{filament.brand ? ` · ${filament.brand}` : ""}</option>)}</select></label>{selectedFilament && <div className="filament-inline-detail"><strong>{selectedFilament.material} · {selectedFilament.color}</strong><span>{selectedFilament.diameterMm} mm{selectedFilament.nozzleTemperature ? ` · Nozzle ${selectedFilament.nozzleTemperature}` : ""}{selectedFilament.bedTemperature ? ` · Tabla ${selectedFilament.bedTemperature}` : ""}</span>{selectedFilament.technicalNotes && <p>{selectedFilament.technicalNotes}</p>}</div>}<Link href="/filamentler" className="filament-detail-link">Tüm atölye filamentlerinin özelliklerini incele →</Link></div> : <div className="field-grid"><label className="field"><span>Malzeme türü</span><input value={data.material} onChange={(e) => update("material", e.target.value)} placeholder="PLA, PETG, ABS…" /></label><label className="field"><span>Renk</span><input value={data.color} onChange={(e) => update("color", e.target.value)} placeholder="Filament rengi" /></label></div>}
            </section>
          )}

          {currentStep === 3 && (
            <section className="form-step">
              <div className="form-heading"><span>04</span><div><h2>Başvuru bilgileri</h2><p>E-posta doğrulaması ve randevu bildirimleri için bilgilerinizi girin.</p></div></div>
              <div className="field-grid">
                <label className="field"><span>Ad</span><input autoComplete="given-name" value={data.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="Adınız" /></label>
                <label className="field"><span>Soyad</span><input autoComplete="family-name" value={data.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Soyadınız" /></label>
                <label className="field"><span>E-posta</span><input type="email" autoComplete="email" value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="ornek@eposta.com" /></label>
              </div>
              <p className="privacy-copy">Kişisel verilerinizin nasıl işlendiğini <a href="/kvkk-aydinlatma" target="_blank" rel="noreferrer">KVKK Aydınlatma Metni</a> üzerinden inceleyebilirsiniz. Bu bilgilendirme açık rıza talebi değildir.</p>
            </section>
          )}

          {currentStep === 4 && (
            <section className="form-step">
              <div className="form-heading"><span>05</span><div><h2>Bilgileri kontrol edin</h2><p>Talebi göndermeden önce randevu ayrıntılarınızı inceleyin.</p></div></div>
              <div className="review-list">
                <div><span>Tarih ve başlangıç</span><strong>{data.date} · {data.startTime}</strong><button type="button" onClick={() => setCurrentStep(0)}>Düzenle</button></div>
                <div><span>3D yazıcı</span><strong>{selectedPrinter ? `${selectedPrinter.code} · ${selectedPrinter.name}` : "—"}</strong><button type="button" onClick={() => setCurrentStep(0)}>Düzenle</button></div>
                <div><span>Süre ve bitiş</span><strong>{formatDuration(data.duration)}</strong><small>{endTime}</small></div>
                <div><span>Baskı dosyası</span><strong>{data.file?.name}</strong><button type="button" onClick={() => setCurrentStep(1)}>Düzenle</button></div>
                <div><span>Filament</span><strong>{data.filamentSource === "workshop" ? `Atölye filamenti · ${selectedFilament?.material ?? "—"} · ${selectedFilament?.color ?? "—"}` : `Kendi filamentim · ${data.material} · ${data.color}`}</strong><button type="button" onClick={() => setCurrentStep(2)}>Düzenle</button></div>
                <div><span>Başvuru sahibi</span><strong>{data.firstName} {data.lastName}</strong><small>{data.email}</small><button type="button" onClick={() => setCurrentStep(3)}>Düzenle</button></div>
              </div>
              <label className="rules-check"><input type="checkbox" checked={data.rulesAccepted} onChange={(e) => update("rulesAccepted", e.target.checked)} /><span><strong>Randevu kurallarını okudum.</strong> Başvurunun yönetici onayından sonra kesinleşeceğini biliyorum.</span></label>
            </section>
          )}

          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-actions">
            {currentStep > 0 && <button className="booking-secondary" type="button" onClick={previousStep}><ArrowIcon back /> Geri</button>}
            {currentStep < steps.length - 1 ? <button className="booking-primary" type="button" onClick={nextStep}>Devam et <ArrowIcon /></button> : <button className="booking-primary" type="submit" disabled={processing}>{processing ? "Kaydediliyor…" : "Randevu talebini gönder"} {!processing && <ArrowIcon />}</button>}
          </div>
        </form>
      </div>
      <PublicFooter />
    </main>
  );
}
