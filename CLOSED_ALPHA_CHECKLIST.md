# Kapalı Alpha Yayın Kontrol Listesi

Bu liste Sparkoff'u yalnız davetli kullanıcılarla, sentetik veriler kullanarak
denemek içindir. Üretim kabulünün veya çevrimiçi randevu kabulünün yerine geçmez.

## 1. Güvenlik kapısı

- [ ] Hosting sağlayıcısı PHP paketinin `CVE-2026-109618` ve
  `CVE-2026-109619` düzeltmelerini içerdiğini yazılı veya paket changelog'u ile
  doğruladı.
- [ ] PHP web çalışanları güncellemeden sonra yeniden başlatıldı.
- [ ] Web SAPI için `session.upload_progress.enabled=0` uygulandı ve çalışanlar
  yeniden başlatıldı; `CVE-2026-115560` düzeltmesi yayımlandığında paket durumu
  yeniden değerlendirilecek.
- [ ] `APP_ENV=production`, `APP_DEBUG=false` ve `SESSION_SECURE_COOKIE=true`.
- [ ] SSL, HSTS ve güvenli oturum çerezleri doğrulandı.
- [ ] Günlük veritabanı yedeği etkin ve en az bir geri yükleme denemesi yapıldı.

PHP paket doğrulaması tamamlanmadan dağıtım yapılmaz. Laravel bakım modu PHP
çalışma zamanı açıklarını engellemez.

## 2. Alpha kapsamı

- [ ] Alpha ortamı davet kodu, HTTP Basic Auth veya cPanel Directory Privacy ile
  yalnız davetlilere kapatıldı.
- [ ] `ONLINE_BOOKING_ENABLED=false`; SMTP kabulü tamamlanana kadar randevu
  başvurusu açılmadı.
- [ ] `ALLOW_DESTRUCTIVE_DATABASE_COMMANDS=false`.
- [ ] Gerçek kişi, teslim, iletişim veya model dosyası yerine sentetik test
  verileri hazırlandı.
- [ ] Her test kullanıcısına ayrı hesap ve yalnız gereken roller verildi.
- [ ] Test bitince hesapları pasifleştirecek sorumlu belirlendi.

Önerilen kurulum `alpha.sparkoff.tr` gibi ayrı bir alt alan adı ve sunucu
seviyesinde erişim korumasıdır. Ana alan adı kullanılacaksa erişim koruması
dağıtımdan önce etkinleştirilmelidir.

## 3. Dağıtım

- [ ] `main` dalındaki son commit ve GitHub Actions veritabanı kabul işi başarılı.
- [ ] Mevcut veritabanı ve `.env` dosyasının erişimi sınırlı yedeği alındı.
- [ ] Üretim bağımlılıkları ve `public/build` güncellendi.
- [ ] `php artisan migrate --force` hatasız tamamlandı.
- [ ] `php artisan db:seed --class=RolePermissionSeeder --force` tamamlandı.
- [ ] `php artisan optimize` tamamlandı.
- [ ] Belge kökü yalnız Laravel `public` dizinine yönleniyor.
- [ ] `storage` ve `bootstrap/cache` yazma izinleri doğrulandı.

## 4. Canlı duman testi

- [ ] `/up`, `/`, `/3d-yazicilar`, `/filamentler` ve `/malzemeler` HTTP 200.
- [ ] `/randevu`, randevu kapalıyken güvenli biçimde 3D yazıcı sayfasına dönüyor.
- [ ] Yetkisiz ziyaretçi yönetim sayfalarına erişemiyor.
- [ ] Test yöneticisi giriş yapabiliyor ve kendi parolasını değiştirebiliyor.
- [ ] Malzeme arama, filtre, stok, teslim ve iade işlemleri sentetik kayıtlarla
  tamamlanıyor.
- [ ] İşlem geçmişi test değişikliklerini kaydediyor.
- [ ] Telefon ve masaüstünde menü, form, modal ve sayfalama kontrol edildi.
- [ ] PHP/Laravel hata günlüğünde yeni kritik hata bulunmuyor.

## 5. Test kullanıcılarına verilecek sınırlar

- Gerçek kişisel veri veya gerçek model dosyası yüklemeyin.
- Bulduğunuz hatada sayfa adresini, cihaz/tarayıcıyı ve tekrar adımlarını yazın.
- Ekran görüntüsünde parola, e-posta veya oturum bilgisi bırakmayın.
- Stok ve teslim testlerini yalnız `ALPHA TEST` olarak işaretli sentetik
  malzemelerde yapın.
- Güvenlik şüphesinde teste devam etmeyip yöneticiyi bilgilendirin.

## Yayın kararı

Kapalı alpha ancak güvenlik kapısı, erişim koruması, yedek ve duman testi
tamamlandığında açılır. Çevrimiçi randevu; SMTP, SPF/DKIM, dosya yetkisi,
zamanlayıcı ve uçtan uca doğrulama kabulü ayrıca tamamlanana kadar kapalı kalır.
