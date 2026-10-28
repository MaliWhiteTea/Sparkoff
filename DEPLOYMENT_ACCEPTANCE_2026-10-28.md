# Üretime Benzer Kabul Kaydı — 28 Ekim 2026

Bu kayıt, `BUGBOT_DUZELTME_SIRASI_2026-10-27.md` içindeki H2 maddesinin
erişim sağlanabilen bölümünü belgeler. Gerçek SMTP ve cPanel hesabına erişim
gerektiren kontroller tamamlanmış sayılmamıştır.

## Geçen kontroller

- Yerel SQLite paketi: 212 test ve 1999 assertion geçti; Pint, TypeScript ve
  üretim derlemesi başarılı.
- GitHub Actions kabul işi: MySQL 8.4 ve MariaDB 10.11 üzerinde boş veritabanı
  migration/seed işlemleri, ön yüz derlemesi ve tam uygulama testi geçti.
  Kanıt: <https://github.com/MaliWhiteTea/Sparkoff/actions/runs/40717273472>
- Yerel scheduler listesinde `appointments:expire-verifications`,
  `appointments:apply-retention` ve `loans:anonymize` kayıtlı.
- Yerel `storage/app/private` ve `bootstrap/cache` dizinleri okunabilir/yazılabilir;
  `public/storage` bağlantısı `storage/app/public` hedefine gidiyor ve özel
  randevu dizinini kapsamıyor.
- `https://sparkoff.tr` için geçerli Let's Encrypt sertifikası ve HSTS mevcut.
  `/up`, `/`, `/3d-yazicilar`, `/filamentler` ve `/randevu` 28 Ekim 2026
  kontrolünde HTTP 200 döndürdü.
- Alan adında MX ve SPF kaydı, `default._domainkey` DKIM anahtarı ve DMARC kaydı
  yayımlanmış durumda. DMARC politikası kontrol tarihinde `p=none`.

## Kabul sırasında bulunan ve giderilen uyumsuzluklar

- Temiz CI ortamında Vite manifesti bulunmadığı için HTTP testleri 500 dönüyordu;
  kabul işi testten önce TypeScript kontrolü ve üretim derlemesi yapacak şekilde
  düzeltildi.
- `activity_logs.action` alanı `inventory_test_data_purged` gibi mevcut işlem
  adları için 20 karakterle yetersizdi. Sütun 64 karaktere genişletildi.
- H1 testi JSON ayarını cast katmanını atlayarak yazıyordu; MySQL'in geçerli JSON
  zorunluluğuna uygun olarak Eloquent üzerinden yazacak şekilde düzeltildi.
- Kişisel tercih testi JSON nesnesinin anahtar sırasına güveniyordu; sırasız nesne
  eşitliğini denetleyecek şekilde düzeltildi.

## Açık veya başarısız kontroller

- `https://sparkoff.tr/malzemeler` HTTP 404 döndürüyor. Rota mevcut `main`
  sürümünde tanımlı olduğundan canlı dağıtımın güncel commit/route cache ile
  eşleşmediğine işaret ediyor. Güncel paket dağıtılıp `php artisan optimize`
  çalıştırıldıktan sonra tekrar kontrol edilmeli.
- Gerçek `randevu@sparkoff.tr` SMTP oturumu, dış posta kutusuna teslimat ve alınan
  iletinin başlıklarındaki SPF/DKIM `pass` sonucu doğrulanmadı. DNS kaydının var
  olması tek başına teslimat kabulü değildir.
- cPanel cronunun gerçekten dakikada bir çalıştığı ve son çalışma zamanı cPanel
  üzerinden doğrulanmadı.
- Üretim PHP ortamındaki `upload_max_filesize`, `post_max_size`, web sunucusu
  gövde sınırı ve PHP kullanıcısının dizin izinleri doğrulanmadı. Yerel CLI
  değerleri sırasıyla 2 MB ve 8 MB olup üretim kanıtı değildir.
- İki gerçek tarayıcı oturumuyla eşzamanlı son yönetici, stok, kısmi iade ve aynı
  randevu aralığı yarışı henüz yapılmadı.
- Yedek alıp geri yükleme denemesi ve uçtan uca mobil/masaüstü canlı kabulü
  tamamlanmadı.

Bu açık maddeler kapanmadan çevrimiçi randevu özelliği canlıya hazır kabul
edilmemeli.
