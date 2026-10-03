# Sparkoff cPanel Kurulum Rehberi

## Gereksinimler

- PHP 8.3+, MySQL/MariaDB, Composer 2 ve SSL
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
ONLINE_BOOKING_ENABLED=false
```

```bash
php artisan key:generate
php artisan migrate --force
php artisan admin:create yonetici@sparkoff.tr --name="Atölye Yöneticisi"
php artisan optimize
```

## 3. Belge kökü ve izinler

Document root proje kökü değil şu dizin olmalıdır:

```text
/home/CPANEL_KULLANICI/Sparkoff/public
```

Bu değişmiyorsa dosyaları gelişigüzel `public_html` içine taşımayın; hosting sağlayıcısından document root değişikliği isteyin. `storage` ve `bootstrap/cache` PHP tarafından yazılabilir olmalıdır (`755`, gerekirse `775`; `777` kullanmayın).

## 4. SSL ve yedekleme

- AutoSSL/Let's Encrypt'i etkinleştir ve HTTP'yi HTTPS'e yönlendir.
- JetBackup/cPanel Backup ile günlük veritabanı yedeği al.
- En az bir yedeği indirip geri yükleme denemesi yap.
- `.env` yedeğini erişimi sınırlı ayrı bir yerde tut.

## 5. Canlı kontrol listesi

- [ ] `/up` HTTP 200 döndürüyor.
- [ ] `/`, `/3d-yazicilar` ve `/filamentler` açılıyor.
- [ ] `/randevu` yazıcı sayfasına gidiyor; randevu POST/takip uçları 404 dönüyor.
- [ ] Yönetim sayfaları giriş ve admin rolü gerektiriyor.
- [ ] Takvim, filament, iletişim ve duyuru değişiklikleri siteye yansıyor.
- [ ] İşlem geçmişi değişiklikleri kaydediyor.
- [ ] Telefon, WhatsApp ve e-posta bağlantıları doğru.
- [ ] `APP_DEBUG=false`, `ONLINE_BOOKING_ENABLED=false` ve SSL etkin.
- [ ] Otomatik veritabanı yedeği etkin ve geri yükleme denendi.

## Güncelleme

```bash
php artisan down
php artisan migrate --force
php artisan optimize
php artisan up
```
