# V1 → V2 izin eşlemesi (10 Kasım 2026)

Kaynak: `config/permissions.php` içindeki 59 anahtar, V1 `routes/web.php` ve `RolePermissionSeeder.php`. Durum **API kapısı** içindir; işlevsel eşitlik veya tarayıcı kabulü anlamına gelmez. `—` olan izinler V2 rolüne otomatik olarak verilmez. V1 çoklu rollerin birleşimi V2 `user_custom_roles` üzerinde korunur. V1 sistem yöneticisi ayrıca V2 `super_admin` olarak değerlendirilmelidir; birim sorumlusu (`lead`) V1 yönetici rolünün yerine geçmez.

Yerel V1 SQLite rol bağları ayrıca kontrol edildi: `inventory-moderator` için `inventory.view`, `loans.view`, `loans.create`, `loans.receive_return`, `loans.view_personal_data`, `loans.view_email`, `loans.report_damage`, `loans.report_lost`, `loans.reverse_transaction`, `loans.extend_due_date` bulunuyor. Seeder'ın ilk rol listesi mevcut kayıtların tamamını göstermiyor. Canlı kopya farklı olabilir; rol aktarımı canlı `permission_role` satırlarından yapılmalıdır.

| V1 izni | V2 karşılığı | Durum / açık nokta |
| --- | --- | --- |
| `inventory.view` | `inventory_view` | API kapısı var; büyük veri kabulü açık |
| `inventory.create` | `inventory_create` | API kapısı var |
| `inventory.update` | `inventory_update` | API kapısı var |
| `inventory.manage_media` | `inventory_manage_media` | API kapısı var; galeri eşitliği açık |
| `inventory.archive` | `inventory_archive` | API kapısı var |
| `inventory.change_item_type` | `inventory_change_item_type` | API kapısı var; açık teslim engeli var |
| `inventory.adjust_stock` | `inventory_adjust_stock` | API kapısı var; kısa geri alma aynı izni kullanır |
| `inventory.manage_categories` | `inventory_manage_categories` | API kapısı var |
| `inventory.manage_locations` | `inventory_manage_locations` | API kapısı var |
| `inventory.view_movements` | `inventory_view_movements` | API kapısı var |
| `inventory.import` | `inventory_import` | API kapısı var; tüm V1 seçenekleri açık |
| `inventory.export` | `inventory_export` | API kapısı var |
| `loans.view` | `loans_view` | Yetkili genel liste var; kendi kayıtlarını görme yolu ayrıca korunuyor |
| `loans.create` | `loans_create` | API kapısı var |
| `loans.receive_return` | `loans_receive_return` | API kapısı var |
| `loans.extend_due_date` | `loans_extend_due_date` | Yalnız açık/kısmi ödünç kaydında tarih ileri alınır; ayrı izin, satır kilidi ve audit var; yerel SQL kabulü açık |
| `loans.report_damage` | `loans_report_damage` | İade durumunda ayrı kapı var |
| `loans.report_lost` | `loans_report_lost` | İade durumunda ayrı kapı var |
| `loans.reverse_transaction` | `loans_reverse_transaction` | API kapısı var |
| `loans.view_personal_data` | `loans_view_personal_data` | `loans_view` ile birlikte ad/not açılır |
| `loans.view_email` | `loans_view_email` | `loans_view` ile birlikte e-posta açılır |
| `loans.export` | `loans_export` | `loans_view` ile birlikte CSV dışa aktarımı; ad/e-posta ayrı izinle maskelenir, büyük listede sayfalı akış kullanılır; yerel SQL kabulü açık |
| `printers.view` | `printers_view` | Yönetim listesi API kapısı var |
| `printers.create` | `printers_create` | API kapısı var |
| `printers.update` | `printers_update` | Kod/ad/açıklama değişimi ayrı denetlenir |
| `printers.change_status` | `printers_change_status` | Durum değişimi ayrı denetlenir |
| `printers.manage_schedule` | `printers_manage_schedule` | Bakım/kapalı/dolu zaman oluşturma, düzenleme, silme ve çakışma/yarış koruması yerel SQL'de geçti; gerçek tarayıcı/VDS kabulü açık |
| `printers.manage_filaments` | `printers_manage_filaments` | Filament API kapısı var |
| `printers.manage_hours` | `printers_manage_hours` | Yedi günlük çalışma saati okuma/düzenleme ayrı izinle yerel SQL'de doğrulandı; gerçek tarayıcı/VDS kabulü açık |
| `appointments.view` | `appointments_view` | Temel V2 liste var; tam V1 akışı açık |
| `appointments.review` | `appointments_review` | Onay/red/değişiklik isteği ayrı izinle, geçiş ve gerekçe doğrulamasıyla yerel SQL'de geçti; e-posta ve gerçek tarayıcı kabulü açık |
| `appointments.manage_status` | `appointments_manage_status` | Hazır/basılıyor/tamamlandı/başarısız/yeniden hazır durum zinciri ayrı izinle yerel SQL'de geçti; e-posta ve gerçek tarayıcı kabulü açık |
| `appointments.download_file` | `appointments_download_file` | Özel dizindeki model, oturum/izin ve randevu bağı kontrolünden sonra indirilir; silinmiş dosya 404, yetkisiz rol 403; yerel SQL kabulü geçti. V1 dosya aktarımı ve gerçek tarayıcı/VDS kabulü açık |
| `appointments.view_personal_data` | `appointments_view_personal_data` | Listede ad/e-posta ayrı kapıyla görünür |
| `appointments.export` | `appointments_export` | `appointments_view` ile birlikte CSV dışa aktarımı; kişi ve not alanları ayrı izinle maskelenir, sayfalı akış kullanılır; yerel SQL kabulü açık |
| `announcements.view` | `announcements_view` | Yönetim listesinde kamu duyurularını ayrı izinle görür; V1 tür/yerleşim/yayın/zaman alanları yerel SQL kabulünde geçti |
| `announcements.create` | `announcements_create` | Kamu duyurusu oluşturma ayrı; `both` için yönetim duyurusu izni de gerekir |
| `announcements.update` | `announcements_update` | Kamu duyurusu düzenlenir; eski ve yeni hedef için izin gerekir |
| `announcements.archive` | `announcements_archive` | Kamu duyurusu V1 gibi kaldırılır; audit yazılır |
| `workshop_settings.update` | `workshop_settings_update` | İletişim bilgileri ve yedi günlük çalışma saatleri ayrı izinle API/UI ve yerel SQL kabulünde geçti |
| `staff_announcements.view` | `staff_announcements_view` | Yönetim listesinde iç duyuruları ayrı izinle görür; hedef rol ve okundu onayı yerel SQL kabulünde geçti; yayın/yerleşim alanları yerel SQL kabulünde geçti |
| `staff_announcements.create` | `staff_announcements_create` | İç duyuru oluşturma ayrı; hedef rol ve okundu onayı API/UI eklendi |
| `staff_announcements.update` | `staff_announcements_update` | İç duyuru düzenlenir; eski ve yeni hedef için izin gerekir |
| `staff_announcements.archive` | `staff_announcements_archive` | İç duyuru V1 gibi kaldırılır; audit yazılır |
| `feedback.view` | `feedback_view` | V2 listesi ayrı izinle açılır; V1 görsel eki aktarımı ve özel erişim açık |
| `feedback.update` | `feedback_update` | Durum ve yönetici notu ayrı izinle güncellenir; yerel SQL kabulü açık |
| `users.view` | `users_view` | Üye listesi API kapısı var; V1 filtre/sıralama açık |
| `users.create` | `users_create` | `roles_assign` ile doğrudan özel rollü kullanıcı oluşturma var; sistem rolü oluşturma ayrı |
| `users.update` | `users_update` | Ad/e-posta düzenleme var; V1'in tüm kullanıcı alanları açık |
| `users.disable` | `users_disable` | Pasifleştirme/etkinleştirme, oturum iptali ve son sistem yöneticisi koruması var |
| `users.reset_password` | `users_reset_password` | Yönetici yeni parola belirler; oturumlar iptal edilir, parola audit'e yazılmaz |
| `roles.view` | `roles_view` | V2 rol listesi ayrı izinle korunuyor |
| `roles.create` | `roles_create` | Özel rol oluşturma ayrı izinle korunuyor; sistem rolü ayrı |
| `roles.update` | `roles_update` | Özel rol izin/sekme/oda düzenleme var; değişiklik oturumda yeniden çözülür |
| `roles.delete` | `roles_delete` | Atanmamış özel rol silinir; atanan rol 409 ile korunur |
| `roles.assign` | `roles_assign` | V2 çoklu özel rol ataması ayrı izinle korunuyor; sistem rolü global yöneticide |
| `audit_logs.view` | `audit_logs_view` | V2 işlem geçmişi artık rol izniyle korunuyor; V1 olay/filtre eşitliği açık |
| `privacy_settings.update` | `privacy_settings_update` | V1 veri sorumlusu/iletişim/sürüm/taslak ve randevu/dosya saklama alanları API/UI ile yerel SQL kabulünde geçti; teslim kişi verisi süresi V2 ek alanı |
| `system_settings.update` | `system_settings_update` | Randevu aralığı, en uzun süre, doğrulama beklemesi, model boyutu ve uzantı ayarları ayrı izinle API/UI ve yerel SQL kabulünde geçti; çevrimiçi başvuru kapalı olduğundan üç dosya/doğrulama alanının çalışan başvurudaki etkisi açık |

Geçiş kuralı: V1 izni için V2'de eşdeğer kapı ve davranış doğrulanmamışsa ilgili izin **verilmez**; eksik işlevli rol otomatik genişletilmez. Önceden V2 rol JSON'unda bulunan `inventory_manage` artık kabul edilen izin listesinde yoktur ve oturum çözümleyicisi bunu yetkiye dönüştürmez. Bu roller ayrı incelemeyle yeni işlem izinlerine çevrilmelidir.
