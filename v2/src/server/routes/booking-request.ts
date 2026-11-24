import { Hono } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { and, eq, gt, inArray, isNull, lt, or } from 'drizzle-orm';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { db } from '../db.js';
import { availableStartTimes, istanbulParts, istanbulWallMinuteToUtc } from '../booking-availability.js';
import { assertBookingMailConfigured, sendBookingVerification } from '../booking-mail.js';
import { bookingExtensions, validBookingFile, type BookingExtension } from '../booking-file.js';
import { resolvedPrivateRoot } from '../private-files.js';
import { countAttempt, limitKey } from '../rate-limit.js';
import { appointmentFiles, appointmentStatusHistories, appointments, blackoutPeriods, filaments, operatingHours, printers, systemSettings } from '../../shared/schema.js';
import type { AppEnv } from '../auth.js';

const route = new Hono<AppEnv>();
const inputSchema = z.object({
  printerId: z.coerce.number().int().positive(), date: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.coerce.number().int().positive(),
  filamentSource: z.enum(['workshop', 'own']),
  filamentId: z.coerce.number().int().positive().optional(),
  material: z.string().trim().max(40).optional(),
  color: z.string().trim().max(80).optional(),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().max(255).transform(value => value.trim().toLowerCase()),
  rulesAccepted: z.literal('true'), privacyNoticeSeen: z.literal('true'),
}).superRefine((value, ctx) => {
  if (value.filamentSource === 'workshop' && !value.filamentId) ctx.addIssue({ code: 'custom', message: 'Filament gerekli', path: ['filamentId'] });
  if (value.filamentSource === 'own' && (!value.material || !value.color)) ctx.addIssue({ code: 'custom', message: 'Malzeme ve renk gerekli', path: ['material'] });
});
class BookingError extends Error { constructor(public status: 400 | 409 | 503, message: string) { super(message); } }
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

route.post('/request', async c => {
  if (process.env.ONLINE_BOOKING_ENABLED !== 'true') return c.json({ error: 'Çevrimiçi randevu kapalı' }, 404);
  try { assertBookingMailConfigured(); } catch { return c.json({ error: 'Randevu e-postası hazır değil' }, 503); }
  const remote = getConnInfo(c).remote.address || 'unknown';
  const client = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) ? c.req.header('x-real-ip') || remote : remote;
  if (!(await countAttempt(limitKey('booking-request', client), 5, 3600))) return c.json({ error: 'Çok fazla randevu talebi' }, 429);
  const settingRows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(inArray(systemSettings.key, [
    'booking.slot_minutes', 'booking.maximum_duration_hours', 'booking.verification_hold_minutes',
    'uploads.maximum_file_size_mb', 'uploads.allowed_extensions', 'privacy.file_retention_days', 'privacy.notice_version',
  ]));
  const settings = Object.fromEntries(settingRows.map(row => [row.key, row.value]));
  const slotMinutes = Number(settings['booking.slot_minutes'] ?? 30);
  const maximumHours = Number(settings['booking.maximum_duration_hours'] ?? 24);
  const holdMinutes = Number(settings['booking.verification_hold_minutes'] ?? 30);
  const maximumFileSizeMb = Number(settings['uploads.maximum_file_size_mb'] ?? 100);
  const retentionDays = Number(settings['privacy.file_retention_days'] ?? 30);
  const allowed = settings['uploads.allowed_extensions'] ?? bookingExtensions;
  if (![15, 30, 60].includes(slotMinutes) || !Number.isInteger(maximumHours) || maximumHours < 1 || maximumHours > 168 ||
    !Number.isInteger(holdMinutes) || holdMinutes < 10 || holdMinutes > 1440 ||
    !Number.isInteger(maximumFileSizeMb) || maximumFileSizeMb < 1 || maximumFileSizeMb > 500 ||
    !Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365 ||
    !Array.isArray(allowed) || !allowed.length || allowed.some(value => !bookingExtensions.includes(value as BookingExtension))) return c.json({ error: 'Randevu ayarı geçersiz' }, 503);
  const maxBody = maximumFileSizeMb * 1024 * 1024 + 64 * 1024;
  const declared = Number(c.req.header('content-length') || 0);
  if (declared > maxBody) return c.json({ error: 'Baskı dosyası çok büyük' }, 413);
  const contentType = c.req.header('content-type') || '';
  if (!contentType.startsWith('multipart/form-data;')) return c.json({ error: 'Çok parçalı form gerekli' }, 400);
  const reader = c.req.raw.body?.getReader();
  if (!reader) return c.json({ error: 'Form boş' }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > maxBody) { await reader.cancel(); return c.json({ error: 'Baskı dosyası çok büyük' }, 413); }
    chunks.push(part.value);
  }
  let form: FormData;
  try { form = await new Request('http://localhost', { method: 'POST', headers: { 'content-type': contentType }, body: Buffer.concat(chunks) }).formData(); }
  catch { return c.json({ error: 'Form okunamadı' }, 400); }
  const raw = Object.fromEntries([...form].filter(([, value]) => typeof value === 'string'));
  const input = inputSchema.safeParse(raw);
  const file = form.get('file');
  if (!input.success || !(file instanceof File)) return c.json({ error: 'Randevu bilgileri veya dosya geçersiz' }, 400);
  const { date, startTime, durationMinutes } = input.data;
  const today = istanbulParts(new Date()).date;
  const distance = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  if (!Number.isInteger(distance) || distance < 0 || distance > 6 || durationMinutes < slotMinutes || durationMinutes > maximumHours * 60 || durationMinutes % slotMinutes !== 0) return c.json({ error: 'Tarih veya baskı süresi geçersiz' }, 400);
  const startsAt = istanbulWallMinuteToUtc(date, startTime);
  if (!startsAt || startsAt <= new Date()) return c.json({ error: 'Başlangıç saati geçersiz' }, 400);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !allowed.includes(extension) || !bookingExtensions.includes(extension as BookingExtension) || !file.size || file.size > maximumFileSizeMb * 1024 * 1024 || file.name.length > 255) return c.json({ error: 'Dosya türü veya boyutu geçersiz' }, 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!(await validBookingFile(bytes, extension as BookingExtension))) return c.json({ error: 'Baskı dosyasının içeriği geçersiz' }, 400);
  const publicId = randomUUID();
  const fileName = `${randomUUID()}.${extension}`;
  const relativePath = `appointments/${publicId}/${fileName}`;
  const verificationToken = randomBytes(32).toString('hex');
  let directory = '';
  try {
    const root = await resolvedPrivateRoot();
    directory = join(root, 'appointments', publicId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(join(directory, fileName), bytes, { flag: 'wx', mode: 0o600 });
    await db.transaction(async tx => {
      const [printer] = await tx.select({ id: printers.id, status: printers.status }).from(printers).where(eq(printers.id, input.data.printerId)).for('update').limit(1);
      if (!printer || printer.status !== 'active') throw new BookingError(409, 'Seçilen yazıcı randevuya açık değil');
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
      const [hours] = await tx.select().from(operatingHours).where(eq(operatingHours.weekday, weekday)).limit(1);
      if (!hours?.isOpen || !hours.opensAt || !hours.latestStartAt) throw new BookingError(409, 'Atölye seçilen gün kapalı');
      const blocks = await tx.select({ startsAt: blackoutPeriods.startsAt, endsAt: blackoutPeriods.endsAt }).from(blackoutPeriods).where(and(or(isNull(blackoutPeriods.printerId), eq(blackoutPeriods.printerId, printer.id)), lt(blackoutPeriods.startsAt, endsAt), gt(blackoutPeriods.endsAt, startsAt)));
      const reservations = await tx.select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt, status: appointments.status, verificationExpiresAt: appointments.verificationExpiresAt }).from(appointments).where(and(eq(appointments.printerId, printer.id), lt(appointments.startsAt, endsAt), gt(appointments.endsAt, startsAt), inArray(appointments.status, ['pending_verification', 'pending_approval', 'change_requested', 'approved', 'ready', 'printing'])));
      const slots = availableStartTimes({ date, opensAt: hours.opensAt, latestStartAt: hours.latestStartAt, slotMinutes, durationMinutes, now: new Date(), blackouts: blocks, reservations: reservations.filter(row => row.startsAt && row.endsAt).map(row => ({ startsAt: row.startsAt!, endsAt: row.endsAt!, status: row.status, verificationExpiresAt: row.verificationExpiresAt })) });
      if (!slots.includes(startTime)) throw new BookingError(409, 'Seçilen saat artık müsait değil');
      let filament = null;
      if (input.data.filamentSource === 'workshop') {
        [filament] = await tx.select().from(filaments).where(and(eq(filaments.id, input.data.filamentId!), eq(filaments.available, true))).for('update').limit(1);
        if (!filament) throw new BookingError(409, 'Seçilen filament kullanılamıyor');
      }
      const now = new Date();
      const [{ insertId }] = await tx.insert(appointments).values({
        publicId, printerId: printer.id, status: 'pending_verification',
        firstName: input.data.firstName, lastName: input.data.lastName, name: `${input.data.firstName} ${input.data.lastName}`, email: input.data.email,
        startsAt, endsAt, durationMinutes, filamentSource: input.data.filamentSource,
        filamentId: filament?.id ?? null, filamentMaterial: filament?.name ?? input.data.material ?? null,
        filamentColor: filament?.color ?? input.data.color ?? null,
        verificationTokenHash: hash(verificationToken), verificationExpiresAt: new Date(now.getTime() + holdMinutes * 60_000),
        privacyNoticeVersion: String(settings['privacy.notice_version'] ?? '2026-10-16'),
        privacyNoticeSeenAt: now, rulesAcceptedAt: now,
      });
      await tx.insert(appointmentFiles).values({ appointmentId: insertId, path: relativePath, originalName: file.name.replace(/[\u0000-\u001f\u007f/\\]/g, '_'), extension, mimeType: 'application/octet-stream', sizeBytes: bytes.length, scheduledDeletionAt: new Date(now.getTime() + retentionDays * 86_400_000) });
      await tx.insert(appointmentStatusHistories).values({ appointmentId: insertId, toStatus: 'pending_verification', note: 'Randevu talebi oluşturuldu; e-posta doğrulaması bekleniyor.' });
    });
    try { await sendBookingVerification(input.data.email, publicId, verificationToken); }
    catch {
      await db.transaction(async tx => {
        const [appointment] = await tx.select({ id: appointments.id }).from(appointments).where(eq(appointments.publicId, publicId)).for('update').limit(1);
        if (appointment) {
          await tx.delete(appointmentStatusHistories).where(eq(appointmentStatusHistories.appointmentId, appointment.id));
          await tx.delete(appointmentFiles).where(eq(appointmentFiles.appointmentId, appointment.id));
          await tx.delete(appointments).where(eq(appointments.id, appointment.id));
        }
      });
      throw new BookingError(503, 'Doğrulama e-postası gönderilemedi');
    }
    return c.json({ publicId, email: input.data.email }, 201);
  } catch (error) {
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
    if (error instanceof BookingError) return c.json({ error: error.message }, error.status);
    console.error('Randevu talebi kaydedilemedi');
    return c.json({ error: 'Randevu talebi kaydedilemedi' }, 503);
  }
});
export default route;
