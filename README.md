# Sparkoff

Sparkoff, okul atölyelerindeki 3D yazıcılar için geliştirilen modern bir randevu ve baskı takip sistemidir. Kullanıcılar hesap oluşturmadan uygun zaman aralığını seçebilir, baskı dosyasını yükleyebilir ve e-posta üzerinden randevularını takip edebilir.

> Proje şu anda planlama ve tasarım aşamasındadır.

## Öne çıkan özellikler

- Hesap gerektirmeyen randevu akışı
- E-posta adresi doğrulama
- Güvenli randevu takip ve iptal bağlantısı
- G-code, 3MF, STL ve STEP/STP dosya yükleme
- Atölye filamenti veya kişisel filament seçimi
- Yazıcı ve zaman uygunluğu kontrolü
- Yönetici onaylı randevu sistemi
- Yazıcı, bakım ve çalışma saatleri yönetimi
- E-posta durum bildirimleri
- KVKK odaklı veri ve dosya saklama yaklaşımı
- Mobil öncelikli, özgün kullanıcı arayüzü

## Planlanan randevu akışı

```text
Onay bekliyor
    ├── Değişiklik istendi
    ├── Reddedildi
    ├── İptal edildi
    └── Onaylandı
          └── Baskıya hazır
                └── Basılıyor
                      ├── Tamamlandı
                      └── Baskı başarısız
```

## Proje durumu

İlk aşamada aşağıdaki çalışmalar yapılacaktır:

1. cPanel sunucu özelliklerinin doğrulanması
2. Teknik mimarinin kesinleştirilmesi
3. Veritabanı ve iş kurallarının tasarlanması
4. Mobil ve masaüstü arayüz prototiplerinin hazırlanması
5. MVP randevu ve yönetici akışlarının geliştirilmesi

Ayrıntılı ürün ve geliştirme planı için [ROADMAP.md](./ROADMAP.md) dosyasına bakabilirsiniz.

## İlk sürüm kapsamı

- Türkçe arayüz
- Ücretsiz okul atölyesi kullanımı
- Başlangıçta yönetici onaylı bütün randevular
- Bir aktif ve bir bakımda 3D yazıcı
- Hafta içi 09.00–17.00 varsayılan çalışma düzeni
- Yönetici panelinden değiştirilebilir çalışma ve rezervasyon kuralları
- E-posta bildirimleri; SMS kullanılmaz

## Teknoloji

Kesin teknoloji seçimi cPanel sunucusunun özellikleri doğrulandıktan sonra yapılacaktır. Değerlendirilen temel seçenekler:

- Laravel, Inertia.js, React ve TypeScript
- Next.js ve TypeScript
- MySQL veya MariaDB
- Tailwind CSS ve Framer Motion

## Dokümantasyon

- [Ürün ve geliştirme roadmap'i](./ROADMAP.md)

## Lisans

Lisans modeli henüz belirlenmemiştir. Bir lisans dosyası eklenene kadar projenin tüm hakları saklıdır.
