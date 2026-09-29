# Sparkoff Proje Atölyesi

Okul atölyesindeki 3D yazıcılar için modern, mobil uyumlu randevu ve baskı takip sistemi.

Kullanıcılar hesap oluşturmadan uygun zamanı seçebilir, baskı dosyasını yükleyebilir ve e-posta üzerinden randevularını takip edebilir. Başlangıçta bütün randevular yönetici onayından geçer.

## Özellikler

- Hesapsız randevu akışı
- E-posta doğrulaması ve güvenli takip bağlantısı
- G-code, 3MF, STL ve STEP/STP dosya desteği
- Atölye filamenti veya kişisel filament seçimi
- Yazıcı ve zaman uygunluğu kontrolü
- Yönetici onaylı randevu sistemi
- Yazıcı, bakım ve çalışma saatleri yönetimi
- KVKK odaklı veri ve dosya saklama yaklaşımı
- Mobil öncelikli Türkçe arayüz

## Teknoloji

- PHP 8.3+
- Laravel 13
- React 19 ve TypeScript
- Inertia.js
- Vite ve Tailwind CSS
- MySQL/MariaDB

Sunucuda Node.js çalıştırmak gerekmez. Node.js yalnızca geliştirme sırasında React ve CSS dosyalarını derlemek için kullanılır; cPanel'e derlenmiş dosyalar yüklenir.

## Yerel kurulum

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

Yerel veritabanı ayarlarını `.env` dosyasında yapılandırdıktan sonra:

```bash
php artisan migrate
npm run build
php artisan serve
```

Geliştirme sırasında Vite'ı ayrı terminalde çalıştırabilirsiniz:

```bash
npm run dev
```

## Kontroller

```bash
npx tsc --noEmit
npm run build
php artisan test
```

## E-posta yapılandırması

Yerel ortamda `MAIL_MAILER=log` kullanılır; gönderilen e-postalar `storage/logs/laravel.log` dosyasına yazılır.

cPanel'de `randevu@sparkoff.tr` gibi bir posta hesabı oluşturduktan sonra production `.env` dosyasında SMTP bilgileri tanımlanmalıdır:

```dotenv
MAIL_MAILER=smtp
MAIL_SCHEME=tls
MAIL_HOST=mail.sparkoff.tr
MAIL_PORT=587
MAIL_USERNAME=randevu@sparkoff.tr
MAIL_PASSWORD="güçlü-posta-parolası"
MAIL_FROM_ADDRESS=randevu@sparkoff.tr
MAIL_FROM_NAME="Sparkoff Proje Atölyesi"
```

Gerçek sunucu değerleri hosting sağlayıcısının **Connect Devices / Cihazları Bağla** ekranındaki bilgilere göre girilmelidir. Parolalar repoya eklenmemelidir.

## Dokümantasyon

Ayrıntılı ürün ve geliştirme planı için [ROADMAP.md](./ROADMAP.md) dosyasına bakabilirsiniz.

## Proje durumu

Ana sayfa, çok adımlı randevu formu, veritabanı kaydı, güvenli dosya yükleme, çakışma kontrolü, e-posta doğrulaması ve hesapsız takip/iptal akışı hazırdır. Yönetici girişi ve yönetim paneli sıradaki geliştirme aşamasıdır.

## Lisans

Lisans modeli henüz belirlenmemiştir. Bir lisans dosyası eklenene kadar projenin tüm hakları saklıdır.
