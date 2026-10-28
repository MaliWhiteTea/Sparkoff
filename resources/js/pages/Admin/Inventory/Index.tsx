import AdminLayout from "@/components/AdminLayout";
import BulkSelection, { SelectionCheckbox, usePageSelection } from "@/components/BulkSelection";
import ConfirmDialog from "@/components/ConfirmDialog";
import DraftRecoveryNotice from "@/components/DraftRecoveryNotice";
import StatusBadge from "@/components/StatusBadge";
import ListSort from "@/components/ListSort";
import SavedFilters from "@/components/SavedFilters";
import TableColumns, { ColumnDefinition, initialTableColumns } from "@/components/TableColumns";
import { hasFormChanged, useUnsavedChanges } from "@/components/UnsavedChangesGuard";
import { safeDraftFields } from "@/config/safeDraftFields";
import usePermissions from "@/hooks/usePermissions";
import { useSafeDraft } from "@/hooks/useSafeDraft";
import { Head, Link, router, usePage } from "@inertiajs/react";
import { FormEvent, useState } from "react";

type Media = { id: number; type: 'image' | 'video' | 'link'; url: string; title: string | null; altText: string | null; sortOrder: number; isCover: boolean };
type Item = {
  id: number;
  name: string;
  sku: string | null;
  categoryId: number | null;
  category: string | null;
  locationId: number | null;
  location: string | null;
  itemType: string;
  unit: string;
  quantity: string;
  minimumStock: string | null;
  publicVisibility: string;
  description: string | null;
  isActive: boolean;
  isLow: boolean;
  isArchived: boolean;
  media: Media[];
};
type Option = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  itemCount: number;
};
type Location = Option & { code: string; isPublic: boolean };
type Movement = {
  id: number;
  item: string;
  unit: string;
  type: string;
  change: string;
  balance: string;
  reason: string | null;
  actor: string;
  createdAt: string;
};
type PageData = {
  data: Item[];
  links: { url: string | null; label: string; active: boolean }[];
};
type BulkResult = {
  operation: "category" | "location" | "visibility" | "archive";
  successCount: number;
  failureCount: number;
  failures: { id: number; name: string; reason: string }[];
};
type ItemForm = {
  name: string;
  sku: string;
  category_id: string;
  location_id: string;
  item_type: string;
  unit: string;
  quantity: string;
  minimum_stock: string;
  public_visibility: string;
  description: string;
  is_active: boolean;
};
const emptyItem: ItemForm = {
  name: "",
  sku: "",
  category_id: "",
  location_id: "",
  item_type: "consumable",
  unit: "adet",
  quantity: "0",
  minimum_stock: "",
  public_visibility: "status",
  description: "",
  is_active: true,
};
const typeLabels: Record<string, string> = {
  consumable: "Sarf malzemesi",
  loanable: "Ödünç verilebilir",
  fixed_asset: "Demirbaş",
};
const visibilityLabels: Record<string, string> = {
  exact: "Mevcut miktarı sayı olarak göster (ör. 30 adet)",
  status: "Yalnızca kullanılabilirlik göster (Stokta / Tükendi)",
  hidden: "Bu malzemeyi katalogda hiç gösterme",
};
const movementLabels: Record<string, string> = {
  initial: "İlk stok",
  adjustment: "Stok düzeltmesi",
  delivery: "Teslim",
  return: "İade",
  reversal: "Geri alma",
};

type BulkOperation = "" | "category" | "location" | "visibility" | "archive";

function InventoryBulkActions({
  selectedItems,
  categories,
  locations,
  canUpdate,
  canArchive,
  onSuccess,
}: {
  selectedItems: Item[];
  categories: Option[];
  locations: Location[];
  canUpdate: boolean;
  canArchive: boolean;
  onSuccess: () => void;
}) {
  const selectedIds = selectedItems.map((item) => item.id);
  const [operation, setOperation] = useState<BulkOperation>("");
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const ready = selectedIds.length > 0 && operation !== "" && (operation === "archive" || target !== "");
  const operationLabel = operation === "category" ? "Kategori değiştir"
    : operation === "location" ? "Konum değiştir"
      : operation === "visibility" ? "Katalog görünürlüğünü değiştir"
        : operation === "archive" ? "Arşivle" : "Toplu işlem";
  const targetLabel = operation === "category"
    ? target === "none" ? "Kategorisiz" : categories.find((item) => target === `id:${item.id}`)?.name
    : operation === "location"
      ? target === "none" ? "Konumsuz" : locations.find((item) => target === `id:${item.id}`)?.name
      : operation === "visibility" ? visibilityLabels[target] : null;

  const changeOperation = (value: BulkOperation) => {
    setOperation(value);
    setTarget("");
    setError("");
  };
  const submit = () => {
    if (!ready) return;
    const payload: {
      operation: Exclude<BulkOperation, "">;
      item_ids: (number | string)[];
      confirmed: boolean;
      category_id?: number | null;
      location_id?: number | null;
      public_visibility?: string;
    } = {
      operation,
      item_ids: selectedIds,
      confirmed: true,
    };
    if (operation === "category") payload.category_id = target === "none" ? null : Number(target.replace("id:", ""));
    if (operation === "location") payload.location_id = target === "none" ? null : Number(target.replace("id:", ""));
    if (operation === "visibility") payload.public_visibility = target;

    setProcessing(true);
    setError("");
    router.patch("/yonetim/envanter/toplu", payload, {
      preserveScroll: true,
      errorBag: "inventoryBulk",
      onSuccess: () => {
        setConfirming(false);
        setOperation("");
        setTarget("");
        onSuccess();
      },
      onError: (errors) => setError(Object.values(errors)[0] ?? "Toplu işlem tamamlanamadı."),
      onFinish: () => setProcessing(false),
    });
  };

  return <>
    <select aria-label="Toplu işlem" value={operation} disabled={selectedIds.length === 0 || processing} onChange={(event) => changeOperation(event.target.value as BulkOperation)}>
      <option value="">Toplu işlem seçin</option>
      {canUpdate && <><option value="category">Kategori değiştir</option><option value="location">Konum değiştir</option><option value="visibility">Katalog görünürlüğünü değiştir</option></>}
      {canArchive && <option value="archive">Arşivle</option>}
    </select>
    {operation === "category" && <select aria-label="Hedef kategori" value={target} disabled={processing} onChange={(event) => setTarget(event.target.value)}><option value="">Hedef kategori seçin</option><option value="none">Kategoriyi kaldır</option>{categories.filter((item) => item.isActive).map((item) => <option value={`id:${item.id}`} key={item.id}>{item.name}</option>)}</select>}
    {operation === "location" && <select aria-label="Hedef konum" value={target} disabled={processing} onChange={(event) => setTarget(event.target.value)}><option value="">Hedef konum seçin</option><option value="none">Konumu kaldır</option>{locations.filter((item) => item.isActive).map((item) => <option value={`id:${item.id}`} key={item.id}>{item.code} · {item.name}</option>)}</select>}
    {operation === "visibility" && <select aria-label="Katalog görünürlüğü" value={target} disabled={processing} onChange={(event) => setTarget(event.target.value)}><option value="">Görünürlük seçin</option>{Object.entries(visibilityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>}
    <button type="button" className={operation === "archive" ? "danger" : ""} disabled={!ready || processing} onClick={() => { setError(""); setConfirming(true); }}>Devam et</button>
    <ConfirmDialog
      open={confirming}
      eyebrow="TOPLU ENVANTER İŞLEMİ"
      title={`${selectedIds.length} malzeme için “${operationLabel}” işlemi uygulansın mı?`}
      description={operation === "archive"
        ? "Seçili malzemeler kullanımdan kaldırılıp arşivlenecek. Stok hareketleri ve teslim geçmişleri korunacak."
        : <>Seçili malzemelerin yeni değeri <strong>{targetLabel}</strong> olacak.</>}
      confirmLabel={operation === "archive" ? "Malzemeleri arşivle" : "Toplu değişikliği uygula"}
      tone={operation === "archive" ? "danger" : "primary"}
      processing={processing}
      confirmDisabled={!ready}
      onClose={() => { if (!processing) { setConfirming(false); setError(""); } }}
      onConfirm={submit}
    >
      <div className="bulk-confirm-summary">
        <dl><div><dt>Seçili kayıt</dt><dd>{selectedItems.length} malzeme</dd></div><div><dt>Uygulanacak işlem</dt><dd>{operationLabel}</dd></div>{operation !== "archive" && <div><dt>Yeni değer</dt><dd>{targetLabel}</dd></div>}</dl>
        <strong>Etkilenecek malzemeler</strong>
        <ul>{selectedItems.slice(0, 8).map((item) => <li key={item.id}>{item.name}</li>)}</ul>
        {selectedItems.length > 8 && <small>ve {selectedItems.length - 8} malzeme daha</small>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
    </ConfirmDialog>
  </>;
}

function Fields({
  data,
  setData,
  categories,
  locations,
  creating,
  canChangeType,
}: {
  data: ItemForm;
  setData: (x: ItemForm) => void;
  categories: Option[];
  locations: Location[];
  creating: boolean;
  canChangeType: boolean;
}) {
  return (
    <div className="field-grid inventory-fields">
      <label className="field">
        <span>Malzeme adı</span>
        <input
          value={data.name}
          maxLength={180}
          required
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Stok kodu (isteğe bağlı)</span>
        <input
          value={data.sku}
          maxLength={100}
          onChange={(e) => setData({ ...data, sku: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Kategori</span>
        <select
          value={data.category_id}
          onChange={(e) => setData({ ...data, category_id: e.target.value })}
        >
          <option value="">Kategorisiz</option>
          {categories
            .filter((x) => x.isActive || String(x.id) === data.category_id)
            .map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span>Konum</span>
        <select
          value={data.location_id}
          onChange={(e) => setData({ ...data, location_id: e.target.value })}
        >
          <option value="">Konum belirtilmedi</option>
          {locations
            .filter((x) => x.isActive || String(x.id) === data.location_id)
            .map((x) => (
              <option value={x.id} key={x.id}>
                {x.code} · {x.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span>Malzeme türü</span>
        <select
          disabled={!creating && !canChangeType}
          value={data.item_type}
          onChange={(e) => setData({ ...data, item_type: e.target.value })}
        >
          {Object.entries(typeLabels).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Birim</span>
        <input
          value={data.unit}
          maxLength={30}
          required
          onChange={(e) => setData({ ...data, unit: e.target.value })}
        />
      </label>
      {creating && (
        <label className="field">
          <span>Başlangıç stoku</span>
          <input
            type="number"
            min="0"
            step="0.001"
            required
            value={data.quantity}
            onChange={(e) => setData({ ...data, quantity: e.target.value })}
          />
        </label>
      )}
      <label className="field">
        <span>Kritik stok eşiği</span>
        <input
          type="number"
          min="0"
          step="0.001"
          value={data.minimum_stock}
          onChange={(e) => setData({ ...data, minimum_stock: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Herkese açık malzeme sayfasında stok bilgisi</span>
        <select
          value={data.public_visibility}
          onChange={(e) =>
            setData({ ...data, public_visibility: e.target.value })
          }
        >
          {Object.entries(visibilityLabels).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
        <small>
          Bu seçim yalnızca ziyaretçilerin göreceği bilgiyi belirler; yönetim
          panelindeki stok kaydı değişmez.
        </small>
      </label>
      <label className="field full">
        <span>Açıklama</span>
        <textarea
          rows={3}
          maxLength={3000}
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
        />
      </label>
      <label className="day-toggle full">
        <input
          type="checkbox"
          checked={data.is_active}
          onChange={(e) => setData({ ...data, is_active: e.target.checked })}
        />
        <span>Kullanımda</span>
      </label>
    </div>
  );
}

function ItemCard({
  item,
  categories,
  locations,
  canPurge,
  columns,
  selectable,
  selected,
  onSelectionChange,
}: {
  item: Item;
  categories: Option[];
  locations: Location[];
  canPurge: boolean;
  columns: string[];
  selectable: boolean;
  selected: boolean;
  onSelectionChange: (checked: boolean) => void;
}) {
  const can = usePermissions();
  const initialData: ItemForm = {
    name: item.name,
    sku: item.sku ?? "",
    category_id: item.categoryId ? String(item.categoryId) : "",
    location_id: item.locationId ? String(item.locationId) : "",
    item_type: item.itemType,
    unit: item.unit,
    quantity: item.quantity,
    minimum_stock: item.minimumStock ?? "",
    public_visibility: item.publicVisibility,
    description: item.description ?? "",
    is_active: item.isActive,
  };
  const [editing, setEditing] = useState(false);
  const [stocking, setStocking] = useState(false);
  const [managingMedia, setManagingMedia] = useState(false);
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState("");
  const [stock, setStock] = useState({ quantity_change: "", reason: "" });
  const [data, setData] = useState<ItemForm>(initialData);
  const itemChanged = editing && hasFormChanged(initialData, data);
  useUnsavedChanges(itemChanged);
  const { draft, clearDraft } = useSafeDraft({ key: `inventory.edit.${item.id}`, source: data, fields: safeDraftFields.inventoryItem, enabled: itemChanged });
  useUnsavedChanges(stocking && hasFormChanged({ quantity_change: "", reason: "" }, stock));
  const save = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    router.put(`/yonetim/envanter/${item.id}`, data, {
      preserveScroll: true,
      onSuccess: () => setEditing(false),
      onError: (e) => setError(Object.values(e)[0] ?? "Kaydedilemedi."),
    });
  };
  const adjust = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    router.post(`/yonetim/envanter/${item.id}/stok`, stock, {
      preserveScroll: true,
      onSuccess: () => {
        setStocking(false);
        setStock({ quantity_change: "", reason: "" });
      },
      onError: (e) => setError(Object.values(e)[0] ?? "Stok kaydedilemedi."),
    });
  };
  const purge = () => {
    setPurging(true);
    router.delete(`/yonetim/envanter/${item.id}`, {
      data: { confirmation: String(item.id) },
      preserveScroll: true,
      onSuccess: () => setConfirmingPurge(false),
      onFinish: () => setPurging(false),
    });
  };
  if (editing)
    return (
      <form className={`admin-panel inventory-edit ${selected ? "is-selected" : ""}`} onSubmit={save}>
        <div className="inventory-edit-heading">{selectable && <SelectionCheckbox checked={selected} label={`${item.name} malzemesinin seçimini değiştir`} onChange={onSelectionChange} />}<h2>{item.name}</h2></div>
        {draft && <DraftRecoveryNotice updatedAt={draft.updatedAt} onDiscard={clearDraft} onRestore={() => { setData((current) => ({ ...current, ...draft.value })); clearDraft(); }} />}
        {error && <div className="form-error">{error}</div>}
        <Fields
          data={data}
          setData={setData}
          categories={categories}
          locations={locations}
          creating={false}
          canChangeType={can("inventory.change_item_type")}
        />
        <div className="inventory-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setEditing(false)}
          >
            Vazgeç
          </button>
          <button>Değişiklikleri kaydet</button>
        </div>
      </form>
    );
  return (
    <article
      className={`admin-panel inventory-item ${item.isLow ? "low" : ""} ${selected ? "is-selected" : ""}`}
    >
      <div className="inventory-item-main">
        {selectable && <SelectionCheckbox checked={selected} label={`${item.name} malzemesini seç`} onChange={onSelectionChange} />}
        <div className="inventory-item-summary">
          {columns.includes("name") && <><span>{item.sku || typeLabels[item.itemType]}</span><h3>{item.name}</h3></>}
          {(columns.includes("category") || columns.includes("location")) && <p>{[
            columns.includes("category") ? item.category : null,
            columns.includes("location") ? item.location : null,
          ].filter(Boolean).join(" · ") || "Kategori veya konum belirtilmedi"}</p>}
        </div>
        {columns.includes("quantity") && <div className="inventory-quantity">
          <strong>
            {Number(item.quantity).toLocaleString("tr-TR")}{" "}
            <small>{item.unit}</small>
          </strong>
          <StatusBadge
            status={Number(item.quantity) <= 0 ? "out" : item.isLow ? "low" : "available"}
            label={Number(item.quantity) <= 0 ? "Tükendi" : item.isLow ? "Kritik stok" : "Stokta"}
          />
        </div>}
      </div>
      {error && <div className="form-error">{error}</div>}
      {stocking && (
        <form className="inventory-stock-form" onSubmit={adjust}>
          <label className="field">
            <span>Değişim miktarı</span>
            <input
              type="number"
              step="0.001"
              placeholder="5 veya -2"
              required
              value={stock.quantity_change}
              onChange={(e) =>
                setStock({ ...stock, quantity_change: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span>İşlem gerekçesi</span>
            <input
              minLength={3}
              maxLength={500}
              required
              value={stock.reason}
              onChange={(e) => setStock({ ...stock, reason: e.target.value })}
            />
          </label>
          <button>Stoku kaydet</button>
          <button
            type="button"
            className="secondary"
            onClick={() => setStocking(false)}
          >
            Vazgeç
          </button>
        </form>
      )}
      {managingMedia && <MediaManager item={item} onError={setError} />}
      <footer>
        <div>
          <span>{typeLabels[item.itemType]}</span>
          {columns.includes("visibility") && <span>{visibilityLabels[item.publicVisibility]}</span>}
        </div>
        <div>
          {can("inventory.adjust_stock") && !item.isArchived && (
            <button type="button" onClick={() => setStocking(!stocking)}>
              Stok işlemi
            </button>
          )}
          {can("inventory.update") && !item.isArchived && (
            <button type="button" onClick={() => setEditing(true)}>
              Düzenle
            </button>
          )}
          {can("inventory.manage_media") && !item.isArchived && (
            <button type="button" onClick={() => setManagingMedia(!managingMedia)}>
              Medya ({item.media.length})
            </button>
          )}
          {can("inventory.archive") && !item.isArchived && (
            <button
              type="button"
              className="danger"
              onClick={() =>
                window.confirm(`${item.name} arşivlensin mi?`) &&
                router.patch(
                  `/yonetim/envanter/${item.id}/arsiv`,
                  {},
                  { preserveScroll: true },
                )
              }
            >
              Arşivle
            </button>
          )}
          {canPurge && (
            <button
              type="button"
              className="danger"
              onClick={() => setConfirmingPurge(true)}
            >
              Kalıcı sil
            </button>
          )}
        </div>
      </footer>
      <ConfirmDialog open={confirmingPurge} eyebrow="KALICI SİLME" title={`${item.name} kalıcı olarak silinsin mi?`} description="Bu malzeme; stok hareketleri, teslim kayıtları ve medya dosyalarıyla birlikte silinecek. Bu işlem geri alınamaz." confirmLabel="Malzemeyi kalıcı sil" tone="danger" processing={purging} onClose={() => setConfirmingPurge(false)} onConfirm={purge} />
    </article>
  );
}

function MediaManager({ item, onError }: { item: Item; onError: (message: string) => void }) {
  const [kind, setKind] = useState<'image' | 'video' | 'link'>('image');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [altText, setAltText] = useState('');
  const [url, setUrl] = useState('');
  useUnsavedChanges(hasFormChanged(
    { kind: 'image', hasFile: false, title: '', altText: '', url: '' },
    { kind, hasFile: file !== null, title, altText, url },
  ));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = new FormData();
    payload.append('type', kind); payload.append('title', title); payload.append('alt_text', altText);
    if (file) payload.append('file', file);
    if (url) payload.append('external_url', url);
    router.post(`/yonetim/envanter/${item.id}/medya`, payload, {
      forceFormData: true, preserveScroll: true,
      onSuccess: () => { setFile(null); setTitle(''); setAltText(''); setUrl(''); },
      onError: (errors) => onError(Object.values(errors)[0] ?? 'Medya eklenemedi.'),
    });
  };
  return <section className="inventory-media-manager" aria-label={`${item.name} medya yönetimi`}>
    <div className="inventory-media-list">{item.media.map((medium, index) => <MediaEditor itemId={item.id} medium={medium} first={index === 0} last={index === item.media.length - 1} onError={onError} key={medium.id} />)}</div>
    <form onSubmit={submit}><div className="inventory-media-kind">{(['image', 'video', 'link'] as const).map((value) => <label className={kind === value ? 'selected' : ''} key={value}><input type="radio" name={`media-type-${item.id}`} checked={kind === value} onChange={() => { setKind(value); setFile(null); }} /><span>{value === 'image' ? 'Fotoğraf' : value === 'video' ? 'Video' : 'Bağlantı'}</span></label>)}</div>
      <div className="inventory-media-fields">{kind === 'link' ? <label className="field"><span>HTTPS bağlantısı</span><input type="url" required pattern="https://.*" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></label> : <label className="field"><span>{kind === 'image' ? 'JPG, PNG veya WebP · en fazla 8 MB' : 'MP4 veya WebM · en fazla 50 MB'}</span><input type="file" required accept={kind === 'image' ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' : '.mp4,.webm,video/mp4,video/webm'} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>}<label className="field"><span>Başlık (isteğe bağlı)</span><input maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} /></label>{kind === 'image' && <label className="field"><span>Görsel açıklaması</span><input required maxLength={180} value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Görselde ne olduğunu kısaca yazın" /></label>}<button className="settings-submit">Medya ekle</button></div>
    </form>
  </section>;
}

function MediaEditor({ itemId, medium, first, last, onError }: { itemId: number; medium: Media; first: boolean; last: boolean; onError: (message: string) => void }) {
  const initialValues = { title: medium.title ?? '', alt_text: medium.altText ?? '', external_url: medium.type === 'link' ? medium.url : '', sort_order: medium.sortOrder, is_cover: medium.isCover };
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(initialValues);
  useUnsavedChanges(editing && hasFormChanged(initialValues, values));
  const save = (changes: Partial<typeof values> = {}) => router.patch(`/yonetim/envanter/${itemId}/medya/${medium.id}`, { ...values, ...changes }, { preserveScroll: true, onSuccess: () => setEditing(false), onError: (errors) => onError(Object.values(errors)[0] ?? 'Medya güncellenemedi.') });
  return <article>
    {medium.type === 'image' ? <img src={medium.url} alt={medium.altText ?? ''} /> : medium.type === 'video' ? <video src={medium.url} controls preload="metadata" /> : <a href={medium.url} target="_blank" rel="noopener noreferrer">Bağlantıyı aç ↗</a>}
    {editing ? <div className="inventory-media-edit"><input aria-label="Medya başlığı" maxLength={180} value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />{medium.type === 'image' && <input aria-label="Görsel açıklaması" required maxLength={180} value={values.alt_text} onChange={(event) => setValues({ ...values, alt_text: event.target.value })} />}{medium.type === 'link' && <input aria-label="HTTPS bağlantısı" type="url" required pattern="https://.*" value={values.external_url} onChange={(event) => setValues({ ...values, external_url: event.target.value })} />}<div><button type="button" onClick={() => save()}>Kaydet</button><button type="button" onClick={() => setEditing(false)}>Vazgeç</button></div></div> : <div><strong>{medium.title || (medium.type === 'image' ? 'Fotoğraf' : medium.type === 'video' ? 'Video' : 'Bağlantı')}</strong>{medium.isCover && <span>Kapak</span>}<small>{medium.altText || medium.url}</small></div>}
    <div className="inventory-media-actions"><button type="button" disabled={first} aria-label="Medyayı yukarı taşı" onClick={() => save({ sort_order: Math.max(0, medium.sortOrder - 1) })}>↑</button><button type="button" disabled={last} aria-label="Medyayı aşağı taşı" onClick={() => save({ sort_order: medium.sortOrder + 1 })}>↓</button><button type="button" onClick={() => setEditing(!editing)}>Düzenle</button>{medium.type === 'image' && !medium.isCover && <button type="button" onClick={() => save({ is_cover: true })}>Kapak yap</button>}<button className="danger" type="button" onClick={() => window.confirm('Bu medya kaldırılsın mı?') && router.delete(`/yonetim/envanter/${itemId}/medya/${medium.id}`, { preserveScroll: true })}>Kaldır</button></div>
  </article>;
}

function CategoryRow({
  item,
  onError,
}: {
  item: Option;
  onError: (message: string) => void;
}) {
  const initialData = {
    name: item.name,
    description: item.description ?? "",
    is_active: item.isActive,
  };
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState(initialData);
  useUnsavedChanges(editing && hasFormChanged(initialData, data));
  if (!editing)
    return (
      <article className={!item.isActive ? "inactive" : ""}>
        <div>
          <strong>{item.name}</strong>
          <small>
            {item.itemCount} malzeme · {item.isActive ? "Kullanımda" : "Pasif"}
          </small>
        </div>
        <button type="button" onClick={() => setEditing(true)}>
          Düzenle
        </button>
      </article>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.patch(`/yonetim/envanter-kategorileri/${item.id}`, data, {
          preserveScroll: true,
          onSuccess: () => setEditing(false),
          onError: (e) =>
            onError(Object.values(e)[0] ?? "Kategori güncellenemedi."),
        });
      }}
    >
      <label className="field">
        <span>Kategori adı</span>
        <input
          required
          maxLength={120}
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Açıklama</span>
        <input
          maxLength={1000}
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
        />
      </label>
      <label className="day-toggle">
        <input
          type="checkbox"
          checked={data.is_active}
          onChange={(e) => setData({ ...data, is_active: e.target.checked })}
        />
        <span>Kullanımda</span>
      </label>
      <div>
        <button type="button" onClick={() => setEditing(false)}>
          Vazgeç
        </button>
        <button>Kaydet</button>
      </div>
    </form>
  );
}

function LocationRow({
  item,
  onError,
}: {
  item: Location;
  onError: (message: string) => void;
}) {
  const initialData = {
    name: item.name,
    code: item.code,
    description: item.description ?? "",
    is_public: item.isPublic,
    is_active: item.isActive,
  };
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState(initialData);
  useUnsavedChanges(editing && hasFormChanged(initialData, data));
  if (!editing)
    return (
      <article className={!item.isActive ? "inactive" : ""}>
        <div>
          <strong>
            {item.code} · {item.name}
          </strong>
          <small>
            {item.itemCount} malzeme · {item.isActive ? "Kullanımda" : "Pasif"}{" "}
            · {item.isPublic ? "Katalogda görünür" : "Yalnızca yönetim"}
          </small>
        </div>
        <button type="button" onClick={() => setEditing(true)}>
          Düzenle
        </button>
      </article>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.patch(`/yonetim/envanter-konumlari/${item.id}`, data, {
          preserveScroll: true,
          onSuccess: () => setEditing(false),
          onError: (e) =>
            onError(Object.values(e)[0] ?? "Konum güncellenemedi."),
        });
      }}
    >
      <label className="field">
        <span>Konum adı</span>
        <input
          required
          maxLength={120}
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Kısa kod</span>
        <input
          required
          maxLength={50}
          value={data.code}
          onChange={(e) =>
            setData({ ...data, code: e.target.value.toUpperCase() })
          }
        />
      </label>
      <label className="field">
        <span>Açıklama</span>
        <input
          maxLength={1000}
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
        />
      </label>
      <label className="day-toggle">
        <input
          type="checkbox"
          checked={data.is_active}
          onChange={(e) => setData({ ...data, is_active: e.target.checked })}
        />
        <span>Kullanımda</span>
      </label>
      <label className="day-toggle">
        <input
          type="checkbox"
          checked={data.is_public}
          onChange={(e) => setData({ ...data, is_public: e.target.checked })}
        />
        <span>Katalogda göster</span>
      </label>
      <div>
        <button type="button" onClick={() => setEditing(false)}>
          Vazgeç
        </button>
        <button>Kaydet</button>
      </div>
    </form>
  );
}

function Definitions({
  categories,
  locations,
}: {
  categories: Option[];
  locations: Location[];
}) {
  const can = usePermissions();
  const initial = can("inventory.manage_categories") ? "category" : "location";
  const [tab, setTab] = useState<"category" | "location">(initial);
  const [error, setError] = useState("");
  const [cat, setCat] = useState({
    name: "",
    description: "",
    is_active: true,
  });
  const [loc, setLoc] = useState({
    name: "",
    code: "",
    description: "",
    is_public: true,
    is_active: true,
  });
  useUnsavedChanges(hasFormChanged({ name: "", description: "", is_active: true }, cat));
  useUnsavedChanges(hasFormChanged({ name: "", code: "", description: "", is_public: true, is_active: true }, loc));
  if (!can("inventory.manage_categories") && !can("inventory.manage_locations"))
    return null;
  return (
    <section className="admin-panel inventory-definitions">
      <header>
        <div>
          <h2>Kategori ve konumlar</h2>
          <p>
            Pasifleştirilen seçenekler yeni malzeme kayıtlarında kullanılamaz;
            mevcut kayıtlar korunur.
          </p>
        </div>
        <div>
          {can("inventory.manage_categories") && (
            <button
              className={tab === "category" ? "active" : ""}
              onClick={() => setTab("category")}
            >
              Kategoriler
            </button>
          )}
          {can("inventory.manage_locations") && (
            <button
              className={tab === "location" ? "active" : ""}
              onClick={() => setTab("location")}
            >
              Konumlar
            </button>
          )}
        </div>
      </header>
      {error && <div className="form-error">{error}</div>}
      {tab === "category" && can("inventory.manage_categories") && (
        <>
          <div className="definition-list">
            {categories.map((x) => (
              <CategoryRow item={x} onError={setError} key={x.id} />
            ))}
          </div>
          <form
            className="definition-form"
            onSubmit={(e) => {
              e.preventDefault();
              router.post("/yonetim/envanter-kategorileri", cat, {
                preserveScroll: true,
                onSuccess: () =>
                  setCat({ name: "", description: "", is_active: true }),
                onError: (e) =>
                  setError(Object.values(e)[0] ?? "Kaydedilemedi."),
              });
            }}
          >
            <label className="field">
              <span>Yeni kategori</span>
              <input
                required
                maxLength={120}
                value={cat.name}
                onChange={(e) => setCat({ ...cat, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Açıklama</span>
              <input
                maxLength={1000}
                value={cat.description}
                onChange={(e) =>
                  setCat({ ...cat, description: e.target.value })
                }
              />
            </label>
            <button>Kategori ekle</button>
          </form>
        </>
      )}
      {tab === "location" && can("inventory.manage_locations") && (
        <>
          <div className="definition-list">
            {locations.map((x) => (
              <LocationRow item={x} onError={setError} key={x.id} />
            ))}
          </div>
          <form
            className="definition-form"
            onSubmit={(e) => {
              e.preventDefault();
              router.post("/yonetim/envanter-konumlari", loc, {
                preserveScroll: true,
                onSuccess: () =>
                  setLoc({
                    name: "",
                    code: "",
                    description: "",
                    is_public: true,
                    is_active: true,
                  }),
                onError: (e) =>
                  setError(Object.values(e)[0] ?? "Kaydedilemedi."),
              });
            }}
          >
            <label className="field">
              <span>Yeni konum</span>
              <input
                required
                maxLength={120}
                value={loc.name}
                onChange={(e) => setLoc({ ...loc, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Kısa kod</span>
              <input
                required
                maxLength={50}
                value={loc.code}
                onChange={(e) =>
                  setLoc({ ...loc, code: e.target.value.toUpperCase() })
                }
              />
            </label>
            <button>Konum ekle</button>
          </form>
        </>
      )}
    </section>
  );
}

export default function Inventory({
  items,
  filters,
  summary,
  categories,
  locations,
  recentMovements,
}: {
  items: PageData;
  filters: Record<string, string>;
  summary: Record<string, number>;
  categories: Option[];
  locations: Location[];
  recentMovements: Movement[];
}) {
  const can = usePermissions();
  const page = usePage<{ auth: { user: { isSystemAdministrator: boolean; tablePreferences: Record<string, string[]> } }; flash: { bulkResult?: BulkResult } }>();
  const isSystemAdministrator = page.props.auth.user.isSystemAdministrator;
  const columnDefinitions: ColumnDefinition[] = [
    { key: "name", label: "Malzeme adı" },
    { key: "category", label: "Kategori" },
    { key: "location", label: "Konum" },
    { key: "quantity", label: "Stok miktarı" },
    { key: "visibility", label: "Katalog görünürlüğü" },
  ];
  const [columns, setColumns] = useState(() => initialTableColumns(page.props.auth.user.tablePreferences.inventory, columnDefinitions));
  const [creating, setCreating] = useState(false);
  const [data, setData] = useState<ItemForm>(emptyItem);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(filters.search);
  const createChanged = creating && hasFormChanged(emptyItem, data);
  useUnsavedChanges(createChanged);
  const { draft, clearDraft } = useSafeDraft({ key: "inventory.create", source: data, fields: safeDraftFields.inventoryItem, enabled: createChanged });
  const canUseBulk = can("inventory.update") || can("inventory.archive");
  const selectableItems = items.data.filter((item) => !item.isArchived);
  const selection = usePageSelection(canUseBulk ? selectableItems.map((item) => item.id) : []);
  const selectedItems = selectableItems.filter((item) => selection.selected.has(item.id));
  const bulkResult = page.props.flash.bulkResult;
  const filter = (changes: Record<string, string>) =>
    router.get(
      "/yonetim/envanter",
      { ...filters, ...changes },
      { preserveState: true, preserveScroll: true, replace: true },
    );
  const exportUrl = `/yonetim/envanter-disa-aktar?${new URLSearchParams(filters).toString()}`;
  return (
    <AdminLayout>
      <Head title="Malzeme Envanteri" />
      <header className="admin-title inventory-title">
        <div>
          <span className="booking-kicker">ATÖLYE ENVANTERİ</span>
          <h1>Malzemeler</h1>
          <p>Stokları, konumları ve tüm hareketleri tek yerden yönetin.</p>
        </div>
        <div>
          {can("inventory.import") && (
            <Link href="/yonetim/envanter-ice-aktar">CSV yükle</Link>
          )}
          {can("inventory.export") && <a href={exportUrl}>CSV indir</a>}
          {can("inventory.create") && (
            <button onClick={() => setCreating(!creating)}>
              {creating ? "Formu kapat" : "Yeni malzeme"}
            </button>
          )}
        </div>
      </header>
      <section className="inventory-summary">
        <button onClick={() => filter({ status: "active" })}>
          <strong>{summary.total}</strong>
          <span>Aktif malzeme</span>
        </button>
        <button onClick={() => filter({ status: "inactive" })}>
          <strong>{summary.inactive}</strong>
          <span>Pasif malzeme</span>
        </button>
        <button onClick={() => filter({ status: "low" })}>
          <strong>{summary.low}</strong>
          <span>Kritik stok</span>
        </button>
        <button onClick={() => filter({ status: "out" })}>
          <strong>{summary.out}</strong>
          <span>Tükenen</span>
        </button>
        <button onClick={() => filter({ status: "archived" })}>
          <strong>{summary.archived}</strong>
          <span>Arşivlenen</span>
        </button>
      </section>
      {creating && (
        <form
          className="admin-panel inventory-create"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            router.post("/yonetim/envanter", data, {
              preserveScroll: true,
              onSuccess: () => {
                setCreating(false);
                setData(emptyItem);
              },
              onError: (e) =>
                setError(Object.values(e)[0] ?? "Malzeme eklenemedi."),
            });
          }}
        >
          <h2>Yeni malzeme</h2>
          <p>Başlangıç miktarı ilk stok hareketi olarak kaydedilir.</p>
          {draft && <DraftRecoveryNotice updatedAt={draft.updatedAt} onDiscard={clearDraft} onRestore={() => { setData((current) => ({ ...current, ...draft.value })); clearDraft(); }} />}
          {error && <div className="form-error">{error}</div>}
          <Fields
            data={data}
            setData={setData}
            categories={categories}
            locations={locations}
            creating
            canChangeType
          />
          <button className="settings-submit">Malzemeyi ekle</button>
        </form>
      )}
      <Definitions categories={categories} locations={locations} />
      <form
        className="admin-panel inventory-filters"
        onSubmit={(e) => {
          e.preventDefault();
          filter({ search });
        }}
      >
        <label className="field">
          <span>Malzeme ara</span>
          <input
            value={search}
            placeholder="Ad veya stok kodu"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Kategori</span>
          <select
            value={filters.category}
            onChange={(e) => filter({ category: e.target.value })}
          >
            <option value="">Tümü</option>
            {categories.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tür</span>
          <select
            value={filters.type}
            onChange={(e) => filter({ type: e.target.value })}
          >
            <option value="">Tümü</option>
            {Object.entries(typeLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Durum</span>
          <select
            value={filters.status}
            onChange={(e) => filter({ status: e.target.value })}
          >
            <option value="all">Tüm etkinlik durumları</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="low">Kritik stok</option>
            <option value="out">Tükenen</option>
            <option value="archived">Arşivlenen</option>
          </select>
        </label>
        <button>Ara</button>
      </form>
      <SavedFilters table="inventory" path="/yonetim/envanter" current={{ search: filters.search, category: filters.category, type: filters.type, status: filters.status }} />
      <ListSort sort={filters.sort} direction={filters.direction} options={[{ value: 'name', label: 'Malzeme adı' }, { value: 'quantity', label: 'Stok miktarı' }, { value: 'minimum_stock', label: 'Kritik stok eşiği' }, { value: 'updated_at', label: 'Son güncelleme' }]} />
      <TableColumns table="inventory" definitions={columnDefinitions} active={columns} setActive={setColumns} reorderable={false} />
      {canUseBulk && selectableItems.length > 0 && <BulkSelection selectedCount={selection.selectedCount} pageCount={selection.pageCount} allSelected={selection.allSelected} partiallySelected={selection.partiallySelected} onTogglePage={selection.togglePage} onClear={selection.clear}>
        <InventoryBulkActions selectedItems={selectedItems} categories={categories} locations={locations} canUpdate={can("inventory.update")} canArchive={can("inventory.archive")} onSuccess={selection.clear} />
      </BulkSelection>}
      {bulkResult && <section className={`bulk-result ${bulkResult.failureCount > 0 ? "has-failures" : "is-success"}`} role="status">
        <header><div><strong>Toplu işlem sonucu</strong><span>{bulkResult.successCount} başarılı · {bulkResult.failureCount} atlandı</span></div></header>
        {bulkResult.failureCount > 0 && <><p>Atlanan kayıtlar değiştirilmedi. Aşağıdaki nedenleri inceleyip gerekirse yeniden deneyin.</p><ul>{bulkResult.failures.map((failure) => <li key={failure.id}><strong>{failure.name}</strong><span>{failure.reason}</span></li>)}</ul></>}
      </section>}
      <section className="inventory-list">
        {items.data.map((x) => (
          <ItemCard
            item={x}
            categories={categories}
            locations={locations}
            canPurge={isSystemAdministrator}
            columns={columns}
            selectable={canUseBulk && !x.isArchived}
            selected={selection.selected.has(x.id)}
            onSelectionChange={(checked) => selection.setSelected(x.id, checked)}
            key={x.id}
          />
        ))}
        {!items.data.length && (
          <div className="admin-empty">
            Bu filtrelerle eşleşen malzeme bulunamadı.
          </div>
        )}
      </section>
      {items.links.length > 3 && (
        <nav className="admin-pagination">
          {items.links.map((x, i) =>
            !x.url && (i === 0 || i === items.links.length - 1) ? null : x.url ? (
              <Link
                key={i}
                className={x.active ? "active" : ""}
                href={x.url}
                preserveScroll
                preserveState
                dangerouslySetInnerHTML={{ __html: x.label }}
              />
            ) : (
              <span key={i} dangerouslySetInnerHTML={{ __html: x.label }} />
            ),
          )}
        </nav>
      )}
      {can("inventory.view_movements") && (
        <section className="admin-panel inventory-movements">
          <h2>Son stok hareketleri</h2>
          {recentMovements.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Malzeme</th>
                    <th>Hareket</th>
                    <th>Bakiye</th>
                    <th>Gerekçe</th>
                    <th>İşlemi yapan</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map((x) => (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.item}</strong>
                        <small>{x.createdAt}</small>
                      </td>
                      <td
                        className={
                          Number(x.change) >= 0 ? "positive" : "negative"
                        }
                      >
                        {Number(x.change) > 0 ? "+" : ""}
                        {Number(x.change).toLocaleString("tr-TR")} {x.unit}
                        <small>{movementLabels[x.type]}</small>
                      </td>
                      <td>
                        {Number(x.balance).toLocaleString("tr-TR")} {x.unit}
                      </td>
                      <td>{x.reason || "—"}</td>
                      <td>{x.actor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="settings-empty">Henüz stok hareketi yok.</p>
          )}
        </section>
      )}
    </AdminLayout>
  );
}
