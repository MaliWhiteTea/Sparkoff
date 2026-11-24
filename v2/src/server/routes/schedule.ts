import { Hono, type Context } from 'hono';
import { and, eq, gt, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { istanbulParts, istanbulWallMinuteToUtc } from '../booking-availability.js';
import { requireAuth, type AppEnv, type Auth } from '../auth.js';
import { appointments, auditLogs, blackoutPeriods, operatingHours, printers, systemSettings } from '../../shared/schema.js';

const route = new Hono<AppEnv>();
route.use('*', requireAuth);
const can = (auth: Auth, permission: Auth['permissions'][number]) => auth.permissions.includes(permission);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const hourRow = z.object({ weekday: z.number().int().min(1).max(7), isOpen: z.boolean(), opensAt: time.nullable(), latestStartAt: time.nullable() }).superRefine((value, ctx) => {
  if (value.isOpen && (!value.opensAt || !value.latestStartAt || value.latestStartAt < value.opensAt)) ctx.addIssue({ code: 'custom', message: 'Açık günün saatleri geçersiz' });
});
const hoursSchema = z.object({ hours: z.array(hourRow).length(7).refine(rows => new Set(rows.map(row => row.weekday)).size === 7) });
const supportedExtensions = ['gcode', '3mf', 'stl', 'step', 'stp', 'obj'] as const;
const bookingKeys = ['booking.slot_minutes', 'booking.maximum_duration_hours', 'booking.verification_hold_minutes', 'uploads.maximum_file_size_mb', 'uploads.allowed_extensions'] as const;
const bookingSchema = z.object({ slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]), maximumDurationHours: z.number().int().min(1).max(168), verificationHoldMinutes: z.number().int().min(10).max(1440), maximumFileSizeMb: z.number().int().min(1).max(500), allowedExtensions: z.array(z.enum(supportedExtensions)).min(1).refine(values => new Set(values).size === values.length) });
route.get('/booking-settings', async c => {
  if (!c.get('auth').permissions.includes('system_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  const rows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(inArray(systemSettings.key, [...bookingKeys]));
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
  return c.json({ slotMinutes: values[bookingKeys[0]] ?? 30, maximumDurationHours: values[bookingKeys[1]] ?? 24, verificationHoldMinutes: values[bookingKeys[2]] ?? 30, maximumFileSizeMb: values[bookingKeys[3]] ?? 100, allowedExtensions: values[bookingKeys[4]] ?? [...supportedExtensions] });
});
route.put('/booking-settings', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('system_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  const input = bookingSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Randevu kuralı geçersiz' }, 400);
  const values = [input.data.slotMinutes, input.data.maximumDurationHours, input.data.verificationHoldMinutes, input.data.maximumFileSizeMb, input.data.allowedExtensions];
  await db.transaction(async tx => {
    for (let index = 0; index < bookingKeys.length; index++) {
      const key = bookingKeys[index]; const value = values[index];
      await tx.insert(systemSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
    }
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'booking.settings.updated', entity: 'system_setting', after: input.data });
  });
  return c.json({ ok: true });
});
const blackoutSchema = z.object({ printerId: z.number().int().positive().nullable(), kind: z.enum(['busy', 'maintenance', 'closed']), isAllDay: z.boolean(), startsAt: z.string(), endsAt: z.string(), reason: z.string().trim().min(1).max(255) });
const blockingStatuses = ['pending_verification', 'pending_approval', 'change_requested', 'approved', 'ready', 'printing'];

function interval(input: z.infer<typeof blackoutSchema>): { startsAt: Date; endsAt: Date } | null {
  const date = z.iso.date();
  const local = /^(\d{4}-\d\d-\d\d)T([01]\d|2[0-3]):([0-5]\d)$/;
  let startsAt: Date | null;
  let endsAt: Date | null;
  if (input.isAllDay) {
    if (!date.safeParse(input.startsAt).success || !date.safeParse(input.endsAt).success) return null;
    const exclusiveEnd = new Date(Date.parse(`${input.endsAt}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    startsAt = istanbulWallMinuteToUtc(input.startsAt, '00:00');
    endsAt = istanbulWallMinuteToUtc(exclusiveEnd, '00:00');
  } else {
    const start = local.exec(input.startsAt);
    const end = local.exec(input.endsAt);
    if (!start || !end || !date.safeParse(start[1]).success || !date.safeParse(end[1]).success) return null;
    startsAt = istanbulWallMinuteToUtc(start[1], `${start[2]}:${start[3]}`);
    endsAt = istanbulWallMinuteToUtc(end[1], `${end[2]}:${end[3]}`);
  }
  return startsAt && endsAt && startsAt < endsAt ? { startsAt, endsAt } : null;
}

route.get('/hours', async c => {
  if (!c.get('auth').permissions.includes('printers_manage_hours')) return c.json({ error: 'Yetki yok' }, 403);
  return c.json({ hours: await db.select().from(operatingHours).orderBy(operatingHours.weekday) });
});
route.put('/hours', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'printers_manage_hours')) return c.json({ error: 'Yetki yok' }, 403);
  const input = hoursSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Çalışma saatleri geçersiz' }, 400);
  await db.transaction(async tx => {
    for (const row of [...input.data.hours].sort((a, b) => a.weekday - b.weekday)) {
      await tx.insert(operatingHours).values({ weekday: row.weekday, isOpen: row.isOpen, opensAt: row.isOpen ? `${row.opensAt}:00` : null, latestStartAt: row.isOpen ? `${row.latestStartAt}:00` : null })
        .onDuplicateKeyUpdate({ set: { isOpen: row.isOpen, opensAt: row.isOpen ? `${row.opensAt}:00` : null, latestStartAt: row.isOpen ? `${row.latestStartAt}:00` : null } });
    }
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'booking.hours.updated', entity: 'operating_hours', after: { weekdays: input.data.hours.map(row => row.weekday), openDays: input.data.hours.filter(row => row.isOpen).length } });
  });
  return c.json({ ok: true });
});
route.get('/blackouts', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('printers_view') && !auth.permissions.includes('printers_manage_schedule')) return c.json({ error: 'Yetki yok' }, 403);
  const rows = await db.select().from(blackoutPeriods).where(gt(blackoutPeriods.endsAt, new Date())).orderBy(blackoutPeriods.startsAt, blackoutPeriods.id);
  return c.json({ blackouts: rows.map(row => {
    const start = istanbulParts(row.startsAt);
    const end = istanbulParts(row.isAllDay ? new Date(row.endsAt.getTime() - 60_000) : row.endsAt);
    return { ...row, startsAtInput: row.isAllDay ? start.date : `${start.date}T${start.time}`, endsAtInput: row.isAllDay ? end.date : `${end.date}T${end.time}` };
  }) });
});

async function writeBlackout(c: Context<AppEnv>, id?: number) {
  const auth = c.get('auth');
  if (!can(auth, 'printers_manage_schedule')) return c.json({ error: 'Yetki yok' }, 403);
  const input = blackoutSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Kapalı zaman bilgileri geçersiz' }, 400);
  const dates = interval(input.data);
  if (!dates) return c.json({ error: 'Zaman aralığı geçersiz' }, 400);
  const [reference] = id === undefined ? [null] : await db.select({ printerId: blackoutPeriods.printerId }).from(blackoutPeriods).where(eq(blackoutPeriods.id, id)).limit(1);
  if (id !== undefined && !reference) return c.json({ error: 'Kapalı zaman bulunamadı' }, 404);
  return db.transaction(async tx => {
    // Lock all affected printers before checking reservations; booking writes use the same lock.
    const lockAll = input.data.printerId === null || reference?.printerId === null;
    const lockIds = [input.data.printerId, reference?.printerId].filter((value): value is number => value !== null && value !== undefined);
    const lockedPrinters = await tx.select({ id: printers.id }).from(printers)
      .where(lockAll ? undefined : inArray(printers.id, lockIds))
      .orderBy(printers.id).for('update');
    if (input.data.printerId !== null && !lockedPrinters.some(printer => printer.id === input.data.printerId)) return c.json({ error: 'Yazıcı bulunamadı' }, 400);
    const existing = id === undefined ? null : (await tx.select().from(blackoutPeriods).where(eq(blackoutPeriods.id, id)).for('update').limit(1))[0];
    if (id !== undefined && !existing) return c.json({ error: 'Kapalı zaman bulunamadı' }, 404);
    if (existing && existing.printerId !== reference?.printerId) return c.json({ error: 'Takvim kaydı değişti; yeniden deneyin' }, 409);
    const conflicts = await tx.select({ id: blackoutPeriods.id }).from(blackoutPeriods).where(and(
      id === undefined ? undefined : ne(blackoutPeriods.id, id),
      input.data.printerId === null ? undefined : or(isNull(blackoutPeriods.printerId), eq(blackoutPeriods.printerId, input.data.printerId)),
      lt(blackoutPeriods.startsAt, dates.endsAt), gt(blackoutPeriods.endsAt, dates.startsAt),
    )).limit(1);
    if (conflicts.length) return c.json({ error: 'Bu aralık başka bir kapalı zamanla çakışıyor' }, 409);
    const reservations = await tx.select({ printerId: appointments.printerId, status: appointments.status, verificationExpiresAt: appointments.verificationExpiresAt }).from(appointments).where(and(
      input.data.printerId === null ? undefined : eq(appointments.printerId, input.data.printerId),
      lt(appointments.startsAt, dates.endsAt), gt(appointments.endsAt, dates.startsAt), inArray(appointments.status, blockingStatuses),
    ));
    if (reservations.some(row => row.status !== 'pending_verification' || !row.verificationExpiresAt || row.verificationExpiresAt > new Date())) return c.json({ error: 'Bu aralıkta randevu var' }, 409);
    const values = { printerId: input.data.printerId, kind: input.data.kind, isAllDay: input.data.isAllDay, ...dates, reason: input.data.reason };
    const blackoutId = id ?? (await tx.insert(blackoutPeriods).values(values))[0].insertId;
    if (id !== undefined) await tx.update(blackoutPeriods).set(values).where(eq(blackoutPeriods.id, id));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: id === undefined ? 'booking.blackout.created' : 'booking.blackout.updated', entity: 'blackout_period', entityId: blackoutId, before: existing ? { printerId: existing.printerId, startsAt: existing.startsAt, endsAt: existing.endsAt } : null, after: { printerId: values.printerId, startsAt: values.startsAt, endsAt: values.endsAt, kind: values.kind, isAllDay: values.isAllDay } });
    return c.json({ id: blackoutId, ok: true }, id === undefined ? 201 : 200);
  });
}
route.post('/blackouts', c => writeBlackout(c));
route.patch('/blackouts/:id', c => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Kimlik geçersiz' }, 400);
  return writeBlackout(c, id);
});
route.delete('/blackouts/:id', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'printers_manage_schedule')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Kimlik geçersiz' }, 400);
  return db.transaction(async tx => {
    const [row] = await tx.select().from(blackoutPeriods).where(eq(blackoutPeriods.id, id)).for('update').limit(1);
    if (!row) return c.json({ error: 'Kapalı zaman bulunamadı' }, 404);
    await tx.delete(blackoutPeriods).where(eq(blackoutPeriods.id, id));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'booking.blackout.deleted', entity: 'blackout_period', entityId: id, before: { printerId: row.printerId, startsAt: row.startsAt, endsAt: row.endsAt, kind: row.kind, isAllDay: row.isAllDay } });
    return c.json({ ok: true });
  });
});

export default route;
