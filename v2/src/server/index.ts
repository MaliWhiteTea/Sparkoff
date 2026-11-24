import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { open, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { requireAuth, type AppEnv } from './auth.js';
import org from './routes/org.js';
import tasks from './routes/tasks.js';
import chat from './routes/chat.js';
import inventory from './routes/inventory.js';
import printers from './routes/printers.js';
import announce from './routes/announce.js';
import activity, { currentPrivacySettings, runRetention } from './routes/activity.js';
import feedback from './routes/feedback.js';
import workshop from './routes/workshop.js';
import { db } from './db.js';
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import { categories, feedbacks, loans, locations, materialMedia, materials, publicMaterialView } from '../shared/schema.js';
import { availableQuantity } from '../shared/inventory.js';
import { loadMediaFile, mediaDiskPath } from './media.js';
import { imageType, videoType } from '../shared/media.js';
import { imageDimensions, newFeedbackImagePath, removeFeedbackImage, saveFeedbackImage } from './feedback-image.js';
import { countAttempt, limitKey } from './rate-limit.js';
import { expireDueVerifications } from './booking-expiration.js';
import { z } from 'zod';

const app = new Hono<AppEnv>();
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
app.use('*', secureHeaders());
if (process.env.NODE_ENV !== 'production') app.use('/api/*', cors({ origin: process.env.APP_ORIGIN || 'http://127.0.0.1:5173', credentials: true, allowHeaders: ['content-type', 'x-csrf-token'] }));
app.get('/api/health', c => c.json({ ok: true }));
app.get('/api/public/privacy', async c => c.json(await currentPrivacySettings()));
app.get('/api/public/materials/:materialId/media/:mediaId', async c => {
  const materialId = Number(c.req.param('materialId')), mediaId = Number(c.req.param('mediaId'));
  if (!Number.isSafeInteger(materialId) || !Number.isSafeInteger(mediaId) || materialId <= 0 || mediaId <= 0) return c.json({ error: 'Medya bulunamadı' }, 404);
  const [item] = await db.select({ id: materials.id }).from(materials).where(and(eq(materials.id, materialId), eq(materials.isPublic, true), eq(materials.isActive, true), isNull(materials.archivedAt), ne(materials.publicVisibility, 'hidden'))).limit(1);
  if (!item) return c.json({ error: 'Medya bulunamadı' }, 404);
  const [medium] = await db.select().from(materialMedia).where(and(eq(materialMedia.id, mediaId), eq(materialMedia.materialId, item.id), inArray(materialMedia.type, ['image', 'video']))).limit(1);
  if (!medium?.path) return c.json({ error: 'Medya bulunamadı' }, 404);
  try {
    if (medium.type === 'image') {
      const bytes = await loadMediaFile(medium.path);
      const type = imageType(bytes);
      if (!type) return c.json({ error: 'Medya bulunamadı' }, 404);
      c.header('Content-Type', type.mime);
      c.header('Cache-Control', 'public, max-age=3600');
      c.header('X-Content-Type-Options', 'nosniff');
      return c.body(bytes);
    }
    const path = mediaDiskPath(medium.path);
    const file = await open(path, 'r');
    let size = 0;
    let type: ReturnType<typeof videoType> = null;
    try {
      size = (await file.stat()).size;
      const header = Buffer.alloc(Math.min(size, 4096));
      await file.read(header, 0, header.length, 0);
      type = videoType(header);
    } finally { await file.close(); }
    if (!type || size === 0) return c.json({ error: 'Medya bulunamadı' }, 404);
    c.header('Content-Type', type.mime);
    c.header('Cache-Control', 'public, max-age=3600');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Accept-Ranges', 'bytes');
    const range = c.req.header('range');
    let start = 0, end = size - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) { c.header('Content-Range', `bytes */${size}`); return c.body(null, 416); }
      start = Number(match[1]); end = match[2] ? Number(match[2]) : end;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= size) { c.header('Content-Range', `bytes */${size}`); return c.body(null, 416); }
      c.header('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    c.header('Content-Length', String(end - start + 1));
    return c.body(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, range ? 206 : 200);
  } catch { return c.json({ error: 'Medya bulunamadı' }, 404); }
});
app.get('/api/public/materials', async c => {
  const rows = await db.select({ id: materials.id, legacyMaterialId: materials.legacyMaterialId, name: materials.name, kind: materials.kind, unit: materials.unit, sku: materials.sku, brand: materials.brand, model: materials.model, description: materials.description, technicalSpecs: materials.technicalSpecs, updatedAt: materials.updatedAt, categoryId: materials.categoryId, category: categories.name, categoryActive: categories.isActive, location: locations.name, locationPublic: locations.isPublic, quantity: materials.quantity, publicVisibility: materials.publicVisibility }).from(materials).leftJoin(categories, eq(materials.categoryId, categories.id)).leftJoin(locations, eq(materials.locationId, locations.id)).where(and(eq(materials.isPublic, true), eq(materials.isActive, true), isNull(materials.archivedAt), ne(materials.publicVisibility, 'hidden')));
  const equipmentIds = rows.filter(row => row.kind === 'equipment').map(row => row.id);
  const active = equipmentIds.length ? await db.select({ materialId: loans.materialId, quantity: loans.quantity, returnedQuantity: loans.returnedQuantity, status: loans.status }).from(loans).where(and(inArray(loans.materialId, equipmentIds), inArray(loans.status, ['open', 'partial']))) : [];
  const media = rows.length ? await db.select({ id: materialMedia.id, materialId: materialMedia.materialId, type: materialMedia.type, path: materialMedia.path, externalUrl: materialMedia.externalUrl, title: materialMedia.title, altText: materialMedia.altText, sortOrder: materialMedia.sortOrder, isCover: materialMedia.isCover }).from(materialMedia).where(inArray(materialMedia.materialId, rows.map(row => row.id))) : [];
  const loansByMaterial = new Map<number, typeof active>();
  for (const loan of active) {
    const group = loansByMaterial.get(loan.materialId) || [];
    group.push(loan);
    loansByMaterial.set(loan.materialId, group);
  }
  const mediaByMaterial = new Map<number, typeof media>();
  for (const medium of media) {
    if (!((['image', 'video'].includes(medium.type) && medium.path) || (medium.type === 'link' && medium.externalUrl?.startsWith('https://')))) continue;
    const group = mediaByMaterial.get(medium.materialId) || [];
    group.push(medium);
    mediaByMaterial.set(medium.materialId, group);
  }
  return c.json({ materials: rows.map(row => ({ ...publicMaterialView(row, availableQuantity(row.kind, row.quantity, loansByMaterial.get(row.id))), legacyMaterialId: row.legacyMaterialId, sku: row.sku, brand: row.brand, model: row.model, description: row.description, technicalSpecs: row.technicalSpecs ?? {}, updatedAt: row.updatedAt, categoryId: row.categoryId, category: row.category || 'Diğer', categoryActive: row.categoryActive, location: row.locationPublic ? row.location : null, media: (mediaByMaterial.get(row.id) || []).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map(medium => ({ id: medium.id, type: medium.type, url: medium.type === 'link' ? medium.externalUrl : `/api/public/materials/${row.id}/media/${medium.id}`, title: medium.title, altText: medium.altText, isCover: medium.isCover })) })) });
});
app.get('/api/public/materials/legacy-map', async c => {
  const raw = new URL(c.req.url).searchParams.get('ids') || '';
  if (!/^\d+(?:,\d+)*$/.test(raw) || raw.length > 1200) return c.json({ error: 'Favori kimlikleri geçersiz' }, 400);
  const ids = [...new Set(raw.split(',').map(Number))].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 100);
  if (!ids.length) return c.json({ map: [] });
  const rows = await db.select({ id: materials.id, legacyId: materials.legacyMaterialId }).from(materials).where(and(inArray(materials.legacyMaterialId, ids), eq(materials.isPublic, true), eq(materials.isActive, true), isNull(materials.archivedAt), ne(materials.publicVisibility, 'hidden')));
  return c.json({ map: rows });
});
app.get('/api/public/materials/search', async c => {
  const q = Object.fromEntries(new URL(c.req.url).searchParams);
  const input = z.object({ search: z.string().max(100).default(''), category: z.coerce.number().int().nonnegative().default(0), stock: z.enum(['all', 'available', 'out']).default('all'), sort: z.enum(['name_asc', 'name_desc', 'updated_desc']).default('name_asc'), per_page: z.coerce.number().refine(value => [12, 24, 48].includes(value)).default(24), page: z.coerce.number().int().min(1).max(100000).default(1), favorites: z.enum(['0', '1']).default('0'), favorite_ids: z.string().max(1200).regex(/^\d+(?:,\d+)*$/).optional() }).safeParse(q);
  if (!input.success) return c.json({ error: 'Katalog ölçütleri geçersiz' }, 400);
  const filters = input.data;
  const favoriteIds = filters.favorite_ids ? [...new Set(filters.favorite_ids.split(',').map(Number))].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 100) : [];
  const visible = and(eq(materials.isPublic, true), eq(materials.isActive, true), isNull(materials.archivedAt), ne(materials.publicVisibility, 'hidden'));
  const categoryRows = await db.select({ id: categories.id, name: categories.name }).from(categories)
    .innerJoin(materials, eq(materials.categoryId, categories.id))
    .where(and(visible, eq(categories.isActive, true))).groupBy(categories.id, categories.name);
  const categoryList = categoryRows.sort((a, b) => a.name.localeCompare(b.name, 'tr')).map(row => ({ id: row.id, name: row.name }));
  // A correlated aggregate keeps equipment reservations in SQL; the public response still
  // uses the same available balance for the stock filter and the displayed quantity.
  const available = sql<string>`greatest(0, ${materials.quantity} - case when ${materials.kind} = 'equipment' then coalesce((select sum(greatest(0, quantity - returned_quantity)) from loans where material_id = ${materials.id} and status in ('open', 'partial')), 0) else 0 end)`;
  const terms = filters.search.trim().toLocaleLowerCase('tr-TR').split(/\s+/).filter(Boolean);
  const haystack = sql`lower(concat_ws(' ', ${materials.name}, ${materials.sku}, ${materials.brand}, ${materials.model}, ${materials.description}, coalesce(${categories.name}, 'Diğer')) collate utf8mb4_turkish_ci)`;
  const where = and(visible, ...terms.map(term => sql`locate(${term}, ${haystack}) > 0`),
    filters.category ? eq(materials.categoryId, filters.category) : undefined,
    filters.stock === 'available' ? gt(available, 0) : filters.stock === 'out' ? sql`${available} <= 0` : undefined,
    filters.favorites === '1' ? favoriteIds.length ? inArray(materials.id, favoriteIds) : sql`false` : undefined);
  const [{ total }] = await db.select({ total: count() }).from(materials).leftJoin(categories, eq(materials.categoryId, categories.id)).where(where);
  const nameOrder = sql`${materials.name} collate utf8mb4_turkish_ci`;
  const order = filters.sort === 'updated_desc' ? [desc(materials.updatedAt), desc(materials.id)] : filters.sort === 'name_desc' ? [desc(nameOrder), desc(materials.id)] : [asc(nameOrder), asc(materials.id)];
  const pageRows = await db.select({ id: materials.id, legacyMaterialId: materials.legacyMaterialId, name: materials.name, kind: materials.kind, unit: materials.unit, sku: materials.sku, brand: materials.brand, model: materials.model, description: materials.description, technicalSpecs: materials.technicalSpecs, updatedAt: materials.updatedAt, categoryId: materials.categoryId, category: categories.name, categoryActive: categories.isActive, location: locations.name, locationPublic: locations.isPublic, quantity: materials.quantity, publicVisibility: materials.publicVisibility, available }).from(materials).leftJoin(categories, eq(materials.categoryId, categories.id)).leftJoin(locations, eq(materials.locationId, locations.id)).where(where).orderBy(...order).limit(filters.per_page).offset((filters.page - 1) * filters.per_page);
  const media = pageRows.length ? await db.select({ id: materialMedia.id, materialId: materialMedia.materialId, type: materialMedia.type, path: materialMedia.path, externalUrl: materialMedia.externalUrl, title: materialMedia.title, altText: materialMedia.altText, sortOrder: materialMedia.sortOrder, isCover: materialMedia.isCover }).from(materialMedia).where(inArray(materialMedia.materialId, pageRows.map(row => row.id))) : [];
  const mediaByMaterial = new Map<number, typeof media>();
  for (const medium of media) {
    if (!((['image', 'video'].includes(medium.type) && medium.path) || (medium.type === 'link' && medium.externalUrl?.startsWith('https://')))) continue;
    const group = mediaByMaterial.get(medium.materialId) || [];
    group.push(medium); mediaByMaterial.set(medium.materialId, group);
  }
  return c.json({ total, page: filters.page, pageSize: filters.per_page, categories: categoryList, materials: pageRows.map(row => ({ ...publicMaterialView(row, row.available), legacyMaterialId: row.legacyMaterialId, sku: row.sku, brand: row.brand, model: row.model, description: row.description, technicalSpecs: row.technicalSpecs ?? {}, updatedAt: row.updatedAt, categoryId: row.categoryId, category: row.category || 'Diğer', categoryActive: row.categoryActive, location: row.locationPublic ? row.location : null, media: (mediaByMaterial.get(row.id) || []).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map(medium => ({ id: medium.id, type: medium.type, url: medium.type === 'link' ? medium.externalUrl : `/api/public/materials/${row.id}/media/${medium.id}`, title: medium.title, altText: medium.altText, isCover: medium.isCover })) })) });
});
app.post('/api/public/feedback', async c => {
  const remote = getConnInfo(c).remote.address || 'unknown';
  const client = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) ? c.req.header('x-real-ip') || remote : remote;
  if (!(await countAttempt(limitKey('public-feedback', client), 5, 60))) return c.json({ error: 'Bir dakika içinde en fazla 5 geri bildirim gönderilebilir' }, 429);
  if (Number(c.req.header('content-length') || 0) > 6 * 1024 * 1024) return c.json({ error: 'Geri bildirim isteği çok büyük' }, 413);
  const multipart = c.req.header('content-type')?.startsWith('multipart/form-data');
  let body: Record<string, unknown> | null = null;
  try {
    const reader = c.req.raw.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 6 * 1024 * 1024) { await reader.cancel(); return c.json({ error: 'Geri bildirim isteği çok büyük' }, 413); }
      chunks.push(chunk.value);
    }
    const bytes = Buffer.concat(chunks, size);
    body = multipart ? Object.fromEntries(await new Request(c.req.url, { method: 'POST', headers: c.req.raw.headers, body: bytes }).formData()) : JSON.parse(bytes.toString('utf8'));
  } catch { return c.json({ error: 'Geri bildirim formu okunamadı' }, 400); }
  const input = z.object({ kind: z.enum(['suggestion', 'complaint', 'bug']), message: z.string().trim().min(10).max(3000), website: z.string().max(0).optional() }).safeParse(body);
  if (!input.success) return c.json({ error: 'Geri bildirim geçersiz' }, 400);
  const file = multipart ? body?.image : undefined;
  if (file != null && !(file instanceof File)) return c.json({ error: 'Görsel geçersiz' }, 400);
  let bytes: Uint8Array | null = null;
  let type: ReturnType<typeof imageType> = null;
  if (file instanceof File) {
    if (!file.size || file.size > 5 * 1024 * 1024) return c.json({ error: 'Görsel en fazla 5 MB olabilir' }, 400);
    bytes = new Uint8Array(await file.arrayBuffer());
    type = imageType(bytes);
    const dimensions = imageDimensions(bytes);
    if (!type || !dimensions || !dimensions.width || !dimensions.height || dimensions.width > 6000 || dimensions.height > 6000) return c.json({ error: 'JPG, PNG veya WebP görsel en fazla 6000 × 6000 piksel olabilir' }, 400);
  }
  let savedPath: string | null = null;
  try {
    const result = await db.transaction(async tx => {
      const [{ insertId }] = await tx.insert(feedbacks).values({ kind: input.data.kind, message: input.data.message });
      if (bytes && type && file instanceof File) {
        savedPath = newFeedbackImagePath(insertId, type.extension);
        await saveFeedbackImage(savedPath, insertId, bytes);
        await tx.update(feedbacks).set({ imagePath: savedPath, imageOriginalName: file.name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 240), imageMimeType: type.mime, imageSize: bytes.length }).where(eq(feedbacks.id, insertId));
      }
      return c.json({ id: insertId }, 201);
    });
    return result;
  } catch {
    const cleanupPath = savedPath as string | null;
    if (cleanupPath) await removeFeedbackImage(cleanupPath, Number(cleanupPath.split('/')[1])).catch(() => {});
    return c.json({ error: 'Geri bildirim kaydedilemedi' }, 500);
  }
});
app.route('/api/org', org);
app.use('/api/tasks', requireAuth);
app.use('/api/tasks/*', requireAuth);
app.use('/api/chat/*', requireAuth);
app.use('/api/inventory', requireAuth);
app.use('/api/inventory/*', requireAuth);
app.use('/api/activity/*', requireAuth);
app.use('/api/feedback', requireAuth);
app.use('/api/feedback/*', requireAuth);
app.use('/api/printers/appointments', requireAuth);
app.use('/api/printers/appointments*', requireAuth);
app.use('/api/announce', requireAuth);
app.use('/api/announce/*', async (c, next) => c.req.path === '/api/announce/public' ? next() : requireAuth(c, next));
app.route('/api/printers', printers);
app.route('/api/announce', announce);
app.route('/api/tasks', tasks);
app.route('/api/chat', chat);
app.route('/api/inventory', inventory);
app.route('/api/activity', activity);
app.route('/api/feedback', feedback);
app.route('/api/workshop', workshop);
function validCronSecret(actual: string) {
  const expected = process.env.CRON_SECRET;
  return !!expected && !!actual && Buffer.byteLength(expected) === Buffer.byteLength(actual) && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
app.post('/api/internal/expire-verifications', async c => {
  if (!validCronSecret(c.req.header('x-cron-secret') || '')) return c.json({ error: 'Yetki yok' }, 403);
  return c.json({ expiredVerifications: await expireDueVerifications() });
});
app.post('/api/internal/cron', async c => {
  if (!validCronSecret(c.req.header('x-cron-secret') || '')) return c.json({ error: 'Yetki yok' }, 403);
  const expiredVerifications = await expireDueVerifications();
  return c.json({ expiredVerifications, ...await runRetention() });
});
app.notFound(async c => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'Uç nokta bulunamadı' }, 404);
  try { return c.html(await readFile(resolve(publicRoot, 'index.html'), 'utf8')); }
  catch { return c.text('Ön yüz henüz derlenmedi', 503); }
});
app.use('/*', serveStatic({ root: publicRoot }));
app.onError((error, c) => { console.error(error); return c.json({ error: 'Sunucu hatası' }, 500); });
serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000), hostname: process.env.HOST || '127.0.0.1' });
