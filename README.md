# Sparkoff Proje Atölyesi

Sparkoff; atölye hizmetlerini, 3D yazıcı randevularını ve malzeme envanterini tek merkezde sunan mobil uyumlu bir atölye portalıdır.

## Modüller

### Hazır olanlar

- Atölye ana sayfası, iletişim ve kamu duyuruları
- Yazıcı durumları ve 7 günlük kamu takvimi
- Filament kataloğu ve yönetimi
- Çevrimiçi 3D yazıcı randevu akışı
- E-posta doğrulama, yönetici onayı ve takip bağlantısı
- Yönetici paneli ve işlem geçmişi
- cPanel bölünmüş dizin dağıtımı

Çevrimiçi randevu kodu hazırdır ancak gerçek SMTP doğrulanana kadar canlı ortamda özellik bayrağı kapalı tutulmalıdır.

### Geliştirilmekte olanlar

- Dinamik rol ve yetki yönetimi
- Sarf, ödünç ve demirbaş malzeme envanteri
- Teslim, iade, hasar ve kayıp işlemleri
- Kişisel teslim bilgilerinin süre sonunda otomatik anonimleştirilmesi
- Yönetim paneline özel iç duyurular
- Google Sheets/CSV envanter aktarımı
- Kişisel bilgi istemeyen öneri, şikâyet ve hata bildirim sistemi

## Veri yaklaşımı

3D yazıcı randevusunda ad, soyad, e-posta, randevu zamanı, model dosyası ve filament bilgileri alınır. Telefon ve serbest kullanıcı notu alınmaz.

Malzeme tesliminde ad ve soyad zorunlu, e-posta isteğe bağlıdır. Aktif veya gecikmiş teslimlerde bilgiler kayıt sonuçlanana kadar korunur; saklama süresi gerçek iade ya da sonuçlandırma sonrasında başlar. Süre dolunca kişi alanları anonimleştirilir, stok hareketi korunur.

## Yetkilendirme

- Kullanıcılar birden fazla role sahip olabilir.
- Yetkiler roller üzerinden verilir.
- Korunan Sistem Yöneticisi rolü tüm yetkilere sahiptir.
- Envanter, teslim, yazıcı, randevu, içerik ve sistem işlemleri ayrı izinlerle korunur.
- Kişisel veri görüntüleme, dosya indirme ve dışa aktarma hassas izinlerdir.

## Teknoloji

- PHP 8.4+
- Laravel 13
- React 19 ve TypeScript
- Inertia.js
- Vite
- MySQL/MariaDB; yerel testlerde SQLite

Sunucuda Node.js çalıştırılmaz. React ve CSS dosyaları geliştirme ortamında derlenerek cPanel'e yüklenir.

## Yerel kurulum

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
npm run build
```

Geliştirme ortamı:

```bash
composer run dev
```

Masaüstüne eklenen `Sparkoff Testi Başlat` ve `Sparkoff Testi Kapat` kısayolları da yerel ortamı yönetebilir.

## Kontroller

```bash
npx tsc --noEmit
npm run build
composer test
```

## Ortam ayarları

Randevuyu yerelde veya canlıda açmak için:

```dotenv
ONLINE_BOOKING_ENABLED=true
```

Canlıda açmadan önce `randevu@sparkoff.tr` için SMTP, SPF/DKIM ve gerçek teslimat testi tamamlanmalıdır. `.env` dosyası Git'e veya dağıtım ZIP'ine eklenmez.

## Dokümantasyon

- Ayrıntılı geliştirme planı: [ROADMAP.md](./ROADMAP.md)
- cPanel kurulumu: [CPANEL_DEPLOYMENT.md](./CPANEL_DEPLOYMENT.md)

## Proje durumu

3D yazıcı ve portal temeli, dinamik rol-yetki altyapısı ve yönetici envanter ekranı çalışmaktadır. Envanterde malzeme oluşturma, filtreleme, arşivleme, kritik stok takibi ve gerekçeli stok hareketleri kullanılabilir. Sıradaki geliştirme kategori/konum düzenleme, dışa aktarma ve teslim/iade sistemidir.

## Lisans

Lisans modeli henüz belirlenmemiştir. Bir lisans dosyası eklenene kadar tüm hakları saklıdır.
