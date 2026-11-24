# Sparkoff V2 yerel test rehberi

## Hemen açılabilen örnek mod

Adres: `http://127.0.0.1:5174/`

Masaüstündeki `Sparkoff-Testi-Baslat-v2.desktop` kısayolu `scripts/start-local-test-v2.sh` dosyasını çalıştırır; örnek modu başlatıp tarayıcıda açar. V1 kısayolundan bağımsızdır. V2 günlüğü `storage/logs/local-test-v2.log` dosyasındadır. 9 Kasım'da kısayol doğrulandı ve sayfa HTTP 200 verdi.

Bu mod yerel Vite sunucusunda çalışır. Üstte **V2 ÖRNEK MOD** etiketi bulunur. Rol seçicisinden Sistem yöneticisi, Yönetici, Denetim, Sorumlu, Hoca ve Üye görünümleri denenebilir. Örnek kayıtlar yalnız tarayıcı `localStorage` alanına yazılır; **Örnek veriyi sıfırla** düğmesi bu kayıtları kaldırır. V1 uygulaması ve canlı veritabanı kullanılmaz.

Deneme önerisi:

1. Ana sayfa, yazıcılar, malzemeler ve geri bildirim sayfalarını gez.
2. `/admin/overview`, `/admin/tasks`, `/admin/inventory`, `/admin/members`, `/admin/announce` ekranlarını aç.
3. Görev, malzeme, stok hareketi, teslim ve duyuru oluştur; sohbet mesajı gönder.
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

Gerçek API testi için ayrı bir MySQL 8.x/MariaDB 10.11+ kabul veritabanı gerekir. Bu makinede bu oturum sırasında sunucu bulunmadı. Veritabanı kurulduğunda `.env.example` kopyasıyla yalnız V2 için `DATABASE_URL` ayarlanır; `npm run db:migrate`, `npm run bootstrap:admin` ve `npm run dev` çalıştırılır. V1 SQLite veya canlı SQL veritabanına V2 migration uygulanmaz.
