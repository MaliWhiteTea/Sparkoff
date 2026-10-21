import { Head, router, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import SettingsTabs from '../../../components/SettingsTabs';

type Preferences = {
    theme: 'light' | 'dark' | 'system';
    scale: 'small' | 'normal' | 'large';
    density: 'comfortable' | 'normal' | 'compact';
    sidebar: 'wide' | 'narrow';
};

const choices = {
    theme: [['light', 'Açık'], ['dark', 'Koyu'], ['system', 'Sistem']] as const,
    scale: [['small', 'Küçük'], ['normal', 'Normal'], ['large', 'Büyük']] as const,
    density: [['comfortable', 'Rahat'], ['normal', 'Normal'], ['compact', 'Sıkışık']] as const,
    sidebar: [['wide', 'Geniş'], ['narrow', 'Dar']] as const,
};

export default function PersonalSettings({ preferences }: { preferences: Preferences }) {
    const form = useForm<Preferences>(preferences);
    const defaults: Preferences = { theme: 'system', scale: 'normal', density: 'normal', sidebar: 'wide' };
    const submit = (event: FormEvent) => { event.preventDefault(); form.put('/yonetim/ayarlar/kisisel', { preserveScroll: true, onSuccess: () => form.setDefaults() }); };
    const reset = () => {
        if (!window.confirm('Tüm görünüm ayarları varsayılana dönsün mü?')) return;
        router.delete('/yonetim/ayarlar/kisisel', { preserveScroll: true, onSuccess: () => { form.setData(defaults); form.setDefaults(defaults); } });
    };

    return <AdminLayout><Head title="Kişisel Ayarlar" /><header className="admin-title"><div><span className="booking-kicker">HESAP AYARLARI</span><h1>Kişisel ayarlar</h1><p>Yönetim panelinin görünümünü yalnız kendi hesabınız için düzenleyin.</p></div></header><SettingsTabs />
        <form className="personal-settings" onSubmit={submit}>
            <PreferenceGroup title="Tema" description="Panelin renk görünümü." name="theme" value={form.data.theme} options={choices.theme} onChange={(value) => form.setData('theme', value as Preferences['theme'])} />
            <PreferenceGroup title="Yazı ve arayüz boyutu" description="Metinleri ve arayüz öğelerini birlikte ölçekler." name="scale" value={form.data.scale} options={choices.scale} onChange={(value) => form.setData('scale', value as Preferences['scale'])} />
            <PreferenceGroup title="Tablo yoğunluğu" description="Tablo satırları arasındaki boşluğu belirler." name="density" value={form.data.density} options={choices.density} onChange={(value) => form.setData('density', value as Preferences['density'])} />
            <PreferenceGroup title="Sol menü" description="Masaüstünde menünün başlangıç görünümünü belirler." name="sidebar" value={form.data.sidebar} options={choices.sidebar} onChange={(value) => form.setData('sidebar', value as Preferences['sidebar'])} />
            {Object.keys(form.errors).length > 0 && <div className="form-error" role="alert">Ayarlar doğrulanamadı. Seçimlerinizi kontrol edin.</div>}
            <div className="settings-save-bar"><div><strong>Tercihler hesabınıza kaydedilir.</strong><span>Oturum açtığınız diğer cihazlarda da uygulanır.</span></div><div className="personal-settings-actions"><button className="reset" type="button" onClick={reset}>Varsayılana dön</button><button disabled={form.processing || !form.isDirty}>{form.processing ? 'Kaydediliyor…' : 'Ayarları kaydet'}</button></div></div>
        </form>
    </AdminLayout>;
}

function PreferenceGroup({ title, description, name, value, options, onChange }: { title: string; description: string; name: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
    return <fieldset className="admin-panel preference-group"><legend>{title}</legend><p>{description}</p><div>{options.map(([option, label]) => <label className={value === option ? 'selected' : ''} key={option}><input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} /><span>{label}</span></label>)}</div></fieldset>;
}
