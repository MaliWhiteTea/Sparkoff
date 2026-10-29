# Sparkoff Uçtan Uca Manuel Alpha Test Planı

Bu belge, Sparkoff'un kullanıcıya görünen bütün modüllerini, ortak arayüz
bileşenlerini, butonlarını, bağlantılarını, yetki sınırlarını ve temel hata
yollarını canlı alpha ortamında elle sınamak için hazırlanmıştır.

## 0. Test kaydı ve kurallar

Her test turunda aşağıdaki bilgileri kaydedin:

- Test tarihi ve saati:
- Testi yapan:
- Ortam: `https://www.sparkoff.tr`
- Test edilen commit:
- Tarayıcı ve sürümü:
- İşletim sistemi:
- Ekran türü: masaüstü / tablet / telefon
- Sonuç: `GEÇTİ`, `KALDI`, `ENGELLİ`, `UYGULANAMAZ`
- Hata kaydında: test kimliği, adres, tekrar adımları, beklenen/gerçek sonuç,
  ekran görüntüsü ve konsol/ağ hatası.

Güvenlik ve veri kuralları:

- [ ] PRE-01 — Tam hesap, ana dizin ve veritabanı yedekleri yerelde duruyor ve
  arşiv bütünlükleri doğrulandı.
- [ ] PRE-02 — Yalnız `ALPHA TEST` önekli sentetik kayıtlar kullanılıyor.
- [ ] PRE-03 — Gerçek ad, e-posta, telefon, model dosyası veya gerçek stok
  hareketi girilmiyor.
- [ ] PRE-04 — Test ekran görüntülerinde parola, oturum çerezi, `.env`, cPanel
  kullanıcı adı ve veritabanı bilgisi görünmüyor.
- [ ] PRE-05 — Ana yönetici, envanter moderatörü, kısıtlı özel rol ve pasif
  kullanıcı için ayrı test hesapları hazır.
- [ ] PRE-06 — Her test hesabının cPanel Directory Privacy hesabı da ayrı.
- [ ] PRE-07 — Kalıcı silme testleri yalnız son bölümde ve yedek doğrulandıktan
  sonra çalıştırılıyor.

Önerilen sentetik veriler:

- Ödünç malzeme: `ALPHA TEST Ödünç Malzeme`, kod `ALPHA-LOAN-001`, stok `3`.
- Sarf malzeme: `ALPHA TEST Sarf Malzeme`, kod `ALPHA-CONS-001`, stok `10`.
- Demirbaş: `ALPHA TEST Demirbaş`, kod `ALPHA-ASSET-001`, stok `2`.
- Teslim alan: `ALPHA TEST Kullanıcısı`; e-posta alanını çoğu testte boş bırakın.
- Kategori: `ALPHA TEST Kategori`; konum: `ALPHA TEST Raf`, kod `AT-01`.
- Rol: `ALPHA TEST Kısıtlı Rol`; kullanıcı: sentetik ve benzersiz bir e-posta.

## 1. Dağıtım, alan adı ve güvenlik kapısı

- [ ] DEP-01 — `http://sparkoff.tr` HTTPS'e yönleniyor.
- [ ] DEP-02 — `http://www.sparkoff.tr` HTTPS'e yönleniyor.
- [ ] DEP-03 — Apex alan adı ile `www` aynı kanonik siteyi açıyor.
- [ ] DEP-04 — Geçersiz veya eksik Directory Privacy bilgisi `401` döndürüyor.
- [ ] DEP-05 — Doğru Directory Privacy bilgisi siteyi açıyor.
- [ ] DEP-06 — `/up`, `/`, `/3d-yazicilar`, `/filamentler`, `/malzemeler` dış
  koruma arkasında erişilebilir.
- [ ] DEP-07 — Sertifika geçerli, alan adıyla eşleşiyor ve zincir hatası yok.
- [ ] DEP-08 — `APP_DEBUG=false`; hata sayfası stack trace, dosya yolu veya SQL
  ayrıntısı göstermiyor.
- [ ] DEP-09 — Oturum çerezi `Secure`, `HttpOnly` ve `SameSite=Lax` nitelikli.
- [ ] DEP-10 — Uygulama yanıtlarında güvenlik başlıkları var ve
  `X-Powered-By` görünmüyor.
- [ ] DEP-11 — Bilinmeyen bir adres güvenli 404 veriyor; uygulama yolu veya
  sunucu sırrı sızdırmıyor.
- [ ] DEP-12 — Sayfa kaynağında `.env`, `storage`, yerel dosya yolu veya özel
  medya yolu bulunmuyor.
- [ ] DEP-13 — `public_html/.htaccess` mevcut; Directory Privacy yeniden girişte
  çalışıyor.
- [ ] DEP-14 — Kalıcı `schedule:run` cron'u dakikada bir çalışıyor ve
  `sparkoff-scheduler-errors.log` boş.
- [ ] DEP-15 — Geçici migrate/optimize cron görevleri silinmiş; yalnız kalıcı
  zamanlayıcı görevi kalmış.
- [ ] DEP-16 — `storage` ve `bootstrap/cache` yazılabilir; yeni log, oturum ve
  cache kaydı 500 üretmeden oluşuyor.
- [ ] DEP-17 — `APP_ENV=production`, `ONLINE_BOOKING_ENABLED=false` ve
  `ALLOW_DESTRUCTIVE_DATABASE_COMMANDS=false`.
- [ ] DEP-18 — PHP güvenlik paketi ve `session.upload_progress.enabled=0`
  hosting sağlayıcısı tarafından ayrıca doğrulandı. Bu madde tamamlanmadıysa
  alpha daveti güvenlik istisnası olarak açıkça kayıt altına alınır.

## 2. Herkese açık ortak arayüz

- [ ] PUB-GLOBAL-01 — Logo ve marka bağlantısı her genel sayfadan ana sayfaya
  dönüyor; logo yuvarlatılmış ve bozulmadan görünüyor.
- [ ] PUB-GLOBAL-02 — Üst menüde Atölye, Hizmetler, 3D Yazıcılar, Malzemeler,
  Geri bildirim ve İletişim bağlantıları ana sayfada ve bütün alt sayfalarda
  görünüyor; doğru hedefe gidiyor.
- [ ] PUB-GLOBAL-03 — Atölye/Hizmetler/İletişim çapa bağlantıları doğru bölüme
  kayıyor ve tarayıcı geri tuşu çalışıyor; iletişim ayarları boşken bağlantı
  kırılmıyor, bölümde anlaşılır boş durum gösteriliyor.
- [ ] PUB-GLOBAL-04 — Telefon genişliğinde menü açma butonu menüyü açıyor;
  etiketi ve `aria-expanded` değişiyor.
- [ ] PUB-GLOBAL-05 — Mobil menü bağlantısı, dış katmana tıklama ve `Esc` menüyü
  kapatıyor; odak menü butonuna dönüyor.
- [ ] PUB-GLOBAL-06 — Mobil menü açıkken `Tab`/`Shift+Tab` odağı menü içinde
  tutuyor; sayfa arkada kaymıyor.
- [ ] PUB-GLOBAL-07 — Açık/Koyu tema butonu iki temayı değiştiriyor, etiketi
  güncelleniyor ve seçim yeni sayfa/yenileme sonrası korunuyor.
- [ ] PUB-GLOBAL-08 — Tema değişiminde beyaz kalan panel, okunmayan metin veya
  ani yatay kayma yok.
- [ ] PUB-GLOBAL-09 — Alt kısımdaki “Öneri, şikâyet veya hata bildir” bağlantısı
  geri bildirim sayfasını açıyor.
- [ ] PUB-GLOBAL-10 — Logo, resim ve ikonlarda kırık kaynak yok; tarayıcı
  konsolunda 404/500 varlık isteği yok.
- [ ] PUB-GLOBAL-11 — `Tab` ile tüm bağlantı ve butonlara görünür odak sırasıyla
  ulaşılabiliyor; “İçeriğe geç” bağlantısı ana içeriğe gidiyor.
- [ ] PUB-GLOBAL-12 — 320, 375, 768, 1024 ve geniş masaüstü görünümünde yatay
  sayfa taşması, kesilen buton veya üst üste binen metin yok.
- [ ] PUB-GLOBAL-13 — Tarayıcı geri/ileri, yenileme ve doğrudan URL açma Inertia
  sayfalarında doğru içeriği ve temayı koruyor.
- [ ] PUB-GLOBAL-14 — Ana sayfadaki Telefon, WhatsApp ve E-posta iletişim kartları
  ayrı ayrı doğru `tel:`, WhatsApp ve `mailto:` hedefini açıyor; klavyeyle
  erişiliyor ve mobilde taşmıyor.

## 3. Ana sayfa

- [ ] HOME-01 — “3D yazıcılar” kahraman butonu `/3d-yazicilar` adresini açıyor.
- [ ] HOME-02 — “Malzemeler” kahraman butonu `/malzemeler` adresini açıyor.
- [ ] HOME-03 — Atölye açık/kapalı durumu ve bugünkü kullanım başlangıç aralığı
  ayarlardaki gün/saat ile eşleşiyor.
- [ ] HOME-04 — Kullanılabilir yazıcı sayısı aktif, bakım ve meşgul durumlarına
  göre doğru güncelleniyor.
- [ ] HOME-05 — “Ayrıntılı durumu görüntüle” bağlantısı yazıcı sayfasına gidiyor.
- [ ] HOME-06 — Randevu kapalıyken çağrı alanında yalnız “3D yazıcı için
  randevu alın” metni veya yapılandırılmış iletişim hedefi var; kapalı forma
  yanlışlıkla gidilmiyor.
- [ ] HOME-07 — Randevu açıkken çağrı alanı `/randevu` formunu açıyor.
- [ ] HOME-08 — 3D Yazıcılar “Modüle git” ve Malzemeler “Kataloğa git” kartlarının
  tamamı tıklanabilir ve doğru hedefe gidiyor.
- [ ] HOME-09 — Yazıcı durum listesinde ad, açıklama ve durum doğru; kişisel veri
  veya randevu sahibi görünmüyor.
- [ ] HOME-10 — Ana sayfa hedefli ve tüm sayfalar hedefli duyurular doğru önem
  rengiyle görünüyor; taslak/gelecek/süresi geçmiş duyuru görünmüyor.
- [ ] HOME-11 — Telefon bağlantısı arama hedefi, WhatsApp yeni güvenli sekme ve
  e-posta `mailto:` hedefi olarak çalışıyor.
- [ ] HOME-12 — Mobil “3D yazıcıları incele” butonu doğru sayfayı açıyor ve
  içeriği kapatmıyor.
- [ ] HOME-13 — Aktif yazıcı bulunmadığında sayfa 500 vermeden uygun boş durum
  metni gösteriyor.

## 4. 3D yazıcılar ve filament kataloğu

- [ ] PRN-PUB-01 — Her yazıcı kartında kod, ad, açıklama ve kullanılabilirlik
  yönetim ayarlarıyla eşleşiyor.
- [ ] PRN-PUB-02 — Bakım/pasif/meşgul yazıcı kullanılabilir görünmüyor.
- [ ] PRN-PUB-03 — 7 günlük takvimde her yazıcı sekmesi tıklanınca yalnız ilgili
  ve genel zaman blokları gösteriliyor; aktif sekme değişiyor.
- [ ] PRN-PUB-04 — Takvimde bakım, kapalı ve meşgul türleri; tüm gün, saat aralığı
  ve herkese açık not doğru görünüyor.
- [ ] PRN-PUB-05 — Gece yarısını aşan kayıt ilgili iki günde doğru gösteriliyor.
- [ ] PRN-PUB-06 — Takvim ve yazıcı kartı yatay alanları klavye ve dokunmatik
  kaydırmayla kullanılabiliyor; belge genişliğini taşırmıyor.
- [ ] PRN-PUB-07 — Haftalık saat listesi açık/kapalı günlerle ayarları yansıtıyor.
- [ ] PRN-PUB-08 — Desteklenen dosya formatları ayarlarla eşleşiyor.
- [ ] PRN-PUB-09 — “Filamentleri incele” `/filamentler` sayfasını açıyor.
- [ ] PRN-PUB-10 — Randevu açıkken “Randevu formuna git” çalışıyor; kapalıyken
  telefon/WhatsApp/e-posta seçenekleri doğru çalışıyor.
- [ ] PRN-PUB-11 — Yalnız yazıcı sayfası hedefli duyuru burada görünüyor; ana
  sayfa hedefli duyuru görünmüyor.
- [ ] PRN-PUB-12 — Yazıcı kartı açıklamaları, yazıcı sekmeleri, yedi günlük
  takvim, haftalık saatler ve desteklenen formatlar açık/koyu temada okunabilir
  punto ve kontrasta sahip.
- [ ] FIL-PUB-01 — Filament sayfası marka logosu ana sayfaya, “3D Yazıcılar”
  butonu yazıcı sayfasına gidiyor.
- [ ] FIL-PUB-02 — Her malzeme türü ve renk için marka, çap, makara, nozzle,
  tabla ve teknik not değerleri doğru.
- [ ] FIL-PUB-03 — Boş teknik değerler `—` veya uygun “belirtilmedi” metniyle
  gösteriliyor; `0`, `NaN` veya bozuk biçim yok.
- [ ] FIL-PUB-04 — Geçici kapatılan tür uyarı ve gerekçeyle gösteriliyor, randevu
  seçiminden kaldırılıyor; yeniden açılınca geri geliyor.

## 5. Genel malzeme kataloğu

- [ ] MAT-PUB-01 — Adla arama ve “Ara” butonu doğru sonuçları getiriyor.
- [ ] MAT-PUB-02 — Kategori seçimi otomatik uygulanıyor; aramayla birlikte
  kullanılabiliyor.
- [ ] MAT-PUB-03 — Stokta var / stokta yok / tümü filtreleri doğru sonuç veriyor.
- [ ] MAT-PUB-04 — “Filtreleri temizle” tüm filtreleri ve arama metnini sıfırlıyor.
- [ ] MAT-PUB-05 — `exact` görünürlük sayı ve birimi, `status` yalnız stok
  durumunu gösteriyor; `hidden` kayıt hiç görünmüyor.
- [ ] MAT-PUB-06 — Stok kodu genel listede gösterilmiyor.
- [ ] MAT-PUB-07 — Pasif ve arşivlenmiş malzeme genel listede görünmüyor.
- [ ] MAT-PUB-08 — Sarf, ödünç ve demirbaş tür etiketleri doğru.
- [ ] MAT-PUB-09 — “Teknik özellikler” aç/kapat alanı bütün anahtar ve değerleri
  gösteriyor.
- [ ] MAT-PUB-10 — “Fotoğraf, video ve bağlantılar” alanı açılıyor; görsel alt
  metni, video kontrolleri ve HTTPS dış bağlantısı çalışıyor.
- [ ] MAT-PUB-11 — Kırık görselde erişilebilir “Görsel yüklenemedi” yedeği var.
- [ ] MAT-PUB-12 — Sonuç yokken boş durum gösteriliyor ve sayfa bozulmuyor.
- [ ] MAT-PUB-13 — Sayfa numaraları doğru; ilk sayfada Önceki, son sayfada
  Sonraki butonu gösterilmiyor.
- [ ] MAT-PUB-14 — Sayfa değişiminde filtreler ve kaydırma davranışı korunuyor.

## 6. Geri bildirim ve KVKK

- [ ] FB-PUB-01 — Öneri, Şikâyet ve Site/sistem hatası türleri seçilebiliyor.
- [ ] FB-PUB-02 — Boş veya çok kısa açıklama Türkçe doğrulama hatası veriyor.
- [ ] FB-PUB-03 — Geçerli sentetik mesaj “Yönetime ilet” ile gönderiliyor;
  başarı mesajı görünüyor ve mesaj alanı temizleniyor.
- [ ] FB-PUB-04 — Gönderim sırasında buton devre dışı ve “Gönderiliyor…” oluyor;
  çift kayıt oluşmuyor.
- [ ] FB-PUB-05 — Gizli honeypot normal kullanıcıya/ekran okuyucuya sunulmuyor;
  doldurulmuş otomatik istek reddediliyor.
- [ ] FB-PUB-06 — Hız sınırı aşılınca güvenli hata dönüyor, 500 oluşmuyor.
- [ ] FB-PUB-07 — Form ad/e-posta/telefon istemiyor ve kişisel bilgi uyarısı
  görünür.
- [ ] FB-PUB-08 — İsteğe bağlı Fotoğraf alanı JPG, PNG ve WebP kabul ediyor;
  seçilen dosya adı görünüyor ve “Fotoğrafı kaldır” seçimi temizliyor.
- [ ] FB-PUB-09 — SVG, farklı dosya türü, 5 MB üstü veya 6000 × 6000 piksel üstü
  fotoğraf Türkçe hata veriyor; talep kaydı ve artık dosya oluşturmuyor.
- [ ] FB-PUB-10 — Fotoğraflı geçerli bildirim başarıyla gönderiliyor; başarı
  mesajı ve form açık/koyu temaya uyuyor, açıklama ile dosya alanı temizleniyor.
- [ ] KVKK-01 — Logo ve “Ana sayfaya dön” bağlantısı çalışıyor.
- [ ] KVKK-02 — Kurum adı, adres, e-posta, sürüm ve saklama süreleri ayarlarla
  eşleşiyor.
- [ ] KVKK-03 — Taslak seçiliyken taslak uyarısı görünür; kapatıldığında kaybolur.
- [ ] KVKK-04 — KVKK e-posta bağlantısı doğru `mailto:` hedefini açıyor.

## 7. Yönetici girişi ve ortak panel kabuğu

- [ ] AUTH-01 — `/yonetim` misafire giriş formunu gösteriyor.
- [ ] AUTH-02 — Logo ana sayfaya dönüyor.
- [ ] AUTH-03 — Geçerli aktif ve rol atanmış kullanıcı giriş yapabiliyor.
- [ ] AUTH-04 — E-posta baş/son boşluğu ve büyük-küçük harf normalize ediliyor.
- [ ] AUTH-05 — Yanlış parola, pasif hesap ve rolü olmayan eski admin güvenli
  Türkçe hata alıyor.
- [ ] AUTH-06 — “Bu cihazda oturumu açık tut” kapalı/açık durumları oturum
  süresine uygun çalışıyor.
- [ ] AUTH-07 — Giriş butonu işlem sırasında kilitleniyor; çift giriş isteği yok.
- [ ] AUTH-08 — Giriş hız sınırı tekrar eden başarısız denemeleri engelliyor.
- [ ] AUTH-09 — “Çıkış yap” oturumu kapatıp giriş sayfasına götürüyor; geri
  tuşuyla korumalı sayfa açılamıyor.
- [ ] AUTH-10 — Yönetici giriş ekranında Açık/Koyu tema düğmesi çalışıyor;
  kart, alanlar, metinler ve doğrulama hatası iki temada okunuyor.
- [ ] SHELL-01 — Logo ve Genel bakış bağlantısı çalışma alanını açıyor.
- [ ] SHELL-02 — Sol menü yalnız kullanıcının yetkili olduğu modülleri gösteriyor.
- [ ] SHELL-03 — Her sol menü bağlantısı doğru aktif durumu gösteriyor ve yatay
  kayma animasyonu oluşturmuyor.
- [ ] SHELL-04 — Menüyü daralt/genişlet butonu çalışıyor ve tercih hesaba
  kaydediliyor; bu hızlı işlem için başarı mesajı gösterilmiyor.
- [ ] SHELL-05 — Menü ayırıcı fareyle 210–380 px arasında yeniden boyutlanıyor;
  çift tıklama varsayılana döndürüyor.
- [ ] SHELL-06 — Ayırıcıda Sol/Sağ oklar 10 px değiştiriyor, Home varsayılan
  genişliği uyguluyor.
- [ ] SHELL-07 — Mobil panel menüsü buton, dış katman, bağlantı ve `Esc` ile
  kapanıyor; içerik arkada taşmıyor.
- [ ] SHELL-08 — Başarı ve uyarı flash mesajları doğru tema ve metinle görünüyor.
- [ ] SHELL-09 — Açık/koyu/sistem tema, üç ölçek, üç yoğunluk ve dar/geniş menü
  tüm panel sayfalarında uygulanıyor.
- [ ] SHELL-10 — Yönetim duyurusunda “Okundu işaretle” ve “Okudum, onaylıyorum”
  butonları kaydı kişiye özel kapatıyor ve sayacı azaltıyor.

## 8. Hızlı arama, bildirimler ve genel bakış

- [ ] SEARCH-01 — “Modüllerde hızlı ara” butonu ve `Ctrl/Cmd+K` aramayı açıyor.
- [ ] SEARCH-02 — Kapatma `×`, dış alana tıklama ve `Esc` ile çalışıyor.
- [ ] SEARCH-03 — İki karakterden kısa sorgu istek göndermiyor; açıklayıcı metin
  gösteriyor.
- [ ] SEARCH-04 — Malzeme, randevu, yazıcı, filament ve talep sonuçları yetkiye
  göre modüllere ayrılıyor; modül başına sınır uygulanıyor.
- [ ] SEARCH-05 — Yukarı/Aşağı ok seçimi, Enter açma ve fareyle sonuç açma
  çalışıyor.
- [ ] SEARCH-06 — Sonuç açılınca doğru kayıt sayfasına gidiyor ve “Son
  görüntülenenler”e ekleniyor; erişilemeyen kayıt sızmıyor.
- [ ] SEARCH-07 — Sonuç yok, yükleniyor ve ağ hatası durumları doğru gösteriliyor.
- [ ] QUICK-01 — “Hızlı işlem” yalnız bulunduğu sayfada kullanılabilir en az bir
  işlem varsa görünüyor; işlem yetkisi olmayan kullanıcıda hiç görünmüyor.
- [ ] QUICK-02 — Menü butonla açılıp kapanıyor; dışarı tıklama ve `Esc` ile
  kapanıyor, `Esc` sonrasında odak menü düğmesine dönüyor.
- [ ] QUICK-03 — Yukarı/Aşağı oklar ile İlk/Son (`Home`/`End`) tuşları menü
  seçenekleri arasında dolaşıyor; Tab sırası ve görünür odak korunuyor.
- [ ] QUICK-04 — Envanter, teslimler, kullanıcı/roller, duyurular, yazıcılar ve
  filamentler sayfalarında yalnız ilgili izinlerin eylemleri listeleniyor.
- [ ] QUICK-05 — Form hedefli işlem doğru formu görünür alana getirip ilk etkin
  alana odaklıyor; “Yeni malzeme” kapalı oluşturma formunu önce açıyor.
- [ ] QUICK-06 — “CSV içe aktar” doğru sayfaya gidiyor; mobilde ikon düğmesi ve
  menü ekran dışına taşmıyor, açık/koyu/sistem temalarında okunuyor.
- [ ] NOTIF-01 — Zil butonu paneli açıp kapatıyor; sayaç `99+` sınırını uyguluyor.
- [ ] NOTIF-02 — Dışarı tıklama ve `Esc` bildirim panelini kapatıyor.
- [ ] NOTIF-03 — Bildirime tıklama kaydı okundu yapıp doğru filtreli sayfaya
  götürüyor.
- [ ] NOTIF-04 — “Tümünü okundu işaretle” yalnız yetkili ve mevcut bildirimleri
  okundu yapıyor; sayaç sıfırlanıyor.
- [ ] NOTIF-05 — Çözülmüş koşul bildirimi listeden kalkıyor; yetkisiz modül
  bildirimi görünmüyor.
- [ ] DASH-01 — Dikkat kartları sayılarıyla hedef filtreli listeye gidiyor.
- [ ] DASH-02 — Son görüntülenen kartları doğru kayda gidiyor; en fazla 20,
  kişiye özel ve içerik saklamayan yapı korunuyor.
- [ ] DASH-03 — Bütün çalışma alanı kartları doğru modülü açıyor; sayı ve rol
  etiketi doğru.

## 9. Ortak liste araçları ve kaydedilmemiş değişiklik koruması

- [ ] LIST-01 — Her listedeki Sırala alanının bütün seçenekleri ve Artan/Azalan
  yönü doğru sonuç üretiyor.
- [ ] LIST-02 — Geçersiz sıralama URL parametresi doğrulama hatası veriyor;
  keyfi SQL alanı kabul edilmiyor.
- [ ] LIST-03 — Kayıtlı filtre adı 2–40 karakterle kaydediliyor ve yalnız ilgili
  hesapta görünüyor.
- [ ] LIST-04 — “Uygula”, “Kaydı sil”, silme modalindeki “Vazgeç/Filtreyi sil” ve
  “Varsayılana dön” butonları doğru çalışıyor.
- [ ] LIST-05 — Hesap başına/modül başına en fazla 10 kayıtlı filtre sınırı var.
- [ ] LIST-06 — “Sütunları/Görünür alanları düzenle” açılıyor; alan aç/kapat,
  sola/sağa taşı ve “Görünümü kaydet” çalışıyor.
- [ ] LIST-07 — Son görünür sütun kapatılamıyor; hassas sütun yetkisiz kullanıcıya
  seçenek olarak dahi gelmiyor.
- [ ] LIST-08 — Sayfalama numaraları doğru; ilk/son sayfada Önceki/Sonraki
  görünürlüğü doğru ve filtreler korunuyor.
- [ ] UNSAVED-01 — Hiç değişiklik yapmadan menü/ayar sekmesi/aynı Ayarlar
  bağlantısına tıklama uyarı açmıyor.
- [ ] UNSAVED-02 — Gerçek değişiklikten sonra site içi gezinme temalı modal açıyor;
  “Sayfada kal” değerleri koruyor.
- [ ] UNSAVED-03 — “Değişiklikleri bırak ve ayrıl” hedefe gidiyor ve ikinci
  denemede de etkin kalıyor.
- [ ] UNSAVED-04 — Yenileme/sekme kapatma gerçek değişiklikte tarayıcının yerel
  uyarısını açıyor; değişiklik yokken açmıyor. Yerel pencere temalanamaz (A-002).
- [ ] UNSAVED-05 — Modal dışına tıklama, `Esc`, Tab odak tuzağı, işlem sırasında
  kilit ve işlem sonrası odak dönüşü doğru.
- [ ] DRAFT-01 — Desteklenen uzun formda değişiklik yapıp bekleyince yerel taslak
  oluşuyor; yenilemede “Taslağı geri yükle” doğru alanları getiriyor.
- [ ] DRAFT-02 — “Taslağı sil” bildirimi kaldırıyor; başka hesap aynı taslağı
  göremiyor; parola, kişi, e-posta ve dosya alanları taslağa yazılmıyor.

## 10. Envanter: tanımlar, malzemeler ve stok

- [ ] INV-01 — “Yeni malzeme” formu açılıyor, “Formu kapat” kapatıyor.
- [ ] INV-02 — Sarf, ödünç ve demirbaş; kategori/konum; birim; başlangıç stoku;
  kritik eşik; exact/status/hidden görünürlük; açıklama ve Kullanımda alanlarıyla
  ayrı sentetik kayıt oluşturuluyor.
- [ ] INV-03 — Zorunlu alan, negatif/0.001 hassasiyet, üst sınır, yinelenen kod
  ve Türkçe/büyük-küçük harf benzerliği doğrulamaları 500 vermiyor.
- [ ] INV-04 — İlk stok hareketi doğru kullanıcı, `+miktar`, bakiye ve “İlk stok
  kaydı” gerekçesiyle oluşuyor.
- [ ] INV-05 — Aktif/Pasif/Kritik/Tükenen/Arşivlenen özet kartlarının her biri
  doğru filtreyi açıyor.
- [ ] INV-06 — Ad/kod arama, kategori, tür ve durum filtreleri tek tek ve birlikte
  çalışıyor; “Ara” doğru sonucu getiriyor.
- [ ] INV-07 — “Düzenle”, alan değişiklikleri, “Değişiklikleri kaydet” ve
  “Vazgeç” doğru çalışıyor.
- [ ] INV-08 — Tür değiştirme yetkisi olmayan kullanıcı tür alanını değiştiremiyor;
  aktif teslim varken yetkili kullanıcı da türü değiştiremiyor.
- [ ] INV-09 — “Stok işlemi” aç/kapat; pozitif ve negatif değişim, zorunlu en az
  3 karakter gerekçe, “Stoku kaydet” ve “Vazgeç” çalışıyor.
- [ ] INV-10 — Stoku sıfır altına indirecek düzeltme reddediliyor; bakiye ve
  hareket geçmişi değişmiyor.
- [ ] INV-11 — Stok hareketleri yalnız `inventory.view_movements` yetkisiyle
  görünüyor ve İlk stok/Düzeltme/Teslim/İade etiketleri doğru.
- [ ] INV-12 — “Arşivle” tarayıcı onayında Vazgeç/Onay yolları çalışıyor;
  arşivlenmiş kayıt düzenlenemiyor veya stok alamıyor, geçmiş korunuyor.
- [ ] INV-13 — Ana yönetici “Kalıcı sil” temalı modalinde Vazgeç ve onay yollarını
  test ediyor; ilişkili medya, teslim ve stok hareketleri yalnız hedef kayıt için
  siliniyor.
- [ ] INV-14 — Ana yönetici olmayan kullanıcı Kalıcı sil butonunu ve endpoint'i
  kullanamıyor.
- [ ] INV-15 — Kategori “Ekle”, “Düzenle”, “Kaydet”, “Vazgeç” ve Kullanımda
  anahtarı çalışıyor; bağlı malzemeler korunuyor.
- [ ] INV-16 — Konum “Ekle”, “Düzenle”, “Kaydet”, “Vazgeç”, Kullanımda ve
  Katalogda göster anahtarları çalışıyor; kod büyük harfe dönüşüyor.
- [ ] INV-17 — Pasif kategori/konum yeni kayıtta seçilemiyor; mevcut bağlı kaydın
  düzenleme formunda görünmeye devam ediyor.
- [ ] INV-18 — Her satır seçimi, “Bu sayfadakileri seç”, kısmi seçim durumu ve
  “Seçimi temizle” çalışıyor; sayfa/filtre değişiminde görünmeyen seçim kalmıyor.
- [ ] INV-19 — Toplu Kategori, Konum ve Katalog görünürlüğü işlemlerinde hedef
  seçimi, “Devam et”, Vazgeç ve “Toplu değişikliği uygula” çalışıyor.
- [ ] INV-20 — Toplu Arşivle temalı onayla çalışıyor; aktif teslimi olan gibi
  başarısız kayıtlar ayrı raporlanıp başarılı kayıtlar uygulanıyor.
- [ ] INV-21 — “CSV indir” mevcut filtreleri yansıtıyor, UTF-8 Türkçe alanları
  doğru ve `=`, `+`, `-`, `@` ile başlayan hücreleri formül olarak çalıştırmıyor.

### 10.1. Envanter medyası

- [ ] MEDIA-01 — “Medya (n)” paneli açılıp kapanıyor.
- [ ] MEDIA-02 — JPG/PNG/WebP ve zorunlu alt metinle “Medya ekle” çalışıyor;
  8 MB üstü/yanlış tür reddediliyor.
- [ ] MEDIA-03 — MP4/WebM yükleniyor; 50 MB üstü/yanlış tür reddediliyor.
- [ ] MEDIA-04 — Yalnız HTTPS dış bağlantı ve isteğe bağlı başlık kabul ediliyor;
  HTTP/bozuk URL reddediliyor.
- [ ] MEDIA-05 — Her medya için Yukarı/Aşağı taşı butonları sıralamayı değiştiriyor;
  ilk/son sınır butonu devre dışı.
- [ ] MEDIA-06 — “Düzenle”, “Kaydet” ve “Vazgeç” başlık/alt metin/URL üzerinde
  doğru çalışıyor.
- [ ] MEDIA-07 — “Kapak yap” genel katalog kapağını değiştiriyor; kapak silinince
  sonraki uygun görsel kapak oluyor.
- [ ] MEDIA-08 — “Kaldır” tarayıcı onayında iptal/onay çalışıyor ve kalan sıra
  numaraları düzeliyor.
- [ ] MEDIA-09 — Başka malzemeye ait medya kimliği değiştirilemiyor/silinemiyor;
  arşivlenmiş malzemede medya yönetimi engelli.

### 10.2. CSV içe aktarma

- [ ] CSV-01 — CSV dışı dosya ve yinelenen başlık reddediliyor.
- [ ] CSV-02 — UTF-8 ve UTF-8 BOM kabul, Windows-1254/bozuk kodlama reddediliyor.
- [ ] CSV-03 — “Dosyayı oku” geçerli dosyada sütun/satır ve ilk örneği gösteriyor.
- [ ] CSV-04 — “Dosyayı kaldır” yüklemeyi, eşlemeyi ve ön izlemeyi temizliyor.
- [ ] CSV-05 — Otomatik eşleme gerçek dışa aktarma dosyasındaki bütün alanları
  doğru seçiyor; bilinmeyen sütunlar açıkça listeleniyor.
- [ ] CSV-06 — Her sütunda “Bu sütunu aktarma” ve hedef alan seçenekleri
  çalışıyor; malzeme adı zorunlu, aynı hedefe çift eşleme reddediliyor.
- [ ] CSV-07 — “Ön izleme oluştur” geçerli/hatalı sayıları, fiziksel satır
  numarasını ve bütün hata satırlarını gösteriyor.
- [ ] CSV-08 — Tırnaklı ayraç, çok satırlı açıklama, boş satır ve farklı sütun
  genişliği doğru işleniyor veya açıklayıcı hata veriyor.
- [ ] CSV-09 — Bilinmeyen tür/birim/görünürlük, çelişkili konum, yinelenen kod/ad
  ve hassasiyet hataları doğru satırda gösteriliyor.
- [ ] CSV-10 — 2000 veri satırı kabul, 2001 satır eksiksiz reddediliyor.
- [ ] CSV-11 — “Geçerli satırları aktar” temalı modal açıyor; Vazgeç veri
  eklemiyor, “Evet, içe aktar” yalnız geçerli satırları ve ilk stok hareketlerini
  oluşturuyor.
- [ ] CSV-12 — İçe aktarma akışının yükle/ön izleme/onay/iptal adımlarının her biri
  `inventory.import` yetkisi olmadan 403.

## 11. Teslim ve iadeler

- [ ] LOAN-01 — Ödünç malzeme tesliminde kişi, miktar, zorunlu beklenen iade ve
  not kaydoluyor; stok azalıyor, kayıt Aktif oluyor.
- [ ] LOAN-02 — Boş kişi, sıfır/negatif/aşırı miktar ve iade tarihi olmayan ödünç
  teslim reddediliyor.
- [ ] LOAN-03 — “İade al” formu açılıyor; varsayılan miktar kalan miktara eşit;
  “Vazgeç” değişiklik yapmadan kapatıyor.
- [ ] LOAN-04 — İade alanına kalandan büyük değer yazılamıyor; istemci ve sunucu
  kalan miktar üst sınırını uyguluyor.
- [ ] LOAN-05 — Kısmi iade stok ve kalan miktarı doğru artırıp azaltıyor; kayıt
  Aktif kalıyor.
- [ ] LOAN-06 — Son iade stoku ilk bakiyeye getiriyor ve kaydı Tamamlandı yapıyor.
- [ ] LOAN-07 — Sarf teslimi stoku azaltıp kaydı doğrudan Tamamlandı yapıyor;
  iade butonu göstermiyor.
- [ ] LOAN-08 — Demirbaş kullanımı fiziksel stoku azaltmıyor fakat kullanılabilir
  kapasiteyi düşürüyor; kapasite üstü ikinci kullanım reddediliyor.
- [ ] LOAN-09 — Demirbaşta “Kullanımı bitir” kapasiteyi geri getiriyor.
- [ ] LOAN-10 — “Hasarlı” zorunlu en az 3 karakter açıklamayla kapatıyor;
  hasarlı demirbaş kullanılabilir kapasiteden düşüyor.
- [ ] LOAN-11 — “Kayıp” zorunlu açıklamayla kapatıyor; yalnız
  `loans.report_lost` yetkisiyle mümkün.
- [ ] LOAN-12 — Hasarlı yetkisine sahip ama Kayıp yetkisi olmayan hesap Kayıp
  butonunu/endpoint'ini kullanamıyor ve tersi.
- [ ] LOAN-13 — Aktif, Gecikmiş, Tamamlanan, Hasarlı, Kayıp ve Geri alınan filtre
  butonlarının her biri doğru liste/sayacı gösteriyor.
- [ ] LOAN-14 — Kayıtlı filtre, sıralama, görünür alanlar ve sayfalama ortak liste
  testleri burada da geçiyor.
- [ ] LOAN-15 — Kişisel veri yetkisi olmayan kullanıcı adı yerine “Gizli
  kullanıcı” görüyor; e-posta ayrı `loans.view_email` yetkisi olmadan görünmüyor.
- [ ] LOAN-16 — Tamamlanmış kaydın saklama süresi dolunca zamanlayıcı kişi/e-posta
  ve notları anonimleştiriyor; aktif kayda dokunmuyor.
- [ ] LOAN-17 — `loans.reverse_transaction` yetkisi olmayan kullanıcı “Teslimi
  geri al” butonunu görmüyor ve endpoint 403 dönüyor.
- [ ] LOAN-18 — Hiç iade görmemiş aktif ödünç teslimi zorunlu gerekçe ve temalı
  onay penceresiyle geri alınıyor; kayıt silinmeden “Geri alındı” oluyor.
- [ ] LOAN-19 — Ödünç teslim geri alındığında ilk teslim stok hareketine bağlı,
  ters miktarlı tek bir karşı hareket oluşuyor ve stok ilk bakiyeye dönüyor.
- [ ] LOAN-20 — Sarf teslim geri alındığında tüketilen miktar stoka geri geliyor;
  demirbaş kullanımında fiziksel stok değişmeden kullanılabilir kapasite açılıyor.
- [ ] LOAN-21 — Aynı teslim ikinci kez geri alınamıyor; ikinci istek stok veya
  işlem geçmişinde yeni kayıt oluşturmuyor.
- [ ] LOAN-22 — Kısmi/tam iade görmüş, Hasarlı, Kayıp, anonimleştirilmiş veya stok
  hareketleri sonradan değişmiş teslim geri alınamıyor.
- [ ] LOAN-23 — Geri alma gerekçesi, işlemi yapan kullanıcı, teslim kaydı güncellemesi
  ve asıl harekete bağlı karşı stok hareketi denetim geçmişinde izlenebiliyor.

## 12. Yönetim talepleri

- [ ] FB-ADM-01 — Tümü/Açık/Yeni/İnceleniyor/Çözüldü/Arşivlendi butonları doğru
  kayıtları ve sayaçları gösteriyor.
- [ ] FB-ADM-02 — Yetkili kullanıcı durum ve yönetim notunu “Talebi güncelle” ile
  kaydediyor; işleyen kullanıcı/zaman görünüyor.
- [ ] FB-ADM-03 — Salt görüntüleme yetkisinde alanlar ve güncelle butonu kapalı;
  doğrudan PATCH 403.
- [ ] FB-ADM-04 — Kayıtlı filtre, sıralama, görünür alanlar ve sayfalama çalışıyor.
- [ ] FB-ADM-05 — Talep metninde HTML/script çalışmıyor; düz metin gösteriliyor.
- [ ] FB-ADM-06 — Fotoğraflı talepte küçük önizleme, özgün dosya adı ve boyut
  görünüyor; tıklanınca tam görsel yeni sekmede açılıyor.
- [ ] FB-ADM-07 — Geri bildirim fotoğrafı doğrudan genel URL ile açılamıyor;
  yalnız `feedback.view` yetkili oturum görüntüleyebiliyor ve yanıt özel/no-store.

## 13. Duyurular

- [ ] ANN-01 — Kamu, yönetim ve her iki hedef kitle seçenekleri kullanıcının
  ayrı oluşturma yetkilerine göre gösteriliyor.
- [ ] ANN-02 — Bilgi/Önemli/Bakım/Acil seviyeleri doğru temayla gösteriliyor.
- [ ] ANN-03 — Kamu duyurusunda Tüm sayfalar/Ana sayfa/3D yazıcılar yerleşimleri
  doğru uygulanıyor.
- [ ] ANN-04 — Başlangıç/bitiş aralığı öncesi ve sonrası duyuru görünmüyor.
- [ ] ANN-05 — Rol seçilmezse tüm yetkililer, rol seçilirse yalnız hedef roller
  yönetim duyurusunu görüyor.
- [ ] ANN-06 — Yayınla, Sabitle ve Okundu onayı iste anahtarlarının her kombinasyonu
  doğru çalışıyor.
- [ ] ANN-07 — “Duyuru oluştur” kaydı ekliyor; eksik başlık/metin ve geçersiz
  zaman aralığı Türkçe hata veriyor.
- [ ] ANN-08 — Karttaki “Düzenle”, düzenleme “Kaydet” ve “Vazgeç” çalışıyor;
  taslak kurtarma ve ayrılma uyarısı geçiyor.
- [ ] ANN-09 — “Kaldır” tarayıcı onayında iptal/onay yolları çalışıyor.
- [ ] ANN-10 — Kamu/yönetim duyurusu yetkileri birbirinin verisini düzenlemeye
  veya arşivlemeye izin vermiyor.
- [ ] ANN-11 — Okunma ve zorunlu onay sayaçları kişiye özel işlemlerle artıyor;
  gelecek/süresi geçmiş duyuru onaylanamıyor.

## 14. Kullanıcılar, roller ve yetkilendirme

- [ ] ACL-01 — Kullanıcılar/Roller alt sekme butonları doğru sayıları ve panelleri
  gösteriyor.
- [ ] ACL-02 — Kullanıcı ve rol sıralama alanlarının bütün seçenekleri çalışıyor.
- [ ] ACL-03 — Yeni kullanıcı ad, e-posta, en az 12 karakter parola ve en az bir
  rol olmadan oluşturulamıyor.
- [ ] ACL-04 — “Kullanıcı oluştur” benzersiz sentetik hesabı oluşturuyor; aynı
  e-postanın boşluk/büyük harf varyantı açıklayıcı hata veriyor.
- [ ] ACL-05 — Kullanıcı kartında ad, e-posta, yeni parola, rol kutuları ve Aktif
  hesap yalnız ilgili ayrı yetkilerle düzenlenebiliyor.
- [ ] ACL-06 — “Kullanıcıyı kaydet” değişiklikleri uygular; parola boşsa değişmez,
  doluysa eski parola çalışmaz ve yeni parola çalışır.
- [ ] ACL-07 — Pasifleştirilen kullanıcı bir sonraki GET/POST/PUT/PATCH/DELETE
  isteğinde erişimini kaybeder.
- [ ] ACL-08 — Son aktif ana yönetici pasifleştirilemez veya sistem rolünü
  kaybedemez.
- [ ] ACL-09 — Kullanıcı görünüm alanları seçimi kişiye özel kaydolur; hassas
  e-posta/roller yetkisiz kullanıcıya sızmaz.
- [ ] ACL-10 — Yeni rol adı, açıklama ve seçili izinlerle oluşturuluyor.
- [ ] ACL-11 — Her izin grubundaki “Tümünü seç” yalnız o grubun kutularını ekliyor;
  tekil kutular açılıp kapanıyor ve Hassas yetki etiketi doğru.
- [ ] ACL-12 — “Rolü kaydet” ad/açıklama/yetkileri güncelliyor.
- [ ] ACL-13 — Kullanıcısı olan rolde “Rolü kaldır” devre dışı; boş rolde tarayıcı
  onayının iptal/onay yolları çalışıyor.
- [ ] ACL-14 — Korunan Sistem Yöneticisi rolü salt okunur; değiştirilemiyor,
  silinemiyor ve kısıtlı rol yöneticisi tarafından atanamıyor.
- [ ] ACL-15 — Bir kullanıcı birden fazla rolden birleşik yetki alıyor; rol
  kaldırılınca yalnız kalan rollerin izinleri devam ediyor.
- [ ] ACL-16 — Menü görünürlüğü tek başına güvenlik sayılmıyor: her modülün
  doğrudan URL ve yazma endpoint'i yetkisiz hesapla 403 veriyor.

## 15. Kişisel ayarlar ve parola

- [ ] PERSONAL-01 — Açık/Koyu/Sistem tema seçenekleri anında ve kaydetme sonrası
  doğru uygulanıyor.
- [ ] PERSONAL-02 — Küçük/Normal/Büyük ölçek; Rahat/Normal/Sıkışık yoğunluk;
  Geniş/Dar menü seçeneklerinin tamamı çalışıyor.
- [ ] PERSONAL-03 — “Ayarları kaydet” yalnız değişiklik varsa etkin; kayıttan sonra
  diğer cihaz/yenilemede tercih korunuyor.
- [ ] PERSONAL-04 — “Varsayılana dön” tarayıcı onayında iptal/onay çalışıyor;
  kişisel kayıtlı filtreler ve görünüm tercihleri beklenen şekilde sıfırlanıyor.
- [ ] PERSONAL-05 — Mevcut parola alanının tarayıcı otomatik doldurması tek başına
  kirli form/ayrılma uyarısı oluşturmuyor.
- [ ] PERSONAL-06 — Yanlış mevcut parola reddediliyor.
- [ ] PERSONAL-07 — 12 karakterden kısa, mevcutla aynı veya tekrarı farklı yeni
  parola reddediliyor.
- [ ] PERSONAL-08 — “Parolayı değiştir” geçerli girişte başarı veriyor, formu
  temizliyor; eski parola çalışmıyor, yeni parola çalışıyor.
- [ ] PERSONAL-09 — Bir kullanıcı yalnız kendi parolasını değiştirebiliyor; hız
  sınırı aşırı denemeyi engelliyor.

## 16. Atölye, yazıcı, bakım ve filament ayarları

- [ ] WORK-01 — Telefon, WhatsApp, e-posta ve ulaşılabilir saatler kaydoluyor;
  boş alan genel siteden kayboluyor, dolu bağlantılar doğru protokolü açıyor.
- [ ] WORK-02 — Haftanın her günü Açık/Kapalı anahtarı ve İlk/En geç başlangıç
  saatleri kaydolup ana/yazıcı sayfasına yansıyor.
- [ ] WORK-03 — Kapalı günde saat alanları devre dışı; en geç başlangıç ilk
  başlangıçtan önce olamıyor.
- [ ] WORK-04 — “Ayarları kaydet”, taslak geri yükle/sil ve kaydedilmemiş değişiklik
  senaryoları çalışıyor.
- [ ] PRN-ADM-01 — Her yazıcı kartında ad, açıklama ve durum yalnız ayrı
  `update/change_status` yetkileriyle değişiyor; “Değişiklikleri kaydet” çalışıyor.
- [ ] PRN-ADM-02 — Yeni yazıcı Kısa kod, Durum, Ad ve Açıklamayla “Yazıcı ekle”
  üzerinden oluşuyor; yinelenen kod/boş ad reddediliyor.
- [ ] PRN-ADM-03 — Takvime zaman ekle formunda Tüm yazıcılar/tek yazıcı, durum,
  Tüm gün, başlangıç, bitiş ve not alanları çalışıyor.
- [ ] PRN-ADM-04 — “Takvime ekle” geçerli kaydı genel ve yönetim takvimine
  yansıtıyor; bitiş başlangıçtan önce ve çakışan kayıt reddediliyor.
- [ ] PRN-ADM-05 — Yaklaşan kayıtta “Düzenle”, “Kaydet”, “Vazgeç” bütün alanları
  doğru yönetiyor.
- [ ] PRN-ADM-06 — Takvim kaydı kaldırma tarayıcı onayında iptal/onay çalışıyor.
- [ ] PRN-ADM-07 — Bakım aktif randevuyla çakışamıyor; randevu bitiş anında
  başlayabiliyor.
- [ ] FIL-ADM-01 — Malzeme türünde “Geçici olarak kapat” gerekçe istemi boşken
  işlem yapmıyor, gerekçeyle tüm renkleri kapatıyor.
- [ ] FIL-ADM-02 — “Tekrar kullanıma aç” türü ve renkleri geri açıyor.
- [ ] FIL-ADM-03 — Her filament kartında Malzeme, Renk, Marka, Çap, Makara,
  Nozzle min/max, Tabla min/max ve Teknik bilgi “Bilgileri kaydet” ile güncelleniyor.
- [ ] FIL-ADM-04 — Geçersiz min/max, sayı veya zorunlu değer mevcut kaydı
  bozmadan hata veriyor; teknik kayıt eski kullanılabilirliği yanlışlıkla açmıyor.
- [ ] FIL-ADM-05 — “Filament ekle” bütün alanlarla yeni seçenek oluşturuyor;
  yinelenen/boş/geçersiz değer reddediliyor.
- [ ] FIL-ADM-06 — Filament oluşturma/düzenleme taslak kurtarma ve ayrılma uyarısı
  çalışıyor.

## 17. Randevu özelliği kapalı alpha kabulü

- [ ] BOOK-OFF-01 — `/randevu` güvenli biçimde `/3d-yazicilar` sayfasına dönüyor.
- [ ] BOOK-OFF-02 — `/randevu/musaitlik`, doğrulama ve takip uçları özellik
  kapalıyken randevu verisi açığa çıkarmıyor.
- [ ] BOOK-OFF-03 — Genel sitede randevu formu butonu gösterilmiyor; iletişim
  alternatifi varsa çalışıyor.
- [ ] BOOK-OFF-04 — Yönetim menüsünde Randevular/Takvim ve ayarlarda Randevu
  kuralları/KVKK sekmeleri gizli; doğrudan URL güvenli biçimde kapalı.
- [ ] BOOK-OFF-05 — Manuel yazıcı programı, bakım blokları ve genel takvim
  randevu özelliği kapalıyken görünmeye devam ediyor.

## 18. Randevu özelliği açıkken ayrı kabul turu

Bu bölüm SMTP ve dosya yükleme limitleri hazırlandıktan sonra kontrollü bir test
penceresinde `ONLINE_BOOKING_ENABLED=true` ile çalıştırılır. Test sonunda özellik
yeniden kapatılır ve cache yenilenir.

- [ ] BOOK-01 — Tarih seçmeden Devam et uyarı verir; geçmiş tarih seçilemez.
- [ ] BOOK-02 — Tarih/süre değişiminde uygun yazıcı ve saatler yükleniyor;
  yükleniyor, boş ve hata durumları doğru.
- [ ] BOOK-03 — Yazıcı seçimi o yazıcının saatlerini; süre seçimi bitiş saatini ve
  uygunluk listesini doğru güncelliyor.
- [ ] BOOK-04 — Kapalı gün, bakım/pasif yazıcı, çakışan zaman, başlangıç sınırı ve
  24 saati/ertesi günü aşan baskı kuralları doğru.
- [ ] BOOK-05 — İlk adımda Geri yok; 2–5. adımlarda Geri çalışıyor; Devam et
  doğrulama olmadan ilerlemiyor.
- [ ] BOOK-06 — İzinli gerçek test dosyası seçiliyor; ad/boyut gösteriliyor.
- [ ] BOOK-07 — İzin verilmeyen uzantı, içerikle uyuşmayan sahte uzantı ve PHP
  limitini/uygulama limitini aşan dosya reddediliyor.
- [ ] BOOK-08 — Atölye filamenti seçimi yalnız açık seçenekleri gösteriyor ve
  teknik ayrıntıyı güncelliyor; katalog bağlantısı çalışıyor.
- [ ] BOOK-09 — Kendi filamentim seçimi Malzeme/Renk zorunluluğunu uyguluyor.
- [ ] BOOK-10 — Ad, soyad, geçerli e-posta zorunlu; KVKK bağlantısı yeni sekmede
  doğru metni açıyor.
- [ ] BOOK-11 — Kontrol ekranındaki Tarih/Yazıcı, Dosya, Filament ve Başvuru
  sahibi “Düzenle” butonları doğru adıma dönüp değerleri koruyor.
- [ ] BOOK-12 — Kurallar kutusu seçilmeden gönderim engelli; “Randevu talebini
  gönder” çift gönderimi engelliyor.
- [ ] BOOK-13 — Geçerli talep doğrulama bekleyen kaydı ve özel dosyayı oluşturuyor;
  başarı özetinde doğru yazıcı/tarih/süre var.
- [ ] BOOK-14 — Aynı zaman aralığına eşzamanlı ikinci talep reddediliyor; bitişe
  bitişik başlangıç kabul ediliyor.
- [ ] BOOK-15 — Gönderim hız sınırı çalışıyor.
- [ ] VERIFY-01 — Doğrulama bağlantısı bekleme ekranını açıyor; “E-postamı
  doğrula” tek kullanımda Onay bekliyor durumuna geçiriyor.
- [ ] VERIFY-02 — Süresi geçmiş, bozuk ve ikinci kez kullanılan token güvenli
  sonuç veriyor; randevuyu etkinleştirmiyor.
- [ ] VERIFY-03 — “Randevumu takip et” ve “Ana sayfaya dön” çalışıyor.
- [ ] TRACK-01 — Takip bağlantısı doğru durum, zaman, yazıcı, filament, dosya adı
  ve geçmişi gösteriyor; token URL dışında kişisel veri sızdırmıyor.
- [ ] TRACK-02 — “Randevuyu iptal et” tarayıcı onayının iptal/onay yolları
  çalışıyor; yalnız iptal edilebilir durumda görünüyor.
- [ ] TRACK-03 — Geçersiz token 404; iptal edilmiş kayıtta tekrar iptal yok.

### 18.1. Yönetim randevu listesi, detay ve takvim

- [ ] APPT-01 — Arama numarayla herkeste, ad/e-postayla yalnız kişisel veri
  yetkisinde sonuç veriyor.
- [ ] APPT-02 — Bütün durum filtresi seçenekleri, sıralama, kayıtlı filtre,
  sütunlar ve sayfalama çalışıyor.
- [ ] APPT-03 — Kişisel veri yetkisi olmayanda “Gizli başvuru sahibi”; dosya
  yetkisi olmayanda indirme bağlantısı yok.
- [ ] APPT-04 — “İncele” detaya, “Randevulara dön” önceki filtreli listeye gidiyor.
- [ ] APPT-05 — Güvenli indir doğru dosya adı/içerikle çalışıyor; başka randevu
  dosya kimliği ve doğrudan storage URL'si 404/403.
- [ ] APPT-06 — Onay bekliyor → Değişiklik iste (not zorunlu), Onayla ve Reddet
  butonları site durumu, geçmiş ve e-postayı güncelliyor.
- [ ] APPT-07 — Onaylandı → Baskıya hazır → Baskıyı başlat → Tamamlandı akışı
  yalnız durum yetkisiyle ve doğru sırada ilerliyor.
- [ ] APPT-08 — Basılıyor → Başarısız (not zorunlu) → Baskıya hazır geri dönüşü
  yalnız zaman aralığı hâlâ boşsa çalışıyor.
- [ ] APPT-09 — Her durum butonunun tarayıcı onayında iptal/onay yolları, işlem
  kilidi ve zorunlu not hatası çalışıyor.
- [ ] APPT-10 — Durum e-postası başarısızsa veri güncellemesi korunuyor ve
  yöneticiye uyarı gösteriliyor.
- [ ] CAL-01 — Gün/Hafta butonları, Önceki dönem, Bugün ve Sonraki dönem
  butonları doğru tarihi açıyor.
- [ ] CAL-02 — Takvim olayı detaya gidiyor; bakım/genel kapalı blok bağlantısız ve
  anonim; kişisel veri yetkisi olmayan kullanıcı kimlik görmüyor.
- [ ] CAL-03 — Gece yarısını aşan baskı iki günde devam etiketiyle görünüyor;
  boş gün “Planlanmış kayıt yok” gösteriyor.
- [ ] CAL-04 — Takvim odaktayken Sol/Sağ ok yatay kaydırıyor.

### 18.2. Randevu ve KVKK ayarları

- [ ] BOOK-SET-01 — Gün Açık/Kapalı, ilk/en geç başlangıç yalnız
  `printers.manage_hours` ile değişiyor.
- [ ] BOOK-SET-02 — 15/30/60 dakika adımı, 1–168 saat maksimum süre, 10–1440
  dakika doğrulama süresi yalnız sistem ayarı yetkisiyle değişiyor.
- [ ] BOOK-SET-03 — 1–500 MB dosya sınırı ve desteklenen uzantı kutuları
  doğrulanıyor; sunucu limiti düşükse kullanıcı uyarısı doğru.
- [ ] BOOK-SET-04 — “Randevu kurallarını kaydet”, taslak ve ayrılma koruması
  çalışıyor; mevcut randevular sessizce değişmiyor.
- [ ] PRIV-ADM-01 — Kurum unvanı, adres, KVKK e-postası, randevu ayı, dosya günü,
  sürüm ve Taslak anahtarı kaydoluyor.
- [ ] PRIV-ADM-02 — “Aydınlatma metnini görüntüle” yeni sekmede güncel metni
  açıyor; “KVKK ayarlarını kaydet”, taslak ve ayrılma koruması çalışıyor.
- [ ] PRIV-ADM-03 — Geçersiz e-posta/süre ve boş zorunlu alan eski ayarı
  bozmadan hata veriyor.

## 19. İşlem geçmişi ve zamanlanmış veri yaşam döngüsü

- [ ] AUDIT-01 — Malzeme, stok, teslim, kullanıcı, rol, duyuru, yazıcı, filament,
  ayar ve kalıcı silme değişiklikleri Türkçe eylem adıyla kaydoluyor.
- [ ] AUDIT-02 — Bilinen kodlar ham anahtar yerine Türkçe sunuluyor; bilinmeyen
  kod anlaşılır bağlamla gösteriliyor.
- [ ] AUDIT-03 — Parola, kişi adı/e-posta ve alan değerleri logda yok; yalnız
  değişen alan adları ve sayısal özetler var.
- [ ] AUDIT-04 — İşlem geçmişi yalnız yetkili kullanıcıya açık ve son 200 kayıt
  sınırında.
- [ ] SCHED-01 — Süresi dolan doğrulanmamış randevu bir sonraki cron turunda
  Expired oluyor ve saati bırakıyor; ikinci tur idempotent.
- [ ] SCHED-02 — Tamamlanmış teslim kişisel verisi tanımlı sürede anonimleşiyor;
  aktif teslim korunuyor.
- [ ] SCHED-03 — Saklama süresi dolan randevu dosyası ve uygun kayıt temizleniyor;
  istisna işaretli kayıt korunuyor; hata sonraki tura bırakılıyor.
- [ ] SCHED-04 — Zamanlayıcı sonrasında scheduler/Laravel loglarında yeni kritik
  hata yok.

## 20. Test araçları — yalnız turun en sonunda

- [ ] PURGE-01 — Test Araçları sekmesi yalnız ana yöneticiye görünüyor; diğer
  hesap doğrudan URL'de 403.
- [ ] PURGE-02 — Malzeme sayısı doğru; sıfırsa “Tüm malzemeleri kalıcı sil” devre
  dışı.
- [ ] PURGE-03 — İlk temalı onayda Vazgeç hiçbir şeyi silmiyor; “Devam et” ikinci
  temalı onayı açıyor.
- [ ] PURGE-04 — İkinci onayda yanlış/eksik metinle onay butonu devre dışı;
  tam `TÜM MALZEMELERİ SİL` metni etkinleştiriyor.
- [ ] PURGE-05 — İkinci onayda Vazgeç kapanıp metni sıfırlıyor; akış ikinci kez
  açıldığında buton kilitli kalmıyor.
- [ ] PURGE-06 — Son onay bütün malzemeleri, bunların medya/teslim/stok
  hareketlerini siliyor; kategori ve konumları koruyor; işlem geçmişine sayısal
  özet yazıyor.
- [ ] PURGE-07 — Tek malzeme “Kalıcı sil” yalnız hedef malzeme ve ilişkili test
  verisini siliyor; iki onay akışı/toplu temizlemeden bağımsız çalışıyor.

## 21. Görsel, erişilebilirlik ve tarayıcı matrisi

- [ ] UI-01 — Chromium, Firefox ve en az bir mobil tarayıcıda temel akışlar
  çalışıyor.
- [ ] UI-02 — 200% yakınlaştırmada metin/buton kesilmiyor; yatay belge kayması yok.
- [ ] UI-03 — Koyu temada beyaz kalan sekme, rol kutusu, parola alanı, bildirim,
  başarı/hata mesajı veya modal yok.
- [ ] UI-04 — Açık temada kontrast, seçili/pasif/disabled durumları anlaşılır.
- [ ] UI-05 — Logo bütün genel ve yönetim sayfalarında aynı yuvarlatma ve oranla
  görünüyor.
- [ ] UI-06 — Klavyeyle menü, form, filtre, sayfalama, modal, arama, bildirim ve
  takvim kullanılabiliyor; odak görünür.
- [ ] UI-07 — Form hata özeti odak alıyor, alan hataları ilgili kontrole yakın ve
  `role=alert` ile duyuruluyor.
- [ ] UI-08 — `prefers-reduced-motion` açıkken gereksiz geçiş/kayma yok.
- [ ] UI-09 — Uzun Türkçe metin, çok uzun malzeme adı, boş liste ve yüksek kayıt
  sayısında kart/tablo düzeni bozulmuyor.
- [ ] UI-10 — İşlem sırasında butonlar disabled/işlem metni gösteriyor; çift
  tıklama yinelenen kayıt oluşturmuyor.

## 22. Bilinen sınırlar ve test edilemeyen tanımlar

- [ ] GAP-01 — `loans.extend_due_date`, `loans.export` ve `appointments.export`
  izinleri yapılandırmada tanımlı ancak
  mevcut rotalarda/arayüzde karşılıkları yok. Bunlar özellik olarak bekleniyorsa
  geliştirme işi açılmalı; beklenmiyorsa izin listesinden kaldırılmalı.
- [ ] GAP-02 — Yenileme/sekme kapatma `beforeunload` penceresinin dili ve görünümü
  tarayıcı tarafından belirlenir; site temasıyla özelleştirilemez (A-002).
- [ ] GAP-03 — Rol kaldırma, duyuru kaldırma, randevu durumu, arşivleme, medya
  kaldırma, filament kapatma ve takip iptali hâlen tarayıcı `confirm/prompt`
  kullanır. İşlev test edilir; site temalı modal isteniyorsa ayrı geliştirme
  kaydı açılır.
- [ ] GAP-04 — SMTP gerçek gönderim, SPF/DKIM ve teslimat testi tamamlanmadan
  randevu modülü kapalı tutulur.
- [ ] GAP-05 — PHP güvenlik paketi/backport doğrulaması hosting sağlayıcısından
  alınmadan güvenlik kapısı tamamlanmış sayılmaz.

## 23. Test turu kapanışı

- [ ] CLOSE-01 — Başarısız bütün testler hata kaydına dönüştürüldü; engelli
  maddelerin nedeni ve sahibi belli.
- [ ] CLOSE-02 — Sentetik aktif teslimler tamamlandı; randevu denemeleri iptal
  veya son durumuna getirildi.
- [ ] CLOSE-03 — Sentetik kullanıcılar pasifleştirildi/silindi; Directory Privacy
  hesapları davet listesiyle eşleşiyor.
- [ ] CLOSE-04 — Sentetik malzemeler tek tek veya son testte Test Araçları ile
  temizlendi; gerçek kategori/konum/veriye dokunulmadı.
- [ ] CLOSE-05 — `laravel.log`, scheduler hata logu, web sunucusu hata logu ve
  tarayıcı konsolu yeni kritik hata açısından incelendi.
- [ ] CLOSE-06 — Test sonrası yeni veritabanı yedeği alındı ve bütünlüğü
  doğrulandı.
- [ ] CLOSE-07 — `CLOSED_ALPHA_CHECKLIST.md` sonuçlara göre güncellendi; açık
  güvenlik maddeleri kapanmadan davet kapsamı genişletilmedi.

## Kabul ölçütü

Kapalı alpha başlangıcı için Bölüm 0–17, 19, 21 ve 23'teki kritik maddeler
geçmelidir. Bölüm 18, çevrimiçi randevu özelliği açılmadan önce ayrı bir kabul
turudur. `KALDI` sonucu veren veri kaybı, yetki aşımı, kişisel veri sızıntısı,
500 hatası, yedek/geri dönüş veya güvenlik kapısı maddesi yayın engelidir.
