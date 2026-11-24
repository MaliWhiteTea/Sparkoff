import { Hono } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Readable } from 'node:stream';
import { and, asc, eq, gt, inArray, isNull, lt, max, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { availableStartTimes, istanbulParts } from '../booking-availability.js';
import { appointmentFiles, appointmentStatusHistories, appointments, auditLogs, blackoutPeriods, filamentSchema, filaments, operatingHours, printerSchema, printers, systemSettings } from '../../shared/schema.js';
import { requireAuth, type AppEnv, type Auth } from '../auth.js';
import { countAttempt, limitKey } from '../rate-limit.js';
import schedule from './schedule.js';
import { appointmentTransitions, managedStatuses, reviewStatuses } from '../../shared/appointment-status.js';
import { downloadName, openAppointmentFile } from '../private-files.js';
import { safeCsvLine } from '../../shared/safe-csv.js';
import { createHash, randomBytes } from 'node:crypto';
import { assertBookingMailConfigured, sendBookingStatus, sendBookingTracking } from '../booking-mail.js';
import bookingRequest from './booking-request.js';
import { bookingExtensions } from '../booking-file.js';

const route = new Hono<AppEnv>();
route.route('/', bookingRequest);
const can = (auth: Auth, permission: Auth['permissions'][number]) => auth.permissions.includes(permission);
const statusSchema = z.object({ status: z.enum([...reviewStatuses, ...managedStatuses]), note: z.string().trim().max(2000).nullable().optional() }).superRefine((value, ctx) => {
  if (['rejected', 'change_requested', 'failed'].includes(value.status) && (!value.note || value.note.length < 3)) ctx.addIssue({ code: 'custom', message: 'Bu durum için açıklama gerekli', path: ['note'] });
});
route.get('/public', async c => c.json({ printers: await db.select().from(printers).orderBy(printers.sortOrder, printers.id), filaments: await db.select().from(filaments).orderBy(filaments.name, filaments.sortOrder, filaments.id) }));
route.get('/booking-config', async c => {
  if (process.env.ONLINE_BOOKING_ENABLED !== 'true') return c.json({ enabled: false });
  try { assertBookingMailConfigured(); } catch { return c.json({ error: 'Randevu e-postası hazır değil' }, 503); }
  const rows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(inArray(systemSettings.key, ['booking.slot_minutes', 'booking.maximum_duration_hours', 'uploads.maximum_file_size_mb', 'uploads.allowed_extensions', 'privacy.notice_version']));
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const slotMinutes = Number(settings['booking.slot_minutes'] ?? 30);
  const maximumDurationHours = Number(settings['booking.maximum_duration_hours'] ?? 24);
  const maximumFileSizeMb = Number(settings['uploads.maximum_file_size_mb'] ?? 100);
  const allowedExtensions = settings['uploads.allowed_extensions'] ?? bookingExtensions;
  const noticeVersion = settings['privacy.notice_version'] ?? '2026-10-16';
  if (![15, 30, 60].includes(slotMinutes) || !Number.isInteger(maximumDurationHours) || maximumDurationHours < 1 || maximumDurationHours > 168 ||
    !Number.isInteger(maximumFileSizeMb) || maximumFileSizeMb < 1 || maximumFileSizeMb > 500 ||
    !Array.isArray(allowedExtensions) || !allowedExtensions.length || allowedExtensions.some(value => !bookingExtensions.includes(value as typeof bookingExtensions[number])) ||
    typeof noticeVersion !== 'string' || !noticeVersion || noticeVersion.length > 30) return c.json({ error: 'Randevu ayarı geçersiz' }, 503);
  return c.json({ enabled: true, slotMinutes, maximumDurationHours, maximumFileSizeMb, allowedExtensions, noticeVersion });
});
route.get('/availability', async c => {
  if (process.env.ONLINE_BOOKING_ENABLED !== 'true') return c.json({ error: 'Çevrimiçi randevu kapalı' }, 404);
  const remote = getConnInfo(c).remote.address || 'unknown';
  const client = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) ? c.req.header('x-real-ip') || remote : remote;
  if (!(await countAttempt(limitKey('booking-availability', client), 60, 60))) return c.json({ error: 'Çok fazla müsaitlik sorgusu' }, 429);
  const input = z.object({ date: z.iso.date(), durationMinutes: z.coerce.number().int().positive() }).safeParse({ date: c.req.query('date'), durationMinutes: c.req.query('durationMinutes') });
  if (!input.success) return c.json({ error: 'Tarih veya süre geçersiz' }, 400);
  const today = istanbulParts(new Date()).date;
  const distance = (Date.parse(`${input.data.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  if (!Number.isInteger(distance) || distance < 0 || distance > 6) return c.json({ error: 'Yalnız sonraki yedi gün sorgulanabilir' }, 400);
  const rows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(inArray(systemSettings.key, ['booking.slot_minutes', 'booking.maximum_duration_hours']));
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const slotMinutes = Number(settings['booking.slot_minutes'] ?? 30);
  const maximumHours = Number(settings['booking.maximum_duration_hours'] ?? 24);
  if (![15, 30, 60].includes(slotMinutes) || !Number.isInteger(maximumHours) || maximumHours < 1 || maximumHours > 168) return c.json({ error: 'Randevu ayarı geçersiz' }, 503);
  if (input.data.durationMinutes < slotMinutes || input.data.durationMinutes > maximumHours * 60 || input.data.durationMinutes % slotMinutes !== 0) return c.json({ error: 'Baskı süresi geçersiz' }, 400);
  const day = new Date(`${input.data.date}T12:00:00Z`).getUTCDay() || 7;
  const [hours] = await db.select().from(operatingHours).where(eq(operatingHours.weekday, day)).limit(1);
  const activePrinters = await db.select({ id: printers.id, code: printers.code, name: printers.name }).from(printers).where(eq(printers.status, 'active')).orderBy(printers.sortOrder, printers.id);
  if (!activePrinters.length) return c.json({ printers: [] });
  if (!hours?.isOpen || !hours.opensAt || !hours.latestStartAt) return c.json({ printers: activePrinters.map(printer => ({ ...printer, slots: [] })) });
  const from = new Date(Date.parse(`${input.data.date}T00:00:00Z`) - 86_400_000);
  const to = new Date(Date.parse(`${input.data.date}T00:00:00Z`) + 2 * 86_400_000);
  const printerIds = activePrinters.map(printer => printer.id);
  const blocks = await db.select({ printerId: blackoutPeriods.printerId, startsAt: blackoutPeriods.startsAt, endsAt: blackoutPeriods.endsAt }).from(blackoutPeriods).where(and(
    or(isNull(blackoutPeriods.printerId), inArray(blackoutPeriods.printerId, printerIds)), lt(blackoutPeriods.startsAt, to), gt(blackoutPeriods.endsAt, from),
  ));
  const reserved = await db.select({ printerId: appointments.printerId, startsAt: appointments.startsAt, endsAt: appointments.endsAt, status: appointments.status, verificationExpiresAt: appointments.verificationExpiresAt }).from(appointments).where(and(
    inArray(appointments.printerId, printerIds), lt(appointments.startsAt, to), gt(appointments.endsAt, from),
    inArray(appointments.status, ['pending_verification', 'pending_approval', 'change_requested', 'approved', 'ready', 'printing']),
  ));
  const now = new Date();
  return c.json({ printers: activePrinters.map(printer => ({ ...printer, slots: availableStartTimes({
    date: input.data.date, opensAt: hours.opensAt!, latestStartAt: hours.latestStartAt!, slotMinutes,
    durationMinutes: input.data.durationMinutes, now,
    blackouts: blocks.filter(row => row.printerId === null || row.printerId === printer.id),
    reservations: reserved.filter(row => row.printerId === printer.id && row.startsAt && row.endsAt).map(row => ({ startsAt: row.startsAt!, endsAt: row.endsAt!, status: row.status, verificationExpiresAt: row.verificationExpiresAt })),
  }) })) });
});
const trackingStatusLabels: Record<string, string> = {
  pending_approval: 'Yönetici onayı bekleniyor', change_requested: 'Değişiklik istendi',
  approved: 'Onaylandı', ready: 'Baskıya hazır', printing: 'Basılıyor',
  completed: 'Tamamlandı', failed: 'Baskı başarısız', rejected: 'Reddedildi',
  canceled: 'İptal edildi', expired: 'Süresi doldu',
};
const terminalTrackingStatuses = new Set(['completed', 'canceled', 'rejected', 'expired']);
const trackingHash = (token: string) => createHash('sha256').update(token).digest('hex');
function trackingInput(publicId: string, token: string) {
  return /^[0-9a-fA-F-]{36}$/.test(publicId) && /^[A-Za-z0-9]{64}$/.test(token);
}
async function trackingAllowed(c: Parameters<typeof getConnInfo>[0], action: string) {
  const remote = getConnInfo(c).remote.address || 'unknown';
  const client = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) ? c.req.header('x-real-ip') || remote : remote;
  return countAttempt(limitKey(`booking-${action}`, client), action === 'cancel' ? 10 : 60, 60);
}
route.get('/verification/:publicId/:token', async c => {
  c.header('Cache-Control', 'private, no-store');
  c.header('Referrer-Policy', 'no-referrer');
  if (!(await trackingAllowed(c, 'verification'))) return c.json({ error: 'Çok fazla doğrulama isteği' }, 429);
  const { publicId, token } = c.req.param();
  if (!trackingInput(publicId, token)) return c.json({ error: 'Bağlantı bulunamadı' }, 404);
  const [appointment] = await db.select({ status: appointments.status, expiresAt: appointments.verificationExpiresAt }).from(appointments).where(and(eq(appointments.publicId, publicId), eq(appointments.verificationTokenHash, trackingHash(token)))).limit(1);
  if (!appointment || appointment.status !== 'pending_verification') return c.json({ error: 'Bağlantı bulunamadı' }, 404);
  return c.json({ expired: !appointment.expiresAt || appointment.expiresAt <= new Date() });
});
route.post('/verification/:publicId/:token', async c => {
  c.header('Cache-Control', 'private, no-store');
  c.header('Referrer-Policy', 'no-referrer');
  if (!(await trackingAllowed(c, 'verification'))) return c.json({ error: 'Çok fazla doğrulama isteği' }, 429);
  const { publicId, token } = c.req.param();
  if (!trackingInput(publicId, token)) return c.json({ error: 'Bağlantı bulunamadı' }, 404);
  const trackingToken = randomBytes(32).toString('hex');
  const result = await db.transaction(async tx => {
    const [appointment] = await tx.select({ id: appointments.id, email: appointments.email, status: appointments.status, expiresAt: appointments.verificationExpiresAt }).from(appointments).where(and(eq(appointments.publicId, publicId), eq(appointments.verificationTokenHash, trackingHash(token)))).for('update').limit(1);
    if (!appointment || appointment.status !== 'pending_verification') return { missing: true } as const;
    if (!appointment.expiresAt || appointment.expiresAt <= new Date()) {
      await tx.update(appointments).set({ status: 'expired', verificationTokenHash: null, verificationExpiresAt: null, updatedAt: new Date() }).where(eq(appointments.id, appointment.id));
      await tx.insert(appointmentStatusHistories).values({ appointmentId: appointment.id, fromStatus: 'pending_verification', toStatus: 'expired', note: 'Doğrulama bağlantısının süresi doldu.' });
      return { expired: true } as const;
    }
    const now = new Date();
    await tx.update(appointments).set({ status: 'pending_approval', emailVerifiedAt: now, verificationTokenHash: null, verificationExpiresAt: null, trackTokenHash: trackingHash(trackingToken), updatedAt: now }).where(eq(appointments.id, appointment.id));
    await tx.insert(appointmentStatusHistories).values({ appointmentId: appointment.id, fromStatus: 'pending_verification', toStatus: 'pending_approval', note: 'E-posta adresi doğrulandı; yönetici onayı bekleniyor.' });
    return { email: appointment.email } as const;
  });
  if ('missing' in result) return c.json({ error: 'Bağlantı bulunamadı' }, 404);
  if ('expired' in result) return c.json({ expired: true });
  let emailSent = false;
  if (result.email) {
    try { await sendBookingTracking(result.email, publicId, trackingToken); emailSent = true; }
    catch { console.error('Randevu takip e-postası gönderilemedi'); }
  }
  return c.json({ verified: true, trackingUrl: `/randevu/takip/${publicId}/${trackingToken}`, emailSent });
});
route.get('/tracking/:publicId/:token', async c => {
  c.header('Cache-Control', 'private, no-store');
  c.header('Referrer-Policy', 'no-referrer');
  if (!(await trackingAllowed(c, 'tracking'))) return c.json({ error: 'Çok fazla takip isteği' }, 429);
  const { publicId, token } = c.req.param();
  if (!trackingInput(publicId, token)) return c.json({ error: 'Randevu bulunamadı' }, 404);
  const [appointment] = await db.select().from(appointments).where(and(eq(appointments.publicId, publicId), eq(appointments.trackTokenHash, trackingHash(token)))).limit(1);
  if (!appointment?.emailVerifiedAt) return c.json({ error: 'Randevu bulunamadı' }, 404);
  const [printer, files, history] = await Promise.all([
    appointment.printerId ? db.select({ name: printers.name }).from(printers).where(eq(printers.id, appointment.printerId)).limit(1) : Promise.resolve([]),
    db.select({ originalName: appointmentFiles.originalName }).from(appointmentFiles).where(and(eq(appointmentFiles.appointmentId, appointment.id), isNull(appointmentFiles.deletedAt))).orderBy(appointmentFiles.id).limit(1),
    db.select({ toStatus: appointmentStatusHistories.toStatus, note: appointmentStatusHistories.note, createdAt: appointmentStatusHistories.createdAt }).from(appointmentStatusHistories).where(eq(appointmentStatusHistories.appointmentId, appointment.id)).orderBy(appointmentStatusHistories.createdAt, appointmentStatusHistories.id),
  ]);
  return c.json({ appointment: {
    publicId: appointment.publicId, status: appointment.status, statusLabel: trackingStatusLabels[appointment.status] ?? appointment.status,
    printer: printer[0]?.name ?? null, startsAt: appointment.startsAt, endsAt: appointment.endsAt,
    durationMinutes: appointment.durationMinutes, filament: [appointment.filamentMaterial, appointment.filamentColor].filter(Boolean).join(' · '),
    fileName: files[0]?.originalName ?? null, canCancel: !terminalTrackingStatuses.has(appointment.status),
    history: history.map(item => ({ status: item.toStatus, label: trackingStatusLabels[item.toStatus] ?? item.toStatus, note: item.note, date: item.createdAt })),
  } });
});
route.post('/tracking/:publicId/:token/cancel', async c => {
  c.header('Cache-Control', 'private, no-store');
  c.header('Referrer-Policy', 'no-referrer');
  if (!(await trackingAllowed(c, 'cancel'))) return c.json({ error: 'Çok fazla iptal isteği' }, 429);
  const { publicId, token } = c.req.param();
  if (!trackingInput(publicId, token)) return c.json({ error: 'Randevu bulunamadı' }, 404);
  return db.transaction(async tx => {
    const [appointment] = await tx.select().from(appointments).where(and(eq(appointments.publicId, publicId), eq(appointments.trackTokenHash, trackingHash(token)))).for('update').limit(1);
    if (!appointment?.emailVerifiedAt) return c.json({ error: 'Randevu bulunamadı' }, 404);
    if (terminalTrackingStatuses.has(appointment.status)) return c.json({ ok: true, status: appointment.status });
    const now = new Date();
    await tx.update(appointments).set({ status: 'canceled', canceledAt: now, updatedAt: now }).where(eq(appointments.id, appointment.id));
    await tx.insert(appointmentStatusHistories).values({ appointmentId: appointment.id, fromStatus: appointment.status, toStatus: 'canceled', note: 'Randevu kullanıcı tarafından iptal edildi.' });
    return c.json({ ok: true, status: 'canceled' });
  });
});
route.use('/manage/*', requireAuth);
route.route('/manage', schedule);
route.get('/manage/printers', async c => {
  if (!c.get('auth').permissions.includes('printers_view') && !c.get('auth').permissions.includes('printers_manage_schedule')) return c.json({ error: 'Yetki yok' }, 403);
  return c.json({ printers: await db.select().from(printers).orderBy(printers.sortOrder, printers.id) });
});
route.post('/manage/printers', async c => {
  if (!can(c.get('auth'), 'printers_create')) return c.json({ error: 'Yetki yok' }, 403);
  const input = printerSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Yazıcı bilgileri geçersiz' }, 400);
  try {
    const [{ highest }] = await db.select({ highest: max(printers.sortOrder) }).from(printers);
    const [{ insertId }] = await db.insert(printers).values({ ...input.data, sortOrder: (highest ?? 0) + 1 });
    return c.json({ id: insertId }, 201);
  } catch { return c.json({ error: 'Yazıcı kodu zaten kullanılıyor' }, 409); }
});
route.patch('/manage/printers/:id', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'printers_update') && !can(auth, 'printers_change_status')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = printerSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Yazıcı bilgileri geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const [found] = await tx.select().from(printers).where(eq(printers.id, id)).for('update').limit(1);
      if (!found) return c.json({ error: 'Yazıcı bulunamadı' }, 404);
      const detailsChanged = found.code !== input.data.code || found.name !== input.data.name || found.description !== (input.data.description ?? null);
      if (detailsChanged && !can(auth, 'printers_update') || found.status !== input.data.status && !can(auth, 'printers_change_status')) return c.json({ error: 'Yetki yok' }, 403);
      await tx.update(printers).set(input.data).where(eq(printers.id, id));
      return c.json({ ok: true });
    });
  } catch { return c.json({ error: 'Yazıcı kodu zaten kullanılıyor' }, 409); }
});
route.get('/manage/filaments', async c => {
  if (!c.get('auth').permissions.includes('printers_manage_filaments')) return c.json({ error: 'Yetki yok' }, 403);
  return c.json({ filaments: await db.select().from(filaments).orderBy(filaments.name, filaments.sortOrder, filaments.id) });
});
route.post('/manage/filaments', async c => {
  if (!can(c.get('auth'), 'printers_manage_filaments')) return c.json({ error: 'Yetki yok' }, 403);
  const input = filamentSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Filament bilgileri geçersiz' }, 400);
  try {
    const [{ highest }] = await db.select({ highest: max(filaments.sortOrder) }).from(filaments);
    const [{ insertId }] = await db.insert(filaments).values({ ...input.data, diameterMm: input.data.diameterMm.toFixed(2), unavailableReason: input.data.available ? null : input.data.unavailableReason, sortOrder: (highest ?? 0) + 1 });
    return c.json({ id: insertId }, 201);
  } catch { return c.json({ error: 'Bu malzeme ve renk zaten kayıtlı' }, 409); }
});
route.patch('/manage/filaments/:id', async c => {
  if (!can(c.get('auth'), 'printers_manage_filaments')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = filamentSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Filament bilgileri geçersiz' }, 400);
  const [found] = await db.select({ id: filaments.id }).from(filaments).where(eq(filaments.id, id)).limit(1);
  if (!found) return c.json({ error: 'Filament bulunamadı' }, 404);
  try {
    await db.update(filaments).set({ ...input.data, diameterMm: input.data.diameterMm.toFixed(2), unavailableReason: input.data.available ? null : input.data.unavailableReason }).where(eq(filaments.id, id));
    return c.json({ ok: true });
  } catch { return c.json({ error: 'Bu malzeme ve renk zaten kayıtlı' }, 409); }
});
route.get('/appointments', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('appointments_view')) return c.json({ error: 'Yetki yok' }, 403);
  const rows = await db.select({ id: appointments.id, publicId: appointments.publicId, printerId: appointments.printerId, printerName: printers.name, durationMinutes: appointments.durationMinutes, name: appointments.name, firstName: appointments.firstName, lastName: appointments.lastName, email: appointments.email, startsAt: appointments.startsAt, status: appointments.status }).from(appointments).leftJoin(printers, eq(appointments.printerId, printers.id));
  const personal = auth.permissions.includes('appointments_view_personal_data');
  return c.json({ appointments: rows.map(row => ({ id: row.id, publicId: row.publicId, printerId: row.printerId, name: personal ? row.name ?? [row.firstName, row.lastName].filter(Boolean).join(' ') : null, email: personal ? row.email : null, startsAt: row.startsAt, status: row.status })) });
});
route.get('/appointments/export.csv', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('appointments_view') || !can(auth, 'appointments_export')) return c.json({ error: 'Yetki yok' }, 403);
  const showPersonal = auth.permissions.includes('appointments_view_personal_data');
  await db.insert(auditLogs).values({ actorId: auth.user.id, action: 'appointment.exported', entity: 'appointment', after: { showPersonal } });
  const stream = Readable.from((async function* () {
    yield `\uFEFF${safeCsvLine(['Randevu no', 'Kamu kimliği', 'Yazıcı', 'Durum', 'Başlangıç UTC', 'Bitiş UTC', 'Süre dakika', 'Başvuru sahibi', 'E-posta', 'Telefon', 'Başvuru notu', 'Yönetici notu'])}`;
    let cursor = 0;
    while (true) {
      const batch = await db.select({ appointment: appointments, printerName: printers.name }).from(appointments).leftJoin(printers, eq(appointments.printerId, printers.id)).where(gt(appointments.id, cursor)).orderBy(asc(appointments.id)).limit(500);
      if (!batch.length) break;
      for (const { appointment, printerName } of batch) yield safeCsvLine([appointment.id, appointment.publicId, printerName, appointment.status, appointment.startsAt?.toISOString(), appointment.endsAt?.toISOString(), appointment.durationMinutes, showPersonal ? appointment.name || [appointment.firstName, appointment.lastName].filter(Boolean).join(' ') : null, showPersonal ? appointment.email : null, showPersonal ? appointment.phone : null, showPersonal ? appointment.userNote : null, showPersonal ? appointment.adminNote : null]);
      cursor = batch[batch.length - 1].appointment.id;
    }
  })());
  c.header('Content-Type', 'text/csv; charset=UTF-8');
  c.header('Content-Disposition', `attachment; filename="sparkoff-randevular-${new Date().toISOString().slice(0, 10)}.csv"`);
  c.header('Cache-Control', 'no-store, private');
  c.header('X-Content-Type-Options', 'nosniff');
  return c.body(Readable.toWeb(stream) as ReadableStream);
});
route.get('/appointments/:id/files', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('appointments_view') || !auth.permissions.includes('appointments_download_file')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Randevu bulunamadı' }, 404);
  const [appointment] = await db.select({ id: appointments.id, retentionExemptUntil: appointments.retentionExemptUntil }).from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!appointment) return c.json({ error: 'Randevu bulunamadı' }, 404);
  const rows = await db.select({ id: appointmentFiles.id, originalName: appointmentFiles.originalName, sizeBytes: appointmentFiles.sizeBytes, deletedAt: appointmentFiles.deletedAt, scheduledDeletionAt: appointmentFiles.scheduledDeletionAt }).from(appointmentFiles).where(eq(appointmentFiles.appointmentId, id));
  const exempt = !!appointment.retentionExemptUntil && appointment.retentionExemptUntil > new Date();
  return c.json({ files: rows.filter(row => !row.deletedAt && (exempt || !row.scheduledDeletionAt || row.scheduledDeletionAt > new Date())).map(({ id: fileId, originalName, sizeBytes }) => ({ id: fileId, originalName, sizeBytes, downloadUrl: `/api/printers/appointments/${id}/files/${fileId}` })) });
});
route.get('/appointments/:id/files/:fileId', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('appointments_download_file')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id')), fileId = Number(c.req.param('fileId'));
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(fileId) || fileId <= 0) return c.json({ error: 'Dosya bulunamadı' }, 404);
  const [appointment] = await db.select({ publicId: appointments.publicId, retentionExemptUntil: appointments.retentionExemptUntil }).from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!appointment) return c.json({ error: 'Dosya bulunamadı' }, 404);
  const [file] = await db.select().from(appointmentFiles).where(and(eq(appointmentFiles.id, fileId), eq(appointmentFiles.appointmentId, id))).limit(1);
  const exempt = !!appointment.retentionExemptUntil && appointment.retentionExemptUntil > new Date();
  if (!file || file.disk !== 'local' || !/^(gcode|3mf|stl|step|stp|obj)$/.test(file.extension) || file.deletedAt || !exempt && file.scheduledDeletionAt && file.scheduledDeletionAt <= new Date()) return c.json({ error: 'Dosya bulunamadı' }, 404);
  let handle;
  try { handle = await openAppointmentFile(file.path, appointment.publicId, file.sizeBytes); }
  catch { return c.json({ error: 'Dosya bulunamadı' }, 404); }
  try { await db.insert(auditLogs).values({ actorId: auth.user.id, action: 'appointment.file.downloaded', entity: 'appointment_file', entityId: fileId, after: { appointmentId: id } }); }
  catch (error) { await handle.close(); throw error; }
  c.header('Content-Type', 'application/octet-stream');
  c.header('Content-Disposition', `attachment; filename="model.${file.extension}"; filename*=UTF-8''${encodeURIComponent(downloadName(file.originalName, file.extension))}`);
  c.header('Content-Length', String(file.sizeBytes));
  c.header('Cache-Control', 'private, no-store');
  c.header('X-Content-Type-Options', 'nosniff');
  return c.body(Readable.toWeb(handle.createReadStream()) as ReadableStream);
});
route.patch('/appointments/:id', async c => {
  const auth = c.get('auth');
  const id = Number(c.req.param('id'));
  const input = statusSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Durum veya açıklama geçersiz' }, 400);
  const review = (reviewStatuses as readonly string[]).includes(input.data.status);
  if (!can(auth, review ? 'appointments_review' : 'appointments_manage_status')) return c.json({ error: 'Yetki yok' }, 403);
  const [reference] = await db.select({ printerId: appointments.printerId }).from(appointments).where(eq(appointments.id, id)).limit(1);
  if (!reference) return c.json({ error: 'Randevu bulunamadı' }, 404);
  if (reference.printerId === null) return c.json({ error: 'Randevuya bağlı yazıcı yok' }, 409);
  const printerId = reference.printerId;
  const result = await db.transaction(async tx => {
    const [printer] = await tx.select({ status: printers.status }).from(printers).where(eq(printers.id, printerId)).for('update').limit(1);
    if (!printer) return c.json({ error: 'Randevuya bağlı yazıcı bulunamadı' }, 409);
    const [current] = await tx.select({ id: appointments.id, printerId: appointments.printerId, status: appointments.status, adminNote: appointments.adminNote, startsAt: appointments.startsAt, endsAt: appointments.endsAt }).from(appointments).where(eq(appointments.id, id)).for('update').limit(1);
    if (!current) return c.json({ error: 'Randevu bulunamadı' }, 404);
    if (current.printerId !== printerId) return c.json({ error: 'Randevu yazıcısı değişti; yeniden deneyin' }, 409);
    if (!appointmentTransitions[current.status]?.includes(input.data.status)) return c.json({ error: 'Bu durum geçişine izin verilmiyor' }, 409);
    if (input.data.status === 'approved' || current.status === 'failed' && input.data.status === 'ready') {
      if (printer.status !== 'active' || !current.startsAt || !current.endsAt || current.startsAt >= current.endsAt) return c.json({ error: 'Yazıcı veya randevu aralığı uygun değil' }, 409);
      const [blackout] = await tx.select({ id: blackoutPeriods.id }).from(blackoutPeriods).where(and(
        or(isNull(blackoutPeriods.printerId), eq(blackoutPeriods.printerId, printerId)),
        lt(blackoutPeriods.startsAt, current.endsAt), gt(blackoutPeriods.endsAt, current.startsAt),
      )).limit(1);
      if (blackout) return c.json({ error: 'Bu aralık bakım veya kapalı zamana denk geliyor' }, 409);
      const overlaps = await tx.select({ status: appointments.status, verificationExpiresAt: appointments.verificationExpiresAt }).from(appointments).where(and(
        eq(appointments.printerId, printerId), ne(appointments.id, id),
        lt(appointments.startsAt, current.endsAt), gt(appointments.endsAt, current.startsAt),
        inArray(appointments.status, ['pending_verification', 'pending_approval', 'change_requested', 'approved', 'ready', 'printing']),
      ));
      if (overlaps.some(row => row.status !== 'pending_verification' || !row.verificationExpiresAt || row.verificationExpiresAt > new Date())) return c.json({ error: 'Bu aralık başka bir randevuyla çakışıyor' }, 409);
    }
    const defaultNotes: Record<string, string> = { approved: 'Randevu yönetici tarafından onaylandı.', ready: 'Baskı hazırlıkları tamamlandı.', printing: '3D baskı başlatıldı.', completed: '3D baskı tamamlandı.' };
    const note = input.data.note || defaultNotes[input.data.status] || null;
    await tx.update(appointments).set({ status: input.data.status, adminNote: input.data.note ?? current.adminNote, updatedAt: new Date() }).where(eq(appointments.id, id));
    await tx.insert(appointmentStatusHistories).values({ appointmentId: id, actorId: auth.user.id, fromStatus: current.status, toStatus: input.data.status, note });
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: review ? 'appointment.status.reviewed' : 'appointment.status.managed', entity: 'appointment', entityId: id, before: { status: current.status }, after: { status: input.data.status } });
    return c.json({ ok: true });
  });
  if (result.status !== 200) return result;
  const [appointment] = await db.select({ email: appointments.email, firstName: appointments.firstName, startsAt: appointments.startsAt, durationMinutes: appointments.durationMinutes, adminNote: appointments.adminNote, printerName: printers.name }).from(appointments).leftJoin(printers, eq(appointments.printerId, printers.id)).where(eq(appointments.id, id)).limit(1);
  let emailSent: boolean | null = appointment?.email ? false : null;
  if (appointment?.email) {
    try { await sendBookingStatus({ to: appointment.email, status: input.data.status, firstName: appointment.firstName, startsAt: appointment.startsAt, durationMinutes: appointment.durationMinutes, printer: appointment.printerName, adminNote: appointment.adminNote }); emailSent = true; }
    catch { console.error('Randevu durum e-postası gönderilemedi'); }
  }
  return c.json({ ok: true, emailSent });
});
export default route;
