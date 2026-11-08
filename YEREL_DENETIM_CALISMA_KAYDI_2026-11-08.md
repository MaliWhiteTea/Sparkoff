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
