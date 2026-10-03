# Sparkoff Proje Atölyesi

Sparkoff Proje Atölyesi'nin hizmetlerini tek merkezde sunan modern ve mobil uyumlu atölye portalı.

İlk modül, ziyaretçilerin kişisel bilgi paylaşmadan 3D yazıcıların güncel durumunu, çalışma saatlerini ve mevcut filamentleri görüntülemesini sağlar. Randevu görüşmeleri yüz yüze, telefon veya WhatsApp üzerinden yürütülür. Malzeme ve ekipman stok modülü sonraki aşamada eklenecektir.

## Özellikler

- Modüler atölye ana sayfası
- Kamuya açık 3D yazıcı durum ekranı
- Çalışma saatleri ve yazıcı uygunluk bilgisi
- Ayrıntılı filament kataloğu
- Yazıcı, bakım ve filament yönetimi
- Ziyaretçiden kişisel veri veya dosya istemeyen kamu akışı
- Gelecekte eklenecek malzeme ve ekipman stok modülü
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

## Özellik bayrağı

Eski çevrimiçi randevu kodu geri dönüş ihtimali için korunur ancak varsayılan olarak kapalıdır:

```dotenv
ONLINE_BOOKING_ENABLED=false
```

Canlı ortamda bu değer `false` olarak kalmalıdır. Kapalıyken `/randevu` adresi 3D Yazıcılar modülüne yönlendirilir; veri kabul eden diğer randevu uçları erişilemez.

## Dokümantasyon

Ayrıntılı ürün ve geliştirme planı için [ROADMAP.md](./ROADMAP.md) dosyasına bakabilirsiniz.

## Proje durumu

Atölye portalı ana sayfası, 3D Yazıcılar giriş modülü, yazıcı/filament yönetimi ve yönetici girişi hazırdır. Sıradaki aşama kişisel veri içermeyen kamuya açık müsaitlik takvimi ile anonim yönetici doluluk kayıtlarıdır.

## Lisans

Lisans modeli henüz belirlenmemiştir. Bir lisans dosyası eklenene kadar projenin tüm hakları saklıdır.
