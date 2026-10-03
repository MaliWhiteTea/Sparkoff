# Sparkoff Proje Atölyesi — Ürün ve Geliştirme Roadmap'i

> Sparkoff Proje Atölyesi'nin hizmetlerini tek merkezde sunan, mobil uyumlu ve modüler atölye portalı.

## İçindekiler

- [Proje vizyonu](#proje-vizyonu)
- [Temel kararlar](#temel-kararlar)
- [Bilgi mimarisi](#bilgi-mimarisi)
- [3D yazıcı sistemi](#3d-yazıcı-sistemi)
- [Malzeme ve ekipman sistemi](#malzeme-ve-ekipman-sistemi)
- [Yönetici paneli](#yönetici-paneli)
- [Geliştirme fazları](#geliştirme-fazları)
- [Mahremiyet yaklaşımı](#mahremiyet-yaklaşımı)
- [MVP kabul kriterleri](#mvp-kabul-kriterleri)
- [Ertelenen özellikler](#ertelenen-özellikler)

## Proje vizyonu

Sparkoff yalnızca bir 3D yazıcı randevu sitesi olmayacaktır. Ana sayfa, atölyeyi ve sunduğu hizmetleri tanıtan bir portal görevi görecek; her hizmet zamanla kendi modülü olarak portala eklenecektir.

İlk tamamlanacak modül **3D Yazıcılar** modülüdür. Ziyaretçiler yazıcıların durumunu, boş ve dolu zamanlarını, bakım aralıklarını ve mevcut filamentleri görebilecek; ancak siteden randevu oluşturmayacaktır. Randevu görüşmeleri yüz yüze, telefon veya WhatsApp üzerinden yürütülecektir.

İkinci ana modül, 3D yazıcı sistemi tamamlandıktan sonra geliştirilecek **Malzeme ve Ekipman** sistemidir. Bu modül Arduino, sensör, motor, elektronik bileşen ve benzeri atölye stoklarının yönetilmesini sağlayacaktır.

## Temel kararlar

| Konu | Karar |
|---|---|
| Ürün tipi | Modüler atölye portalı |
| İlk modül | 3D yazıcı durumu ve müsaitlik takvimi |
| İkinci modül | Malzeme ve ekipman stok yönetimi |
| Arayüz dili | Türkçe |
| Kullanıcı hesabı | Yok |
| Çevrimiçi randevu | İlk sürümde yok |
| Ziyaretçiden kişisel veri | Toplanmayacak |
| Ziyaretçi dosya yükleme | Olmayacak |
| Randevu iletişimi | Yüz yüze, telefon veya WhatsApp |
| Kamuya açık takvim | Müsait, dolu, bakımda, arızalı ve kapalı durumları |
| Takvimde kişisel bilgi | Kullanıcı adı, telefon, proje ve dosya gösterilmeyecek |
| Yazıcı sayısı | Başlangıçta iki; durumları yönetici tarafından değiştirilebilir |
| Filamentler | Tür, renk, marka, teknik özellik ve kullanılabilirlik gösterilecek |
| Yönetilebilirlik | Operasyonel içerik ve kurallar yönetici panelinden değiştirilebilir |
| Barındırma | Mevcut cPanel sunucusu |
| Teknoloji | Laravel, Inertia.js, React ve TypeScript |

## Bilgi mimarisi

```text
Sparkoff Proje Atölyesi
│
├── Ana Sayfa
│   ├── Atölye tanıtımı
│   ├── Hizmetler
│   ├── Atölye durumu
│   ├── Duyurular
│   └── İletişim
│
├── 3D Yazıcılar
│   ├── Yazıcı durumları
│   ├── Haftalık müsaitlik takvimi
│   ├── Mevcut filamentler
│   ├── Baskı kuralları
│   └── Randevu için iletişim
│
└── Malzeme ve Ekipman
    ├── Genel stok görünümü
    ├── Malzeme kategorileri
    ├── Stok hareketleri
    └── Ödünç/sarf ayrımı
```

### Ana sayfa

Ana sayfa belirli bir sisteme ait form değil, atölyenin kurumsal giriş noktası olacaktır:

- Sparkoff Proje Atölyesi'nin kısa tanıtımı
- Atölyenin açık/kapalı durumu
- Güncel duyurular
- Hizmet kartları
- 3D yazıcıların özet durumu
- İletişim bilgileri
- Gelecekteki modüller için genişleyebilir alan

İlk yayında **3D Yazıcılar** kartı aktif, **Malzeme ve Ekipman** kartı ise “Yakında” etiketiyle gösterilecektir.

## 3D yazıcı sistemi

### Ziyaretçi deneyimi

Ziyaretçi `/3d-yazicilar` bölümünde:

- Her yazıcının adını, kodunu ve mevcut durumunu görür.
- Günlük veya haftalık takvimden boş ve dolu zamanları inceler.
- Bakım, arıza ve atölyenin kapalı olduğu zamanları ayırt eder.
- Atölyedeki mevcut filamentleri ve teknik özelliklerini inceler.
- Desteklenen dosya biçimlerini ve temel baskı kurallarını okur.
- Randevu için telefon veya WhatsApp bağlantısını kullanır.

Ziyaretçi form doldurmaz, hesap oluşturmaz, dosya yüklemez ve siteye ad, soyad, e-posta veya telefon bilgisi girmez.

### Kamuya açık durumlar

| Durum | Anlamı |
|---|---|
| Müsait | İletişime geçilerek kullanım talep edilebilir |
| Dolu | Yazıcı belirtilen zaman aralığında kullanımdadır |
| Bakımda | Planlı bakım nedeniyle kullanılamaz |
| Arızalı | Teknik arıza nedeniyle kullanılamaz |
| Kapalı | Atölye veya yazıcı ilgili zaman aralığında kullanıma kapalıdır |

### Takvim kuralları

- Kamuya açık takvimde yalnızca durum ve zaman aralığı gösterilir.
- Doluluk kaydında kullanıcıya ilişkin hiçbir alan bulunmaz.
- Doluluklar belirli bir yazıcıya bağlanır.
- Başlangıç ve bitiş zamanı yönetici tarafından belirlenir.
- Çakışan kayıtlar sunucu tarafında engellenir.
- Tüm günü veya birden fazla günü kapsayan bakım/kapalı zaman oluşturulabilir.
- Mobil görünümde gün bazlı liste, geniş ekranda haftalık takvim kullanılabilir.

### Filament kataloğu

Her filament için şu bilgiler desteklenecektir:

- Malzeme türü, renk ve marka
- Çap ve makara ağırlığı
- Nozzle ve tabla sıcaklık aralıkları
- Teknik kullanım notu
- Kullanılabilirlik durumu
- Geçici kullanılamama gerekçesi

### İletişim alanı

- Telefon numarası ve WhatsApp bağlantısı yönetici panelinden değiştirilebilir olmalıdır.
- Numaranın herkese açık olduğu yönetici ekranında belirtilmelidir.
- Mümkünse kişisel numara yerine ayrı bir atölye hattı kullanılmalıdır.
- WhatsApp bağlantısının üçüncü taraf hizmete yönlendirdiği belirtilmelidir.
- İletişim saatleri ayrıca tanımlanabilmelidir.

## Malzeme ve ekipman sistemi

Bu modül 3D yazıcı sistemi tamamlandıktan sonra geliştirilecektir.

### Amaç

Atölyedeki Arduino, sensör, motor, geliştirme kartı, kablo, el aleti ve sarf malzemelerinin güncel durumunu yönetmek.

### Temel stok durumları

- Toplam adet
- Kullanılabilir adet
- Kullanımda/ödünç verilen adet
- Rezerve edilen adet
- Arızalı veya kayıp adet
- Minimum stok seviyesi

### Malzeme türleri

| Tür | Örnek | Davranış |
|---|---|---|
| Sarf malzemesi | Lehim teli, jumper kablo | Verildiğinde kullanılabilir stok azalır |
| Ödünç ekipman | Arduino Uno, multimetre | Verildiğinde kullanımda sayısı artar; iade beklenir |
| Demirbaş | Osiloskop, güç kaynağı | Konumu ve kullanım durumu takip edilir |

İlk stok sürümü yalnızca miktarları ve stok hareketlerini yönetecek; malzemeyi teslim alan kişinin adı veya iletişim bilgisi siteye kaydedilmeyecektir. Kişi bazlı ödünç takip istenirse ayrı bir veri koruma değerlendirmesi yapılacaktır.

## Yönetici paneli

```text
Genel Bakış
├── Atölye özeti
├── Bugünkü yazıcı durumu
└── Kritik stok/bakım uyarıları

3D Yazıcılar
├── Uygunluk takvimi
├── Yazıcılar
├── Filamentler
├── Çalışma saatleri
└── Baskı ve iletişim ayarları

Malzeme ve Ekipman
└── Yakında

Site Yönetimi
├── Atölye bilgileri
├── İletişim
└── Duyurular
```

Yönetici:

- Takvime dolu zaman ekleyebilir, düzenleyebilir ve silebilir.
- Yazıcıyı aktif, bakımda, arızalı veya pasif duruma alabilir.
- Planlı bakım ve özel kapalı zaman tanımlayabilir.
- Çalışma günleri ile saatlerini değiştirebilir.
- Filamentleri ve teknik özelliklerini yönetebilir.
- Filament türünü gerekçe belirterek geçici olarak kapatabilir.
- Kamuya açık telefon, WhatsApp ve iletişim saatlerini düzenleyebilir.
- Takvim kayıtlarında kişisel bilgi tutulmaması konusunda uyarılır.

## Geliştirme fazları

### Faz 0 — Yön değişikliği ve veri minimizasyonu

- Çevrimiçi randevuyu ürün kapsamından çıkar.
- `/randevu`, doğrulama ve takip rotalarını kamu erişimine kapat.
- Ana sayfadaki “Randevu oluştur” çağrılarını kaldır.
- Mevcut randevu kodunu geri dönüş ihtimali için silmeden izole et.
- Yeni takvimde kişisel veri alanlarını kullanma.

**Çıktı:** Ziyaretçiden kişisel veri veya dosya toplamayan güvenli başlangıç noktası.

### Faz 1 — Atölye portalı ana sayfası

- Ana sayfayı atölye portalına dönüştür.
- Atölye tanıtımı ve hizmet kartlarını ekle.
- 3D Yazıcılar modülüne belirgin geçiş oluştur.
- Malzeme ve Ekipman kartını “Yakında” olarak ekle.
- Yönetilebilir iletişim ve atölye durumu alanlarını oluştur.
- Mobil menü ve erişilebilir gezinmeyi tamamla.

**Çıktı:** Sparkoff'un tüm modüllerini taşıyabilecek yeni ana sayfa.

### Faz 2 — Kamuya açık 3D yazıcı sayfası

- `/3d-yazicilar` sayfasını oluştur.
- Yazıcı durum kartlarını ekle.
- Haftalık/günlük uygunluk takvimini oluştur.
- Durumlar için açık ve erişilebilir görsel dil tanımla.
- Filament kataloğunu modüle bağla.
- Baskı kuralları ve desteklenen formatları göster.
- Telefon ve WhatsApp çağrılarını ekle.

**Çıktı:** Ziyaretçilerin kişisel veri vermeden yazıcı durumunu anlayabildiği modül.

### Faz 3 — Yönetici doluluk takvimi

- Kişisel veri içermeyen `schedule_blocks` veri modelini oluştur.
- Yazıcı, başlangıç, bitiş, durum ve kamuya açık kısa açıklama alanlarını ekle.
- Çakışma kontrolünü sunucu tarafında uygula.
- Takvimden kayıt ekleme, düzenleme ve silme akışlarını oluştur.
- Tüm gün ve çok günlük bakım/kapalı zamanlarını destekle.
- Temel yönetici işlem kaydı tut.

**Çıktı:** Yüz yüze alınan randevuların anonim doluluk olarak işlendiği takvim.

### Faz 4 — Yazıcı, filament ve çalışma ayarları

- Mevcut yazıcı yönetimini yeni kamu sayfasına bağla.
- Yazıcı bakım ve arıza durumlarını takvime yansıt.
- Filament kullanılabilirlik sistemini tamamla.
- Çalışma saatlerini kamu takviminde uygula.
- İletişim bilgilerini yönetilebilir yap.
- Baskı kuralları ve dosya biçimlerini salt bilgi olarak göster.

**Çıktı:** Operasyonel bilgilerin yönetici panelinden güncellenebildiği sistem.

### Faz 5 — Site yönetimi ve duyurular

- Atölye başlığı, açıklaması ve iletişim bilgilerini yönetilebilir yap.
- Duyuru oluşturma, yayınlama ve yayından kaldırma özelliklerini ekle.
- Planlı bakım ve önemli uyarıları ana sayfada göster.
- Hizmet kartlarını yeni modüllere uygun tasarla.

**Çıktı:** İçeriği kod değişikliği olmadan güncellenebilen portal.

### Faz 6 — Test, güvenlik ve erişilebilirlik

- Takvim çakışma ve sınır testleri
- Yetkisiz yönetici erişimi testleri
- Mobil ve masaüstü görünüm testleri
- Klavye ile gezinme ve ekran okuyucu etiketleri
- Renklerin yalnız başına durum belirtmemesi
- XSS, CSRF, oturum ve hız sınırlama kontrolleri
- Kişisel bilgi içeren yönetici notlarını önleyici uyarılar
- Yedekleme ve geri yükleme testi

**Çıktı:** Canlı kullanıma uygun, test edilmiş ilk sürüm.

### Faz 7 — cPanel yayını

- Production veritabanı, domain ve SSL yapılandırması
- Ortam değişkenleri ve Laravel `public` belge kökü
- Migration'lar ve üretim varlıkları
- Dosya/dizin izinleri
- İlk yönetici hesabı
- Yedekleme ve hata kayıtları
- Mobil ve masaüstü canlı kabul testi

**Çıktı:** cPanel üzerinde çalışan Sparkoff Proje Atölyesi portalı.

### Faz 8 — Malzeme ve ekipman modülü

- Kategori ve ürün veri modelleri
- Stok giriş/çıkış hareketleri
- Sarf ve ödünç ekipman ayrımı
- Arızalı/kayıp durumları
- Kritik stok uyarıları
- Kamuya açık stok görünümü
- Kişi bilgisi toplamayan ilk teslim modeli
- Raporlama ve hareket geçmişi

**Çıktı:** Atölye malzemelerinin adet ve durum bazında yönetildiği ikinci ana modül.

## Mahremiyet yaklaşımı

İlk sürüm ziyaretçiden form yoluyla kişisel veri toplamayacaktır:

- Ad, soyad, e-posta ve telefon alanı bulunmayacak.
- Kullanıcı hesabı ve üyelik sistemi bulunmayacak.
- Ziyaretçi dosya yükleyemeyecek.
- Takvim kayıtlarında randevu sahibinin bilgisi tutulmayacak.
- Analiz, reklam veya zorunlu olmayan takip çerezi eklenmeyecek.
- Yönetici notlarında kişisel bilgi tutulmayacak.

Tamamen “veri yoktur” iddiasında bulunulmayacaktır. Hosting sağlayıcısının güvenlik amacıyla IP ve erişim logları tutabileceği, WhatsApp/telefon iletişiminin siteden ayrı bir kanal olduğu dikkate alınacaktır.

Kamuya açık kısa gizlilik bilgilendirmesi; sitede üyelik veya iletişim formu olmadığını, doğrudan kişisel bilgi istenmediğini, zorunlu olmayan çerez kullanılmadığını, sunucu güvenlik loglarının tutulabileceğini ve WhatsApp'ın üçüncü taraf hizmet olduğunu açıklamalıdır.

Gelecekte çevrimiçi talep, kişi bazlı ödünç verme, üyelik, e-posta bildirimi veya dosya yükleme eklenirse veri koruma değerlendirmesi yeniden yapılmalıdır.

## MVP kabul kriterleri

- [ ] Ana sayfa Sparkoff Proje Atölyesi'ni ve hizmetlerini tanıtır.
- [ ] 3D Yazıcılar modülüne ana sayfadan ulaşılabilir.
- [ ] Malzeme ve Ekipman modülü “Yakında” olarak gösterilir.
- [ ] Ziyaretçi aktif, bakımda, arızalı ve pasif yazıcıları ayırt edebilir.
- [ ] Ziyaretçi günlük veya haftalık müsaitlik takvimini görebilir.
- [ ] Takvimde hiçbir kullanıcı veya proje bilgisi gösterilmez.
- [ ] Sistem ziyaretçiden kişisel veri ve dosya istemez.
- [ ] Yönetici anonim doluluk kaydı ekleyebilir, düzenleyebilir ve silebilir.
- [ ] Aynı yazıcıdaki çakışan doluluk kayıtları engellenir.
- [ ] Bakım, kapalı zaman ve çalışma saatleri yönetilebilir.
- [ ] Yazıcı durum değişiklikleri kamu sayfasına yansır.
- [ ] Filamentler ve teknik özellikleri görüntülenebilir.
- [ ] Filament türleri gerekçeyle geçici olarak kapatılabilir.
- [ ] Telefon, WhatsApp ve iletişim saatleri yönetici panelinden değiştirilebilir.
- [ ] Site mobil ve masaüstünde kullanılabilir.
- [ ] Yönetici paneli yetkisiz erişime kapalıdır.
- [ ] cPanel üretim kurulumu belgelenmiş ve test edilmiştir.

## Ertelenen özellikler

Aşağıdaki özellikler ilk sürümden çıkarılmıştır ve ancak gerekli kurumsal/veri koruma şartları netleşirse tekrar değerlendirilecektir:

- Çevrimiçi randevu formu
- Ad, soyad, e-posta ve telefon toplama
- Kullanıcı hesabı
- E-posta doğrulama ve bildirimler
- Baskı dosyası yükleme
- Güvenli randevu takip bağlantısı
- Kullanıcı tarafından çevrimiçi iptal
- Kişi bazlı malzeme ödünç takibi

---

Sonraki adım, **Faz 0 ve Faz 1** kapsamında mevcut randevu rotalarını kamu erişimine kapatmak ve ana sayfayı Sparkoff Proje Atölyesi portalına dönüştürmektir.
