# Sparkoff V2 — Spero tasarım yenilemesi (9 Kasım 2026)

## Kaynaklar

- Görsel kaynak: `/home/mert/Downloads/spero-tasarim-sistemi.md`. Bu yenilemede kullanılan Spero rehberi budur.
- İşlev ve mimari kaynağı: `/home/mert/Downloads/sparkoff_v2_codex_i_n_a_rehberi_cpanel_uyumlu.md`.
- Önceki MD dosyaları silinmedi veya değiştirilmedi.

## Yapılanlar

- Eski yeşil ağırlıklı stil kaldırıldı. Spero'nun `#0D1730` lacivert zemini, sabit SVG ışık lekeleri ve şeritleri, yarı saydam cam yüzeyleri ve `#F4A48C` şeftali vurgusu uygulandı.
- Outfit yazı tipi Vite çıktısına yerel dosyalar olarak eklendi; Google Fonts isteğine bağımlı değil.
- Kart, düğme, rozet, form, pencere, masaüstü yan menü ve mobil alt menü Spero ölçü ve parlama kurallarına göre yeniden yazıldı.
- Masaüstü yan menü pencere kenarından 14 px içeride yüzer; 272 px açık, 78 px kapalıdır. Arama, grup başlıkları, çizgi ikonları, profil kartı ve klavye kısayolu eklendi.
- Ana sayfaya kodla çizilen 3D yazıcı illüstrasyonu ve yeni hero düzeni; yönetim genel bakışına kart, sayaç, grafik ve duyuru yerleşimi eklendi.
- Bütün yönetim sayfasının açılışta soluk görünmesine neden olan animasyon kaldırıldı.

## Görsel kontrol

- [Ana sayfa — masaüstü](../docs/design/2026-11-09/home-desktop.png)
- [Ana sayfa — mobil](../docs/design/2026-11-09/home-mobile.png)
- [Genel bakış — masaüstü](../docs/design/2026-11-09/admin-desktop.png)
- [Genel bakış — mobil](../docs/design/2026-11-09/admin-mobile.png)

Firefox başsız ekran görüntülerinde 1440×900 ve 390×844 boyutları kontrol edildi. Bunlar V2 örnek modu verileriyle çekildi; gerçek kullanıcı veya canlı veri içermez.

## Doğrulama ve sınır

`npm run build` ve `npm test` geçti (4 test). Yerel V2 örnek sunucusu `http://127.0.0.1:5174/` adresinde açık. Gerçek MySQL ve V1 veri geçişi bu tasarım çalışmasının kapsamına alınmadı; durum [inşa kaydında](SPARKOFF_V2_INSA_KAYDI_2026-11-08.md).

## 9 Kasım devamı — tüm sayfalarda arayüz tutarlılığı

- Ortak butonlar, liste içi işlemler ve durum rozetleri küçültülüp hizalandı; rozetlerde büyük simgeler yerine ince durum noktaları kullanıldı.
- Tailwind `.list-item` çakışması giderildi; liste satırlarında görünen tarayıcı madde işaretleri kaldırıldı. Yazıcı, filament, randevu, malzeme, teslim, görev ve üye listeleri okunaklı satır düzenine geçirildi.
- Filament formundaki dev onay kutusu 18×18 px ölçüsüne alındı. Sayı girişlerindeki tarayıcı okları gizlendi; masaüstü formları ortalanmış pencere, mobil formları alt panel olarak çalışıyor.
- Durum, rol ve malzeme türü adları Türkçeleştirildi; miktarlar Türkçe sayı biçiminde gösteriliyor.
- Proje kökündeki `logo.jpg` V2'ye eklendi. Ziyaretçi menüsü, yönetim yan menüsü, mobil başlık, giriş/aktivasyon ekranları, tarayıcı ikonu ve yönetim genel bakış kartında kullanılıyor. Küçük gösterimde logonun alt yazısının kadraja girmesi giderildi.
- Yan menü yeniden boyutlandırma alanı genişletildi; sürüklerken yazı seçimi engellenip işlem bitince geri açılıyor.
- Yazıcı kodu düzenlenebilir hale getirildi; yalnız kod değiştiğinde site tarzında onay penceresi açılıyor. API kodu doğruluyor ve mükerrer kodu reddediyor.

Yeni görsel kontrol: [yazıcı masaüstü](../docs/design/2026-11-09/printers-refined-desktop.png), [yazıcı mobil](../docs/design/2026-11-09/printers-refined-mobile.png), [envanter](../docs/design/2026-11-09/inventory-refined-desktop.png), [üyeler](../docs/design/2026-11-09/members-refined-desktop.png), [logo eklenen genel bakış](../docs/design/2026-11-09/overview-logo-desktop.png), [giriş](../docs/design/2026-11-09/login-logo-desktop.png). Bunlar örnek mod ekranlarıdır.

Güncel doğrulama: `npm run build` ve `npm test` (18/18) geçti. Ayrı yerel MariaDB 13 kabulünde yazıcı kodu değişikliği ve mükerrer kodun 409 ile reddedilip mevcut kodun korunması geçti. Geçici API/SQL süreçleri kapatıldı. Gerçek Ubuntu VDS kabulü henüz yapılmadı.

**Küçük logo düzeltmesi:** Kullanıcının geri bildirimiyle yan menü ve ziyaretçi ana sayfasındaki küçük logo, büyük genel bakış logosuyla aynı merkezleme oranına geçirildi. Alttan görünen yazı parçası kapatıldı. [Ana sayfa](../docs/design/2026-11-09/home-logo-desktop.png), [yönetim masaüstü](../docs/design/2026-11-09/overview-logo-desktop.png) ve [yönetim mobil](../docs/design/2026-11-09/overview-logo-mobile.png) tekrar görüntülendi; `npm run build` geçti.
