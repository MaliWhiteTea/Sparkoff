# Sparkoff V1 → V2 sistem geçiş planı

**Tarih:** 9 Kasım 2026  
**Görsel hedef:** `/home/mert/Downloads/spero-tasarim-sistemi.md`  
**Güncel dağıtım hedefi:** Satın alınan 3 GB RAM'li Ubuntu VDS; [yeni yol haritası](SPARKOFF_V2_YENI_ROADMAP.md) geçerlidir. Eski cPanel uyumlu rehber yalnız tarihsel işlev referansıdır.

> Bu belge 9 Kasım'daki ilk geçiş fotoğrafını korur. Ardından yapılan işler ve geçerli sıralama [yeni yol haritasının çalışma kaydında](SPARKOFF_V2_YENI_ROADMAP.md#çalışma-kaydı) izlenir. Buradaki “henüz gerçek SQL yok” gibi cümleler ilk fotoğrafın durumudur; yerel MariaDB kabulü daha sonra yapılmıştır.

## Çalışma ilkesi

V1 Laravel uygulaması çalışmaya devam eder. V2 bağımsız `v2/` uygulamasında ve ayrı veritabanında geliştirilir. Yerel `database/database.sqlite` yalnız kaynak incelemesi için salt okunur açılır; canlı SQL veya yükleme dosyaları otomatik değiştirilmez. V2 örnek modu arayüz denemesidir, gerçek sistem kabulü değildir.

## Yerel veri fotoğrafı

9 Kasım'da **yerel** SQLite dosyası salt okunur sorgulandı:

| V1 tablo | Kayıt |
|---|---:|
| `users` | 1 |
| `printers` | 2 |
| `filaments` | 4 |
| `appointments` | 0 |
| `inventory_items` | 171 |
| `inventory_categories` | 2 |
| `inventory_locations` | 0 |
| `inventory_media` | 1 |
| `stock_movements` | 173 |
| `inventory_transactions` | 3 |
| `announcements` | 0 |
| `feedback_reports` | 1 |
| `settings` | 12 |

Bu sayılar canlı cPanel veritabanının güncel durumunu göstermez. Yerelde 171 malzemenin tamamı `consumable`, 173 hareketin 170'i `initial`, 3'ü `delivery`; 3 teslim kaydı `completed` durumundadır. Kişi adı, e-posta ve parola özeti bu belgeye alınmadı.

## Uygulama sırası

### 1. V1 verisine uygun V2 şeması ve sözleşmeler

İlk parti envanter: kategori/konum, malzeme, medya, stok hareketi ve teslim kayıtlarındaki V1 alanlarını V2 şemasına ekle. `v2/src/shared/schema.ts` içinde SKU, slug, marka/model, minimum stok, görünürlük, açıklama, teknik özellikler, arşiv durumu; medya başlığı/URL; stok hareketinin türü/kaynağı; teslim notları ve eski alıcı adını koruyan alanlar eklendi. `v2/drizzle/0004_bright_energizer.sql` üretildi. Malzeme oluşturma API/formuna SKU, marka/model, minimum stok ve kamu görünürlüğü bağlandı. Kamu API'si `status` görünürlüğünde miktarı saklar, `exact` görünürlüğünde gösterir; gizli/arşiv/pasif kayıtları çıkarır. **Bu migration henüz gerçek MySQL/MariaDB'de çalıştırılmadı.**

Sonraki şema partileri: yazıcı/filament/çalışma saatleri, duyuru hedefleri, geri bildirim, kullanıcı/roller, randevu doğrulaması ve özel dosya/saklama alanları. Her parti için V1 alanı → V2 alanı eşleme tablosu ve eski değerin kaybolmadığı kontrol yazılır.

9 Kasım devamında yazıcı/filament alanları için `0005_blue_stephen_strange.sql` üretildi. Eşleme: `printers.code/name/status/description/sort_order` → aynı anlamdaki V2 alanları; `filaments.material` → `filaments.name`, `color/brand/diameter_mm/spool_weight_grams/nozzle_temp_min/nozzle_temp_max/bed_temp_min/bed_temp_max/technical_notes/unavailable_reason/sort_order` → aynı anlamdaki V2 alanları, `is_available` → `available`. Yerel ayrı MariaDB 13 kabulünde migration ve API işlemleri geçti. V1 kayıtlarının toplu aktarımı ve sayısal karşılaştırması hâlâ yapılmadı.

### 2. Gerçek V2 test veritabanı

Bu makinede MySQL/MariaDB sunucusu bulunmadı. Ayrı ve boş MySQL 8.x veya MariaDB 10.11+ kabul veritabanı hazırlandıktan sonra `db:migrate`, ilk yönetici oluşturma, Türkçe metin/utf8mb4 ve temel işlem testleri yapılır. V1 veritabanına V2 migration uygulanmaz.

### 3. Mevcut Sparkoff işlevlerini taşı

1. Kamu sayfaları: atölye bilgileri, çalışma saatleri, yazıcı/filament durumu, katalog ve geri bildirim.
2. Yönetim envanteri: marka/model, stok hareketleri, medya, kategori/konum, CSV/XLSX, teslim/iade, geri alma. Öncelik bu modülde; yerel V1'de en çok veri burada.
3. Kullanıcı/rol/izin, duyuru, bildirim, kişisel ayarlar ve işlem geçmişi.
4. Randevu, doğrulama, takip, dosya indirme, e-posta ve saklama. `ONLINE_BOOKING_ENABLED=false` kalır; SMTP ve eşzamanlı slot kabulünden sonra açılır.

Her modül Spero arayüzünde gerçek API'ye bağlanır. Demo verisiyle çalışan görünüm, modülün tamamlandığı anlamına gelmez. Başarılı/başarısız akış, yetki sınırı ve mobil görünüm aynı parti içinde sınanır.

### 4. V2'ye yeni gelen üye modülleri

Birim ağacı ve özel roller kesinleştikten sonra görev adımları/kanıtları, birim/oda sohbeti, anket/okundu, etkinlikler, Web Push ve büyük dosya aktarımı tamamlanır. Sohbet erişimi yalnız `accessIds` ve yetkili genel kanalla sınanır.

### 5. Veri taşıma provası

V1 SQL ve dosyaların salt okunur kopyasından dönüştürme aracı çalışır. Kullanıcı parolalarının algoritması doğrulanır; uyumsuz özeti olduğu gibi V2 oturumuna bağlamak yerine güvenli geçiş stratejisi uygulanır. Kimlik eşlemeleri, stok bakiyesi, işlem sırası, kapanmış teslimlerin anonimleştirme tarihi, kamu medya yolu ve özel dosya izinleri kontrol edilir. Kayıt sayısı, miktar toplamı ve dosya sağlama toplamları V1 kopyasıyla karşılaştırılır. Fark varsa aktarım kabul edilmez.

### 6. Ubuntu VDS kabulü ve yayın

Ubuntu LTS üzerinde Node.js, systemd, Nginx/HTTPS, ayrı V2 veritabanı, zamanlayıcı, SMTP, dosya limitleri ve yedek geri yükleme provası doğrulanır. Alan adı geçişinden önce V1 sürüm ve veritabanı/dosya yedeği alınır; geri dönüş adımı denenir. Canlı geçiş yalnız bu kabul kaydı kapandığında yapılır.

## Sıradaki somut iş

V1'in demirbaş kullanılabilir miktar hesabı, teslim/iade ve hasar/kayıp stok davranışı V2 API, kamu kataloğu ve örnek moda taşındı. CSV içe/dışa aktarım kodu ve yönetim akışı eklendi. Envanter HTTPS bağlantılarının API/form/kamu görünümü eklendi. `npm run build` ve 13 test geçti. Sıradaki iş fotoğraf/video medyası ve XLSX akışı; ardından boş V2 test veritabanında migration, CSV içe aktarım ve stok/teslim eşzamanlılık kabulü. Gerçek SQL testi henüz yok.
