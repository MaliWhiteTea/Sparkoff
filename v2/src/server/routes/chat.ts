import { Hono } from 'hono';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db.js';
import { chatMessages, messageSchema, units } from '../../shared/schema.js';
import { canAccessChannel, requireTab, type AppEnv } from '../auth.js';

const route = new Hono<AppEnv>();
route.use('*', requireTab('chat'));
route.get('/channels', async c => {
  const auth = c.get('auth');
  const all = await db.select().from(units);
  return c.json({ channels: all.filter(unit => canAccessChannel(auth, unit.id, unit.isGeneral)) });
});
route.get('/:unitId/messages', async c => {
  const id = Number(c.req.param('unitId'));
  const since = Number(c.req.query('since') || 0);
  const [unit] = await db.select().from(units).where(eq(units.id, id)).limit(1);
  if (!unit) return c.json({ error: 'Kanal bulunamadı' }, 404);
  if (!canAccessChannel(c.get('auth'), id, unit.isGeneral)) return c.json({ error: 'Yetki yok' }, 403);
  const messages = await db.select().from(chatMessages).where(and(eq(chatMessages.unitId, id), gt(chatMessages.id, Number.isSafeInteger(since) && since >= 0 ? since : 0))).orderBy(chatMessages.id).limit(100);
  return c.json({ messages, cursor: messages.at(-1)?.id || since });
});
route.post('/messages', async c => {
  const auth = c.get('auth');
  const input = messageSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Mesaj geçersiz' }, 400);
  const [unit] = await db.select().from(units).where(eq(units.id, input.data.unitId)).limit(1);
  if (!unit) return c.json({ error: 'Kanal bulunamadı' }, 404);
  if (!auth.permissions.includes('chat_write') || !canAccessChannel(auth, unit.id, unit.isGeneral)) return c.json({ error: 'Yetki yok' }, 403);
  const [{ insertId }] = await db.insert(chatMessages).values({ unitId: unit.id, userId: auth.user.id, body: input.data.body, replyToId: input.data.replyToId || null });
  return c.json({ id: insertId }, 201);
});
export default route;
