import nodemailer from 'nodemailer';

function mailConfig() {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  const port = Number(process.env.SMTP_PORT || 587);
  const base = process.env.PUBLIC_BASE_URL || process.env.APP_ORIGIN;
  if (!host || !from || !base || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Randevu e-postası yapılandırılmamış');
  const url = new URL(base);
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname) && ['127.0.0.1', 'localhost'].includes(host);
  if (url.protocol !== 'https:' && !(local && process.env.NODE_ENV !== 'production')) throw new Error('Randevu bağlantısı HTTPS olmalı');
  if (url.username || url.password || url.search || url.hash) throw new Error('Randevu temel adresi geçersiz');
  return { host, from, port, base: url.origin, local };
}
export function assertBookingMailConfigured() { mailConfig(); }

async function sendBookingMail(to: string, subject: string, body: string) {
  const { host, from, port, local } = mailConfig();
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(pass)) throw new Error('SMTP kimliği eksik');
  const transport = nodemailer.createTransport({
    host, port, secure: port === 465, requireTLS: port !== 465 && !(local && process.env.SMTP_ALLOW_PLAINTEXT_LOCAL === 'true'),
    ...(user && pass ? { auth: { user, pass } } : {}),
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  const info = await transport.sendMail({ from, to, subject, text: body });
  if (!info.accepted.some(address => address.toLowerCase() === to.toLowerCase())) throw new Error('E-posta sunucusu alıcıyı kabul etmedi');
}

export async function sendBookingVerification(to: string, publicId: string, token: string) {
  const { base } = mailConfig();
  const link = `${base}/randevu/dogrula/${encodeURIComponent(publicId)}/${encodeURIComponent(token)}`;
  await sendBookingMail(to, '3D yazıcı randevunuzu doğrulayın', `Randevu talebinizi doğrulamak için bağlantıyı açın:\n\n${link}\n\nBağlantı belirlenen doğrulama süresi sonunda geçersiz olur.`);
}

export async function sendBookingTracking(to: string, publicId: string, token: string) {
  const { base } = mailConfig();
  const link = `${base}/randevu/takip/${encodeURIComponent(publicId)}/${encodeURIComponent(token)}`;
  await sendBookingMail(to, '3D yazıcı randevu talebiniz alındı', `E-posta adresiniz doğrulandı. Randevu durumunuzu buradan takip edebilirsiniz:\n\n${link}`);
}

const statusSubjects: Record<string, string> = {
  approved: '3D yazıcı randevunuz onaylandı', change_requested: '3D yazıcı randevunuz için değişiklik gerekiyor',
  rejected: '3D yazıcı randevu talebiniz sonuçlandı', ready: '3D baskınız için hazırlık tamamlandı',
  printing: '3D baskınız başladı', completed: '3D baskınız tamamlandı',
  failed: '3D baskınızla ilgili önemli güncelleme',
};
const statusMessages: Record<string, string> = {
  approved: 'Randevunuz onaylandı.', change_requested: 'Randevunuz için değişiklik gerekiyor.',
  rejected: 'Randevu talebiniz reddedildi.', ready: 'Baskınız hazırlanmaya hazır.',
  printing: 'Baskınız başladı.', completed: 'Baskınız tamamlandı.',
  failed: 'Baskınız tamamlanamadı.',
};
export async function sendBookingStatus(input: { to: string; status: string; firstName: string | null; startsAt: Date | null; durationMinutes: number | null; printer: string | null; adminNote: string | null }) {
  const date = input.startsAt ? new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'long', timeStyle: 'short' }).format(input.startsAt) : '—';
  const body = `Merhaba ${input.firstName || ''},\n\n${statusMessages[input.status] || 'Randevunuz güncellendi.'}\n\nTarih: ${date}\nSüre: ${input.durationMinutes ?? '—'} dakika\nYazıcı: ${input.printer || '—'}${input.adminNote ? `\n\nYönetici notu: ${input.adminNote}` : ''}\n\nGüncel ayrıntıları daha önce gönderilen güvenli takip bağlantınızdan görüntüleyebilirsiniz.`;
  await sendBookingMail(input.to, statusSubjects[input.status] || '3D yazıcı randevunuzla ilgili güncelleme', body);
}
