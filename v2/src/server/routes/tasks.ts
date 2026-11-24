import { Hono } from 'hono';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import { taskSchema, tasks } from '../../shared/schema.js';
import { canManageUnit, requireTab, type AppEnv } from '../auth.js';

const route = new Hono<AppEnv>();
route.use('*', requireTab('tasks'));
route.get('/', async c => {
  const auth = c.get('auth');
  const visible = [...new Set([...auth.scopes.manageIds, ...auth.scopes.viewIds])];
  const own = await db.select().from(tasks).where(eq(tasks.assigneeId, auth.user.id));
  if (!visible.length) return c.json({ tasks: own });
  const managed = await db.select().from(tasks).where(inArray(tasks.unitId, visible));
  return c.json({ tasks: [...new Map([...own, ...managed].map(task => [task.id, task])).values()] });
});
route.post('/', async c => {
  const auth = c.get('auth');
  const input = taskSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Görev bilgileri geçersiz' }, 400);
  if (!canManageUnit(auth, input.data.unitId)) return c.json({ error: 'Yetki yok' }, 403);
  const [{ insertId }] = await db.insert(tasks).values({ unitId: input.data.unitId, assigneeId: input.data.assigneeId || null, title: input.data.title, description: input.data.description, dueAt: input.data.dueAt ? new Date(input.data.dueAt) : null, createdBy: auth.user.id });
  return c.json({ id: insertId }, 201);
});
route.patch('/:id/progress', async c => {
  const auth = c.get('auth');
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => null);
  const progress = Number(body?.progress);
  if (!Number.isInteger(id) || !Number.isInteger(progress) || progress < 0 || progress > 100) return c.json({ error: 'İlerleme 0-100 olmalı' }, 400);
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) return c.json({ error: 'Görev bulunamadı' }, 404);
  if ((task.assigneeId !== auth.user.id && !canManageUnit(auth, task.unitId))) return c.json({ error: 'Yetki yok' }, 403);
  await db.update(tasks).set({ progress, status: progress === 100 ? 'done' : 'active' }).where(eq(tasks.id, id));
  return c.json({ ok: true });
});
export default route;
