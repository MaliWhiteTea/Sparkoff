import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth, type AppEnv } from '../auth.js';
import { auditLogs, operatingHours, systemSettings } from '../../shared/schema.js';

const route = new Hono<AppEnv>();
const contactKeys = ['workshop.contact_phone', 'workshop.whatsapp_number', 'workshop.contact_email', 'workshop.contact_hours'] as const;
const phone = z.string().trim().max(30).regex(/^[0-9+() .-]*$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const hours = z.object({ weekday: z.number().int().min(1).max(7), isOpen: z.boolean(), opensAt: clock.nullable(), latestStartAt: clock.nullable() }).superRefine((day, context) => {
  if (day.isOpen && (!day.opensAt || !day.latestStartAt || day.latestStartAt < day.opensAt)) context.addIssue({ code: 'custom', message: 'Açık günün saatleri geçersiz' });
});
const inputSchema = z.object({ phone, whatsapp: phone, email: z.union([z.email().max(255), z.literal('')]), contactHours: z.string().trim().max(120), hours: z.array(hours).length(7).refine(days => new Set(days.map(day => day.weekday)).size === 7) });

route.get('/', async c => {
  const [settings, days] = await Promise.all([
    db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(inArray(systemSettings.key, [...contactKeys])),
    db.select().from(operatingHours).orderBy(operatingHours.weekday),
  ]);
  const values = new Map(settings.map(row => [row.key, typeof row.value === 'string' ? row.value : '']));
  const byWeekday = new Map(days.map(day => [day.weekday, day]));
  return c.json({ contact: { phone: values.get(contactKeys[0]) || '', whatsapp: values.get(contactKeys[1]) || '', email: values.get(contactKeys[2]) || '', contactHours: values.get(contactKeys[3]) || '' }, hours: Array.from({ length: 7 }, (_, index) => {
    const row = byWeekday.get(index + 1);
    return { weekday: index + 1, isOpen: row?.isOpen || false, opensAt: row?.opensAt?.slice(0, 5) || null, latestStartAt: row?.latestStartAt?.slice(0, 5) || null };
  }) });
});
route.put('/', requireAuth, async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('workshop_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  const input = inputSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Atölye ve iletişim ayarları geçersiz' }, 400);
  const contact = input.data;
  await db.transaction(async tx => {
    for (const [key, value] of [
      [contactKeys[0], contact.phone], [contactKeys[1], contact.whatsapp],
      [contactKeys[2], contact.email], [contactKeys[3], contact.contactHours],
    ] as const) await tx.insert(systemSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
    for (const day of [...contact.hours].sort((a, b) => a.weekday - b.weekday)) {
      const values = { isOpen: day.isOpen, opensAt: day.isOpen ? `${day.opensAt}:00` : null, latestStartAt: day.isOpen ? `${day.latestStartAt}:00` : null };
      await tx.insert(operatingHours).values({ weekday: day.weekday, ...values }).onDuplicateKeyUpdate({ set: values });
    }
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'workshop.settings.updated', entity: 'system_setting', after: { keys: [...contactKeys], openDays: contact.hours.filter(day => day.isOpen).length } });
  });
  return c.json({ ok: true });
});
export default route;
