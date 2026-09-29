<!DOCTYPE html>
<html lang="tr">
<body style="margin:0;background:#f5f8fa;font-family:Arial,sans-serif;color:#172333">
    <div style="max-width:600px;margin:0 auto;padding:36px 18px">
        <div style="background:#fff;border:1px solid #dce4eb;border-radius:12px;padding:34px">
            <p style="margin:0 0 8px;color:#b51642;font-size:12px;font-weight:700;letter-spacing:.08em">SPARKOFF PROJE ATÖLYESİ</p>
            <h1 style="margin:0 0 18px;font-size:25px">{{ $title }}</h1>
            <p style="color:#687586;line-height:1.6">Merhaba {{ $appointment->first_name }}, {{ $message }}</p>
            <div style="margin:24px 0;padding:18px;background:#edf6f9;border-left:4px solid #145187">
                <strong>{{ $appointment->starts_at->translatedFormat('d F Y, H:i') }}</strong><br>
                <span style="color:#687586;font-size:13px">{{ $appointment->duration_minutes }} dakika · {{ $appointment->printer->name }}</span>
            </div>
            @if ($appointment->admin_note)
                <p style="padding:14px;background:#f5f8fa;color:#465568;line-height:1.6"><strong>Yönetici notu:</strong><br>{{ $appointment->admin_note }}</p>
            @endif
            <p style="margin:24px 0 0;color:#687586;font-size:12px;line-height:1.5">Güncel ayrıntıları daha önce gönderilen güvenli randevu takip bağlantınızdan görüntüleyebilirsiniz.</p>
        </div>
    </div>
</body>
</html>
