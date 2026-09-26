# 3D Yazıcı Randevu Sistemi — Ürün ve Geliştirme Roadmap'i

> Okul atölyesi için ücretsiz, hesapsız ve yönetici onaylı 3D yazıcı randevu sistemi.

## İçindekiler

- [Proje özeti](#proje-özeti)
- [Temel kararlar](#temel-kararlar)
- [Kullanıcı akışı](#kullanıcı-akışı)
- [Yönetici yetenekleri](#yönetici-yetenekleri)
- [Geliştirme fazları](#geliştirme-fazları)
- [KVKK ve mahremiyet](#kvkk-ve-mahremiyet)
- [MVP kabul kriterleri](#mvp-kabul-kriterleri)
- [Gelecek sürümler](#gelecek-sürümler)

## Proje özeti

Sistem, okul atölyesindeki 3D yazıcılar için randevu oluşturmayı ve baskı sürecini takip etmeyi sağlar. Kullanıcı hesabı bulunmaz. Kullanıcılar e-posta doğrulaması yaptıktan sonra kendilerine gönderilen güvenli bağlantı üzerinden randevularını takip eder ve iptal edebilir.

Başlangıçta iki yazıcı sisteme tanımlanır:

- Bir yazıcı rezervasyona açıktır.
- Arızalı olan ikinci yazıcı **Bakımda** durumunda tutulur ve rezervasyona kapalıdır.

## Temel kararlar

| Konu | Karar |
|---|---|
| Kullanım alanı | Okul atölyesi |
| Ücretlendirme | Ücretsiz |
| Arayüz dili | Türkçe |
| Kullanıcı hesabı | Yok |
| Kimlik doğrulama | E-posta doğrulaması ve güvenli takip bağlantısı |
| Toplanan iletişim bilgileri | Ad, soyad, e-posta ve telefon numarası |
| Telefonun kullanım amacı | Acil ve operasyonel durumlarda kullanıcıya hızlıca ulaşmak |
| Bildirim kanalı | E-posta; SMS kullanılmayacak |
| Başlangıçtaki onay modeli | Her randevu yönetici onayından geçer |
| İptal | Kullanıcı istediği zaman iptal edebilir |
| Dosya yükleme | Zorunlu |
| Desteklenen dosyalar | G-code, 3MF, STL ve STEP/STP |
| Filament | Atölye filamenti veya kullanıcının kendi filamenti |
| Varsayılan çalışma düzeni | Hafta içi 09.00–17.00, 30 dakikalık adımlar |
| Yönetilebilirlik | Çalışma düzeni dahil operasyonel kurallar yönetici panelinden değiştirilebilir |
| Barındırma | Mevcut cPanel sunucusu |

## Kullanıcı akışı

1. Kullanıcı rezervasyona açık yazıcıyı görür.
2. Takvimden uygun tarihi, başlangıç saatini ve süreyi seçer.
3. Sistem seçimin çalışma saatlerine, kapalı zamanlara ve mevcut randevulara uygunluğunu kontrol eder.
4. Kullanıcı ad, soyad, e-posta ve telefon numarasını girer.
5. G-code, 3MF, STL veya STEP/STP dosyası yükler.
6. Atölye filamentini veya kendi filamentini kullanmayı seçer.
7. Gerekli baskı ayrıntılarını doldurur ve aydınlatma metnine erişir.
8. Sistem doğrulama e-postası gönderir.
9. E-posta doğrulanınca randevu **Onay bekliyor** durumuna geçer.
10. Yönetici randevuyu inceler ve işlem yapar.
11. Kullanıcı, e-postayla gönderilen güvenli bağlantıdan süreci takip eder veya randevuyu iptal eder.

### Randevu durumları

```text
Onay bekliyor
    ├── Değişiklik istendi
    ├── Reddedildi
    ├── İptal edildi
    └── Onaylandı
          └── Baskıya hazır
                └── Basılıyor
                      ├── Tamamlandı
                      └── Baskı başarısız
```

## Yönetici yetenekleri

Yönetici paneli aşağıdaki işlemleri desteklemelidir:

- Günlük, haftalık ve liste şeklinde randevu görünümü
- Bekleyen randevuları inceleme
- Randevuyu onaylama veya reddetme
- Kullanıcıdan değişiklik ya da yeni dosya isteme
- Randevu süresini veya yazıcıyı değiştirme
- Randevu durumunu güncelleme
- Yüklenen dosyaya güvenli biçimde erişme
- Kullanıcıya işlem e-postası gönderme
- Yönetici notu ekleme
- Randevu ve yönetici işlem geçmişini görüntüleme
- Yazıcı ekleme ve durumunu değiştirme
- Çalışma günlerini ve saatlerini yönetme
- Bakım, tatil ve özel kapalı zamanlar tanımlama
- Zaman dilimi büyüklüğünü değiştirme
- Minimum ve maksimum randevu süresini belirleme
- En erken ve en geç rezervasyon tarihini belirleme
- Randevular arasında hazırlık/temizlik süresi tanımlama
- İzin verilen dosya türlerini ve dosya boyutu sınırını değiştirme
- Atölye filament türlerini, renklerini ve stok durumunu yönetme
- E-posta şablonlarını ve temel sistem ayarlarını yönetme

> Yönetici bir randevunun tarihini veya saatini değiştirirse kullanıcıya açık bir bildirim gönderilmelidir. Değişiklik sessizce uygulanmamalıdır.

## Geliştirme fazları

### Faz 0 — Teknik keşif ve cPanel kontrolü

Öncelikle mevcut sunucunun yetenekleri doğrulanacaktır:

- Node.js uygulama desteği
- PHP ve MySQL/MariaDB sürümleri
- Cron job desteği
- SMTP/e-posta gönderme imkânı
- Dosya ve disk kullanım sınırları
- SSL ve domain/subdomain durumu
- Yedekleme olanakları

Node.js desteği yeterliyse Next.js tabanlı mimari değerlendirilebilir. Klasik cPanel ortamında daha güvenilir dağıtım için önerilen alternatif:

- Laravel
- Inertia.js
- React ve TypeScript
- Tailwind CSS
- Framer Motion
- MySQL/MariaDB

**Çıktı:** Kesin teknoloji seçimi, yerel geliştirme düzeni ve yayınlama planı.

### Faz 1 — İş kuralları ve veri modeli

Planlanan temel veri yapıları:

- Yöneticiler
- Yazıcılar
- Randevular
- Randevu durum geçmişi
- Yüklenen dosyalar
- Filament seçenekleri
- Çalışma saatleri
- Kapalı ve bakım zamanları
- Sistem ayarları
- E-posta doğrulama anahtarları
- Randevu takip anahtarları
- Yönetici işlem kayıtları
- Aydınlatma metni sürümleri

Randevu çakışmaları yalnızca arayüzde değil, sunucu ve veritabanı seviyesinde de engellenmelidir. Aynı zaman aralığına eş zamanlı başvuru yapıldığında yalnızca bir randevu kabul edilmelidir.

**Çıktı:** Veritabanı şeması, durum geçişleri ve doğrulama kuralları.

### Faz 2 — Tasarım sistemi ve prototip

Arayüz, hazır bir yönetim paneli veya basit takvim görünümünden ayrışan özgün bir tasarıma sahip olacaktır.

#### Görsel yaklaşım

- Dijital üretim laboratuvarı estetiği
- Koyu grafit ve sıcak açık yüzeyler
- Filament turuncusu veya elektrik yeşili vurgu rengi
- Katman çizgileri ve teknik çizim detayları
- Canlı yazıcı durum kartları
- Doluluk oranını görselleştiren modern takvim
- Kontrollü mikro animasyonlar
- Mobil öncelikli, erişilebilir arayüz

#### Tasarlanacak ekranlar

1. Ana sayfa
2. Uygun zaman seçimi
3. Randevu ve iletişim formu
4. Dosya yükleme ve filament seçimi
5. E-posta doğrulama sonucu
6. Randevu takip sayfası
7. Yönetici girişi
8. Yönetici genel görünümü
9. Takvim ve randevu yönetimi
10. Yazıcı, filament ve sistem ayarları

**Çıktı:** Mobil ve masaüstü tasarım sistemi ile tıklanabilir akış/prototip.

### Faz 3 — Temel kullanıcı randevu akışı

- Müsaitlik takvimi
- Tarih, başlangıç saati ve süre seçimi
- Sunucu tarafında çakışma kontrolü
- İletişim bilgilerinin alınması
- Zorunlu dosya yükleme
- Filament tercihi
- Katmanlı KVKK bilgilendirmesi
- E-posta doğrulaması
- Güvenli takip ve iptal bağlantısı
- Randevu durum geçmişi

Kullanıcı hesabı ve parola olmayacaktır. Takip bağlantıları uzun, tahmin edilemeyen ve gerektiğinde geçersizleştirilebilir anahtarlar kullanacaktır.

**Çıktı:** Uçtan uca çalışan kullanıcı randevu deneyimi.

### Faz 4 — Yönetici paneli

- Güvenli yönetici girişi
- Takvim ve liste görünümleri
- Filtreleme ve arama
- Onaylama, reddetme ve değişiklik isteme
- Randevu süresi ve yazıcı düzenleme
- Durum güncelleme
- Dosya erişimi
- Yönetici notları
- Yazıcı ve bakım yönetimi
- Çalışma takvimi ayarları
- Filament yönetimi
- E-posta şablonları
- İşlem kayıtları

**Çıktı:** Atölyenin günlük operasyonunu karşılayan yönetici paneli.

### Faz 5 — Dosya yönetimi ve güvenlik

İzin verilen başlangıç formatları:

- `.gcode`
- `.3mf`
- `.stl`
- `.step`
- `.stp`

Uygulanacak başlıca önlemler:

- Uzantı ve gerçek dosya türü kontrolü
- Dosya boyutu sınırı
- Güvenli ve rastgele depolama adı
- Dosyaları herkese açık web klasörünün dışında saklama
- Yalnızca yetkili yöneticilere erişim verme
- Dosya adlarını arayüzde güvenli biçimde gösterme
- G-code dosyalarını sunucuda hiçbir şekilde çalıştırmama
- Saklama süresi biten dosyaları otomatik silme
- Yetkisiz indirme ve dizin geçişi girişimlerini engelleme

STL/3MF için üç boyutlu önizleme ilk sürüme yetişirse eklenebilir. STEP önizleme daha karmaşık olduğundan ilk sürümde güvenli indirme ve manuel inceleme yeterlidir.

**Çıktı:** Kontrollü dosya yükleme, saklama, indirme ve silme sistemi.

### Faz 6 — E-posta sistemi

Planlanan e-postalar:

- E-posta adresi doğrulama
- Randevu talebi alındı
- Randevu onaylandı
- Değişiklik istendi
- Randevu reddedildi
- Randevu hatırlatması
- Baskı başladı
- Baskı tamamlandı
- Baskı başarısız
- Randevu iptal edildi

Cron job desteği kullanılarak yaklaşan randevular için otomatik hatırlatma gönderilebilir. SMTP bilgileri kaynak kodda tutulmamalı; sunucu ortam değişkenlerinde saklanmalıdır.

**Çıktı:** Markaya uygun, izlenebilir ve güvenilir e-posta bildirim sistemi.

### Faz 7 — KVKK ve mahremiyet

Hazırlanması ve doğrulanması gerekenler:

- Kişisel veri işleme envanteri
- Aydınlatma metni
- Saklama ve imha politikası
- İlgili kişi başvuru kanalı
- Yönetici yetki matrisi
- Dosya saklama kuralları
- Olay/veri ihlali müdahale prosedürü
- Kullanılan servisler için veri aktarım değerlendirmesi
- Zorunlu olmayan çerezler kullanılırsa çerez politikası ve izin mekanizması

Telefon numarası yalnızca randevu sırasında oluşabilecek gecikme, cihaz arızası, güvenlik veya benzeri operasyonel durumlarda kullanıcıya ulaşmak için kullanılmalıdır. Pazarlama amacıyla kullanılmamalıdır.

#### Saklama yaklaşımı

- Reddedilmiş ve iptal edilmiş randevular, belirlenen kısa operasyonel sürenin ardından silinmeli veya anonimleştirilmelidir.
- Tamamlanmış randevulardaki kişisel veriler, belirlenen makul sürenin ardından anonimleştirilmelidir.
- Üretim dosyaları, baskı tamamlandıktan sonra belirlenen kısa süre içinde otomatik silinmelidir.
- Güvenlik ve yönetici işlem kayıtları, amaçlarıyla sınırlı ayrı bir süre boyunca saklanmalıdır.
- Kesin saklama süreleri okulun idari ihtiyaçları ve hukuki değerlendirmesiyle belirlenmelidir.

> Aydınlatma metni ile açık rıza aynı işlem değildir. Gerekmesi halinde açık rıza, aydınlatmadan ayrı ve belirli bir amaç için alınmalıdır.

**Çıktı:** Ürüne yansıtılmış mahremiyet kuralları ve yayına hazır hukuki metin taslakları.

### Faz 8 — Test ve kalite kontrolü

#### Kritik senaryolar

- İki kullanıcının aynı saati eş zamanlı seçmesi
- Doğrulanmamış e-posta ile oluşturulan talep
- Geçersiz veya süresi dolmuş takip bağlantısı
- Kapalı ya da bakımdaki yazıcının seçilmesi
- Çalışma saatleri dışında seçim yapılması
- Başka randevuyla kısmen çakışan süre seçilmesi
- Çok büyük veya sahte uzantılı dosya yüklenmesi
- Yönetici süre değiştirirken çakışma oluşması
- İptal edilen zamanın tekrar müsait hâle gelmesi
- E-posta gönderiminin başarısız olması
- Yetkisiz dosya erişimi
- Mobil cihazlarda takvim kullanımı

#### Kalite kontrolleri

- Mobil ve masaüstü görünüm
- Klavye kullanımı ve erişilebilirlik
- Performans
- Tarayıcı uyumluluğu
- Form doğrulamaları
- Güvenlik testleri
- Yedekten geri dönüş testi

**Çıktı:** Kritik hataları giderilmiş, yayınlanabilir sürüm.

### Faz 9 — cPanel'e yayınlama

- Production veritabanını oluşturma
- Domain veya subdomain bağlantısı
- SSL yapılandırması
- SMTP kurulumu
- Dosya depolama izinleri
- Cron job kurulumu
- Ortam değişkenlerinin tanımlanması
- Veritabanı yedekleme planı
- Hata kayıtlarının yapılandırılması
- İlk yönetici hesabının oluşturulması
- İki yazıcının sisteme eklenmesi
- Çalışan yazıcının rezervasyona açılması
- Arızalı yazıcının **Bakımda** durumuna alınması
- Gerçek e-posta ve randevu akışının test edilmesi

**Çıktı:** Canlı ortamda çalışan ve izlenebilen sistem.

## KVKK ve mahremiyet

Sistem yalnızca hizmet için gerekli kişisel verileri toplamalıdır:

| Veri | Amaç | Görünürlük |
|---|---|---|
| Ad ve soyad | Randevu sahibini tanımlamak | Yetkili yöneticiler ve kullanıcının takip sayfası |
| E-posta | Doğrulama, takip bağlantısı ve bildirim göndermek | Yetkili yöneticiler |
| Telefon | Acil ve operasyonel durumlarda hızlı iletişim kurmak | Yalnızca yetkili yöneticiler |
| Yüklenen dosya | Baskıyı değerlendirmek ve gerçekleştirmek | Yalnızca yetkili yöneticiler |

Uygulama içinde:

- Telefon numarasının neden istendiği form alanının yanında açıklanmalıdır.
- Kullanıcılar başka kullanıcıların bilgilerini görememelidir.
- Yönetici erişimleri rol ve yetki kontrollerine tabi olmalıdır.
- Hassas işlem ve görüntülemeler kayıt altına alınmalıdır.
- Takip bağlantılarında kişisel bilgiler gereksiz yere gösterilmemelidir.
- Aydınlatma metninin sürümü ve kullanıcıya gösterildiği zaman kaydedilmelidir.
- Kişisel veriler pazarlama amacıyla kullanılmamalıdır.

## MVP kabul kriterleri

İlk sürüm aşağıdaki koşullar sağlandığında tamamlanmış kabul edilir:

- [ ] Kullanıcı yalnızca rezervasyona açık yazıcı için zaman seçebilir.
- [ ] Sistem çalışma saatleri dışındaki seçimleri engeller.
- [ ] Sistem dolu veya çakışan zaman aralıklarını engeller.
- [ ] Kullanıcı ad, soyad, e-posta ve telefon bilgilerini girer.
- [ ] Desteklenen formatlardan bir dosya yüklemek zorunludur.
- [ ] Kullanıcı filament kaynağını seçebilir.
- [ ] E-posta doğrulanmadan randevu yönetici onayına düşmez.
- [ ] Doğrulanan randevu **Onay bekliyor** durumuna geçer.
- [ ] Yönetici randevuyu onaylayabilir, reddedebilir veya değişiklik isteyebilir.
- [ ] Kullanıcı güvenli bağlantıdan randevusunu takip edebilir.
- [ ] Kullanıcı güvenli bağlantıdan randevusunu iptal edebilir.
- [ ] Durum değişikliklerinde kullanıcıya e-posta gönderilir.
- [ ] Yazıcılar ve çalışma saatleri yönetici panelinden düzenlenebilir.
- [ ] Bakım ve kapalı zamanlar yönetilebilir.
- [ ] Dosyalar herkese açık URL üzerinden erişilebilir değildir.
- [ ] Yönetici işlemleri kayıt altına alınır.
- [ ] Mobil ve masaüstü arayüzleri kullanılabilirdir.
- [ ] Aydınlatma ve saklama kuralları uygulamaya yansıtılmıştır.

## Gelecek sürümler

MVP sonrasında değerlendirilebilecek geliştirmeler:

- Güvenilir kullanıcılar için otomatik onay
- STL/3MF üç boyutlu önizleme
- Baskı süresi tahmini
- Filament stok takibi
- QR kodlu randevu kontrolü
- Yazıcıdan canlı durum alma
- Kullanım ve yoğunluk raporları
- Nozul, tabla ve malzeme uyumluluk kuralları
- Bekleme listesi
- Gelişmiş bakım takvimi
- Kullanıcı geri bildirimi

## Önerilen teslim sırası

1. **Temel MVP:** Randevu formu, dosya yükleme, e-posta doğrulama, güvenli takip bağlantısı ve yönetici onayı.
2. **Operasyon sürümü:** Gelişmiş takvim, filament/yazıcı yönetimi, e-posta otomasyonları ve sistem ayarları.
3. **Olgunlaştırma:** Özgün animasyonlar, üç boyutlu önizleme, raporlar, güvenlik iyileştirmeleri ve kapsamlı kullanım testleri.

---

Sonraki adım, mevcut cPanel özelliklerini doğrulayıp teknik mimariyi kesinleştirmek; ardından veri modelini ve ekran haritasını oluşturmaktır.
