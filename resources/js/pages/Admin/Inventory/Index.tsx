import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/StatusBadge";
import usePermissions from "@/hooks/usePermissions";
import { Head, Link, router } from "@inertiajs/react";
import { FormEvent, useState } from "react";

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
}: {
  item: Item;
  categories: Option[];
  locations: Location[];
}) {
  const can = usePermissions();
  const [editing, setEditing] = useState(false);
  const [stocking, setStocking] = useState(false);
  const [error, setError] = useState("");
  const [stock, setStock] = useState({ quantity_change: "", reason: "" });
  const [data, setData] = useState<ItemForm>({
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
  });
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
  if (editing)
    return (
      <form className="admin-panel inventory-edit" onSubmit={save}>
        <h2>{item.name}</h2>
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
      className={`admin-panel inventory-item ${item.isLow ? "low" : ""}`}
    >
      <div className="inventory-item-main">
        <div>
          <span>{item.sku || typeLabels[item.itemType]}</span>
          <h3>{item.name}</h3>
          <p>
            {[item.category, item.location].filter(Boolean).join(" · ") ||
              "Kategori ve konum belirtilmedi"}
          </p>
        </div>
        <div className="inventory-quantity">
          <strong>
            {Number(item.quantity).toLocaleString("tr-TR")}{" "}
            <small>{item.unit}</small>
          </strong>
          <StatusBadge
            status={Number(item.quantity) <= 0 ? "out" : item.isLow ? "low" : "available"}
            label={Number(item.quantity) <= 0 ? "Tükendi" : item.isLow ? "Kritik stok" : "Stokta"}
          />
        </div>
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
      <footer>
        <div>
          <span>{typeLabels[item.itemType]}</span>
          <span>{visibilityLabels[item.publicVisibility]}</span>
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
        </div>
      </footer>
    </article>
  );
}

function CategoryRow({
  item,
  onError,
}: {
  item: Option;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState({
    name: item.name,
    description: item.description ?? "",
    is_active: item.isActive,
  });
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
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState({
    name: item.name,
    code: item.code,
    description: item.description ?? "",
    is_public: item.isPublic,
    is_active: item.isActive,
  });
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
  const [creating, setCreating] = useState(false);
  const [data, setData] = useState<ItemForm>(emptyItem);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(filters.search);
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
            <option value="active">Aktif</option>
            <option value="low">Kritik stok</option>
            <option value="out">Tükenen</option>
            <option value="archived">Arşivlenen</option>
          </select>
        </label>
        <button>Ara</button>
      </form>
      <section className="inventory-list">
        {items.data.map((x) => (
          <ItemCard
            item={x}
            categories={categories}
            locations={locations}
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
            x.url ? (
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
