import { Head, useForm, usePage } from "@inertiajs/react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { FormEvent, useRef } from "react";

type PageProps = { flash: { success?: string } };
type FeedbackForm = {
  type: string;
  message: string;
  image: File | null;
  website: string;
};

export default function Feedback() {
  const { flash } = usePage<PageProps>().props;
  const imageInput = useRef<HTMLInputElement>(null);
  const form = useForm<FeedbackForm>({
    type: "suggestion",
    message: "",
    image: null,
    website: "",
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    form.post("/geri-bildirim", {
      preserveScroll: true,
      forceFormData: true,
      onSuccess: () => {
        form.reset("message", "image");
        if (imageInput.current) imageInput.current.value = "";
      },
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
            <div className="public-flash success" role="status">
              {flash.success}
            </div>
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
          <div className="feedback-upload">
            <label className="field" htmlFor="feedback-image">
              <span>Fotoğraf (isteğe bağlı)</span>
              <input
                ref={imageInput}
                id="feedback-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const image = event.target.files?.[0] ?? null;
                  if (image && image.size > 5 * 1024 * 1024) {
                    form.setData("image", null);
                    form.setError("image", "Fotoğraf en fazla 5 MB olabilir.");
                    event.target.value = "";
                    return;
                  }
                  form.clearErrors("image");
                  form.setData("image", image);
                }}
              />
            </label>
            <small>JPG, PNG veya WebP · en fazla 5 MB</small>
            {form.data.image && (
              <div className="feedback-selected-file">
                <span>{form.data.image.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    form.setData("image", null);
                    if (imageInput.current) imageInput.current.value = "";
                  }}
                >
                  Fotoğrafı kaldır
                </button>
              </div>
            )}
          </div>
          <input
            className="feedback-honeypot"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={form.data.website}
            onChange={(event) => form.setData("website", event.target.value)}
          />
          <div className="feedback-privacy-note">
            <strong>Ad, e-posta ve telefon numarası istemiyoruz.</strong>
            <span>
              Mesajınıza veya fotoğrafa size ya da başka birine ait kişisel bilgi
              eklemeyin.
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
