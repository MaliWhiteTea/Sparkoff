# Sparkoff — Bugbot düzeltme sırası

**Kaynak rapor:** `BUGBOT_RAPORU_2026-10-27.md`  
**Kapsam:** Rapordaki 35 bulgunun bağımlılıklarına göre uygulanma sırası  
**Amaç:** Her paketin ayrı uygulanıp doğrulanabileceği, düşük modelin takip edebileceği bir çalışma düzeni

## Temel çalışma kuralı

Tüm bulguları tek değişiklikte çözmeyin. Aşağıdaki her paket için önce doğru davranışı bekleyen regresyon testi ekleyin, sonra düzeltmeyi yapın, ilgili testleri ve genel kontrolleri çalıştırın. Paket doğrulanmadan sonraki pakete geçmeyin.

Geçici denetim testleri mevcut bozuk davranışı doğruluyordu. Bu testlerin beklentilerini aynen kalıcı testlere taşımayın. Kalıcı testler rapordaki **Kabul** maddelerini beklemelidir.

## Başlamadan önce — karar ve güvenli test ortamı

Uygulama kodunu değiştirmeden önce şunları kesinleştirin:

1. **B09 için önerilen karar:** Çevrimiçi randevu iki aktif yazıcıyı da kullanabilsin. Projede iki yazıcı, yazıcı bazlı bakım ve takvim yapısı zaten var; bu nedenle çoklu yazıcı desteği mevcut modele daha uyumlu. Kullanıcı farklı bir ürün kararı verirse D2 paketini buna göre değiştirin.
2. **B34 için karar verilmiş sayılır:** Kullanıcının önceki talebine göre yeni hesapların varsayılan yönetim teması da koyu olmalı. Mevcut kullanıcıların açık veya sistem tercihini zorla değiştirmeyin.
3. **E04'ü bug paketlerine karıştırmayın:** Duyuru editörlerinin tüm taslakları görmesi, değiştirilmiş duyurunun yeniden onay istemesi ve başlamış baskının iptali ayrı ürün kararlarıdır.
4. Testlerde gerçek envanteri kullanmayın. SQLite bellek veritabanı, sahte dosya sistemi ve sahte e-posta kullanın. Toplu silme tarayıcı testinde DELETE isteğini engelleyin veya yalnız geçici veritabanında çalıştırın.

## A — Yetki ve kritik işlem güvenliği

Bu bölüm diğer bütün yönetim testlerinden önce tamamlanmalı. B01 düzelmeden daha sonraki izin testlerinin sonucu güvenilir değildir.

### A1 — Tek yetki kaynağına geçiş

**Bulgular:** B01  
**Risk:** Kritik  
**Önerilen commit:** `fix(auth): legacy admin yetki atlamasını kaldır`

Uygulama sırası:

1. `users.role = admin` olan eski hesapları korunan Sistem Yöneticisi rolüne bağlayan güvenli veri geçişini hazırlayın.
2. Yetki kontrolünü `User` üzerinde tek bir yöntemde merkezileştirin. Middleware, controller, Inertia paylaşımları ve giriş sonrası yönlendirme aynı kaynağı kullansın.
3. Kod tabanındaki bütün `role === 'admin'` kestirmelerini tarayın. Raporda en az 20 doğrudan kullanım bulundu; yalnız bir middleware'i değiştirmek yeterli değildir.
4. `system.admin` ile normal izin kontrolünü birbirine karıştırmayın. Sistem yöneticisine özel kalıcı silme işlemleri ayrı denetimini korusun.
5. Eski `role` sütununu aynı commit'te düşürmeyin. Önce geçiş ve uyumluluk testi; gereksiz sütun temizliği ayrı migration olmalı.

Zorunlu testler:

- Sistem rolünden çıkarılan eski `admin` hesabı GET/POST/PUT/DELETE izinlerini kaybeder.
- Son aktif Sistem Yöneticisi pasifleştirilemez veya rolden çıkarılamaz.
- Sistem Yöneticisi bütün izinleri kullanmaya devam eder.
- Sınırlı rol yalnız atanmış izinleri kullanır.
- Açık oturumda rol değişikliği bir sonraki istekte uygulanır.

### A2 — Duyuru hedefleme sınırı

**Bulgular:** B02  
**Risk:** Kritik  
**Önerilen commit:** `fix(announcements): hedef rol dışına içerik sızmasını engelle`

Okuyucu listesi ile duyuru yöneticisi listesini ayrı sorgu kapsamları olarak tanımlayın. Sıradan `staff_announcements.view` yetkisi, hedeflenmeyen duyurunun başlığını veya gövdesini Inertia props içinde almamalı. Sistem yöneticisi ve gerçekten düzenleme yetkisi olan personelin kapsamını açıkça test edin. Yalnız React tarafında filtre eklemeyin.

Zorunlu testler:

- Hedef A rolü duyuruyu görür ve onaylayabilir.
- Hedef olmayan B rolünün yanıtında içerik hiçbir prop altında bulunmaz.
- Genel personel duyurusu bütün yetkili personelde görünür.
- Kamu duyurusu ile personel duyurusu izinleri birbirini aşmaz.
- Sistem yöneticisinin yönetim görünümü korunur.

### A3 — Ortak, güvenli onay penceresi

**Bulgular:** B04, B32  
**Risk:** Kritik  
**Önerilen commit:** `fix(ui): yıkıcı işlemler için güvenli onay diyaloğu ekle`

Önce ortak bir onay dialog bileşeni oluşturun; ardından toplu malzeme silme, tekil silme ve CSV onayını buna taşıyın. İkinci aşamadaki onay düğmesi ilk düğmeyle aynı koordinatta anında tıklanabilir hâle gelmemeli. Kısa bekleme tek başına güvenlik çözümü sayılmaz; ikinci aşama ayrı ve bilinçli etkileşim gerektirmeli.

Dialog şu davranışların tamamını sağlamalı:

- Odak pencere içinde kalır ve kapanınca açan elemana döner.
- Escape ve arka plan tıklaması işlem başlamadan önce tutarlı çalışır.
- İşlem başladıktan sonra tekrar gönderim ve yanıltıcı kapanma engellenir.
- Çift tıklama, çift dokunma ve basılı Enter tek onayla silme başlatmaz.
- `aria-labelledby`, `aria-describedby` ve görünür odak işareti vardır.
- Sunucudaki ana yönetici ve onay metni kontrolleri korunur.

### A4 — Kullanıcı hesabı doğrulaması ve hata görünürlüğü

**Bulgular:** B20 ve B21'in kullanıcı/rol yönetimi kısmı  
**Risk:** Yüksek  
**Önerilen commit:** `fix(access): kullanıcı doğrulama hatalarını güvenli göster`

E-postayı doğrulamadan önce trim ve küçük harf kuralıyla normalize edin. Oluşturma ve düzenlemede aynı kural kullanılsın. Ardından kullanıcı/rol kartlarının sunucu hatalarını doğru kart içinde göstermesini sağlayın. Son yönetici koruması, rol zorunluluğu, zayıf parola ve tekrar e-posta kullanıcıya görünmelidir.

Zorunlu testler:

- `duplicate@example.test` varken büyük harfli eşdeğeri alan hatası verir; 500 oluşmaz.
- Aynı kullanıcının e-postasında yalnız harf büyüklüğü değişikliği güncellemeyi bozmaz.
- Rol seçilmeden oluşturma reddedilir ve hata görünür.
- Bir kartın hatası diğer kullanıcı veya rol kartında görünmez.
- Başarılı parola değişiminden sonra parola alanı temizlenir.

## B — Envanter ve teslim veri bütünlüğü

### B1 — Malzeme türü değişikliği ve kullanılabilir miktar

**Bulgular:** B05, B11  
**Risk:** Kritik  
**Önerilen commit:** `fix(inventory): aktif teslimlerde tür ve müsait miktarı koru`

Önce iş kuralını uygulayın: aktif teslimi olan malzemenin türü değiştirilemesin. Ardından demirbaş için fiziksel toplam ile kullanılabilir miktarı ortak bir hesapta ayırın. Kamu kataloğu, stok filtresi ve yeni teslim formu aynı hesaplamayı kullanmalı.

Zorunlu testler:

- Aktif demirbaş/ödünç işlemi varken tür değişikliği alan hatası verir.
- Bütün demirbaşlar kullanımdayken katalog “stokta” demez ve yeni teslim formu boş miktar sunmaz.
- Kısmi iade kullanılabilir miktarı doğru artırır.
- Hasarlı/kayıp kapatma fiziksel toplamı doğru etkiler.
- Sarf ve ödünç stok davranışı değişmez.

### B2 — Pasif malzemenin yönetilebilir kalması

**Bulgular:** B12  
**Risk:** Yüksek  
**Önerilen commit:** `fix(inventory): pasif malzemeleri yönetim filtrelerine ekle`

“Pasif” veya açıkça “Tümü” filtresi ekleyin. Aktiflik ve arşiv durumunu ayrı kavramlar olarak koruyun. Özet sayaçları, arama, sıralama ve sayfalama yeni filtre tanımıyla uyumlu olmalı.

### B3 — Filament durumunun eski form verisiyle ezilmesi

**Bulgular:** B22 ve B21'in filament/yazıcı kartları kısmı  
**Risk:** Yüksek  
**Önerilen commit:** `fix(filaments): kullanılabilirlik ve teknik form durumunu ayır`

Teknik bilgi kaydı kullanılabilirlik alanını eski React state'inden geri göndermesin. Tür kapatma/açma işleminden sonra kartların görünür durumu sunucu verisiyle eşitlensin. Form doğrulama hataları ilgili filament veya yazıcı kartında gösterilsin.

Zorunlu tarayıcı akışı:

1. PLA'yı kapatın.
2. Sayfayı yenilemeden bir PLA kartının teknik bilgisini kaydedin.
3. PLA kapalı kalmalı; bütün kart rozetleri bunu yansıtmalı.
4. Geçersiz sıcaklık veya boş malzeme adı hata göstermeli.

## C — CSV içe/dışa aktarma

CSV sorunlarını tek tek yamamak yerine veri sözleşmesi, okuyucu ve arayüz olarak üç küçük pakette çözün. B03 tamamlanmadan CSV'yi yedek/geri yükleme aracı gibi tanıtmayın.

### C1 — CSV veri sözleşmesi ve katı doğrulama

**Bulgular:** B03, B14, B15, B16, B18  
**Risk:** Kritik  
**Önerilen commit:** `fix(csv): kayıpsız ve doğrulanan aktarım sözleşmesi kur`

Uygulama sırası:

1. Export başlıkları ve değerleri için tek sözlük tanımlayın; import aynı sözlüğü kullansın.
2. Tür, görünürlük, aktiflik ve desteklenen konum alanlarında bilinmeyen değerleri sessiz varsayılana çevirmeyin.
3. UTF-8/BOM doğrulamasını dosya oturuma alınmadan yapın; desteklenmeyen kodlamayı anlaşılır hatayla reddedin veya açıkça dönüştürün.
4. Boş/tekrarlı başlık, eksik/fazla hücre ve bozuk satır yapısını satır numarasıyla reddedin.
5. Miktar hassasiyetini stok servisiyle aynı yapın. Kullanıcı verisi hiçbir durumda 500 üretmesin.
6. Tekrar anahtarını dosya içi ve veritabanı için aynı kuralla uygulayın. Aynı ad/farklı SKU iş kuralını testte açıkça belgeleyin.

Zorunlu test matrisi:

- Gerçek export → import: sarf, ödünç, demirbaş × kesin, durum, gizli × aktif, pasif.
- UTF-8, UTF-8 BOM, Windows-1254.
- 0, 0.0001, 0.001, ondalık virgül, aşırı büyük sayı ve sayısal olmayan miktar.
- Eksik/fazla hücre, boş başlık, tekrarlı başlık, tırnak içi ayraç ve çok satırlı açıklama.
- Aynı SKU, aynı ad ve büyük/küçük harf/Türkçe karakter tekrarları.

### C2 — Satır sınırı ve eksiksiz hata raporu

**Bulgular:** B13, B19  
**Risk:** Yüksek  
**Önerilen commit:** `fix(csv): satır sınırı ve tüm hataları görünür yap`

2000 satır sınırı aşılırsa dosyayı açıkça reddedin veya kuyruklu/bölümlü aktarım tasarlayın. Sessiz kesme yapmayın. Ön izleme ilk 100 satırla sınırlı kalabilir; fakat bütün hataların satır numarası ve nedeni ayrı listede veya indirilebilir hata raporunda erişilebilir olmalı.

Sınır testleri: 1999, 2000 ve 2001 veri satırı; 101. ve son satırda hata.

### C3 — Aktarım sonrası yetkiye uygun hedef

**Bulgular:** B17  
**Risk:** Orta  
**Önerilen commit:** `fix(csv): aktarım sonrası yetkili hedefe yönlendir`

Yalnız `inventory.import` yetkisi olan kullanıcı başarılı işlemden sonra erişebildiği bir sonuç ekranında kalmalı. “Envantere dön” bağlantısı da izinle koşullandırılmalı. Çözüm olarak kullanıcıya otomatik `inventory.view` yetkisi vermeyin.

## D — Randevu ve yazıcı planlama

Bu bölümde tek bir ortak zaman/müsaitlik tanımı oluşturun. B06, B07 ve B08'i ayrı controller yamalarıyla çözmek ileride tekrar ayrışmaya yol açar.

### D1 — Ortak zaman ve çakışma motoru

**Bulgular:** B10, B06, B08  
**Risk:** Kritik  
**Önerilen commit:** `fix(schedule): ortak slot ve çakışma kuralları kullan`

Uygulama sırası:

1. Slot hizasını günün `00` dakikasına göre değil çalışma gününün açılışına göre tanımlayın veya ayar kaydında uyumsuz saati reddedin.
2. Bloke etmeyen durumdan bloke eden randevu durumuna geçişte yazıcı, bakım ve diğer randevuları aynı transaction/kilit altında yeniden kontrol edin.
3. Bakım/kapalı zaman eklerken onaylı ve aktif randevularla çakışmayı iş kuralına göre engelleyin veya açık bir yönetici çözüm akışı oluşturun.
4. Yönetim takviminde randevularla bakım/kapalı zamanları birlikte gösterin.

Zorunlu testler:

- 09.00 ve 09.15 açılışta 15/30/60 dakikalık adımlar.
- Sınırda bitiş, gün aşan baskı, global bakım ve yazıcıya özel bakım.
- `failed → ready` dönüşü boş zamanda başarılı, dolu zamanda reddedilir.
- Bakım kaydı boş zamanda başarılı, onaylı randevuda belirlenen politika uygulanır.

### D2 — Çoklu yazıcı randevu ataması

**Bulgular:** B09  
**Risk:** Yüksek  
**Önerilen commit:** `feat(booking): müsait yazıcıyı randevu boyunca tutarlı seç`

Önerilen davranış: Kullanıcı uygun yazıcıyı seçsin veya sistem yazıcıyı açık biçimde atasın; müsaitlik yanıtında kullanılan yazıcı kimliği randevu gönderiminde korunup yeniden doğrulansın. “İlk aktif yazıcı” sorgusuna güvenmeyin. İstemciden gelen kimliği sunucu kontrolü olmadan kabul etmeyin.

İki yazıcının boş/dolu, bakımda ve eşzamanlı rezervasyon kombinasyonlarını test edin. Ürün tek yazıcı kararı verirse bu paket, ikinci aktif yazıcının çevrimiçi randevuya kapalı olduğunun ayarda açıkça belirtilmesine dönüştürülmeli.

### D3 — Kamu yazıcı durumu ve takvim

**Bulgular:** B07  
**Bağımlılık:** D1 ve D2  
**Risk:** Kritik  
**Önerilen commit:** `fix(printers): kamu durumunu gerçek planlamadan üret`

Ana sayfa ve `/3d-yazicilar`, D1/D2'deki ortak müsaitlik kaynağını kullanmalı. Kişisel veri yayınlamadan yazıcının o anda baskıda/dolu olduğu ve yedi günlük zaman blokları gösterilmeli. Randevu özelliği kapalıyken elle girilmiş takvim kayıtları çalışmaya devam etmeli.

### D4 — Süresi dolan doğrulama kayıtları

**Bulgular:** B24  
**Risk:** Orta  
**Önerilen commit:** `fix(booking): doğrulama süresi dolan kayıtları sonlandır`

Süresi dolan kayıtları idempotent bir komut/görevle `expired` durumuna taşıyın veya bütün görünüm ve sorgularda tutarlı türetilmiş durum kullanın. Planlı görev seçilirse scheduler kurulumunu E02 yayın kontrolünde doğrulayın.

### D5 — Randevu formu ve doğrulama dili

**Bulgular:** B23, B25  
**Risk:** Orta  
**Önerilen commit:** `fix(booking-ui): dosya durumu ve doğrulama metinlerini düzelt`

Reddedilen dosya seçiminden sonra input, görünen dosya ve gönderilen FormData aynı kalmalı. Geçerli doğrulama bağlantısının ilk ekranı “başarısız” dememeli; bekliyor, başarılı ve süresi dolmuş durumları ayrı başlıklar kullanmalı.

## E — Tema altyapısı ve koyu tema

Tema paketini responsive düzenlemelerden önce yapın; aksi hâlde mobil ekran görüntüleri yanlış renk katmanıyla tekrar test edilir.

### E1 — Rota değişiminde tema yaşam döngüsü ve varsayılan tema

**Bulgular:** B31, B34  
**Risk:** Orta  
**Önerilen commit:** `fix(theme): rota değişiminde tema kapsamını koru`

Tema bileşeninin kamu/yönetim ayrımını yalnız uygulama ilk açılışında hesaplamayın. Giriş→ana sayfa, çıkış→ana sayfa, geri/ileri ve doğrudan URL açılışları aynı sonucu vermeli. Tercihi olmayan yeni yönetim hesabının varsayılanı koyu olsun; mevcut açık/sistem tercihleri korunsun.

### E2 — CSS tema kapsamı ve kontrast

**Bulgular:** B28, B29, B30  
**Bağımlılık:** E1  
**Risk:** Orta  
**Önerilen commit:** `fix(theme): koyu tema seçicilerini ve kontrastı düzelt`

`theme-dark` ile `admin-page` aynı kök elemanda olduğundan seçicileri gerçek DOM'a göre düzeltin. Ardından yönetim başlıkları, pasif menü bağlantıları, durum düğmeleri, uyarılar, autofill ve kamu duyurularını renk tokenlarıyla ele alın. Eski açık tema kurallarını tek tek `!important` ile bastırmayın.

Doğrulama matrisi: açık, koyu, sistem-açık ve sistem-koyu; duyuru türleri; filament/yazıcı durumları; KVKK notu; form autofill. Metin kontrastı normal metinde en az 4.5:1 olmalı.

## F — Mobil kullanım ve erişilebilirlik

### F1 — Mobil kamu navigasyonu

**Bulgular:** B26  
**Risk:** Orta  
**Önerilen commit:** `fix(nav): mobil kamu menüsünü erişilebilir yap`

Logo dışında bütün kamu hedeflerine mobil menüden erişim sağlayın. Açma düğümü `aria-expanded`/`aria-controls` kullansın; Escape, dış tıklama, bağlantı seçimi, odak iadesi ve body scroll davranışlarını test edin.

### F2 — 3D yazıcı sayfası yatay taşması

**Bulgular:** B27  
**Bağımlılık:** F1 ve E2 sonrası görsel kontrol  
**Risk:** Orta  
**Önerilen commit:** `fix(printers-ui): mobil yatay sayfa taşmasını kaldır`

Grid/flex çocuklarına doğru `min-width: 0` ve sınırlı iç kaydırma alanları uygulayın. Yedi günlük takvim yatay kayabilir; belgenin kendisi viewport'u aşmamalı. İçeriği `overflow-x: hidden` ile kesmeyin.

Kontrol genişlikleri: 320, 390, 768, 1024 ve 1440 px; ayrıca %200 yakınlaştırma.

### F3 — Form etiketi ve klavye takvimi

**Bulgular:** B35  
**Risk:** Orta  
**Önerilen commit:** `fix(a11y): filtre ve kaydırılabilir takvimi adlandır`

Randevu durum filtresine görünür label veya eşdeğer programatik ad ekleyin. Yatay yönetim takvimi klavyeden odaklanıp kaydırılabilsin; görünür odak işareti ve anlamlı erişilebilir adı olsun. Axe kontrolüne ek olarak Tab ve ok tuşlarıyla manuel kontrol yapın.

## G — Dil ve denetim kaydı

### G1 — İşlem geçmişi çevirileri

**Bulgular:** B33  
**Risk:** Düşük  
**Önerilen commit:** `fix(audit): işlem geçmişi etiketlerini Türkçeleştir`

Action, subject ve field etiketlerini merkezi sözlükte tamamlayın. En az `read`, `permissions`, `target_roles`, `staff_announcement` ve `table_preferences` ele alınmalı. Bilinmeyen değer için anlaşılır Türkçe fallback kullanın; hassas değerleri loglamayın.

## H — Canlıya çıkmadan önce tamamlanacaklar

Bu bölüm normal hata paketlerinden sonra, çevrimiçi randevuyu üretimde açmadan önce zorunludur.

### H1 — Veri saklama işinin gerçekten uygulanması

**Başlık:** E01  
**Önerilen commit:** `feat(privacy): randevu ve dosya saklama sürelerini uygula`

Randevu kaydı ve model dosyası saklama ayarlarını işleten idempotent komut, istisna politikası, işlem günlüğü ve testler ekleyin. Kamu metninde yazan sürelerle gerçek görev aynı kaynaktan beslenmeli.

### H2 — Üretime benzer kabul testi

**Başlık:** E02  

MySQL/MariaDB üzerinde migration, collation ve kilit davranışını; gerçek SMTP üzerinde teslimat ile SPF/DKIM'i; cPanel üzerinde scheduler/cron, PHP yükleme sınırı, depolama izinleri ve public storage bağlantısını doğrulayın. Bu kontrol kod commit'inden çok yayın kontrol listesidir.

### H3 — Kapsam dışı geliştirmeleri ayrı bırakma

**Başlıklar:** E03, E04

XLSX, teslim geri alma, duyuru yeniden onay politikası ve aktif baskı iptali bu hata serisine eklenmemeli. Ayrı ürün kararı ve ayrı kabul ölçütleriyle planlanmalı.

## Özet yürütme sırası

| Sıra | Paket | Bulgular | Kapı |
|---:|---|---|---|
| 1 | A1 Yetki kaynağı | B01 | Tüm izin testleri geçmeli |
| 2 | A2 Duyuru sınırı | B02 | Hedef dışı içerik response içinde bulunmamalı |
| 3 | A3 Güvenli dialog | B04, B32 | Çift tıklama silmemeli; odak kaçmamalı |
| 4 | A4 Hesap doğrulama | B20, B21/erişim | Tekrar e-posta 500 üretmemeli |
| 5 | B1 Stok bütünlüğü | B05, B11 | Aynı fiziksel birim iki kez verilememeli |
| 6 | B2 Pasif filtre | B12 | Pasif malzeme yeniden yönetilebilmeli |
| 7 | B3 Filament state | B22, B21/ayarlar | Teknik kayıt kullanılabilirliği değiştirmemeli |
| 8 | C1 CSV sözleşmesi | B03, B14–B16, B18 | Export→import değerleri korumalı |
| 9 | C2 CSV ölçek/rapor | B13, B19 | Sessiz kayıp olmamalı |
| 10 | C3 CSV yönlendirme | B17 | Başarılı aktarım 403'e gitmemeli |
| 11 | D1 Planlama çekirdeği | B06, B08, B10 | Bütün çakışma testleri geçmeli |
| 12 | D2 Çoklu yazıcı | B09 | Gösterilen slot ile kaydedilen yazıcı aynı olmalı |
| 13 | D3 Kamu durumu | B07 | Aktif baskı “boş” görünmemeli |
| 14 | D4 Süre aşımı | B24 | Eski bekleyen kayıtlar düzenli sonlanmalı |
| 15 | D5 Randevu arayüzü | B23, B25 | Dosya ve doğrulama durumu doğru görünmeli |
| 16 | E1 Tema yaşam döngüsü | B31, B34 | SPA geçişi ve varsayılan koyu çalışmalı |
| 17 | E2 Tema CSS | B28–B30 | Tema matrisi ve kontrast geçmeli |
| 18 | F1 Mobil menü | B26 | Mobilde tüm sayfalara erişilmeli |
| 19 | F2 Mobil taşma | B27 | Belge genişliği viewport'u aşmamalı |
| 20 | F3 Erişilebilirlik | B35 | Axe + klavye kontrolü geçmeli |
| 21 | G1 Türkçeleştirme | B33 | Yeni audit anahtarları Türkçe görünmeli |
| 22 | H1/H2 Canlı hazırlık | E01, E02 | Randevu özelliği bundan sonra açılmalı |

## Her paket için bitiş ölçütü

Paket tamamlandı denmeden önce:

1. Bulguyu doğru davranışla yakalayan kalıcı test eklenmiş olmalı.
2. Pakete özel testler geçmeli.
3. Tam `php artisan test`, `npm exec tsc -- --noEmit`, `npm run build` ve `vendor/bin/pint --test` geçmeli.
4. Arayüz değiştiyse masaüstü ve 390 px tarayıcı kontrolü yapılmalı; tema değiştiyse açık/koyu/sistem matrisi çalıştırılmalı.
5. Yetki değiştiyse izin verilen ve reddedilen istekler sunucu seviyesinde test edilmeli.
6. Veri modeli değiştiyse mevcut veriler için migration/geri dönüş etkisi açıklanmalı.
7. Commit yalnız ilgili paketi içermeli; bir sonraki paketin hazırlık kodu aynı commit'e eklenmemeli.

## Düşük modele verilecek görev biçimi

Her seferinde yalnız tek paket verin. Örnek:

> `BUGBOT_RAPORU_2026-10-27.md` ve `BUGBOT_DUZELTME_SIRASI_2026-10-27.md` dosyalarını oku. Yalnız **A1 — Tek yetki kaynağına geçiş** paketini uygula. Önce doğru davranışı bekleyen regresyon testlerini ekle, sonra düzelt. Pakette belirtilmeyen bulgulara dokunma. İlgili testlerle birlikte tam PHP testlerini, TypeScript, Vite build ve Pint kontrolünü çalıştır. Değişen dosyaları, test sonuçlarını ve kalan riski raporla; commit veya push yapma.

Bir paket büyük gelirse aynı paket içindeki uygulama sırasını bozmayacak küçük commitlere bölünebilir. Aynı controller veya ortak bileşeni değiştiren paketleri eşzamanlı farklı modellere vermeyin.
