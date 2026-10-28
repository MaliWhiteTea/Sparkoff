# Sparkoff — Hata ve kullanılabilirlik denetimi

**Tarih:** 27 Ekim 2026  
**İncelenen sürüm:** `f0a9ace` — Kişisel liste görünümü tercihlerini tamamla  
**İstek:** Baştan sona kontrol; düzeltme yapmadan, sonraki modele uygulanabilir bulgu listesi hazırlama.

Bu çalışma yerel kod incelemesi, uygulamanın mevcut testleri, ayrı hata üretme testleri ve Chromium üzerinde gerçek tarayıcı etkileşimleriyle yapıldı. Haricî bir Bugbot hizmeti çalıştırılmadı. Uygulama koduna düzeltme yapılmadı; gerçek envanter ve kullanıcı verileri değiştirilmedi. Tarayıcı denemeleri ayrı SQLite veritabanında, örnek hesaplarla yapıldı. E-posta için `array` sürücüsü kullanıldı; gerçek e-posta gönderilmedi. Silme denemesinde DELETE isteği tarayıcıda engellendi.

## Sonuç ve nasıl okunacağı

**35 bulgu:** 7 adet P1, 26 adet P2, 2 adet P3. Ayrıca hata sayısına katılmayan 4 teslimat/ürün kararı başlığı var.

- **P1:** Yetki sınırı, veri bütünlüğü veya kritik işlem güvenliği; önce ele alınmalı.
- **P2:** İşlev bozukluğu, yanıltıcı durum, erişim veya belirgin kullanılabilirlik sorunu.
- **P3:** Dil ve varsayılan tercih tutarlılığı.
- **Test / tarayıcı:** Sorun çalıştırılarak tekrar üretildi.
- **Kod:** İlgili koşul kaynak koddan doğrulandı; ayrıca canlı etkileşimle denenmedi.

Birden fazla ekranda aynı kökten çıkan hatalar mümkün olduğunca birleştirildi. B09 çoklu yazıcı kullanımının beklenen ürün davranışını, B34 ise varsayılan koyu temanın yönetim panelini de kapsamasını gerektiriyor; bunların kapsam notlarını uygulamadan önce okuyun. Satır numaraları yukarıdaki sürüme aittir.

## Yapılan kontroller

| Kontrol | Sonuç |
|---|---|
| Mevcut Laravel testleri | **158 test, 1123 assertion başarılı** |
| Hataları yeniden üreten ayrı denetim testleri | **18 test, 147 assertion başarılı**; bunlar mevcut kusurlu davranışı doğrular, uygulamanın doğru olduğunu göstermez |
| TypeScript | `tsc --noEmit` başarılı |
| PHP biçim kontrolü | `vendor/bin/pint --test` başarılı |
| Composer yapılandırması | `composer validate --strict --no-check-publish` başarılı |
| Üretim ön yüz derlemesi | Geçici çıktı dizinine Vite build başarılı |
| Bağımlılık taraması | `composer audit` ve `npm audit`: bildirilen güvenlik açığı yok |
| Tarayıcı sayfa taraması | 23 ana ekran, ayrıca giriş, doğrulama ve takip akışı |
| Dar ekran | 390 px genişlikte 8 ekran |
| Erişilebilirlik | axe taraması; ayrıca modal klavye denemesi |
| Gerçek etkileşim | Giriş, hatalı form gönderimi, kısmi iade, miktar sınırı, silme onayı, filament kapatma/kaydetme, dosya değiştirme, sayfalama, geri bildirim ve randevu oluşturma |

23 ekranlık ilk taramada HTTP 200 alındı ve JavaScript `pageerror` görülmedi. Bunun, aşağıdaki işlem ve veri hatalarını dışlamadığı özellikle görülüyor.

### Kontrol edilip çalıştığı görülen önemli davranışlar

- Ödünç verilen **3 adet** için iade alanına **4** girilmesi alanı **3.000** değerine sınırladı.
- **1 adet** kısmi iade kaydedildi; kalan miktar **2 adet** oldu. Mevcut testler sunucunun fazla iadeyi reddetmesini de kapsıyor.
- Geçerli STL ile randevu sihirbazı tamamlandı; e-posta doğrulama adımı ve takip sayfası çalıştı. Gerçek SMTP teslimatı denenmedi.
- Bozuk STL içeriği sunucuda reddedildi; uzantının tek başına yeterli olmadığı doğrulandı.
- Geri bildirim gönderimi başarı mesajıyla tamamlandı.
- Malzeme kataloğunun son sayfasında “Sonraki” bağlantısı yoktu; kaynak kod ilk sayfada “Önceki”yi de kaldırıyor.
- Ana üst menüdeki fazladan yazıcı düğmesi ve kartlardaki “Kullanıma açık” metinleri mevcut sürümde görünmüyor.
- Kullanıcı/rol seçimlerinin daha önce beyaz kalan temel kutuları koyu tema düzeltmesini almış. Aşağıdaki tema bulguları kalan farklı bileşenlere ait.

## P1 — Önce düzeltilmesi gerekenler

### B01 — Eski yönetici rolü kaldırıldığı hâlde geniş yetkiler sürüyor

**Kanıt:** Test. `test_demoted_legacy_admin_retains_permission`.

**Yer:** `app/Http/Middleware/EnsurePermission.php:17`, `EnsureAnyPermission.php`, `app/Http/Controllers/Admin/AccessController.php:129`, `routes/console.php:54`; aynı `role === 'admin'` kontrolünü kullanan diğer yerler.

**Tekrar:** İki sistem yöneticisi oluşturun. Birinin eski `users.role` alanı `admin` olsun. Diğer yöneticiyle bu kişiyi Sistem Yöneticisi rolünden çıkarıp yalnız sınırlı bir role atayın. Rolü düşürülen hesapla `/yonetim/yetkiler` adresini açın.

**Gerçek:** `hasPermissionTo('users.view')` false olduğu hâlde sayfa HTTP 200 dönüyor. Eski sütundaki `admin` değeri RBAC kontrolünü atlatıyor; rol düzenleme bu sütunu değiştirmiyor. Bu, sadece düğmenin görünmesiyle sınırlı değil, sunucu yetki kontrolünde mevcut.

**Etki:** Yönetici, erişimi kaldırdığını sanırken kullanıcı geniş izinlerini koruyor. Tekil/toplu malzeme silmenin ayrı `system.admin` denetimi bu bulguyla otomatik olarak aşılmış sayılmamalı.

**Kabul:** Eski yönetici hesaplarının geçişi korunarak tek yetki kaynağı tanımlanmalı. Rolü kaldırılan kişinin açık oturumu dâhil artık yetkisiz olduğu GET/POST/PUT/DELETE işlemleri 403 vermeli. Son sistem yöneticisi koruması bozulmamalı.

### B02 — Hedef role ait olmayan kullanıcı yönetim duyurusunun içeriğini alıyor

**Kanıt:** Test. `test_targeted_announcement_leaks_to_other_role`.

**Yer:** `app/Http/Controllers/Admin/AnnouncementController.php:19`; karşılaştırma için `app/Http/Middleware/HandleInertiaRequests.php` içindeki personel duyurusu filtresi.

**Tekrar:** Duyuruyu yalnız A rolüne hedefleyin. B rolüne sadece `staff_announcements.view` verin. B ile `/yonetim/duyurular` açın.

**Gerçek:** Üst bildirimler için `staffAnnouncements` boş geliyor; ancak aynı yanıttaki `announcements` listesinde A rolüne özel başlık ve gövde bulunuyor. Liste sorgusu hedef rolü, yayın başlangıcını ve taslak durumunu okuyucu açısından sınırlandırmıyor.

**Etki:** Rol hedeflemesi ekranın bir bölümünde uygulanırken başka bölümünde aşılıyor. İçerik gizlemek için yalnız React filtresi yeterli olmaz.

**Kabul:** Yalnız okuma yetkisi olan kullanıcıya hedeflenmeyen duyurunun gövdesi sunucu yanıtında hiç bulunmamalı. Sistem yöneticisi ve gerçekten yönetim yetkisi olan editörlerin kapsamı ayrı tanımlanmalı. Mevcut testte yalnız `staffAnnouncements` kontrolü yeterli değil; ana `announcements` listesi de sınanmalı.

### B03 — Uygulamanın dışa aktardığı CSV yeniden alınırken tür ve gizlilik değişiyor

**Kanıt:** Gerçek export çıktısıyla test. `test_export_import_changes_type_and_visibility`.

**Yer:** `app/Http/Controllers/Admin/InventoryController.php:97`, `InventoryImportController.php:179`, `:235`, `:114`.

**Tekrar:** Türü `loanable`, katalog görünürlüğü `hidden` olan malzemeyi dışa aktarın. Boş bir test envanterinde dosyayı yükleyip otomatik eşlemeyle ön izleyin ve aktarın.

**Gerçek:** Malzeme `consumable` ve `status` olarak oluşuyor. Export “Ödünç verilebilir” yazıyor; import bu etiketi tanımıyor. “Katalog görünürlüğü” başlığı otomatik eşlenmiyor. “Kesin miktar” etiketi de normalizasyonla uyumsuz. Exporttaki aktiflik ve konum kodu alanları da geri yüklenmiyor; import her kaydı aktif oluşturuyor.

**Etki:** Ödünç malzemenin sarfa dönüşmesi iade akışını değiştiriyor; gizli malzeme kamu kataloğuna çıkabiliyor. Export dosyasını güvenilir geri yükleme kaynağı sanmak hatalı sonuç veriyor.

**Kabul:** Export → import sonucunda tür, görünürlük, aktiflik ve desteklenen konum bilgisi korunmalı; desteklenmeyen sütunlar açıkça bildirilmelidir. Bilinmeyen tür/görünürlük sessizce daha açık veya farklı bir varsayılana çevrilmemeli. Test, elle yazılmış benzer CSV yerine gerçek export çıktısını kullanmalı.

### B04 — “Devam et” düğmesine çift tıklama iki silme onayını da geçiyor

**Kanıt:** Chromium'da tekrar üretildi; DELETE isteği yakalanıp engellendi. `double-click-confirmation`: **1 silme isteği**.

**Yer:** `resources/js/pages/Admin/Settings/TestTools.tsx:31`; benzer iki aşamalı silme yapısı için `resources/js/pages/Admin/Inventory/Index.tsx` de incelenmeli.

**Tekrar:** Test araçlarında “Tüm malzemeleri kalıcı sil” ile pencereyi açın. Birinci onaydaki “Devam et” düğmesine yaklaşık 100 ms aralıklı çift tıklayın.

**Gerçek:** İlk tıklama aynı konumdaki düğmeyi ikinci onaya dönüştürüyor; ikinci tıklama “Evet, kalıcı olarak sil” işlevini çalıştırıyor. İkinci metni okuyup ayrı karar vermeden silme isteği gönderiliyor.

**Etki:** Kullanıcının özellikle istediği iki ayrı bilinçli onay, tek alışılmış çift tıklamayla aşılabiliyor.

**Kabul:** İkinci aşama ayrı ve bilinçli bir kullanıcı eylemi gerektirmeli. Çift tıklama, çift dokunma ve basılı Enter ile silme gerçekleşmemeli. İstek sırasında kapatma/yeniden açma davranışı da tutarlı olmalı. Yetki denetimi ve sunucudaki onay alanı korunmalı.

### B05 — Kullanımdaki demirbaşın türünü değiştirmek aynı birimi tekrar teslim etmeye izin veriyor

**Kanıt:** Test. `test_changing_item_type_allows_duplicate_issue`.

**Yer:** `app/Http/Controllers/Admin/InventoryController.php` içindeki `update` ve `validatedItem`; `app/Services/InventoryTransactionService.php:19`.

**Tekrar:** 1 adet demirbaş oluşturup tamamını bir kişiye teslim edin. Malzeme türünü “Ödünç verilebilir” yapın. Aynı malzemeden 1 adet daha başka kişiye teslim edin.

**Gerçek:** İki aktif teslim oluşuyor. Demirbaş teslimi fiziksel `quantity` değerini azaltmıyor; tür değiştirilince ödünç teslim kontrolü bu fiziksel miktarı boş stok sanıyor. Eski işlemin `item_type` alanı da eski türde kalıyor.

**Etki:** Tek fiziksel birim iki kişiye verilmiş görünüyor; sonraki iadeler ve kayıplar farklı stok kurallarına göre işleniyor.

**Kabul:** Aktif işlem varken tür değişikliği reddedilmeli veya açık, atomik bir dönüştürme kuralı uygulanmalı. Sarf/ödünç/demirbaş geçişleri ve kısmi iadeler için stok bütünlüğü korunmalı. Eski işlemlerin türünü geçmişi değiştirecek biçimde topluca güncellemek tek başına çözüm değildir.

### B06 — Başarısız randevu yeniden “Hazır” yapılırken çakışma kontrol edilmiyor

**Kanıt:** Test. `test_failed_booking_can_reenter_blocking_state_over_existing_booking`.

**Yer:** `app/Http/Controllers/Admin/AppointmentController.php:126`, `:198`; `app/Enums/AppointmentStatus.php`.

**Tekrar:** Bir randevuyu `failed` durumuna getirin. Boşa çıkan aynı yazıcı ve zaman için başka bir onaylı randevu oluşturun. Eski randevuyu `ready` durumuna döndürün.

**Gerçek:** Geçiş kabul ediliyor; aynı yazıcıda aynı saati bloke eden iki randevu oluşuyor. Geçiş listesi kontrol ediliyor fakat müsaitlik, bakım ve yazıcı durumu yeniden denetlenmiyor.

**Kabul:** Bloke etmeyen durumdan bloke eden duruma geçerken, ilgili yazıcı kilidi altında diğer randevular ve kapalı zamanlar kontrol edilmeli. Eski randevunun kendi kaydı çakışma hesabından çıkarılmalı. İzin verilen normal durum geçişleri çalışmaya devam etmeli.

### B07 — Gerçekte baskı yapan yazıcı kamuya “Şu anda boş” gösteriliyor

**Kanıt:** Test. `test_public_status_ignores_running_appointment`.

**Yer:** `app/Http/Controllers/HomeController.php:21`, `app/Http/Controllers/PrinterPortalController.php:18`, `:69`.

**Tekrar:** Başlangıcı geçmiş, bitişi gelecekte olan `printing` durumunda randevu oluşturun. Ana sayfa ve `/3d-yazicilar` sayfasını açın.

**Gerçek:** İki sayfada da “Şu anda boş” görülüyor; 7 günlük takvimde randevu bulunmuyor. Her iki durum hesabı ve kamu takvimi yalnız `BlackoutPeriod` kayıtlarını okuyor.

**Etki:** Randevu takvimi ve kamuya verilen müsaitlik bilgisi çelişiyor. Kullanıcı boş sanarak atölyeye gelebilir veya başka işlem planlayabilir.

**Kabul:** Kamuya kişisel bilgi sızdırmadan randevular, elle girilen bloklar ve yazıcı durumu ortak bir müsaitlik hesabına bağlanmalı. İptal/ret, aktif baskı, gün aşan baskı ve zaman sınırları ayrı sınanmalı. Randevu özelliği kapalıyken mevcut elle takvim kullanımını bozmayın.

## P2 — İşlev, mantık ve görünüm sorunları

### B08 — Bakım kaydı onaylı randevuyla çakışabiliyor; yönetim takvimi bakımı göstermiyor

**Kanıt:** Çakışma testle; takvim kapsamı kodla doğrulandı. `test_blackout_overlaps_approved_booking_without_warning`.

**Yer:** `app/Http/Controllers/Admin/PrinterSettingsController.php:169`, `app/Http/Controllers/Admin/CalendarController.php:36`.

**Tekrar:** Onaylı randevunun tam saatlerine aynı yazıcı için bakım ekleyin. Ardından `/yonetim/takvim` açın.

**Gerçek:** Bakım kaydı uyarısız kabul ediliyor. Çakışma denetimi sadece diğer kapalı zamanları inceliyor; yönetim takvimi ise yalnız randevuları getiriyor. Kamu ve yönetim takvimleri farklı gerçeklikler sunuyor.

**Kabul:** Bakımın mevcut randevuyu etkilemesi açıkça bildirilmeli; iş kuralına göre engellenmeli veya yetkili kullanıcı bilinçli biçimde çözümlemeli. Yönetim takviminde ilgili bakım/kapalı zaman da görünmeli. B06/B07 ile ortak planlama kuralları kullanılmalı.

### B09 — İkinci yazıcı aktif ve boş olsa bile çevrimiçi randevuda kullanılamıyor

**Kanıt:** Test. `test_second_active_printer_cannot_supply_free_slot`.

**Yer:** `app/Http/Controllers/AppointmentController.php:87`, `:119`; `resources/js/pages/Booking.tsx`.

**Tekrar:** P-01 ve P-02'yi aktif yapın. P-01'in 10.00 saatini doldurun, P-02 boş kalsın. Randevu müsaitliğini sorgulayın.

**Gerçek:** P-02 için servis 10.00'ı boş bulduğu hâlde kullanıcıya sunulan saatler arasında 10.00 yok. Hem müsaitlik hem kayıt ilk aktif yazıcıyı seçiyor; kullanıcı yazıcı seçemiyor.

**Kapsam notu:** Bu, çoklu aktif yazıcı desteği beklentisine göre bir işlev eksiğidir. Ürün bilerek tek çevrimiçi yazıcıyla çalışacaksa rastgele ilk kaydı kullanmak yerine bu sınır açıkça tanımlanmalı; ikinci yazıcının otomatik seçileceği varsayılmamalı.

**Kabul:** Seçilen/atanan yazıcı müsaitlikten kayda kadar tutarlı olmalı. İki yazıcının boş/dolu kombinasyonları sınanmalı; kullanıcıya gösterilen saat sonradan başka yazıcıya kontrolsüz bağlanmamalı.

### B10 — 09.15 açılış ve 30 dakikalık adım bütün günün saatlerini yok ediyor

**Kanıt:** Test. `test_offset_opening_time_produces_zero_available_slots`.

**Yer:** `app/Services/AppointmentAvailabilityService.php:17`, `:57`; `app/Http/Controllers/Admin/BookingSettingsController.php:55`.

**Tekrar:** Açılışı 09.15, adımı 30 dakika, kapanışı 21.00 ayarlayın. Boş bir gelecek gün için saatleri isteyin.

**Gerçek:** Üretici 09.15, 09.45… oluşturuyor; doğrulayıcı dakika değerinin 30'a tam bölünmesini istiyor. Her aday eleniyor. Ayar ekranı bu kombinasyonu kabul ediyor.

**Kabul:** Saat üretimi ve kabulü aynı başlangıç referansını kullanmalı. Ya bu ayar açıklamalı olarak reddedilmeli ya da 09.15 referanslı adımlar çalışmalı. 15/30/60 dakika seçenekleriyle test edilmeli.

### B11 — Tamamı kullanımdaki demirbaş katalogda hâlâ stokta görünüyor

**Kanıt:** Test. `test_fixed_asset_all_in_use_still_appears_available`.

**Yer:** `app/Http/Controllers/InventoryCatalogController.php:37`, `:55`; `app/Http/Controllers/Admin/InventoryTransactionController.php:57`; `app/Services/InventoryTransactionService.php:30`.

**Tekrar:** 1 adet demirbaşın tamamını kullanım için teslim edin. Kamu kataloğunu ve yeni teslim formundaki miktarı kontrol edin.

**Gerçek:** Katalog “stokta” ve 1 adet gösteriyor. Yeni teslim formu da fiziksel toplamı kullanıyor; sunucu yeni teslimi kapasite aşımıyla reddedebiliyor.

**Kabul:** Toplam fiziksel miktar ile kullanılabilir miktar ayrılmalı. “Stokta/kullanılabilir” etiketi ve filtresi uygun tanıma dayanmalı. Aktif kullanım ve kısmi iade düşülmeli; sarf/ödünç hesapları bozulmamalı.

### B12 — Pasifleştirilen normal stoklu malzeme bütün yönetim filtrelerinden kayboluyor

**Kanıt:** Test. `test_inactive_inventory_invisible_in_all_filters`.

**Yer:** `app/Http/Controllers/Admin/InventoryController.php:243`, `:257`; `resources/js/pages/Admin/Inventory/Index.tsx`.

**Tekrar:** Stok 10, kritik stok 1 olan malzemeyi pasif yapın. Aktif, azalan, tükenen ve arşiv filtrelerini sırayla açın; adıyla arayın.

**Gerçek:** Hiçbir filtrede görünmüyor. Arşivlenmemiş olduğu için arşive, pasif olduğu için aktife, miktarı normal olduğu için diğerlerine girmiyor. Ekrandan yeniden aktifleştirme yolu kalmıyor.

**Kabul:** Pasif ve/veya tüm kayıtlar görünümü bulunmalı; arama bu kapsamda çalışmalı. Aktif/pasif ve arşiv durumları birbirine karıştırılmamalı; özet sayıları filtre tanımlarıyla tutarlı olmalı.

### B13 — CSV'nin 2000 satırdan sonrası sessizce atılıyor

**Kanıt:** Test. `test_csv_truncates_rows_and_skips_extra_cells`.

**Yer:** `app/Http/Controllers/Admin/InventoryImportController.php:223`.

**Tekrar:** 2 MB'den küçük, başlık sonrası 2001 geçerli kayıt içeren CSV yükleyin ve ön izleme alın.

**Gerçek:** 2000 geçerli, 0 hatalı satır deniyor; 2001. kaydın okunmadığı belirtilmiyor. Arayüz yalnız dosya boyutu sınırını açıklıyor.

**Kabul:** Satır limiti aşımında aktarım açık hata vermeli veya bütün satırlar kontrollü işlenmeli. Toplam, kabul edilen, reddedilen ve işlenmeyen sayıları birbirini tamamlamalı. 1999/2000/2001 veri satırı sınanmalı.

### B14 — UTF-8 olmayan Türkçe CSV yüklemek aktarım sayfasını kullanılamaz hâle getiriyor

**Kanıt:** Test. `test_csv_non_utf8_upload_breaks_preview_page`.

**Yer:** `app/Http/Controllers/Admin/InventoryImportController.php:49`, `:202`.

**Tekrar:** Windows-1254 kodlamalı, içinde `Ölçü` gibi Türkçe karakter bulunan CSV'yi yükleyin. Ardından aktarım sayfasını açın.

**Gerçek:** Yükleme kabul ediliyor. Tam sayfa yanıtı 200 olsa da Inertia'nın `<script data-page="app" type="application/json">` içeriği boş kalıyor; ön yüz gerekli sayfa verisini okuyamıyor. Kodlama hatası kullanıcıya gösterilmiyor, bozuk taslak oturumda kalıyor.

**Kabul:** Arayüzün istediği UTF-8 sunucuda doğrulanmalı. Desteklenmeyen kodlama anlaşılır yükleme hatasıyla reddedilmeli veya güvenilir şekilde dönüştürülmeli. Hatalı dosya aktarım ekranını kilitlememeli; geçerli UTF-8 BOM dosyaları kabul edilmeli.

### B15 — CSV'de 0.0001 miktar “geçerli” sayılıyor fakat onayda HTTP 500 oluşuyor

**Kanıt:** Test. `test_tiny_quantity_import_throws_after_valid_preview`.

**Yer:** `app/Http/Controllers/Admin/InventoryImportController.php:140`, `:117`; `app/Services/InventoryStockService.php:28`.

**Tekrar:** `Malzeme;Miktar` başlıklı dosyaya `Tiny;0.0001` satırı koyun. Ön izleme ve aktarım yapın.

**Gerçek:** Ön izleme 1 geçerli satır gösteriyor. Stok servisi miktarı binde bir hassasiyete yuvarlayıp sıfır değişim olarak reddediyor; denetimsiz istisna 500'e dönüşüyor.

**Kabul:** Ön izleme, kayıt ve stok servisinin hassasiyet/alt-üst sınır kuralları aynı olmalı. `0`, `0.0001`, `0.001`, ondalık virgül ve aşırı büyük değerler açık biçimde ele alınmalı. Kullanıcı kaynaklı hatalar 500 üretmemeli. Normal malzeme oluşturmadaki aynı miktar sınırı da kontrol edilmeli.

### B16 — CSV'deki bozuk sütun sayısı sessiz veri kaybına yol açıyor

**Kanıt:** Fazla sütun testle, eksik sütun ve başlık kontrolü kodla doğrulandı.

**Yer:** `app/Http/Controllers/Admin/InventoryImportController.php:218`, `:227`.

**Tekrar:** İki sütunlu başlığın altına üç hücre içeren satır koyun. Ayrıca eksik hücre ve tek boş başlık deneyin.

**Gerçek:** Fazla hücreler `array_slice` ile siliniyor; eksikler boş değerle tamamlanıyor. Tek boş başlık da “başlıklar boş olamaz” mesajına rağmen kontrolün dışında kalıyor. Kaymış CSV hücreleri yanlış alanlara taşınabilir.

**Kabul:** Satır yapısı beklenen başlık sayısıyla karşılaştırılmalı. Bozuk satır numarası ve nedeni gösterilmeli; isteğe bağlı boş hücre ile eksik sütun ayrılmalı. Tırnak içindeki ayraç ve çok satırlı açıklamalar bozulmadan desteklenmeli.

### B17 — Yalnız CSV aktarım yetkisi olan kişi başarılı işlemden sonra 403 görüyor

**Kanıt:** Test. `test_import_only_permission_lands_on_forbidden_page`.

**Yer:** `app/Http/Controllers/Admin/InventoryImportController.php:130`, `resources/js/pages/Admin/Inventory/Import.tsx:18`, `routes/web.php`.

**Tekrar:** Kullanıcıya `inventory.import` verin, `inventory.view` vermeyin. Bir CSV'yi başarıyla aktarın.

**Gerçek:** Kayıt ekleniyor; ardından görüntüleme izni gerektiren `/yonetim/envanter` adresine yönlendirilip 403 gösteriliyor. “Envantere dön” bağlantısı da bu kullanıcıya açık.

**Kabul:** Sonuç ekranı kullanıcının sahip olduğu izinlerle açılabilmeli; başarılı işlem başarısız görünmemeli. Tekrar denemeye yönelten belirsizlik kaldırılmalı. Yetki sorununu çözmek için herkese envanter okuma izni verilmemeli.

### B18 — CSV tekrar kontrolü dosya içi ve mevcut veritabanı için farklı davranıyor

**Kanıt:** Test. `test_csv_duplicate_name_detection_changes_with_batch`.

**Yer:** `app/Http/Controllers/Admin/InventoryImportController.php:163`.

**Tekrar:** Aynı adda iki satıra farklı stok kodları verip tek dosyada ön izleyin. Sonra satırların birini önceden veritabanına koyup diğerini ayrı dosyada deneyin.

**Gerçek:** Tek dosyada ikisi de geçerli; veritabanında aynı ad varsa sonraki satır tekrarlı kabul ediliyor. Dosya içi anahtar SKU varsa yalnız SKU'ya dayanıyor, veritabanı kontrolü ise adı da kullanıyor.

**Kabul:** Aynı adın farklı stok kodlarıyla geçerli olup olmadığı açıkça kararlaştırılmalı. Tek dosya ve ayrı dosya sonuçları aynı olmalı; büyük/küçük harf ve Türkçe karakter davranışı SQLite ve üretim veritabanında karşılaştırılmalı.

### B19 — İlk 100 satırdan sonraki CSV hatalarının ayrıntısına erişilemiyor

**Kanıt:** Kod.

**Yer:** `app/Http/Controllers/Admin/InventoryImportController.php:176`, `resources/js/pages/Admin/Inventory/Import.tsx:25`.

**Tekrar:** İlk 100 veri satırı geçerli, sonraki satırlardan biri hatalı olan dosya yükleyin.

**Gerçek:** Toplam hata sayısı artıyor fakat tabloda yalnız ilk 100 satır var. Sayfalama, yalnız hataları gösterme veya hata dosyası indirme yok; hangi satırın düzeltilmesi gerektiği ekranda bulunamıyor.

**Kabul:** Her hatalı satırın özgün satır numarası ve nedeni erişilebilir olmalı. Ön izleme sınırı korunabilir; fakat hata listesi ayrıca eksiksiz sunulmalı. 101. ve son satırdaki hatalar için kontrol eklenmeli.

### B20 — E-postanın büyük harfli tekrarı doğrulama yerine 500 üretiyor

**Kanıt:** SQLite üzerinde test. `test_case_variant_email_returns_500`.

**Yer:** `app/Http/Controllers/Admin/AccessController.php:106`, `:116`, `:133`, `:163`.

**Tekrar:** `duplicate@example.test` kayıtlıyken yeni kullanıcıyı `DUPLICATE@example.test` ile oluşturun.

**Gerçek:** Benzersizlik kontrolü ham değer üzerinde yapılıyor; ardından kayıt için küçük harfe çevrilince veritabanı unique ihlali oluşuyor. Yerel ortamda HTTP 500 doğrulandı. MySQL sonucu collation'a bağlı olabilir.

**Kabul:** E-posta, benzersizlik doğrulamasından önce aynı kuralla normalize edilmeli. Oluşturma/düzenleme/oturum açma davranışları tutarlı olmalı; tekrarlar alan hatası vermeli. SQLite başarısı üretim collation testi yerine geçmez.

### B21 — Bazı düzenleme formları sunucu hatalarını kullanıcıya göstermiyor

**Kanıt:** Kullanıcı oluşturma ve filament düzenleme tarayıcıda; yazıcı düzenleme kodda.

**Yer:** `resources/js/pages/Admin/Access/Index.tsx:21`, `:27`, `:40`; `resources/js/pages/Admin/Settings/Filaments.tsx:50`; `resources/js/pages/Admin/Settings/Printers.tsx:56`.

**Tekrar:** Kullanıcı oluştururken rol seçmeden gönderin veya var olan e-postayı kullanın. Filament düzenlerken malzeme adını boşaltıp kaydedin. Yazıcıda sunucu sınırını aşan açıklama deneyin.

**Gerçek:** Sunucu doğrulaması başarısız olabiliyor fakat ilgili kartta hata metni yok. `router.post/put/patch` kullanılıyor; `errors` tüketilmiyor ve `onError` çoğunda bulunmuyor. Kullanıcı tıklamanın işlemediğini sanıyor.

**Kabul:** Alan hataları ilgili forma bağlanmalı, odaklanılabilir bir hata özeti bulunmalı, girilen bilgi korunmalı. Son yönetici koruması gibi sunucu reddi açıkça gösterilmeli. Bağımsız kartlardaki hata/işleniyor durumları birbirine karışmamalı.

### B22 — Filament türünü kapattıktan sonra “Bilgileri kaydet” onu yeniden açabiliyor

**Kanıt:** Tarayıcı: tür kapatıldıktan sonra kart “Kullanılabilir” kaldı; kart kaydedilince tür tekrar “Kullanılabilir” oldu.

**Yer:** `resources/js/pages/Admin/Settings/Filaments.tsx:44`, `:50`, `:183`; `app/Http/Controllers/Admin/FilamentSettingsController.php:40`.

**Tekrar:** PLA'yı “Geçici olarak kapat” ile kapatın ve neden girin. Sayfayı yenilemeden bir PLA kartında “Bilgileri kaydet”e basın.

**Gerçek:** Üstte PLA kapalı görünürken kart rozeti hâlâ kullanılabilir diyor. Kartın eski `useState` içindeki `is_available: true` değeri sunucuya gönderiliyor; bir filament tekrar açılıyor ve tür “Kullanılabilir” durumuna dönüyor.

**Kabul:** Kullanılabilirlik ile teknik bilgi güncellemesi eski durumla birbirini ezmemeli. Sunucu props değişiminden sonra kart bilgisi doğru olmalı; kullanıcının kaydedilmemiş teknik alanları da düşünülmeli. “Türü kapat → teknik bilgiyi kaydet” adımı türü açmamalı.

### B23 — Reddedilen yeni dosya seçimi eski dosyayı formda bırakıyor

**Kanıt:** Tarayıcı. `booking-stale-file`.

**Yer:** `resources/js/pages/Booking.tsx:150`, `handleFile`.

**Tekrar:** Baskı dosyası adımında desteklenen `original.stl` seçin. Ardından desteklenmeyen `wrong.txt` veya limit üstü dosyayla değiştirmeye çalışın. “Devam et”e basın.

**Gerçek:** Dosya input'u temizleniyor fakat React'teki önceki dosya temizlenmiyor. Ekranda `original.stl` kalıyor ve sonraki adıma geçilebiliyor. Kullanıcı dosyayı değiştirdiğini düşünerek yanlış modeli gönderebilir.

**Kabul:** Reddedilen seçimden sonra önceki dosyanın tutulup tutulmadığı açık ve tutarlı olmalı. Input, görünen dosya adı, durum verisi ve gönderilen FormData aynı dosyayı ifade etmeli; hata sessizce geçilmemeli.

### B24 — Doğrulama süresi biten randevu listede hâlâ doğrulama bekliyor

**Kanıt:** Test. `test_expired_verification_still_pending_in_admin_list`.

**Yer:** `app/Models/Appointment.php:46`, `app/Http/Controllers/AppointmentController.php:256`, `app/Http/Controllers/Admin/AppointmentController.php:23`, `routes/console.php`.

**Tekrar:** `pending_verification` bir kaydın doğrulama bitişini geçmişe alın. Bağlantıyı tekrar onaylamadan yönetim listesini açın.

**Gerçek:** Müsaitlik hesabı bu kaydı artık saymıyor fakat durum hâlâ `pending_verification`. `expired` dönüşümü yalnız doğrulama POST'u gelirse yapılıyor; hiç dönmeyen ziyaretçinin kaydı beklemede kalıyor.

**Kabul:** Zaman aşımı durumları planlı görevle veya tutarlı bir hesapla görünüm ve depolamada ele alınmalı. Süre sonu işlemi tekrarlanabilir ve güvenli olmalı; aktif/doğrulanmış kayıtları değiştirmemeli. Bu bulgu, süresi dolan kaydın slotu hâlâ bloke ettiği anlamına gelmez.

### B25 — Geçerli doğrulama bağlantısı ilk açılışta “başarısız” diyor

**Kanıt:** Tarayıcı ile geçerli, süresi dolmamış bağlantıda doğrulandı.

**Yer:** `resources/js/pages/VerificationResult.tsx:27`.

**Tekrar:** Yeni randevunun geçerli e-posta doğrulama bağlantısını ilk kez açın.

**Gerçek:** Sekme başlığı “Doğrulama Başarısız”, ana başlık “Doğrulama tamamlanamadı”; aynı ekranda çalışan “E-postamı doğrula” düğmesi var. Düğmeye basınca doğrulama başarılı oluyor.

**Kabul:** Onay bekliyor, başarılı ve süresi dolmuş/geçersiz durumların başlıkları ayrılmalı. Geçerli ilk ziyarette hata izlenimi verilmemeli; GET isteğinin kendisi doğrulama yapmamalı.

### B26 — Mobil kamu üst menüsü tamamen kayboluyor

**Kanıt:** 390 px tarayıcı kontrolü; header'da yalnız logo bağlantısı, sıfır menü düğmesi.

**Yer:** `resources/js/components/PublicHeader.tsx:10`, `resources/css/app.css:135`.

**Tekrar:** Mobil genişlikte `/malzemeler`, `/3d-yazicilar` veya `/geri-bildirim` açın.

**Gerçek:** `.desktop-nav` gizleniyor; yerine mobil menü sunulmuyor. Diğer bölümlere geçmek için önce ana sayfaya dönmek gerekiyor. Ana sayfadaki kartlar alt sayfalardaki gezinme eksikliğini gidermiyor.

**Kabul:** Tüm üst menü hedeflerine mobilde erişilebilmeli. Menü klavyeyle açılıp kapanmalı, açık/kapalı durumu erişilebilir biçimde belirtilmeli ve bağlantı tıklanınca kapanmalı. 390 px ve tablet kırılımları sınanmalı.

### B27 — Mobil 3D yazıcılar sayfası 390 px ekranda 1107 px genişliğe taşıyor

**Kanıt:** Tarayıcı ölçümü ve ekran görüntüsü. `innerWidth=390`, `documentElement.scrollWidth=1107`.

**Yer:** `resources/css/app.css:47`, `:319`, `:341`, `:471`; `resources/js/pages/Printers.tsx`.

**Tekrar:** 390 px genişlikte `/3d-yazicilar` açın; sayfayı yatay kaydırın.

**Gerçek:** Yazıcı kartı bölümü 548 px, takvim bölümü 1107 px genişliğe büyüyor. Kart ve takvim için hedeflenen iç kaydırma yerine sayfanın tamamı taşıyor. Footer ve header dar kalırken içerik sağa uzanıyor.

**Kabul:** Sayfa genişliği viewport'u aşmamalı. Yan yana istenen kartlar ve 7 günlük takvim kendi sınırlı alanlarında kayabilmeli; flex/grid çocuklarının minimum genişlikleri düzeltilmeli. `overflow-x:hidden` ile görünmeyen içeriği kesmek tek başına çözüm değildir. 320/390/768 px ve yakınlaştırma sınanmalı.

### B28 — Yönetim koyu tema kurallarının bir kısmı hiçbir elemana eşleşmiyor

**Kanıt:** Kod ve computed style. `.theme-dark .admin-page` eşleşme sayısı **0**.

**Yer:** `resources/css/admin-shell.css:30` ile başlayan koyu tema kuralları, `:39` sistem teması kuralları; `resources/js/components/AdminLayout.tsx:102`.

**Gerçek:** `theme-dark` ile `admin-page` aynı kök elemanda. Bazı seçiciler bunları üst-alt eleman bekleyecek şekilde yazılmış. Bu yüzden filament kapatma düğmesi `rgb(255,242,245)` açık pembe kalıyor; kaydet düğmeleri kartla aynı renge karışıyor; yönetim duyuruları, bazı takvim durumları, KVKK notu ve autofill düzeltmesi amaçlandığı gibi uygulanmıyor.

**Kabul:** Gerçek DOM'a uygun, tutarlı bir tema kapsamı kullanılmalı. Açık/koyu/sistem temalarında durum düğmeleri, uyarılar, takvim, form autofill ve birincil eylemler kontrol edilmeli. Yalnız tek düğmeye yeni `!important` ekleyerek kök uyumsuzluk bırakılmamalı.

### B29 — Koyu yönetim temasında bazı başlık ve menü yazıları okunamayacak kadar düşük kontrastlı

**Kanıt:** axe ve computed style.

**Yer:** `resources/css/admin-shell.css:7`, `:13`; `resources/css/app.css:357`; filament ayarlarının `.settings-heading h2` öğeleri.

**Gerçek:** “Malzeme kullanılabilirliği” ve “Stok ve teknik bilgiler” başlıkları `#172333` yazı / `#101820` zemin ile **1.12:1** kontrasta sahip. Sol menüde pasif bağlantılar `#4e5c6c` / `#17232e` ile **2.33:1**. İkisi de sıradan metin için 4.5:1 ölçütünün altında. Başlıklar bazı bölümlerde neredeyse görünmüyor.

**Kabul:** Temanın metin rengi kökte ve bileşenlerde tutarlı uygulanmalı. Bu gerçek metinler için kontrast tekrar ölçülmeli; yalnız axe uyarısını gizlemek veya yazıyı aşırı büyütmek çözüm sayılmamalı. Koyu ve sistem-koyu aynı sonuç vermeli.

### B30 — Kamu duyurularının açık arka planı koyu tema kuralını bastırıyor

**Kanıt:** Yayında uyarı duyurusu varken tarayıcı ve axe.

**Yer:** `resources/css/app.css:309`, `:436`; benzer maintenance/info varyantları.

**Gerçek:** `.public-theme-dark :where(...)` seçicisinin özgüllüğü, eski `.public-announcements article.announcement-warning` kuralından düşük. Uyarı zemini `#fff7e9` kalırken başlık `#ebc58f` (**1.52:1**), gövde `#a8b5c1` (**1.96:1**) oluyor. Koyu sayfada parlak ve okunaksız kart oluşuyor.

**Kabul:** Tüm duyuru türleri için arka plan/yazı/border aynı tema sisteminden gelmeli. Ana sayfa ve yazıcılar sayfasında duyurulu/duyurusuz durumlar, koyu/açık tema ayrı kontrol edilmeli. B28 yönetim kökü sorunuyla benzer görünüyor fakat seçici nedeni farklı.

### B31 — Giriş ekranından logo ile ana sayfaya geçince koyu tema ve tema düğmesi yok oluyor

**Kanıt:** Tarayıcı. `login-to-home-SPA-theme`.

**Yer:** `resources/js/app.tsx:13`, `resources/js/components/PublicThemeToggle.tsx`, `resources/views/app.blade.php`.

**Tekrar:** Yeni bir sekmede `/yonetim/giris` açın. Tam yenileme yapmadan logo bağlantısıyla ana sayfaya gidin.

**Gerçek:** `isAdmin` yalnız ilk uygulama kurulurken hesaplanıyor. Inertia geçişinde kamu tema bileşeni eklenmiyor. Ana sayfa açık renkli `rgb(247,249,251)` zeminle geliyor, `public-theme-dark` sınıfı ve tema düğmesi yok. Doğrudan ana sayfayı açmak farklı sonuç veriyor.

**Kabul:** Kamu/yönetim tema kapsamı geçerli rotaya göre güncellenmeli. Giriş→ana sayfa, çıkış→ana sayfa ve tarayıcı geri/ileri geçişleri tam yenilemeden doğru çalışmalı. Kullanıcının kaydedilmiş açık tema tercihi de korunmalı.

### B32 — Onay pencerelerinde klavye odağı arka sayfaya kaçıyor

**Kanıt:** Toplu silme penceresinde tarayıcı; CSV penceresi için kod incelemesi.

**Yer:** `resources/js/pages/Admin/Settings/TestTools.tsx:31`, `resources/js/pages/Admin/Inventory/Import.tsx:26`; tek malzeme silme penceresi de aynı yönden kontrol edilmeli.

**Tekrar:** Toplu silme onayını açıp Tab'a basın.

**Gerçek:** Odak pencerede döngü kurmuyor; logo, sol menü ve arka sayfadaki bağlantılara geçiyor. `aria-modal=true` bunu kendiliğinden engellemiyor. Test araçlarında Escape çalışıyor; CSV onayında Escape dinleyicisi yok. Kapanınca odağın açan düğmeye dönmesi de yönetilmiyor.

**Kabul:** Ortak erişilebilir dialog davranışı uygulanmalı: odak sınırlandırma, uygun ilk odak, arka planın etkileşim dışı olması, kapanınca odak iadesi ve işlem sürerken tutarlı kapanma. B04'teki çift tıklama koruması ayrıca doğrulanmalı.

### B35 — Randevu filtresi etiketsiz; yatay yönetim takvimi klavyeyle kaydırılamıyor

**Kanıt:** axe: `select-name` ve `scrollable-region-focusable`.

**Yer:** `resources/js/pages/Admin/Appointments/Index.tsx:51`, `resources/js/pages/Admin/Calendar.tsx:22`.

**Gerçek:** Randevu durum `select` öğesinin programatik adı yok. Yönetim takviminin yatay kaydırılan bölgesi odak alamıyor; özellikle bağlantısız/boş takvimde yalnız klavyeyle sağdaki günlere ulaşmak zorlaşıyor.

**Kabul:** Durum filtresi anlamlı bir label/erişilebilir ada sahip olmalı. Takvim kaydırma bölgesi klavyeden kullanılabilmeli, adı ve görünür odak göstergesi bulunmalı. Ekran okuyucu ve Tab/ok tuşlarıyla manuel kontrol yapılmalı.

## P3 — Dil ve varsayılan tercih tutarlılığı

### B33 — İşlem geçmişinde hâlâ çevrilmemiş işlem ve alan adları var

**Kanıt:** Kod.

**Yer:** `app/Http/Controllers/Admin/ActivityLogController.php:17`, `:37`; `resources/js/pages/Admin/ActivityLogs.tsx:5`.

**Tekrar:** Onay gerektirmeyen duyuruyu okundu işaretleyin; rol izinlerini veya kişisel tablo sütunlarını değiştirin. İşlem geçmişini açın.

**Gerçek:** `read`, `permissions`, `target_roles`, `staff_announcement`, `table_preferences` gibi anahtarlar Türkçe sözlükte yok. Fallback yalnız alt çizgileri kaldırıp baş harfleri büyütüyor: “Read”, “Target Roles” vb. Bazı model adları da frontend sözlüğü dışında kalabiliyor.

**Kabul:** Üretilen action/field/subject anahtarları için merkezi, tam Türkçe etiketleme kullanılmalı. Bilinmeyen yeni anahtar için anlaşılır bir fallback olmalı. Parola veya hassas alan değerleri loga eklenmemeli.

### B34 — Yeni yönetim hesabının varsayılan teması koyu değil, sistem teması

**Kanıt:** Kod. `User::interfacePreferences()` varsayılanı.

**Yer:** `app/Models/User.php:38`, `resources/css/admin-shell.css:15`; kişisel ayarları sıfırlama akışı.

**Tekrar:** Görünüm tercihi olmayan yeni hesapla işletim sistemi açık temadayken giriş yapın veya tercihleri sıfırlayın.

**Gerçek:** Kamu sayfaları varsayılan koyu; yönetim paneli `system` kullanıyor ve açık görünüyor. Oturum açma ekranının kamu tema düğmesine dâhil olmaması da deneyimi farklılaştırıyor.

**Kapsam notu:** Kullanıcının “sitenin default teması koyu olsun” talebi yönetim panelini de kapsıyorsa bu bir gereksinim uyumsuzluğu. Bilinçli seçilmiş mevcut kişisel temaları zorla değiştirmek uygun değildir.

**Kabul:** Tercihi olmayan yeni kullanıcı ve sıfırlama sonucu koyu olmalı; bilinçli açık/sistem tercihleri korunmalı. İşletim sistemi açık ve koyu ayarlarıyla denenmeli.

## Ayrı tutulması gereken eksikler ve dış ortam kontrolleri

Bu bölümdeki maddeler yukarıdaki 35 hataya ek sayılmadı. Bir kısmı ROADMAP'te zaten tamamlanmamış iş olarak belirtiliyor.

**E01 — Randevu/model dosyası otomatik temizliği henüz uygulanmamış.** `privacy.appointment_retention_months` ve `privacy.file_retention_days` ayarları saklanıyor ve kamu metninde uygulanıyormuş gibi anlatılıyor (`resources/js/pages/PrivacyNotice.tsx:96`). Bu süreleri işleten randevu temizleme komutu/görevi bulunmuyor; `routes/console.php` yalnız teslim anonimleştirmesini planlıyor. ROADMAP J bölümünde iş açık. Canlı randevu açılmadan temizlik, saklama istisnaları ve kamu metni birbiriyle uyumlu hâle gelmeli. Bu teknik tutarlılık tespitidir; hukuki uygunluk değerlendirmesi değildir.

**E02 — Gerçek SMTP, cPanel cron ve üretim veritabanı kabulü yapılmadı.** Denetim veritabanı SQLite, e-posta sürücüsü `array`. SPF/DKIM, gerçek teslimat, PHP yükleme limitleri, depolama izinleri, queue/cron ve MySQL/MariaDB collation-kilit davranışı için üretime benzer ayrı ortam gerekiyor. Eşzamanlı son yönetici kaldırma ve stok/iadede yarış koşulları bu çalışmada yük testiyle ispatlanmadı; kesin hata diye yazılmadı.

**E03 — Geri alma ve XLSX desteği mevcut tamamlanmış iş gibi değerlendirilmemeli.** `InventoryStockService::reverse` altyapısı var fakat teslim işlemi geri alma arayüzü ROADMAP'te açık. XLSX de açık iş. CSV hatalarını giderirken XLSX desteği kendiliğinden varmış gibi dosya kabulü genişletilmemeli.

**E04 — Taslak/yayın politikası ve aktif baskı iptali için ürün kararı netleştirilmeli.** Duyuru editörünün hedeflemediği taslakları görebilmesi, okunmuş duyuru değişince yeniden onay gerekip gerekmemesi ve başlamış baskının kullanıcı tarafından iptal edilmesi ayrı iş kurallarıdır. Kesin karar olmadan “hata düzeltme” adıyla yeni yetki veya fiziksel işlem davranışı eklenmemeli. B02'nin yalnız okuyuculara içerik sızdırması ise bu kararlardan bağımsız doğrulandı.

## Sonraki modele uygulama sırası

Bu bölümün bağımlılıklara göre ayrılmış ayrıntılı sürümü `BUGBOT_DUZELTME_SIRASI_2026-10-27.md` dosyasındadır. Uygulamada o dosyadaki paket sırası esas alınmalıdır.

1. **Yetki ve kritik işlemler:** B01, B02, B04, B05. Önce yanlış davranışı yakalayan regresyon testleri; sonra en küçük düzeltme.
2. **CSV bütünlüğü:** B03, B13–B19, B20. Export/import aynı veri sözleşmesiyle çalışmalı; başarılı kısmi aktarım ile sessiz eksik aktarım ayrılmalı.
3. **Randevu planlaması:** B06–B10, B24. Tek bir müsaitlik tanımı; B09 ürün kapsamını netleştirerek. Sonra B07'nin kamu görünümü ve B08'in yönetim görünümü.
4. **Envanter ve form etkileşimi:** B11, B12, B21–B23, B25.
5. **Tema, mobil ve erişilebilirlik:** B26–B32, B35. CSS düzeltmesini bütün varyantlarda kontrol edin; tablo/sayfa taşmasını gizlemeyin.
6. **Dil ve varsayılanlar:** B33, B34. Sonrasında E01/E02 tamamlanmadan çevrimiçi randevuyu canlıya hazır ilan etmeyin.

### Uygulama için sınırlar

- Bu rapor bir düzeltme veya veri silme yetkisi değildir; sonraki çalışma kullanıcının vereceği uygulama kapsamına göre yürütülmeli.
- Gerçek malzemeleri topluca silerek test yapılmamalı. Yalıtılmış veritabanı ve sentetik dosyalar kullanılmalı.
- Geçici denetim testleri kusurlu davranışı **bekler**. Bunları aynen kalıcı test paketine kopyalamayın; doğru davranışı bekleyen regresyon testlerine dönüştürün.
- Çalışan iade miktarı sınırını, sunucu izinlerini ve dosya içerik doğrulamasını görünüm düzeltmesi uğruna gevşetmeyin.
- CSV görünürlük/tür ve rol geçişi düzeltmeleri mevcut veri için geçiş gerektirip gerektirmediği değerlendirilmeden otomatik veri dönüştürmesin.
- Her paket için ilgili test, TypeScript ve build kontrolleri; görünüm paketlerinde ayrıca masaüstü/mobil tarayıcı kontrolü yapılmalı. Başarılı birim testlerini görsel kabul yerine kullanmayın.

## Kanıtların kaydı ve sınırlamalar

Ölçümler, işlem sonuçları ve test adları ilgili bulguların içinde kaydedildi. Denetimin ilk bölümünde `/tmp` altında oluşturulan ham JSON, ekran görüntüsü ve geçici test dosyaları, oturum yenilenmesinden sonra dosya sisteminde bulunamadı. Bu nedenle bu rapor ayrı kanıt dosyalarının hâlen mevcut olduğunu iddia etmez. Sonuçlar bu oturumda alınmış araç çıktılarından rapora aktarıldı; incelenen commit'in hâlâ `f0a9ace` olduğu yeniden kontrol edildi. Sonraki model, bulgulardaki adımlardan doğru davranışı bekleyen kalıcı regresyon testleri oluşturmalıdır.

18 doğrulayıcı testin son ortak çalıştırma sonucu: **18 başarılı test / 147 assertion**. Ara denemelerdeki eksik test verisi veya yanlış otomasyon seçicisi nedeniyle oluşan hatalar uygulama hatası sayılmadı; bunlar düzeltilerek ilgili senaryolar tekrar çalıştırıldı. Özellikle normal randevu denemesinde kullanılan ilk eksik STL fixture'ı sunucu tarafından doğru şekilde reddedildi; geçerli üçgen içeren STL ile başvuru tamamlandı.

Tarayıcı kontrolleri Chromium ile yapıldı. Firefox/Safari, gerçek dokunmatik cihaz, gerçek ekran okuyucu, üretim SMTP ve çok kullanıcılı yük testi yapılmadı. Ana tarama sırasında boş olan bazı liste varyantları kod ve mevcut özellik testleri üzerinden incelendi; her olası veri kombinasyonu denenmiş gibi kabul edilmemeli. Raporda doğrulanmayan şüpheler kesin güvenlik açığı olarak sunulmadı.
