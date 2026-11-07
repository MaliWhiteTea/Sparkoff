# Sparkoff — tam kapsamlı denetim ön raporu

**Tarih:** 6 Kasım 2026
**Sorumlu:** Codex; kontrolleri ve hata araştırmasını yerelde ben yürüteceğim.
**Referans commit:** `b2a30a0` (`main`, `origin/main` önünde 14 commit).
**Aşama:** Denetim kapsamı ve başlangıç ölçümü hazır. Aşağıdaki işlev denetimleri henüz yapılmadı; maddeler tamamlandı diye işaretlenmemelidir.
**Ortam sınırı:** Canlı site testleri ayrı sürüyor. Canlı veriye müdahale ve yayın bu denetimin kapsamında değil.

## Güncel durum — 7 Kasım 2026

Bu belge denetim başlamadan önce yazılmış **ön rapordur**; aşağıdaki başlangıç sayıları 6 Kasım anlık görüntüsüdür. Yapılan işlemlerin ayrıntılı kanıtları [ilk çalışma kaydında](YEREL_DENETIM_ILK_CALISMA_KAYDI_2026-11-06.md) ve [7 Kasım çalışma kaydında](YEREL_DENETIM_CALISMA_KAYDI_2026-11-07.md) bulunur. Aşağıdaki özet, `6c6c330` commit'indeki yerel durumu gösterir.

### Kontrol edilenler

| Alan | Doğrulanan kapsam | Sınır |
|---|---|---|
| Otomatik kalite kapısı | Yerelde 306 PHP testi: 305 geçti, 1 MySQL/MariaDB gerektirdiği için atlandı; 2911 assertion. PHP biçimi, TypeScript tipleri ve Composer güvenlik duyurusu kontrolü geçti. [GitHub CI çalışması #28](https://github.com/MaliWhiteTea/Sparkoff/actions/runs/42379767670) (`401664f`) MySQL 8.4 ve MariaDB 10.11 işlerini başarıyla tamamladı. | CI temiz migration/seed ve otomatik testleri kapsıyor; canlı hosting kabulü değil. |
| Rota giriş kapısı | Yönetim rotalarının genel `auth` kapısı incelendi. Doğrudan test çağrısı bulunmayan 7 yönetim rotasına HTTP testleri eklendi. | 97 rotanın tam izin/hata/yan etki matrisi açık. |
| Stok ve teslim | Dört ondalıklı miktarın reddi; teslim/iade stok hareketleri; arşivli malzemenin açık ödünç kaydına iade sınandı. | Eşzamanlılık, tüm tür/rol kombinasyonları açık. |
| Randevu | Çakışan slot, dosya türü/içeriği, özel dosya erişimi, doğrulama ve takip token'ı, geçersiz ve yinelenen iptal, SMTP başarısızlığı ve disk yazma hatası için HTTP testleri çalıştı. | Gerçek SMTP ve MySQL/MariaDB yarış testi açık. |
| Yetki ve kişisel veri | Son yönetici rolü korunması, randevu notu gizleme, duyuru hedef kitle silme yetkileri, çıkış sonrası oturum kontrol edildi. | Her eylem/rol matrisi açık. |
| Geri bildirim ve medya | Büyük görsel istemcide reddi, seçme/kaldırma, kısa açıklama doğrulaması ve disk hata yolları sınandı. | Başarılı gönderimin gerçek tarayıcı turu, tüm dosya türleri ve görüntüleme matrisi açık. |
| Gerçek tarayıcı | 375–390 px görünümde ilk sayfa açılışı, mobil menü, İletişim bağlantısı, Esc/odak dönüşü ve tema kalıcılığı sınandı. | 390 maddelik planın büyük bölümü henüz tek tek kapatılmadı. |

### Bulunan ve yerelde düzeltilen hatalar

`BUG-001` stok miktarında fazla ondalık basamak; `BUG-002` randevu geçmişi notunda kişisel veri görünmesi; `BUG-003` değişmeyen yönetici rolünün metin kimliğiyle yanlış reddi; `BUG-004` geri bildirim görseli disk hatasında 500; `BUG-005` envanter medyası disk hatasında 500; `BUG-006` randevu dosyası yazılamadığında başvurunun kabulü; `BUG-007` kapalı mobil menünün kamu sayfalarını yatay taşırması. İlk altı bulgu HTTP regresyon testleriyle, yedinci bulgu gerçek tarayıcı ölçümüyle doğrulandı. Ayrıntılar çalışma kayıtlarında yer alır. Bu düzeltmelerin **canlıya geçişi bu raporla doğrulanmış değildir**.

### Kalan işler ve kabul engelleri

1. Bu belgedeki A–I maddelerinin ve [390 maddelik arayüz planının](ALPHA_UCTAN_UCA_MANUEL_TEST_PLANI.md) her birine kanıtlı durum atanması. Şu an geçen örnek akışlar var; toplam geçti/kaldı yüzdesi güvenilir biçimde hesaplanamaz.
2. 97 rotanın yöntem, girişsiz/pasif/sınırlı rol, yanlış kimlik, geçersiz girdi, tekrarlı istek, yan etki ve gizlilik kontrollerinin tamamlanması.
3. MySQL/MariaDB CI temiz kurulum, migration/seed ve otomatik testleri geçti. Aynı slot yarışı ve son yönetici eşzamanlılığı için özel, gerçek eşzamanlı istek kanıtı hâlâ açık; yerelde bu veritabanı sunucuları bulunmadı.
4. Gerçek tarayıcıda masaüstü/mobil, açık/koyu tema, klavye, yenileme ve dosya yükleme akışlarının geri kalanı; gerçek SMTP, cron, hosting ve yedekten geri yükleme koşulları.
5. `ONLINE_BOOKING_ENABLED=false` durumunda geçerli eski doğrulama/takip bağlantılarının da 404 olması alpha planındaki `BOOK-OFF-02` beklentisiyle uyumlu ve yeni HTTP testiyle doğrulandı. Büyük JS parçası uyarısının ilk yüklemeye etkisi hâlâ ölçülecek.

**Karar:** Yerel düzeltmeler testlerden geçti; tam denetim ve canlı kabul henüz tamamlanmadı.

## 1. Amaç ve tamamlanma ölçütü

Amaç, uygulamadaki her rotayı, görünür eylemi, kritik veri akışını, izin sınırını ve hata yolunu test ederek kanıtlı bir sonuç üretmek. Mevcut [alpha manuel test planındaki](ALPHA_UCTAN_UCA_MANUEL_TEST_PLANI.md) **390 madde** bu denetimin temel kapsam listesi olarak alınır. Bu belge onlara ek olarak kod, veritabanı, otomasyon ve izlenebilirlik kontrollerini tanımlar. İki liste birlikte takip edilecek; yalnız test dosyalarının yeşil olması kabul sayılmayacak.

Bir alan ancak şu koşullarda **geçti** sayılır: beklenen sonuç doğrulanır; ters/boş/hatalı girdi denenir; yetkisiz ve gerekli kısıtlı rol denenir; ilgili veri değişimi ve yan etkileri (stok, kayıt geçmişi, e-posta, dosya, bildirim vb.) incelenir; tarayıcı konsolu, HTTP yanıtı ve uygulama logunda yeni hata görülmez. Arayüz için masaüstü ve mobil genişlik, açık/koyu tema, klavye ile kullanım ve yenileme/geri gezinme ayrıca kontrol edilir. Uygulanmayan koşul gerekçesiyle kaydedilir.

Durum sözlüğü: `BEKLİYOR`, `GEÇTİ`, `HATA`, `ENGELLİ`, `UYGULANAMAZ`. Her test kaydında kimlik, commit, ortam, aktör/rol, ön koşul, adımlar, beklenen/gerçek sonuç, ekran görüntüsü veya komut çıktısı ve varsa hata kaydı bağlantısı bulunacak. Bu rapordaki boş kutuların tamamı **BEKLİYOR** demektir; başlangıç ölçümü ayrı tabloda gösterilir.

## 2. Kanıta dayalı başlangıç durumu

| Kontrol | Sonuç | Sınır |
|---|---|---|
| `php artisan test --compact` | 287 test: 286 geçti, 1 atlandı, 2799 assertion | Atlanan `DatabaseCompatibilityTest` yalnız MySQL/MariaDB ile çalışıyor; SQLite sonucu üretim veritabanı kabulünün yerine geçmez. |
| `./vendor/bin/pint --test` | Geçti | Biçim kontrolü, davranış denetimi değil. |
| `./node_modules/.bin/tsc --noEmit` | Geçti | Tip kontrolü, tarayıcı etkileşimini doğrulamaz. |
| `composer audit --format=summary` | Bilinen güvenlik duyurusu bulunmadı | İş mantığı/güvenlik sınırı incelemesi ayrıca yapılacak. |
| `npm run build` | Geçti | Vite, küçültülmüş tek JS parçasının 500 kB üzerinde olduğuna dair uyarı verdi; performans turunda değerlendirilecek. |
| Rota envanteri | `routes/web.php` içinde 97 HTTP rota tanımı | Her rota yöntem, kimlik doğrulama, izin, doğrulama, yan etki ve hata yanıtı ile eşleştirilecek. |
| Arayüz envanteri | Kamu sayfaları, yönetim sayfaları ve ortak bileşenler belirlendi | Her görünür düğme/bağlantı/menü eylemi ayrıca sayılacak. |

Mevcut testler güvenilir bir başlangıç sağlar, fakat gerçek tarayıcı, gerçek SMTP, MySQL/MariaDB, sunucu cron'u ve canlı hosting davranışını bu tablo ispatlamaz. [README](README.md) içindeki bazı “planlandı” durumları kodun bugünkü haliyle tekrar karşılaştırılacak; belge ile ürün arasındaki fark da denetim bulgusu sayılacak.

## 3. Çalışma yöntemi ve kanıt

1. **Envanter:** `routes/web.php`, tüm Inertia sayfaları, ortak bileşenler, kontrolörler, servisler, migration/seed dosyaları ve zamanlanmış komutları eşleştir. 97 rotanın her biri için takip satırı oluştur. Sayfadaki tüm düğme, bağlantı, açılır menü, onay penceresi, dosya seçici, form alanı ve klavye eylemlerini çıkar.
2. **Statik inceleme:** Girdi doğrulama, authorization, dosya yolu, veri sorgusu, yarış durumu, işlem/transaction, hata yönetimi, kişisel veri ve sır sızıntısı açısından kodu gözden geçir. Testin kaçırdığı senaryoya önce başarısız olması gereken test ekle.
3. **Yalıtılmış yürütme:** Sentetik kullanıcı ve kayıtlarla SQLite hızlı turunu, sonra mümkünse MySQL 8.4 ve MariaDB 10.11 kabul turunu çalıştır. Her turda temiz veritabanı, migration/seed ve yükseltme senaryolarını ayrı dene. Canlı veriye karşı yıkıcı komut çalıştırma.
4. **HTTP ve tarayıcı turu:** Kimliksiz, tam yetkili, sınırlı yetkili ve pasif hesapla başarılı/başarısız yolları dene. Gerçek tarayıcı erişimi yoksa bu maddeleri “geçti” sayma; tarayıcıya bağımlı kanıtı `ENGELLİ` olarak tut ve uygun yerel tarayıcı otomasyonu kur.
5. **Bulgu döngüsü:** Hata için tekrarlama adımı ve beklenen/gerçek sonuç kaydet; mümkünse regresyon testi ekle; düzelt; ilgili test ve çapraz modül testlerini tekrar çalıştır. Görsel kusuru da ekran görüntüsü ile kaydet.
6. **Kapanış:** 390 manuel plan maddesinin ve aşağıdaki ek kontrollerin her birine durum ver. `ENGELLİ` ve `UYGULANAMAZ` gerekçeleri açık kalsın. Kritik/ağır bulgular kapanmadan tam kabul verme.

Her rota için standart kontrol: `GET/POST/PUT/PATCH/DELETE` doğru çalışıyor mu; yanlış HTTP yöntemi reddediliyor mu; girişsiz, pasif, yetkisiz ve yetkili kullanıcı ne görüyor; CSRF ve throttle uygulanıyor mu; geçersiz/olmayan/başkasına ait kimlik ne döndürüyor; doğrulama Türkçe ve alan bazında anlaşılır mı; kayıt/yan etki atomik mi; tekrar gönderim çift işlem yaratıyor mu; olay loglanıyor mu; yanıt hassas veri sızdırıyor mu. Bu kural **97 rotanın tamamına** uygulanacak.

Her görünür arayüz eylemi için standart kontrol: açılma/kapanma, etkin/pasif durumu, loading/çift tıklama, başarılı/başarısız geri bildirim, odak ve Esc/Enter, geri/ileri, yenileme, mobil görünüm, açık/koyu tema, boş veri, uzun metin, düşük yetki. Bu kural yeni eklenen butonlara da uygulanacak. Native `beforeunload` uyarısının metni/teması tarayıcıya aittir; özel tema beklentisi bu koşuldan ayrılacak.

## 4. Tam kapsam kontrol listesi

### A. Ortam, yapılandırma ve yayın hazırlığı

- [ ] A01 — PHP/Composer/Node sürümleri, uzantılar, `composer.lock`/`package-lock.json`, kurulum tekrarlanabilirliği; geliştirme ve üretim ortam değişkenleri; `.env.example` doğruluğu.
- [ ] A02 — Temiz kurulum ve mevcut veriden yükseltme migration'ları; tekrar çalıştırma, kısmi başarısızlık, rollback; `roles`, `role_user`, stok, marka/model ve geri alma şemaları.
- [ ] A03 — Seed işlemlerinin tekrar çalıştırılabilirliği; varsayılan yetki kümeleri; yönetici hesabının korunması; eksik rol tablolarının onarımı.
- [ ] A04 — `APP_DEBUG`, `APP_KEY`, URL, trusted proxy, güvenli oturum/cookie, CORS, CSP ve diğer güvenlik başlıkları; bilinmeyen rota/500 çıktısında sır sızıntısı.
- [ ] A05 — `public`/özel storage ayrımı, symlink, dosya izinleri, log/cache/session yazılabilirliği; `public_html` giriş dosyası ve `.htaccess` yolu.
- [ ] A06 — Build manifesti ve statik varlıklar; 404, cache ve font yüklenmesi; büyük JS parçasının ilk yükleme etkisi.
- [ ] A07 — GitHub Actions kalite kapıları, MySQL/MariaDB matrisi, test paketinin CI'daki fiili sonucu; geçici cron ve yayın komutları için geri dönüş planı.

### B. Ziyaretçi portalı ve ortak arayüz

- [ ] B01 — Ana sayfa: hizmetler, duyuruların yayın/durum sırası, CTA'lar, boş durum ve yönetim ayarlarının yansıması.
- [ ] B02 — Üst menü ve alt bilgi: tüm sayfalardaki bağlantılar, İletişim çapasının açılması, telefon/WhatsApp/e-posta hedefleri, boş ayarlarda anlaşılır görünüm.
- [ ] B03 — Mobil menü: aç/kapat, dış tık, Esc, odak tuzağı/dönüşü, arka plan kaydırma, rota değişimi, menü sekmelerinin kaybolmaması.
- [ ] B04 — Tema: kamu ve yönetim giriş sayfasında açık/koyu/sistem, kalıcılık, kontrast, başarı mesajları, formlar ve modal katmanları.
- [ ] B05 — Yazıcı durumu, bakım ve yedi günlük takvim; durum ile rezervasyon yapılabilirliğinin tutarlılığı; zaman dilimi/yaz saati sınırları.
- [ ] B06 — Filament listesi: tür, renk, kaynak, stok/kullanılabilirlik, filtreler ve boş durum.
- [ ] B07 — Malzeme kataloğu: arama/kategori/stok filtresi, ödünç verilebilirlik, gizli miktar, marka/model, uzun ad/açıklama, sayfalama ve boş durum.
- [ ] B08 — KVKK metni ve bağlantısı; geri bildirim formu, tür seçimi, isteğe bağlı görsel, boyut/tür doğrulaması, başarı ekranı, tekrar gönderim ve throttle.
- [ ] B09 — Tüm kamu sayfalarında 320/375/768/1024/masaüstü genişlikleri, taşma, küçük metin, zoom %200, klavye ve ekran okuyucu etiketleri.

### C. Yönetim girişi ve ortak kabuk

- [ ] C01 — Giriş/çıkış, yanlış parola, pasif hesap, rate limit, oturum yenileme/sonlanma, login CSRF, açık/koyu tema ve parola alanı davranışı.
- [ ] C02 — Yan menü daraltma/genişletme/boyutlandırma; kişisel tercihin kaydı ve **yan menü okunda gereksiz başarı bildirimi olmaması**.
- [ ] C03 — Yetkiye bağlı menü ve ayar sekmeleri; doğrudan URL ile erişim; rol değişince açık oturumun güncellenmesi.
- [ ] C04 — Genel bakış: yetkiye göre kartlar, sayaçlar, son görüntülenen kayıtlar, duyurular, boş durum ve hızlı eylemler.
- [ ] C05 — Hızlı arama: tür/sonuç sınırı, arama girişi, yönlendirme, yetki ve kişisel veri sızıntısı, uzun sorgu/throttle.
- [ ] C06 — Bildirimler: okunmamış sayacı, tekil/tümünü oku, kayıt kümesi değişince yeniden açılması, rol sınırı, mobil görünüm.
- [ ] C07 — Ortak liste araçları: arama, sıralama, sütun seçimi, kaydedilmiş filtre, toplu seçim/işlem, temizle/sıfırla, sayfalama ve geri dönüş URL'si.
- [ ] C08 — Taslak/yenileme koruması: gerçek değişiklikte uyarı, kayıt sonrası uyarı olmaması, güvenli alan sınırı, geri/ileri, sekme kapatma ve taslak geri yükleme.
- [ ] C09 — Onay ve geri alma bileşenleri: hata/başarı mesajı, tek kullanımlık eylem, süresi dolan eylem, yanlış nesneye uygulanmama.

### D. Envanter, stok, dosya ve aktarım

- [ ] D01 — Malzeme oluştur/görüntüle/düzenle/arşivle/kalıcı sil: ad, kod, **marka**, **model**, tür, birim, eşik, görünürlük, açıklama ve etkinlik sınırları.
- [ ] D02 — Kategori/konum oluştur ve düzenle; bağımlı malzeme varken silme veya pasifleştirme davranışı; boş seçenekler.
- [ ] D03 — İlk stok, giriş/çıkış/düzeltme, negatif stok yasağı, eşik uyarısı, hareket geçmişi, eşzamanlı istek ve geri alma tutarlılığı.
- [ ] D04 — Toplu düzenleme, seçim sayısı ve sayfalar arası seçim; yetki, doğrulama, kısmi başarısızlık ve istemci görünümünün güncellenmesi.
- [ ] D05 — Medya yükle/gör/başlık düzenle/sil; MIME ve gerçek içerik, boyut, dosya adı/yolu, erişim izni, bozuk dosya ve özel dosyanın doğrudan URL'den okunamaması.
- [ ] D06 — CSV/XLSX dışa aktarım: sütun düzeni, Türkçe karakter, marka/model, özel karakter formül enjeksiyonu, filtreli veri, görünmeyen alanlar, boş liste.
- [ ] D07 — CSV/XLSX içe aktarım: örnek dosya, kolon eşlemesi, marka/model, önizleme/onay/iptal, bozuk/büyük/boş dosya, tekrar yükleme, yinelenen kod, geçersiz satır, atomiklik ve stok sonucu.
- [ ] D08 — Kamu kataloğunda envanter görünürlük ayarı ve yönetici stok sayısı tutarlılığı; arşivli/silinmiş medyanın sızmaması.
- [ ] D09 — Test Araçları toplu silme: yalnız sistem yöneticisi, açık teslim/ilişki koruması, tam onay ve sentetik ortamla sınırlı yürütme.

### E. Teslim/iade

- [ ] E01 — Teslim oluşturma: ödünç verilebilir tür, mevcut stok, miktar, teslim alanı, tarih, not, isteğe bağlı e-posta ve kişisel veri doğrulaması.
- [ ] E02 — Kısmi/tam iade, hasarlı/kayıp kapatma ve geri alma; stok hareketleri ile teslim bakiyesinin çift sayılmaması.
- [ ] E03 — Geç teslim ve bildirim; aynı kayda eşzamanlı işlem, tekrar tıklama ve başka rolün müdahalesi.
- [ ] E04 — Kapanmış kaydın anonimleştirilmesi; aktif/gecikmiş/çözülmemiş kaydın korunması; işlem geçmişinde kişisel veri kalmaması.

### F. Randevu ve takvim — özellik kapalı/açık iki tur

- [ ] F01 — `ONLINE_BOOKING_ENABLED=false`: kamu ve yönetim randevu rotaları/menülerinin beklenen biçimde kapanması; mevcut veri ve diğer modüllerin etkilenmemesi.
- [ ] F02 — Özellik açıkken tarih/saat, çalışma günü, yazıcı durumu, bakım/kapalı zaman, süre ve kapasite doğrulaması; saat dilimi ve sınır günler.
- [ ] F03 — Aynı slotu eşzamanlı isteyen iki kullanıcı; yarım kalan kayıt, transaction ve çifte rezervasyon engeli.
- [ ] F04 — Dosya yükleme/indirme: uzantı, MIME, boyut, saklama, yetki, yanlış randevuya ait dosya ve zararlı içerik sınırı.
- [ ] F05 — Doğrulama ve takip token'ı: süre, tekrar kullanım, tahmin edilebilirlik, yanlış token, takip ve iptal, e-posta içeriği/linkleri.
- [ ] F06 — Yönetici randevu listesi/detayı/durum geçişleri, takvim, yazıcı ataması, bildirim ve durum geçmişi; yetkiler.
- [ ] F07 — Doğrulanmayan talebin sona ermesi; saklama süresi, istisna ve özel dosyaların temizliği; SMTP başarısızlığı ve tekrar gönderim.

### G. Duyuru, geri bildirim ve talepler

- [ ] G01 — Kamu/personel duyurusu oluştur/düzenle/yayından kaldır; önem, yayın aralığı, hedef kitle, görünürlük ve okundu kaydı.
- [ ] G02 — Talep listesi, durum değiştirme, yönetici notu, görsel indirme/görme; yetki, kişisel veri ve arşiv davranışı.
- [ ] G03 — Geri bildirim başarı mesajının tema kontrastı; iletişim alanındaki telefon ile WhatsApp düzeni; kullanıcı önerilerindeki başlık büyük harfleri ve açıklama metinleri.
- [ ] G04 — Kullanıcı görseli yok/var senaryosu, ek tür/ölçü/bozuk içerik, güvenli görüntüleme ve geri bildirim geçmişindeki mevcut kayıtlar.

### H. Roller, kullanıcılar ve ayarlar

- [ ] H01 — Rol oluştur/düzenle/sil, izin atama, sistem rolü koruması, son yöneticinin pasifleştirilmemesi ve rol silince kullanıcı etkisi.
- [ ] H02 — Kullanıcı oluştur/düzenle/pasifleştir/parola sıfırla; kendi hesabı ve başka hesabın sınırı; oturumun iptali.
- [ ] H03 — Her modül ve eylem için izin matrisi: menü gizleme ile sunucu yetkisi uyumu; `permission.any` rotalarında kontrolör içindeki alan bazlı yetki.
- [ ] H04 — Kişisel ayarlar: tema, ölçek, tablo yoğunluğu, sütun ve filtreler, parola, hesap silme, taslak/tercih kalıcılığı; başka hesaba sızmama.
- [ ] H05 — Atölye iletişim/çalışma ayarları, yazıcı durumu/bakım/kapalı zaman, filament ve malzeme türleri, randevu kuralları, KVKK/saklama ayarları; kamu etkisi.
- [ ] H06 — Ayarların doğrulama, kaydet/iptal, boş/çok uzun değer, yetki ve yan menü/sekme geçişinde değişiklik uyarısı.

### I. Veri, güvenlik, erişilebilirlik ve işletim

- [ ] I01 — XSS, SQL enjeksiyonu, CSV formül enjeksiyonu, CSRF, IDOR, path traversal, açık yönlendirme, dosya içeriği ve HTML/Markdown kaçış sınırları.
- [ ] I02 — Throttle ve oturum/cookie güvenliği; gizli alanlar log/yanıt/arama/son görüntülenenlerde görünmüyor mu; denetim geçmişi yetkisi.
- [ ] I03 — İlgili bütün eylemlerde activity log, stok hareketi ve undo kayıtları; kişisel veri minimizasyonu, tarih/aktör doğruluğu, hata halinde yarım kayıt kalmaması.
- [ ] I04 — `schedule:list` ve üç bakım komutunun idempotentliği, çakışma koruması, loglama, hatadan toparlanma, test zamanı ve cron hata dosyası.
- [ ] I05 — Yedek alma ve yalıtılmış ortamda geri yükleme; şema, dosya, ayar ve kullanıcı ilişkilerinin geri dönmesi; canlı yedekleme sağlayıcı koşulları ayrı doğrulanacak.
- [ ] I06 — Erişilebilirlik: semantik başlıklar, form etiketleri, hata özeti, odak sırası/görünürlüğü, klavye, Esc, rozet rengi dışında anlam, kontrast, azaltılmış hareket ve zoom.
- [ ] I07 — Türkçe dil/karakter, tarih/saat, sayı/ondalık, CSV kodlama, 320 px'den büyük ekranlar, farklı tarayıcılar ve yavaş ağ.
- [ ] I08 — Performans: kamu ve yönetim ilk açılış, büyük envanter/sayfalama, N+1 sorgu, indeksler, büyük dosya yükü, JS parçası uyarısı ve yavaş sorgu.
- [ ] I09 — Dokümantasyon uyumu: README, ROADMAP, deployment rehberi, izin adları ve gerçek rota/özellikler; eski “planlandı” veya artık geçersiz uyarılar.

## 5. Öncelikli test senaryosu matrisi

| Boyut | Denenecek varyantlar |
|---|---|
| Aktör | Ziyaretçi; aktif sistem yöneticisi; sınırlı özel rol; farklı izin kombinasyonu; pasif kullanıcı; süresi dolmuş oturum. |
| Veri | Boş; tek kayıt; çok kayıt; sınır değer; geçersiz/uzun Unicode; yinelenen kimlik; silinmiş/arşivlenmiş kayıt; başkasına ait kayıt. |
| İşlem | İlk tık; çift tık; hızlı tekrar; iki eşzamanlı oturum; geri/ileri; sayfa yenileme; ağ/SMTP/veritabanı hatası. |
| Görünüm | Açık/koyu/sistem; mobil/tablet/masaüstü; dar menü; %200 yakınlaştırma; klavye; düşük hareket tercihi. |
| Randevu | Özellik kapalı; özellik açık; boş/kapalı/dolu slot; doğrulama öncesi/sonrası; token süresi dolmuş. |
| Veritabanı | SQLite hızlı tur; MySQL 8.4 ve MariaDB 10.11 kabul; temiz kurulum ve yükseltme. |

## 6. Bilinen sınırlar ve denetim sırası

İlk turda güvenlik ve veri bütünlüğü (A, D, E, F, H, I), ardından tüm kamu/yönetim etkileşimleri (B, C, G), sonra görsel/erişilebilirlik ve performans tamamlanacak. Başlangıçta özellikle eski `roles` tablosu eksikliği, 500 hataları, CSV/XLSX marka-model, dosya erişimi, randevu yarışı, geri alma, iletişim ve geri bildirim akışları yeniden sınanacak. Bunlar **önceki bağlamdan gelen risklerdir; bu rapor yeni hata tespiti değildir**.

Canlı HTTPS, Directory Privacy, gerçek SMTP teslimatı/SPF/DKIM, hosting PHP güvenlik paketi, cPanel cron'u ve canlı yedek geri yüklemesi yerel kodla kanıtlanamaz. Bunlar için canlı testerların kanıtı veya erişim gerekir; erişim olmadan `GEÇTİ` yazılmayacak. Yerelde eşdeğer iş mantığı ve simüle hata yolları yine benim tarafımdan test edilecek. Üretim veritabanına karşı silme, toplu sıfırlama veya bakım komutu çalıştırılmayacak.

Mevcut manuel plandaki `GAP-01`–`GAP-05` notları yeniden doğrulanacak: bazı izinlerin karşılık rotası olup olmadığı, native tarayıcı pencereleri, SMTP ve hosting koşulları güncel kodla karşılaştırılacak. Her fark için belge düzeltmesi veya ürün işi açılacak.

## 7. Bulgu ve sonuç raporu şablonu

Her bulgu için `BUG-###`, önem (`Kritik`, `Yüksek`, `Orta`, `Düşük`), etkilenen kontrol kimliği/rota/sayfa, commit, ortam, ön koşul, adımlar, beklenen sonuç, gerçek sonuç, kanıt, kapsam/etki, kök neden, düzeltme commit'i ve regresyon testi kaydedilecek. `ENGELLİ` maddede engel, ihtiyaç duyulan erişim/araç ve tekrar tarihi yazılacak. Son raporda toplam/geçen/kalan/engelli madde sayısı, açık bulgular ve canlıya etkisi ayrı verilecek.

**Yayın engeli:** yetki aşımı, kişisel veri/sır sızıntısı, veri kaybı veya bozuk stok, tekrar üretilebilir 500, çifte randevu/teslim, güvenli dosya erişimi ihlali, başarısız geri yükleme veya kritik migration hatası. Bu tür açık bulgu varken “tamamlandı” denmeyecek.

**Başlangıç kararı:** Denetime başlanabilir. İşlevlerin tamamına ilişkin kabul kararı henüz yoktur.
