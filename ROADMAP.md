# Sparkoff Proje Atölyesi — Ürün ve Geliştirme Yol Haritası

> Mobil uyumlu atölye portalı; 3D yazıcı randevuları, malzeme envanteri, teslim/iade işlemleri ve yetki tabanlı yönetim.

## Ürün kapsamı

Sparkoff üç ana bölümden oluşur:

1. **Atölye portalı:** Ana sayfa, duyurular, iletişim ve hizmetlere geçiş.
2. **3D yazıcılar:** Yazıcı durumu, takvim, filament kataloğu ve çevrimiçi randevu.
3. **Malzeme envanteri:** Kamu kataloğu, stok yönetimi, teslim/iade ve hareket geçmişi.

Ziyaretçiler hesap açmadan kamuya açık bilgileri görebilir. Yönetim işlemleri, kişiye atanmış rollerin yetkileriyle sınırlandırılır.

## Kesinleşen kararlar

### 3D yazıcı randevuları

- Kullanıcıdan ad, soyad, e-posta, tarih/saat, tahmini süre, model dosyası ve filament bilgisi alınır.
- Telefon numarası ve serbest kullanıcı notu alınmaz.
- Filament kaynağı `atölye` veya `kullanıcı` olarak seçilir; tür ve renk kaydedilir.
- Başvuru e-posta doğrulaması ve yönetici onayından geçer.
- Gerçek SMTP teslimatı doğrulanmadan özellik canlıda açılmaz.
- Kişisel veriler ve model dosyaları ayarlanabilir sürelerle otomatik temizlenir.

### Malzeme envanteri

- Malzemeler **sarf**, **ödünç** veya **demirbaş** olarak sınıflandırılır.
- Malzeme türünü yalnızca gerekli yetkiye sahip yöneticiler belirleyebilir.
- Ziyaretçi kataloğu salt okunurdur; kesin miktar, yalnızca stok durumu veya gizli seçenekleri ürün bazında ayarlanabilir.
- Stok doğrudan ve iz bırakmadan değiştirilmez; her değişiklik bir stok hareketi üretir.
- Hatalı hareket silinmez, yetkili kullanıcı tarafından ters işlemle düzeltilir.

### Teslim ve iade

- Teslim alan kişinin adı ve soyadı zorunlu, e-postası isteğe bağlıdır.
- Telefon, öğrenci numarası ve T.C. kimlik numarası alınmaz.
- Sarf teslimi, ödünç verme, yerinde kullanım, iade, kısmi iade, hasar ve kayıp desteklenir.
- İade edilmeyen veya sonuçlanmayan kayıtlarda kişisel veri korunur; beklenen iade tarihinin geçmesi silme süresini başlatmaz.
- Saklama süresi yalnızca tam iade veya yönetici tarafından sonuçlandırma sonrasında başlar.
- Süre sonunda kişi alanları anonimleştirilir; stok ve denetim hareketi korunur.

### Rol ve yetki sistemi

- Bir kullanıcıya birden fazla rol atanabilir.
- Yetkiler kullanıcıya doğrudan değil, roller üzerinden verilir.
- Yönetici yeni roller oluşturabilir ve yetkilerini düzenleyebilir.
- Korunan **Sistem Yöneticisi** rolü tüm yetkilere sahiptir; son sistem yöneticisi silinemez veya pasifleştirilemez.
- Sayfa görüntüleme, veri değiştirme, dosya indirme, kişisel veri görüntüleme ve dışa aktarma ayrı yetkilerdir.
- Yetki denetimi yalnızca arayüzde değil, her sunucu isteğinde uygulanır.

### Yönetim içi duyurular

- Kamu ve yönetim duyuruları aynı yönetim ekranından oluşturulur; hedef kitle ve yetkileri birbirinden ayrılır.
- Yalnızca yetkili panel kullanıcıları görebilir.
- Sistem Yöneticisi bütün duyuruları görür; diğer yetkililer yalnız atanmış duyuru yetkileri kapsamında işlem yapar.
- Önem seviyesi, hedef roller, yayın süresi, sabitleme ve okundu bilgisi desteklenir.

### Kullanılabilirlik tercihleri

- Yönetim paneli masaüstünde yeniden boyutlandırılabilir ve daraltılabilir bir sol menü kullanır.
- Mobil yönetim menüsü ekran üzerinden açılır; masaüstü sürükleme davranışı mobilde kullanılmaz.
- Tablo yoğunluğu, görünür sütunlar ve kayıtlı filtreler yalnız ilgili yetkilinin kişisel tercihi olur; başka kullanıcıların görünümünü değiştirmez.
- Filtre, sıralama, sayfa ve kaydırma konumu işlemden sonra mümkün olduğunca korunur.
- Taslak saklama kişisel veri, parola, model dosyası ve benzeri hassas alanlara uygulanmaz.
- Toplu işlem ve geri alma yalnız işlem geçmişini ve yetki sınırlarını koruyan güvenli eylemlerde sunulur.
- Renk hiçbir zaman tek başına durum göstergesi değildir; metin veya ikonla desteklenir.

## Bilgi mimarisi

```text
Sparkoff Proje Atölyesi
├── Ana Sayfa
├── 3D Yazıcılar
│   ├── Yazıcı durumu ve takvim
│   ├── Filament kataloğu
│   └── Randevu oluştur / takip
├── Malzemeler
│   ├── Arama ve filtreler
│   └── Malzeme ayrıntısı
└── Yönetim Paneli
    ├── Genel bakış ve yönetim duyuruları
    ├── 3D yazıcılar ve randevular
    ├── Envanter ve stok hareketleri
    ├── Teslimler ve iadeler
    ├── Kullanıcılar, roller ve yetkiler
    ├── Duyurular (ziyaretçi ve yönetim hedefli)
    ├── İşlem geçmişi
    └── Sistem/KVKK ayarları
```

## Uygulama listesi

### A. Dokümantasyon ve temel mimari

- [x] Yeni ürün kararlarını ROADMAP ve README'ye işle
- [x] Yetki anahtarlarını merkezi katalogda tanımla
- [x] Rol, yetki ve çoklu rol tablolarını oluştur
- [x] Mevcut yöneticileri korunan Sistem Yöneticisi rolüne taşı
- [x] Sunucu tarafı yetki middleware katmanını kur
- [x] Yönetici menülerini yetkilere göre göster
- [x] Rol-yetki temel güvenlik testlerini ekle

### B. Kullanıcı, rol ve yetki yönetimi

- [x] Kullanıcı listeleme, oluşturma, düzenleme ve pasifleştirme
- [x] Geçici parola ve yönetici tarafından parola sıfırlama
- [x] Rol oluşturma, düzenleme ve kullanılmayan rolü kaldırma
- [x] Modül bazlı yetki seçim ekranı
- [x] Bir kullanıcıya birden fazla rol atama
- [x] Son Sistem Yöneticisi için kilitlenme koruması
- [x] Hassas yetkileri arayüzde işaretleme
- [x] Rol ve kullanıcı değişikliklerini işlem geçmişine yazma

### C. Envanter veri temeli

- [x] Kategoriler
- [x] Raf/kutu konumları
- [x] Malzemeler ve malzeme türleri
- [x] Ölçü birimleri ve düşük stok sınırı
- [x] Kamu görünürlük modu
- [x] Fotoğraf ve teknik özellikler
- [x] Stok hareketleri ve ters işlem bağlantıları
- [x] Eşzamanlı stok işlemlerinde veritabanı kilidi

### D. Yönetici envanter arayüzü

- [x] Genel stok özeti
- [x] Arama, filtreleme ve sayfalama
- [x] Malzeme ekleme/düzenleme/arşivleme
- [x] Hızlı stok artırma/azaltma
- [x] Sarf/ödünç/demirbaş türü yönetimi
- [x] Kategori ve konum yönetimi
- [x] Düşük stok ve tükenen ürün görünümü
- [x] Hareket geçmişi
- [x] CSV/Excel dışa aktarma

### E. Teslim ve iade sistemi

- [x] Hızlı teslim formu
- [x] Sarf teslimi
- [x] Ödünç verme ve beklenen iade tarihi
- [x] Demirbaş/yerinde kullanım kaydı
- [x] Tam ve kısmi iade
- [x] Hasarlı ve kayıp işlemleri
- [x] Aktif ve gecikmiş teslim listeleri
- [ ] İşlem geri alma/ters hareket
- [x] Kişisel alanlar için ayrı görüntüleme yetkileri
- [x] Tamamlanan kayıtlarda otomatik anonimleştirme

### F. Kamuya açık malzeme kataloğu

- [x] `/malzemeler` sayfası
- [x] Birden fazla sözcükle hızlı arama
- [x] Kategori ve stok filtreleri
- [x] Masaüstü tablo/mobil satır görünümü
- [x] Malzeme açıklaması ve teknik özellik ayrıntıları
- [x] Kesin miktar/durum/gizli görünürlük seçenekleri
- [x] Ana sayfadaki Malzemeler kartını etkinleştirme
- [x] Erişilebilirlik ve mobil kırılım kontrolleri

### G. Google Sheets aktarımı

- [ ] Kaynak sütunları ve veri kalitesini analiz et
- [x] Kategori ve konumları aktarım sırasında eşleştir veya oluştur
- [x] Envanterdeki ve dosya içindeki olası tekrarları belirle
- [x] Sütun eşlemeli ve ön izlemeli CSV içe aktarma
- [ ] XLSX dosyası desteği
- [x] Hatalı satırları ayrı raporla
- [x] Onay sonrası geçerli kayıtları toplu oluştur
- [x] Aktarım sonucunu işlem geçmişine yaz

### H. Yönetim içi duyurular

- [x] Kamu ve yönetim duyurularını birleştiren hedef kitle modeli
- [x] Oluşturma/düzenleme/arşivleme yetkileri
- [x] Önem seviyesi, sabitleme ve yayın süresi
- [x] Tüm yetkililer veya seçili hedef roller
- [x] Okundu/onaylandı bilgisi ve yönetici sayacı
- [x] Yönetim ekranlarında bildirim ve menüde okunmamış sayacı

### I. Geri bildirim ve talepler

- [x] Kişisel bilgi istemeyen öneri, şikâyet ve hata formu
- [x] Bot alanı ve gönderim hızı koruması
- [x] Yetkiye bağlı yönetim talep listesi
- [x] İnceleme, çözüm ve arşiv durumları
- [x] Yönetim iç notu ve işlemi yapan kullanıcı kaydı

### J. Randevu sistemini canlıya hazırlama

- [x] Sınırlı veriyle çevrimiçi başvuru akışı
- [x] Model dosyası ve filament seçimi
- [x] E-posta doğrulama ve yönetici onay kodu
- [ ] `randevu@sparkoff.tr` SMTP yapılandırması
- [ ] SPF/DKIM ve gerçek teslimat testi
- [x] Randevu/model dosyası temizleme komutu
- [ ] cPanel günlük cron görevi
- [ ] Uçtan uca randevu testi
- [ ] Canlıda `ONLINE_BOOKING_ENABLED=true`

### K. Güvenlik, denetim ve yayın

- [ ] Her kritik eylem için izin/verilmeme testleri
- [ ] Kişisel veri görüntüleme ve dışa aktarma logları
- [ ] Aktif teslimlerin yanlışlıkla anonimleştirilmesini engelleyen testler
- [ ] Dosya yükleme ve indirme yetki testleri
- [ ] Yedekleme/geri yükleme testi
- [ ] cPanel üretim paketleri ve migration
- [ ] Mobil, masaüstü ve canlı kabul testi

### L. Yönetim arayüzü temeli — birinci uygulama paketi

- [x] Durum renkleri, rozetleri ve metinlerini bütün modüllerde standartlaştır (seçim 19)
- [x] Mobil yönetim menüsünü ekran üzerinden açılır/kapanır hâle getir (seçim 20)
- [x] Sol menü sınırını fare ve klavyeyle yeniden boyutlandır; minimum/maksimum sınır ve çift tıklamayla sıfırlama ekle (seçim 1)
- [x] Sol menünün geniş/dar durumunu değiştir ve tercihi yerel olarak sakla (seçim 2)
- [x] Rahat, normal ve sıkışık tablo yoğunluklarını ortak bileşen olarak ekle (seçim 7)
- [x] Filtre, sıralama, sayfa ve kaydırma konumunu dönüşlerde koru (seçim 17)
- [x] Masaüstü, tablet, mobil ve klavye erişilebilirlik testlerini ekle

### L.1. Hesaba özel görünüm ayarları — beta öncesi ara paket

- [x] Sol menüdeki tablo yoğunluğu seçimini kaldırıp `Ayarlar → Kişisel ayarlar` sayfasına taşı
- [x] Kişisel ayarlar sayfasını oturum açmış her yetkili kullanıcının yalnız kendi hesabı için kullanabilmesini sağla
- [x] Yalnız tema (açık/koyu/sistem), yazı ve arayüz boyutu (küçük/normal/büyük), tablo yoğunluğu (rahat/normal/sıkışık) ve sol menü (geniş/dar) seçeneklerini sun
- [x] Kişisel tercihleri kullanıcı hesabına bağlı olarak veritabanında sakla ve farklı cihazlarda uygula
- [x] Tüm kişisel görünüm tercihlerini güvenli varsayılanlara döndüren tek işlem ekle
- [x] Ayarlar sekmelerini kullanıcının yetkilerine göre oluştur; kullanıcı yalnız kişisel ayarları ve yetkili olduğu sistem ayarlarını görsün
- [x] Yetkisiz ayar adreslerine doğrudan erişimi sunucu tarafında 403 ile engelle ve izin/verilmeme testlerini ekle
- [x] Açık/koyu tema, üç ölçek, mobil görünüm ve klavye erişilebilirliği için kabul testlerini tamamla
- [x] Açık/koyu tema geçişini göz yormayan kısa bir renk animasyonuyla yumuşat; `prefers-reduced-motion` kullananlarda animasyonu devre dışı bırak

### M. Tablo ve liste verimliliği — ikinci uygulama paketi

- [x] Envanter, teslim, randevu, talep ve kullanıcı tablolarında sunucu tarafı sıralama ekle (seçim 8)
- [x] Görünür sütun ve sütun sırası tercihlerini yalnız ilgili yetkiliye özel sakla; hassas sütunları yetkiyle sınırla (seçim 6)
- [x] Yetkiliye özel kayıtlı filtreler ve varsayılana dönme işlemi ekle (seçim 9)
- [x] Seçim kutuları ve ortak toplu işlem çubuğu altyapısını kur (seçim 10)
- [x] Envanterde toplu kategori, konum, görünürlük ve arşiv işlemlerini yetki/onay/denetim kaydıyla ekle
- [x] Toplu işlemlerde etkilenecek kayıt özetini ve kısmi hata raporunu göster

### N. Form güvenliği ve taslaklar — üçüncü uygulama paketi

- [x] Kaydedilmemiş değişiklikle sayfadan veya sekmeden ayrılma uyarısı ekle (seçim 12)
- [x] Duyuru, malzeme ve sistem ayarı formlarında hassas olmayan yerel taslak saklama ekle (seçim 13)
- [x] Taslağı geri yükle, reddet ve temizle akışlarını oluştur
- [x] Parola, kişi bilgisi, e-posta, model dosyası ve teslim verilerinin tarayıcı taslağına yazılmadığını test et

### O. Yönetim çalışma alanı — dördüncü uygulama paketi

- [x] Yetkiye göre şekillenen yönetim genel bakış ekranı oluştur (seçim 3)
- [ ] Kritik stok, geciken teslim, bekleyen randevu, arızalı yazıcı ve açık talep özetlerini ekle
- [ ] Modüller arası hızlı arama altyapısı kur; kişisel sonuçları ayrı izinlerle sınırla (seçim 5)
- [ ] Yetkiye bağlı sistem bildirimleri, bildirim zili ve okunmamış sayacı ekle (seçim 16)
- [ ] Son görüntülenen kayıtları kişisel veri saklamadan yetkiliye özel tut (seçim 15)
- [ ] Bulunulan sayfaya ve yetkiye göre hızlı işlem düğmesi göster (seçim 4)

### P. Güvenli geri alma ve ters işlemler — beşinci uygulama paketi

- [ ] Teslim ve stok işlemleri için silme yerine ters hareket altyapısını tamamla
- [ ] Hangi işlemlerin kısa süreli doğrudan geri alınabileceğini merkezi kurallarla belirle (seçim 11)
- [ ] Stok, kategori, konum, görünürlük ve duyuru durumu için güvenli geri alma bildirimi ekle
- [ ] Parola, kullanıcı yetkisi, teslim/iade, hasar/kayıp ve içe aktarmada doğrudan geri almayı engelle
- [ ] Her geri alma ve ters hareketi işlem geçmişine bağlantılı biçimde kaydet

### Q. Ziyaretçi malzeme kataloğu — altıncı uygulama paketi

- [ ] Malzeme tablosuna sıralama ve kategori başına sonuç sayısı ekle (seçim 18)
- [ ] “Yalnız stokta olanlar” hızlı filtresi ve mobil filtre paneli ekle
- [ ] Filtrelenmiş katalog bağlantılarının paylaşılabilir ve yenilemede kalıcı olmasını sağla
- [ ] Teknik özellik açılımını ve son güncellenme bilgisini iyileştir
- [ ] Hesap oluşturmadan tarayıcıda tutulan favori malzemeleri ekle
- [ ] Mobil ve ekran okuyucu kabul testlerini tamamla

### R. Malzeme görselleri ve bağlantıları — envanter medya paketi

- [x] Malzeme başına bir kapak ve sıralanabilir birden fazla fotoğraf ekleme, değiştirme ve kaldırma altyapısını kur
- [x] Fotoğraflarda dosya türü/boyut sınırı, güvenli dosya adı, yetki kontrolü ve kullanılmayan dosya temizliği uygula
- [x] Her görsel için erişilebilir alternatif metin alanı ekle
- [x] Malzemeye isteğe bağlı video veya harici kaynak bağlantıları ekleme ve düzenleme alanı sun
- [x] Harici adresleri yalnız güvenli `https` bağlantılarıyla sınırla; video/dosya gösterimini güvenli içerik kurallarıyla uygula
- [x] Yönetim envanterinde medya ön izlemesi ve sıralama arayüzü oluştur
- [x] Ziyaretçi malzeme tablosunda küçük kapak görseli, ayrıntıda galeri, video ve ilgili bağlantıları göster
- [x] Mobil görünüm, bozuk bağlantı/yedek görsel, dosya yetkisi ve güvenlik kabul testlerini tamamla

## Seçilen kullanılabilirlik özelliklerinin uygulama sırası

1. **Arayüz temeli:** L paketi — durum dili, mobil menü, sürüklenebilir/daraltılabilir menü, yoğunluk ve görünümün korunması.
2. **Kişisel görünüm:** L.1 ara paketi — sade hesap tercihleri ve yetkiye göre ayar sekmeleri.
3. **Malzeme medyası:** R paketi — yönetilebilir fotoğraf galerisi, isteğe bağlı video ve güvenli harici bağlantılar.
4. **Tablo altyapısı:** M paketi — sıralama, kişisel sütun tercihleri, kayıtlı filtreler ve güvenli toplu seçim.
5. **Form güvenliği:** N paketi — kayıp değişiklik uyarıları ve hassas veri içermeyen taslaklar.
6. **Çalışma alanı:** O paketi — genel bakış, arama, bildirimler, son kayıtlar ve hızlı işlem.
7. **İşlem güvenliği:** P paketi — ters hareket ve yalnız güvenli işlemlerde geri alma.
8. **Ziyaretçi deneyimi:** Q paketi — kamu kataloğunun sıralama, mobil filtre ve favori özellikleri.

Bu sıra ortak bileşenleri önce kurarak aynı özelliğin farklı sayfalarda tekrar yazılmasını önler. Her paket kendi yetki sınırı, mobil görünüm, regresyon ve güvenlik testleri tamamlandıktan sonra ayrı commit edilir.

## Başlangıç yetki grupları

| Modül | Örnek yetkiler |
|---|---|
| Envanter | görüntüle, oluştur, düzenle, tür değiştir, stok düzelt, içe/dışa aktar |
| Teslimler | görüntüle, teslim et, iade al, hasar/kayıp bildir, kişisel veri gör |
| Yazıcılar | görüntüle, durum değiştir, takvim/filament/saat yönet |
| Randevular | görüntüle, onayla, reddet, dosya indir, kişisel veri gör |
| İçerik | kamu duyuruları ve atölye/iletişim ayarları |
| İç duyurular | görüntüle, oluştur, düzenle, arşivle |
| Geri bildirimler | görüntüle, incele, çöz ve arşivle |
| Sistem | kullanıcı, rol, işlem geçmişi, KVKK ve sistem ayarları |

## Veri saklama ilkesi

- Aktif, gecikmiş veya çözümlenmemiş teslimlerin kişi bilgileri otomatik silinmez.
- Beklenen iade tarihi veri saklama başlangıcı değildir.
- Saklama süresi `returned_at` veya `resolved_at` sonrasında başlar.
- Süre sonunda ad, soyad, e-posta ve kişiyi tanımlayan serbest alanlar anonimleştirilir.
- Stok hareketi, miktar, işlem türü ve yetkili işlem kaydı korunur.
- Otomatik görev günlük çalışır ve yaptığı işlemleri denetim kaydına yazar.
- Özel bir uyuşmazlık için anonimleştirme durdurulursa gerekçe ve yetkili kaydedilir.

## Sıradaki teknik adım

O paketinde sıradaki adım, genel bakış ekranına kritik stok, geciken teslim, bekleyen randevu, arızalı yazıcı ve açık talep özetlerini eklemektir.
