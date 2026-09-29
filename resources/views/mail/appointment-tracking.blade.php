<!DOCTYPE html>
<html lang="tr">
<body style="margin:0;background:#f5f8fa;font-family:Arial,sans-serif;color:#172333">
    <div style="max-width:600px;margin:0 auto;padding:36px 18px">
        <div style="background:#fff;border:1px solid #dce4eb;border-radius:12px;padding:34px">
            <p style="margin:0 0 8px;color:#b51642;font-size:12px;font-weight:700;letter-spacing:.08em">SPARKOFF PROJE ATÖLYESİ</p>
            <h1 style="margin:0 0 18px;font-size:25px">Randevu talebiniz alındı</h1>
            <p style="color:#687586;line-height:1.6">E-posta adresiniz doğrulandı. Talebiniz şimdi atölye yöneticisinin incelemesini bekliyor.</p>
            <div style="margin:24px 0;padding:18px;background:#edf6f9;border-left:4px solid #145187">
                <strong>{{ $appointment->starts_at->translatedFormat('d F Y, H:i') }}</strong><br>
                <span style="color:#687586;font-size:13px">{{ $appointment->duration_minutes }} dakika · {{ $appointment->printer->name }}</span>
            </div>
            <a href="{{ $trackingUrl }}" style="display:inline-block;padding:14px 20px;border-radius:7px;background:#145187;color:#fff;text-decoration:none;font-weight:700">Randevumu takip et</a>
            <p style="margin:24px 0 0;color:#687586;font-size:12px;line-height:1.5">Bu bağlantı randevu bilgilerinize erişim sağlar. Başkalarıyla paylaşmayın.</p>
        </div>
    </div>
</body>
</html>
