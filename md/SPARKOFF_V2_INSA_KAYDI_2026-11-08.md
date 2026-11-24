# Sparkoff V2 inşa kaydı — 8 Kasım 2026

**Güncel karar ve durum (9 Kasım 2026):** cPanel hedefi bırakıldı. V2, satın alınan **3 GB RAM'li Ubuntu VDS** için geliştiriliyor; sunucu kurulumu ve canlı dağıtım henüz yapılmadı. Aşağıdaki cPanel maddeleri tarihî ilk planı anlatır, geçerli dağıtım talimatı değildir. Güncel kurulum planı [Ubuntu VDS planında](SPARKOFF_V2_UBUNTU_VDS_KURULUM_PLANI.md), son arayüz çalışması [Spero yenileme kaydında](SPARKOFF_V2_SPERO_TASARIM_YENILEME_2026-11-09.md).

## Kaynak ve karar

İnşa rehberi: `/home/mert/Downloads/sparkoff_v2_codex_i_n_a_rehberi_cpanel_uyumlu.md`.
Mevcut Laravel sitesi korunuyor. Yeni Node/Hono V2 uygulaması depo içindeki `v2/` klasöründe bağımsız geliştiriliyor; mevcut `routes/`, `app/`, `database/` ve canlı veritabanı değiştirilmedi. Canlı dağıtım yapılmadı.

**9 Kasım tasarım güncellemesi:** Kullanıcının yeni `/home/mert/Downloads/spero-tasarim-sistemi.md` rehberiyle V2 görsel dili yeniden kuruldu. Ayrıntılar ve ekran görüntüleri [Spero yenileme kaydında](SPARKOFF_V2_SPERO_TASARIM_YENILEME_2026-11-09.md). Önceki MD dosyaları korundu.

**9 Kasım sistem geçişi başlangıcı:** Yerel V1 SQLite salt okunur sayıldı; envanter alanları V2 şemasına genişletildi ve `0004_bright_energizer.sql` üretildi. Parti sırası ve kabul kapıları [sistem geçiş planında](SPARKOFF_V2_SISTEM_GECIS_PLANI_2026-11-09.md). Gerçek MySQL/MariaDB ve canlı veriler üzerinde işlem yapılmadı.

**9 Kasım barındırma kararı ve gerçek SQL kabulü:** Kullanıcı cPanel hedefinden vazgeçti; güncel hedef **Ubuntu VDS**. [Ubuntu kurulum planı](SPARKOFF_V2_UBUNTU_VDS_KURULUM_PLANI.md) ve `v2/deploy/ubuntu/` servis/ters vekil örnekleri eklendi. Gerçek SQL kabulü için sistem dizinlerini değiştirmeden geçici MariaDB 13.0.2 çalıştırıldı; yalnız ayrı boş `sparkoff_v2_acceptance` veritabanında `0000`–`0004` migration'ları uygulandı. İlk bootstrap denemesi, `db.ts` içindeki Drizzle bağlantı kurma hatasını yakaladı (`client.query is not a function`); `drizzle(pool)` ile düzeltildi. Sonraki bootstrap ve `v2/scripts/sql-acceptance.mjs` geçti: giriş/CSRF, Türkçe CSV önizleme ve dışa aktarım, eşzamanlı iki içe aktarımda tek başarı ve tek çatışma, fotoğraf yükleme/kapak devri/fiziksel dosya silme/kamu erişimi, demirbaş teslim/iade. Bu sonuç Ubuntu VDS kabulü yerine geçmez.

**Medya ve CSV düzeltmeleri:** Medya başlığı, alternatif metni, bağlantı URL'si, sıra ve kapak fotoğrafı düzenleme API/arayüzü eklendi. Kamu kataloğu medyayı sırayla verip seçilen kapak fotoğrafını gösteriyor. CSV önizleme konum kodu tek başına verilen satırların dosya içi çakışmasını da yakalıyor; yönetim ekranı herhangi bir hatada tüm dosyanın duracağını açıkça bildiriyor. `npm run build` başarılı, `npm test` 15/15 geçti.

**MP4/WebM medya partisi:** En fazla 2 video ve dosya başına 50 MB sınırıyla imza doğrulamalı yükleme, yönetim formu, kamu kataloğu gösterimi ve `Range/206` üzerinden akış eklendi. Medya yolları rastgele adlarla ve `PUBLIC_UPLOAD_DIR` altında tutulur; silme fiziksel dosyayı da kaldırır. Ayrı yerel MariaDB 13 kabul veritabanında MP4 yükleme, kamu `Range` isteği ve silme geçti. `npm test` 16/16 ve `npm run build` başarılı. VDS üzerinde gerçek kaynak tüketimi ve WebM tarayıcı oynatması ayrıca sınanacak.

**V1 medya hazırlık aracı:** `v2/scripts/prepare-v1-media.py` eklendi. V1 SQLite ve dosya dizinini salt okunur açar, V1→V2 malzeme ID eşlemesini zorunlu tutar, medya türünü dosya imzasından belirler, boyut/yol sınırını denetler, yeni rastgele V2 yoluna kopyalar ve SHA-256 ile kaynak/hedefi karşılaştırıp JSON manifest üretir. Varsayılan mod yalnız ön kontroldür; `--copy` fiziksel kopyayı açar. Yerel V1 kopyasındaki 1 fotoğrafla ön kontrol ve `/tmp` hedefe kopya/manifest başarılı; V1 aslı değiştirilmedi. Canlı cPanel verisi veya V2 SQL tablosuna otomatik aktarım yapılmadı.

**Üye/birim yönetimi partisi:** Yönetim ekranına üye kartından birim üyeliği ve özel rol atama, birim/oda oluşturma formları bağlandı. Sorumlu rolü yalnız kendi yönetebildiği birime üye ekleyebilir; yönetici özel rol atayabilir. Yerel MariaDB kabul akışına aktivasyon kodu, yeni üye, birim oluşturma, özel rol oluşturma/atama ve üyelik rolü değiştirme eklendi; geçti. `npm run build` başarılı. Birim üyeliği kaldırma, özel rol oluşturma/düzenleme arayüzü ve rol izinlerinin geniş kullanıcı senaryosu kabulü hâlâ açık.

**Yazıcı/filament V1 eşleme partisi:** V2 şemasına yazıcı kodu, V1 durumları (`active`, `maintenance`, `inactive`), sıralama; filament marka, çap, makara ağırlığı, nozul/tabla sıcaklıkları, teknik not, kullanılamama nedeni ve sıralama eklendi. V1 `filaments.material` alanı V2 `filaments.name`, V1 `is_available` alanı V2 `available` olarak eşlenir. `v2/drizzle/0005_blue_stephen_strange.sql` üretildi ve ayrı yerel MariaDB 13 kabul veritabanında uygulandı. Yetkili yazıcı/filament oluşturma ve düzenleme API'si, yönetim formları, örnek mod ve kamu durum metinleri eklendi. SQL kabul senaryosunda Türkçe filament, teknik alanlar, kullanılabilirlik ve yazıcı durumu geçti. `npm test` 18/18, `npm run build` başarılı. Takvim karartma ve çevrimiçi randevu başvurusu henüz taşınmadı; bayrak kapalı.

**İlk envanter API/form partisi:** SKU, marka/model, minimum stok ve kamu görünürlüğü V2 malzeme oluşturma akışına eklendi. Kamu katalog yanıtı V1'deki `hidden/status/exact` gizlilik kuralına yaklaştırıldı. `npm run build` ve 6 test geçti; SQL kabulü açık.

**9 Kasım demirbaş/teslim partisi:** V1 `InventoryItem::availableQuantity()` ve `InventoryTransactionService` incelendi. V2'de demirbaşın toplam miktarı teslim ve sağlam iadede sabit tutuluyor; kullanılabilir miktar açık/kısmi teslimlerin kalan miktarından hesaplanıyor. Ödünç malzemede teslim/iade stok hareketi kaydediliyor ve iade tarihi zorunlu. Demirbaş hasar/kayıp kapanışında kalan miktar stoktan düşülüp hareket kaydediliyor. Kamu kataloğu kesin görünürlükte toplam yerine kullanılabilir miktarı yayımlıyor. Yönetim/üye ekranları kullanılabilir miktarı gösteriyor; örnek mod aynı kuralları izliyor. `npm test`: 8/8, `npm run build`: başarılı. Gerçek SQL kabulü henüz yapılmadı.

**9 Kasım CSV dışa aktarım partisi:** V1'in 14 sütunlu Türkçe CSV başlıkları, tür/durum/görünürlük etiketleri, UTF-8 BOM, noktalı virgül ayracı ve elektronik tablo formül koruması V2'ye eklendi. Yetkili yönetici için `/api/inventory/export.csv` ve yönetim ekranında indirme bağlantısı var. Örnek modda gerçek veritabanı indirmesi gösterilmez. `npm test`: 9/9, `npm run build`: başarılı. CSV içe aktarım ve XLSX hâlâ açık.

**9 Kasım V2 kısayolu ve medya bağlantıları:** Masaüstünde `Sparkoff-Testi-Baslat-v2.desktop` ve depoda `scripts/start-local-test-v2.sh` oluşturuldu. Kısayol yalnız V2 örnek modunu `127.0.0.1:5174` üzerinde açar; V1 kısayolu değişmedi. Masaüstü dosyası ve kabuk sözdizimi doğrulandı, gerçek başlatma sonrası HTTP 200 görüldü. Envanterde HTTPS harici bağlantı ekleme/silme API'si, yönetim formu ve kamu kataloğu gösterimi eklendi. Fotoğraf/video yükleme ve dosya medyası henüz yok.

**Adlandırma kararı:** Kullanıcı, V2'nin marka adının yalnız `Sparkoff` olmasını istedi. Tarayıcı başlığı, ana sayfa üst etiketi, sol menü markası, sayfa üst etiketi ve alt bilgideki eski genişletilmiş ad kaldırıldı. Kısayolun sağlık kontrolü yeni tarayıcı başlığına uyarlandı. Genel içerikte geçen "atölye" sözcüğü faaliyet/yer anlamında kullanılabilir; marka adı olarak kullanılmaz.

**CSV içe aktarım partisi:** V1'in Türkçe sütunlarını, BOM/noktalı virgül/çok satırlı hücre biçimini ve tür/görünürlük/durum etiketlerini okuyan UTF-8 CSV ayrıştırıcısı eklendi. En fazla 2 MB ve 2000 veri satırı kabul ediliyor. Yönetimde dosya seçimi, önizleme ve onay formu var; `/api/inventory/import/preview` tekrarlanan stok kodu, ad ve konum uyuşmazlığını bildiriyor. `/api/inventory/import/confirm` aynı dosyayı yeniden doğrulayıp tek SQL işleminde kategori/konum/malzeme, ilk stok hareketi ve etkinlik kaydı oluşturuyor. Örnek mod da bu akışı arayüz denemesi için taklit ediyor. `npm test`: 13/13, `npm run build`: başarılı. **Gerçek MySQL/MariaDB'de CSV içe aktarım kabulü ve eşzamanlılık sınaması yapılmadı; XLSX desteği ve dosya medyası açık.**

## Tamamlanan kaynaklar

- `v2/package.json`, `package-lock.json`, TypeScript, Vite/Tailwind ve Drizzle yapılandırması oluşturuldu; Node 20+ hedeflendi.
- `v2/src/shared/schema.ts`: 40 MySQL tablosu, Zod giriş şemaları, rol/sekme/izin sabitleri tek dosyada. Drizzle SQL migration'ları `v2/drizzle/` altında.
- `v2/src/server/index.ts` ve `routes/`: Hono Node girişi, statik React çıktısı, sağlık ve kamu uçları; giriş/aktivasyon, birim/kapsam, görev, sohbet, malzeme, stok, teslim/iade, yazıcı/randevu, duyuru ve denetim için ilk API uçları. Aktivasyon kodu oluşturma, özel rol atama, birim üyeliği ve parola değiştirme API'leri eklendi.
- `v2/src/server/auth.ts`: scrypt parola, rastgele oturum kimliği, `__Host-sparkoff_sid` üretim çerezi, CSRF başlığı, ağaçtan `manageIds/accessIds/viewIds`, sekme kapısı ve kanal izolasyonu. Giriş ve aktivasyon denemeleri SQL üzerinden süreli sınırlandı.
- `v2/src/client/`: koyu/açık temalı ziyaretçi, üye ve yönetim ekranları; mobil yüzen menü, masaüstü daraltılabilir/yeniden boyutlandırılabilir menü, Sheet/Modal/Badge, SVG grafik ve Worker tabanlı sohbet yoklaması. Yönetimde görev, malzeme, stok, teslim/iade, aktivasyon kodu ve duyuru formları bağlandı.
- `v2/public/tick.js`: arka plan zamanlayıcısı.
- `v2/src/server/bootstrap.ts`: yalnız boş kullanıcı tablosu için ilk sistem yöneticisi ile Genel/Atölye birimleri oluşturma komutu.
- `v2/app.js`: Passenger varsayılan başlangıç dosyası sarmalayıcısı.
- `md/SPARKOFF_V2_KURULUM_VE_GECIS.md`: yerel kurulum, cPanel ön koşulları ve V1 veri geçiş engelleri.
- `v2/src/client/demo.ts`: MySQL kurmadan arayüzü deneyebilmek için yalnız `VITE_DEMO_MODE=true` altında çalışan, tarayıcıda saklanan örnek veri. `npm run demo` bunu `127.0.0.1:5174` adresinde açar.
- `md/SPARKOFF_V2_TEST_REHBERI.md`: örnek mod adresi ve sınırları.

## Doğrulama

- `npm install --ignore-scripts --no-audit --no-fund` tamamlandı.
- `npm run check` ve `npm run build` son sekme yönlendirmesi, SQL istek sınırı ve duyuru görünürlüğü değişiklikleriyle geçti.
- `npm test` ile dört kritik birim/kanal izolasyonu testi geçti.
- `npm run db:generate` ile 40 tablo için dört SQL migration'ı üretildi; gerçek MySQL/MariaDB üzerinde migration henüz çalıştırılmadı.
- Derlenmiş sunucu yerelde açıldı; `/api/health` ve `/` HTTP 200, oturumsuz görev/envanter/duyuru/randevu yönetimi HTTP 401, yetkisiz cron POST HTTP 403 verdi. Test sunucusu kapatıldı.
- Örnek mod Vite sunucusu `http://127.0.0.1:5174/` adresinde açıldı; `/`, `/admin/inventory` ve `/tick.js` HTTP 200 verdi. Tarayıcıya açma komutu başarıyla çalıştı. Bu test SQL/API güvenliğini doğrulamaz.

## Açık ve kritik işler

1. Gerçek MySQL/MariaDB üzerinde migration ve temel akışların uçtan uca testini yap; şu an yalnız SQL üretimi ve veritabanısız denetimler geçti.
2. Üye/birim/özel rol yönetimi arayüzlerini tamamla; aktivasyon ve giriş hız sınırını gerçek MySQL/MariaDB üzerinde doğrula.
3. Randevu başvurusu, özel dosya yükleme/indirme, gerçek e-posta, bildirimin gönderimi, Web Push ve büyük parçalı yükleme henüz yok. Çevrimiçi randevu kapalı kalmalı.
4. Görev adımları/kanıt yükleme, sohbet dosya/anket/okundu, stok XLSX, güvenli 60 sn geri alma, ayrıntılı audit ve arayüzler henüz tamamlanmadı. CSV içe/dışa aktarım kodu eklendi fakat gerçek SQL kabulü yapılmadı; mevcut formlar yalnız temel işlemleri kapsıyor.
5. Yerel veya kabul MySQL/MariaDB üzerinde migration, yarış durumları ve yetki izolasyonu testleri yapılmalı. Mevcut V1 veri aktarımı henüz tasarlanmadı/çalıştırılmadı.
6. cPanel hesabında Node.js/Passenger desteği, başlatma dosyası, kalıcı süreç, cron, e-posta ve yedekleme doğrulanmalı; V1'den geçiş için geri dönüş planı hazırlanmalı.

## Devam komutları

```bash
cd /home/mert/Documents/Proje/Sparkoff/v2
npm ci
npm run check
npm run build
npm run db:generate
```

`db:migrate` yalnız ayrı ve boş V2 kabul veritabanında kullanılmalı. V1 canlı veritabanına bağlanılmamalı.
