import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { db } from '../db.js';
import { activityLogs, auditLogs, categories, loanSchema, loans, locations, materialLinkSchema, materialMedia, materialSchema, materials, returnSchema, stockAdjustmentSchema, stockMovements } from '../../shared/schema.js';
import { availableQuantity } from '../../shared/inventory.js';
import { inventoryCsv } from '../../shared/inventory-csv.js';
import { loanCsvHeaders, loanCsvLine } from '../../shared/loans-csv.js';
import { analyzeInventoryCsv, importErrors, importFields, inspectInventoryCsv } from '../../shared/inventory-import.js';
import { imageType, videoType } from '../../shared/media.js';
import { newImagePath, newVideoPath, removeMediaFile, saveMediaFile } from '../media.js';
import { inventoryXlsx, inventoryXlsxToCsv } from '../inventory-xlsx.js';
import { requireTab, type AppEnv, type Auth } from '../auth.js';

const route = new Hono<AppEnv>();
const can = (auth: Auth, permission: Auth['permissions'][number]) => auth.permissions.includes(permission);
route.use('*', requireTab('inventory'));
route.use('/import/*', bodyLimit({ maxSize: 3 * 1024 * 1024, onError: c => c.json({ error: 'İçe aktarma isteği çok büyük' }, 413) }));
const importSchema = z.object({ csv: z.string().min(1).max(2 * 1024 * 1024).optional(), xlsxBase64: z.string().min(1).max(Math.ceil(2 * 1024 * 1024 * 4 / 3) + 4).optional(), mapping: z.record(z.string(), z.enum(importFields).nullable()).optional(), skipErrors: z.boolean().optional() }).refine(value => Boolean(value.csv) !== Boolean(value.xlsxBase64));
const mediaUpdateSchema = z.object({ title: z.string().trim().max(180).nullable(), altText: z.string().trim().max(180).nullable(), sortOrder: z.number().int().min(0).max(999), isCover: z.boolean(), externalUrl: z.url().max(2048).refine(value => value.startsWith('https://')).nullable() });
const materialUpdateSchema = materialSchema.extend({ isActive: z.boolean() });
const materialCreateSchema = materialSchema.extend({ quantity: z.number().min(0).max(9999999999).refine(v => Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-7) });
const categorySchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).nullable(), isActive: z.boolean() });
const locationSchema = z.object({ name: z.string().trim().min(1).max(120), code: z.string().trim().toUpperCase().min(1).max(50), description: z.string().trim().max(1000).nullable(), isPublic: z.boolean(), isActive: z.boolean() });
const bulkSchema = z.object({ operation: z.enum(['category', 'location', 'visibility', 'archive']), itemIds: z.array(z.number().int().positive()).min(1).max(100).refine(ids => new Set(ids).size === ids.length), confirmed: z.literal(true), categoryId: z.number().int().positive().nullable().optional(), locationId: z.number().int().positive().nullable().optional(), publicVisibility: z.enum(['hidden', 'status', 'exact']).optional() });
const categorySlug = (name: string) => `${name.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').replaceAll('ğ', 'g').replaceAll('ü', 'u').replaceAll('ş', 's').replaceAll('ö', 'o').replaceAll('ç', 'c').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'kategori'}-${randomUUID().slice(0, 8)}`;
const normalize = (value: string) => value.trim().toLocaleLowerCase('tr-TR');
const importCsv = (input: z.infer<typeof importSchema>) => input.csv ? Promise.resolve(input.csv) : inventoryXlsxToCsv(input.xlsxBase64!);
route.post('/import/inspect', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_import')) return c.json({ error: 'Yetki yok' }, 403);
  const input = importSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'İçe aktarma dosyası geçersiz veya çok büyük' }, 400);
  try { return c.json(inspectInventoryCsv(await importCsv(input.data))); }
  catch (error) { return c.json({ error: (error as Error).message }, 400); }
});
route.post('/import/preview', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_import')) return c.json({ error: 'Yetki yok' }, 403);
  const input = importSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'İçe aktarma dosyası geçersiz veya çok büyük' }, 400);
  try {
    const analysis = analyzeInventoryCsv(await importCsv(input.data), input.data.mapping);
    const [existing, existingLocations] = await Promise.all([db.select({ sku: materials.sku, name: materials.name }).from(materials), db.select({ name: locations.name, code: locations.code }).from(locations)]);
    const errors = [...analysis.errors, ...importErrors(analysis.rows, existing, existingLocations)];
    return c.json({ totalCount: analysis.totalCount, validCount: analysis.totalCount - new Set(errors.map(error => error.line)).size, errorCount: new Set(errors.map(error => error.line)).size, rows: analysis.rows.slice(0, 100), errors });
  } catch (error) { return c.json({ error: (error as Error).message }, 400); }
});
route.post('/import/confirm', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_import')) return c.json({ error: 'Yetki yok' }, 403);
  const input = importSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'İçe aktarma dosyası geçersiz veya çok büyük' }, 400);
  let analysis: ReturnType<typeof analyzeInventoryCsv>;
  try { analysis = analyzeInventoryCsv(await importCsv(input.data), input.data.mapping); }
  catch (error) { return c.json({ error: (error as Error).message }, 400); }
  try {
    return await db.transaction(async tx => {
      const existing = await tx.select({ sku: materials.sku, name: materials.name }).from(materials).for('update');
      const locationRows = await tx.select().from(locations).for('update');
      const errors = [...analysis.errors, ...importErrors(analysis.rows, existing, locationRows)];
      const invalidLines = new Set(errors.map(error => error.line));
      if (errors.length && !input.data.skipErrors) return c.json({ error: 'İçe aktarımda hatalı satırlar var', errors }, 409);
      const rows = analysis.rows.filter(row => !invalidLines.has(row.line));
      if (!rows.length) return c.json({ error: 'İçe aktarılabilecek geçerli satır yok', errors }, 409);
      const categoryRows = await tx.select().from(categories).for('update');
      const categoryIds = new Map(categoryRows.map(row => [normalize(row.name), row.id]));
      const locationByCode = new Map(locationRows.filter(row => row.code).map(row => [normalize(row.code!), row]));
      const locationByName = new Map(locationRows.map(row => [normalize(row.name), row]));
      for (const row of rows) {
        let categoryId: number | null = null;
        if (row.category) {
          const key = normalize(row.category);
          categoryId = categoryIds.get(key) ?? null;
          if (!categoryId) {
            const [{ insertId }] = await tx.insert(categories).values({ name: row.category });
            categoryId = insertId; categoryIds.set(key, insertId);
          }
        }
        let locationId: number | null = null;
        if (row.location || row.locationCode) {
          const code = row.locationCode?.toUpperCase() || null;
          const byCode = code ? locationByCode.get(normalize(code)) : undefined;
          const byName = row.location ? locationByName.get(normalize(row.location)) : undefined;
          if (byCode && byName && byCode.id !== byName.id) throw new Error(`${row.line}. satırda konum adı ve kodu uyuşmuyor.`);
          if (byCode && row.location && normalize(byCode.name) !== normalize(row.location)) throw new Error(`${row.line}. satırda konum kodu başka bir ada ait.`);
          if (byName && code && normalize(byName.code || '') !== normalize(code)) throw new Error(`${row.line}. satırda konum adı başka bir koda ait.`);
          locationId = byCode?.id || byName?.id || null;
          if (!locationId) {
            const locationName = row.location || code!;
            const [{ insertId }] = await tx.insert(locations).values({ name: locationName, code });
            locationId = insertId;
            const created = { id: insertId, name: locationName, code };
            locationByName.set(normalize(locationName), created as typeof locationRows[number]);
            if (code) locationByCode.set(normalize(code), created as typeof locationRows[number]);
          }
        }
        const [{ insertId }] = await tx.insert(materials).values({ name: row.name, sku: row.sku, brand: row.brand, model: row.model, kind: row.kind, unit: row.unit, categoryId, locationId, quantity: row.quantity, minimumStock: row.minimumStock, publicVisibility: row.publicVisibility, isPublic: row.publicVisibility !== 'hidden', description: row.description, isActive: row.status === 'active', archivedAt: row.status === 'archived' ? new Date() : null });
        if (Number(row.quantity) > 0) await tx.insert(stockMovements).values({ materialId: insertId, movementType: 'initial', delta: row.quantity, balanceAfter: row.quantity, reason: 'Dosyadan içe aktarım', actorId: auth.user.id });
      }
      await tx.insert(activityLogs).values({ userId: auth.user.id, action: 'inventory_imported', metadata: { createdCount: rows.length } });
      return c.json({ importedCount: rows.length, skippedCount: invalidLines.size }, 201);
    });
  } catch (error) { return c.json({ error: `İçe aktarım tamamlanamadı: ${(error as Error).message}` }, 409); }
});
route.get('/export.csv', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_export')) return c.json({ error: 'Yetki yok' }, 403);
  const rows = await db.select({ item: materials, category: categories.name, location: locations.name, locationCode: locations.code })
    .from(materials).leftJoin(categories, eq(materials.categoryId, categories.id))
    .leftJoin(locations, eq(materials.locationId, locations.id));
  const csv = inventoryCsv(rows.map(({ item, category, location, locationCode }) => ({ ...item, category, location, locationCode })));
  c.header('Content-Type', 'text/csv; charset=UTF-8');
  c.header('Content-Disposition', `attachment; filename="sparkoff-envanter-${new Date().toISOString().slice(0, 10)}.csv"`);
  c.header('Cache-Control', 'no-store, private');
  return c.body(csv);
});
route.get('/export.xlsx', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_export')) return c.json({ error: 'Yetki yok' }, 403);
  const rows = await db.select({ item: materials, category: categories.name, location: locations.name, locationCode: locations.code })
    .from(materials).leftJoin(categories, eq(materials.categoryId, categories.id))
    .leftJoin(locations, eq(materials.locationId, locations.id));
  const bytes = await inventoryXlsx(rows.map(({ item, category, location, locationCode }) => ({ ...item, category, location, locationCode })));
  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', `attachment; filename="sparkoff-envanter-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  c.header('Cache-Control', 'no-store, private');
  return c.body(Uint8Array.from(bytes).buffer);
});
route.get('/', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('inventory_view') && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Yönetim envanterini görme yetkisi yok' }, 403);
  const rows = await db.select().from(materials);
  const equipmentIds = rows.filter(row => row.kind === 'equipment').map(row => row.id);
  const active = equipmentIds.length ? await db.select({ materialId: loans.materialId, quantity: loans.quantity, returnedQuantity: loans.returnedQuantity, status: loans.status }).from(loans).where(and(inArray(loans.materialId, equipmentIds), inArray(loans.status, ['open', 'partial']))) : [];
  const loansByMaterial = new Map<number, typeof active>();
  for (const loan of active) {
    const group = loansByMaterial.get(loan.materialId) || [];
    group.push(loan);
    loansByMaterial.set(loan.materialId, group);
  }
  return c.json({ materials: rows.map(row => ({ ...row, availableQuantity: availableQuantity(row.kind, row.quantity, loansByMaterial.get(row.id)) })) });
});
route.get('/count', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('inventory_view') && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Yönetim envanterini görme yetkisi yok' }, 403);
  const [{ total }] = await db.select({ total: count() }).from(materials);
  return c.json({ total });
});
route.get('/options', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_view')) return c.json({ error: 'Yetki yok' }, 403);
  const rows = await db.select({ id: materials.id, name: materials.name, kind: materials.kind, isActive: materials.isActive, archivedAt: materials.archivedAt }).from(materials).orderBy(materials.name, materials.id);
  return c.json({ materials: rows });
});
route.get('/search', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_view')) return c.json({ error: 'Yetki yok' }, 403);
  const input = z.object({ search: z.string().max(100).default(''), status: z.enum(['active', 'all', 'inactive', 'low', 'out', 'archived']).default('active'), kind: z.enum(['', 'consumable', 'loanable', 'equipment']).default(''), category: z.coerce.number().int().nonnegative().default(0), sort: z.enum(['name', 'quantity', 'updated']).default('name'), page: z.coerce.number().int().min(1).max(100000).default(1) }).safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!input.success) return c.json({ error: 'Envanter ölçütleri geçersiz' }, 400);
  const filters = input.data;
  const available = sql<string>`greatest(0, ${materials.quantity} - case when ${materials.kind} = 'equipment' then coalesce((select sum(greatest(0, quantity - returned_quantity)) from loans where material_id = ${materials.id} and status in ('open', 'partial')), 0) else 0 end)`;
  const terms = filters.search.trim().toLocaleLowerCase('tr-TR').split(/\s+/).filter(Boolean);
  const haystack = sql`lower(concat_ws(' ', ${materials.name}, ${materials.sku}, ${materials.brand}, ${materials.model}) collate utf8mb4_turkish_ci)`;
  const where = and(...terms.map(term => sql`locate(${term}, ${haystack}) > 0`),
    filters.kind ? eq(materials.kind, filters.kind) : undefined,
    filters.category ? eq(materials.categoryId, filters.category) : undefined,
    filters.status === 'archived' ? isNotNull(materials.archivedAt) : isNull(materials.archivedAt),
    filters.status === 'active' ? eq(materials.isActive, true) : filters.status === 'inactive' ? eq(materials.isActive, false) :
      filters.status === 'out' ? and(eq(materials.isActive, true), sql`${materials.quantity} <= 0`) :
      filters.status === 'low' ? and(eq(materials.isActive, true), sql`${materials.quantity} > 0`, isNotNull(materials.minimumStock), sql`${materials.quantity} <= ${materials.minimumStock}`) : undefined);
  const [{ total }] = await db.select({ total: count() }).from(materials).where(where);
  const order = filters.sort === 'quantity' ? [asc(materials.quantity), asc(materials.id)] : filters.sort === 'updated' ? [desc(materials.updatedAt), desc(materials.id)] : [asc(sql`${materials.name} collate utf8mb4_turkish_ci`), asc(materials.id)];
  const pageSize = 24;
  const rows = await db.select({ item: materials, available }).from(materials).where(where).orderBy(...order).limit(pageSize).offset((filters.page - 1) * pageSize);
  return c.json({ materials: rows.map(({ item, available }) => ({ ...item, availableQuantity: available })), total, page: filters.page, pageSize });
});
route.get('/definitions', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('inventory_view') && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Envanter tanımlarını görme yetkisi yok' }, 403);
  const [categoryRows, locationRows] = await Promise.all([db.select().from(categories).orderBy(categories.sortOrder, categories.name), db.select().from(locations).orderBy(locations.name)]);
  return c.json({ categories: categoryRows, locations: locationRows });
});
route.get('/movements', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('inventory_view_movements')) return c.json({ error: 'Yetki yok' }, 403);
  const rows = await db.select().from(stockMovements).orderBy(desc(stockMovements.id)).limit(30);
  const reversed = rows.length ? await db.select({ reversedMovementId: stockMovements.reversedMovementId }).from(stockMovements).where(inArray(stockMovements.reversedMovementId, rows.map(row => row.id))) : [];
  const reversedIds = new Set(reversed.map(row => row.reversedMovementId));
  return c.json({ movements: rows.map(row => ({ ...row, canUndo: row.movementType === 'adjustment' && row.actorId === auth.user.id && Date.now() - new Date(row.createdAt).getTime() < 60_000 && !reversedIds.has(row.id) })) });
});
route.post('/movements/:id/undo', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_adjust_stock')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Hareket kimliği geçersiz' }, 400);
  return db.transaction(async tx => {
    const [original] = await tx.select().from(stockMovements).where(eq(stockMovements.id, id)).for('update').limit(1);
    if (!original) return c.json({ error: 'Stok hareketi bulunamadı' }, 404);
    const [item] = await tx.select().from(materials).where(eq(materials.id, original.materialId)).for('update').limit(1);
    if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
    if (!original || original.movementType !== 'adjustment' || original.actorId !== auth.user.id) return c.json({ error: 'Bu hareket geri alınamaz' }, 403);
    if (Date.now() - new Date(original.createdAt).getTime() >= 60_000) return c.json({ error: 'Geri alma süresi doldu' }, 409);
    const [previous] = await tx.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.reversedMovementId, id)).limit(1);
    if (previous) return c.json({ error: 'Bu hareket zaten geri alındı' }, 409);
    const next = Math.round(Number(item.quantity) * 1000) - Math.round(Number(original.delta) * 1000);
    if (next < 0) return c.json({ error: 'Geri alma mevcut stoğu sıfırın altına düşürür' }, 409);
    const balance = (next / 1000).toFixed(3);
    await tx.update(materials).set({ quantity: balance }).where(eq(materials.id, item.id));
    const [{ insertId }] = await tx.insert(stockMovements).values({ materialId: item.id, movementType: 'reversal', delta: (-Number(original.delta)).toFixed(3), balanceAfter: balance, reason: 'Kısa süreli geri alma işlemi', actorId: auth.user.id, reversedMovementId: id, sourceType: 'stock_movement', sourceId: id });
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.stock.reversed', entity: 'stock_movement', entityId: insertId, before: { movementId: id, balance: item.quantity }, after: { balance } });
    return c.json({ id: insertId, balance }, 201);
  });
});
route.post('/categories', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_categories')) return c.json({ error: 'Yetki yok' }, 403);
  const input = categorySchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Kategori bilgileri geçersiz' }, 400);
  const [{ insertId }] = await db.insert(categories).values({ ...input.data, slug: categorySlug(input.data.name) });
  await db.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.category.created', entity: 'category', entityId: insertId, after: input.data });
  return c.json({ id: insertId }, 201);
});
route.patch('/categories/:id', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_categories')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = categorySchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Kategori bilgileri geçersiz' }, 400);
  return db.transaction(async tx => {
    const [before] = await tx.select().from(categories).where(eq(categories.id, id)).for('update').limit(1);
    if (!before) return c.json({ error: 'Kategori bulunamadı' }, 404);
    await tx.update(categories).set(input.data).where(eq(categories.id, id));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.category.updated', entity: 'category', entityId: id, before: { name: before.name, description: before.description, isActive: before.isActive }, after: input.data });
    return c.json({ ok: true });
  });
});
route.post('/locations', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_locations')) return c.json({ error: 'Yetki yok' }, 403);
  const input = locationSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Konum bilgileri geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const [{ insertId }] = await tx.insert(locations).values(input.data);
      await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.location.created', entity: 'location', entityId: insertId, after: input.data });
      return c.json({ id: insertId }, 201);
    });
  } catch { return c.json({ error: 'Konum kodu zaten kullanılıyor' }, 409); }
});
route.patch('/locations/:id', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_locations')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = locationSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Konum bilgileri geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const [before] = await tx.select().from(locations).where(eq(locations.id, id)).for('update').limit(1);
      if (!before) return c.json({ error: 'Konum bulunamadı' }, 404);
      await tx.update(locations).set(input.data).where(eq(locations.id, id));
      await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.location.updated', entity: 'location', entityId: id, before: { name: before.name, code: before.code, description: before.description, isPublic: before.isPublic, isActive: before.isActive }, after: input.data });
      return c.json({ ok: true });
    });
  } catch { return c.json({ error: 'Konum kodu zaten kullanılıyor' }, 409); }
});
route.get('/media', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_media')) return c.json({ error: 'Yetki yok' }, 403);
  return c.json({ media: await db.select().from(materialMedia) });
});
route.post('/media/images', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_media')) return c.json({ error: 'Yetki yok' }, 403);
  if (Number(c.req.header('content-length') || 0) > 9 * 1024 * 1024) return c.json({ error: 'Fotoğraf isteği çok büyük' }, 413);
  let form: FormData;
  try { form = await c.req.raw.formData(); }
  catch { return c.json({ error: 'Fotoğraf formu okunamadı' }, 400); }
  const materialId = Number(form.get('materialId'));
  const file = form.get('file');
  const altText = String(form.get('altText') || '').trim();
  const title = String(form.get('title') || '').trim();
  if (!Number.isSafeInteger(materialId) || materialId <= 0 || !(file instanceof File) || !altText || altText.length > 180 || title.length > 180 || file.size === 0 || file.size > 8 * 1024 * 1024) return c.json({ error: 'Fotoğraf bilgileri geçersiz' }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type) return c.json({ error: 'Yalnız JPG, PNG veya WebP fotoğraf yüklenebilir' }, 400);
  let savedPath: string | null = null;
  try {
    return await db.transaction(async tx => {
      const [item] = await tx.select().from(materials).where(eq(materials.id, materialId)).for('update').limit(1);
      if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
      if (item.archivedAt) return c.json({ error: 'Arşivlenmiş malzemenin medyası değiştirilemez' }, 409);
      const existing = await tx.select().from(materialMedia).where(eq(materialMedia.materialId, materialId));
      const images = existing.filter(row => row.type === 'image');
      if (images.length >= 12) return c.json({ error: 'En fazla 12 fotoğraf eklenebilir' }, 409);
      savedPath = newImagePath(materialId, type.extension);
      await saveMediaFile(savedPath, bytes);
      const [{ insertId }] = await tx.insert(materialMedia).values({ materialId, type: 'image', path: savedPath, mime: type.mime, title: title || null, altText, sortOrder: Math.max(0, ...existing.map(row => row.sortOrder)) + 1, isCover: images.length === 0 });
      return c.json({ id: insertId }, 201);
    });
  } catch {
    if (savedPath) await removeMediaFile(savedPath).catch(() => {});
    return c.json({ error: 'Fotoğraf kaydedilemedi' }, 409);
  }
});
route.post('/media/videos', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_media')) return c.json({ error: 'Yetki yok' }, 403);
  if (Number(c.req.header('content-length') || 0) > 52 * 1024 * 1024) return c.json({ error: 'Video isteği çok büyük' }, 413);
  let form: FormData;
  try { form = await c.req.raw.formData(); }
  catch { return c.json({ error: 'Video formu okunamadı' }, 400); }
  const materialId = Number(form.get('materialId'));
  const file = form.get('file');
  const title = String(form.get('title') || '').trim();
  if (!Number.isSafeInteger(materialId) || materialId <= 0 || !(file instanceof File) || title.length > 180 || file.size === 0 || file.size > 50 * 1024 * 1024) return c.json({ error: 'Video bilgileri geçersiz veya dosya 50 MB üzerinde' }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = videoType(bytes);
  if (!type) return c.json({ error: 'Yalnız MP4 veya WebM video yüklenebilir' }, 400);
  let savedPath: string | null = null;
  try {
    return await db.transaction(async tx => {
      const [item] = await tx.select().from(materials).where(eq(materials.id, materialId)).for('update').limit(1);
      if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
      if (item.archivedAt) return c.json({ error: 'Arşivlenmiş malzemenin medyası değiştirilemez' }, 409);
      const existing = await tx.select().from(materialMedia).where(eq(materialMedia.materialId, materialId));
      if (existing.filter(row => row.type === 'video').length >= 2) return c.json({ error: 'En fazla 2 video eklenebilir' }, 409);
      savedPath = newVideoPath(materialId, type.extension);
      await saveMediaFile(savedPath, bytes);
      const [{ insertId }] = await tx.insert(materialMedia).values({ materialId, type: 'video', path: savedPath, mime: type.mime, title: title || null, sortOrder: Math.max(0, ...existing.map(row => row.sortOrder)) + 1 });
      return c.json({ id: insertId }, 201);
    });
  } catch {
    if (savedPath) await removeMediaFile(savedPath).catch(() => {});
    return c.json({ error: 'Video kaydedilemedi' }, 409);
  }
});
route.post('/media/links', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_media')) return c.json({ error: 'Yetki yok' }, 403);
  const input = materialLinkSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Bağlantı bilgileri geçersiz' }, 400);
  return db.transaction(async tx => {
    const [item] = await tx.select().from(materials).where(eq(materials.id, input.data.materialId)).for('update').limit(1);
    if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
    if (item.archivedAt) return c.json({ error: 'Arşivlenmiş malzemenin medyası değiştirilemez' }, 409);
    const existing = await tx.select().from(materialMedia).where(eq(materialMedia.materialId, item.id));
    if (existing.filter(row => row.type === 'link').length >= 8) return c.json({ error: 'En fazla 8 bağlantı eklenebilir' }, 409);
    const sortOrder = Math.max(0, ...existing.map(row => row.sortOrder)) + 1;
    const [{ insertId }] = await tx.insert(materialMedia).values({ materialId: item.id, type: 'link', title: input.data.title || null, externalUrl: input.data.externalUrl, sortOrder });
    return c.json({ id: insertId }, 201);
  });
});
route.patch('/media/:id', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_media')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = mediaUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Medya bilgileri geçersiz' }, 400);
  return db.transaction(async tx => {
    const [found] = await tx.select({ materialId: materialMedia.materialId }).from(materialMedia).where(eq(materialMedia.id, id)).limit(1);
    if (!found) return c.json({ error: 'Medya bulunamadı' }, 404);
    const [item] = await tx.select().from(materials).where(eq(materials.id, found.materialId)).for('update').limit(1);
    if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
    if (item.archivedAt) return c.json({ error: 'Arşivlenmiş malzemenin medyası değiştirilemez' }, 409);
    const [medium] = await tx.select().from(materialMedia).where(eq(materialMedia.id, id)).for('update').limit(1);
    if (!medium || medium.materialId !== item.id) return c.json({ error: 'Medya bulunamadı' }, 404);
    const data = input.data;
    if (medium.type === 'image' && !data.altText) return c.json({ error: 'Fotoğraf açıklaması gerekli' }, 400);
    if (medium.type === 'link' && !data.externalUrl) return c.json({ error: 'HTTPS bağlantısı gerekli' }, 400);
    const siblings = await tx.select().from(materialMedia).where(eq(materialMedia.materialId, item.id));
    if (medium.sortOrder !== data.sortOrder) {
      const swap = siblings.find(row => row.id !== id && row.sortOrder === data.sortOrder);
      if (swap) await tx.update(materialMedia).set({ sortOrder: medium.sortOrder }).where(eq(materialMedia.id, swap.id));
    }
    if (medium.type === 'image' && data.isCover) {
      await tx.update(materialMedia).set({ isCover: false }).where(and(eq(materialMedia.materialId, item.id), eq(materialMedia.type, 'image')));
    } else if (medium.type === 'image' && medium.isCover && !data.isCover) {
      const next = siblings.filter(row => row.id !== id && row.type === 'image').sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)[0];
      if (next) await tx.update(materialMedia).set({ isCover: true }).where(eq(materialMedia.id, next.id));
    }
    await tx.update(materialMedia).set({ title: data.title || null, altText: medium.type === 'image' ? data.altText : null, externalUrl: medium.type === 'link' ? data.externalUrl : null, sortOrder: data.sortOrder, isCover: medium.type === 'image' && (data.isCover || (medium.isCover && !siblings.some(row => row.id !== id && row.type === 'image'))) }).where(eq(materialMedia.id, id));
    return c.json({ ok: true });
  });
});
route.delete('/media/:id', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_manage_media')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Medya kimliği geçersiz' }, 400);
  let pathToRemove: string | null = null;
  const response = await db.transaction(async tx => {
    const [existing] = await tx.select().from(materialMedia).where(eq(materialMedia.id, id)).limit(1);
    if (!existing) return c.json({ error: 'Medya bulunamadı' }, 404);
    const [item] = await tx.select().from(materials).where(eq(materials.id, existing.materialId)).for('update').limit(1);
    if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
    if (item.archivedAt) return c.json({ error: 'Arşivlenmiş malzemenin medyası değiştirilemez' }, 409);
    const [medium] = await tx.select().from(materialMedia).where(eq(materialMedia.id, id)).for('update').limit(1);
    if (!medium || medium.materialId !== item.id) return c.json({ error: 'Medya bulunamadı' }, 404);
    await tx.delete(materialMedia).where(eq(materialMedia.id, id));
    if (medium.isCover && medium.type === 'image') {
      const remaining = await tx.select().from(materialMedia).where(and(eq(materialMedia.materialId, item.id), eq(materialMedia.type, 'image')));
      const next = remaining.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)[0];
      if (next) await tx.update(materialMedia).set({ isCover: true }).where(eq(materialMedia.id, next.id));
    }
    pathToRemove = medium.path;
    return c.json({ ok: true });
  });
  if (response.status === 200 && pathToRemove) await removeMediaFile(pathToRemove).catch(error => console.error('Medya dosyası silinemedi', error));
  return response;
});
route.post('/', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_create')) return c.json({ error: 'Yetki yok' }, 403);
  const input = materialCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Malzeme bilgileri geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const { minimumStock, publicVisibility, quantity, ...fields } = input.data;
      if (fields.categoryId && !(await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, fields.categoryId)).limit(1)).length) return c.json({ error: 'Kategori bulunamadı' }, 400);
      if (fields.locationId && !(await tx.select({ id: locations.id }).from(locations).where(eq(locations.id, fields.locationId)).limit(1)).length) return c.json({ error: 'Konum bulunamadı' }, 400);
      const [{ insertId }] = await tx.insert(materials).values({ ...fields, quantity: quantity.toFixed(3), minimumStock: minimumStock == null ? null : minimumStock.toFixed(3), publicVisibility, isPublic: publicVisibility !== 'hidden' });
      if (quantity > 0) await tx.insert(stockMovements).values({ materialId: insertId, movementType: 'initial', delta: quantity.toFixed(3), balanceAfter: quantity.toFixed(3), reason: 'İlk stok kaydı', actorId: auth.user.id });
      await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.material.created', entity: 'material', entityId: insertId, after: { ...input.data } });
      return c.json({ id: insertId }, 201);
    });
  } catch { return c.json({ error: 'Malzeme oluşturulamadı; stok kodu başka kayıtta olabilir' }, 409); }
});
route.post('/bulk', async c => {
  const auth = c.get('auth');
  const input = bulkSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Toplu işlem bilgileri geçersiz' }, 400);
  const { operation, itemIds, categoryId, locationId, publicVisibility } = input.data;
  if (operation === 'archive' ? !can(auth, 'inventory_archive') : !can(auth, 'inventory_update')) return c.json({ error: 'Toplu işlem yetkisi yok' }, 403);
  if (operation === 'category' && categoryId === undefined || operation === 'location' && locationId === undefined || operation === 'visibility' && publicVisibility === undefined) return c.json({ error: 'Toplu işlem hedefi eksik' }, 400);
  return db.transaction(async tx => {
    if (operation === 'category' && categoryId && !(await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1)).length) return c.json({ error: 'Kategori bulunamadı' }, 400);
    if (operation === 'location' && locationId && !(await tx.select({ id: locations.id }).from(locations).where(eq(locations.id, locationId)).limit(1)).length) return c.json({ error: 'Konum bulunamadı' }, 400);
    const ids = [...itemIds].sort((a, b) => a - b);
    const rows = await tx.select().from(materials).where(inArray(materials.id, ids)).orderBy(materials.id).for('update');
    const byId = new Map(rows.map(row => [row.id, row]));
    const failures: { id: number; name: string; reason: string }[] = [];
    const changes: { id: number; before: unknown; after: unknown }[] = [];
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) { failures.push({ id, name: `Kayıt #${id}`, reason: 'Malzeme artık bulunamadı.' }); continue; }
      if (item.archivedAt) { failures.push({ id, name: item.name, reason: operation === 'archive' ? 'Malzeme zaten arşivlenmiş.' : 'Arşivlenmiş malzeme düzenlenemez.' }); continue; }
      if (operation === 'category') { await tx.update(materials).set({ categoryId }).where(eq(materials.id, id)); changes.push({ id, before: { categoryId: item.categoryId }, after: { categoryId } }); }
      if (operation === 'location') { await tx.update(materials).set({ locationId }).where(eq(materials.id, id)); changes.push({ id, before: { locationId: item.locationId }, after: { locationId } }); }
      if (operation === 'visibility') { await tx.update(materials).set({ publicVisibility: publicVisibility!, isPublic: publicVisibility !== 'hidden' }).where(eq(materials.id, id)); changes.push({ id, before: { publicVisibility: item.publicVisibility, isPublic: item.isPublic }, after: { publicVisibility, isPublic: publicVisibility !== 'hidden' } }); }
      if (operation === 'archive') { const archivedAt = new Date(); await tx.update(materials).set({ isActive: false, archivedAt, isPublic: false }).where(eq(materials.id, id)); changes.push({ id, before: { isActive: item.isActive, archivedAt: item.archivedAt, isPublic: item.isPublic }, after: { isActive: false, archivedAt, isPublic: false } }); }
    }
    const [{ insertId }] = await tx.insert(auditLogs).values({ actorId: auth.user.id, action: `inventory.bulk.${operation}`, entity: 'material', before: changes.map(item => ({ id: item.id, value: item.before })), after: { changes: changes.map(item => ({ id: item.id, value: item.after })), failures } });
    return c.json({ operation, successCount: changes.length, failureCount: failures.length, failures, undoAuditId: operation !== 'archive' && changes.length ? insertId : null, undoExpiresAt: operation !== 'archive' && changes.length ? new Date(Date.now() + 60_000).toISOString() : null });
  });
});
route.post('/bulk/:id/undo', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_update')) return c.json({ error: 'Geri alma yetkisi yok' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'İşlem kimliği geçersiz' }, 400);
  return db.transaction(async tx => {
    const [original] = await tx.select().from(auditLogs).where(eq(auditLogs.id, id)).for('update').limit(1);
    if (!original || original.actorId !== auth.user.id || !['inventory.bulk.category', 'inventory.bulk.location', 'inventory.bulk.visibility'].includes(original.action)) return c.json({ error: 'Bu toplu işlem geri alınamaz' }, 403);
    if (Date.now() - new Date(original.createdAt).getTime() >= 60_000) return c.json({ error: 'Geri alma süresi doldu' }, 409);
    const [used] = await tx.select({ id: auditLogs.id }).from(auditLogs).where(and(eq(auditLogs.action, 'inventory.bulk.undo'), eq(auditLogs.entityId, id))).limit(1);
    if (used) return c.json({ error: 'Bu toplu işlem zaten geri alındı' }, 409);
    const before = original.before as { id: number; value: Record<string, unknown> }[] | null;
    const after = original.after as { changes?: { id: number; value: Record<string, unknown> }[] } | null;
    const field = original.action === 'inventory.bulk.category' ? 'categoryId' : original.action === 'inventory.bulk.location' ? 'locationId' : 'publicVisibility';
    if (!Array.isArray(before) || !before.length || before.length > 100 || !Array.isArray(after?.changes) || after.changes.length !== before.length) return c.json({ error: 'Geri alma kaydı geçersiz' }, 409);
    const ids = before.map(item => item.id).sort((a, b) => a - b);
    if (ids.some(value => !Number.isSafeInteger(value) || value <= 0) || new Set(ids).size !== ids.length) return c.json({ error: 'Geri alma kaydı geçersiz' }, 409);
    const rows = await tx.select().from(materials).where(inArray(materials.id, ids)).orderBy(materials.id).for('update');
    if (rows.length !== ids.length) return c.json({ error: 'Malzemelerden biri artık bulunamadı' }, 409);
    const byId = new Map(rows.map(row => [row.id, row]));
    const afterById = new Map(after.changes.map(item => [item.id, item.value]));
    for (const snapshot of before) {
      const row = byId.get(snapshot.id)!;
      const expected = afterById.get(snapshot.id);
      if (!expected || row[field] !== expected[field] || field === 'publicVisibility' && row.isPublic !== expected.isPublic) return c.json({ error: 'Malzemelerden biri daha sonra değiştirildi' }, 409);
    }
    for (const snapshot of before) {
      if (field === 'categoryId') await tx.update(materials).set({ categoryId: snapshot.value.categoryId as number | null }).where(eq(materials.id, snapshot.id));
      if (field === 'locationId') await tx.update(materials).set({ locationId: snapshot.value.locationId as number | null }).where(eq(materials.id, snapshot.id));
      if (field === 'publicVisibility') await tx.update(materials).set({ publicVisibility: snapshot.value.publicVisibility as string, isPublic: snapshot.value.isPublic as boolean }).where(eq(materials.id, snapshot.id));
    }
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.bulk.undo', entity: 'material', entityId: id, before: after.changes, after: before });
    return c.json({ ok: true, restoredCount: before.length });
  });
});
route.patch('/:id', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_update')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = materialUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Malzeme bilgileri geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const [item] = await tx.select().from(materials).where(eq(materials.id, id)).for('update').limit(1);
      if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
      if (item.archivedAt) return c.json({ error: 'Arşivlenmiş malzeme düzenlenemez' }, 409);
      if (input.data.kind !== item.kind) {
        if (!can(auth, 'inventory_change_item_type')) return c.json({ error: 'Malzeme türünü değiştirme yetkisi yok' }, 403);
        const [openLoan] = await tx.select({ id: loans.id }).from(loans).where(and(eq(loans.materialId, id), inArray(loans.status, ['open', 'partial']))).limit(1);
        if (openLoan) return c.json({ error: 'Açık teslimi bulunan malzemenin türü değiştirilemez' }, 409);
      }
      if (input.data.categoryId) {
        const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.data.categoryId)).limit(1);
        if (!category) return c.json({ error: 'Kategori bulunamadı' }, 400);
      }
      if (input.data.locationId) {
        const [location] = await tx.select({ id: locations.id }).from(locations).where(eq(locations.id, input.data.locationId)).limit(1);
        if (!location) return c.json({ error: 'Konum bulunamadı' }, 400);
      }
      const { minimumStock, publicVisibility, categoryId, locationId, ...fields } = input.data;
      const after = { ...fields, ...(categoryId !== undefined ? { categoryId } : {}), ...(locationId !== undefined ? { locationId } : {}), minimumStock: minimumStock == null ? null : minimumStock.toFixed(3), publicVisibility, isPublic: publicVisibility !== 'hidden' };
      await tx.update(materials).set(after).where(eq(materials.id, id));
      await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.material.updated', entity: 'material', entityId: id, before: { name: item.name, sku: item.sku, brand: item.brand, model: item.model, kind: item.kind, unit: item.unit, categoryId: item.categoryId, locationId: item.locationId, minimumStock: item.minimumStock, publicVisibility: item.publicVisibility, description: item.description, isActive: item.isActive }, after });
      return c.json({ ok: true });
    });
  } catch { return c.json({ error: 'Malzeme güncellenemedi; stok kodu başka kayıtta olabilir' }, 409); }
});
route.post('/:id/archive', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_archive')) return c.json({ error: 'Arşivleme yetkisi yok' }, 403);
  const id = Number(c.req.param('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: 'Malzeme kimliği geçersiz' }, 400);
  return db.transaction(async tx => {
    const [item] = await tx.select().from(materials).where(eq(materials.id, id)).for('update').limit(1);
    if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
    if (item.archivedAt) return c.json({ ok: true });
    await tx.update(materials).set({ isActive: false, archivedAt: new Date(), isPublic: false }).where(eq(materials.id, id));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.material.archived', entity: 'material', entityId: id, before: { isActive: item.isActive, archivedAt: item.archivedAt, isPublic: item.isPublic }, after: { isActive: false, archivedAt: new Date(), isPublic: false } });
    return c.json({ ok: true });
  });
});
route.post('/stock', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'inventory_adjust_stock')) return c.json({ error: 'Yetki yok' }, 403);
  const input = stockAdjustmentSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Stok hareketi geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const [item] = await tx.select().from(materials).where(eq(materials.id, input.data.materialId)).for('update').limit(1);
      if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
      if (!item.isActive || item.archivedAt) return c.json({ error: 'Pasif veya arşivlenmiş malzemenin stoku değiştirilemez' }, 409);
      const next = Number(item.quantity) + input.data.delta;
      if (next < 0 || !Number.isFinite(next)) return c.json({ error: 'Yetersiz stok' }, 409);
      const balance = next.toFixed(3);
      await tx.update(materials).set({ quantity: balance }).where(eq(materials.id, item.id));
      const [{ insertId }] = await tx.insert(stockMovements).values({ materialId: item.id, movementType: 'adjustment', delta: input.data.delta.toFixed(3), balanceAfter: balance, reason: input.data.reason, actorId: auth.user.id });
      return c.json({ id: insertId, balance }, 201);
    });
  } catch { return c.json({ error: 'Stok işlemi tamamlanamadı' }, 409); }
});
route.get('/loans', async c => {
  const auth = c.get('auth');
  const query = z.object({ id: z.coerce.number().int().positive().optional(), status: z.enum(['all', 'active', 'overdue', 'completed', 'damaged', 'lost', 'reversed']).default('all'), sort: z.enum(['issued_at', 'due_at', 'quantity', 'status']).default('issued_at'), direction: z.enum(['asc', 'desc']).default('desc'), page: z.coerce.number().int().min(1).max(100000).default(1) }).safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!query.success) return c.json({ error: 'Teslim listesi ölçütleri geçersiz' }, 400);
  const canManage = auth.permissions.includes('loans_view');
  const canSeeName = canManage && auth.permissions.includes('loans_view_personal_data');
  const canSeeEmail = canManage && auth.permissions.includes('loans_view_email');
  const privileged = canManage || auth.user.globalRole === 'super_admin';
  const status = query.data.status;
  const statusCondition = status === 'active' ? inArray(loans.status, ['open', 'partial']) : status === 'overdue' ? and(inArray(loans.status, ['open', 'partial']), isNotNull(loans.dueAt), lt(loans.dueAt, new Date())) : status === 'completed' ? inArray(loans.status, ['completed', 'returned']) : status === 'all' ? undefined : eq(loans.status, status);
  const where = and(privileged ? undefined : eq(loans.borrowerEmail, auth.user.email.toLowerCase()), statusCondition, query.data.id ? eq(loans.id, query.data.id) : undefined);
  const sortColumn = { issued_at: loans.issuedAt, due_at: loans.dueAt, quantity: loans.quantity, status: loans.status }[query.data.sort];
  const direction = query.data.direction === 'asc' ? asc : desc;
  const [totalRow] = await db.select({ total: count() }).from(loans).where(where);
  const visible = await db.select().from(loans).where(where).orderBy(direction(sortColumn), direction(loans.id)).limit(20).offset((query.data.page - 1) * 20);
  if (visible.length && (canSeeName || canSeeEmail)) await db.insert(activityLogs).values({ userId: auth.user.id, action: 'personal_data_viewed', metadata: { module: 'loans', recordCount: visible.length } });
  return c.json({ loans: visible.map(row => ({ ...row, borrowerFirstName: canSeeName && !row.anonymizedAt ? row.borrowerFirstName : null, borrowerLastName: canSeeName && !row.anonymizedAt ? row.borrowerLastName : null, borrowerNameOriginal: canSeeName && !row.anonymizedAt ? row.borrowerNameOriginal : null, borrowerEmail: canSeeEmail && !row.anonymizedAt ? row.borrowerEmail : null, notes: canSeeName && !row.anonymizedAt ? row.notes : null, closureNote: canSeeName && !row.anonymizedAt ? row.closureNote : null })), page: query.data.page, pageSize: 20, total: totalRow.total });
});
route.get('/loans/export.csv', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'loans_export') || !auth.permissions.includes('loans_view')) return c.json({ error: 'Yetki yok' }, 403);
  const showName = auth.permissions.includes('loans_view_personal_data');
  const showEmail = auth.permissions.includes('loans_view_email');
  await db.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.loans.exported', entity: 'loan', after: { showName, showEmail } });
  const stream = Readable.from((async function* () {
    yield `\uFEFF${loanCsvLine(loanCsvHeaders)}`;
    let cursor = 0;
    while (true) {
      const batch = await db.select({ loan: loans, materialName: materials.name }).from(loans).leftJoin(materials, eq(loans.materialId, materials.id)).where(gt(loans.id, cursor)).orderBy(asc(loans.id)).limit(500);
      if (!batch.length) break;
      for (const { loan, materialName } of batch) {
        yield loanCsvLine([loan.id, materialName, loan.itemType, loan.status, loan.quantity, loan.returnedQuantity, loan.issuedAt?.toISOString(), loan.dueAt?.toISOString(), loan.closedAt?.toISOString(), showName && !loan.anonymizedAt ? loan.borrowerNameOriginal || [loan.borrowerFirstName, loan.borrowerLastName].filter(Boolean).join(' ') : null, showEmail && !loan.anonymizedAt ? loan.borrowerEmail : null, showName && !loan.anonymizedAt ? loan.notes : null, showName && !loan.anonymizedAt ? loan.closureNote : null]);
      }
      cursor = batch[batch.length - 1].loan.id;
    }
  })());
  c.header('Content-Type', 'text/csv; charset=UTF-8');
  c.header('Content-Disposition', `attachment; filename="sparkoff-teslimler-${new Date().toISOString().slice(0, 10)}.csv"`);
  c.header('Cache-Control', 'no-store, private');
  c.header('X-Content-Type-Options', 'nosniff');
  return c.body(Readable.toWeb(stream) as ReadableStream);
});
route.post('/loans', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'loans_create')) return c.json({ error: 'Yetki yok' }, 403);
  const input = loanSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Teslim bilgileri geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const [item] = await tx.select().from(materials).where(eq(materials.id, input.data.materialId)).for('update').limit(1);
      if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
      if (!item.isActive || item.archivedAt) return c.json({ error: 'Pasif veya arşivlenmiş malzeme teslim edilemez' }, 409);
      if (item.kind === 'loanable' && !input.data.dueAt) return c.json({ error: 'Ödünç malzeme için iade tarihi gerekli' }, 400);
      if (input.data.dueAt && new Date(input.data.dueAt).getTime() <= Date.now()) return c.json({ error: 'Beklenen iade tarihi gelecekte olmalı' }, 400);
      const active = item.kind === 'equipment' ? await tx.select().from(loans).where(eq(loans.materialId, item.id)) : [];
      const available = availableQuantity(item.kind, item.quantity, active);
      if (Number(available) < input.data.quantity) return c.json({ error: 'Yetersiz stok' }, 409);
      const balance = item.kind === 'equipment' ? item.quantity : (Number(item.quantity) - input.data.quantity).toFixed(3);
      const [{ insertId }] = await tx.insert(loans).values({ materialId: item.id, borrowerFirstName: input.data.firstName, borrowerLastName: input.data.lastName, borrowerEmail: input.data.email?.toLowerCase() || null, quantity: input.data.quantity.toFixed(3), dueAt: item.kind === 'loanable' && input.data.dueAt ? new Date(input.data.dueAt) : null, issuedBy: auth.user.id, issuedAt: new Date(), itemType: item.kind, notes: input.data.notes || null, status: item.kind === 'consumable' ? 'completed' : 'open', closedAt: item.kind === 'consumable' ? new Date() : null });
      if (item.kind !== 'equipment') {
        await tx.update(materials).set({ quantity: balance }).where(eq(materials.id, item.id));
        await tx.insert(stockMovements).values({ materialId: item.id, movementType: 'delivery', delta: (-input.data.quantity).toFixed(3), balanceAfter: balance, reason: `Teslim #${insertId}`, actorId: auth.user.id, sourceType: 'loan', sourceId: insertId });
      }
      await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.loan.issued', entity: 'loan', entityId: insertId, after: { materialId: item.id, itemType: item.kind, quantity: input.data.quantity, dueAt: input.data.dueAt || null, status: item.kind === 'consumable' ? 'completed' : 'open' } });
      return c.json({ id: insertId, balance, availableQuantity: item.kind === 'equipment' ? (Number(available) - input.data.quantity).toFixed(3) : balance }, 201);
    });
  } catch { return c.json({ error: 'Teslim tamamlanamadı' }, 409); }
});
route.patch('/loans/:id/due-date', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'loans_extend_due_date')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = z.object({ dueAt: z.iso.datetime() }).safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Beklenen iade tarihi geçersiz' }, 400);
  const dueAt = new Date(input.data.dueAt);
  dueAt.setUTCSeconds(0, 0);
  if (dueAt.getTime() <= Date.now()) return c.json({ error: 'Beklenen iade tarihi gelecekte olmalı' }, 400);
  return db.transaction(async tx => {
    const [loan] = await tx.select({ id: loans.id, itemType: loans.itemType, status: loans.status, dueAt: loans.dueAt }).from(loans).where(eq(loans.id, id)).for('update').limit(1);
    if (!loan) return c.json({ error: 'Teslim bulunamadı' }, 404);
    if (loan.itemType !== 'loanable' || !['open', 'partial'].includes(loan.status) || !loan.dueAt) return c.json({ error: 'Yalnız açık ödünç kaydının tarihi uzatılabilir' }, 409);
    if (dueAt <= loan.dueAt) return c.json({ error: 'Yeni tarih mevcut tarihten ileri olmalı' }, 409);
    await tx.update(loans).set({ dueAt }).where(eq(loans.id, id));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.loan.due_date_extended', entity: 'loan', entityId: id, before: { dueAt: loan.dueAt.toISOString() }, after: { dueAt: dueAt.toISOString() } });
    return c.json({ ok: true, dueAt: dueAt.toISOString() });
  });
});
route.post('/loans/:id/return', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'loans_receive_return')) return c.json({ error: 'Yetki yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = returnSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || !input.success) return c.json({ error: 'İade bilgileri geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const [loan] = await tx.select().from(loans).where(eq(loans.id, id)).for('update').limit(1);
      if (!loan) return c.json({ error: 'Teslim bulunamadı' }, 404);
      const [item] = await tx.select().from(materials).where(eq(materials.id, loan.materialId)).for('update').limit(1);
      if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
      if (loan.status !== 'open' && loan.status !== 'partial') return c.json({ error: 'Teslim kapalı' }, 409);
      if (input.data.condition === 'damaged' && !auth.permissions.includes('loans_report_damage') || input.data.condition === 'lost' && !auth.permissions.includes('loans_report_lost')) return c.json({ error: 'Hasar veya kayıp kapatma yetkisi yok' }, 403);
      const outstanding = Number(loan.quantity) - Number(loan.returnedQuantity);
      if (input.data.quantity > outstanding + 0.000001) return c.json({ error: 'İade miktarı fazla' }, 409);
      if (input.data.condition !== 'ok' && Math.abs(input.data.quantity - outstanding) > 0.000001) return c.json({ error: 'Hasarlı veya kayıp kapanış tüm kalan miktarı kapsamalı' }, 409);
      if (input.data.condition !== 'ok') {
        if (item.kind === 'equipment') {
          const balance = (Number(item.quantity) - outstanding).toFixed(3);
          if (Number(balance) < 0) return c.json({ error: 'Yetersiz stok' }, 409);
          await tx.update(materials).set({ quantity: balance }).where(eq(materials.id, item.id));
          await tx.insert(stockMovements).values({ materialId: item.id, movementType: 'adjustment', delta: (-outstanding).toFixed(3), balanceAfter: balance, reason: `Demirbaş ${input.data.condition} #${id}`, actorId: auth.user.id, sourceType: 'loan', sourceId: id });
        }
        await tx.update(loans).set({ status: input.data.condition, closedAt: new Date(), closedBy: auth.user.id, closureNote: input.data.note }).where(eq(loans.id, id));
        await tx.insert(auditLogs).values({ actorId: auth.user.id, action: `inventory.loan.${input.data.condition}`, entity: 'loan', entityId: id, before: { status: loan.status, returnedQuantity: loan.returnedQuantity }, after: { status: input.data.condition } });
        return c.json({ ok: true, status: input.data.condition });
      }
      const returned = Number(loan.returnedQuantity) + input.data.quantity;
      const closed = Math.abs(returned - Number(loan.quantity)) < 0.000001;
      await tx.update(loans).set({ returnedQuantity: returned.toFixed(3), status: closed ? 'returned' : 'partial', closedAt: closed ? new Date() : null, closedBy: closed ? auth.user.id : null, ...(input.data.note ? { closureNote: input.data.note } : {}) }).where(eq(loans.id, id));
      if (item.kind === 'loanable') {
        const balance = Number(item.quantity) + input.data.quantity;
        await tx.update(materials).set({ quantity: balance.toFixed(3) }).where(eq(materials.id, item.id));
        await tx.insert(stockMovements).values({ materialId: item.id, movementType: 'return', delta: input.data.quantity.toFixed(3), balanceAfter: balance.toFixed(3), reason: `İade #${id}`, actorId: auth.user.id, sourceType: 'loan', sourceId: id });
      }
      await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.loan.returned', entity: 'loan', entityId: id, before: { status: loan.status, returnedQuantity: loan.returnedQuantity }, after: { status: closed ? 'returned' : 'partial', returnedQuantity: returned.toFixed(3) } });
      return c.json({ ok: true, status: closed ? 'returned' : 'partial' });
    });
  } catch { return c.json({ error: 'İade tamamlanamadı' }, 409); }
});
route.post('/loans/:id/reverse', async c => {
  const auth = c.get('auth');
  if (!can(auth, 'loans_reverse_transaction')) return c.json({ error: 'Teslimi geri alma yetkisi yok' }, 403);
  const id = Number(c.req.param('id'));
  const input = z.object({ reason: z.string().trim().min(5).max(450) }).safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(id) || id <= 0 || !input.success) return c.json({ error: 'Geri alma bilgileri geçersiz' }, 400);
  return db.transaction(async tx => {
    const [loan] = await tx.select().from(loans).where(eq(loans.id, id)).for('update').limit(1);
    if (!loan) return c.json({ error: 'Teslim bulunamadı' }, 404);
    if (loan.anonymizedAt || Number(loan.returnedQuantity) > 0 || loan.status !== (loan.itemType === 'consumable' ? 'completed' : 'open')) return c.json({ error: 'Yalnız değiştirilmemiş teslim geri alınabilir' }, 409);
    const [item] = await tx.select().from(materials).where(eq(materials.id, loan.materialId)).for('update').limit(1);
    if (!item) return c.json({ error: 'Malzeme bulunamadı' }, 404);
    const related = await tx.select().from(stockMovements).where(and(eq(stockMovements.sourceType, 'loan'), eq(stockMovements.sourceId, id))).orderBy(stockMovements.id).for('update');
    if (loan.itemType === 'equipment') {
      if (related.length) return c.json({ error: 'Demirbaş tesliminin stok hareketi değişmiş' }, 409);
    } else {
      if (related.length !== 1 || related[0].movementType !== 'delivery') return c.json({ error: 'Teslimin stok hareketleri değişmiş' }, 409);
      const delivery = related[0];
      const [reversed] = await tx.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.reversedMovementId, delivery.id)).limit(1);
      if (reversed) return c.json({ error: 'Teslim daha önce geri alınmış' }, 409);
      const next = Math.round(Number(item.quantity) * 1000) - Math.round(Number(delivery.delta) * 1000);
      if (next < 0 || next > 9_999_999_999_999) return c.json({ error: 'Stok bakiyesi geçersiz' }, 409);
      const balance = (next / 1000).toFixed(3);
      await tx.update(materials).set({ quantity: balance }).where(eq(materials.id, item.id));
      await tx.insert(stockMovements).values({ materialId: item.id, movementType: 'reversal', delta: (-Number(delivery.delta)).toFixed(3), balanceAfter: balance, reason: `Teslim geri alındı #${id}`, actorId: auth.user.id, reversedMovementId: delivery.id, sourceType: 'stock_movement', sourceId: delivery.id });
    }
    await tx.update(loans).set({ status: 'reversed', closedAt: new Date(), closedBy: auth.user.id, closureNote: input.data.reason }).where(eq(loans.id, id));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'inventory.loan.reversed', entity: 'loan', entityId: id, before: { status: loan.status, returnedQuantity: loan.returnedQuantity }, after: { status: 'reversed' } });
    return c.json({ ok: true, status: 'reversed' });
  });
});
export default route;
