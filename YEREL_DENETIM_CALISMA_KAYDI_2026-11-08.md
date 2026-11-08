# Sparkoff yerel denetim — 8 Kasım çalışma kaydı

Bu kayıt [ön raporun](YEREL_TAM_KAPSAM_DENETIM_ON_RAPORU_2026-11-06.md) devamıdır. Denetim tamamlanmadı; canlı siteye yayın yapılmadı.

## Ortam ve yöntem

- Laravel, yalnız bu tur için oluşturulan sentetik SQLite veritabanıyla `127.0.0.1:8765` üzerinde çalıştırıldı. Gerçek kullanıcı verisi kullanılmadı.
- Chromium headless ve Playwright ile `/`, `/3d-yazicilar`, `/filamentler`, `/malzemeler`, `/geri-bildirim`, `/kvkk-aydinlatma` sayfaları 320, 375, 768, 1024 ve 1440 CSS px genişlikte tarandı: toplam 30 sayfa/genişlik birleşimi.
- Bu 30 birleşimde HTTP 200, belge genişliği görüntü alanını aşmıyor, kırık görsel ve JavaScript `pageerror` yok. Bu sonuç, tüm metinlerin okunurluğunu veya tüm etkileşimleri tek başına kanıtlamaz.
- 320 px'de mobil menü açılışı, ilk bağlantıya odak, Shift+Tab/Tab odak döngüsü, Esc ile kapanma ve odak dönüşü, Malzemeler bağlantısı, İletişim çapası ve alt bilgideki Geri Bildirim bağlantısı gerçek tarayıcıyla sınandı.
- Sentetik telefon, WhatsApp ve e-posta ayarlarıyla 320/375/768 px'de `tel:`, `https://wa.me/` ve `mailto:` bağlantı hedefleri doğrulandı. Boş iletişim ayarında açıklayıcı durum metni görüntülendi.
- Geri bildirim başarı mesajının kontrast oranı koyu temada 7,99:1; açık temada 5,97:1 ölçüldü.

## BUG-008 — Mobil alt sayfalarda gereksiz alt boşluk

**Önem:** Düşük; görsel düzen. 640 px ve altında `body` öğesine verilen 72 px alt dolgu, sabit randevu butonu yalnız ana sayfada olmasına rağmen geri bildirim ve yazıcı sayfası dahil bütün kamu sayfalarında alt bilginin altında boş alan bırakıyordu. Düzeltme öncesinde 320 px'de ana sayfa, geri bildirim ve yazıcı sayfalarının her birinde 72 px ölçüldü.

**Düzeltme:** Alt dolgu `.portal-home` öğesine taşındı. Üretim derlemesi geçti. Düzeltme sonrasında 320 ve 375 px'de ana sayfada buton için 72 px alan kaldı; geri bildirim ve yazıcı sayfalarında alt bilgi sonrası boşluk 0 px oldu. 768 px'de üç sayfada da 0 px ölçüldü. Tekrar ölçümünde yatay taşma yoktu. Bu küçük CSS değişikliği için uygulama davranışını kopyalayan yeni bir test eklenmedi.

**Görsel kanıt:** Sentetik veriyle alınan [ana sayfa](docs/audit/2026-11-08/home-320.png), [yazıcılar](docs/audit/2026-11-08/printers-320.png) ve [geri bildirim](docs/audit/2026-11-08/feedback-320.png) 320 px ekran görüntüleri.

## Açık kapsam

390 maddelik [manuel planın](ALPHA_UCTAN_UCA_MANUEL_TEST_PLANI.md) tamamına henüz sonuç atanmadı. Yönetim ekranlarının tarayıcı etkileşimleri, bütün rol/izin ve hata yolları, gerçek dokunmatik cihaz, ekran okuyucu, SMTP, sunucu cron'u, canlı hosting ve yedekten geri yükleme ayrı kabul kanıtı gerektiriyor. Önceki turdaki 307 PHP testinin 306'sı geçti, yalnız yerelde MySQL/MariaDB gerektiren test atlandı (2918 assertion); bu turda PHP kodu değişmedi. JS üretim derlemesi geçti; büyük parça uyarısının yükleme performansına etkisi açık.

## Mobil kullanım ek denetimi

Kullanıcı bildirimi üzerine mobil menü ve ana sayfa düğmeleri ayrıca incelendi. İlk turdaki yalnızca yatay taşma kontrolü bu hataları yakalamamıştı: menü bağlantıları DOM içinde olsa da panelin kullanılabilir alanı doğru hesaplanmıyordu.

### BUG-009 — Üç çizgi menüsü yüksekliği 36 px

**Önem:** Yüksek. Başlıktaki `backdrop-filter`, içindeki `position: fixed` menü ve karartma katmanı için farklı bir konumlandırma alanı oluşturuyordu. 320–768 px ölçümlerde menü paneli 36 px, karartma katmanı 0 px yüksekliğindeydi; bağlantılar görünür ve dokunulabilir panelde yer almıyordu.

**Düzeltme:** 900 px ve altında başlığın blur filtresi kaldırıldı. Masaüstü görünümü korunuyor. Son ölçümlerde 320×640 için menü ve katman 572 px, 375×667 için 599 px, 768×800 için 722 px ve 900×700 için 622 px; hepsi başlığın altından ekranın altına kadar uzanıyor. Mobil bağlantıya dokunma, dış alana dokunarak kapatma, Esc ile kapatma ve odak dönüşü sınandı.

### BUG-010 — Sabit mobil düğme içerik üzerine biniyor

**Önem:** Orta. Ana sayfanın altındaki sabit “3D yazıcıları incele” düğmesi 320 px ekranın alt 52 px alanını bütün kaydırma konumlarında kapatıyordu. Tema düğmesi de bunun üzerinde tutulduğu için başlangıçta atölye durum kartının üzerine denk geliyordu. Ana sayfanın girişinde zaten aynı hedefe giden “3D yazıcılar” düğmesi bulunuyor.

**Düzeltme:** Tekrarlanan sabit düğme ve yalnız onun için ayrılmış alt dolgu kaldırıldı; tema düğmesi mobilde alt kenardan 12 px konumuna alındı. 320 px'de ana sayfa giriş düğmesi dokunarak `/3d-yazicilar` sayfasına yönlendirdi. Sabit düğmenin kaldırıldığı ve atölye kartının görünür olduğu [ana sayfa görüntüsü](docs/audit/2026-11-08/home-mobile-after-menu-fix-320.png) ile açılmış [menü görüntüsü](docs/audit/2026-11-08/menu-open-after-fix-320.png) kaydedildi.

**Tekrar kontrolü:** Chromium dokunmatik emülasyonunda altı kamu sayfası 320, 375, 390, 430 ve 768 px'de yeniden tarandı: toplam 30 birleşimde HTTP, yatay taşma ve JavaScript sayfa hatası çıkmadı. Menü kullanan dört sayfada panel alanı, gövde kaydırma kilidi, ilk bağlantı odağı ve Esc ile kapanma doğrulandı. 320–430 px'de başlangıç ekranında görünür bağlantı/düğme/girdi merkezlerinin başka bir öğe tarafından kapatılmadığı kontrol edildi. `npm run build`, `npx tsc --noEmit` ve `git diff --check` geçti. Bu emülasyon fiziksel telefon testi veya bütün sayfanın her kaydırma konumundaki görsel kabulü değildir.

## Mobil dokunma hedefleri ve tam sayfa kaydırma turu

Altı kamu sayfası 320, 375, 390 ve 430 px'de hem açık hem koyu temada yarım ekranlık aralıklarla sonuna kadar kaydırılıp görünür bağlantı ve düğmelerin merkezine başka öğe gelip gelmediği ölçüldü. Başlığın altından geçmekte olan öğeler örnekleme anında raporlandı; menüyle gerçek bölüm geçişlerinde `#icerik` ve `#hizmetler` başlıklarının yapışkan başlığın altında kalmadığı ayrıca doğrulandı. Bu örnekleme, ekranın her pikselini veya gerçek dokunmatik cihazı kapsamaz.

### BUG-011 — Dar ekranda küçük bağlantı ve filtre hedefleri

**Önem:** Orta. KVKK sayfasındaki “Ana sayfaya dön” bağlantısı 320 px görünümde yalnız 14 px yüksekliğindeydi. Filament başlık düğmesi ve malzeme filtre düğmeleri yaklaşık 10 px yazıyla gösteriliyordu; filtre düğmelerinin yüksekliği 40 px idi.

**Düzeltme:** 600 px ve altında KVKK bağlantısı 44 px, filament düğmesi 47 px, malzeme filtreleri en az 44 px ve tema düğmesi 44×44 px yapıldı. Üç kontrolün yazısı 12 px. 320/375/390/430/600 px ölçümlerinde yatay taşma veya JavaScript sayfa hatası görülmedi. 320 px'de malzeme filtre düğmeleri metne yer açmak için 54 px'e yükseliyor. Dokunmatik emülasyonda KVKK bağlantısı ana sayfaya, filament düğmesi yazıcılara götürdü; filtre paneli açıldı ve stok filtresi `?stock=available` durumuna geçti.

**Görsel kanıt:** [KVKK](docs/audit/2026-11-08/legal-mobile-controls-320.png), [filament](docs/audit/2026-11-08/filaments-mobile-controls-320.png) ve [malzeme filtreleri](docs/audit/2026-11-08/materials-mobile-controls-320.png) 320 px ekran görüntüleri. Üretim derlemesi ve `git diff --check` geçti.

## Yönetim paneli mobil menüsü

Bu turda yalnız sentetik SQLite veritabanında oluşturulan test yöneticisi kullanıldı; canlı kullanıcı/veri kullanılmadı. Girişten sonra 320, 375, 430, 768 ve 900 px'de yönetim çekmecesi açıldı. Panel ve karartma katmanı 64 px başlık altından ekranın sonuna kadar uzanıyordu; fakat menü bağlantıları simge üstte, etiket altta gösteriliyor ve yaklaşık 10 px yazı kullanıyordu.

### BUG-012 — Yönetim menüsünde çakışan mobil CSS kuralları

**Önem:** Orta. Eski 600/900 px kuralları, daha yeni çekmece düzeninin bağlantılarını `display:block` yapıyordu. 320 px'de bir bağlantı 59,8 px yüksekliğindeydi; simge ve yazı ayrı satırlardaydı. Menü düğmesi 42×42 px, kısa ekrandaki “Çıkış yap” düğmesi yalnız 17 px yükseklikteydi.

**Düzeltme:** Mobil yönetim bağlantıları flex satırına alındı, 12 px yazı ve en az 44 px dokunma yüksekliği verildi. Menü düğmesi 44×44 px, çıkış düğmesi 44 px yapıldı. 320–900 px'de panel açma, Esc ile kapatma, envanter bağlantısına dokunma, gövde kaydırma kilidi, yatay taşma ve JavaScript sayfa hatası kontrol edildi. 320×480 px kısa ekranda menü 149 px kendi içinde kaydırılarak çıkış düğmesine erişildi. [320 px açık menü](docs/audit/2026-11-08/admin-mobile-menu-after-fix-320.png) ve [320×480 px kısa ekran](docs/audit/2026-11-08/admin-mobile-short-menu-after-fix-320.png) görüntüleri kaydedildi. Üretim derlemesi ve `git diff --check` geçti.

**Sınır:** Bu adım yalnız menüye odaklandı. Yönetim modüllerinin mobil form, tablo ve bütün izin akışları hâlâ açık.

## Yönetim envanteri mobil üst alanı ve filtreler

Sentetik test yöneticisiyle 320, 375 ve 430 px'de `/yonetim/envanter` açıldı; liste üst alanı, yeni malzeme formu ve filtreler gerçek tarayıcıda kontrol edildi.

### BUG-013 — Envanter üst düğmeleri 320 px ekranı genişletiyor

**Önem:** Orta. 320 px görsel görüntü alanında CSV yükle/indir düğmelerinin dar sütunlara zorlanması belge genişliğini 323 px'e çıkarıyordu. “Yeni malzeme” düğmesine dokununca form `scrollIntoView` ile ekranın tepesine geliyor, form başlığı 64 px sabit yönetim çubuğunun arkasında kalıyordu.

**Düzeltme:** 600 px ve altında başlık ile eylemler alt alta yerleştirildi. CSV düğmeleri eşit iki sütunda, “Yeni malzeme” tam genişlikte ve en az 44 px yüksekliğinde. Forma 76 px kaydırma payı verildi. 320 px'de belge genişliği 320 px'e indi; form başlığı 95 px'de, sabit çubuğun 64 px alt kenarının altında görünüyor. 375/430 px'de de taşma ve JavaScript hatası görülmedi. Formun ilk alanı odaklandı; durum filtresi `status=low`, arama `search=test` parametresine geçti. [Liste üstü](docs/audit/2026-11-08/admin-inventory-mobile-header-320.png) ve [açık form](docs/audit/2026-11-08/admin-inventory-mobile-create-320.png) görüntüleri kaydedildi.

**Sınır:** Kayıt ekleme, düzenleme, stok hareketleri, CSV aktarımı ve envanterdeki tüm diğer mobil etkileşimler bu turda tamamlanmadı. Üretim derlemesi ve `git diff --check` geçti.
