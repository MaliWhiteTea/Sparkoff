# Sparkoff V2 Ubuntu VDS kurulum planı

**Karar:** 9 Kasım 2026'da kullanıcı cPanel hedefinden vazgeçti. V2, Ubuntu VDS üzerinde kurulacak. Bu belge hazırlık planıdır; canlı VDS'ye henüz bağlantı veya dağıtım yapılmadı. V1 Laravel sitesi ve veritabanı korunur.

## Hedef düzen

- Node.js 20+ uygulaması `/srv/sparkoff-v2` altında ayrı `sparkoff` kullanıcısıyla systemd servisi olarak çalışır.
- Nginx HTTPS trafiğini yalnız `127.0.0.1:3000` üzerindeki Hono uygulamasına iletir. [systemd örneği](../v2/deploy/ubuntu/sparkoff-v2.service) ve [Nginx örneği](../v2/deploy/ubuntu/sparkoff-v2.nginx.conf.example) gerçek alan adı, sertifika ve sunucu yolları bilindiğinde uyarlanır.
- Satın alınan VDS 3 GB RAM olarak bildirildi; kurulum sürüyor. Gerçek Ubuntu sürümü, disk alanı ve IP henüz doğrulanmadı. Görselde seçili 25.04 sürümü destek dışı olduğundan kurulumda desteklenen bir LTS sürümü kullanılmalı; seçilen nihai sürüm VDS hazır olduğunda kontrol edilir.
- V2 için ayrı MySQL 8.x veya MariaDB 10.11+ veritabanı ve sınırlı yetkili kullanıcı açılır. V1 veritabanına migration uygulanmaz.
- Ortam değişkenleri `/etc/sparkoff-v2.env` içinde yalnız servis kullanıcısı ve root tarafından okunabilir tutulur. `PUBLIC_UPLOAD_DIR=/var/lib/sparkoff-v2/uploads` web kökü dışında kalır; uygulama kullanıcısı bu dizine yazabilir.
- Cron/hatırlatma işleri için systemd timer veya yerel cron kullanılır; `X-Cron-Secret` ve uygulama sırları komut satırında veya web kökünde tutulmaz.

## Dağıtımdan önce kabul

1. Ubuntu sürümü, Node sürümü, veritabanı sürümü, RAM/disk, DNS ve yedekleme yöntemi ölçülür.
2. Ayrı boş V2 kabul veritabanında migration, bootstrap, UTF-8, CSV, dosya, oturum, yetki ve yarış testleri çalıştırılır.
3. HTTPS, servis yeniden başlatma, kalıcı medya, yükleme sınırı, güvenlik duvarı ve yedekten geri yükleme sınanır.
4. V1 verisi ve dosyaları salt okunur kopyadan dönüştürülüp sayılar ve sağlama toplamları karşılaştırılır. V1 üretim sistemi çalışmaya devam eder.
5. Yayın ve alan adı geçişi ayrıca kararlaştırılır; bu plandaki hazırlık canlıya geçiş yetkisi değildir.

## Yerel SQL kabulü

9 Kasım 2026'da ayrı `sparkoff_v2_acceptance` veritabanında MariaDB 13.0.2 ile `0000`–`0004` migration'ları çalıştı. Gerçek SQL bağlantısı, bootstrap, giriş/CSRF, Türkçe CSV içe/dışa aktarım, eşzamanlı iki içe aktarımın tek başarı/tek çatışma sonucu, fotoğraf yükleme/kapak devri/dosya silme/kamu erişimi ve demirbaş teslim/iade geçti. Tekrarlanabilir senaryo: `v2/scripts/sql-acceptance.mjs`. Bu kabul yalnız yerel MariaDB 13 içindir; Ubuntu VDS'nin gerçek veritabanı sürümü ve ortamı ayrıca kabul edilecektir.

## V1 medya dosyası provası

`v2/scripts/prepare-v1-media.py` V1 SQLite kopyası, `storage/app/public` kopyası ve V1→V2 malzeme ID JSON eşlemesiyle çalışır. Aynı komut önce `--copy` olmadan ön kontrol için kullanılır; onaylanan kopya için `--copy` eklenir. Yeni dosyalar `PUBLIC_UPLOAD_DIR` altında rastgele yol alır; araç SHA-256 manifesti üretir ve V1'e yazmaz. Manifest henüz V2 SQL'e otomatik yüklenmez; malzeme kimliği eşlemesi ve medya veritabanı aktarımı ayrıca kabul edilmelidir. Yerel V1'deki tek fotoğrafla `/tmp` altında prova geçti.
