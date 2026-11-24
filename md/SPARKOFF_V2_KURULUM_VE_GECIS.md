# Sparkoff V2 kurulum ve geçiş notu

## Durum

V2 henüz geliştirme aşamasında. Bu belge canlı yayın talimatı olarak kullanılmamalı. V1 Laravel uygulaması ve veritabanı şu anda korunuyor. V2 için ayrı MySQL/MariaDB veritabanı açılmalı; mevcut `qmypllhw_sparkoff` veritabanında V2 migration komutu çalıştırılmamalı.

**9 Kasım 2026 barındırma kararı:** Kullanıcı cPanel hedefinden vazgeçti. V2 yakın zamanda **Ubuntu VDS** üzerine kurulacak; bundan sonraki geliştirme, kurulum ve kabul planı Ubuntu üzerinde Node.js, MySQL/MariaDB, kalıcı servis ve ters vekil düzenine göre yürütülür. Aşağıdaki cPanel bölümü önceki planın tarihsel kaydıdır, güncel dağıtım hedefi değildir. VDS kurulumu için henüz canlı işlem yapılmadı. Başka sohbete geçiş promptunda bu karar mutlaka belirtilmelidir.

## Yerel geliştirme

```bash
cd /home/mert/Documents/Proje/Sparkoff/v2
npm ci
cp .env.example .env
# .env içindeki DATABASE_URL, APP_ORIGIN ve CRON_SECRET değerlerini ayarla.
set -a
source .env
set +a
npm run db:migrate
npm run dev
```

`npm run db:migrate` yalnız yeni ve boş V2 veritabanında çalıştırılır. İlk sistem yöneticisi, bu veritabanı boşken `ADMIN_EMAIL` ve en az 16 karakterli `ADMIN_PASSWORD` ortam değişkenleriyle `npm run bootstrap:admin` komutundan oluşturulur. İşlemden sonra parola ortam değişkeni temizlenir. Üretim kullanıcıları ve V1 parolaları otomatik aktarılmış sayılmaz.

## cPanel ön koşulları

1. Hosting hesabındaki **Setup Node.js App** veya Application Manager bölümünde Node.js 20/22, kalıcı Passenger uygulaması ve uygulama başlangıç dosyası ayarı doğrulanır. cPanel'in uygulama kökü `v2` dağıtım dizini olur; `public_html` içine kaynak, `.env`, `drizzle` veya `node_modules` açılmaz.
2. Uygulama ayrı V2 veritabanı, kullanıcı ve yalnız gerekli yetkilerle çalışır. `DATABASE_URL`, `APP_ORIGIN`, `CRON_SECRET` ve diğer sırlar cPanel ortam değişkenlerinde tutulur. Fotoğraf dosyaları için `PUBLIC_UPLOAD_DIR` web kökünün dışında kalıcı ve Node sürecinin yazabildiği mutlak bir dizine ayarlanır.
3. Yerelde `npm run build` çalıştırılır. `dist/public` ile `dist/server/index.js` ve `app.js` dağıtım paketine eklenir. Passenger başlangıç dosyası `dist/server/index.js` seçilebiliyorsa bu kullanılır; panel yalnız `app.js` bekliyorsa kökteki sarmalayıcı kullanılır.
4. Passenger'ın sunduğu `PORT` değeri kullanılır. Node sürecinin yeniden başlatılması ve hata günlüğü cPanel üzerinden doğrulanır.
5. 15 dakikada bir `POST /api/internal/cron` çağrısı için cPanel Cron Jobs ayarlanır. `X-Cron-Secret` değeri web kökünün dışındaki yalnız hesap sahibinin okuyabildiği curl yapılandırmasında tutulur. Şu anki cron kodu yalnız kapalı teslimlerin kişi verisi saklama işlemini yapar; diğer periyodik işler tamamlanana kadar bu kabul maddesi açık kalır.

## V1 veri aktarımı

V1 ile V2 şemaları aynı değildir. V1 envanterinin temel alanları V2 `materials` şemasına eklendi; diğer modüllerde ve veri dönüşüm kurallarında eksikler sürüyor. Randevularda doğrulama, KVKK ve dosya ilişkileri de V2'de eksik. Bu nedenle doğrudan tablo kopyası veya mevcut SQL yedeğinin V2'ye geri yüklenmesi veri kaybına yol açar.

Geçişte önce V2 şemasına korunacak tüm V1 alanları eklenmeli. Ardından V1 SQL ve özel/kamu dosyalarının **salt okunur kopyası** alınmalı; kimlik eşleme, rol dönüşümü, stok hareketleri, teslim/iade kalan miktarı, duyuru hedefleri ve randevu tokenları için dönüştürme aracı ayrı kabul ortamında çalıştırılmalı. Kayıt sayıları, miktarlar, dosya sağlama toplamları ve örnek kullanıcı akışları karşılaştırılmalı. V1 yedeği ve geri dönüş yolu doğrulanmadan alan adı V2'ye yönlendirilmemeli.

## Yayın kararı için açık maddeler

- Node/Passenger desteği ve gerçek MySQL/MariaDB migration'ı.
- Giriş/aktivasyon, rol izolasyonu, stok ve teslim eşzamanlılığı için kabul testleri.
- Dosyalar, e-posta, Web Push, randevu, görev kanıtı ve saklama görevleri.
- V1 veri aktarımı, yedek geri yükleme provası ve geri dönüş denemesi.
- Mobil gerçek cihaz ve erişilebilirlik denetimi.

Güncel geliştirme durumu: [V2 inşa kaydı](SPARKOFF_V2_INSA_KAYDI_2026-11-08.md).
