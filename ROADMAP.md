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

- Kamu duyurularından tamamen ayrı tutulur.
- Yalnızca yetkili panel kullanıcıları görebilir.
- Başlangıçta yalnızca Sistem Yöneticisi yayımlar ve düzenler.
- Önem seviyesi, hedef roller, yayın süresi, sabitleme ve okundu bilgisi desteklenir.

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
    ├── Genel bakış ve iç duyurular
    ├── 3D yazıcılar ve randevular
    ├── Envanter ve stok hareketleri
    ├── Teslimler ve iadeler
    ├── Kullanıcılar, roller ve yetkiler
    ├── Kamu duyuruları
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
- [ ] Rol ve kullanıcı değişikliklerini işlem geçmişine yazma

### C. Envanter veri temeli

- [ ] Kategoriler
- [ ] Raf/kutu konumları
- [ ] Malzemeler ve malzeme türleri
- [ ] Ölçü birimleri ve düşük stok sınırı
- [ ] Kamu görünürlük modu
- [ ] Fotoğraf ve teknik özellikler
- [ ] Stok hareketleri ve ters işlem bağlantıları
- [ ] Eşzamanlı stok işlemlerinde veritabanı kilidi

### D. Yönetici envanter arayüzü

- [ ] Genel stok özeti
- [ ] Arama, filtreleme ve sayfalama
- [ ] Malzeme ekleme/düzenleme/arşivleme
- [ ] Hızlı stok artırma/azaltma
- [ ] Sarf/ödünç/demirbaş türü yönetimi
- [ ] Kategori ve konum yönetimi
- [ ] Düşük stok ve tükenen ürün görünümü
- [ ] Hareket geçmişi
- [ ] CSV/Excel dışa aktarma

### E. Teslim ve iade sistemi

- [ ] Hızlı teslim formu
- [ ] Sarf teslimi
- [ ] Ödünç verme ve beklenen iade tarihi
- [ ] Demirbaş/yerinde kullanım kaydı
- [ ] Tam ve kısmi iade
- [ ] Hasarlı ve kayıp işlemleri
- [ ] Aktif ve gecikmiş teslim listeleri
- [ ] İşlem geri alma/ters hareket
- [ ] Kişisel alanlar için ayrı görüntüleme yetkileri
- [ ] Tamamlanan kayıtlarda otomatik anonimleştirme

### F. Kamuya açık malzeme kataloğu

- [ ] `/malzemeler` sayfası
- [ ] Hızlı arama ve yazım toleransı
- [ ] Kategori, konum ve stok filtreleri
- [ ] Masaüstü liste/mobil kart görünümü
- [ ] Malzeme ayrıntı paneli
- [ ] Kesin miktar/durum/gizli görünürlük seçenekleri
- [ ] Ana sayfadaki Malzemeler kartını etkinleştirme
- [ ] Erişilebilirlik ve mobil testleri

### G. Google Sheets aktarımı

- [ ] Kaynak sütunları ve veri kalitesini analiz et
- [ ] Kategorileri ve konumları standartlaştır
- [ ] Olası tekrarları belirle
- [ ] Ön izlemeli CSV/XLSX içe aktarma
- [ ] Hatalı satırları ayrı raporla
- [ ] Onay sonrası toplu kayıt oluştur
- [ ] Aktarım sonucunu işlem geçmişine yaz

### H. Yönetim içi duyurular

- [ ] Ayrı iç duyuru veri modeli
- [ ] Oluşturma/düzenleme/arşivleme yetkileri
- [ ] Önem seviyesi ve yayın süresi
- [ ] Hedef roller
- [ ] Okundu/onaylandı bilgisi
- [ ] Yönetim ana ekranı bildirimi ve okunmamış sayacı

### I. Randevu sistemini canlıya hazırlama

- [x] Sınırlı veriyle çevrimiçi başvuru akışı
- [x] Model dosyası ve filament seçimi
- [x] E-posta doğrulama ve yönetici onay kodu
- [ ] `randevu@sparkoff.tr` SMTP yapılandırması
- [ ] SPF/DKIM ve gerçek teslimat testi
- [ ] Randevu/model dosyası temizleme komutu
- [ ] cPanel günlük cron görevi
- [ ] Uçtan uca randevu testi
- [ ] Canlıda `ONLINE_BOOKING_ENABLED=true`

### J. Güvenlik, denetim ve yayın

- [ ] Her kritik eylem için izin/verilmeme testleri
- [ ] Kişisel veri görüntüleme ve dışa aktarma logları
- [ ] Aktif teslimlerin yanlışlıkla anonimleştirilmesini engelleyen testler
- [ ] Dosya yükleme ve indirme yetki testleri
- [ ] Yedekleme/geri yükleme testi
- [ ] cPanel üretim paketleri ve migration
- [ ] Mobil, masaüstü ve canlı kabul testi

## Başlangıç yetki grupları

| Modül | Örnek yetkiler |
|---|---|
| Envanter | görüntüle, oluştur, düzenle, tür değiştir, stok düzelt, içe/dışa aktar |
| Teslimler | görüntüle, teslim et, iade al, hasar/kayıp bildir, kişisel veri gör |
| Yazıcılar | görüntüle, durum değiştir, takvim/filament/saat yönet |
| Randevular | görüntüle, onayla, reddet, dosya indir, kişisel veri gör |
| İçerik | kamu duyuruları ve atölye/iletişim ayarları |
| İç duyurular | görüntüle, oluştur, düzenle, arşivle |
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

Dinamik rol-yetki altyapısını kurmak, mevcut yönetici erişimini Sistem Yöneticisi rolüne taşımak ve ardından envanter veri modeline geçmek.
