# Sparkoff Proje Atölyesi

> **Yapay zekâ ile geliştirildi:** Bu proje; tasarım, yazılım geliştirme, test ve dokümantasyon süreçlerinde yapay zekâ ürünleri kullanılarak oluşturulmuş ve geliştirilmiştir.

Sparkoff, bir proje atölyesinin kamuya açık hizmetlerini ve yönetim süreçlerini tek uygulamada birleştiren mobil uyumlu bir portaldır. Sistem; 3D yazıcı randevularını, yazıcı ve filament bilgilerini, malzeme envanterini, teslim/iade işlemlerini, duyuruları ve yetkili kullanıcı yönetimini kapsar.

## Sistem yapısı

```text
Ziyaretçi portalı ─┐
Yönetim paneli ────┼─ Laravel + Inertia.js ─ React arayüzü
Zamanlanmış işler ─┘          │
                              ├─ MySQL / MariaDB
                              ├─ Özel ve kamu dosya depolaması
                              └─ SMTP e-posta servisi
```

Uygulama iki ana kullanım alanına ayrılır:

- **Ziyaretçi portalı:** Atölye olanakları, yazıcı takvimi, filamentler, malzeme kataloğu, randevu ve geri bildirim sayfaları.
- **Yönetim paneli:** Envanter, teslim/iade, randevu, takvim, duyuru, talep, kullanıcı, rol, ayar ve işlem geçmişi ekranları.

## Ziyaretçi portalı

### Atölye ana sayfası

- Atölyenin sunduğu hizmetleri ve kullanılabilir modülleri gösterir.
- Yazıcı ve malzeme sayfalarına doğrudan erişim sağlar.
- Kamuya açık duyuruları önem seviyesi ve yayın süresine göre gösterir.
- Telefon, WhatsApp, e-posta ve çalışma saatleri yönetim panelinden güncellenebilir.

### 3D yazıcılar ve takvim

- Yazıcıların boş, kullanımda, bakımda veya pasif durumlarını gösterir.
- Her yazıcı için yedi günlük olası kullanım takvimi sunar.
- Planlı bakım, kapalı zaman ve devam eden baskı aralıklarını takvimden düşer.
- Atölyenin çalışma günleri ve baskı başlangıç saatleri yönetim ayarlarından belirlenir.

### Filament kataloğu

- Kullanılabilir filamentleri malzeme, renk, marka ve teknik özellikleriyle listeler.
- Nozzle/tabla sıcaklıkları, çap, makara ağırlığı ve kullanım notlarını gösterebilir.
- Geçici olarak kullanıma kapatılan filament türleri randevu seçiminden kaldırılır.

### Malzeme kataloğu

- Birden fazla sözcükle arama, kategori ve stok filtreleri sunar.
- Malzemeler için kesin miktar, yalnız stok durumu veya tamamen gizli görünürlük seçeneklerini destekler.
- Mobil cihazlarda kart/satır düzenine dönüşen erişilebilir bir tablo kullanır.
- Kapak görseli, sıralanabilir galeri, video ve güvenli HTTPS bağlantıları gösterebilir.
- Teknik özellikleri ve malzeme açıklamalarını ayrıntılı biçimde sunar.

### Geri bildirim ve KVKK

- Ziyaretçiler kişisel bilgi vermeden öneri, şikâyet veya hata bildirebilir.
- Form; bot alanı ve gönderim hızı sınırlamasıyla korunur.
- KVKK aydınlatma sayfası, yönetimde belirlenen veri sorumlusu ve saklama bilgilerini yayımlar.

## 3D yazıcı randevu sistemi

Randevu modülü `ONLINE_BOOKING_ENABLED` özellik bayrağıyla açılıp kapatılabilir. Akış şu adımlardan oluşur:

1. Ziyaretçi yazıcı, tarih, saat, tahmini baskı süresi ve filament seçer.
2. İzin verilen bir model dosyası yükler ve aydınlatma/randevu kurallarını kabul eder.
3. Sistem çakışma, çalışma saati, dosya türü ve dosya boyutu kontrollerini uygular.
4. E-posta doğrulamasından sonra talep yönetici incelemesine gönderilir.
5. Yetkili talebi onaylayabilir, reddedebilir veya değişiklik isteyebilir.
6. Ziyaretçi güvenli takip bağlantısından durumu görebilir ve uygun aşamada talebi iptal edebilir.

Randevu sistemi ayrıca:

- Aynı zaman aralığının eşzamanlı olarak iki kez ayrılmasını engeller.
- Doğrulanmayan taleplerin geçici olarak tuttuğu zamanı süre sonunda serbest bırakır.
- Model dosyalarını kamuya açık depolama alanından ayrı tutar.
- Dosya indirmeyi ayrı ve hassas bir yönetici yetkisiyle sınırlar.
- Saklama süresi dolan randevu kayıtlarını ve model dosyalarını zamanlanmış görevle temizler.

Gerçek SMTP, SPF/DKIM ve teslimat testleri tamamlanmadan çevrimiçi randevu özelliği canlı ortamda açılmamalıdır.

## Envanter sistemi

### Malzeme kayıtları

- Sarf malzemesi, ödünç verilebilir malzeme ve demirbaş türlerini destekler.
- Kategori, raf/kutu konumu, birim, stok, minimum stok ve katalog görünürlüğü bilgilerini tutar.
- Her stok değişikliğini neden, önceki/yeni bakiye, tarih ve işlemi yapan yetkiliyle kaydeder.
- Kritik ve tükenen stokları ayrı filtrelerle gösterir.
- Malzemeleri arşivleme ve yalnız ana yöneticiye açık kalıcı test temizliği işlemlerini destekler.

### Medya yönetimi

- Malzeme başına bir kapak ve birden fazla sıralanabilir fotoğraf eklenebilir.
- Görseller için erişilebilir alternatif metin zorunluluğu uygulanır.
- MP4/WebM video veya güvenli HTTPS kaynak bağlantısı eklenebilir.
- Dosya türü, boyut, güvenli dosya adı ve kullanılmayan dosya temizliği sunucu tarafında denetlenir.

### CSV içe/dışa aktarma

- Envanter CSV olarak dışa aktarılabilir.
- CSV içe aktarmada kaynak sütunları sistem alanlarıyla eşlenir.
- Aktarım öncesinde ön izleme, doğrulama, tekrar kaydı tespiti ve satır bazlı hata raporu gösterilir.
- Kategori ve konumlar mevcut kayıtlarla eşleştirilebilir veya yetki dâhilinde oluşturulabilir.
- Yalnız geçerli ve kullanıcı tarafından onaylanan satırlar toplu olarak kaydedilir.
- Aktarım sonucu işlem geçmişine yazılır.

Doğrudan Google Sheets ve XLSX desteği henüz tamamlanmamıştır.

### Tablo ve toplu işlemler

- Envanter, teslim, randevu, talep ve kullanıcı listelerinde sunucu taraflı sıralama kullanılır.
- Görünür sütunlar, sütun sırası ve kayıtlı filtreler kullanıcı hesabına özel saklanır.
- Hassas kişisel veri sütunları yalnız ilgili izne sahip yetkililere sunulur.
- Envanterde seçili kayıtların kategori, konum ve katalog görünürlüğü topluca değiştirilebilir veya kayıtlar arşivlenebilir.
- Toplu işlemden önce etkilenecek kayıt özeti; işlemden sonra başarı ve kısmi hata raporu gösterilir.

## Teslim ve iade sistemi

- Sarf, ödünç ve demirbaş teslimleri farklı kurallarla işlenir.
- Verilen miktar stoktan işlem içinde düşülür; başarısız işlem kısmi stok değişikliği bırakmaz.
- Ödünç kayıtlarında beklenen iade tarihi ve kalan miktar takip edilir.
- Kısmi iade desteklenir; iade miktarı verilmiş ve henüz dönmemiş miktarı aşamaz.
- Hasarlı, kayıp veya tamamen iade edilmiş kayıtlar ayrı durumlarla kapatılabilir.
- Geciken teslimler yönetim listesinden ayırt edilebilir.
- Ad/soyad ve e-posta görüntüleme izinleri birbirinden ayrıdır.

Aktif veya gecikmiş teslimlerde kişi bilgileri kayıt sonuçlanana kadar korunur. Saklama süresi gerçek iade ya da sonuçlandırma sonrasında başlar. Süre dolunca kişi alanları anonimleştirilir; stok ve denetim hareketleri korunur.

## Duyuru ve talep yönetimi

### Birleşik duyuru sistemi

- Aynı ekran üzerinden kamu duyurusu, yönetim duyurusu veya her iki hedefe birden yayın yapılabilir.
- Bilgi, önemli, bakım ve acil önem seviyeleri desteklenir.
- Duyuru sabitlenebilir; başlangıç ve bitiş zamanı belirlenebilir.
- Yönetim duyuruları tüm yetkililere veya seçili rollere yönlendirilebilir.
- Okundu/onaylandı durumu ve okunmamış duyuru sayacı tutulur.

### Geri bildirim talepleri

- Yetkililer öneri, şikâyet ve hata kayıtlarını filtreleyebilir.
- Kayıtlar yeni, inceleniyor, çözüldü veya arşivlendi durumlarıyla yönetilebilir.
- Yönetim iç notu ve işlemi yapan kullanıcı denetim kaydında tutulur.

## Yetkilendirme ve güvenlik

### Rol ve izin modeli

- Bir kullanıcı birden fazla role sahip olabilir.
- Envanter, teslim, yazıcı, randevu, içerik, geri bildirim ve sistem işlemleri ayrı izinlerle korunur.
- Korunan **Sistem Yöneticisi** rolü tüm yetkilere sahiptir ve son sistem yöneticisinin kaldırılması engellenir.
- Kullanıcı oluşturma, parola sıfırlama, rol atama ve hesap pasifleştirme hassas izinlerdir.
- Her panel kullanıcısı kişisel ayarlardan mevcut parolasını doğrulayarak kendi parolasını değiştirebilir; yeni parola en az 12 karakter olmalı ve doğrulamasıyla eşleşmelidir.
- Kişisel veri görüntüleme, model dosyası indirme ve dışa aktarma işlemleri ayrıca yetkilendirilir.
- Arayüzde bir işlemin gizlenmesi yeterli kabul edilmez; tüm sınırlar sunucu tarafında da denetlenir.

### İşlem geçmişi

- Kritik oluşturma, güncelleme, stok, teslim, randevu, aktarım ve ayar işlemleri kaydedilir.
- Kayıtlar işlemi yapan yetkiliyi, zamanı, eylemi ve güvenli değişiklik özetini içerir.
- Teknik eylem kodları yönetim arayüzünde Türkçe açıklamalarla gösterilir.

### Form güvenliği ve yerel taslaklar

- Kaydedilmemiş değişiklik varken panel içi sayfa geçişinde site temalı uyarı gösterilir.
- Sekme kapatma veya yenilemede tarayıcının güvenli ayrılma uyarısı kullanılır.
- Duyuru, malzeme ve sistem ayarlarının hassas olmayan alanları kullanıcıya özel yerel taslak olarak saklanabilir.
- Bulunan taslak kullanıcı onayı olmadan forma uygulanmaz; geri yükleme ve silme seçenekleri sunulur.
- Taslaklar 14 gün sonra geçersiz sayılır ve başarılı kayıt sonrasında temizlenir.
- Parola, kişi bilgisi, e-posta, telefon, model/medya dosyası, randevu ve teslim verileri tarayıcı taslağına yazılmaz.

## Yönetim arayüzü

- Giriş sonrasında yalnız yetkili olunan modülleri gösteren kişisel bir genel bakış ekranı açılır.
- Genel bakışta kritik stok, geciken teslim, onay bekleyen randevu, bakımda yazıcı ve açık talep sayıları yalnız ilgili görüntüleme yetkisine sahip kullanıcılara gösterilir.
- `Ctrl/Cmd + K` ile açılan hızlı arama; malzeme, randevu, yazıcı, filament, talep ve yetkili kullanıcı kayıtlarını modül izinlerine göre tarar. Randevu ve kullanıcı kimlikleri ayrıca kişisel veri izinleriyle korunur.
- Bildirim zili; kritik stok, geciken teslim, onay bekleyen randevu, bakımda yazıcı ve açık talepleri yetkilere göre gösterir. Okundu durumu kullanıcıya özeldir; uyarının kayıt kümesi değiştiğinde bildirim yeniden okunmamış olur.
- Genel bakıştaki son görüntülenen kayıtlar kullanıcıya özeldir. Geçmiş tablosunda içerik, ad veya e-posta tutulmaz; yalnız kayıt türü, sayısal kimlik ve görüntülenme zamanı saklanır, başlıklar güncel yetkiye göre anlık üretilir.
- Varsayılan görünüm koyu temadır; açık, koyu ve sistem seçenekleri bulunur.
- Yazı/arayüz ölçeği, tablo yoğunluğu ve sol menü genişliği kullanıcı hesabına özel saklanır.
- Masaüstü sol menüsü daraltılabilir ve sürüklenerek yeniden boyutlandırılabilir.
- Mobil menü ekran üzerinden açılır; klavye, odak ve azaltılmış hareket tercihleri desteklenir.
- Ayar sekmeleri ve menü öğeleri kullanıcının yetkilerine göre oluşturulur.
- Durum rozetleri ve eylem dili modüller arasında ortaklaştırılmıştır.

## Veri saklama ve zamanlanmış görevler

Laravel zamanlayıcısı aşağıdaki bakım işlerini yürütür:

- `appointments:expire-verifications`: Süresi dolan doğrulanmamış randevu taleplerini kapatır.
- `appointments:apply-retention`: Saklama süresi dolan randevu verilerini ve özel model dosyalarını temizler.
- `loans:anonymize`: Sonuçlanmış teslimlerin saklama süresi dolan kişisel alanlarını anonimleştirir.

Aktif, gecikmiş veya çözümlenmemiş teslimler otomatik anonimleştirilmez. Randevu ve dosya saklama süreleri yönetim panelindeki KVKK ayarlarından belirlenebilir.

## Teknoloji

- PHP 8.3+; veritabanı kabul testleri PHP 8.4 üzerinde çalışır
- Laravel 13
- React 19 ve TypeScript
- Inertia.js 3
- Vite 8
- MySQL 8.4 ve MariaDB 10.11; geliştirme/test ortamında SQLite
- PHPUnit 12

React ve CSS dosyaları yayın öncesinde derlenir. Üretim sunucusunda Node.js çalıştırılması zorunlu değildir; derlenmiş `public/build` çıktısı dağıtılabilir.

## Kalite güvencesi

Test paketi; özellik, izin sınırı, doğrulama, stok tutarlılığı, eşzamanlı randevu, veri saklama, erişilebilirlik ve güvenli dosya senaryolarını kapsar.

GitHub Actions veritabanı kabul akışı aynı uygulama testlerini şu ortamlarda çalıştırır:

- MySQL 8.4 / PHP 8.4
- MariaDB 10.11 / PHP 8.4

TypeScript tip denetimi, üretim derlemesi ve PHP kod biçimi kontrolleri de yayın öncesi kalite kapılarıdır.

## Güncel durum

| Alan | Durum |
|---|---|
| Kamu portalı ve kataloglar | Kullanılabilir |
| Yönetim paneli ve dinamik yetkilendirme | Kullanılabilir |
| Envanter, stok, medya ve CSV aktarımı | Kullanılabilir |
| Teslim, kısmi iade ve anonimleştirme | Kullanılabilir |
| Duyuru ve geri bildirim yönetimi | Kullanılabilir |
| Kaydedilmemiş değişiklik ve güvenli taslaklar | Kullanılabilir |
| Çevrimiçi randevu kodu | Hazır; canlı SMTP kabulü bekleniyor |
| Google Sheets/XLSX aktarımı | Planlandı |
| Yetkiye göre yönetim genel bakış ekranı | Kullanılabilir |
| Yetki ve kişisel veri sınırlarına bağlı hızlı arama | Kullanılabilir |
| Yetkiye bağlı bildirim merkezi ve okunmamış sayacı | Kullanılabilir |
| Kişisel veri saklamayan son görüntülenen kayıtlar | Kullanılabilir |
| Güvenli geri alma/ters hareket paketi | Planlandı |

## Ortam ve yayın notları

- Çevrimiçi randevu `ONLINE_BOOKING_ENABLED` ile kontrol edilir.
- Canlı ortamda `APP_DEBUG=false`, HTTPS ve güvenli oturum çerezleri kullanılmalıdır.
- SMTP gönderen adresi, SPF ve DKIM kayıtları gerçek teslimat testiyle doğrulanmalıdır.
- Laravel zamanlayıcısı için sunucuda dakikada bir `php artisan schedule:run` çalıştırılmalıdır.
- `.env`, özel model dosyaları ve canlı veritabanı hiçbir zaman Git deposuna eklenmemelidir.
- Yedekleme yalnız etkinleştirilmemeli, ayrı bir ortamda geri yükleme denemesi de yapılmalıdır.

## Dokümantasyon

- Ayrıntılı geliştirme planı: [ROADMAP.md](./ROADMAP.md)
- cPanel dağıtım ve canlı kabul rehberi: [CPANEL_DEPLOYMENT.md](./CPANEL_DEPLOYMENT.md)
- Son üretim kabul kaydı: [DEPLOYMENT_ACCEPTANCE_2026-10-28.md](./DEPLOYMENT_ACCEPTANCE_2026-10-28.md)

## Lisans

Lisans modeli henüz belirlenmemiştir. Bir lisans dosyası eklenene kadar tüm hakları saklıdır.
