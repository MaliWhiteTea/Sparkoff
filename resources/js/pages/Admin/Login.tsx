import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);

    function submit(event: FormEvent) {
        event.preventDefault();
        setProcessing(true);
        setError('');
        router.post('/yonetim/giris', { email, password, remember }, {
            onError: (errors) => setError(errors.email ?? 'Giriş yapılamadı.'),
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <main className="admin-login-page">
            <Head title="Yönetici Girişi" />
            <section className="admin-login-card">
                <Link className="admin-login-brand" href="/">
                    <img src="/logo.jpg" alt="Sparkoff logosu" />
                    <span><strong>Sparkoff</strong><small>Yönetim Paneli</small></span>
                </Link>
                <span className="booking-kicker">YETKİLİ ERİŞİMİ</span>
                <h1>Atölye yönetimi</h1>
                <p>Randevuları incelemek ve atölye işleyişini yönetmek için giriş yapın.</p>
                <form onSubmit={submit}>
                    <label className="field"><span>E-posta</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                    <label className="field"><span>Parola</span><input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                    <label className="admin-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Bu cihazda oturumu açık tut</label>
                    {error && <div className="form-error" role="alert">{error}</div>}
                    <button className="booking-primary" disabled={processing}>{processing ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
                </form>
            </section>
        </main>
    );
}
