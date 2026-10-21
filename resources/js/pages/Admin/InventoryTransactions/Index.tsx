import AdminLayout from "@/components/AdminLayout";
import StatusBadge from "@/components/StatusBadge";
import ListSort from "@/components/ListSort";
import usePermissions from "@/hooks/usePermissions";
import { Head, Link, router } from "@inertiajs/react";
import { FormEvent, useMemo, useState } from "react";

type Item = {
  id: number;
  name: string;
  type: string;
  quantity: string;
  unit: string;
};
type Transaction = {
  id: number;
  item: string;
  unit: string;
  itemType: string;
  status: string;
  recipientName: string;
  recipientEmail: string | null;
  quantity: string;
  quantityReturned: string;
  remaining: string;
  issuedAt: string;
  dueAt: string | null;
  isOverdue: boolean;
  completedAt: string | null;
  notes: string | null;
  closureNote: string | null;
  issuer: string;
};
type PageData = {
  data: Transaction[];
  links: { url: string | null; label: string; active: boolean }[];
};
const typeLabels: Record<string, string> = {
  consumable: "Sarf teslimi",
  loanable: "Ödünç",
  fixed_asset: "Demirbaş kullanımı",
};
const statusLabels: Record<string, string> = {
  active: "Aktif",
  completed: "Tamamlandı",
  damaged: "Hasarlı",
  lost: "Kayıp",
};

function TransactionCard({ transaction }: { transaction: Transaction }) {
  const can = usePermissions();
  const [mode, setMode] = useState<"return" | "damaged" | "lost" | null>(null);
  const [quantity, setQuantity] = useState(transaction.remaining);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "return")
      router.post(
        `/yonetim/teslimler/${transaction.id}/iade`,
        { quantity, note },
        {
          preserveScroll: true,
          onSuccess: () => setMode(null),
          onError: (e) =>
            setError(Object.values(e)[0] ?? "İade kaydedilemedi."),
        },
      );
    else
      router.patch(
        `/yonetim/teslimler/${transaction.id}/kapat`,
        { status: mode, note },
        {
          preserveScroll: true,
          onSuccess: () => setMode(null),
          onError: (e) =>
            setError(Object.values(e)[0] ?? "Kayıt kapatılamadı."),
        },
      );
  };
  return (
    <article
      className={`admin-panel loan-card ${transaction.isOverdue ? "overdue" : ""}`}
    >
      <header>
        <div>
          <span>
            {typeLabels[transaction.itemType]} · {transaction.issuedAt}
          </span>
          <h3>{transaction.item}</h3>
          <p>
            {transaction.recipientName}
            {transaction.recipientEmail && <> · {transaction.recipientEmail}</>}
          </p>
        </div>
        <StatusBadge
          status={transaction.isOverdue ? "overdue" : transaction.status}
          label={transaction.isOverdue ? "Gecikmiş" : statusLabels[transaction.status]}
        />
      </header>
      <dl>
        <div>
          <dt>Verilen</dt>
          <dd>
            {Number(transaction.quantity).toLocaleString("tr-TR")}{" "}
            {transaction.unit}
          </dd>
        </div>
        <div>
          <dt>Kalan</dt>
          <dd>
            {Number(transaction.remaining).toLocaleString("tr-TR")}{" "}
            {transaction.unit}
          </dd>
        </div>
        <div>
          <dt>Beklenen iade</dt>
          <dd>{transaction.dueAt ?? "—"}</dd>
        </div>
        <div>
          <dt>Kaydeden</dt>
          <dd>{transaction.issuer}</dd>
        </div>
      </dl>
      {transaction.notes && <p className="loan-note">{transaction.notes}</p>}
      {transaction.closureNote && (
        <p className="loan-note">Kapanış: {transaction.closureNote}</p>
      )}
      {error && <div className="form-error">{error}</div>}
      {mode && (
        <form className="loan-action-form" onSubmit={submit}>
          {mode === "return" && (
            <label className="field">
              <span>İade miktarı</span>
              <input
                type="number"
                min="0.001"
                max={transaction.remaining}
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </label>
          )}
          <label className="field">
            <span>{mode === "return" ? "İade notu" : "Zorunlu açıklama"}</span>
            <input
              value={note}
              minLength={mode === "return" ? 0 : 3}
              maxLength={1000}
              required={mode !== "return"}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button>Kaydet</button>
          <button type="button" onClick={() => setMode(null)}>
            Vazgeç
          </button>
        </form>
      )}
      {transaction.status === "active" && (
        <footer>
          {can("loans.receive_return") && (
            <button onClick={() => setMode("return")}>
              {transaction.itemType === "fixed_asset"
                ? "Kullanımı bitir"
                : "İade al"}
            </button>
          )}
          {can("loans.report_damage") && (
            <button onClick={() => setMode("damaged")}>Hasarlı</button>
          )}
          {can("loans.report_lost") && (
            <button className="danger" onClick={() => setMode("lost")}>
              Kayıp
            </button>
          )}
        </footer>
      )}
    </article>
  );
}

export default function Transactions({
  transactions,
  items,
  filter,
  counts,
  sorting,
}: {
  transactions: PageData;
  items: Item[];
  filter: string;
  counts: { active: number; overdue: number };
  sorting: { sort: string; direction: string };
}) {
  const can = usePermissions();
  const [data, setData] = useState({
    inventory_item_id: "",
    recipient_name: "",
    recipient_email: "",
    quantity: "1",
    due_at: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const selected = useMemo(
    () => items.find((x) => String(x.id) === data.inventory_item_id),
    [items, data.inventory_item_id],
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    router.post("/yonetim/teslimler", data, {
      preserveScroll: true,
      onSuccess: () =>
        setData({
          inventory_item_id: "",
          recipient_name: "",
          recipient_email: "",
          quantity: "1",
          due_at: "",
          notes: "",
        }),
      onError: (e) => setError(Object.values(e)[0] ?? "Teslim kaydedilemedi."),
    });
  };
  return (
    <AdminLayout>
      <Head title="Teslim ve İadeler" />
      <header className="admin-title">
        <div>
          <span className="booking-kicker">MALZEME HAREKETLERİ</span>
          <h1>Teslim ve iadeler</h1>
          <p>Sarf teslimlerini, ödünçleri ve demirbaş kullanımını kaydedin.</p>
        </div>
      </header>
      {can("loans.create") && (
        <form className="admin-panel loan-create" onSubmit={submit}>
          <div className="settings-heading">
            <div>
              <h2>Yeni teslim</h2>
              <p>Ad soyad zorunlu, e-posta isteğe bağlıdır.</p>
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="field-grid">
            <label className="field full">
              <span>Malzeme</span>
              <select
                required
                value={data.inventory_item_id}
                onChange={(e) =>
                  setData({
                    ...data,
                    inventory_item_id: e.target.value,
                    due_at: "",
                  })
                }
              >
                <option value="">Malzeme seçin</option>
                {items.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.name} · {typeLabels[x.type]} ·{" "}
                    {Number(x.quantity).toLocaleString("tr-TR")} {x.unit}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Ad soyad</span>
              <input
                required
                maxLength={150}
                value={data.recipient_name}
                onChange={(e) =>
                  setData({ ...data, recipient_name: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>E-posta (isteğe bağlı)</span>
              <input
                type="email"
                maxLength={255}
                value={data.recipient_email}
                onChange={(e) =>
                  setData({ ...data, recipient_email: e.target.value })
                }
              />
            </label>
            <label className="field">
              <span>Miktar</span>
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                value={data.quantity}
                onChange={(e) => setData({ ...data, quantity: e.target.value })}
              />
            </label>
            {selected?.type === "loanable" && (
              <label className="field">
                <span>Beklenen iade</span>
                <input
                  type="datetime-local"
                  required
                  value={data.due_at}
                  onChange={(e) => setData({ ...data, due_at: e.target.value })}
                />
              </label>
            )}
            <label className="field full">
              <span>İşlem notu</span>
              <textarea
                rows={2}
                maxLength={2000}
                value={data.notes}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
              />
            </label>
          </div>
          <button className="settings-submit">Teslimi kaydet</button>
        </form>
      )}
      <nav className="feedback-filters loan-filters">
        {[
          ["active", `Aktif (${counts.active})`],
          ["overdue", `Gecikmiş (${counts.overdue})`],
          ["completed", "Tamamlanan"],
          ["damaged", "Hasarlı"],
          ["lost", "Kayıp"],
        ].map(([value, label]) => (
          <button
            className={filter === value ? "active" : ""}
            onClick={() =>
              router.get(
                "/yonetim/teslimler",
                { status: value, ...sorting },
                { preserveState: true, preserveScroll: true, replace: true },
              )
            }
            key={value}
          >
            {label}
          </button>
        ))}
      </nav>
      <ListSort sort={sorting.sort} direction={sorting.direction} options={[{ value: 'issued_at', label: 'Teslim zamanı' }, { value: 'due_at', label: 'Beklenen iade' }, { value: 'quantity', label: 'Miktar' }, { value: 'status', label: 'Durum' }]} />
      <section className="loan-list">
        {transactions.data.map((x) => (
          <TransactionCard transaction={x} key={x.id} />
        ))}
        {!transactions.data.length && (
          <div className="admin-empty">Bu durumda teslim kaydı bulunmuyor.</div>
        )}
      </section>
      {transactions.links.length > 3 && (
        <nav className="admin-pagination">
          {transactions.links.map((x, i) =>
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
    </AdminLayout>
  );
}
