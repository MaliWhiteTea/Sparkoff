import AdminLayout from "@/components/AdminLayout";
import DraftRecoveryNotice from "@/components/DraftRecoveryNotice";
import { FieldError, FormErrors, FormErrorSummary } from "@/components/FormErrorSummary";
import SettingsTabs from "@/components/SettingsTabs";
import StatusBadge from "@/components/StatusBadge";
import { hasFormChanged, useUnsavedChanges } from "@/components/UnsavedChangesGuard";
import { safeDraftFields } from "@/config/safeDraftFields";
import { useSafeDraft } from "@/hooks/useSafeDraft";
import { Head, router } from "@inertiajs/react";
import { FormEvent, useState } from "react";

type Filament = {
  id: number;
  material: string;
  color: string;
  brand: string | null;
  diameter_mm: string;
  spool_weight_grams: number | null;
  nozzle_temp_min: number | null;
  nozzle_temp_max: number | null;
  bed_temp_min: number | null;
  bed_temp_max: number | null;
  technical_notes: string | null;
  is_available: boolean;
  unavailable_reason: string | null;
};
type Material = {
  material: string;
  isAvailable: boolean;
  reason: string | null;
  count: number;
};
const empty = {
  material: "",
  color: "",
  brand: "",
  diameter_mm: 1.75,
  spool_weight_grams: 1000,
  nozzle_temp_min: 190,
  nozzle_temp_max: 220,
  bed_temp_min: 50,
  bed_temp_max: 60,
  technical_notes: "",
  is_available: true,
  unavailable_reason: "",
};

function FilamentCard({ filament }: { filament: Filament }) {
  const [data, setData] = useState({ ...filament });
  const [errors, setErrors] = useState<FormErrors>({});
  const [processing, setProcessing] = useState(false);
  const changed = hasFormChanged(filament, data);
  useUnsavedChanges(changed);
  const { draft, clearDraft } = useSafeDraft({ key: `settings.filaments.edit.${filament.id}`, source: data, fields: safeDraftFields.filament, enabled: changed });
  return (
    <form
      className="filament-admin-card"
      id={`filament-${filament.id}`}
      onSubmit={(event) => {
        event.preventDefault();
        router.patch(`/yonetim/ayarlar/filamentler/${filament.id}`, data, {
          preserveScroll: true,
          errorBag: `filament-${filament.id}`,
          onStart: () => setProcessing(true),
          onError: (nextErrors) => setErrors(nextErrors),
          onSuccess: () => setErrors({}),
          onFinish: () => setProcessing(false),
        });
      }}
    >
      <header>
        <div>
          <span>{filament.material}</span>
          <strong>{filament.color}</strong>
        </div>
        <StatusBadge
          status={filament.is_available ? "available" : "inactive"}
          label={filament.is_available ? "Kullanılabilir" : "Kullanıma kapalı"}
        />
      </header>
      {draft && <DraftRecoveryNotice updatedAt={draft.updatedAt} onDiscard={clearDraft} onRestore={() => { setData((current) => ({ ...current, ...draft.value })); clearDraft(); }} />}
      <FormErrorSummary errors={errors} />
      <div className="field-grid">
        <label className="field">
          <span>Malzeme</span>
          <input
            aria-invalid={Boolean(errors.material)}
            value={data.material}
            onChange={(e) => setData({ ...data, material: e.target.value })}
          />
          <FieldError errors={errors} name="material" />
        </label>
        <label className="field">
          <span>Renk</span>
          <input
            aria-invalid={Boolean(errors.color)}
            value={data.color}
            onChange={(e) => setData({ ...data, color: e.target.value })}
          />
          <FieldError errors={errors} name="color" />
        </label>
        <label className="field">
          <span>Marka</span>
          <input
            aria-invalid={Boolean(errors.brand)}
            value={data.brand ?? ""}
            onChange={(e) => setData({ ...data, brand: e.target.value })}
          />
          <FieldError errors={errors} name="brand" />
        </label>
        <label className="field">
          <span>Çap (mm)</span>
          <input
            aria-invalid={Boolean(errors.diameter_mm)}
            type="number"
            step="0.01"
            value={data.diameter_mm}
            onChange={(e) => setData({ ...data, diameter_mm: e.target.value })}
          />
          <FieldError errors={errors} name="diameter_mm" />
        </label>
        <label className="field">
          <span>Makara ağırlığı (g)</span>
          <input
            type="number"
            value={data.spool_weight_grams ?? ""}
            onChange={(e) =>
              setData({
                ...data,
                spool_weight_grams: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </label>
        <label className="field">
          <span>Nozzle min/max °C</span>
          <div className="inline-inputs">
            <input
              type="number"
              value={data.nozzle_temp_min ?? ""}
              onChange={(e) =>
                setData({ ...data, nozzle_temp_min: Number(e.target.value) })
              }
            />
            <input
              type="number"
              value={data.nozzle_temp_max ?? ""}
              onChange={(e) =>
                setData({ ...data, nozzle_temp_max: Number(e.target.value) })
              }
            />
          </div>
        </label>
        <label className="field">
          <span>Tabla min/max °C</span>
          <div className="inline-inputs">
            <input
              type="number"
              value={data.bed_temp_min ?? ""}
              onChange={(e) =>
                setData({ ...data, bed_temp_min: Number(e.target.value) })
              }
            />
            <input
              type="number"
              value={data.bed_temp_max ?? ""}
              onChange={(e) =>
                setData({ ...data, bed_temp_max: Number(e.target.value) })
              }
            />
          </div>
        </label>
        <label className="field full">
          <span>Teknik bilgi</span>
          <textarea
            rows={3}
            value={data.technical_notes ?? ""}
            onChange={(e) =>
              setData({ ...data, technical_notes: e.target.value })
            }
          />
        </label>
      </div>
      <button disabled={processing}>{processing ? "Kaydediliyor…" : "Bilgileri kaydet"}</button>
    </form>
  );
}

export default function FilamentSettings({
  filaments,
  materials,
}: {
  filaments: Filament[];
  materials: Material[];
}) {
  const [data, setData] = useState(empty);
  const [error, setError] = useState("");
  const changed = hasFormChanged(empty, data);
  useUnsavedChanges(changed);
  const { draft, clearDraft } = useSafeDraft({ key: "settings.filaments.create", source: data, fields: safeDraftFields.filament, enabled: changed });
  function submit(event: FormEvent) {
    event.preventDefault();
    router.post("/yonetim/ayarlar/filamentler", data, {
      preserveScroll: true,
      onSuccess: () => setData(empty),
      onError: (errors) =>
        setError(Object.values(errors)[0] ?? "Filament eklenemedi."),
    });
  }
  function toggle(material: Material) {
    const available = !material.isAvailable;
    const reason = available
      ? ""
      : (window.prompt(
          `${material.material} neden kullanılamıyor?`,
          material.reason ?? "",
        ) ?? "");
    if (!available && !reason.trim()) return;
    router.patch(
      `/yonetim/ayarlar/filament-turleri/${encodeURIComponent(material.material)}/kullanilabilirlik`,
      { is_available: available, reason },
      { preserveScroll: true },
    );
  }
  return (
    <AdminLayout>
      <Head title="Filament Ayarları" />
      <header className="admin-title">
        <div>
          <span className="booking-kicker">SİSTEM AYARLARI</span>
          <h1>Filamentler</h1>
          <p>
            Atölye stoklarını, teknik özellikleri ve malzeme uygunluğunu
            yönetin.
          </p>
        </div>
      </header>
      <SettingsTabs />
      {error && <div className="form-error">{error}</div>}
      <section className="settings-section">
        <div className="settings-heading">
          <div>
            <h2>Malzeme kullanılabilirliği</h2>
            <p>
              Bir türü kapatmak o malzemenin tüm renklerini randevu seçiminden
              kaldırır.
            </p>
          </div>
        </div>
        <div className="material-admin-list">
          {materials.map((item) => (
            <article className="admin-panel" key={item.material}>
              <div>
                <strong>{item.material}</strong>
                <span>
                  {item.count} seçenek ·{" "}
                  {item.isAvailable ? "Kullanılabilir" : item.reason}
                </span>
              </div>
              <button
                className={item.isAvailable ? "disable" : ""}
                onClick={() => toggle(item)}
              >
                {item.isAvailable
                  ? "Geçici olarak kapat"
                  : "Tekrar kullanıma aç"}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-heading">
          <div>
            <h2>Stok ve teknik bilgiler</h2>
            <p>
              Bu bilgiler randevu ekranında ve genel filament kataloğunda
              gösterilir.
            </p>
          </div>
        </div>
        <div className="filament-admin-grid">
          {filaments.map((filament) => (
            <FilamentCard filament={filament} key={filament.id} />
          ))}
        </div>
      </section>
      <form
        className="admin-panel rules-panel filament-create-form"
        onSubmit={submit}
      >
        {draft && <DraftRecoveryNotice updatedAt={draft.updatedAt} onDiscard={clearDraft} onRestore={() => { setData((current) => ({ ...current, ...draft.value })); clearDraft(); }} />}
        <div className="settings-heading">
          <div>
            <h2>Yeni filament ekle</h2>
            <p>Yeni renk, marka veya malzeme seçeneği oluşturun.</p>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Malzeme</span>
            <input
              value={data.material}
              onChange={(e) =>
                setData({ ...data, material: e.target.value.toUpperCase() })
              }
              required
            />
          </label>
          <label className="field">
            <span>Renk</span>
            <input
              value={data.color}
              onChange={(e) => setData({ ...data, color: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Marka</span>
            <input
              value={data.brand}
              onChange={(e) => setData({ ...data, brand: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Çap (mm)</span>
            <input
              type="number"
              step="0.01"
              value={data.diameter_mm}
              onChange={(e) =>
                setData({ ...data, diameter_mm: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Makara ağırlığı (g)</span>
            <input
              type="number"
              value={data.spool_weight_grams}
              onChange={(e) =>
                setData({ ...data, spool_weight_grams: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Nozzle min/max °C</span>
            <div className="inline-inputs">
              <input
                type="number"
                value={data.nozzle_temp_min}
                onChange={(e) =>
                  setData({ ...data, nozzle_temp_min: Number(e.target.value) })
                }
              />
              <input
                type="number"
                value={data.nozzle_temp_max}
                onChange={(e) =>
                  setData({ ...data, nozzle_temp_max: Number(e.target.value) })
                }
              />
            </div>
          </label>
          <label className="field">
            <span>Tabla min/max °C</span>
            <div className="inline-inputs">
              <input
                type="number"
                value={data.bed_temp_min}
                onChange={(e) =>
                  setData({ ...data, bed_temp_min: Number(e.target.value) })
                }
              />
              <input
                type="number"
                value={data.bed_temp_max}
                onChange={(e) =>
                  setData({ ...data, bed_temp_max: Number(e.target.value) })
                }
              />
            </div>
          </label>
          <label className="field full">
            <span>Teknik bilgi ve kullanım notu</span>
            <textarea
              rows={3}
              value={data.technical_notes}
              onChange={(e) =>
                setData({ ...data, technical_notes: e.target.value })
              }
            />
          </label>
        </div>
        <button className="settings-submit">Filament ekle</button>
      </form>
    </AdminLayout>
  );
}
