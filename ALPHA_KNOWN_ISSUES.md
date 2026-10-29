# Alpha Bilinen Sorunlar

## A-001 — Değişiklik yapılmadan ayrılma uyarısı ve kilitlenen onay düğmesi

- **Durum:** Düzeltildi; 29 Ekim 2026 canlı alpha kabulü tamamlandı
- **Öncelik:** Çözüldü
- **Bileşen:** Yönetim paneli / kaydedilmemiş değişiklik koruması
- **Bildirildi:** 29 Ekim 2026

### Gözlenen davranış

1. Yönetim panelinde Ayarlar sayfasına girilir.
2. Hiçbir alan değiştirilmeden başka bir sol menü bağlantısına tıklanır.
3. “Kaydedilmemiş değişiklik” uyarısı yanlış biçimde açılır.
4. “Değişiklikleri bırak ve ayrıl” ile çıkıldıktan sonra Ayarlar'a tekrar girilir.
5. Başka bir menü bağlantısına tıklanınca uyarı yeniden açılır; bu kez
   “Değişiklikleri bırak ve ayrıl” düğmesi işlemi tamamlamaz veya etkin değildir.
6. Ayarlar sayfasındayken aktif Ayarlar bağlantısına tekrar tıklamak da hiçbir
   değişiklik yapılmamış olmasına rağmen aynı uyarıyı açar.

### Beklenen davranış

- Form verisi gerçekten değişmediyse hiçbir ayrılma uyarısı gösterilmemeli ve
  tıklanan bağlantı doğrudan açılmalıdır.
- Aktif sayfanın menü bağlantısına tekrar tıklamak sahte bir kirli durum
  üretmemelidir.
- Gerçek değişiklik varsa uyarı bir kez gösterilmeli; “Değişiklikleri bırak ve
  ayrıl” hedef sayfayı her seferinde açabilmelidir.
- Sayfa değişimi veya bileşen kaldırılması sonrasında eski kirli form kimlikleri
  ve bekleyen ziyaret durumu korunmamalıdır.

### Kabul ölçütleri

- Kişisel ayarlar ve diğer ayar sekmeleri değişiklik yapılmadan terk edilirken
  modal açılmaz.
- Görünüm veya parola alanı gerçekten değiştirilince modal açılır.
- “Sayfada kal” form değerlerini korur.
- “Değişiklikleri bırak ve ayrıl” hedef bağlantıyı açar ve sonraki ziyaretleri
  kilitlemez.
- Aynı menü öğesine tekrar tıklama ve art arda iki ayrılma denemesi için
  regresyon testi eklenir.

## A-002 — Sayfa yenilemede tarayıcının yerel ayrılma uyarısı

- **Durum:** Not edildi; platform kısıtı olarak değerlendirilecek
- **Öncelik:** Düşük — veri kaybını önleyen işlev çalışıyor, yalnızca görünüm uyumsuz
- **Bileşen:** Yönetim paneli / kaydedilmemiş değişiklik koruması
- **Bildirildi:** 29 Ekim 2026

### Gözlenen davranış

Formda kaydedilmemiş gerçek bir değişiklik varken sayfa yenilendiğinde veya
sekme kapatıldığında, site temasındaki özel modal yerine tarayıcının kendi
İngilizce `beforeunload` onay penceresi gösteriliyor.

### Teknik sınır

Modern tarayıcılar yenileme, sekme kapatma ve adres çubuğuyla ayrılma
işlemlerinde güvenlik amacıyla yalnızca tarayıcının yerel onay penceresine izin
verir. Bu pencerenin metni, dili, renkleri veya düğmeleri site CSS'i ve
JavaScript'i ile özelleştirilemez.

### Değerlendirilebilecek seçenekler

- Yerel uyarıyı veri kaybı koruması olarak kabul etmek.
- Form taslaklarını otomatik kaydedip yenileme uyarısına duyulan ihtiyacı
  azaltmak.
- Uyarıyı kaldırmak; bu seçenek yenilemede kaydedilmemiş verilerin sessizce
  kaybolmasına neden olacağı için önerilmez.
