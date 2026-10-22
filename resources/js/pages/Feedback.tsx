import { Head, useForm, usePage } from "@inertiajs/react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { FormEvent } from "react";

type PageProps = { flash: { success?: string } };

export default function Feedback() {
  const { flash } = usePage<PageProps>().props;
  const form = useForm({ type: "suggestion", message: "", website: "" });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post("/geri-bildirim", {
      preserveScroll: true,
      onSuccess: () => form.reset("message"),
    });
  }

  return (
    <main className="feedback-page public-page-shell">
      <Head title="Geri Bildirim" />
      <PublicHeader />
      <section className="feedback-shell">
        <div className="feedback-intro">
          <span className="eyebrow">GERİ BİLDİRİM</span>
          <h1>Atölyeyi birlikte iyileştirelim.</h1>
          <p>
            Bir öneriyi, şikâyeti veya internet sitesinde karşılaştığınız hatayı
            yönetime iletin.
          </p>
        </div>
        <form className="feedback-form" onSubmit={submit}>
          {flash.success && (
            <div className="admin-flash success">{flash.success}</div>
          )}
          <label className="field">
            <span>Bildirim türü</span>
            <select
              value={form.data.type}
              onChange={(event) => form.setData("type", event.target.value)}
            >
              <option value="suggestion">Öneri</option>
              <option value="complaint">Şikâyet</option>
              <option value="bug">Site veya sistem hatası</option>
            </select>
          </label>
          <label className="field">
            <span>Açıklama</span>
            <textarea
              rows={8}
              maxLength={3000}
              value={form.data.message}
              onChange={(event) => form.setData("message", event.target.value)}
              placeholder="Ne olduğunu veya önerinizi açıkça anlatın."
              required
            />
          </label>
          <input
            className="feedback-honeypot"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={form.data.website}
            onChange={(event) => form.setData("website", event.target.value)}
          />
          <div className="feedback-privacy-note">
            <strong>Kişisel bilgi yazmayın.</strong>
            <span>
              Bu form ad, e-posta veya telefon istemez. Mesajınıza kendinizin ya
              da başka birinin kişisel bilgilerini eklemeyin.
            </span>
          </div>
          {Object.keys(form.errors).length > 0 && (
            <div className="form-error">{Object.values(form.errors)[0]}</div>
          )}
          <button className="button primary" disabled={form.processing}>
            {form.processing ? "Gönderiliyor…" : "Yönetime ilet"}
          </button>
        </form>
      </section>
      <PublicFooter />
    </main>
  );
}
