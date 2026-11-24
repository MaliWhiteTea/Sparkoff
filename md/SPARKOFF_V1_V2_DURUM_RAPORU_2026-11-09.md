# Sparkoff V1 → V2 durum ve açık iş raporu

**Tarih:** 9 Kasım 2026  
**Amaç:** V1'in mevcut işlevlerini V2'ye taşımadan önce kapsamı görmek; ardından V1'de yarım kalmış ürün işlerini ayrı planlamak. Bu belge yeni roadmap değildir.

> Bu rapor başlangıç fotoğrafıdır. Sonraki envanter geliştirmeleri, SQL kabulleri ve güncel iş sırası [V2 yol haritasının çalışma kaydında](SPARKOFF_V2_YENI_ROADMAP.md#çalışma-kaydı) tutulur. Aşağıdaki “eksik” listesi başlangıç anını anlatır.

## Kısa sonuç

V1, yarım kalmış olsa da V2'den işlevce daha geniş bir Laravel uygulamasıdır. V2, Spero görsel diliyle hazırlanmış bağımsız Node/Hono/React temeli ve bazı çalışan modüllerdir; **V1 ile işlevsel eşitliğe henüz ulaşmadı**. Örnek mod ekran görüntüleri gerçek veritabanı, gerçek kullanıcı yolculuğu veya canlı kabul kanıtı değildir. V1 korunuyor. Hedef sunucu, cPanel değil, satın alınan **3 GB RAM'li Ubuntu VDS**; V2 henüz bu sunucuya kurulmadı ve canlıya alınmadı.

## Kanıtlı mevcut durum

- V1 [ROADMAP.md](../ROADMAP.md) içinde 131 işaretli, 11 açık kutu var. İşaretli kutular V1 kapsamı içindir; V2'ye aktarılmış sayılmaz.
- V1'in [tam kapsam denetim ön raporuna](../YEREL_TAM_KAPSAM_DENETIM_ON_RAPORU_2026-11-06.md) göre 390 manuel arayüz maddesinin ve 97 HTTP rotasının tam kanıtlı matrisi kapanmadı. Otomatik testlerin geçmesi canlı kabul değildir.
- Yerel V1 SQLite salt okunur sayımında 171 malzeme, 2 yazıcı, 4 filament, 1 medya, 173 stok hareketi, 3 kapanmış teslim ve 0 randevu var. Bu, canlı sunucunun güncel envanteri değildir; ayrıntı [geçiş planında](SPARKOFF_V2_SISTEM_GECIS_PLANI_2026-11-09.md).
- V2'de 40 tablo, 6 migration, temel API'ler ve ziyaretçi/üye/yönetim arayüzleri var. Yerel MariaDB kabulünde giriş, bazı üye/birim, CSV, medya, teslim/iade ve yazıcı/filament akışları geçti; son derleme ve 18 birim testi geçti. Bu kabul yalnız sınırlı sentetik senaryoları kapsar. [İnşa kaydı](SPARKOFF_V2_INSA_KAYDI_2026-11-08.md), [tasarım kaydı](SPARKOFF_V2_SPERO_TASARIM_YENILEME_2026-11-09.md).
- V1 üretim verisinin V2'ye toplu aktarımı, canlı veritabanı sayımı, kullanıcı geçişi, DNS geçişi ve Ubuntu VDS kabulü yapılmadı.

## 1. Önce V1'in bugünkü durumunu V2'ye taşıma: eksikler

### Ziyaretçi portalı

- Ana sayfa V2'de var; V1'in yönetilebilir atölye bilgileri, çalışma saatleri, telefon/WhatsApp/e-posta ve tam iletişim alanı taşınmadı.
- Yazıcı ve filamentler listeleniyor, yönetimde temel oluşturma/düzenleme var. V1'in yedi günlük müsaitlik takvimi, çalışma günleri/saatleri, bakım ve kapalı zaman yönetimi, durum ile rezervasyon uygunluğu henüz yok.
- V2 `/randevu` sayfası kapalı bilgilendirme ekranı. Başvuru, slot doğrulama/kilit, model dosyası, e-posta doğrulaması, güvenli takip/iptal, yönetici detay akışı, dosya indirme ve saklama/temizlik taşınmadı. Mevcut yönetim API'sinde randevu listeleme ve basit onay/red var; bu tam randevu sistemi değil.
- V2 malzeme kataloğu temel kart, görünürlük, kapak/video ve bağlantı gösterir. V1'in çok sözcüklü arama, kategori/stok filtresi, sıralama/sayfalama, paylaşılabilir filtre URL'si, favoriler, ayrıntı/teknik özellik ve galeri deneyimi taşınmadı.
- V2 geri bildirim formu temel kayıt oluşturur. V1'deki bot alanı/hız sınırı, isteğe bağlı görsel, yönetim talep listesi, durum/not/arşiv akışları ve KVKK sayfası taşınmadı.

### Envanter, medya ve teslim

- V2 malzeme oluşturma, stok hareketi, temel teslim/iade, CSV önizleme/içe-dışa aktarım, görsel/video/HTTPS bağlantısı işlemlerinin ilk sürümünü içerir. Bunların bir kısmı yerel MariaDB'de sentetik veriyle sınandı.
- V1'in malzeme düzenleme/arşivleme/ayrıntı ekranları, kategori/konum yönetim ekranları, düşük stok/tükenen görünümü, hareket geçmişi, gelişmiş arama/filtre/sayfalama ve güvenli toplu işlemleri V2'de eksik.
- Stok hareketini ters kayıtla düzeltme, kısa süreli güvenli geri alma, kapsamlı audit bağlantısı ve bütün yarış/tekrar istek durumları tamamlanmadı.
- XLSX içe/dışa aktarım ve sütun eşlemeli gelişmiş aktarım yok. CSV'nin temel SQL kabulü var; V1'in tüm aktarım seçenekleriyle eşitlik sınanmadı.
- Fotoğraf/video/bağlantı için temel API var; V1 galeri, medya önizlemesi/sıralama UX'i, bozuk bağlantı, mobil ve yetki matrisi ile tam eşitlik yok. V1'in yerel tek medya dosyası yalnız ayrı bir prova dizinine SHA-256 doğrulamasıyla hazırlandı; V2 veritabanına bağlanmadı.
- Teslim/iade temel hesapları ve hasar/kayıp davranışı var. V1'in sarf teslimi/yerinde kullanımın bütün akışları, gecikmiş listeler ve bildirimler, kişi alanı yetki ayrımı, ters hareket ve tüm kapanış senaryoları eksik veya kanıtsız.
- V2'de kapanmış teslimlerin kişi alanlarını 90 gün sonra anonimleştiren bir iç cron ucu var; gerçek zamanlayıcı, ayarlanabilir süre, istisna, eylem logu ve VDS kabulü yok.

### Hesaplar, roller, ayarlar ve yönetim

- V2 giriş, aktivasyon kodu, temel parola değiştirme, birim oluşturma/üyelik atama ve özel rol oluşturma API'si içerir. Üye ekranında temel birim ve özel rol atama var.
- V1'in çoklu rol modeli V2'de eşdeğer değil: V2 kullanıcı kaydı bir `globalRole` ve en fazla bir `customRoleId` tutuyor; birden fazla birim üyeliği ayrı destekleniyor. Bu fark, veri taşımasından önce ürün kararı ve şema tasarımı gerektirir.
- Üye oluşturma/düzenleme/pasifleştirme, parola sıfırlama, üyelik kaldırma, rol düzenleme/silme, yetki seçme arayüzü, son sistem yöneticisi kilidi, güvenilir cihazlar ve bütün rol/izin matrisi V2'de tamamlanmadı.
- Kişisel ayarlar, açık/koyu/sistem tema, yazı ölçeği, tablo yoğunluğu, kullanıcıya özel sütun/filtre ayarları, güvenli taslak ve ayrılma uyarısı V2'de V1 düzeyinde yok. Mevcut V2 tema ve yan menü tercihi ağırlıkla tarayıcı yerel durumunda.
- V2 yönetim genel bakışı temel sayaç ve grafik gösterir. V1'in kritik stok/geciken teslim/bekleyen randevu/açık talep özetleri, hızlı arama, bildirim zili, son kayıtlar ve toplu işlem araçları eksik.
- V2 temel duyuru oluşturma/listeleme ve okundu API'si içerir. V1'in düzenleme/arşivleme, önem, sabitleme, yayın süresi ve hedef rol ekranları, okundu sayaçları, bildirim/e-posta merkezi ve etkinlik yönetimi eksik. Bazı alanların tabloda bulunması çalışan akış anlamına gelmez.
- V2 sistem ekranı yalnız audit listesidir. V1'in ayrıntılı işlem geçmişi, güvenli geri alma, KVKK/saklama ayarları ve yönetim araçları taşınmadı.

## 2. V2 ile eklenen, V1 aktarımından ayrı tamamlanacak modüller

- Görevler: temel görev oluşturma/listeleme ve yüzde güncelleme var. Adımlar, kanıt yükleme, kamera/EXIF/tarih damgası, atama ve hatırlatma, şablonlar, Kanban/tablolar, ZIP indirme yok.
- Birim/oda sohbeti: kanal erişim sınırı ve temel metin mesajı var. Dosya/video, okundu, yanıt, sabitleme, @etiketleme, anket, çıkartma, oda yönetimi ve moderasyon yok.
- Etkinlikler/takvim: tablo ve listede okuma başlangıcı var; oluşturma, RSVP, hedefleme ve arayüz eksik.
- Bildirim, Web Push/iOS PWA, gerçek e-posta gönderimi ve kota yönetimi yok.
- Büyük parçalı dosya yükleme ve günlük kota yok; mevcut medya yalnız sınırlı küçük dosya yükleme akışıdır.

## 3. V1 roadmap'inde zaten açık kalan ürün/kabul işleri

V1 [ROADMAP.md](../ROADMAP.md) içindeki 11 açık madde şunlar:

1. `randevu@sparkoff.tr` gerçek SMTP yapılandırması.
2. SPF/DKIM ve gerçek e-posta teslimat testi.
3. Günlük bakım/temizlik zamanlayıcısının kurulması; roadmap'teki cPanel cron hedefi yeni Ubuntu VDS'de systemd timer veya cron olarak yeniden tanımlanmalı.
4. Uçtan uca randevu kabulü.
5. Kabul tamamlanınca çevrimiçi randevu bayrağının açılması.
6. Her kritik eylem için izin/verilmeme testleri.
7. Dosya yükleme ve indirme yetki testleri.
8. Yedekleme ve geri yükleme provası.
9. Üretim paketi ve migration kabulü; cPanel maddesi Ubuntu VDS dağıtımı olarak yeniden yazılmalı.
10. Mobil, masaüstü ve canlı kabul testi.
11. Kamu kataloğunun mobil ve ekran okuyucu kabulü.

Bunlara ek olarak V1 denetiminin 390 manuel madde/97 rota matrisi, gerçek SMTP, yarış koşulları, canlı hosting ve yedek geri yükleme kanıtları açık. V2'ye aktarırken bu doğrulama yükü yeniden uygulanmalı; V1'deki test sonucu V2'ye otomatik taşınmaz.

## 4. Veri geçişi ve Ubuntu VDS: yayın öncesi zorunlu işler

1. V1 ve V2 alanlarını modül modül eşleştir; eksik V2 alanları ve özellikle çoklu rol farkı için karar ver. Kullanıcı parolalarının algoritma/geçiş yöntemi belirlenmeli.
2. V1 canlı veritabanı ve dosyalarının salt okunur güncel kopyasını al. Yerel SQLite sayımını canlı veri sanma. ID eşlemesi, stok hareket sırası, toplamlar, kapanmış teslimler, medya ve özel dosyaları dönüştür.
3. Tekrarlanabilir aktarım aracı ve prova kur; kayıt sayısı, miktar bakiyesi, dosya SHA-256 ve örnek kullanıcı yolculuklarını karşılaştır. Fark varsa geçişi durdur.
4. 3 GB Ubuntu VDS'nin nihai Ubuntu sürümü, disk/RAM, DNS ve erişimini doğrula. Node, ayrı V2 MariaDB/MySQL, sınırlı DB kullanıcısı, Nginx/HTTPS, systemd, kalıcı yükleme dizini, güvenlik duvarı, log ve sır yönetimini kur.
5. Gerçek VDS'de migration/bootstrap, servis yeniden başlatma, dosya izinleri, UTF-8, yükleme sınırları, yetki, eşzamanlılık, yedekleme/geri yükleme ve mobil/masaüstü kabulünü yap.
6. SMTP/DNS ve zamanlayıcıyı gerçek ortamda doğrula. Randevu özelliğini kabul tamamlanana kadar kapalı tut.
7. V1'i koruyan kesme/geri dönüş planını, DNS geçişini ve canlı yayın kararını ayrı kabul et. Bugün bunların hiçbiri yapılmış değil.

## Yeni roadmap için birlikte netleştirilecek kararlar

- İlk V2 yayını için hedef **V1'in mevcut davranışına tam eşitlik** mi, yoksa seçilecek modüllerde kontrollü bir ilk sürüm mü? Tam eşitlik seçilirse V1'in 131 işaretli maddesinin her biri V2'de tekrar kanıtlanmalı.
- V1'in çoklu rol kuralı V2'de birebir korunacak mı? Mevcut V2 `globalRole + customRoleId` tasarımı bunu karşılamıyor.
- Randevu, e-posta ve özel dosya akışı ilk yayın için zorunlu mu? Bu karar yayın kapsamını ve güvenlik/kabul işini büyük ölçüde değiştirir.
- V2'ye özgü görev/sohbet/bildirim/büyük dosya özellikleri, V1 eşitliğinden önce mi sonra mı açılacak?

Bu kararlar verilmeden yeni roadmap'e tamamlanmış kutu veya yayın tarihi yazılmamalı.
