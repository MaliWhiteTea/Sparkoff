import { Head, Link } from "@inertiajs/react";
import PublicFooter from "@/components/PublicFooter";

type Props = {
  privacy: {
    controllerName: string;
    controllerAddress: string;
    contactEmail: string;
    appointmentRetentionMonths: number;
    fileRetentionDays: number;
    noticeVersion: string;
    isDraft: boolean;
  };
};

export default function PrivacyNotice({ privacy }: Props) {
  return (
    <main className="legal-page public-page-shell">
      <Head title="KVKK Aydınlatma Metni" />
      <header className="filaments-header">
        <Link className="booking-brand" href="/">
          <img src="/logo.jpg" alt="Sparkoff logosu" />
          <span>
            <strong>Sparkoff</strong>
            <small>Proje Atölyesi</small>
          </span>
        </Link>
        <Link className="module-home-link" href="/">
          Ana sayfaya dön
        </Link>
      </header>
      <article className="legal-document">
        <span className="eyebrow">KVKK AYDINLATMA METNİ</span>
        <h1>3D yazıcı randevu başvuruları</h1>
        <p className="legal-version">Sürüm: {privacy.noticeVersion}</p>
        {privacy.isDraft && (
          <p className="legal-draft">
            Bu metin yönetici tarafından taslak olarak işaretlenmiştir.
          </p>
        )}
        <section>
          <h2>Veri sorumlusu ve iletişim</h2>
          <p>
            Randevu başvurusu kapsamında işlenen kişisel veriler bakımından veri
            sorumlusu: <strong>{privacy.controllerName}</strong>.
          </p>
          {privacy.controllerAddress && (
            <p>Adres: {privacy.controllerAddress}</p>
          )}
          <p>
            Başvuru ve bilgi talepleri:{" "}
            <a href={`mailto:${privacy.contactEmail}`}>
              {privacy.contactEmail}
            </a>
          </p>
        </section>
        <section>
          <h2>İşlenen bilgiler</h2>
          <p>
            Ad, soyad ve e-posta adresi; seçilen tarih, saat ve süre; yüklenen
            3D model dosyası; filamentin kullanıcıya mı atölyeye mi ait olduğu
            ile filament türü ve rengi işlenir. Telefon numarası ve serbest
            açıklama alınmaz.
          </p>
        </section>
        <section>
          <h2>İşleme amacı</h2>
          <p>
            Bilgiler randevu talebini doğrulamak, baskının teknik uygunluğunu
            değerlendirmek, uygun yazıcı ve zamanı planlamak, başvurunun
            durumunu e-posta ile bildirmek ve atölye işleyişini yürütmek
            amacıyla kullanılır.
          </p>
        </section>
        <section>
          <h2>Toplama yöntemi ve hukuki sebep</h2>
          <p>
            Veriler, randevu formunun kullanıcı tarafından doldurulması yoluyla
            elektronik ortamda elde edilir. İşleme faaliyeti; talep edilen
            atölye hizmetinin kurulması ve yürütülmesi ile hizmetin güvenli ve
            düzenli biçimde planlanmasına ilişkin meşru menfaatler kapsamında,
            6698 sayılı Kanun’un 5. maddesindeki ilgili işleme şartlarına
            dayanır.
          </p>
        </section>
        <section>
          <h2>Aktarım ve güvenlik</h2>
          <p>
            Bilgiler herkese açık takvimde yayımlanmaz. Yalnızca yetkili
            yöneticiler erişebilir. Barındırma ve e-posta hizmeti sağlayıcıları,
            hizmetin teknik olarak sunulması ölçüsünde verilere erişebilir.
          </p>
        </section>
        <section>
          <h2>Saklama süresi</h2>
          <p>
            Randevu kayıtları en fazla {privacy.appointmentRetentionMonths} ay,
            yüklenen baskı dosyaları en fazla {privacy.fileRetentionDays} gün
            saklanacak şekilde yapılandırılmıştır. Hukuki bir zorunluluk veya
            uyuşmazlık bulunması hâlinde ilgili kayıtlar gerekli süre boyunca
            korunabilir.
          </p>
        </section>
        <section>
          <h2>Haklarınız</h2>
          <p>
            6698 sayılı Kanun’un 11. maddesi kapsamındaki bilgi edinme,
            düzeltme, silme ve diğer taleplerinizi yukarıdaki iletişim adresine
            iletebilirsiniz.
          </p>
        </section>
      </article>
      <PublicFooter />
    </main>
  );
}
