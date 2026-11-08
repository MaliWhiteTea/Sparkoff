# Sparkoff — proje geçmişi ve altyapı haritası

**Kapsam tarihi:** 8 Kasım 2026

**Kaynak sürüm:** `main`, `16206e7`

**Amaç:** Projede bugüne kadar yapılan işleri ve kodun, verinin, dosyaların, yayın altyapısının nerede bulunduğunu tek yerden göstermek.

Bu belge Git geçmişi, mevcut kaynak kod, README, yol haritası, dağıtım rehberi ve denetim kayıtlarına dayanır. **Kodun depoda bulunması, aynı sürümün canlı sunucuda kurulu veya her akışın canlıda kabul edilmiş olduğu anlamına gelmez.** Canlı sunucu yolları ve veritabanı adı, kullanıcının paylaştığı cPanel ekranı ile hata kayıtlarından alınmıştır; bu belge hazırlanırken sunucuya bağlanıp tekrar doğrulanmadı. Parola, anahtar ve `.env` içeriği bu dosyaya alınmadı.

## 1. Kısa durum özeti

- Kamu portalı, yazıcı/filament sayfaları, malzeme kataloğu, geri bildirim ve KVKK sayfası geliştirildi.
- Yönetim panelinde rol/izin, yazıcı ve takvim ayarları, envanter, stok, teslim/iade, duyuru, talepler, kullanıcılar, ayarlar, işlem geçmişi ve kişisel çalışma alanı var.
- Çevrimiçi randevu kodu, doğrulama, takip, dosya yükleme, yönetici değerlendirmesi ve saklama görevleri mevcut. `ONLINE_BOOKING_ENABLED` kapalı alpha için `false` tutulmalı; gerçek SMTP ve canlı kabulü bitmedi.
- Envanterde marka/model, CSV/XLSX içe aktarma, CSV dışa aktarma, medya, toplu işlem ve güvenli geri alma geliştirildi. Doğrudan Google Sheets bağlantısı yok.
- GitHub Actions, MySQL 8.4 ve MariaDB 10.11 üzerinde migration/seed, TypeScript, ön yüz derlemesi ve PHP testlerini çalıştırıyor. `16206e7` için [CI sonucu](https://github.com/MaliWhiteTea/Sparkoff/actions/runs/42491035595) başarılı.
- Kapalı alpha canlı sitede kullanıcı tarafından açılıp bazı akışlar denenmişti. Yerelde bulunan ve `main` dalına gönderilen son düzeltmelerin canlıya yayınlandığı **doğrulanmadı**.
- Tam kapsamlı denetim sürüyor. [390 maddelik planın](ALPHA_UCTAN_UCA_MANUEL_TEST_PLANI.md) tamamı henüz sonuçlandırılmadı.

## 2. Bugüne kadar yapılanlar — zaman çizelgesi

| Dönem | Tamamlanan ana işler | Kaynak |
|---|---|---|
| **26–29 Eylül** | Yol haritası, ilk responsive ana sayfa, Laravel/Inertia/React temeli, çok adımlı randevu, veritabanı, dosya/e-posta doğrulaması, müsaitlik, ilk yönetim paneli ve takvim. | `git log` (`4d1bc00`–`006f1da`) |
| **3–4 Ekim** | Atölye portalı, kamu yazıcı durumu ve takvimi, yönetilebilir iletişim/çalışma saatleri, duyurular, işlem geçmişi, güvenlik ve cPanel için bölünmüş dizin giriş dosyası. | `git log` (`22ac341`–`436f169`) |
| **16 Ekim** | Randevu akışı kişisel veriyi azaltarak düzenlendi; yerel test başlatma/kapatma komutları eklendi. | `git log` (`582df35`, `2aba25d`) |
| **19–21 Ekim** | Çoklu rol ve izin sistemi, kullanıcı/rol ekranı, envanter tabloları ve arayüzü, stok hareketleri, teslim/iade, kamu malzeme kataloğu, CSV içe/dışa aktarma, birleşik duyuru, anonim geri bildirim, kişisel görünüm ayarları, medya ve liste sıralama. | `git log` (`3c744eb`–`3355dca`) |
| **22–28 Ekim** | Açık/koyu tema ve erişilebilirlik, yazıcı/randevu çakışma kuralları, otomatik saklama, kişisel filtreler ve sütunlar, toplu işlemler, MySQL/MariaDB CI, cPanel kabul rehberi. | `git log` (`ccdb71a`–`b90a7d6`) |
| **29–30 Ekim** | Yönetim genel bakış, hızlı arama/işlemler, bildirimler, son görüntülenenler, güvenli taslak ve ayrılma uyarısı, kişisel parola değiştirme, alpha test planı ve canlıda görülen rol/migration sorununun onarımı; tester geri bildirimleri ve görsel yükleme. | `git log` (`95cb143`–`6af42a7`) |
| **2–6 Kasım** | Güvenli geri alma, envanter marka/model, gelişmiş katalog filtreleri/favoriler, aktarım veri kalitesi özeti, XLSX desteği ve tam denetim ön raporu. | `git log` (`299874d`–`a77e67e`) |
| **7–8 Kasım** | Denetimde bulunan stok, veri gizliliği, dosya hatası ve mobil arayüz bulguları düzeltildi; ek HTTP ve gerçek tarayıcı kontrolleri yapıldı; dokümanlar güncellendi. | [7 Kasım kaydı](YEREL_DENETIM_CALISMA_KAYDI_2026-11-07.md), [8 Kasım kaydı](YEREL_DENETIM_CALISMA_KAYDI_2026-11-08.md) |

Bu tablo commitlerin konu özetidir; tek tek her değişiklik ve tarihi için `git log --oneline --date=short` esas kayıttır.

## 3. Uygulama mimarisi ve kaynak konumları

Yerel depo kökü: `/home/mert/Documents/Proje/Sparkoff`

Uzak Git deposu: `https://github.com/MaliWhiteTea/Sparkoff` (`origin/main`)

| Katman | Depodaki konum | Görevi |
|---|---|---|
| HTTP rotaları | `routes/web.php` | Kamu ve `/yonetim` adresleri, HTTP yöntemleri, throttle ve yetki middleware'leri. |
| Zamanlanmış komutlar | `routes/console.php` | Yönetici oluşturma/kontrol, anonimleştirme ve randevu saklama komutları; scheduler takvimi. |
| Sunucu giriş noktası | `public/index.php`, `bootstrap/app.php` | Laravel isteğini başlatma ve middleware tanımları. |
| Denetleyiciler | `app/Http/Controllers/`, `app/Http/Controllers/Admin/` | İstek/yanıt ve iş akışları. |
| İş kuralları | `app/Services/`, `app/Support/`, `app/Enums/` | Stok, teslim, müsaitlik, bildirim, arama, geri alma ve CSV sözleşmesi. |
| Yetki/istek katmanı | `app/Http/Middleware/`, `app/Http/Requests/`, `config/permissions.php` | Yetki kontrolü, randevu girdi doğrulaması ve güvenlik başlıkları. |
| Arayüz giriş noktası | `resources/js/app.tsx` | Inertia sayfa çözümlemesi ve ortak bileşenler. |
| Sayfalar ve bileşenler | `resources/js/pages/`, `resources/js/components/`, `resources/js/hooks/` | React ekranları, menüler, formlar, tablolar ve tarayıcı taslakları. |
| Stiller | `resources/css/app.css`, `resources/css/admin-shell.css` | Kamu/yönetim teması ve mobil kırılımlar. |
| Veri modeli | `app/Models/`, `database/migrations/`, `database/seeders/` | Eloquent modelleri, şema ve başlangıç rolleri. |
| Ayarlar | `config/`, `.env.example`, sunucuya özel `.env` | Özellik bayrağı, veritabanı, posta, depolama, oturum ve kuyruk yapılandırması. Gerçek `.env` Git'te tutulmaz. |
| Test/CI | `tests/`, `phpunit.xml`, `.github/workflows/database-acceptance.yml` | PHP testleri ve MySQL/MariaDB kabul akışı. |
| Yayın köprüsü | `deployment/cpanel-index.php` | `public_html` ile dışarıdaki `sparkoff_app` dizinini bağlayan örnek giriş dosyası. |
| Yerel yardımcılar | `scripts/start-local-test.sh`, `scripts/stop-local-test.sh` | Yerel PHP/Vite test sunucularını açma/kapatma. |

### Modül → kod → veritabanı eşlemesi

| Modül | Arayüz | Sunucu kodu | Ana veri tabloları/modeller |
|---|---|---|---|
| Ana sayfa, iletişim ve duyurular | `resources/js/pages/Home.tsx`, `components/PublicHeader.tsx`, `PublicFooter.tsx` | `HomeController`, `Admin/WorkshopSettingsController`, `Admin/AnnouncementController` | `settings`, `announcements`, `announcement_role`, `announcement_user` |
| Yazıcı, haftalık saat ve kapalı zaman | `Printers.tsx`, `Admin/Settings/Printers.tsx`, `Admin/Calendar.tsx` | `PrinterPortalController`, `Admin/PrinterSettingsController`, `Admin/CalendarController`, `PublicPrinterScheduleService` | `printers`, `operating_hours`, `blackout_periods` |
| Filamentler | `Filaments.tsx`, `Admin/Settings/Filaments.tsx` | `FilamentController`, `Admin/FilamentSettingsController` | `filaments` |
| Randevu, doğrulama, takip, KVKK | `Booking.tsx`, `VerificationResult.tsx`, `TrackAppointment.tsx`, `PrivacyNotice.tsx`, `Admin/Appointments/` | `AppointmentController`, `PrivacyController`, `Admin/AppointmentController`, `AppointmentAvailabilityService` | `appointments`, `appointment_files`, `appointment_status_histories`, `settings` |
| Envanter, marka/model ve katalog | `Materials.tsx`, `Admin/Inventory/Index.tsx` | `InventoryCatalogController`, `Admin/InventoryController`, `InventoryStockService` | `inventory_items`, `inventory_categories`, `inventory_locations`, `stock_movements` |
| Malzeme medyası | `Admin/Inventory/Index.tsx`, `Materials.tsx` | `Admin/InventoryMediaController` | `inventory_media` ve kamu dosyaları |
| CSV/XLSX aktarımı | `Admin/Inventory/Import.tsx` | `Admin/InventoryImportController`, `InventoryCsvContract` | Envanter tabloları ve `activity_logs` |
| Teslim/iade | `Admin/InventoryTransactions/Index.tsx` | `Admin/InventoryTransactionController`, `InventoryTransactionService` | `inventory_transactions`, `stock_movements` |
| Geri bildirim | `Feedback.tsx`, `Admin/Feedback/Index.tsx` | `FeedbackController`, `Admin/FeedbackController` | `feedback_reports` ve özel görsel dosyaları |
| Kullanıcı, rol, izin | `Admin/Access/Index.tsx` | `Admin/AccessController`, yetki middleware'leri, `RolePermissionSeeder` | `users`, `roles`, `permissions`, `role_user`, `permission_role` |
| Kişisel çalışma alanı | `Admin/Dashboard.tsx`, `AdminLayout.tsx`, `AdminQuickSearch.tsx`, `AdminNotifications.tsx` | `Admin/DashboardController`, `AdminQuickSearchService`, `AdminNotificationService`, `AdminRecentRecordService` | `users` tercih alanları, `admin_notification_reads`, `recently_viewed_records` |
| İşlem geçmişi/geri alma | `Admin/ActivityLogs.tsx`, `AdminUndoNotice.tsx` | `Admin/ActivityLogController`, `Admin/UndoController`, `AdminUndoService` | `activity_logs`, `undo_actions` |

Tablo tanımları `database/migrations/` altındadır; yönetim ayarlarının önemli bir bölümü tek `settings` tablosunda anahtar/değer olarak saklanır. Ekran yolu ile gerçek HTTP adresi eşlemesi için `routes/web.php` kullanılmalıdır.

## 4. Veri, dosya ve ayarlar nerede saklanıyor?

| Bilgi | Depolama/konum | Not |
|---|---|---|
| Uygulama kayıtları | Aktif `DB_CONNECTION`/`DB_DATABASE` ile seçilen SQL veritabanı | Kullanıcılar, roller, yazıcılar, randevular, envanter, stok hareketleri, teslimler, talepler, ayarlar ve denetim kayıtları. Şema `database/migrations/` içinde; verinin kendisi Git'te değil. |
| Yerel SQLite varsayılanı | `database/database.sqlite` (`config/database.php` varsayılanı) | Gerçek yerel `.env` farklı veritabanı seçebilir. Son tarayıcı denetimi yalnız `/tmp/sparkoff-browser-audit-2026-11-08.sqlite` sentetik kopyasını kullandı; kalıcı proje verisi sayılmamalı. |
| Canlı MySQL adı | `qmypllhw_sparkoff` | Kullanıcının 29 Ekim hata günlüğündeki ad; bugünkü etkin ayar ayrıca doğrulanmadı. Parola ve kullanıcı adı burada yok. |
| Özel randevu modelleri | `storage/app/private/appointments/{public_id}/...` | `local` diski; doğrudan web URL'si yok, yetkili indirme denetleyicisi var. |
| Geri bildirim görselleri | `storage/app/private/feedback/{report_id}/...` | `local` diski; yönetim üzerinden yetkiyle gösterilir. |
| Kamu malzeme medyası | `storage/app/public/inventory-media/{item_id}/...` | `public` diski; `public/storage` sembolik bağlantısı üzerinden sunulur. |
| Laravel günlükleri | `storage/logs/laravel.log` veya yapılandırılmış günlük kanalı | `config/logging.php`; canlı hata günlüğünün tamamı Git'te değil. |
| Oturum, önbellek, kuyruk | `.env` ve `config/session.php`, `config/cache.php`, `config/queue.php` | Seçilen sürücüye göre SQL/Redis/dosya olabilir. cPanel rehberinde veritabanı oturumu öneriliyor; etkin canlı değer burada doğrulanmadı. |
| Derlenmiş ön yüz | `public/build/` | `npm run build` çıktısı; Git tarafından yok sayılır, üretim paketine ayrıca konur. Kaynaklar `resources/js/` ve `resources/css/` altında. |
| PHP/JS bağımlılıkları | `vendor/`, `node_modules/` | Git dışında; kilit dosyaları `composer.lock` ve `package-lock.json` depoda. |
| Kişisel arayüz tercihleri | `users.interface_preferences`, `users.table_preferences`, `users.saved_filters` | Kullanıcı hesabına bağlı tema, ölçek, menü, sütun/filtre tercihleri. |
| Tarayıcıya özel veri | `localStorage` | Kamu tema/favori seçimi, güvenli form taslakları ve bazı geçici görünüm bilgileri; parolalar, randevu/teslim kişisel verisi taslaklara alınmaz. |

`storage/app/private`, `storage/app/public`, `storage/logs`, `bootstrap/cache` ve `.env` üretimde PHP kullanıcısının doğru erişimlerine bağlıdır. `.gitignore` `.env`, `vendor`, `node_modules`, `public/build`, `public/storage` ve günlükleri depodan dışlar. Bu nedenle **Git deposu tek başına tam çalışan canlı yedek değildir**; SQL verisi, özel/kamu yüklemeleri, `.env` ve dağıtım çıktıları ayrı korunmalıdır.

## 5. Yerel, GitHub/CI ve canlı ortam

### Yerel geliştirme

- Proje: `/home/mert/Documents/Proje/Sparkoff`; kod `main` dalında tutuluyor.
- Yerel test yardımcıları: `scripts/start-local-test.sh` ve `scripts/stop-local-test.sh`; betik PHP'yi `127.0.0.1:8000`, Vite'ı `127.0.0.1:5173` üzerinde başlatmak için yazılmış. Çalışma günlüğü `storage/logs/local-test.log`.
- Son mobil denetimlerin geçici tarayıcı sunucusu `127.0.0.1:8765` ve `/tmp` altındaki sentetik SQLite kopyasıyla çalıştı; bu sunucu kapatıldı.
- Kaynak değişikliği yalnız yerelde yapılıp GitHub'a gönderildiğinde canlı site kendiliğinden güncellenmez. Depoda otomatik canlı yayın iş akışı bulunmuyor.

### GitHub ve test altyapısı

- Uzak repo: `https://github.com/MaliWhiteTea/Sparkoff`.
- `.github/workflows/database-acceptance.yml`, `main` push ve PR'de MySQL 8.4 ile MariaDB 10.11 işlerini çalıştırır. CI veritabanı `sparkoff_testing` yalnız geçici test servisidir, canlı veritabanı değildir.
- Test kaynakları `tests/Feature/` ve `tests/Unit/`. Son kayıtlı yerel tam PHP turunda 307 testten 306'sı geçti, bir MySQL/MariaDB testi yerelde atlandı (2918 assertion); sonraki CSS turlarında PHP kodu değişmedi. CI'nin iki veritabanı işi son committe geçti.
- Mobil denetim ekran görüntüleri `docs/audit/2026-11-08/` içindedir; sentetik test değerleriyle alınmıştır.

### Canlı cPanel yerleşimi — önceki kullanıcı kayıtlarına göre

| Parça | Kullanıcının paylaştığı yol/yer | Doğrulama durumu |
|---|---|---|
| Alan adı | `sparkoff.tr`, `www.sparkoff.tr` | Kapalı alpha için erişim koruması [kontrol listesinde](CLOSED_ALPHA_CHECKLIST.md) kayıtlı. Bugünkü DNS/yayın durumu bu belge için yeniden ölçülmedi. |
| Laravel uygulama kökü | `/home/qmypllhw/sparkoff_app` | Hata yığınındaki `vendor` ve `app` yollarından görüldü. |
| Web belge kökü/köprü | `/home/qmypllhw/public_html/index.php` | Önceki hata yığını buradan `sparkoff_app` uygulamasına geçildiğini gösteriyor; örnek kaynak `deployment/cpanel-index.php`. Belge kökünde yalnız kamu dosyaları bulunmalı. |
| Uygulama ayarları | `/home/qmypllhw/sparkoff_app/.env` | Beklenen Laravel konumu; dosyanın güncel değerleri bu belge için okunmadı. |
| Laravel hata günlüğü | `/home/qmypllhw/sparkoff_app/storage/logs/laravel.log` | Kullanıcının paylaştığı `roles` tablo hatası bu günlükten gelmişti. |
| Zamanlayıcı | cPanel **Cron İşleri** → `sparkoff_app` içinde dakikada bir `php artisan schedule:run` | Önceki cPanel ekranında cron girdileri gösterildi; sunucudaki bugünkü etkinlik/son çalışma zamanı yeniden doğrulanmadı. Kaynak takvim `routes/console.php`. |
| Zamanlayıcı hata dosyası | Örnek: `/home/qmypllhw/sparkoff-scheduler-errors.log` | `CPANEL_DEPLOYMENT.md` örnek komutuna göre; gerçek cPanel satırının bugünkü yönlendirmesi ayrıca doğrulanmalı. |
| Yedekler | cPanel/JetBackup veya hesabın erişim kısıtlı yedek alanı | Önceki ekranda arşiv dosyaları vardı. Otomatik yedek yeri, kapsamı ve geri yükleme denemesi bu belge için doğrulanmadı. |

29 Ekim'de canlıdaki HTTP 500 hatasının nedeni `qmypllhw_sparkoff.roles` tablosunun eksik olmasıydı. Onarım migration'ı `database/migrations/2026_10_29_000300_repair_missing_role_tables.php`, rol verisi `database/seeders/RolePermissionSeeder.php` içindedir. Kullanıcı `migrate`/seed/önbellek adımlarından sonra sitenin açıldığını bildirdi. Bu olay canlı dağıtımın başka bir tarihteki kaynak sürümüyle eşit olduğunu kanıtlamaz.

### Önceki canlı kurulum ve kullanıcı denemeleri

- cPanel Dosya Yöneticisi üzerinden üretim arşivleri yüklendi, uygulama `sparkoff_app` altında açıldı ve `public_html/index.php` köprüsüyle site çalıştırıldı. Kullanıcı, önce yükleme boyutu ve arşiv çıkarma adımlarını ekran görüntüleriyle takip etti; bugün hangi arşivin kurulu olduğu ayrıca doğrulanmadı.
- İlk açılışta `roles` tablosu eksik olduğu için HTTP 500 oluştu. Kullanıcının paylaştığı `laravel.log` kaydı bunu gösterdi. Onarım migration'ı ve `RolePermissionSeeder` çalıştırıldı; önbellek temizleme/optimizasyon tamamlandı. Kullanıcı sitenin açıldığını bildirdi.
- cPanel Cron İşleri ekranında bir dönem hem `schedule:run` hem `optimize:clear` komutlarını dakikada bir çalıştıran iki satır gösterildi. Uygulamanın doğru sürekli görevi yalnız `schedule:run` olduğundan [kurulum rehberi](CPANEL_DEPLOYMENT.md) buna göre yazıldı. Bugünkü cPanel cron listesi ve son çalışma zamanı bu dosya için yeniden doğrulanmadı.
- Kullanıcı canlıda `ALPHA TEST Ödünç Malzeme` adlı sentetik kayıt ve 3 adet başlangıç stok hareketi oluşturdu; yönetim listesinde stok, kamu kataloğunda “Stokta var” görünümü ekran görüntüleriyle doğrulandı. Bu, bütün envanter ve teslim/iade senaryolarının kabulü değildir.
- Kapalı alpha sırasında testerlar geri bildirim başarı mesajı, giriş ekranı koyu teması, mobil metin ve menüler, iletişim kartı, fotoğraf eki ve başlık yazımı hakkında bulgular iletti. İlgili yerel düzeltmeler Git geçmişinde ve 6–8 Kasım denetim kayıtlarında bulunur. Kullanıcı canlı testleri ayrıca yürütüyor.

## 6. Zamanlayıcı ve yayın adımları

`routes/console.php` içindeki mevcut görevler:

| Komut | Sıklık | İş |
|---|---|---|
| `appointments:expire-verifications` | Her dakika | Süresi geçen doğrulanmamış başvuruları sonlandırır. |
| `loans:anonymize` | Her gün 03:10 | Süresi dolan tamamlanmış teslimlerde kişisel alanları anonimleştirir. |
| `appointments:apply-retention` | Her gün 03:25 | Saklama süresi dolan randevu ve özel model dosyalarını temizler. |

Sunucu cron'unda yalnız scheduler çağrılmalı; `migrate`, seed ve `optimize` her dakika çalıştırılacak görevler değildir. Kurulum/yayın adımları, izinler ve geri yükleme gereksinimleri [cPanel rehberinde](CPANEL_DEPLOYMENT.md) yer alır. Bu dosya çalıştırılacak güncel yayın talimatı yerine geçmez; gerçek `.env`, PHP sürümü, belge kökü ve yedek durumu yayın öncesi sunucuda doğrulanır.

## 7. Denetimde bulunan ve düzeltilen sorunlar

| Kimlik | Yerel düzeltmenin özeti |
|---|---|
| BUG-001 | Stok miktarında izin verilmeyen fazla ondalık basamak reddedildi. |
| BUG-002 | Randevu geçmişi notlarının yetkisiz personele görünmesi engellendi. |
| BUG-003 | Değişmeyen sistem yöneticisi rolünün form metin kimliğiyle yanlış reddi düzeltildi. |
| BUG-004–005 | Geri bildirim görseli ve envanter medyasında disk yazma hatalarının HTTP 500 üretmesi düzeltildi. |
| BUG-006 | Model dosyası yazılamadığında randevunun kabul edilmesi engellendi. |
| BUG-007–010 | Kapalı/açık mobil menü taşması, gereksiz alt boşluk ve içeriği örten sabit düğme düzeltildi. |
| BUG-011–013 | Küçük mobil dokunma hedefleri, yönetim menüsü düzeni ve 320 px envanter üst alanı taşması düzeltildi. |

Ayrıntılı tekrar adımları, önce/sonra ölçümleri ve sınırlar [6 Kasım](YEREL_DENETIM_ILK_CALISMA_KAYDI_2026-11-06.md), [7 Kasım](YEREL_DENETIM_CALISMA_KAYDI_2026-11-07.md) ve [8 Kasım](YEREL_DENETIM_CALISMA_KAYDI_2026-11-08.md) kayıtlarındadır. Bunlar **yerel** düzeltmelerdir; canlıya geçiş ayrı iştir.

## 8. Açık işler ve doğrulanmamış alanlar

1. [Tam kapsamlı ön rapordaki](YEREL_TAM_KAPSAM_DENETIM_ON_RAPORU_2026-11-06.md) A–I denetimi ve [390 maddelik manuel plan](ALPHA_UCTAN_UCA_MANUEL_TEST_PLANI.md) tek tek kapatılmadı. Mobil yönetim form ve tabloları, farklı roller, gerçek telefon ve ekran okuyucu hâlâ kapsamda.
2. Gerçek SMTP oturumu/teslimatı, SPF/DKIM sonucu, canlı cPanel cron son çalışma zamanı, PHP/web dosya sınırları ve SQL/özel dosya yedeğini geri yükleme provası bu denetimde doğrulanmadı.
3. Randevu slotu ve son yönetici işlemleri için gerçek eşzamanlı iki istek kabulü açık. Bu kapanmadan çevrimiçi randevu canlıda açılmamalı.
4. Canlı alpha testleri kullanıcı tarafından yürütülüyor; GitHub'a gönderilen yerel düzeltmelerin hangi tarihte canlıya dağıtıldığı ayrıca sürüm/kabul kaydına yazılmalı.
5. Büyük JS parçası uyarısının gerçek cihazda ilk yüklemeye etkisi ölçülmeli. Doğrudan Google Sheets bağlantısı ve yayın otomasyonu daha önce bilinçli olarak ertelendi.
6. Formda gerçek değişiklik varken yenilemede görülen tarayıcı `beforeunload` penceresi [A-002](ALPHA_KNOWN_ISSUES.md) olarak kayıtlıdır; metni ve temasını site CSS'i değiştiremez.

## 9. Ayrıntılı belge dizini

| Belge | İçerik |
|---|---|
| [README](README.md) | Ürünün güncel modülleri ve teknoloji özeti. |
| [ROADMAP](ROADMAP.md) | Kararlar, geliştirme paketleri ve kalan işler. |
| [CPANEL_DEPLOYMENT](CPANEL_DEPLOYMENT.md) | cPanel kurulum, güncelleme ve canlı kabul koşulları. |
| [CLOSED_ALPHA_CHECKLIST](CLOSED_ALPHA_CHECKLIST.md) | Davetli alpha ortamının erişim, güvenlik ve yayın kontrolü. |
| [ALPHA_UCTAN_UCA_MANUEL_TEST_PLANI](ALPHA_UCTAN_UCA_MANUEL_TEST_PLANI.md) | 390 maddelik ekran/işlem test listesi. |
| [ALPHA_KNOWN_ISSUES](ALPHA_KNOWN_ISSUES.md) | Alpha sırasında kaydedilen kullanıcıya görünür sorunlar. |
| [DEPLOYMENT_ACCEPTANCE_2026-10-28](DEPLOYMENT_ACCEPTANCE_2026-10-28.md) | 28 Ekim tarihli üretime benzer kabul kanıtı; tarihsel, bugünkü canlı sürüm kanıtı değil. |
| [YEREL_TAM_KAPSAM_DENETIM_ON_RAPORU_2026-11-06](YEREL_TAM_KAPSAM_DENETIM_ON_RAPORU_2026-11-06.md) | Denetim kapsamı, güncel özet ve açık kabul engelleri. |
| [Yerel denetim günlükleri](YEREL_DENETIM_CALISMA_KAYDI_2026-11-08.md) | Bulgu, test sonucu ve ekran görüntüsü bağlantıları. |

**Bakım ilkesi:** Yeni modül, tablo, harici servis, canlı dağıtım veya kabul sonucu oluştuğunda bu dosyanın ilgili zaman çizelgesi, konum ve açık işler bölümü güncellenmelidir.
