# Sparkoff yerel denetim — 7 Kasım çalışma kaydı

Bu belge [ön rapordaki](YEREL_TAM_KAPSAM_DENETIM_ON_RAPORU_2026-11-06.md) denetimin devamıdır. [6 Kasım kaydı](YEREL_DENETIM_ILK_CALISMA_KAYDI_2026-11-06.md) üzerindeki BUG-001 düzeltmesi korunur. Tam denetim henüz bitmedi.

## Bu turdaki kanıtlar

| Alan | Yapılan kontrol | Sonuç |
|---|---|---|
| H03 | `php artisan route:list --json` ile yönetim rotaları tarandı. Açık giriş kapısı olmayan 18 kimlik doğrulamalı rota ayrı incelendi; toplu envanter, geri alma, kişisel filtre, son görüntülenen ve bildirim işlemlerinde nesne/kullanıcı yetkisi kontrolör veya serviste yer alıyor. Tüm izin matrisi hâlâ açık. | Kısmi |
| F04 | Randevu dosyası indirmesinde kimlik doğrulama, `appointments.download_file`, özel `local` disk ve dosyanın doğru randevuya ait olması kontrol edildi. Çapraz randevu erişimi için yeni HTTP testi geçti. | Geçti: incelenen yol |
| F06/H03 | Randevu detayı ve geçmişinin kişisel veri izniyle sunulması sınandı. BUG-002 bulundu ve düzeltildi. | Geçti: yeni regresyon |
| Kalite kapısı | `php artisan test --compact`: 291 test, 290 geçti, 1 MySQL/MariaDB gerektirdiği için atlandı, 2831 assertion. `pint --test`, `tsc --noEmit`, `npm run build`, `composer audit --format=summary` geçti. | Geçti; üretim veritabanı kabulü açık |
| B02/B03 | Firefox headless + Selenium ile 390 px görünümde mobil menü açma, İletişim bağlantısına gitme, alt sayfadan ana sayfa İletişim bölümüne geçme, Esc ile kapatma ve odağın düğmeye dönmesi gerçek tarayıcıda sınandı. | Geçti: sayılan etkileşimler |
| B04 | Kamu temasını değiştirip sayfayı yeniledikten sonra `localStorage` seçiminin korunduğu gerçek tarayıcıda doğrulandı. | Geçti: kalıcılık |
| B08 | Geri bildirimde kısa açıklamanın Türkçe doğrulama hatası; fotoğraf seçme/kaldırma; 5 MB üstü dosyanın istemcide reddi sınandı. Sunucuya başarılı gönderim ve tüm dosya türleri henüz açık. | Kısmi |

Derleme aynı 500 kB üstü JS parçası uyarısını veriyor; bu performans turunda ölçülecek.

## BUG-002 — Randevu geçmişi notunda kişisel veri sızıntısı

**Önem:** Yüksek. `appointments.view` yetkili, `appointments.view_personal_data` yetkisiz personel serbest metin geçmiş notunu görebiliyordu. Yönetici bu nota başvuru sahibinin adını veya e-posta adresini yazabilir.

**Tekrar:** Test randevusuna `Ada Lovelace, ada@example.com adresine gönderilecek.` geçmiş notunu ekle; yalnız `appointments.view` yetkili hesapla detay ekranını aç.

**Önceki sonuç:** Ad ve e-posta alanları maskelense de `appointment.history.0.note` ham kişisel bilgiyi içeriyordu. Test bu durumu düzeltme öncesi başarısızlıkla gösterdi.

**Düzeltme:** Geçmiş notu yalnız `appointments.view_personal_data` yetkisiyle Inertia yanıtına ekleniyor. Yetkisiz kullanıcıya `null` gönderiliyor; arayüz boş paragraf oluşturmuyor. Ayrı yetkili hesapla notun görünmeye devam ettiği doğrulandı.

**Durum:** Yerelde düzeltildi; canlıya yayınlanmadı.

## Devam edecek kontroller

- 97 açık HTTP rotası için her yöntemin başarısız girdi, yetkisiz rol ve yan etki matrisi tamamlanacak.
- Randevu oluşturma/doğrulama/takip ve eşzamanlı slot senaryoları ayrıca yürütülecek.
- Geçici Python sanal ortamında Selenium ve Firefox sürücüsü çalıştırıldı; yukarıdaki ilk gerçek tarayıcı etkileşimleri geçti. Mevcut 390 maddelik UI planının geri kalanı açık.
- Yönetici rolünü kaldırma/pasifleştirmede son aktif yöneticiyi koruyan kontrol transaction öncesinde yapılıyor. İki eşzamanlı istekte yarışma riski kod incelemesinde görüldü; MySQL/MariaDB ile eşzamanlılık kanıtı olmadan doğrulanmış hata veya geçti olarak işaretlenmeyecek.
- MySQL/MariaDB, gerçek SMTP ve hosting koşulları bu yerel ortamda doğrulanmadı; bunlar yeşil kabul edilmeyecek.
