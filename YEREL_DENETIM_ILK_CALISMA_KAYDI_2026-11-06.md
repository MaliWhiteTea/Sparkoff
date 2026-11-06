# Sparkoff yerel denetim — ilk çalışma kaydı

**Tarih:** 6 Kasım 2026
**Kapsam:** [Denetim ön raporunun](YEREL_TAM_KAPSAM_DENETIM_ON_RAPORU_2026-11-06.md) ilk yürütme turu. Tüm kapsam henüz bitmedi.

## Yapılan kontroller

| Kimlik | Alan | Kanıt | Durum |
|---|---|---|---|
| D03/E01/E02 | Stok düzeltme, teslim ve iade miktarı hassasiyeti | Dört ondalıklı girdilerle yeni HTTP regresyon testleri önce başarısız, düzeltmeden sonra başarılı oldu. | GEÇTİ |
| H03 | Yönetim rotalarında giriş kapısı | `php artisan route:list --json` çıktısındaki 100 kayıt tarandı. `yonetim` altında `auth` olmayan yalnız giriş ekranı ve giriş POST'u; bu genel kapı kontrolüdür, rota bazlı izin denetimi sürüyor. | KISMİ |
| B01–B09/C01 | Kamu ve giriş rotaları için yerel duman testi | `/`, `/3d-yazicilar`, `/filamentler`, `/malzemeler`, `/geri-bildirim`, `/kvkk-aydinlatma`, `/yonetim/giris`, `/randevu`, `/up`: dokuzu da HTTP 200. Firefox headless ile masaüstü ana sayfa ve 375 px geri bildirim ekranı açılıp görüntülendi. Etkileşim ve tam sayfa kontrolü açık. | KISMİ |
| I09 | README durum tablosu | CSV/XLSX ile güvenli geri alma kodda ve yol haritasında tamamlanmışken README'de “Planlandı” yazıyordu; tablo düzeltildi. | GEÇTİ |
| Başlangıç kapısı | Tüm PHP testleri | 289 test, 288 geçti, 1 MySQL/MariaDB gerektirdiği için atlandı, 2811 assertion. | GEÇTİ; veritabanı kabulü açık |
| Başlangıç kapısı | PHP biçim | `./vendor/bin/pint --test` geçti. | GEÇTİ |

## BUG-001 — Stok hareketinde üç basamaktan fazla miktar kabulü

**Önem:** Orta; stok doğruluğu ve bazı sınır değerlerde sunucu hatası riski.
**Etkilenen alan:** `POST /yonetim/envanter/{item}/stok`, `POST /yonetim/teslimler`, `POST /yonetim/teslimler/{transaction}/iade`.
**Ön koşul:** Yetkili kullanıcı, stoklu malzeme.
**Tekrar adımı:** Stok düzeltmeye `0.0006` veya teslime `1.0001` miktarı gönder.
**Beklenen:** En fazla üç ondalık basamak kabul edilir; geçersiz girdi alan hatası verir ve veri değişmez.
**Önceki gerçek sonuç:** Girdi kabul ediliyor; servis miktarı binde bire yuvarlıyor. Bu, gönderilen değer ile saklanan hareketi farklılaştırabiliyor.
**Düzeltme:** Stok düzeltme, teslim ve iade doğrulamalarına `decimal:0,3` eklendi.
**Regresyon:** İki özellik testi eklendi; düzeltme öncesi ikisi de başarısız, sonrası geçti. Tam PHP paketi de geçti.
**Durum:** Yerelde düzeltildi; canlıda yayınlanmadı.

## Açık denetim işleri

- 97 açık HTTP rota tanımı için yöntem, izin, doğrulama, hata yanıtı ve yan etki matrisi henüz tamamlanmadı.
- Mevcut 390 maddelik kullanıcı arayüzü planının etkileşim, mobil, tema ve klavye turu henüz yapılmadı.
- Firefox ile statik ekran görüntüsü alınabiliyor; `geckodriver`, `chromium`, `mysql`, `docker`/`podman` ve Playwright/Puppeteer kurulumu bulunmadı. Etkileşimli tarayıcı otomasyonu ile MySQL/MariaDB kabulü için uygun yalıtılmış ortam hazırlanacak; bu kontroller henüz geçti sayılmaz.
- Canlı hosting, SMTP teslimatı, cPanel cron'u ve canlı yedek geri yükleme sonuçları bu yerel turda kanıtlanamaz; canlı test kanıtı ayrı izlenecek.

Bir sonraki tur: kritik rota/izin matrisi, dosya erişimi ve randevu akışı; ardından yerel tarayıcı ortamı ve UI turu.
