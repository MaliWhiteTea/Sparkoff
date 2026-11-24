# Sparkoff V2 — yeni sohbet devir promptu (11 Kasım 2026)

> Güncelleme: Bu dosyanın aşağıdaki durumu ilk devir anına aittir. Kullanıcı yeni sohbette “ben dur diyene kadar durma”, “resume” ve “devam” dedi; önceki sohbetin durma talimatı artık geçerli değildir. Güncel uygulama ve açık kapılar için [yol haritasının çalışma kaydını](SPARKOFF_V2_YENI_ROADMAP.md) esas al.

## Bu sohbetin güncel ekleri

- Yerel V1 kaynak kopyasındaki 22 iş tablosu iki ayrı V2 migration DB'sine bağımsız doğrulamayla **960/960** taşındı. Kaynak canlı yedek değildir; canlı fark ve VDS kabulü açık.
- V2 çevrimiçi başvuru, model dosyası, doğrulama, takip, iptal ve SMTP akışı yerel kabulde çalıştı. Dakikalık doğrulama sonlandırma uç noktası eklendi. Gerçek SMTP, cron ve 3 GB VDS kabulü açık olduğundan `ONLINE_BOOKING_ENABLED=false` kalır.
- V1 arayüz, kayıtlı filtre ve tablo alanı tercihleri V2 yönetim ekranlarına bağlandı. V1 JSON arşivi korunur; envanter kategori ve demirbaş türü çevrilir, filtre başına 10 sınırı ve alan izinleri doğrulanır.
- V2 ziyaretçi kataloğuna arama, kategori, stok, sıralama, favori, teknik ayrıntı ve sayfa boyutu eklendi. Kamu API sınırında gizli konum ve miktar yerel SQL ile denetlendi. Sunucu yanıtı sayfalı; DB filtreleme maliyeti ve 3 GB yük kabulü açık.
- Son doğrulamada `npm run build`, 32/32 birim testi, genel SQL, randevu başvurusu ve takip kabulü geçti. Masaüstü ve dar ekranda örnek mod görüntüsü incelendi; etkileşimli tarayıcı kabulü hâlâ açık.

> Bu dosyayı yeni sohbette Codex'e ver: “Bu dosyayı ve işaret ettiği güncel belgeleri oku. Kod, `git status`, migration ve testlerle gerçek durumu doğrula. V1'in çalışan özellikleriyle V2'yi eşitle; sonra V1'in açık işlerini, sonra V2'ye özgü özellikleri ilerlet. Önceliği kendin belirle. Türkçe yaz. Canlı V1'e ve VDS'ye izinsiz yazma. Rol mantığı V1'le aynı olsun: yalnız gerçek `is_system` sistem rolü tam yetki verir, diğer kullanıcıların izinleri atanmış rollerin birleşimidir. Tamamlanmış işleri gereksiz yere tekrar yazma; sıradaki açık işi uygula ve kabul et. Yeni sohbetteki kullanıcı yönlendirmesi bu kayıttan üstündür.”

## Kullanıcının son yönlendirmesi

- Önceki sohbette kullanıcı yeni sohbete geçmek için durulmasını istedi. Bu yalnız önceki sohbetin kapanış talimatıdır; yeni sohbetteki “ben dur diyene kadar durma” yönlendirmesi geçerlidir.
- Kullanıcı daha önce değişiklikleri göremediğini söylemişti. Görünür **örnek mod** `http://127.0.0.1:5174/`; ayrı MariaDB/API kabul ortamındaki kayıtlar demo verisi değildir. Her yeni işte hangi ortamda görüldüğünü açık söyle.
- Kullanıcı için V1 rol mantığı kritik. Küresel `admin/auditor/lead/advisor` etiketleri V1 rol izni yerine geçmemeli. `super_admin` yalnız gerçek sistem rolü veya yerleşik V2 bootstrap yöneticisi için kullanılır.

## Kaynak ve çalışma sırası

1. [Güncel yol haritası](SPARKOFF_V2_YENI_ROADMAP.md), [veri geçişi sözleşmesi](SPARKOFF_V1_V2_VERI_GECIS_SOZLESMESI.md), [59 izin eşlemesi](SPARKOFF_V1_V2_59_IZIN_ESLEMESI_2026-11-10.md) ve bu devir dosyasını oku. 10 Kasım tarihli [eski devir kaydı](SPARKOFF_V2_YENI_SOHBET_DEVAM_PROMPTU_2026-11-10.md) tarihsel ayrıntı içerir; eski “henüz yok” ifadeleri güncel gerçek sayılmaz.
2. `git status --short`, `v2/src/shared/schema.ts`, `v2/src/server/auth.ts`, ilgili API/UI, `v2/drizzle/meta/_journal.json` ve çalışan portları doğrula. `v2/` ile `md/` hâlâ git tarafından **untracked** görünüyor; yanlışlıkla silme/temizleme. `.gitignore` değişikliği de var. Mevcut işi commit etme talebi yoktu.
3. V1 canlı sistemi, Ubuntu VDS ve DNS değiştirilmedi. Yerel `database/database.sqlite` salt okunur kaynak kopyadır, **canlı yedek değildir**. Kaynak SHA-256: `ef4a13d5cef1d00fdd8707097f0d068a624d82c65cfe6713c2d54c12b3411f73`. Yerel kaynak ile canlı kopya sayıları farklı olabilir; yeni yedekte tüm ön kontrol ve sayısal kabulü yeniden yap.
4. Hedef 3 GB RAM'li Ubuntu VDS, Nginx/systemd/MariaDB/HTTPS; cPanel hedef değil. VDS kabulü, yedek geri yükleme, SMTP ve canlı yayın kapıları açık. `ONLINE_BOOKING_ENABLED=false` kalmalı.

## Şimdiye kadar uygulanan V2 parçaları

- React/Vite örnek mod ve Hono/Drizzle/MariaDB API, başlangıç migrasyonları, oturum/CSRF, birim/oda üyeliği, görev/sohbet ve kamu kataloğu temeli var. Bunlar tam V1 ekran eşitliği anlamına gelmez.
- Envanter: malzeme/kategori/konum oluşturma, düzenleme, arşiv, tür sınırı, stok hareketi ve kısa geri alma; sarf, ödünç, demirbaş teslimi; kısmi iade, hasar/kayıp, tarih uzatma, ters işlem ve yarış koruması; kişi alanı izni ve saklama; CSV/XLSX içe/dışa aktarım, sütun eşleme, önizleme, karışık satır ve formül güvenliği; görsel/video/HTTPS medya ve kapak var. Büyük veri, bütün V1 ekran/işlev türleri ve gerçek tarayıcı kabulü açık.
- Yazıcı/filament durum ve teknik alanları, yedi günlük çalışma saati, bakım/kapalı zaman yönetimi, salt okunur yedi günlük müsaitlik var. Randevu şeması, yönetici incelemesi, baskı durum zinciri, geçmiş/audit, kişi maskeleme, özel model dosyası indirme ve saklama/cron mantığı kısmen var. Kamu başvurusu, e-posta doğrulama/takip/iptal, özel dosya yükleme, gerçek SMTP ve tam uçtan uca yarış kabulü **açık**. Çevrimiçi randevuyu açma.
- Çoklu V1 rol bağı `user_custom_roles` ile çözümleniyor; yerel V1 sistem rolü `custom_roles.isSystem` olarak sahnelenebiliyor. 59/59 V1 izin anahtarı V2 anahtarına eşlendi; bu tam işlev/ekran paritesi değildir. Bcrypt `$2y$` özet ilk doğru girişte atomik scrypt yükseltmesine gider. Rol, kullanıcı, hesap pasifleştirme, parola sıfırlama, son yönetici koruması ve audit için ayrı izin kapıları var. `admin/auditor` örtük hakları kaldırıldı; `lead/advisor` etiketi kullanıcı listesini `users_view` olmadan açamıyor. **V2 doğumlu** üye/lead varsayılan izinleri ve bütün UI koşulları ayrıca V1 rol mantığı açısından taranmalı.
- Duyuru: kamu/iç hedef, `view/create/update/archive`, rol hedefleme, okundu onayı, tür/yerleşim, taslak/yayın ve zaman aralığı API/UI ve yerel SQL'de çalışıyor. Kaynak duyuru kayıtları yerelde 0; canlı aktarım ve tarayıcı kabulü açık.
- Geri bildirim: 30'luk sayfalı yönetim listesi, durum/not ve audit, JPG/PNG/WebP isteğe bağlı görsel, 5 MB/6000×6000 sınırı, özel dosya ve yalnız `feedback_view` ile okuma, IP başına 5/dakika ve 6 MB akış sınırı var. Demo görsel URL'si sayfa yenilenince kaybolur. Yerel kaynak 1 kayıt/1 görsel `stage-v1-feedback.mjs` ile **yalnız kabul DB'sine** taşındı, tekrarında 0 ekleme, yetkili HTTP 200 ve kaynak hash eşitliği geçti.
- Atölye iletişim/çalışma saati, KVKK sorumlu/iletişim/sürüm/taslak/saklama alanları ve randevu kuralı ayarları ayrı izinlerle UI/API'de var. Randevu kuralındaki slot/azami süre müsaitlikte kullanılıyor; doğrulama beklemesi, dosya boyutu ve uzantı alanları başvuru kapalı olduğu için gerçek başvuru akışına bağlanmadı.

## 11 Kasım envanter aktarımı — yeni tamamlanan iş

- `v2/drizzle/0016_purple_ultimatum.sql` kategori, konum, malzeme, teslim, stok hareketi ve medyaya benzersiz `legacy_*_id` alanları ekledi. `0015` geri bildirim legacy kimliği; `0013/0014` kullanıcı ve sistem rolü alanlarıdır. `0016` **yalnız** iki yerel DB'ye uygulandı.
- İkinci yerel DB `127.0.0.1:4319/sparkoff_v2_migration` kuruldu; aynı yerel MariaDB sunucusunda kabul DB'sinden ayrıdır. `storage/framework/local-test-v2/mariadb-runtime/migration.env` bağlantı ayarlarını tutar, gizlidir ve git'e eklenmez. Ayrı medya kökü `.../mariadb-runtime/migration-uploads`. Kabul DB'si `sparkoff_v2_acceptance`, API portu 4320 ve demo 5174 etkilenmedi.
- `v2/scripts/stage-v1-roles.mjs` ve `stage-v1-users.mjs` yerel migration DB'sini de kabul edecek biçimde sınırlandı. Migration DB'sinde kaynak 2 rol, 1 kullanıcı ve 1 rol bağı hazırlandı. Kabul DB'sinde kaynak sistem kullanıcısı önceki testlerde bilinçli temizlenmişti; migration DB'dekini silme.
- `v2/scripts/stage-v1-inventory.mjs` V1 SQLite'ı salt okunur açar; V1 medya kökü ve V1 `.env` anahtarı ister. Yalnız migration DB ve yerel medya köküne yazabilir. Kategori/konum→malzeme→teslim→stok hareketi→medya sırasını, ID bağlarını, İstanbul→UTC saatini, `fixed_asset→equipment` dönüşümünü ve V1 Laravel AES-256-CBC/MAC şifreli kişi alanlarını işler. Kaynak dışı hedef envanter kaydı varsa durur; SQL işlemi başarısızsa yeni medyayı siler. Medya SHA-256 değeri ve stok toplamı kontrol edilir. V1 eski tekil malzeme `image_path` doluysa sessizce atlamaz, aktarımı durdurur.
- Yerel kaynakta **2 kategori, 0 konum, 171 malzeme, 3 teslim, 173 hareket, 1 medya = 350 kayıt** ilk çalışmada taşındı; ikinci ve sonraki çalışmalarda `inserted:0, existing:350`. Stok toplamı 1525.000; 3/3 teslim kaynak bağı, 173/173 hareket kullanıcı bağı ve medya SHA-256 eşitliği geçti. Üç teslimin alıcı adı/e-postası PHP Laravel `Encrypter` çıktısıyla **içeriği yazdırmadan** 3/3 karşılaştırıldı. Değiştirilmiş geçici SQLite kopyası `materials.quantity` farkıyla reddedildi; özgün kopyanın tekrarı geçti. Ön kontrolde 173 hareket zinciri ve son bakiye tutuyor; 1 malzemede hiç hareket yok.
- Komutlar (`v2/` içinde, gerçek kaynak anahtarını çıktıya yazdırma):

  ```bash
  set -a; source ../storage/framework/local-test-v2/mariadb-runtime/migration.env; set +a
  node scripts/stage-v1-roles.mjs ../database/database.sqlite --apply
  node scripts/stage-v1-users.mjs ../database/database.sqlite --apply
  node scripts/stage-v1-inventory.mjs ../database/database.sqlite ../storage/app/public ../.env
  node scripts/stage-v1-inventory.mjs ../database/database.sqlite ../storage/app/public ../.env --apply
  ```

- Bu **yerel veri provasıdır**. Canlı V1 yedeği, eski tekil malzeme görseli, canlıda ortaya çıkabilecek farklı hareket türleri, diğer V1 tabloları, VDS, yetkili UI ve büyük veri kabulü tamamlanmadı. Migration DB'yi canlı hedefe dönüştürme.

## Son doğrulama ve ortamı açma

- Son çalışmada `cd v2 && npm test && npm run build`: **30/30 geçti**, üretim derlemesi geçti. `v2/scripts/sql-acceptance.mjs` 4320 kabul API + 4319 kabul DB üzerinde geçti. Bu test migration DB'yi değil kabul DB'sini kullanır; envanter aktarımı ayrıca yukarıdaki prova ve SQL/hash kontrolleriyle doğrulandı. Gerçek mobil/masaüstü tarayıcı ve VDS kabulü bu turda yapılmadı.
- Portlar kontrol anında 5174 demo, 4319 MariaDB, 4320 kabul API olarak açıktı; yeni sohbet sırasında süreçler kapanmış olabilir. `ss -ltnp | rg ':(5174|4319|4320)\b'` ile bak. Demo: `SPARKOFF_V2_NO_BROWSER=1 scripts/start-local-test-v2.sh`. API, kabul `.env` ile `PORT=4320 ONLINE_BOOKING_ENABLED=false PRIVATE_UPLOAD_DIR=/home/mert/Documents/Proje/Sparkoff/storage/framework/local-test-v2/private-appointment-files node v2/dist/server/index.js` biçiminde açıldı. MariaDB binary: `storage/framework/local-test-v2/mariadb-runtime/root/usr/bin/mariadbd`, datadir aynı runtime altındaki `data`, port 4319, socket `/tmp/sparkoff-v2-acceptance.sock`; eski özetteki başlatma parametrelerini kullan.
- MariaDB kabul testinde `DATABASE_URL`, `ACCEPTANCE_ADMIN_EMAIL/PASSWORD`, `CRON_SECRET` `acceptance.env` içindedir; bunları kullanıcıya, loga veya commit'e yazma. `migration.env` de bağlantı sırrı içerir. V1 `.env` içindeki `APP_KEY` şifreli kişi verisini çözmek için gereklidir; kaynakla eşleşmeyen anahtarda aktarımı durdur.
- Son `git status`: `.gitignore` modified; `docs/design/`, `md/`, `scripts/audit-v1-sqlite.py`, `scripts/start-local-test-v2.sh`, `v2/` untracked. Bunlar bu uzun çalışmanın parçalarıdır. `git clean`, sıfırlama veya mevcut veriyi ezme yapma.

## Sıradaki işler ve yayın kapıları

1. **Veri geçişini tamamla:** V1 canlı SQL ve dosyaların güncel salt okunur yedeğini sabitle; yerel kopyayla farkını ölç. Yazıcı/filament/çalışma saati, ayarlar, duyuru ve hedef bağları, etkinlik/audit, randevu/dosya/geçmiş gibi kalan tabloları bağımlılık sırasıyla aktar. Yerelde boş olan tablolara özel sentetik kaynakla negatif ve idempotent test ekle. Envanter aracındaki eski `inventory_items.image_path` alanı, canlıda farklı `source_type`, tarih kaynakları ve medya MIME doğrulaması ayrıca çözülmeli. Her tabloda kaynak = taşınan + belgeli dışarıda bırakılan sayısı, FK, stok zinciri ve dosya SHA-256 kabulünü belgeleyip aynı sabit kaynaktan ikinci temiz kurulumu doğrula.
2. **V1 işlev/eşitlik açıklarını kapat:** Özellikle tam randevu kamu başvurusu, e-posta doğrulama/takip/iptal, model dosyası yükleme, gerçek SMTP; çevrimiçi bayrak ancak tüm güvenlik/yarış testlerinden sonra açılır. Kullanıcı/rol, envanter, yazıcı, duyuru, ziyaretçi, kişisel ayar ve rapor ekranlarında V1 akışlarıyla gerçek API/UI karşılaştırmasını sürdür. 59/59 anahtar eşlemesi tek başına tamamlanma sayılmaz.
3. **Gerçek kabul:** VDS'de Nginx/HTTPS/systemd/sınırlı DB kullanıcısı, özel dosya kökü, cron, SMTP, yedek ve geri yükleme, 3 GB RAM yükü; rol başına 200/403, 97 rota ve 390 manuel V1 maddesine uyarlanmış kontrol, mobil/masaüstü/erişilebilirlik, eşzamanlı istek ve geri dönüş/DNS planı. Yayın için ayrıca kullanıcı kararı gerekir.
4. **V1 açık işleri ve V2 ekleri:** [V1 ROADMAP](../ROADMAP.md) içindeki 11 açık madde V2'de kapanmadan ve V1 paritesi sağlanmadan görev/sohbet/PWA gibi yeni genişletmeleri yayın ölçütü sayma.

## Dikkat edilmesi gereken gerçek sınırlar

- Yerel kaynakta 1 kullanıcı, 2 rol, 1 rol bağı, 59 izin, 171 malzeme, 173 hareket, 3 teslim, 1 medya, 2 yazıcı, 4 filament, 7 çalışma saati, 12 ayar, 1 geri bildirim, 580 etkinlik; randevu ve duyuru 0. Canlı sistem farklı olabilir.
- V1 `recipient_name`/`recipient_email` Laravel `encrypted` cast; anahtar eksik/yanlışsa kişisel veri sessizce kaybedilmez. Kişi verisini fark raporuna veya test çıktısına yazma. Anonimleştirilmiş kaydı geri canlandırma.
- V1 `Europe/Istanbul` saatleri çoğunlukla saat dilimsiz; prova aracı Eloquent alanlarını İstanbul duvar saati olarak çevirdi. Doğrudan SQL/CURRENT_TIMESTAMP kaynakları canlı veride ayrıca sınıflandırılmalı. V2 DB oturumları UTC.
- V1 `is_system` rolü tek tam yetki kaynağı; diğer kullanıcıların yetkisi rol bağlarının birleşimi. V2 yerleşik bootstrap `super_admin` istisnası ve V2-native varsayılan rollerin kapsamı ayrıca denetlenmeli. `lead/advisor` birim ilişkisi V1 özel rolü yerine geçmez.
- Örnek mod 5174 canlı API verisini göstermez. Yerel aktarım kayıtlarını görmek için ayrı yerel API/DB gerekir; V1/VDS verisi otomatik görünmez.
- Bu dosyanın önceki sohbet için yazılmış kapanış satırı yeni sohbette çalışma sınırı oluşturmaz.
