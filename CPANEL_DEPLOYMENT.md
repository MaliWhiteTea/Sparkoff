# Sparkoff cPanel Kurulum Rehberi

## Gereksinimler

- PHP 8.4.1+, MySQL/MariaDB, Composer 2 ve SSL
- PHP: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `fileinfo`
- Alan adının belge kökünü Laravel `public` klasörüne yönlendirebilme

Node.js sunucuda zorunlu değildir; `public/build` yerelde üretilebilir.

## 1. Üretim paketini hazırla

```bash
composer install --no-dev --optimize-autoloader
npm ci
npm run build
```

Projeyi `vendor` ve `public/build` ile yükle. Yerel `.env`, test veritabanı ve günlükleri yükleme.

## 2. Veritabanı ve `.env`

cPanel'de veritabanı/kullanıcı oluştur, kullanıcıya tüm veritabanı yetkilerini ver. Üretim ayarları:

```dotenv
APP_NAME="Sparkoff Proje Atölyesi"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://sparkoff.tr
APP_TIMEZONE=Europe/Istanbul
DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=CPANEL_VERITABANI
DB_USERNAME=CPANEL_KULLANICI
DB_PASSWORD=GUCLU_PAROLA
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
ONLINE_BOOKING_ENABLED=true
```

```bash
php artisan key:generate
php artisan migrate --force
php artisan db:seed --class=RolePermissionSeeder --force
php artisan storage:link
php artisan admin:create yonetici@sparkoff.tr --name="Atölye Yöneticisi"
php artisan optimize
```

Randevu e-postalarının gönderilebilmesi için `.env` içindeki `MAIL_*` değerlerini
`randevu@sparkoff.tr` hesabının SMTP bilgileriyle doldurun.

## 3. Zamanlanmış görev

cPanel Cron İşleri bölümüne dakikada bir çalışan yalnızca şu görevi ekleyin
(`CPANEL_KULLANICI` kısmını hesabınıza göre değiştirin):

```cron
* * * * * cd /home/CPANEL_KULLANICI/sparkoff_app && /opt/alt/php84/usr/bin/php artisan schedule:run >> /dev/null 2>&1
```

`migrate` veya `db:seed` komutlarını dakikada bir çalıştırmayın. Bunlar yalnızca ilk
kurulumda ve gerektiğinde güncelleme sırasında çalıştırılmalıdır.

## 4. Belge kökü ve izinler

Document root proje kökü değil şu dizin olmalıdır:

```text
/home/CPANEL_KULLANICI/Sparkoff/public
```

Bu değişmiyorsa dosyaları gelişigüzel `public_html` içine taşımayın; hosting sağlayıcısından document root değişikliği isteyin. `storage` ve `bootstrap/cache` PHP tarafından yazılabilir olmalıdır (`755`, gerekirse `775`; `777` kullanmayın).

## 5. SSL ve yedekleme

- AutoSSL/Let's Encrypt'i etkinleştir ve HTTP'yi HTTPS'e yönlendir.
- JetBackup/cPanel Backup ile günlük veritabanı yedeği al.
- En az bir yedeği indirip geri yükleme denemesi yap.
- `.env` yedeğini erişimi sınırlı ayrı bir yerde tut.

## 6. Canlı kontrol listesi

- [ ] `/up` HTTP 200 döndürüyor.
- [ ] `/`, `/3d-yazicilar`, `/filamentler` ve `/malzemeler` açılıyor.
- [ ] `/randevu` açılıyor; örnek bir talep, e-posta doğrulama ve takip akışı tamamlanıyor.
- [ ] Yönetim sayfaları giriş ve admin rolü gerektiriyor.
- [ ] Takvim, filament, iletişim ve duyuru değişiklikleri siteye yansıyor.
- [ ] İşlem geçmişi değişiklikleri kaydediyor.
- [ ] Telefon, WhatsApp ve e-posta bağlantıları doğru.
- [ ] `APP_DEBUG=false`, `ONLINE_BOOKING_ENABLED=true` ve SSL etkin.
- [ ] `schedule:run` cron görevi dakikada bir çalışıyor.
- [ ] Otomatik veritabanı yedeği etkin ve geri yükleme denendi.

## 7. Üretime benzer kabul testi

Bu bölüm gerçek canlı veritabanında otomatik test çalıştırmak için değildir. Önce
canlıyla aynı PHP ve MySQL/MariaDB sürümlerini kullanan, yalnızca sentetik veri
içeren ayrı bir kabul veritabanı hazırlayın. `RefreshDatabase` kullanan testleri
canlı veritabanına kesinlikle bağlamayın.

28 Ekim 2026 tarihli son kabul sonucu ve açık maddeler:
[DEPLOYMENT_ACCEPTANCE_2026-10-28.md](./DEPLOYMENT_ACCEPTANCE_2026-10-28.md)

### Veritabanı ve eşzamanlı işlemler

- [ ] Kabul ortamında `DB_CONNECTION=mysql` veya `mariadb` kullanılıyor;
  `php artisan about --only=environment` bunu doğruluyor.
- [ ] `php artisan migrate:fresh --seed --force` boş kabul veritabanında hatasız
  tamamlanıyor; ardından `php artisan migrate:status` bekleyen migration
  göstermiyor.
- [ ] Veritabanı ve tablolar `utf8mb4` karakter setiyle Türkçe metinleri bozmadan
  saklıyor. Kullanılan collation adı ve sunucu sürümü yayın kaydına ekleniyor.
- [ ] GitHub Actions içindeki `Veritabanı kabulü` işi MySQL ve MariaDB için
  geçiyor. Canlıya benzer ayrıca bir kabul ortamı kullanılıyorsa yalnız kabul
  veritabanına yetkili kullanıcı hazırlanıyor ve tam test paketi burada da
  geçiyor. `RefreshDatabase` kullanan bu iş canlı veritabanına bağlanmıyor.
  Özellikle son sistem
  yöneticisini kaldırma, aynı zaman aralığını eşzamanlı ayırma, stok düşme ve
  kısmi iade senaryoları ayrıca iki tarayıcı oturumuyla deneniyor.
- [ ] Başarısız eşzamanlı işlem HTTP 500 veya kısmi veri üretmiyor; kullanıcıya
  anlaşılır hata dönüyor ve stok/randevu kayıtları tutarlı kalıyor.

### SMTP, SPF ve DKIM

- [ ] `MAIL_MAILER=smtp`, gönderen adresi `randevu@sparkoff.tr` ve SMTP hesabı
  aynı alan adına ait; parola hiçbir ekran görüntüsüne veya yayın kaydına
  eklenmiyor.
- [ ] Gerçek bir dış posta kutusuna randevu doğrulama ve durum e-postası ulaşıyor;
  doğrulama bağlantısı yalnız bir kez çalışıyor ve takip bağlantısı doğru kaydı
  açıyor.
- [ ] Alınan iletinin ham başlıklarında SPF ve DKIM sonucu `pass`; alan adında
  yayımlanan kayıtlar kullanılan göndericiyle eşleşiyor. Spam ve teslim süresi
  sonucu yayın kaydına yazılıyor.
- [ ] Geçersiz SMTP parolasıyla kontrollü kabul denemesi kullanıcıya güvenli hata
  gösteriyor; doğrulama e-postası gönderilemeyen randevu ve dosya geride
  kalmıyor.

### Zamanlayıcı ve saklama görevleri

- [ ] cPanel cron dakikada bir yalnız `php artisan schedule:run` çalıştırıyor.
  `php artisan schedule:list` çıktısında `appointments:expire-verifications`,
  `appointments:apply-retention` ve `loans:anonymize` görünüyor.
- [ ] Kabul ortamında süresi geçmiş sentetik doğrulama kaydı bir dakika içinde
  `expired` oluyor.
- [ ] Saklama süreleri geçici olarak kısa ayarlanmış sentetik randevu ve model
  dosyası temizleniyor; aktif kayıt ile geleceğe kadar saklama istisnası verilen
  kayıt korunuyor. Aynı görev ikinci kez çalıştığında ek kayıt silmiyor.
- [ ] Görev sonucu yönetim panelindeki işlem geçmişinde Türkçe ve sayısal
  özetle görünüyor. Cronun son çalışma zamanı cPanel kaydından doğrulanıyor.

### Yükleme ve depolama

- [ ] cPanel PHP ayarlarında `upload_max_filesize`, uygulamadaki maksimum dosya
  boyutuna eşit veya büyük; `post_max_size` bundan daha büyük. Web sunucusunun
  ayrıca uyguladığı istek gövdesi sınırı da aynı denemeyle doğrulanıyor.
- [ ] İzin verilen küçük bir model ve sınıra yakın bir model yüklenebiliyor;
  sınırı aşan dosya anlaşılır doğrulama hatası alıyor.
- [ ] `storage`, `storage/app/private` ve `bootstrap/cache` PHP kullanıcısı
  tarafından yazılabilir. Model dosyası `storage/app/private` altında oluşuyor
  ve doğrudan URL ile indirilemiyor; yalnız dosya indirme izni olan yönetici
  indirebiliyor.
- [ ] `public/storage` bağlantısı yalnız kamu medyasını sunuyor; özel randevu
  dosyaları bu bağlantının hedefinde bulunmuyor.

### Yayın kararı

- [ ] SSL, `APP_ENV=production`, `APP_DEBUG=false`, güvenli oturum çerezi,
  yedekleme ve geri yükleme denemesi doğrulandı.
- [ ] Masaüstü ve mobilde ana sayfa, kataloglar, randevu, doğrulama, takip,
  yönetici onayı, dosya indirme ve iptal akışı uçtan uca tamamlandı.
- [ ] Yukarıdaki kanıtlar tarih, ortam/sürüm ve testi yapan kişiyle kaydedildi.
  Açık madde varken `ONLINE_BOOKING_ENABLED=true` yapılmadı.

## Güncelleme

```bash
php artisan down
php artisan migrate --force
php artisan optimize
php artisan up
```
