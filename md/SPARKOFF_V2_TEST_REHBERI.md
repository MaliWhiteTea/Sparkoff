# Sparkoff V2 yerel test rehberi

## Hemen açılabilen örnek mod

Adres: `http://127.0.0.1:5174/`

Masaüstündeki `Sparkoff-Testi-Baslat-v2.desktop` kısayolu `scripts/start-local-test-v2.sh` dosyasını çalıştırır; örnek modu başlatıp tarayıcıda açar. V1 kısayolundan bağımsızdır. V2 günlüğü `storage/logs/local-test-v2.log` dosyasındadır. 9 Kasım'da kısayol doğrulandı ve sayfa HTTP 200 verdi.

Bu mod yerel Vite sunucusunda çalışır. Üstte **V2 ÖRNEK MOD** etiketi bulunur. Rol seçicisinden Sistem yöneticisi, Yönetici, Denetim, Sorumlu, Hoca ve Üye görünümleri denenebilir. Örnek kayıtlar tarayıcı `localStorage` alanına, geri bildirim görselleri Cache Storage alanına yazılır; **Örnek veriyi sıfırla** düğmesi ikisini de temizler. V1 uygulaması ve canlı veritabanı kullanılmaz.

Deneme önerisi:

1. Ana sayfa, yazıcılar, malzemeler ve geri bildirim sayfalarını gez.
2. `/admin/overview`, `/admin/tasks`, `/admin/inventory`, `/admin/members`, `/admin/announce` ekranlarını aç.
3. Görev, malzeme, stok hareketi, teslim ve duyuru oluştur; sohbet mesajı gönder. Yönetim envanterinde arama, filtre ve sayfa düğmelerini; medya kartında sayfa düğmelerini de dene.
4. Rol seçicisiyle Üye ve Hoca görünümüne geç; menülerin ve kanalların farklılaştığını incele.

Örnek mod yalnız arayüz etkileşimini gösterir. Gerçek SQL, oturum güvenliği, e-posta, dosya yükleme, randevu kabulü ve eşzamanlı stok işlemlerini doğrulamaz. Bu alanlar V2 kabul planında açıktır.

## Sunucu kapanırsa

```bash
cd /home/mert/Documents/Proje/Sparkoff/v2
npm ci
npm run demo
```

Ardından `http://127.0.0.1:5174/` açılır. Port meşgulse önce o porttaki önceki V2 örnek sunucusu kapatılır. `npm run demo`, MySQL gerektirmez.

## Gerçek V2 veritabanı testi

Yerel kabul MariaDB'si `storage/framework/local-test-v2/mariadb-runtime/` altındadır. Veritabanı `127.0.0.1:4319/sparkoff_v2_acceptance`, API `127.0.0.1:4320` üzerinden çalışır. Bağlantı ve test yöneticisi bilgileri git dışında tutulan `acceptance.env` dosyasındadır. Bu dosyanın içeriğini çıktı olarak paylaşma.

Çalışan servisleri kontrol et:

```bash
ss -ltn | rg ':(4319|4320|5174)\b'
```

Kapalıysa MariaDB'yi bir terminalde yalnız yerel kabul veri diziniyle başlat:

```bash
cd /home/mert/Documents/Proje/Sparkoff
SPARKOFF_V2_RUNTIME="$PWD/storage/framework/local-test-v2/mariadb-runtime"
"$SPARKOFF_V2_RUNTIME/root/usr/bin/mariadbd" --no-defaults \
  --datadir="$SPARKOFF_V2_RUNTIME/data" \
  --socket=/tmp/sparkoff-v2-acceptance.sock --port=4319 --bind-address=127.0.0.1 \
  --pid-file="$SPARKOFF_V2_RUNTIME/mariadb.pid" --log-error="$SPARKOFF_V2_RUNTIME/mariadb.err"
```

API'yi ikinci terminalde aç. Tarayıcı doğrudan `4320` adresine gidecekse `APP_ORIGIN` değerini bu adrese ayarla; aksi hâlde yönetim yazma istekleri `Geçersiz kaynak` hatası alır. Gizli `.env` dosyasını ekrana yazdırma.

```bash
cd /home/mert/Documents/Proje/Sparkoff/v2
set -a
source ../storage/framework/local-test-v2/mariadb-runtime/acceptance.env
set +a
npm run build
APP_ORIGIN=http://127.0.0.1:4320 PORT=4320 NODE_ENV=production \
  PRIVATE_UPLOAD_DIR="$PWD/../storage/framework/local-test-v2/private-appointment-files" npm start
```

MariaDB ve kabul API'si açıksa, sentetik kayıtlar yazan geniş SQL kabulünü yalnız bu ayrı veritabanında çalıştır:

```bash
cd /home/mert/Documents/Proje/Sparkoff/v2
set -a
source ../storage/framework/local-test-v2/mariadb-runtime/acceptance.env
set +a
PRIVATE_UPLOAD_DIR="$PWD/../storage/framework/local-test-v2/private-appointment-files" node scripts/sql-acceptance.mjs
```

Betik yalnız yerel `4319/sparkoff_v2_acceptance` adresini kabul eder. V1 SQLite, canlı SQL ve VDS bu testte kullanılmaz. Birim testleri ve üretim derlemesi için `npm test` ile `npm run build` çalıştırılır. GitHub Actions bunları ve temiz MariaDB migration tekrarını ayrıca doğrular; gerçek tarayıcı, VDS, SMTP ve yedek geri yükleme kabulü hâlâ ayrıdır. Çevrimiçi randevu bayrağı bu kabul tamamlanmadan açılmaz.
