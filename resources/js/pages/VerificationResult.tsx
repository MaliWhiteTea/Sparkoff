import { Head, Link, router } from '@inertiajs/react';
import PublicFooter from '@/components/PublicFooter';
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
    const state = verified ? 'verified' : expired ? 'expired' : awaitingConfirmation ? 'pending' : 'invalid';
    const content = {
        verified: {
            pageTitle: 'E-posta Doğrulandı',
            heading: 'E-posta adresiniz doğrulandı',
            symbol: '✓',
            symbolClass: 'success',
        },
        pending: {
            pageTitle: 'E-posta Doğrulaması Bekleniyor',
            heading: 'E-posta adresinizi doğrulayın',
            symbol: '@',
            symbolClass: '',
        },
        expired: {
            pageTitle: 'Doğrulama Bağlantısının Süresi Doldu',
            heading: 'Doğrulama bağlantısının süresi doldu',
            symbol: '!',
            symbolClass: 'error',
        },
        invalid: {
            pageTitle: 'Doğrulama Tamamlanamadı',
            heading: 'Doğrulama tamamlanamadı',
            symbol: '!',
            symbolClass: 'error',
        },
    }[state];

    return (
        <main className="result-page public-page-shell">
            <Head title={content.pageTitle} />
            <section className="result-card">
                <div className={`result-symbol ${content.symbolClass}`} aria-hidden="true">
                    {content.symbol}
                </div>
                <span className="booking-kicker">SPARKOFF PROJE ATÖLYESİ</span>
                <h1>{content.heading}</h1>
                <p>{message}</p>
                <div className="result-actions">
                    {awaitingConfirmation && <button className="booking-primary" type="button" disabled={confirming} onClick={confirmVerification}>{confirming ? 'Doğrulanıyor…' : 'E-postamı doğrula'}</button>}
                    {verified && trackingUrl && <a className="booking-primary" href={trackingUrl}>Randevumu takip et</a>}
                    <Link className="booking-secondary" href="/">Ana sayfaya dön</Link>
                </div>
            </section>
            <PublicFooter />
        </main>
    );
}
