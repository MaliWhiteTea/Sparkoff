import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import { istanbulWallMinuteToUtc } from '../booking-availability.js';
import { announcementReads, announcementRoles, announcementSchema, announcements, auditLogs, customRoles, events } from '../../shared/schema.js';
import { canManageUnit, requireTab, type AppEnv, type Auth } from '../auth.js';

const route = new Hono<AppEnv>();
const canAudience = (permissions: string[], audience: string, action: 'create' | 'update' | 'archive') =>
  (audience === 'internal' || permissions.includes(`announcements_${action}`)) &&
  (audience === 'public' || permissions.includes(`staff_announcements_${action}`));
const isLive = (row: typeof announcements.$inferSelect) => row.isPublished && Boolean(row.publishedAt && row.publishedAt <= new Date()) && (!row.startsAt || row.startsAt <= new Date()) && (!row.endsAt || row.endsAt > new Date()) && (!row.expiresAt || row.expiresAt > new Date());
function schedule(startsAt: string | null, endsAt: string | null) {
  const parse = (value: string | null) => value ? istanbulWallMinuteToUtc(value.slice(0, 10), value.slice(11)) : null;
  const start = parse(startsAt);
  const end = parse(endsAt);
  if (startsAt && !start || endsAt && !end || start && end && end <= start) return null;
  return { startsAt: start, endsAt: end };
}
const canSeeUnit = (auth: Auth, unitId: number | null) => unitId === null || auth.user.globalRole === 'super_admin' || auth.scopes.accessIds.includes(unitId) || auth.scopes.viewIds.includes(unitId);
async function roleTargets() {
  const rows = await db.select().from(announcementRoles);
  const targets = new Map<number, number[]>();
  for (const row of rows) targets.set(row.announcementId, [...(targets.get(row.announcementId) || []), row.roleId]);
  return targets;
}
const targetsUser = (auth: Auth, roles: number[]) => auth.user.globalRole === 'super_admin' || roles.length === 0 || roles.some(roleId => auth.roleIds.includes(roleId));
async function validTargets(roleIds: number[]) {
  if (!roleIds.length) return true;
  const rows = await db.select({ id: customRoles.id }).from(customRoles).where(inArray(customRoles.id, roleIds));
  return rows.length === roleIds.length;
}
route.use('*', async (c, next) => c.req.path.endsWith('/public') ? next() : requireTab('announcements')(c, next));
route.get('/public', async c => {
  const placement = new URL(c.req.url).searchParams.get('placement') || 'home';
  if (!['home', 'printers'].includes(placement)) return c.json({ error: 'Gösterim yeri geçersiz' }, 400);
  const rows = await db.select().from(announcements);
  return c.json({ announcements: rows.filter(row => ['public', 'both'].includes(row.audience) && ['all', placement].includes(row.placement) && isLive(row)) });
});
route.get('/targets', async c => {
  const auth = c.get('auth');
  if (!['staff_announcements_create', 'staff_announcements_update', 'staff_announcements_archive'].some(permission => auth.permissions.includes(permission as Auth['permissions'][number]))) return c.json({ error: 'Yetki yok' }, 403);
  return c.json({ roles: await db.select({ id: customRoles.id, name: customRoles.name }).from(customRoles) });
});
route.get('/manage', async c => {
  const auth = c.get('auth');
  const publicView = auth.permissions.includes('announcements_view');
  const staffView = auth.permissions.includes('staff_announcements_view');
  if (!publicView && !staffView) return c.json({ error: 'Yetki yok' }, 403);
  const [rows, targets] = await Promise.all([db.select().from(announcements), roleTargets()]);
  const staffManager = auth.permissions.includes('staff_announcements_update') || auth.permissions.includes('staff_announcements_archive');
  return c.json({ announcements: rows.filter(row => row.audience === 'public' ? publicView : row.audience === 'internal' ? staffView && canSeeUnit(auth, row.unitId) && (staffManager || targetsUser(auth, targets.get(row.id) || [])) : publicView || staffView && canSeeUnit(auth, row.unitId) && (staffManager || targetsUser(auth, targets.get(row.id) || []))).map(row => ({ ...row, roleIds: staffManager ? targets.get(row.id) || [] : [] })) });
});
route.get('/', async c => {
  const auth = c.get('auth');
  const [rows, allEvents, targets, reads] = await Promise.all([db.select().from(announcements), db.select().from(events), roleTargets(), db.select().from(announcementReads).where(eq(announcementReads.userId, auth.user.id))]);
  const readById = new Map(reads.map(read => [read.announcementId, read]));
  return c.json({
    announcements: rows.filter(row => {
      if (!isLive(row)) return false;
      if (row.audience === 'public' || row.audience === 'both') return true;
      return auth.permissions.includes('staff_announcements_view') && canSeeUnit(auth, row.unitId) && targetsUser(auth, targets.get(row.id) || []);
    }).map(row => ({ ...row, readAt: readById.get(row.id)?.readAt || null, acknowledgedAt: readById.get(row.id)?.acknowledgedAt || null, canAcknowledge: row.audience !== 'public' && auth.permissions.includes('staff_announcements_view') && canSeeUnit(auth, row.unitId) && targetsUser(auth, targets.get(row.id) || []) })),
    events: allEvents.filter(event => canSeeUnit(auth, event.unitId)),
  });
});
route.post('/', async c => {
  const auth = c.get('auth');
  const input = announcementSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Duyuru geçersiz' }, 400);
  if (!canAudience(auth.permissions, input.data.audience, 'create')) return c.json({ error: 'Duyuru hedefi için yetki yok' }, 403);
  if (input.data.unitId && !canManageUnit(auth, input.data.unitId)) return c.json({ error: 'Birim yetkisi yok' }, 403);
  if (input.data.audience === 'public' && (input.data.roleIds.length || input.data.requiresAcknowledgement) || !await validTargets(input.data.roleIds)) return c.json({ error: 'Hedef roller geçersiz' }, 400);
  const dates = schedule(input.data.startsAt, input.data.endsAt);
  if (!dates) return c.json({ error: 'Duyuru zamanı geçersiz' }, 400);
  const { roleIds, startsAt, endsAt, ...fields } = input.data;
  const insertId = await db.transaction(async tx => {
    const [created] = await tx.insert(announcements).values({ ...fields, ...dates, unitId: fields.unitId || null, createdBy: auth.user.id, publishedAt: new Date() });
    if (roleIds.length) await tx.insert(announcementRoles).values(roleIds.map(roleId => ({ announcementId: created.insertId, roleId })));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'announcement.created', entity: 'announcement', entityId: created.insertId, after: { audience: fields.audience, roleIds, requiresAcknowledgement: fields.requiresAcknowledgement } });
    return created.insertId;
  });
  return c.json({ id: insertId }, 201);
});
route.patch('/:id', async c => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Kimlik geçersiz' }, 400);
  const auth = c.get('auth');
  const input = announcementSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Duyuru geçersiz' }, 400);
  const [before] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!before) return c.json({ error: 'Duyuru bulunamadı' }, 404);
  if (!canAudience(auth.permissions, before.audience, 'update') || !canAudience(auth.permissions, input.data.audience, 'update')) return c.json({ error: 'Duyuru hedefi için yetki yok' }, 403);
  if ((before.unitId && !canManageUnit(auth, before.unitId)) || (input.data.unitId && !canManageUnit(auth, input.data.unitId))) return c.json({ error: 'Birim yetkisi yok' }, 403);
  if (input.data.audience === 'public' && (input.data.roleIds.length || input.data.requiresAcknowledgement) || !await validTargets(input.data.roleIds)) return c.json({ error: 'Hedef roller geçersiz' }, 400);
  const dates = schedule(input.data.startsAt, input.data.endsAt);
  if (!dates) return c.json({ error: 'Duyuru zamanı geçersiz' }, 400);
  const { roleIds, startsAt, endsAt, ...fields } = input.data;
  await db.transaction(async tx => {
    await tx.update(announcements).set({ ...fields, ...dates, unitId: fields.unitId || null, publishedAt: fields.isPublished && !before.isPublished ? new Date() : before.publishedAt }).where(eq(announcements.id, id));
    await tx.delete(announcementRoles).where(eq(announcementRoles.announcementId, id));
    if (roleIds.length) await tx.insert(announcementRoles).values(roleIds.map(roleId => ({ announcementId: id, roleId })));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'announcement.updated', entity: 'announcement', entityId: id, before: { title: before.title, body: before.body, audience: before.audience, unitId: before.unitId, pinned: before.pinned, requiresAcknowledgement: before.requiresAcknowledgement }, after: input.data });
  });
  return c.json({ ok: true });
});
route.delete('/:id', async c => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Kimlik geçersiz' }, 400);
  const auth = c.get('auth');
  const [before] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!before) return c.json({ error: 'Duyuru bulunamadı' }, 404);
  if (!canAudience(auth.permissions, before.audience, 'archive')) return c.json({ error: 'Duyuru hedefi için yetki yok' }, 403);
  if (before.unitId && !canManageUnit(auth, before.unitId)) return c.json({ error: 'Birim yetkisi yok' }, 403);
  await db.transaction(async tx => {
    await tx.delete(announcementReads).where(eq(announcementReads.announcementId, id));
    await tx.delete(announcementRoles).where(eq(announcementRoles.announcementId, id));
    await tx.delete(announcements).where(eq(announcements.id, id));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'announcement.archived', entity: 'announcement', entityId: id, before: { title: before.title, audience: before.audience, unitId: before.unitId } });
  });
  return c.json({ ok: true });
});
route.post('/:id/read', async c => {
  const id = Number(c.req.param('id'));
  const auth = c.get('auth');
  if (!Number.isSafeInteger(id)) return c.json({ error: 'Kimlik geçersiz' }, 400);
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row) return c.json({ error: 'Duyuru bulunamadı' }, 404);
  const targets = await roleTargets();
  const isPublic = row.audience === 'public' || row.audience === 'both';
  const canSeeInternal = auth.permissions.includes('staff_announcements_view') && canSeeUnit(auth, row.unitId) && targetsUser(auth, targets.get(id) || []);
  if (!isLive(row) || !isPublic && !canSeeInternal) return c.json({ error: 'Duyuru bulunamadı' }, 404);
  await db.insert(announcementReads).values({ announcementId: id, userId: auth.user.id }).onDuplicateKeyUpdate({ set: { readAt: new Date() } });
  return c.json({ ok: true });
});
route.post('/:id/acknowledge', async c => {
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Kimlik geçersiz' }, 400);
  const auth = c.get('auth');
  if (!auth.permissions.includes('staff_announcements_view')) return c.json({ error: 'Yetki yok' }, 403);
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row || row.audience === 'public' || !isLive(row)) return c.json({ error: 'Duyuru bulunamadı' }, 404);
  const targets = await roleTargets();
  if (!canSeeUnit(auth, row.unitId) || !targetsUser(auth, targets.get(id) || [])) return c.json({ error: 'Duyuru bulunamadı' }, 404);
  const now = new Date();
  await db.insert(announcementReads).values({ announcementId: id, userId: auth.user.id, readAt: now, acknowledgedAt: row.requiresAcknowledgement ? now : null }).onDuplicateKeyUpdate({ set: { readAt: now, ...(row.requiresAcknowledgement ? { acknowledgedAt: now } : {}) } });
  await db.insert(auditLogs).values({ actorId: auth.user.id, action: row.requiresAcknowledgement ? 'announcement.acknowledged' : 'announcement.read', entity: 'announcement', entityId: id });
  return c.json({ ok: true, acknowledged: row.requiresAcknowledgement });
});
export default route;
