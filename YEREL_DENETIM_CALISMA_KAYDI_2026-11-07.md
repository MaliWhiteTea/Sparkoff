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

## 7 Kasım ek turu — yönetici ve yükleme hata yolları

| Alan | Kanıt | Sonuç |
|---|---|---|
| F05 | Doğrulama e-postası gönderilemediğinde randevu ve özel dosyanın silindiği yeni HTTP testiyle doğrulandı. | Geçti |
| H01/H02 | Son yöneticinin değişmeyen rol kimliğini form metni olarak gönderme senaryosu önce başarısız oldu; BUG-003 düzeltildi. | Geçti |
| B08/G04 | Geri bildirim görseli diske yazılırken istisna oluşması önce 500 ile sonuçlandı; BUG-004 düzeltildi. | Geçti |
| F03/H01 | PDO MySQL uzantısı var, fakat yerelde MySQL/MariaDB sunucusu veya Docker/Podman bulunmadı. Randevu ve son yönetici korumasının gerçek veritabanı eşzamanlılık testi açık. | Engelli: yalıtılmış veritabanı gerekli |
| Kalite kapısı | Düzeltmelerden sonra `php artisan test --compact`: 294 test, 293 geçti, 1 MySQL/MariaDB testi atlandı, 2844 assertion. `pint --test`, `tsc --noEmit` ve `composer audit --format=summary` geçti. | Geçti; veritabanı kabulü açık |

### BUG-003 — Değişmeyen sistem yöneticisi rolünün yanlış reddi

**Önem:** Orta. `PUT /yonetim/kullanicilar/{user}` isteğinde `role_ids` form metni olarak (`"1"`) gelirse, son aktif sistem yöneticisi mevcut rolünü korusa bile kayıt engelleniyordu. Doğrulanmış alanın ham metin kimliği, sayısal sistem rolü kimliğiyle katı biçimde karşılaştırılıyordu. Yeni HTTP testi düzeltme öncesi hata, sonrası başarı gösterdi. Koruma artık önceden sayıya çevrilmiş rol kimliklerini kullanıyor. Son yöneticinin gerçekten yetki kaybetmesini reddeden mevcut test de geçti.

### BUG-004 — Geri bildirim görseli depolama hatasında 500

**Önem:** Orta. `POST /geri-bildirim` sırasında disk istisnası oluşursa talep kaydı oluşturulduktan sonra işlem 500'e düşüyordu. Geçici disk hatasını simüle eden HTTP testi bunu doğruladı. İstisna artık raporlanıyor; yarım talep siliniyor ve görsel alanında anlaşılır doğrulama hatası dönüyor. Test, talep tablosunun boş kaldığını doğruluyor.

**Durum:** BUG-003 ve BUG-004 yerelde düzeltildi; canlıya yayınlanmadı.

### BUG-005 — Envanter medyası depolama hatasında 500

**Önem:** Orta. `POST /yonetim/envanter/{item}/medya` isteğinde dosya diski istisna verirse yükleme alanı hatası yerine 500 oluşuyordu. Yeni HTTP testi bunu düzeltme öncesi yeniden üretti. Dosya yazma istisnası artık raporlanıyor ve `file` alanına doğrulama hatası dönüyor; başarısız yazma sonucu da aynı şekilde ele alınıyor. Test, medya tablosunda kayıt oluşmadığını doğruluyor.

**Son kalite kapısı:** 295 PHP testi, 294 geçti, yalnız MySQL/MariaDB testi atlandı, 2849 assertion. PHP biçim ve TypeScript tip kontrolü geçti. BUG-003–BUG-005 yerelde düzeltildi; canlıya yayınlanmadı.

## 7 Kasım ek turu — doğrudan rota kapsamı

`php artisan route:list --json` çıktısındaki 97 adlandırılmış rota, testlerdeki doğrudan `route(...)` çağrılarıyla karşılaştırıldı. Yedi rota için doğrudan çağrı bulunmadı. Her biri için gerçek HTTP isteğiyle davranış ve yetki sınırı sınandı:

| Rota | Eklenen doğrulama |
|---|---|
| `admin.inventory.categories.store` | Yetkili kategori oluşturur; konum yetkilisi kategori oluşturamaz. |
| `admin.inventory.locations.store` | Konum kodu büyük harfe normalize edilir; kategori yetkilisi konum oluşturamaz. |
| `admin.inventory.archive` | Yetkisiz istek reddedilir; arşivleme etkinliği kapatır ve stok miktarını korur. |
| `admin.settings.printers.store` | Yazıcı kodu normalize edilir; yinelenen kod doğrulama hatası verir. |
| `admin.settings.filaments.store` | Filament kaydedilir; aynı malzeme ve rengin ikinci kaydı reddedilir. |
| `admin.announcements.destroy` | Kamu ve ekip arşivleme izinleri birbirine geçmez; yetkili silme çalışır. |
| `admin.logout` | Oturum kapatılır; yönetim ekranına sonraki istek girişe yönlenir. |

**Sonuç:** Yeni altı testin tamamı geçti. Tam suite: 301 test, 300 geçti, MySQL/MariaDB gerektiren 1 test atlandı, 2884 assertion. `pint --test`, `tsc --noEmit`, `git diff --check` geçti. Bu tarama yalnız doğrudan rota çağrısı boşluğunu kapatır; 97 rotanın tamamının tüm hata, yetki ve yan etki kombinasyonlarını ispatlamaz. Canlıya yayın yapılmadı.
