# Sparkoff V2 — yeni ürün ve geçiş yol haritası

**Karar tarihi:** 9 Kasım 2026  
**Durum:** Çalışma planı; V1 canlı sistem korunur.  
**Hedef ortam:** Satın alınan 3 GB RAM'li Ubuntu VDS. cPanel dağıtımı yapılmayacak.

## Hedef ve sıralama kararı

1. V2, V1'in bugün çalışan davranışlarıyla **işlevsel eşitliğe** ulaşır. V1 [ROADMAP.md](../ROADMAP.md) içindeki işaretler V2 için tamamlanma kanıtı değildir.
2. V1'de zaten açık kalmış ürün ve güvenlik işleri V2 üzerinde tamamlanır.
3. V2'ye özgü görev, sohbet, etkinlik, bildirim ve büyük dosya özellikleri bundan sonra genişletilir.
4. V1 verisi ayrı ve salt okunur kopyadan kanıtlı biçimde taşınır. Yayın kararı; Ubuntu VDS, gerçek SMTP, yedek geri yükleme ve yetki kabulünden sonra verilir.

Her aşama için API, arayüz, yetki, gerçek SQL, mobil/masaüstü ve başarısızlık yolları birlikte kapanır. Sadece şema, derleme veya örnek mod görüntüsü tamamlanma sayılmaz. Açık kritik hata varken sonraki yayın kapısı geçilmez.

## Aşama 0 — kaynak fotoğrafı ve eşleme sözleşmesi

- [ ] V1'in mevcut kodunu, yerel SQLite kopyasını, canlı SQL/dosya yedeğinin güncel salt okunur kopyasını ve sürümünü sabitle; canlı ile yerel farkları kaydet.
- [ ] V1 ekran, rota, alan, ayar, yetki ve zamanlanmış iş envanterini V2 karşılıklarıyla eşleştir; `tam/kısmi/yok` durumunu kanıtla.
- [ ] V1 çoklu rol davranışını V2'de koruyacak veri modeli ve geçiş kuralını tamamla. Birden fazla birim üyeliği, birden fazla kullanıcı rolünün yerine geçmez.
- [ ] V1 parola özeti algoritmasını incele ve güvenli kullanıcı geçişi stratejisini seç; parola özeti doğrudan uyumsuz oturuma bağlanmaz.
- [ ] V1→V2 kayıt kimliği, tarih, stok bakiyesi, dosya ve kişi verisi eşleme sözleşmesini yaz.

**Kapı:** Hiçbir V1 alanı sessizce düşmez; eşlenmeyen alanın kararı ve verisi belgelenir.

## Aşama 1 — Ubuntu VDS kabul ortamı ve ortak güvenlik temeli

- [ ] Ubuntu'nun nihai LTS sürümünü, gerçek RAM/disk durumunu, Node ve MariaDB/MySQL sürümünü doğrula.
- [ ] V2 için sınırlı kullanıcı, ayrı veritabanı, Nginx/HTTPS, systemd, web kökü dışı kalıcı yükleme dizini, log ve sır yönetimini kur; bu aşamada canlı DNS geçişi yapma.
- [ ] Temiz migration/bootstrap ve yeniden başlatma; oturum, CSRF, rol/sekme kapıları, HTTPS ve dosya izinleri kabulünü çalıştır.
- [ ] Yedekleme ve **geri yükleme provasını** otomatikleştir; V1 yedeği ve V2 kabul yedeği ayrı tutulur.
- [ ] VDS'deki 3 GB bellek altında gerçek örnek yük ve video akışının kaynak tüketimini ölç.

**Kapı:** VDS'deki test ortamı yeniden kurulabilir, yedekten dönebilir ve V1'i etkilemez.

## Aşama 2 — envanter ve teslim/iade eşitliği

- [ ] Malzeme oluşturma, düzenleme, aktif/pasif, arşivleme, tür değişikliği kısıtları ve kayıt geçmişini tamamla.
- [ ] Kategori, konum, düşük/tükenen stok, arama/filtre/sıralama, ayrıntı ve toplu işlem ekranlarını taşı.
- [ ] Stok hareketlerinin tüm türleri, ters kayıt, güvenli kısa geri alma, yarış/tekrar isteği ve audit bağlarını tamamla.
- [ ] Sarf teslimi, ödünç, demirbaş/yerinde kullanım, tam/kısmi iade, hasar/kayıp, gecikme, kişi alanı yetkisi ve anonimleştirmeyi V1 senaryolarıyla karşılaştır.
- [ ] CSV ve XLSX içe/dışa aktarım, sütun eşleme, önizleme, tekrar/çakışma, atomiklik ve formül güvenliğini tamamla.
- [ ] Fotoğraf/video/HTTPS bağlantısı, kapak/galeri, medya sıralama, bozuk dosya ve erişim yetkisini tüm ekranlarda tamamla.

**Kapı:** V1 envanter senaryoları V2'de aynı sonuçları üretir; V1 kopyası ile stok bakiyesi ve hareket sırası karşılaştırılır.

## Aşama 3 — yazıcı, filament, takvim ve randevu eşitliği

- [ ] V1 yazıcı/filament alanlarını, sıralama/durum/teknik bilgi ve yönetim akışlarını tamamla.
- [ ] Çalışma saatleri, bakım/kapalı zaman, yedi günlük müsaitlik, saat dilimi ve çakışma hesabını taşı.
- [ ] Randevu başvurusu, model dosyası, filament seçimi, KVKK onayı, doğrulama/takip/iptal ve yönetici durum geçmişini taşı.
- [ ] Aynı slotu isteyen iki gerçek eşzamanlı isteğin tek rezervasyonla sonuçlandığını doğrula.
- [ ] Gerçek SMTP, SPF/DKIM, teslimat/başarısızlık, zamanlayıcı ve özel dosya yetkilerini kabul et. Bayrak kabul bitene kadar kapalı kalır.

**Kapı:** V1 randevu yolculuğu V2'de ve gerçek VDS'de uçtan uca geçer; güvenli olmayan özellik açılmaz.

## Aşama 4 — hesap, yönetim, içerik ve ziyaretçi eşitliği

- [ ] Çoklu rol/izin, kullanıcı oluşturma-düzenleme-pasifleştirme, parola sıfırlama, son yönetici koruması, birim/üyelik yönetimi ve tüm rol matrisi.
- [ ] Kişisel ayarlar, tema/ölçek/yoğunluk, sütun/filtre, kaydedilmemiş değişiklik uyarısı ve güvenli taslaklar.
- [ ] Duyuru hedefleme, düzenleme/arşivleme, önem/süre/sabitleme/okundu; etkinlik ve yönetim bildirimlerini V1 düzeyine getir.
- [ ] Geri bildirim bot/hız koruması, görsel, yönetim talepleri, not/durum/arşiv; KVKK ve iletişim/çalışma saati ayarları.
- [ ] Ziyaretçi kataloğu arama/filtre/sıralama/favori/ayrıntı; yönetim genel bakış ve arama; audit, geri alma ve sistem ayarları.
- [ ] Spero tasarımının bütün sayfalarda tutarlılığı, mobil/masaüstü, klavye, ekran okuyucu, kontrast ve boş/hata durumları.

**Kapı:** V1'de çalışan her görünür kullanıcı yolu V2'de rol ve tarayıcı kabulünden geçer.

## Aşama 5 — veri taşıma provası

- [ ] V1 canlı kopyasından V2'ye tekrarlanabilir, denetlenebilir dönüşüm aracını çalıştır; kaynak V1'e yazma.
- [ ] Kullanıcı/rol, yazıcı/filament, kategori/konum, malzeme/hareket/teslim, medya, duyuru/geri bildirim ve randevu kayıtlarını bağımlılık sırasıyla taşı.
- [ ] Kimlik eşlemesi, kayıt sayısı, stok toplamı, tarih/sıra, anonimleştirme durumu ve dosya SHA-256 sonuçlarını karşılaştır.
- [ ] Aktarım başarısızlığında V2 kabul verisini temizleyip aynı kaynaktan yeniden kur; fark varsa yayını durdur.

**Kapı:** Veri farkı sıfır veya her fark için onaylı dönüşüm kuralı var; gerçek kullanıcı hesabı güvenli biçimde açılabiliyor.

## Aşama 6 — V1 açık işlerini kapatma ve canlı kabul

- [ ] V1 [ROADMAP.md](../ROADMAP.md) içindeki 11 açık maddenin V2 karşılığını kapat; cPanel maddelerini Ubuntu VDS/systemd/Nginx biçimine çevir.
- [ ] 97 rota için girişsiz/izinli/yasak, hatalı girdi ve yan etki matrisi; 390 manuel arayüz maddesi için V2'ye uyarlanmış kanıtlı kabul listesi oluştur ve çalıştır.
- [ ] Güvenlik, dosya erişimi, mobil/masaüstü, ekran okuyucu, SMTP, zamanlayıcı, gerçek SQL yarışı, yedek geri yükleme ve performans kabulünü tamamla.
- [ ] V1 geri dönüş planını ve DNS kesme planını prova et. Canlı yayın için ayrıca karar al.

**Kapı:** Kritik açık hata yok; gerçek VDS kabulü ve geri dönüş provası kayıtlı.

## Aşama 7 — V2'ye özgü genişletmeler

- [ ] **Stok kodu ve karekod etiketi paketi:** Aşağıdaki kapsamı V1 eşitliği ve temel yayın kabulünden sonra ayrı iş paketi olarak uygula. Bu madde yalnız planlandı; kodlanmadı.
- [ ] Görev adımları/kanıtları, atama/hatırlatma, şablon/Kanban ve indirme.
- [ ] Birim/oda sohbeti dosya/video, yanıt, okundu, sabitleme, anket, @etiket ve moderasyon.
- [ ] Etkinlik/RSVP, bildirim, Web Push/iOS PWA ve e-posta kota yönetimi.
- [ ] Büyük parçalı dosya aktarımı, kota, kesinti sonrası devam ve kaynak tüketimi kabulü.

Bu aşama, mevcut V2 temel kodunun üstüne gelir; V1 eşitliği ve güvenli yayın kapıları atlanmaz.

### Planlanan stok kodu ve karekod etiketi paketi — henüz uygulanmadı

- [ ] Her atölye malzemesine zorunlu, benzersiz ve insan tarafından okunabilir stok kodu ata; mevcut boş kodları çakışma raporu ve kontrollü toplu tamamlama ile doldur. Kod biçimi ve otomatik üretim kuralını yönetimden belirle; elle girme, değiştirme ve önceki kodla arama davranışını tanımla. Kullanılmış kodu başka ürüne sessizce yeniden verme.
- [ ] Ürün türüne göre **malzeme kodu** ile **tekil fiziksel parça kodu** ayrımını karara bağla: aynı malzemeden birden çok ödünç verilebilir parça veya demirbaş varsa her parça ayrı izlenebilsin; sarf malzemesinde kutu/parti etiketi ve miktar girişi ayrı ele alınsın. Mevcut stok ve teslim kayıtları kaybolmadan geçiş yap.
- [ ] Yönetimde tekli/toplu kod ve karekod üretme, arama, görüntüleme, yeniden basma, etiket devre dışı bırakma ve gerekçeli yeniden atama ekranları yap. Stok hareketi veya teslim geçmişi olan kayıtları kalıcı silme; arşivleme ve denetlenebilir kod değişikliği kullan.
- [ ] İnsan tarafından okunabilir kodu ve karekodu birlikte içeren yazdırılabilir etiketler üret; farklı sticker boyutları ile uygun yüzeye lazer kazıma için dışa aktarım sun. Basımda yazı okunabilirliği, yüzey boyutu, hasarlı etiketin yeniden basılması ve fiziksel etiketin doğru ürünle eşleştirilmesi için kabul adımı ekle.
- [ ] Karekoddan oturum gerektiren sabit bir ürün/parça adresi aç. Karekodun içinde kişi bilgisi, oturum anahtarı veya işlemi tek başına yetkilendiren sır bulunmasın. Telefon kamerası ve harici okuyucu için tarama ile kodu elle yazma yolu sun.
- [ ] Çalışanın tarama sonrası doğru ürün/parçayı ve stok durumunu görüp yetkisine göre teslim, iade ve stok hareketini miktar, alıcı, beklenen iade ve onay adımlarıyla kaydetmesini sağla. Yinelenen tarama/istek, eşzamanlı teslim, yanlış etiket ve çevrimdışı bağlantı hatasını güvenli biçimde ele al; işlem geçmişini kullanıcı ve kodla ilişkilendir.
- [ ] Kod üretimi/değişimi/silme ve taramayla teslim için ayrı rol izinleri, denetim kaydı ve mobil/masaüstü kabulü ekle. Çoklu fiziksel parça, sarf miktarı, eski kod yönlendirmesi, hasarlı etiket, yetkisiz tarama ve veri taşıma senaryolarını test et.

## Çalışma kaydı

### 24 Kasım 2026 — kamu kataloğu sorgusunun sayfalanması

- V2 için ayrı GitHub Actions kabulü eklendi: Node 24 üzerinde `npm ci`, 32 birim testi ve TypeScript/ön yüz/sunucu derlemesi; ayrı MariaDB 10.11 işinde temiz migration ve ikinci çalıştırmada idempotent migration kontrolü. [45390761071 numaralı uzak çalışma](https://github.com/MaliWhiteTea/Sparkoff/actions/runs/45390761071) iki işte de başarılı. Bunlar yerel geniş SQL kabulünün veya VDS testinin yerini tutmaz.
- `/api/public/materials/search` artık görünür malzemeleri ve açık demirbaş teslimlerinin kullanılabilir stok hesabını SQL'de filtreliyor; toplam sayıyı ayrı sorguluyor, sıralayıp yalnız istenen 12/24/48 kaydı ve bu sayfanın medyasını uygulamaya alıyor. Kategori seçenekleri görünür, etkin kategori kayıtlarından ayrı üretiliyor. Kategorisi olmayan malzemenin “Diğer” adı aramada da korunuyor.
- Yerel MariaDB'deki 642 görünür kayıt üzerinde eski kamu yanıtıyla ad sırası, güncelleme sırası, stok filtreleri, kategori ve `i/ı/İ` dahil Türkçe arama sonuçları karşılaştırıldı. 21 terimlik ek taramada arama toplamları eşleşti; kesin stok miktarı gösterilen örnekler de aynı kaldı. V2 birim testleri 32/32, üretim derlemesi ve geniş yerel SQL kabulü geçti. SQL kabulüne Türkçe arama ve stok toplamı karşılaştırması eklendi.
- Üye envanteri aynı arama ucundan 24 kayıtlık sayfalar çekiyor. Yönetim genel bakışındaki malzeme sayacı yeni, yetki kontrollü `/api/inventory/count` ucundan yalnız toplam sayıyı alıyor. SQL kabulünde girişsiz/yetkisiz 401/403 ve yetkili sayı eşitliği geçti. Ortak veri yükleme kancası eski sayfa yanıtının yeni sayfayı örtmesini engelliyor ve başarılı tekrar istekte eski hata mesajını temizliyor.
- Yönetim listelerindeki `useLoad` kancası da aynı geç yanıt yarışına karşı korundu; yeni sorgu yoluna geçildiğinde eski sayfanın verisi gösterilmiyor. Üretim derlemesi ve 32/32 birim testi geçti. Bu kancaların gerçek tarayıcı etkileşimi tarayıcı hizmeti kullanılamadığı için bu turda gözlenemedi.
- Sistem yöneticisi koruması, yalnız `globalRole` etiketini değil gerçek `is_system` rol bağını da hesaba katıyor. Profil, pasifleştirme ve parola sıfırlama kısıtları ile son etkin yönetici sayımı buna göre düzeltildi. SQL kabulünde veritabanı etiketi `member` bırakılan fakat sistem rolüne bağlı hesap tam yetkisini korudu; sınırlı yönetici hesabının bu hesabı değiştirme/pasifleştirme/parolasını sıfırlama girişimleri 403, yetkili rol kaldırma akışı 200 geçti. Bu yerel sentetik kabuldür; canlı rol verisi ve eşzamanlı yönetici işlemi kabulü hâlâ açık.
- Eski `/api/public/materials` yanıtı geriye uyumluluk için hâlâ tüm görünür kayıtları alıyor; yönetimin eski `/api/inventory` API'si de kabul senaryoları ve dış istemciler için duruyor. Bu iki uçta açık demirbaş teslimleri ve medya, her malzeme için tekrar taranmak yerine bir kez gruplanıyor; yalnız açık/kısmi teslimler gerekli alanlarıyla okunuyor.
- Yönetim ekranı artık `/api/inventory/search` ile filtre/sıralama/toplam hesabını SQL'de yapıyor ve 24 kayıtlık sayfa alıyor. Form, teslim ve hareket etiketleri için `/api/inventory/options` yalnız kimlik, ad, tür ve durum alanlarını veriyor. Demo modu da aynı sözleşmeyi izliyor. Yerel MariaDB kabulünde eski tam listeyle ilk iki sayfanın kimlik sırası ve kullanılabilir miktarı, düşük/tükenen/arşiv toplamları, girişsiz/yetkisiz 401/403 ve geçersiz sayfa 400 geçti; 32/32 birim testi ve üretim derlemesi geçti. Form seçeneği hâlâ bütün malzemelerin kısa listesini alıyor; çok büyük envanter ve gerçek tarayıcı etkileşimi ayrıca ölçülmeli.
- Yönetim medya kartı `/api/inventory/media/search` üzerinden son eklenen 24 kaydı sayfalıyor. Yönetim medya yanıtlarında sunucudaki dosya yolu artık yayımlanmıyor; SQL kabulü gerçek dosyanın varlığını doğrudan yerel veritabanından doğruluyor. Girişsiz/yetkisiz istekler ve geçersiz sayfa reddediliyor. Gerçek tarayıcıda sayfa gezinmesi henüz gözlenmedi.
- Geri bildirim yönetim listesi ile yönetim malzeme listelerindeki eski tekil görselin disk yolu API yanıtlarından çıkarıldı. Yetkili geri bildirim görseli indirme URL'si korunuyor; yerel SQL kabulünde liste yollarının yokluğu ve görsel içeriğinin yetkili indirilmesi geçti. Etkileşimli tarayıcı hizmeti bu turda kullanılamadı; görsel kabul açık.
- GitHub CI'daki temiz MariaDB migration işine ilk yönetici oluşturma, gerçek API derlemesini başlatma ve korumalı HTTP kabulü eklendi. Yeni kabul girişsiz 401, 25 malzeme oluşturma, liste/seçenek sayısı, 24+1 sayfalama, geçersiz sayfa 400 ve boş medya sonucunu doğruluyor; yalnız `sparkoff_v2_ci` veritabanında çalışacak biçimde korunuyor. [45454541727 numaralı uzak çalışmada](https://github.com/MaliWhiteTea/Sparkoff/actions/runs/45454541727) HTTP kabul adımı ve diğer CI adımları başarılı.

- V2 kamu malzeme kataloğuna V1 arama/kategori/stok/sıralama/12–24–48 sayfa/favori/teknik ayrıntı akışları eklendi. V1 tarayıcı favorileri kaynak malzeme kimliğiyle V2 tarayıcı anahtarına çevrilir. Kategori ve kamusal konum API alanları açıldı; yerel SQL kabulünde gizli konum ve `status` görünürlükte miktar `null` kaldı. Masaüstü ve mobil örnek mod görüntüleri incelendi. Ayrı migration DB üzerinde 171/171 kaynak malzeme kamu API yanıtında kaynak kimliğiyle görüldü; gizli stok miktarı 171/171 `null` kaldı. Katalog artık 12/24/48 kayıtlık sunucu yanıtı ve toplam sayı alıyor; 171 kayıtlı migration DB üzerinde ilk sayfa 12, kaynak favori kimliği eşlemesi doğru çıktı. İlk sürümde filtreleme uygulama belleğindeydi; 24 Kasım değişikliğiyle SQL'e taşındı. Büyük veri/3 GB VDS yükü ve etkileşimli tarayıcı kabulü açık.

### 11 Kasım 2026 — yazıcı, filament, çalışma saati ve ayar veri provası

- `0017_freezing_screwball.sql` üç tabloya benzersiz V1 kaynak kimliği alanı ekledi; yalnız iki yerel V2 veritabanına uygulandı. `stage-v1-printers.mjs` salt okunur yerel V1 kopyasından 2 yazıcı, 4 filament ve 7 çalışma saatini ayrı `sparkoff_v2_migration` veritabanına taşıdı. İlk çalışmada 13 ekleme, tekrarda 0 ekleme/13 eşleşme; değiştirilen kaynak yazıcı adı reddedildi. Kaynak SHA-256 `ef4a13d5cef1d00fdd8707097f0d068a624d82c65cfe6713c2d54c12b3411f73`.
- `stage-v1-settings.mjs` aynı kaynaktaki 12 ayar anahtarını V2 JSON değerleri ve UTC zamanı ile taşıdı; 12/12 eşlendi, atlanan anahtar yok, tekrarda 0 ekleme/12 eşleşme. V1 `settings.id`, `group`, `created_at` V2 çalışma ayarı şemasında tutulmuyor; nihai geçiş raporunda kaynak meta verisi olarak belgelenmeli. Canlı kaynaktaki ek anahtarlar araç tarafından raporlanır ve uygulama durur.
- `npm test` 30/30, `npm run build` başarılı. Bu yerel veri provasıdır; canlı yedek, VDS ve gerçek tarayıcı kabulü açık.
- V2 doğumlu rolü olmayan `member/lead/advisor` hesaplarının örtük izin ve sekmeleri kaldırıldı; genel sohbet erişimindeki `member` etiketi istisnası da kaldırıldı. Yalnız gerçek `is_system` rolü veya rol bağı olmayan yerleşik bootstrap `super_admin` tüm yetkilere sahiptir. `0018_greedy_mikhail_rasputin.sql` aktivasyon koduna özel rol bağı ekledi; yeni kod için sistem dışı rol seçimi zorunlu, etkinleşmede kullanıcı ve rol aynı işlemde oluşturuluyor. Yerel SQL kabulünde rolü olmayan `member` ve `lead` için boş izin/sekme, kodla rol atama, mevcut çoklu rol ve 200/403 akışları geçti. Eski rol bağı olmayan kullanılmamış kodlar güvenli biçimde reddedilir.
- Birim oluşturma ve üyelik değiştirme API'leri yeni V2 `units_manage` rol iznine bağlandı; `lead` etiketi tek başına bu işlemleri açmıyor. Birim kapsamı ayrıca denetleniyor. Yerel SQL kabulünde rolü olmayan `lead` için iki işlem 403, `units_manage` rolü ve ilgili birimde `lead` üyeliğiyle 201/200 geçti. Bu V2 izni V1'in 59 anahtarından biri değildir.
- Geri bildirim kaydı ve görseli ayrı migration DB/özel dosya köküne de taşındı: ilk çalışmada 1, tekrarda 0 yeni kayıt ve 1 eşleşme. `0019_right_the_enforcers.sql` audit geçmişine benzersiz kaynak kimliği ekledi. `stage-v1-activity.mjs` 580 V1 etkinliğinin tamamını taşıdı; 376 konu hedefe bağlandı, kaynakta artık bulunmayan veya konu kimliği boş olan 204 kayıt özgün konu türü/kimliği ve değişen alanlarıyla korundu. 580/580 kullanıcı bağı var; tekrarında 0 yeni/580 eşleşme ve değiştirilmiş kaynak işlem türü reddi geçti. Canlı kaynak ve büyük veri kabulü açık.
- `0020_empty_lightspeed.sql` V1 kaynak duyuru kimliği ve `updated_at` alanını ekledi; V1'in tutmadığı `created_by` alanını boş kabul ediyor. `stage-v1-announcements.mjs` duyuru, hedef rol ve okundu/onay bağlarını işler; V1 `staff` hedefini V2 `internal` yapar, yayımlanmış kaynak kaydın `published_at` değerini kaynak oluşturulma zamanından türetir. Yerel kaynakta üç tablo da 0; sentetik 1 duyuru/1 rol/1 okundu bağı `--validate` ile SQL içinde oluşturulup geri alındı, geçersiz rol bağı reddedildi. Test sonunda migration DB'de duyuru/bağ sayıları yine 0. Canlı duyuru verisi ve tarayıcı kabulü açık.
- `0021_blue_marvel_boy.sql` kapalı zaman kaynak kimliği ekledi; `stage-v1-blackouts.mjs` yazıcı bağı, tür, tüm gün ve UTC saatlerini taşır. Yerel kaynakta 0 kayıt; sentetik yazıcıya özel bakım ve genel tüm gün kapanış `--validate` ile geçti, bozuk yazıcı bağı reddedildi ve DB'de kayıt bırakılmadı.
- `0022_thankful_dark_beast.sql` randevu, özel dosya ve durum geçmişi kaynak kimlikleri ekledi. `stage-v1-appointments.mjs` yazıcı/filament/kullanıcı bağlarını, durum/token/saklama alanlarını ve özel dosyayı yol, boyut, SHA-256 denetimiyle taşır. Yerel kaynakta üç tablo 0; sentetik 1 randevu/1 model dosyası/1 geçmiş kaydı ilk ve ikinci çalışmada 3 yeni/0 mevcut, ardından 0 yeni/3 mevcut olarak geçti. Bozuk dosya boyutu reddedildi. Sentetik SQL kayıtları ve dosya temizlenip özgün kaynak tekrarında 0/0 doğrulandı. Bu, kamu başvurusu/SMTP/takip akışının tamamlandığı anlamına gelmez.
- `verify-v1-stage.mjs` yerel kaynak ile iki migration DB'deki 22 iş tablosunun kaynak kimliklerini ve bağlarını bağımsız okudu: her DB'de 960 kaynak = 960 taşınan + 0 dışarıda bırakılan. 59 izin tanımı ve 69 rol-izin bağı rol meta verisinde eşleşti; 204 etkinlik konusu kaynakta silinmiş veya kimliksiz olarak raporlandı. `sparkoff_v2_migration_clean` boş veritabanından tüm migration ve aktarım sırasıyla kuruldu; iki DB'de stok `1525.000`, envanter medyası ve geri bildirim görseli kaynak SHA-256 ile eşit. Canlı yedek farkı ve VDS kabulü açık.
- V1 rol açıklaması ile oluşturulma/güncelleme zamanları `0023_clumsy_pete_wisdom.sql` üzerinden V2 rolüne eklendi. İki yerel migration DB'de 2/2 rol kaynak alanlarına düzeltildi; tekrarında 0 güncelleme ve birleşik doğrulamada açıklama/zaman eşitliği geçti. Rol yönetimi formu açıklama düzenler. Kullanıcı listesi V1'in ad/e-posta/durum/kayıt tarihi sıralamasını, rol listesi ad/kullanıcı sayısı/kayıt tarihi sıralamasını sunuyor; geçersiz sıralama 400, SQL kabulü ve derleme geçti. Üye listesi arayüzündeki `lead/advisor` etiketine dayalı görünürlük kapısı kaldırıldı.
- `0024_dazzling_the_leader.sql` V1 kullanıcı `email_verified_at` ve eski `role` etiketi için saklama alanı ekledi. `stage-v1-users.mjs` kaynak `created_at/updated_at`, doğrulama zamanı ve arayüz/tablo/kayıtlı filtre JSON tercihlerini V2 kullanıcı kaydına taşıyor. Eski `role` etiketi yalnız meta veridir; etkin yetki hâlâ `is_system` veya atanmış rollerden çözülür. İki migration DB'de 1/1 kullanıcı kaynak alanlarıyla eşlendi, birleşik doğrulama 960/960 kaldı. V2 profilinde V1 tema/ölçek/yoğunluk/yan menü seçenekleri okunuyor, kaydediliyor ve sıfırlanıyor; yerel SQL kabulü ve 30/30 test geçti. V1 kayıtlı filtreleri envanter, teslim, randevu ve geri bildirim ekranlarında okunup uygulanıyor; adla ekleme/güncelleme, silme, tablo izni ve 10 kayıt sınırı yerel SQL kabulünden geçti. V1 demirbaş türü ve kategori kimliği V2 karşılığına çevriliyor; kaynak JSON korunuyor. V1 tablo alanı tercihleri de envanter, teslim, randevu, geri bildirim ve kullanıcı kartlarında uygulanıyor; alan seçimi ve yetkili alan sınırı yerel SQL kabulünden geçti. Randevu alan sırası taşıma düğmeleriyle kaydedilip kartta uygulanıyor. Gerçek tarayıcı etkileşim kabulü ve canlı aktarım açık.

Başlangıç raporu: [V1→V2 durum raporu](SPARKOFF_V1_V2_DURUM_RAPORU_2026-11-09.md). Kutular yalnız tam kabul kanıtı eklendiğinde işaretlenecek.

Veri geçişinin alan, tarih, stok, dosya ve yetki kuralları: [V1→V2 veri geçişi sözleşmesi](SPARKOFF_V1_V2_VERI_GECIS_SOZLESMESI.md). Bu sözleşme yerel V1 kopyasına dayanır; canlı yedek karşılaştırması yapılıncaya kadar Aşama 0 açık kalır.

### 9 Kasım 2026 — Aşama 2 ilerlemesi

- Malzeme düzenleme/arşivleme ve tür değişikliği kısıtı API, yönetim arayüzü ve demo modunda eklendi. Açık teslimde tür değişikliği engelleniyor; arşiv katalogdan çıkıyor ve yeni stok işlemine kapanıyor.
- Kategori/konum oluşturma ve düzenleme, aktiflik/görünürlük, konum kodu tekilliği ve malzemeye atama eklendi.
- Yönetim envanterine ad/stok kodu/marka/model araması, durum/tür/kategori süzmesi ve sıralama eklendi. Bu süzme şu an tarayıcıda yüklenen kayıtlar üzerinde çalışıyor; büyük veri ve sayfalama kabulü henüz yapılmadı.
- Son 30 stok hareketi yönetim ekranına eklendi. Malzeme oluştururken başlangıç stoğu aynı işlem içinde ilk hareket olarak yazılıyor; kategori/konum doğrulanıyor. Yeni kayıt, bakiye ve çakışan stok kodu gerçek SQL ile doğrulandı.
- V1'in 60 saniyelik stok düzeltmesi geri alması eklendi: yalnız işlemi yapan kişi, tek kez, ters hareket ve audit kaydıyla. Eşzamanlı iki istekte bir başarı/bir 409 sonucu gerçek MariaDB'de dört kez doğrulandı.
- Üye envanter ekranı kamu kataloğuna bağlandı; yönetim envanteri ve kategori/konum tanımları yönetim yetkisi olmayan hesaplara kapatıldı. Üye oturumuyla 403, kamu kataloğuyla 200 sonucu gerçek SQL kabulünde doğrulandı.
- Toplu kategori, konum, görünürlük ve arşiv işlemleri eklendi. En çok 100 benzersiz kayıt, onay kutusu, arşiv için yönetici yetkisi, atlanan kaydın nedeni ve audit kaydı var. Kategori/konum/görünürlük için 60 saniyelik geri alma, sonraki değişiklikte çatışma reddi ve eşzamanlı tek geri alma SQL'de doğrulandı. Arşivleme geri alınabilir işlem değildir.
- Sarf teslimi artık stoktan düşülüp anında tamamlanıyor; ödünç/demirbaş açık kalıyor. Teslim notu, gelecekteki iade tarihi doğrulaması, kısmi iade notu, gerekçeli hasar/kayıp kapanışı ve değiştirilmemiş teslimin stok karşı hareketiyle geri alınması eklendi. Kişi adı, e-posta ve not için ayrı izinler tanımlandı; sınırlı rolde alanların maskelenmesi ve hasar/kayıp/geri alma reddi gerçek SQL'de doğrulandı. İki eşzamanlı iade ve iki eşzamanlı geri alma senaryosu dört SQL çalıştırmasında geçti.
- Kapanmış teslimlerde kişi alanları, V1'deki `loans.personal_data_retention_days` ayarına göre (varsayılan 30 gün) günlük cron çağrısında temizleniyor. 31 günlük kaydın ad/e-posta/not alanlarının SQL'de `NULL` olması ve 29 günlük kaydın korunması kabul testinde doğrulandı. Audit yalnız kayıt sayısını ve süreyi tutuyor.
- Teslim listesi API'sine V1 durumları, teslim/beklenen iade/miktar/durum sıralaması, yön ve 20 kayıtlık sayfa eklendi. Yönetim ekranında açık/gecikmiş ve tamamlanan/hasarlı/kayıp/geri alınan listeleri ayrı sorgularla görüntüleniyor; SQL kabulünde filtre, geçersiz ölçüt ve sayfa sınırı doğrulandı. Parametresiz isteğin sınırı 10 Kasım'da ayrıca kapatıldı.
- Yerel SQL kabul ortamı artık `storage/framework/local-test-v2/mariadb-runtime/` altında yeniden kurulabilir; canlı V1 verisi ve Ubuntu VDS kullanılmadı.
- Yerel MariaDB SQL kabulü kategori/konum, atama, açık teslim, arşiv ve medya akışlarıyla geçti. `npm test` 18/18 ve üretim derlemesi geçti. Masaüstü örnek mod görüntüsü incelendi.
- Aşama 2 kutuları açık: stok hareketlerinin tüm türleri, Ubuntu VDS zamanlayıcısı, XLSX ve V1 verisiyle sayısal eşitlik henüz tamamlanmadı. Teslim filtrelerinin mobil etkileşimi 10 Kasım'da kabul edildi; tüm rol matrisi ayrıca gerekli.

### 10 Kasım 2026 — teslim listesi ve saklama ayarı

- Parametresiz teslim API yanıtı dahil tüm liste istekleri 20 kayıtla sınırlı; tek kayıt doğrulaması `id` ölçütünü kullanıyor. 21 yeni teslimle iki sayfanın ayrık olması gerçek SQL'de doğrulandı. Mobil örnek modda açık/geçmiş teslimlerin sayfa düğmeleri çalıştı; masaüstü ve mobil görseller incelendi, tarayıcı hatası oluşmadı.
- Yönetim Sistemi ekranında kapanmış teslimlerin kişisel veri saklama süresi düzenlenebiliyor. Denetçi yalnız okuyabiliyor; yetkisiz rolün değişiklik isteği 403 alıyor. 45 günlük ayarda 31 günlük kaydın korunması, ayar 30 güne dönünce temizlenmesi SQL kabulünde doğrulandı. Mobil arayüzde kaydetme, yeniden açma ve denetçi salt okunur davranışı kontrol edildi.
- CSV dosyasının başlıklarını inceleme, otomatik öneri ve elle sütun eşleme eklendi. Seçili eşleme önizleme ve onayda yeniden doğrulanıyor; tanınmayan başlıklı CSV'nin gerçek SQL'e aktarımı ve mobil arayüz akışı geçti. 20 birim testi başarılı. Uzun formlarda sabit Kaydet düğmesinin içerik üstüne binmesi kaldırıldı.
- XLSX dosyasını 2 MB yükleme, 16 MB açılmış arşiv, 100 arşiv girdisi/100 sütun/2000 veri satırı sınırlarıyla okuma ve XLSX dışa aktarma eklendi. Formül hücresi içe alınmıyor; dışa aktarılan formüle benzeyen ad metin hücresi olarak kalıyor. Gerçek SQL kabulü ve mobil gerçek sunucu akışı geçti. 23 birim testi başarılı.
- Karışık dosyada geçerli/hatalı satır analizi, sütunların dolu/boş sayısı ve ilk 100 geçerli satır önizlemesi eklendi. Hatalı satır varsa onay varsayılan olarak kapalı; kullanıcı açıkça işaretleyince yalnız geçerli satırlar tek SQL işleminde aktarılıyor. Tekrar stok kodu ve bozuk miktar içeren karışık dosya SQL kabulünde; mobil örnek mod onay akışı tarayıcıda doğrulandı. 3 MB üzeri içe aktarma isteği 413 ile reddedildi. 24 birim testi başarılı.
- Drizzle ORM ile Hono Node sunucusu güvenlik düzeltmesi içeren sürümlere yükseltildi. Üretim bağımlılıklarında `npm audit --omit=dev` sıfır uyarı verdi. Geliştirme bağımlılığı Drizzle Kit zincirinde dört orta önem dereceli uyarı kaldı; üretim ortamına geliştirme bağımlılıkları kurulmamalı.
- Aşama 2 açıkları: Ubuntu VDS günlük zamanlayıcı kurulumu ve geri yükleme kabulü, V1 verisiyle sayısal eşitlik, stok hareketlerinin tüm V1 türlerine ait rol/yarış matrisi, büyük veri ve tüm ekran kabulü. V1 canlı veri ve Ubuntu VDS hâlâ değiştirilmedi.

### 10 Kasım 2026 — V1 kaynak kopyası ve geçiş sözleşmesi

- Yerel V1 SQLite dosyası salt okunur bağlantıyla incelendi; SHA-256, tablo sayıları, stok toplamı ve hareket türleri geçiş sözleşmesine kaydedildi. Bu dosya canlı V1 yedeği olarak kabul edilmedi.
- `scripts/audit-v1-sqlite.py` salt okunur kaynak fotoğrafını kişi verisi yazdırmadan tekrar üretiyor. Yerel kopyada kayıp malzeme bağı ve son stok hareketi bakiyesi farkı sıfır; hareketi olmayan bir malzeme var.
- V2 MariaDB bağlantısı ve her SQL oturumu UTC'ye sabitlendi; yerel SQL kabulünde oturum farkı sıfır saniye ve tüm mevcut senaryolar başarılıydı.
- V1 teslimindeki tam `recipient_name` alanı V2 arayüzünde yetkili kullanıcıya aynen gösterilecek biçimde düzeltildi. Yetkisiz kullanıcıya sunucu `borrowerNameOriginal` göndermiyor.
- Çoklu rol ilişkisi, bcrypt→scrypt giriş geçişi, randevu alanlarının eksikliği ve canlı dosya/saat farkı Aşama 0'ın açık kapılarıdır. Üretim verisi taşınmadı.

### 10 Kasım 2026 — Aşama 0 yetki ve parola temeli

- V1 `config/permissions.php` içindeki 59 anahtar [izin eşlemesine](SPARKOFF_V1_V2_59_IZIN_ESLEMESI_2026-11-10.md) yazıldı. Envanter ve teslim API kapıları işlem bazına ayrıldı; eski `inventory_manage` otomatik yetki vermiyor. Yerel V1 moderatörünün mevcut rol bağları ayrıca okundu: ilk rol kurulumundan sonra hasar/kayıp/geri alma ve iade tarihi uzatma izinleri de var. V2 moderatör senaryosu envanteri/kişisel alanları görme, teslim oluşturma, sağlam iade ve geri almayı yerel SQL'de geçti; içe/dışa aktarım, malzeme değişikliği, stok, medya ve arşiv 403 döndü. İade tarihi uzatma V2'de açık; arayüz düğmeleri yeni izinlere bağlandı, gerçek mobil/masaüstü rol kabulü açık.
- `user_custom_roles` migration'ı eski tek rol atamalarını taşıyor. Oturum çoklu rol izin/sekme birleşimini hesaplıyor; yönetim arayüzünde birden çok rol seçiliyor. İki rolün birleşimi ve tekrarlanan rol kimliğinin reddi yerel SQL'de geçti. Canlı V1 rol aktarımı ve bütün 59 izin için 200/403 matrisi açık.
- V1 `$2y$` bcrypt özetleri ilk doğru girişte atomik karşılaştırmalı güncellemeyle scrypt'e yükseltiliyor. Yanlış parola, iki eşzamanlı doğru giriş ve özet yükselmesi yerel SQL'de geçti. V1 canlı kullanıcıları taşınmadı.
- Yazıcı yönetiminde görüntüleme, oluşturma, alan düzenleme, durum değiştirme, filament yönetimi ile temel randevu görüntüleme/inceleme izinleri ayrıldı. Durum yetkisi olan fakat yazıcı alanlarını düzenleyemeyen rolün 200/403 sınırı yerel SQL'de geçti. Randevu kişi alanları ayrı izinle maskeleniyor. Çalışma saati/takvim ve tam randevu işlevleri açık.
- Kullanıcı listesindeki `users_view` ve hesap durumundaki `users_disable` izinleri ayrıldı. Hesap pasifleştirme oturumları iptal ediyor; son etkin `super_admin` hesabı kapatılamıyor. Etkinleştirme, pasif hesapla giriş reddi ve eski oturumun 401 dönmesi yerel SQL'de geçti. Tam kullanıcı düzenleme, parola sıfırlama, canlı rol aktarımı ve gerçek tarayıcı kabulü açık.
- Yetkili parola sıfırlama ayrı `users_reset_password` iznine bağlandı. Yeni parola scrypt ile saklanıyor, hedef kullanıcının oturumları iptal ediliyor ve audit'e parola yazılmıyor. Geçersiz parola, eski oturum/parola reddi ve yeni parola girişi yerel SQL'de geçti. Tam kullanıcı düzenleme ve tarayıcı kabulü açık.
- Ad/e-posta düzenleme `users_update` izniyle eklendi. E-posta benzersizliği 409 ile korunuyor; adres değişince hedef oturumları iptal ediliyor, aynı kullanıcı adı güncellemesinde oturum korunuyor. Yerel SQL'de eski/yeni e-posta ile giriş ve 401/409 sınırları geçti. V1'in tüm kullanıcı alanları ve gerçek tarayıcı kabulü açık.
- Doğrudan özel rollü kullanıcı oluşturma `users_create` + `roles_assign` izniyle eklendi. En az bir rol, güçlü parola, benzersiz e-posta ve atomik kullanıcı/rol kaydı var. Yetkisiz 403, geçersiz rol/parola 400 ve çakışma 409 yerel SQL'de geçti. V1 sistem rolü oluşturma, rol düzenleme/silme ve gerçek tarayıcı kabulü açık.
- V1 `roles.view` ekranı incelenince kullanıcı listesini yalnız `users.view` izninin açtığı doğrulandı. V2 rol okuyucusu rol listesini görebiliyor fakat `/org/members` için 403 alıyor; bu ayrım yerel SQL'de tekrar doğrulandı. Yönetim ekranında rol listesi ayrı kartta gösteriliyor.
- Özel rol oluşturma/düzenleme `roles_create` ve `roles_update` olarak ayrıldı; izinler, sekmeler ve oda erişimleri arayüzden düzenleniyor. Tekrarlı izin/oda ve gerçek oda olmayan kimlik reddediliyor. Mevcut oturumun rol güncellemesi sonrası yeni izin birleşimini görmesi yerel SQL'de geçti. Sistem rolü ve rol silme/arşivleme hâlâ açık.
- Atanmamış özel rol `roles_delete` izniyle silinebiliyor; kullanıcıya atanmış rol 409 ile korunuyor. Rol atama ile silme aynı rol satırını kilitliyor; iki isteğin eşzamanlı yarışında birinin 200, diğerinin 404/409 dönmesi yerel SQL'de geçti. V1 sistem rolü ve gerçek tarayıcı kabulü açık.
- `npm test` 24/24, `npm run build` ve yerel SQL kabulü geçti. Yerel SQL VDS kabulü yerine geçmez; Aşama 0 ve yayın kapıları açık.

### 10 Kasım 2026 — V1 kaynak ön kontrolü

- `v2/scripts/preflight-v1-sqlite.py` yalnız salt okunur V1 SQLite kopyasında bütünlük, beklenen tablo/alan, enum, hedef uzunluğu, üç ondalık hassasiyet, kullanıcı/rol/malzeme bağları, teslim kaynak bağı, stok zinciri ve tarih biçimi tarıyor. Kişi verisi ve parola özeti yazdırmıyor. Yerel kaynakta engel yok; 173 hareketin zinciri ve son bakiyesi tutuyor, 1 malzemenin hareket kaydı yok. Bilinmeyen enum eklenmiş geçici kopya hata koduyla reddedildi.
- Tarihlerin çoğu saat dilimsiz; çalışma saati alanları yalnız saat biçiminde. Araç biçimleri ayırıyor fakat gerçek an dönüşümünü çözmüyor. V1 `fixed_asset` türü V2 `equipment` olarak eşlenmeli. Canlı kaynak, tam alan eşlemesi ve aktarım provası açık.
- V1 teslim alıcısı adı/e-postası Laravel şifreli alanı. Yerel 3 teslimin iki alanı V1 yerel anahtarıyla 3/3 çözüldü; içerik yazdırılmadı. Canlı kaynak anahtarının yedeklenmesi ve çözme doğrulaması aktarım kapısıdır. V1 Eloquent tarihleri İstanbul saat diliminde saat dilimsiz yazıyor; doğrudan SQL/default zamanları ayrı doğrulanmalı.

### 10 Kasım 2026 — randevu şeması ve inceleme koruması

- V1 randevu, özel dosya, durum geçmişi, çalışma saati ve kapalı zaman alanlarının yapısal karşılığı `0007` migration'ıyla V2'ye eklendi; eski V2 demo alanları korundu ve eski `pending` kayıtları `pending_approval` durumuna çevrildi. Migration ayrı yerel kabul MariaDB'sinde uygulandı. Bu, V1 randevularının taşındığı veya kamu başvuru akışının hazır olduğu anlamına gelmez.
- Yönetici incelemesi yalnız geçerli durumdan ilerliyor; eksik kayıt 404, yanlış geçiş 409, açıklamasız ret 400 dönüyor. Durum ve geçmiş/audit aynı SQL işleminde yazılıyor. Yazıcı satırı kilitlenerek onayda aktif cihaz, bakım aralığı ve çakışan rezervasyon kontrol ediliyor. Kişisel alanları görme izni olmayan randevu okuyucusunda ad/e-posta maskelendi. Yerel SQL'de iki eşzamanlı inceleme, çakışma, bakım ve 403 sınırları geçti; `npm test` 24/24 ve derleme geçti.
- Açık: V1 başvuru, e-posta doğrulama/takip, durumların geri kalanı, çalışma saati/müsaitlik hesabı, özel dosya indirme/saklama, gerçek SMTP ve VDS/tarayıcı kabulü. `ONLINE_BOOKING_ENABLED` kapalı kalmalı.

### 10 Kasım 2026 — salt okunur randevu müsaitliği

- `/api/printers/availability` V1 gibi `ONLINE_BOOKING_ENABLED=true` olmadıkça 404 döndürüyor. Bayrak açıkken yalnız sonraki yedi gün, 15/30/60 dakikalık ayar ve izinli süre için etkin yazıcıların slotlarını İstanbul yerel saatinde veriyor. Çalışma saati yoksa slot yok; mevcut engelleyici randevu, süresi dolmamış doğrulama beklemesi ve genel/yazıcı bakım aralığı slotu kapatıyor. İstek başına IP temelli 60/dakika sınırı var.
- 26 birim testi ve üretim derlemesi geçti. Bayrak kapalıyken tam yerel SQL kabulü, yalnız yerel kabul sunucusunda bayrak açıkken ayrı müsaitlik SQL kabulü geçti. VDS/gerçek tarayıcı ve tam başvuru akışı açık; yayın bayrağı kapalı kalır.

### 10 Kasım 2026 — çalışma saati ve kapalı zaman yönetimi

- V1 takvimindeki `kind` ve `is_all_day` alanları `0008` migration'ıyla V2 kapalı zaman tablosuna eklendi; ayrı yerel kabul MariaDB'sine uygulandı. `printers_manage_hours` ve `printers_manage_schedule` izinleri ayrıldı. Yedi günlük saat düzenleme ile kapalı zaman oluşturma/düzenleme/silme yönetim ekranına bağlandı.
- Kapalı zaman yazımı etkilenen yazıcı satırlarını kilitliyor; mevcut randevu veya kapalı zamanla çakışma 409 dönüyor. Tüm gün aralığı İstanbul yerel gününden UTC ana çevriliyor. SQL kabulünde saat yetkisi ve takvim yetkisi ayrı 200/403, eksik/geçersiz veri 400, çakışma 409, iki eşzamanlı aynı aralık eklemesinde 201/409 ve tüm gün başlangıç/bitiş gösterimi geçti. `npm test` 26/26, `npm run build` ve son sürümle yerel SQL kabulü geçti; gerçek tarayıcı ve VDS kabulü açık.
- Kamu başvurusu, e-posta doğrulama/takip, özel dosya erişimi ve durumların geri kalanı tamamlanana kadar online randevu bayrağı kapalı kalır.
- Kullanıcı örnek modda yönetim takvimini göremeyince kök neden bulundu: `v2/src/client/demo.ts` yönetici izin listesinde yeni yazıcı/takvim izinleri ve saat/kapalı zaman örnek API karşılıkları yoktu. Örnek mod düzeltildi; `http://127.0.0.1:5174/admin/printers` adresinde sistem yöneticisi rolüyle iki kart görünür. 27/27 test ve derleme geçti. Bu, gerçek tarayıcı görsel kabulü veya VDS kabulü değildir.

### 10 Kasım 2026 — randevu baskı durum zinciri

- V1 `appointments.manage_status` izni V2 `appointments_manage_status` olarak ayrı eklendi. `pending_approval/change_requested` incelemesi ile `approved→ready→printing→completed/failed`, `failed→ready` baskı durumu ayrı yetkiyle çalışıyor. Ret, değişiklik ve başarısızlık gerekçe istiyor. Her başarılı geçiş durum/geçmiş/audit olarak tek SQL işleminde yazılıyor; başarısız kaydı yeniden hazır yaparken bakım ve çakışma tekrar kontrol ediliyor.
- Yönetim ekranı geçerli sonraki durumları gösteriyor; örnek modda geçiş sonucu kalıcı örnek veriye yazılıyor. Yerel SQL'de inceleme yetkili rolün baskı durumuna 403, baskı durumu yetkili rolün incelemeye 403, tam durum zinciri, geçersiz geçiş 409, açıklamasız başarısızlık 400 ve bakım aralığında yeniden hazır 409 geçti. `npm test` 27/27 ve üretim derlemesi geçti. Durum e-postası, gerçek tarayıcı ve VDS kabulü açık.

### 10 Kasım 2026 — özel randevu model dosyası indirme

- `appointments_download_file` ayrı izni eklendi. Yönetim ekranı izinli randevunun dosyalarını listeliyor ve gerçek API'de oturumlu indirme bağlantısı veriyor; örnek modda aynı bölüm örnek veriyle açılıyor. Dosya yalnız `PRIVATE_UPLOAD_DIR` kökünden, V1 UUID dizin biçimi ve randevu bağı doğrulandıktan sonra, symlink/dizin dışına çıkış ve boyut kontrolüyle akıtılıyor. İndirme audit kaydı yazıyor; silinmiş veya saklama süresi dolmuş dosya reddediliyor.
- 28/28 birim testi, üretim derlemesi ve yerel MariaDB HTTP kabulü geçti: yetkili dosya içeriği/başlık/audit, yalnız randevu okuma yetkili rol için liste ve indirme 403, yanlış randevu bağı 404, silinmiş dosya 404. Canlı V1 dosya aktarımı, yükleme/saklama işi, gerçek tarayıcı ve VDS kabulü açık; `ONLINE_BOOKING_ENABLED` kapalı.

### 10 Kasım 2026 — randevu dosyası saklama

- V1'in `privacy.file_retention_days` ayarı V2 Sistem ekranına ve ayrı yönetici/auditor API kapılarına eklendi. Günlük iç zamanlayıcı, daha önce tarihi olmayan dosyaları oluşturma tarihinden itibaren planlıyor; süresi gelen özel model dosyasını güvenli dizinden kaldırıp SQL'de `deleted_at` işaretliyor. İleri tarihli randevu saklama istisnası temizliği erteliyor; indirme/listede de istisna dikkate alınıyor. İşlem sayıları denetim kaydına yazılıyor.
- Yerel MariaDB HTTP kabulünde ayar 400/403, istisna varken dosyanın korunması ve indirilebilmesi, istisna kaldırılınca dosyanın silinip 404 dönmesi geçti. 28/28 birim testi ve derleme geçti. Randevu kaydının 12 ay sonra silinmesi, gerçek zamanlayıcı kurulumu, V1 dosya aktarımı ve gerçek tarayıcı/VDS kabulü açık; online bayrak kapalı.

### 10 Kasım 2026 — randevu kaydı saklama ve V1 rol kuralı

- Günlük temizlik artık V1'in 12 aylık varsayılanına göre yalnız bitmiş/ret/iptal/süresi dolmuş randevuları değerlendiriyor. İleri tarihli saklama istisnası kaydı koruyor. Silinen kaydın özel dosyaları, dosya satırları ve durum geçmişi birlikte temizleniyor; dosya hatasında kayıt korunup sonraki çalışmada yeniden deneniyor. Yerel SQL kabulünde eski terminal kaydın dosya ve geçmişiyle silinmesi, istisnalı kaydın korunup istisna kaldırılınca silinmesi geçti. Gerçek cron/VDS kabulü açık.
- Kullanıcının V1 rol mantığını birebir koruma isteği doğrultusunda V1 kaynak kodu tekrar karşılaştırıldı: yalnız `is_system` Sistem Yöneticisi bütün izinleri geçirir; diğer rollerin izinleri çoklu rol bağlarından birleşir. V2 `super_admin` dışındaki `admin/auditor` genel rollerinin otomatik tüm izinleri açması kaldırıldı. İşlem geçmişi ve saklama API kapıları `audit_logs_view` / `privacy_settings_update` iznine bağlandı; yönetim menüsü rol adı yerine izin/sekme kullanıyor. Yerel SQL'de eski `admin` etiketli fakat yalnız envanter okuma rolü verilmiş hesabın ek yetki kazanmadığı doğrulandı. Canlı V1 rol aktarımı ve tüm 59 izin/ekran matrisi hâlâ açık.
- V1 rol ön kontrolü `plan-v1-roles.py` ve 59 anahtarlı sabit eşleme dosyasıyla tekrar çalıştırılabilir hâle geldi. Yerel kopyada iki rol, bir kullanıcı, çoklu rol bağı sıfır; atanmamış `inventory-moderator` rolünün `loans.extend_due_date` izni aktarım engeli olarak raporlandı. `0009` migration'ı V2 rolüne kaynak ID/slug/özgün izinler ve koruma durumu alanları ekledi; korunan rol API'de düzenlenip silinemiyor, yönetim ekranında işaretleniyor. Migration yalnız yerel kabul MariaDB'sine uygulandı ve rol koruma 403 senaryosu geçti. Tam V1 rol içe aktarma ve canlı rol matrisi açık.
- `stage-v1-roles.mjs` yalnız `127.0.0.1:4319/sparkoff_v2_acceptance` üzerinde V1 rol tanımlarının provası için eklendi. Yerel `inventory-moderator` rolü kaynak 10 izin anahtarıyla, yalnız eşlenmiş 9 etkin V2 izniyle ve eksik `loans.extend_due_date` engeli korunarak taşındı; ikinci çalışma `inserted:0` ile idempotent geçti. Kullanıcı hesapları ve canlı V1 aktarılmadı. Eksik izin/işlev ve tam rol bağları tamamlanmadan üretim aktarımına izin verilmez.
- `loans_extend_due_date` ayrı izni ve açık/kısmi ödünç kaydının iade tarihini ileri alma API/UI/örnek mod akışı eklendi. Tarih dakika hassasiyetine normalize ediliyor; satır kilidi aynı tarihe eşzamanlı iki istekte 200/409 veriyor. Yerel SQL'de yalnız bu izinli rolün işlemi yapması, envanter 403, geçmiş/geçersiz tarih 400/409, kapalı veya demirbaş kaydı 409 ve audit geçti. V1 moderatör rolünün yerel eşlemesi 10/10 oldu; rol prova aracı mevcut kaydı güvenle güncelledi ve `plan-v1-roles.py` yerel kopyada sıfır blokaj bildirdi. Canlı rol ve tarayıcı/VDS kabulü açık.
- `loans_export` ayrı izniyle teslim CSV akışı eklendi. `loans_view` de gerekli; ad/not ve e-posta ayrı kişi verisi izinlerine göre maskeleniyor, anonimleşmiş satırda boş kalıyor. 500 satırlık keyset sayfalarıyla akıtılıyor, BOM/CSV formül güvenliği ve audit var. Yerel SQL'de yalnız dışa aktarma izni 403, görüntüleme+dışa aktarma kişisel alanları boş, kişi/e-posta izinleri eklenince dolu geçti. 29/29 birim testi ve üretim derlemesi geçti. Gerçek tarayıcı/VDS ve V1 canlı veri kabulü açık.
- `appointments_export` ayrı izniyle randevu CSV akışı eklendi. `appointments_view` de gerekli; ad/e-posta/telefon/notlar yalnız `appointments_view_personal_data` izniyle çıkar. 500 satırlık keyset akışı, BOM, formül güvenliği ve audit var. Yerel SQL'de yalnız görüntüleme 403, dışa aktarma+görüntüleme kişisel alanları boş, kişi izni eklenince dolu geçti. 29/29 test ve üretim derlemesi geçti; gerçek tarayıcı/VDS ve canlı veri kabulü açık.
- V1 geri bildirim durum/not alanları `0010` migration'ıyla V2'ye eklendi ve yalnız yerel kabul MariaDB'sine uygulandı. `feedback_view` listesi 30 kayıt sayfalıyor; `feedback_update` durum/not güncellemesini ayrı kapıyla ve audit ile yapıyor. Yönetim ekranında açık/çözülmüş/arşivli filtreleri ve düzenleme var; örnek mod eklendi. Yerel SQL'de yalnız okuma rolü 200/403, yalnız güncelleme rolü 403/200, geçersiz durum 400, eksik kayıt 404 ve audit geçti. V1 görsel eki özel erişimi/aktarımı, gerçek tarayıcı ve VDS kabulü açık.

- Kamu ve yönetim duyurularının `view/create/update/archive` izinleri V1 hedef kuralına göre ayrı API/UI kapılarına bağlandı; `both` için iki izin gerekir, güncellemede eski ve yeni hedef doğrulanır. Yönetim listesi türüne göre filtrelenir; kaldırma V1 gibi siler, işlem audit kaydı yazar. 29/29 birim testi, üretim derlemesi ve yerel MariaDB SQL 200/403 kabulü geçti. 59 kaynak izninin 56'sı doğrudan eşleniyor; atölye, KVKK ve sistem ayarlarının tam eşitliği ile duyuru hedef rol/onay/yayın alanları açık. Gerçek tarayıcı/VDS kabulü açık.

- `0011_great_ted_forrester.sql` duyuru hedef rol bağları, okundu onayı zamanı ve onay zorunluluğu alanlarını ekledi; yalnız yerel kabul MariaDB'sine uygulandı. Yönetim ekranında rol hedefleme ve onay seçimi, üye ekranında onay düğmesi var. Hedef dışı rolün liste/okundu erişimi 404/filtre, hedef rolün onayı 200 ve SQL kaydı geçti. `admin/auditor` etiketinden gelen örtük yazma/okuma kapıları envanter, yazıcı, takvim ve kullanıcı akışlarında kaldırıldı; `super_admin` tek otomatik tam yetkili rol olarak kaldı. 29/29 test, derleme ve yerel SQL kabulü geçti. V1 yayın/yerleşim alanları, canlı aktarım, gerçek tarayıcı/VDS açık.

- `0012_glorious_caretaker.sql` V1 duyuru türü, yerleşim, yayın/taslak ve başlangıç/bitiş zamanı alanlarını ekledi; yalnız yerel kabul MariaDB'sine uygulandı. İstanbul duvar saati UTC'ye doğrulanarak çevriliyor. Ana sayfa ve yazıcılar duyuruları ayrı gösteriliyor; taslak, gelecekte başlayacak, süresi dolmuş kayıtlar görünmüyor. Yönetim formu ve örnek mod güncellendi. SQL'de taslak→yayın, gelecek başlangıç, yazıcıya özel yerleşim ve geçersiz zaman/yerleşim 200/400 kabulü geçti; 29/29 test ve derleme geçti. Aktivasyon kodu üretiminde `admin` etiketinin örtük yetkisi kaldırıldı; kullanıcı oluşturma+rol atama izni ve birim kapsamı gerekiyor. Canlı aktarım, gerçek tarayıcı/VDS açık.

- `0013_bent_gladiator.sql` V1 kaynak kullanıcı kimliği alanını ekledi; yalnız yerel kabul MariaDB'sine uygulandı. `stage-v1-users.mjs` V1 SQLite'ı salt okunur açıp yalnız `127.0.0.1:4319/sparkoff_v2_acceptance` üzerinde bcrypt özeti, kullanıcı ve çoklu rol bağlarını prova ediyor. Yerel kaynakta 1 sistem rolü kullanıcısı ilk uygulamada eklendi, ikinci uygulamada `inserted:0, existing:1` ile idempotent geçti; prova kullanıcısı sonra yerel kabul DB'sinden temizlendi. `legacy_user_id` olan sıfır rollü V1 hesabı V2 varsayılan üye izin/sekmesini almıyor; SQL'de boş izin/sekme ve envanter 403 geçti. Gerçek kullanıcı aktarımı ve canlı yedek karşılaştırması açık.

- `workshop_settings_update` V1 izniyle atölye iletişim bilgileri ve yedi günlük çalışma saatleri için ayrı public GET/yetkili PUT API, yönetim formu ve ana sayfada iletişim kartı eklendi. Aynı rolün yazıcı saatleri yönetimine otomatik geçmediği 403, atölye ayarı 200, geçersiz telefon 400 yerel SQL kabulünde geçti. 29/29 test ve üretim derlemesi geçti. 59 V1 izninin 57'si doğrudan eşlendi; KVKK ve sistem ayarlarının tam kapsamı açık. Gerçek tarayıcı/VDS kabulü açık.

- `privacy_settings_update` V1 kapsamındaki veri sorumlusu adı/adresi, iletişim e-postası, aydınlatma sürümü, taslak durumu, randevu ay ve dosya gün saklama süreleri için tek yönetim formu ve public KVKK bilgisi eklendi. Saklama zamanlayıcısının okuduğu aynı `system_settings` anahtarları yazılıyor; izinli 200, izinsiz 403, geçersiz 400 SQL kabulünde geçti. 29/29 test ve derleme geçti. 59 iznin 58'i doğrudan eşlendi; sistem/randevu kuralı ayarı açık. Gerçek tarayıcı, V1 tam metin karşılaştırması ve VDS açık.

- `system_settings_update` ile V1 randevu kuralı alanları ayrı API/UI kapısına bağlandı: slot dakikası, azami süre, doğrulama beklemesi, dosya MB sınırı ve uzantılar. İlk ikisi mevcut müsaitlik hesabında okunuyor; diğerleri çevrimiçi başvuru kapalı olduğu için henüz başvuru akışında kullanılmıyor. Yetkili 200, izinsiz saat/KVKK 403 ve geçersiz slot 400 SQL kabulünden geçti. 29/29 test ve derleme geçti. V1 59 kaynak izninin 59'u artık V2 izin anahtarına eşleniyor; bu tam işlev/ekran paritesi anlamına gelmiyor. Yerel rol ön kontrolü sıfır blokaj ve prova rolü `inserted:0, updated:0` ile idempotent geçti. Canlı kullanıcı/rol aktarımı, tüm işlevlerin gerçek tarayıcı ve VDS kabulü açık.

- `0014_nebulous_ben_parker.sql` V1 sistem rolü bayrağını V2 rol tablosuna ekledi ve yalnız yerel kabul MariaDB'sine uygulandı. Rol prova aracı artık sistem rolü dahil iki V1 rolünü taşır; kullanıcı prova aracı kaynak sistem rolü bağını da kullanıcıya bağlar. Yerel kaynak hesabı ilk aktarımda 1, tekrarında 0 yeni kayıtla geçti; SQL'de sistem rolü bağı doğrulandı, prova hesabı temizlendi. API'de sistem rolünü yalnız Sistem Yöneticisi atayabilir, rol kaldırılınca yetki düşer, son etkin sistem yöneticisinin rolü korunur; sentetik 403/200/boş izin SQL kabulü geçti. 29/29 test, derleme ve genel SQL kabulü geçti. Canlı V1 yedeği, gerçek tarayıcı ve VDS kabulü açık.

- V2 aktivasyon kodunda eski `admin/auditor` etiketlerini üretme seçeneği kaldırıldı; bu etiketler atanmış V1 izinlerini temsil etmiyordu ve yetkisiz/boş hesap yaratabiliyordu. Yetkili kullanıcı oluşturma ile Sistem Yöneticisi ataması artık rol üzerinden yapılıyor. Yerel SQL'de eski `admin` kodu 400, 29/29 test ve üretim derlemesi geçti.

### 11 Kasım 2026 — geri bildirim görseli

- V1'in geri bildirim görseli akışı V2'ye bağlandı: kamu formunda isteğe bağlı JPG/PNG/WebP, 5 MB ve 6000 × 6000 piksel sınırı, 10–3000 karakter açıklama ve boş bal küpü alanı doğrulanıyor. Görsel özel dosya köküne kaydediliyor; kayıt başarısızlığında dosya temizleniyor. Yönetim listesi görsel bağlantısını gösteriyor. Dosya yalnız `feedback_view` izniyle, `private, no-store` başlığıyla açılıyor.
- Örnek modda görsel bağlantısı sayfa yenilenene kadar çalışır; örnek dosyanın kendisi saklanmaz. Gerçek SQL kabulünde görselli kayıt, bozuk dosya reddi, izinsiz 401/403 ve izinli 200 ile içerik eşitliği geçti. V1 geri bildirim kayıtları ve görsel dosyalarının kaynak aktarımı ile gerçek tarayıcı/VDS kabulü bu adımda açıktı; aşağıdaki yerel prova bunu kısmen kapattı.
- Kamu gönderimi IP başına 5 istek/dakika ile sınırlandı; sınır MariaDB'de tutuluyor. 6 MB üstü gövde, `Content-Length` olmasa da akış okunurken 413 alıyor. Yerel SQL kabulünde ilk beş geçersiz istek 400, altıncı istek 429 döndü. 30 birim testi ve üretim derlemesi geçti.
- Kullanıcı listesinde `lead/advisor` küresel etiketinin `users_view` iznini atlaması kaldırıldı. V1'deki gibi `members` sekmesi ve `users_view` birlikte gerekli. SQL kabulünde rol okuyucusuna yalnız `lead` etiketi verilse de liste 403 kaldı; genel kabul yeniden geçti.
- `0015_greedy_gunslinger.sql` geri bildirim kaynak kimliğini benzersiz saklıyor. `stage-v1-feedback.mjs` salt okunur SQLite ve V1 özel dosya kökünden yalnız yerel kabul MariaDB'sine prova aktarımı yapıyor; İstanbul duvar saatini UTC'ye çeviriyor, sorumlu kullanıcı bağını çözmeden aktarımı durduruyor, görsel yolunu ve SHA-256 eşitliğini denetliyor. Yerel kaynakta 1 kayıt ve 1 görsel ilk çalışmada aktarıldı, ikinci çalışmada 0 yeni kayıt; yetkili HTTP 200 ile dönen 621.598 baytlık dosyanın kaynak SHA-256 değeri eşleşti. Canlı yedek ve diğer V1 tablolarının aktarımı açık.

### 11 Kasım 2026 — envanter veri aktarımı provası

- `0016_purple_ultimatum.sql` kategori, konum, malzeme, teslim, stok hareketi ve medya için benzersiz V1 kaynak kimliklerini ekledi. Migration yalnız iki yerel DB'ye (`sparkoff_v2_acceptance`, `sparkoff_v2_migration`) uygulandı. Canlı V1/VDS değişmedi.
- Ayrı `sparkoff_v2_migration` MariaDB veritabanı kuruldu; V1 rol ve kullanıcıları yalnız buraya prova aktarıldı. `stage-v1-inventory.mjs` salt okunur V1 SQLite, kaynak medya kökü ve V1 anahtar dosyasını kullanıyor; yalnız bu yerel DB'ye ve ayrı yerel medya köküne yazıyor. İlgili tabloların kaynak dışı hedef kaydı varsa duruyor. İstanbul duvar saatini UTC'ye, `fixed_asset` türünü `equipment` türüne, V1 şifreli teslim kişi alanlarını çözüp özgün ad alanına, hareketin V1 teslim kaynak bağını V2 teslim kimliğine çeviriyor. Medyayı hash doğrulamasıyla kopyalıyor; SQL başarısızsa yeni dosyayı temizliyor.
- Yerel kaynakta 2 kategori, 0 konum, 171 malzeme, 3 teslim, 173 hareket ve 1 medya ilk çalışmada toplam 350 kayıt olarak taşındı. İkinci ve sonraki çalışmalarda `inserted:0, existing:350`; stok toplamı 1525.000, teslim kaynak bağı 3/3, hareket kullanıcı bağı 173/173, medya SHA-256 eşitliği geçti. Üç teslimin ad/e-postası Laravel'in kendi decrypt çıktısıyla kişi verisi yazdırmadan 3/3 eşleşti. Değiştirilmiş geçici kaynak kopyasında stok farkı reddedildi, özgün kaynağın tekrarı yine geçti. Genel 30 birim testi, derleme ve ayrı kabul DB'sinde SQL kabulü geçti.
- Bu yalnız yerel kopya ve ayrı prova DB sonucudur. Canlı yedek sayıları, kaynak dosya/anahtar doğrulaması, üretim yükü ve VDS kabulü açık. V1 malzemenin eski tekil `image_path` alanı doluysa araç artık görseli güvenli kaynak kökünden içerik türü ve 8 MB sınırıyla okur, ayrı `inventory-legacy` dizinine SHA-256 adlı dosya olarak taşır ve `materials.image_path` alanında saklar. Kaynak yolunun kök dışına çıkması, bozuk hedef dosya ve ikinci çalıştırmada fark reddedilir. Yerel V1 kopyasında bu alan 171/171 boş olduğundan geçici sentetik SQLite/medya kopyasında pozitif, tekrar ve iki negatif senaryo sınandı; prova izi temizlenip özgün 960/960 birleşik doğrulama tekrar geçti. Bu eski alan V1'in yeni galerisinde görünmüyordu; V2 galerisine de otomatik medya kaydı olarak eklenmez. Canlı yedekte dolu kayıt varsa yayın öncesi görünürlük kararı ve dosya kabulü ayrıca gerekir.

- Bağımsız `verify-v1-stage.mjs` artık eski tekil görsellerin sayısını, hedef yolunu ve kaynak/hedef dosya SHA-256 değerini de karşılaştırıyor. Görsel içeren geçici kaynakta 1/1 ve toplam 960/960 doğrulandı; hedef dosya bozulunca reddedildi. Geçici kayıt ve dosya temizlendikten sonra özgün kaynakta 0 tekil görsel ve 960/960 kayıt yeniden doğrulandı. Görsel içeren kaynakta kullanım: `node scripts/verify-v1-stage.mjs <V1 SQLite> <V1 public dosya kökü> <V1 özel dosya kökü>`.

- Bağımsız doğrulayıcı malzeme miktarı/eşiği, teslim ve iade miktarı, stok hareketi farkı/bakiyesi olmak üzere 694 sayısal alanı binde birim hassasiyetle kaynakla karşılaştırıyor. Özgün yerel kaynakta 694/694 ve 960/960 geçti; geçici stok değişikliği reddedildi, değer geri yüklendi.

- Bağımsız doğrulayıcı artık 171 malzemenin ad, slug, stok kodu, marka, model, birim, görünürlük, etkinlik ve tür dönüşümünü de denetliyor: yerel kaynakta 1539/1539 alan eşleşti. Geçici marka sapması reddedildi ve değer geri yüklendi.

- Malzemenin kategori/konum ve teslim, stok hareketi, medya kayıtlarının malzeme/kullanıcı/ters hareket ilişkileri kaynak kimliklerinden bağımsız olarak yeniden hesaplandı: 871/871 bağ eşleşti. Yanlış stok hareketi malzeme bağı ve yanlış kategori bağı ayrı ayrı reddedildi; bağlar geri yüklendi.

- Stok hareketinin teslim kaynak türü ve kaynak kimliği de bağımsız doğrulanıyor: 173 harekette 346/346 alan eşleşti. Geçici yanlış teslim kaynağı reddedildi; prova verisi geri yüklendi.

- 173 stok hareketinin türü, gerekçesi, oluşturulma ve güncellenme zamanları İstanbul→UTC dönüşümüyle yeniden karşılaştırıldı: 692/692 alan eşleşti. Geçici gerekçe sapması reddedildi ve geri alındı.

- Bağımsız doğrulayıcı envanter medya meta verisini ve kaynak/hedef dosya SHA-256 değerini de okuyor. Yerel kaynaktaki 1 galeri dosyası eşleşti; bozuk hedef dosya reddedildi, geri yüklendi ve 960/960 kayıt yeniden doğrulandı.

- Özel geri bildirim görseli de bağımsız kaynak/hedef SHA-256, boyut, MIME ve güvenli yol denetimine eklendi. İki yerel migration DB'de 1/1 görsel ile 960/960 kayıt doğrulandı. Hedef özel görsel geçici bozulunca doğrulama reddetti; dosya geri yüklendi. Komutun üçüncü argümanı V1 özel dosya kökü, `PRIVATE_UPLOAD_DIR` ise yerel V2 hedef köküdür.

- Geri bildirimin tür, metin, durum, yönetici notu, sorumlu kullanıcı, üç tarih ve görsel özgün ad alanı da kaynakla bağımsız karşılaştırılıyor. İki ayrı yerel migration DB'de 9/9 alan ile 960/960 kayıt eşleşti; geçici durum sapması reddedilip geri alındı.

- Malzeme doğrulaması açıklama, JSON teknik özellikler, arşiv/oluşturulma/güncellenme zamanları ve kamu görünürlüğünün kaynak kuralına göre türetilmesini de kapsıyor. İki yerel migration DB'de 171 malzeme için 2565/2565 alan eşleşti; geçici teknik özellik farkı reddedilip geri alındı.

- Üç teslim kaydının tür/durum dönüşümü, notları ve altı tarih alanı da bağımsız kontrol ediliyor. İki yerel migration DB'de 30/30 alan eşleşti; geçici teslim notu sapması reddedilip geri alındı. Şifreli kişi alanlarının kontrolü ayrı Laravel çözücü provasında yapılmıştı.

- Sistem ayarlarının 12/12 JSON değeri ve İstanbul→UTC güncelleme zamanı da bağımsız doğrulamadan geçti; geçici zaman sapması reddedilip geri alındı. İkinci yerel migration DB'de aynı sonuç görüldü.

- Yazıcı, filament ve çalışma saati kayıtlarının V1 alanları iki yerel migration DB'de bağımsız karşılaştırıldı: 2 yazıcı, 4 filament, 7 çalışma saati için 116/116 alan eşleşti. Geçici filament rengi sapması reddedildi, kayıt geri yüklendi; toplam 960/960 iş kaydı korundu.

- Bağımsız doğrulayıcı 580 etkinlik kaydının kullanıcı, eylem, konu türü/kimliği, kaynak değişiklik JSON'u ve UTC zamanını da kontrol ediyor: iki yerel migration DB'de 4060/4060 alan eşleşti. Silinmiş konuların kaynak kimlikleri korunuyor; geçici yanlış eylem reddedilip geri alındı.

- Kategori ve konumların ad, kod/slug, açıklama, sıralama, görünürlük, etkinlik ve UTC tarih alanları da kaynakla bağımsız karşılaştırılıyor. Yerel kaynakta 2 kategori, 0 konum var; iki migration DB'de 14/14 kategori alanı eşleşti. Geçici bozuk kategori açıklaması reddedildi ve geri alındı. Konum alanlarının dolu kaynakla kabulü açık.

- Boş kaynak konum tablosu için ayrı SQLite kopyasına 1 sentetik konum eklendi. Yerel aktarım ilk çalışmada 1 yeni, tekrarında 0 yeni kayıt verdi; bağımsız doğrulayıcı 961/961 kayıt ve 21/21 kategori/konum alanını eşledi. Bozuk konum açıklamasını reddetti. Sentetik kaynak ve hedef kayıt temizlenince özgün 960/960 kayıt ile 14/14 alan yeniden geçti. Gerçek canlı konum verisi kabulü açık.

- Rol adı/slug/bayrak/açıklama/tarih ve kullanıcı adı/e-posta/bcrypt özeti/etkinlik/rol etiketi/tercih/tarih alanları iki yerel migration DB'de bağımsız doğrulandı: rol 14/14, kullanıcı 10/10. Parola özeti geçici bozulunca hem doğrulayıcı hem tekrar aktarım reddetti; kayıt geri yüklenince aktarım 0 yeni/1 mevcut ve toplam 960/960 geçti. Canlı hesap sayısı ve gerçek giriş kabulü açık.

- Kaynak rol izinleri V1→V2 eşlemesinden yeniden hesaplanıp etkin izin ve sekmelerle karşılaştırıldı: iki yerel migration DB'de 74/74 eşleşti. Geçici yanlış sekme reddedildi; geri yükleme sonrası 960/960 tekrar doğrulandı. Kaynakta eşlemesi olmayan izinlerin işlev eşitliği ayrı açık kapıdır.

- Envanter medyasının başlık, alternatif metin, sıralama, kapak ve iki UTC zaman alanı da bağımsız doğrulamaya eklendi. İki migration DB'de 1 medyanın 6/6 alanı eşleşti; geçici başlık sapması reddedilip geri alındı, 960/960 toplam yeniden geçti.

- Envanter medyasının kaynak dosya imzasından gerçek MIME türü de bağımsız türetilip hedef `mime` ve medya türüyle karşılaştırıldı. İki migration DB'de 1/1 dosya eşleşti; geçici yanlış MIME reddedildi, geri yükleme sonrası 960/960 geçti.

- Özel geri bildirim görselinin kaynak dosya imzası da kaynakta kayıtlı MIME ile karşılaştırıldı. İki migration DB'de 1/1 görselin gerçek JPEG/PNG/WebP türü uydu; 960/960 genel doğrulama korundu.

- Duyurunun başlık, metin, tür, yerleşim, `staff→internal` hedefi, yayın/sabitleme/onay bayrakları, başlangıç/bitiş/oluşturulma/güncellenme/yayın zamanları ve boş V1 karşılığı alanları bağımsız doğrulayıcıya eklendi; okundu/onay zamanları da kaynakla karşılaştırılıyor. Yerel kaynak sıfır olduğundan ayrı SQLite kopyasında 1 duyuru, 1 hedef rol, 1 okundu kaydı aktarıldı: ilk çalışma 1 yeni, tekrar 0 yeni; 963/963 kayıt, 16/16 duyuru alanı, 2/2 okundu zamanı eşleşti. Bozuk metin ve onay zamanı reddedildi. Temizlik sonrası özgün 960/960 geçti; canlı duyuru kabulü açık.

- Randevunun yazıcı/filament bağı, temel alanları, takip özeti, KVKK ve saklama bilgisi ile UTC zamanları bağımsız doğrulayıcıya eklendi. Ayrı SQLite kopyasındaki 1 dosyasız randevu ilk aktarımda 1 yeni, tekrarında 0 yeni kayıt verdi; 961/961 toplam, 30/30 randevu alanı eşleşti. Geçici bozuk durum reddedildi ve temizlik sonrası özgün 960/960 geçti. Dosya/geçmiş alanları ve canlı randevu kabulü açık.

- Randevu özel dosyasının randevu bağı, yol/ad/uzantı/MIME/boyut/dört zamanı ve kaynak/hedef SHA-256 içeriği; durum geçmişinin randevu/kullanıcı bağı, geçiş/not/iki zamanı bağımsız doğrulayıcıya eklendi. Ayrı SQLite ve özel dosya kopyasındaki 1 randevu/1 dosya/1 geçmiş ilk aktarımda 3 yeni, tekrarında 0 yeni kayıt verdi: 963/963 toplam, 30/30 randevu, 11/11 dosya, 7/7 geçmiş alanı eşleşti. Geçici bozuk geçmiş notu ve hedef dosya reddedildi; temizlik sonrası özgün 960/960 geçti. Canlı dosya çeşitleri ve VDS kabulü açık.

- Kapalı zamanların yazıcı bağı, bakım/kapanış türü, tam gün bayrağı, aralık, gerekçe ve iki UTC zamanı bağımsız doğrulayıcıya eklendi. Ayrı SQLite kopyasında 1 yazıcı bakımı ve 1 genel tam gün kapanış ilk aktarımda 2 yeni, tekrarında 0 yeni kayıt verdi; 962/962 toplam, 16/16 alan eşleşti. Bozuk gerekçe reddedildi; sentetik kayıtlar temizlenince özgün 960/960 tekrar geçti. Canlı takvim ve VDS kabulü açık.

### 11 Kasım 2026 — kişisel tercihler ve randevu takibi

- Profil, V1'den taşınan tema/ölçek/yoğunluk/yan menü ayarlarını okur; kullanıcı yeni etkin ayarı kaydedebilir veya varsayılana dönebilir. V1 kaynak JSON kopyası denetim için değişmeden kalır. Sistem teması işletim sistemi tercihini izler; açık tema ve yoğunluk/ölçek görsel kuralları eklendi. Yerel SQL kabulünde geçersiz değer 400, kayıt/okuma/sıfırlama ve V1 kopyasının korunması geçti. V1 kayıtlı filtreleri ve tablo alanı tercihleri ilgili V2 yönetim listelerinde uygulanıp yerel SQL kabulünden geçti; gerçek tarayıcı etkileşim kabulü açık.
- Doğrulanmış randevuya ait 64 karakterli takip anahtarıyla salt okunur durum/geçmiş ve kullanıcı iptali API ile kamu ekranına bağlandı. Kişi e-postası dönmez; bağlantı yanıtı önbelleğe alınmaz, referrer gönderilmez. Yerel SQL'de geçersiz anahtar 404, iki eşzamanlı iptal 200/200 ve yalnız bir iptal geçmişi kaydı geçti. Bu sentetik kabul V1 kaynağında randevu olmadığından canlı bağlantıyı doğrulamaz. `ONLINE_BOOKING_ENABLED` kapalı.
- Başvuru API/formu ve e-posta doğrulama eklendi. V1 biçimindeki GCODE/3MF/STL/STEP/STP/OBJ içeriği uzantıyla birlikte doğrulanır. Yazıcı satır kilidiyle aynı slot yarışı tek kayda iner; dosya özel kökte tutulur, doğrulama, takip ve yönetici durum bildirimleri SMTP ile gönderilir. Yerel test SMTP alıcısıyla gerçek çok parçalı form, bozuk dosya 400, SMTP alıcı reddinde SQL/dosya temizliği 503, eşzamanlı slot 201/409, doğrulama→takip→yönetici onayı ve üç e-posta geçti. Doğrulama süresi dolan kayıt `expired` olur; aynı bağlantı ikinci kez çalışmaz. Kamu KVKK sayfası V1 metninin bölümlerini içerir; mobil başlık bağlantıları kesilmeden görünür. `npm test` 32/32, üretim derlemesi ve genel SQL kabulü geçti. Üretim SMTP, SPF/DKIM, VDS ve gerçek tarayıcıda form etkileşimi kabulü yapılmadığı için `ONLINE_BOOKING_ENABLED=false` kalır.
- V1'in dakikalık doğrulama sonlandırması `/api/internal/expire-verifications` iç uç noktasına taşındı; günlük saklama işi mevcut `/api/internal/cron` uç noktasında kalır. Her ikisi cron sırrı gerektirir. Yerel SQL'de sırrı olmayan çağrı 403, süresi dolan kayıt `expired` ve doğrulama özeti boş olarak geçti. VDS üzerinde dakikalık/günlük zamanlayıcı kurulumu ve çalışma kaydı kabulü açıktır.

### 24 Kasım 2026 — mobil yönetim gezinmesi

- Mobil hızlı menü artık masaüstü menüsüyle aynı yetki filtresinden geçen sayfaları gösterir; üye/yönetim geçişi ve çıkış düğmesi eklendi. Yalnız duyuru izni olan hesabın duyuru rotasına yönlendirilip tekrar geri çevrilmesi düzeltildi. Etkin sayfa hızlı menüde işaretlenir. TypeScript kontrolü ve üretim derlemesi geçti. Etkileşimli tarayıcı hizmeti kullanılamadığı için gerçek dokunma/klavye kabulü açık.
- Çıkışın sunucuda başarısız olması artık oturumu arayüzde başarılıymış gibi kapatmaz; yeniden deneme mesajı gösterilir. Sunucu 401 döndürdüğünde oturum zaten geçersiz olduğundan yerel oturum temizlenir. Masaüstü ve mobil çıkış aynı hata işleyicisini kullanır. Üretim derlemesi geçti; sunucu kesintisiyle etkileşimli tarayıcı kabulü açık.
- Yerel V1 aktarımındaki Malzeme Moderatörü rolünün yalnız `inventory` sekmesi ve `inventory_view` izni olduğu görüldü; önceki yönetim kapısı bu rolü dışlıyordu. Üye ekranından yönetim envanterine geçiş artık bu iki koşulla açılır; yalnız sekmesi olan hesapta yönetim envanteri bağlantısı gizlenir ve rota reddedilir. Giriş rotası ile mobil/masaüstü menü aynı yardımcı kuralı kullanır. Üç odaklı test dahil 35/35 test ve üretim derlemesi geçti; gerçek tarayıcı kabulü açık.

- 25 Kasım yerel Chromium/Playwright örnek mod taramasında 320/360/390 px kamu ana sayfası ve giriş ekranı ile 320 px'de 18 üye/yönetim rotası, hızlı menü, yönetim→envanter→üye geçişi ve üye rolündeki yönetim bağlantısı kontrol edildi: yatay taşma ve JavaScript hatası görülmedi. Tarama örnek moddaki Sistem Yöneticisi'nin `users_*`/`roles_*` izinleri eksik olduğu için Üyeler ekranını eksik gösterdiğini ortaya çıkardı. Örnek mod artık Sistem Yöneticisi izinlerini ortak `PERMISSIONS` listesinden alıyor; 320 px'de Üye listesi, Özel roller, dört yönetim eylemi ve açılır formlar göründü, taşma olmadı. 35/35 test ve üretim derlemesi geçti. Bu örnek mod kabulüdür; gerçek SQL rolü, dokunmatik cihaz ve VDS kabulü ayrıca açık.
- Ziyaretçi başlığı 700 px ve altında üç çizgili açılır menüye dönüştürüldü. Menünün kapalı/açık görünümü, `aria-expanded`, klavyeyle açma, Malzemeler bağlantısıyla geçiş ve rota değişince kapanma yerel Chromium'da 320/390 px; masaüstü menüsünün korunması 768 px'de doğrulandı. Üç genişlikte yatay taşma ve JavaScript hatası yok; TypeScript/üretim derlemesi geçti.
- Ana sayfa iletişim bilgileri boş satırlar yerine telefon, WhatsApp ve e-posta kartlarında gösteriliyor; uygun bağlantılar doğrudan arama/mesaj/e-posta eylemi açıyor, iletişim saatleri ayrı satırda. 320/390/768 px'de bağlantı hedefleri, görünüm, yatay taşma ve tarayıcı hatası denetlendi. 320 px görsel kontrolünde başlıktaki menü düğmesinin ikinci satıra düştüğü görüldü; üye girişi açılır menüye alınarak başlık tek satır ve 62 px oldu. Üye girişine mobil menüden geçiş ve masaüstü bağlantısı yeniden denetlendi.
- Geri bildirim formunda başarılı gönderimin ardından yeni metin yazılınca eski başarı mesajının kaldığı mobil tarayıcıda yeniden üretildi. Tür, metin veya görsel değişince ve rotadan çıkıp dönünce başarı/hata durumu temizleniyor; devam eden gönderim düğmeyi kilitliyor. 320 px'de ilk gönderim, yeni metin, tekrar gönderim ve rota dönüşü etkileşimleri geçti; yatay taşma ve JavaScript hatası yok. Eşzamanlı çift tıklama kilidi kodda var, gecikmeli gerçek sunucuyla tarayıcı kabulü hâlâ açık.
- Örnek modda geri bildirim görseli sayfa yenilenince bağlantıdan kayboluyordu. Görsel tarayıcının Cache Storage alanına kaydedilip yönetim listesi yüklenirken yeniden açılıyor; örnek veriyi sıfırla bu alanı da temizliyor. 320 px Chromium'da görselli gönderim→giriş→tam sayfa yenileme→yönetim görsel bağlantısı/68 bayt okuma→sıfırlama akışı geçti. Canlı V1 ve gerçek V2 dosya deposu ayrı kabul konusudur.
- Gerçek yerel kabul SQL sunucusunda 320 px mobil formdan PNG geri bildirimi gönderildi; yönetici oturumunda özel dosya 200, `image/png` ve 68 bayt döndü, test kaydı/dosyası temizlendi. 320/390 px dokunma benzetiminde gerçek yönetici hesabının hızlı menüsüyle üye→yönetim→geri bildirim→üye geçişi ve yatay taşma denetimi geçti. Yönetimden geçici WhatsApp numarası kaydedilip SQL satırı, kamu API yanıtı ve ana sayfa bağlantısı eşlendi; özgün ayar geri yüklendi. Uluslararası telefonun `tel:` bağlantısında `+` işareti korunuyor; gerçek SQL kamu sayfasında 320/390 px'de doğrulandı. Fiziksel cihaz ve VDS kabulü açık.
- 320 px dokunma benzetiminde gerçek SQL'e ziyaretçi geri bildirimi gönderildi; yönetici düzenleme penceresinde durum `resolved` ve not kaydedildi, çözüldü filtresinde kayıt/not görüldü ve SQL alanları karşılaştırıldı. Test geri bildirimi ile ilgili audit kaydı temizlendi; yatay taşma ve tarayıcı hatası görülmedi. Fiziksel cihaz ve diğer rol arayüzleri hâlâ açık.
- Atölye ve iletişim yönetim formunda başarılı kayıttan sonra alan değiştirildiğinde eski `Ayarlar kaydedildi.` mesajı ekranda kalıyordu. Telefon, WhatsApp, e-posta, iletişim saatleri ve çalışma günü/saatleri değişiklikleri artık bu onayı ve eski hata metnini temizliyor. 320 px örnek modda dört metin alanı ve gün seçimi sırayla değiştirilip doğrulandı; taşma ve tarayıcı hatası yok, üretim derlemesi geçti.
