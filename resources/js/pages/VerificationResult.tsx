import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

type Props = {
    verified: boolean;
    expired?: boolean;
    message: string;
    trackingUrl?: string;
    confirmUrl?: string;
};

export default function VerificationResult({ verified, expired = false, message, trackingUrl, confirmUrl }: Props) {
    const [confirming, setConfirming] = useState(false);

    function confirmVerification() {
        if (!confirmUrl || confirming) return;
        setConfirming(true);
        router.post(confirmUrl, {}, { onFinish: () => setConfirming(false) });
    }

    const awaitingConfirmation = !verified && !expired && Boolean(confirmUrl);

    return (
        <main className="result-page">
            <Head title={verified ? 'E-posta Doğrulandı' : 'Doğrulama Başarısız'} />
            <section className="result-card">
                <div className={`result-symbol ${verified ? 'success' : awaitingConfirmation ? '' : 'error'}`} aria-hidden="true">
                    {verified ? '✓' : awaitingConfirmation ? '@' : '!'}
                </div>
                <span className="booking-kicker">SPARKOFF PROJE ATÖLYESİ</span>
                <h1>{verified ? 'E-posta adresiniz doğrulandı' : 'Doğrulama tamamlanamadı'}</h1>
                <p>{message}</p>
                <div className="result-actions">
                    {awaitingConfirmation && <button className="booking-primary" type="button" disabled={confirming} onClick={confirmVerification}>{confirming ? 'Doğrulanıyor…' : 'E-postamı doğrula'}</button>}
                    {verified && trackingUrl && <a className="booking-primary" href={trackingUrl}>Randevumu takip et</a>}
                    <Link className="booking-secondary" href="/">Ana sayfaya dön</Link>
                </div>
            </section>
        </main>
    );
}
