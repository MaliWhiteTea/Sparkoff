import { Hono } from 'hono';
import { asc, count, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { auditLogs, feedbacks, users } from '../../shared/schema.js';
import type { AppEnv } from '../auth.js';
import { imageType } from '../../shared/media.js';
import { loadFeedbackImage } from '../feedback-image.js';

const route = new Hono<AppEnv>();
const statuses = ['new', 'reviewing', 'resolved', 'archived'] as const;
const updateSchema = z.object({ status: z.enum(statuses), adminNote: z.string().trim().max(3000).nullable() });

route.get('/', async c => {
  if (!c.get('auth').permissions.includes('feedback_view')) return c.json({ error: 'Yetki yok' }, 403);
  const input = z.object({ status: z.enum([...statuses, 'open']).optional(), sort: z.enum(['created_at', 'handled_at', 'status', 'type']).default('created_at'), direction: z.enum(['asc', 'desc']).default('desc'), page: z.coerce.number().int().min(1).max(100000).default(1) }).safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!input.success) return c.json({ error: 'Geri bildirim ölçütleri geçersiz' }, 400);
  const status = input.data.status;
  const where = status === 'open' ? inArray(feedbacks.status, ['new', 'reviewing']) : status ? eq(feedbacks.status, status) : undefined;
  const sort = { created_at: feedbacks.createdAt, handled_at: feedbacks.handledAt, status: feedbacks.status, type: feedbacks.kind }[input.data.sort];
  const direction = input.data.direction === 'asc' ? asc : desc;
  const [total] = await db.select({ count: count() }).from(feedbacks).where(where);
  const rows = await db.select({ feedback: feedbacks, handlerName: users.name }).from(feedbacks).leftJoin(users, eq(feedbacks.handledBy, users.id)).where(where).orderBy(direction(sort), direction(feedbacks.id)).limit(30).offset((input.data.page - 1) * 30);
  return c.json({ feedbacks: rows.map(({ feedback, handlerName }) => ({ ...feedback, handlerName, imageUrl: feedback.imagePath ? `/api/feedback/${feedback.id}/image` : null })), page: input.data.page, pageSize: 30, total: total.count });
});

route.get('/:id/image', async c => {
  if (!c.get('auth').permissions.includes('feedback_view')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Görsel bulunamadı' }, 404);
  const [row] = await db.select({ imagePath: feedbacks.imagePath, imageSize: feedbacks.imageSize, imageMimeType: feedbacks.imageMimeType }).from(feedbacks).where(eq(feedbacks.id, id)).limit(1);
  if (!row?.imagePath || !row.imageSize) return c.json({ error: 'Görsel bulunamadı' }, 404);
  try {
    const bytes = await loadFeedbackImage(row.imagePath, id, row.imageSize);
    const type = imageType(bytes);
    if (!type || type.mime !== row.imageMimeType) return c.json({ error: 'Görsel bulunamadı' }, 404);
    c.header('Content-Type', type.mime);
    c.header('Content-Disposition', `inline; filename="geri-bildirim-${id}.${type.extension}"`);
    c.header('Cache-Control', 'private, no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    return c.body(bytes);
  } catch { return c.json({ error: 'Görsel bulunamadı' }, 404); }
});

route.patch('/:id', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('feedback_update')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Geri bildirim bilgileri geçersiz' }, 400);
  return db.transaction(async tx => {
    const [before] = await tx.select({ id: feedbacks.id, status: feedbacks.status, adminNote: feedbacks.adminNote }).from(feedbacks).where(eq(feedbacks.id, id)).for('update').limit(1);
    if (!before) return c.json({ error: 'Geri bildirim bulunamadı' }, 404);
    const now = new Date();
    await tx.update(feedbacks).set({ status: input.data.status, adminNote: input.data.adminNote, handledBy: auth.user.id, handledAt: input.data.status === 'new' ? null : now }).where(eq(feedbacks.id, id));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'feedback.updated', entity: 'feedback', entityId: id, before: { status: before.status }, after: { status: input.data.status, adminNoteChanged: before.adminNote !== input.data.adminNote } });
    return c.json({ ok: true });
  });
});

export default route;
