import { Hono } from 'hono';
import { and, asc, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { clearAttempts, countAttempt, limitKey } from '../rate-limit.js';
import { activationCodes, activationSchema, auditLogs, categories, customRoleSchema, customRoles, loginSchema, memberships, sessions, unitSchema, units, userCustomRoles, users } from '../../shared/schema.js';
import { canAccessChannel, canManageUnit, hashPassword, issueSession, requireAuth, revokeSession, verifyPassword, type AppEnv } from '../auth.js';

const org = new Hono<AppEnv>();
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
org.post('/login', async c => {
  const input = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Giriş bilgileri geçersiz' }, 400);
  const key = limitKey('login', input.data.email);
  if (!(await countAttempt(key, 12, 900))) return c.json({ error: 'Çok fazla giriş denemesi; daha sonra tekrar deneyin' }, 429);
  const [user] = await db.select().from(users).where(eq(users.email, input.data.email.toLowerCase())).limit(1);
  if (!user || !user.isActive || !(await verifyPassword(input.data.password, user.passwordHash))) return c.json({ error: 'E-posta veya parola yanlış' }, 401);
  if (user.passwordHash.startsWith('$2')) {
    const upgraded = await db.update(users).set({ passwordHash: await hashPassword(input.data.password) }).where(and(eq(users.id, user.id), eq(users.passwordHash, user.passwordHash)));
    if (upgraded[0].affectedRows !== 1) {
      const [current] = await db.select({ passwordHash: users.passwordHash, isActive: users.isActive }).from(users).where(eq(users.id, user.id)).limit(1);
      if (!current?.isActive || !(await verifyPassword(input.data.password, current.passwordHash))) return c.json({ error: 'E-posta veya parola yanlış' }, 401);
    }
  }
  await clearAttempts(key);
  const csrfToken = await issueSession(c, user.id);
  return c.json({ csrfToken, user: { id: user.id, name: user.name, role: user.globalRole } });
});
org.post('/activate', async c => {
  const input = activationSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Aktivasyon bilgileri geçersiz' }, 400);
  if (!(await countAttempt(limitKey('activate', input.data.email), 10, 900))) return c.json({ error: 'Çok fazla aktivasyon denemesi; daha sonra tekrar deneyin' }, 429);
  try {
    const userId = await db.transaction(async tx => {
      const [code] = await tx.select().from(activationCodes).where(and(eq(activationCodes.codeHash, digest(input.data.code)), isNull(activationCodes.usedAt), gt(activationCodes.expiresAt, new Date()))).for('update').limit(1);
      if (!code) throw new Error('invalid-code');
      const [assignedRole] = code.customRoleId ? await tx.select({ id: customRoles.id, isSystem: customRoles.isSystem }).from(customRoles).where(eq(customRoles.id, code.customRoleId)).limit(1) : [];
      if (!assignedRole || assignedRole.isSystem) throw new Error('invalid-code');
      const email = input.data.email.trim().toLowerCase();
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) throw new Error('email-exists');
      const [{ insertId }] = await tx.insert(users).values({ name: input.data.name, email, passwordHash: await hashPassword(input.data.password), globalRole: code.role });
      await tx.insert(userCustomRoles).values({ userId: insertId, roleId: assignedRole.id });
      if (code.unitId) await tx.insert(memberships).values({ userId: insertId, unitId: code.unitId, role: code.role === 'lead' ? 'lead' : code.role === 'advisor' ? 'advisor' : 'member' });
      await tx.update(activationCodes).set({ usedAt: new Date() }).where(eq(activationCodes.id, code.id));
      return insertId;
    });
    const csrfToken = await issueSession(c, userId);
    return c.json({ csrfToken, userId }, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message === 'email-exists' ? 'E-posta zaten kayıtlı' : 'Kod geçersiz veya süresi dolmuş' }, 400);
  }
});
org.use('*', requireAuth);
org.get('/me', async c => {
  const { user, scopes, tabs, permissions } = c.get('auth');
  return c.json({ user: { id: user.id, name: user.name, email: user.email, role: user.globalRole, preferences: user.preferences }, scopes, tabs, permissions });
});
const interfaceSchema = z.strictObject({
  theme: z.enum(['light', 'dark', 'system']),
  scale: z.enum(['small', 'normal', 'large']),
  density: z.enum(['comfortable', 'normal', 'compact']),
  sidebar: z.enum(['wide', 'narrow']),
});
const savedFilterSchemas = {
  inventory: z.strictObject({ search: z.string().max(100), categoryId: z.number().int().nonnegative(), kind: z.enum(['', 'consumable', 'loanable', 'equipment']), status: z.enum(['all', 'active', 'inactive', 'low', 'out', 'archived']) }),
  loans: z.strictObject({ status: z.enum(['active', 'overdue', 'completed', 'damaged', 'lost', 'reversed']) }),
  appointments: z.strictObject({ search: z.string().max(100), status: z.enum(['', 'pending_verification', 'pending_approval', 'change_requested', 'approved', 'ready', 'printing', 'completed', 'failed', 'rejected', 'canceled', 'expired']) }),
  feedback: z.strictObject({ status: z.enum(['', 'open', 'new', 'reviewing', 'resolved', 'archived']) }),
} as const;
type SavedTable = keyof typeof savedFilterSchemas;
type SavedEntry = { id: string; name: string; filters: Record<string, unknown> };
const filterPermissions: Record<SavedTable, string> = { inventory: 'inventory_view', loans: 'loans_view', appointments: 'appointments_view', feedback: 'feedback_view' };
const tableColumns = {
  inventory: { name: null, brand: null, model: null, category: null, location: null, quantity: null, visibility: null },
  loans: { item: null, recipient: 'loans_view_personal_data', quantity: null, issued_at: null, due_at: null, status: null },
  appointments: { applicant: 'appointments_view_personal_data', starts_at: null, duration: null, printer: null, status: null },
  feedback: { type: null, message: null, status: null, created_at: null, handler: null },
  users: { name: null, email: null, roles: null, status: null },
} as const;
type ColumnTable = keyof typeof tableColumns;
const columnPermissions: Record<ColumnTable, string> = { inventory: 'inventory_view', loans: 'loans_view', appointments: 'appointments_view', feedback: 'feedback_view', users: 'users_view' };
const columnTable = (value: string): ColumnTable | null => Object.hasOwn(tableColumns, value) ? value as ColumnTable : null;
function allowedTableColumns(table: ColumnTable, permissions: readonly string[]): string[] {
  return Object.entries(tableColumns[table]).filter(([, required]) => !required || permissions.includes(required)).map(([name]) => name);
}
function effectiveTableColumns(preferences: Record<string, unknown>, table: ColumnTable, allowed: string[]): string[] {
  const active = asObject(preferences.tableColumns);
  const source = Object.hasOwn(active, table) ? active[table] : asObject(asObject(preferences.v1).tablePreferences)[table];
  if (!Array.isArray(source)) return allowed;
  const valid = source.filter((key): key is string => typeof key === 'string' && allowed.includes(key));
  return valid.length ? [...new Set(valid)] : allowed;
}
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const savedTable = (value: string): SavedTable | null => Object.hasOwn(savedFilterSchemas, value) ? value as SavedTable : null;
org.get('/preferences/table-columns/:table', async c => {
  const table = columnTable(c.req.param('table'));
  if (!table) return c.json({ error: 'Liste bulunamadı' }, 404);
  const auth = c.get('auth');
  if (!auth.permissions.includes(columnPermissions[table] as typeof auth.permissions[number])) return c.json({ error: 'Yetki yok' }, 403);
  const [user] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, auth.user.id)).limit(1);
  const allowed = allowedTableColumns(table, auth.permissions);
  return c.json({ columns: effectiveTableColumns(user?.preferences ?? {}, table, allowed), allowed });
});
org.put('/preferences/table-columns/:table', async c => {
  const table = columnTable(c.req.param('table'));
  if (!table) return c.json({ error: 'Liste bulunamadı' }, 404);
  const auth = c.get('auth');
  if (!auth.permissions.includes(columnPermissions[table] as typeof auth.permissions[number])) return c.json({ error: 'Yetki yok' }, 403);
  const input = z.strictObject({ columns: z.array(z.string()).min(1).max(12).refine(columns => new Set(columns).size === columns.length) }).safeParse(await c.req.json().catch(() => null));
  const allowed = allowedTableColumns(table, auth.permissions);
  if (!input.success || input.data.columns.some(column => !allowed.includes(column))) return c.json({ error: 'Sütun seçimi geçersiz' }, 400);
  const preferences = await db.transaction(async tx => {
    const [user] = await tx.select({ preferences: users.preferences }).from(users).where(eq(users.id, auth.user.id)).for('update').limit(1);
    const current = user?.preferences ?? {};
    const updated = { ...current, tableColumns: { ...asObject(current.tableColumns), [table]: input.data.columns } };
    await tx.update(users).set({ preferences: updated }).where(eq(users.id, auth.user.id));
    return updated;
  });
  return c.json({ columns: input.data.columns, preferences });
});
async function effectiveSavedFilters(preferences: Record<string, unknown>, table: SavedTable): Promise<SavedEntry[]> {
  const active = asObject(preferences.savedFilters);
  const source = Object.hasOwn(active, table) ? active[table] : asObject(asObject(preferences.v1).savedFilters)[table];
  if (!Array.isArray(source)) return [];
  const categoryMap = table === 'inventory' ? new Map((await db.select({ id: categories.id, legacyId: categories.legacyCategoryId }).from(categories)).map(row => [row.legacyId, row.id])) : new Map<number | null, number>();
  const result: SavedEntry[] = [];
  for (const raw of source.slice(0, 10)) {
    const entry = asObject(raw); const filters = asObject(entry.filters);
    if (typeof entry.id !== 'string' || !z.uuid().safeParse(entry.id).success || typeof entry.name !== 'string' || entry.name.trim().length < 2 || entry.name.trim().length > 40) continue;
    const normalized: Record<string, unknown> = table === 'inventory' && !Object.hasOwn(filters, 'categoryId')
      ? { search: filters.search || '', categoryId: typeof filters.category === 'string' && /^\d+$/.test(filters.category) && Number(filters.category) > 0 ? categoryMap.get(Number(filters.category)) || 0 : 0, kind: filters.type === 'fixed_asset' ? 'equipment' : filters.type || '', status: filters.status || 'active' }
      : table === 'appointments' ? { search: filters.search || '', status: filters.status || '' }
      : table === 'feedback' ? { status: filters.status || '' }
      : filters;
    const parsed = savedFilterSchemas[table].safeParse(normalized);
    if (parsed.success) result.push({ id: entry.id, name: entry.name.trim(), filters: parsed.data });
  }
  return result;
}
org.get('/preferences/saved-filters/:table', async c => {
  const table = savedTable(c.req.param('table'));
  if (!table) return c.json({ error: 'Liste bulunamadı' }, 404);
  const auth = c.get('auth');
  if (!auth.permissions.includes(filterPermissions[table] as typeof auth.permissions[number])) return c.json({ error: 'Yetki yok' }, 403);
  const [user] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, auth.user.id)).limit(1);
  return c.json({ filters: await effectiveSavedFilters(user?.preferences ?? {}, table) });
});
org.post('/preferences/saved-filters/:table', async c => {
  const table = savedTable(c.req.param('table'));
  if (!table) return c.json({ error: 'Liste bulunamadı' }, 404);
  const auth = c.get('auth');
  if (!auth.permissions.includes(filterPermissions[table] as typeof auth.permissions[number])) return c.json({ error: 'Yetki yok' }, 403);
  const input = z.strictObject({ name: z.string().trim().min(2).max(40), filters: savedFilterSchemas[table] }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Filtre bilgileri geçersiz' }, 400);
  if (table === 'inventory' && 'categoryId' in input.data.filters && input.data.filters.categoryId && !(await db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.data.filters.categoryId)).limit(1)).length) return c.json({ error: 'Kategori bulunamadı' }, 400);
  return db.transaction(async tx => {
    const [user] = await tx.select({ preferences: users.preferences }).from(users).where(eq(users.id, auth.user.id)).for('update').limit(1);
    const current = user?.preferences ?? {};
    const entries = await effectiveSavedFilters(current, table);
    const index = entries.findIndex(entry => entry.name.toLocaleLowerCase('tr-TR') === input.data.name.toLocaleLowerCase('tr-TR'));
    if (index < 0 && entries.length >= 10) return c.json({ error: 'Her liste için en fazla 10 filtre kaydedilebilir' }, 409);
    const entry = { id: index < 0 ? randomUUID() : entries[index].id, name: input.data.name, filters: input.data.filters };
    if (index < 0) entries.push(entry); else entries[index] = entry;
    await tx.update(users).set({ preferences: { ...current, savedFilters: { ...asObject(current.savedFilters), [table]: entries } } }).where(eq(users.id, auth.user.id));
    return c.json({ filters: entries, savedId: entry.id }, index < 0 ? 201 : 200);
  });
});
org.delete('/preferences/saved-filters/:table/:id', async c => {
  const table = savedTable(c.req.param('table'));
  if (!table || !z.uuid().safeParse(c.req.param('id')).success) return c.json({ error: 'Filtre bulunamadı' }, 404);
  const auth = c.get('auth');
  if (!auth.permissions.includes(filterPermissions[table] as typeof auth.permissions[number])) return c.json({ error: 'Yetki yok' }, 403);
  return db.transaction(async tx => {
    const [user] = await tx.select({ preferences: users.preferences }).from(users).where(eq(users.id, auth.user.id)).for('update').limit(1);
    const current = user?.preferences ?? {};
    const entries = await effectiveSavedFilters(current, table);
    if (!entries.some(entry => entry.id === c.req.param('id'))) return c.json({ error: 'Filtre bulunamadı' }, 404);
    const filtered = entries.filter(entry => entry.id !== c.req.param('id'));
    await tx.update(users).set({ preferences: { ...current, savedFilters: { ...asObject(current.savedFilters), [table]: filtered } } }).where(eq(users.id, auth.user.id));
    return c.json({ filters: filtered });
  });
});
org.patch('/preferences/interface', async c => {
  const input = interfaceSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Görünüm ayarları geçersiz' }, 400);
  const userId = c.get('auth').user.id;
  const preferences = await db.transaction(async tx => {
    const [user] = await tx.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).for('update').limit(1);
    const current = user?.preferences ?? {};
    const updated = { ...current, interface: input.data };
    await tx.update(users).set({ preferences: updated }).where(eq(users.id, userId));
    return updated;
  });
  return c.json({ ok: true, preferences });
});
org.delete('/preferences', async c => {
  const userId = c.get('auth').user.id;
  const preferences = await db.transaction(async tx => {
    const [user] = await tx.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).for('update').limit(1);
    const reset = { ...(user?.preferences ?? {}), interface: null, savedFilters: { inventory: [], loans: [], appointments: [], feedback: [] }, tableColumns: { inventory: [], loans: [], appointments: [], feedback: [], users: [] } };
    await tx.update(users).set({ preferences: reset }).where(eq(users.id, userId));
    return reset;
  });
  return c.json({ ok: true, preferences });
});
org.post('/logout', async c => { await revokeSession(c); return c.json({ ok: true }); });
org.patch('/password', async c => {
  const auth = c.get('auth');
  const input = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12).max(256).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/) }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Yeni parola en az 12 karakter, büyük/küçük harf ve rakam içermeli' }, 400);
  if (!(await verifyPassword(input.data.currentPassword, auth.user.passwordHash))) return c.json({ error: 'Mevcut parola yanlış' }, 403);
  await db.update(users).set({ passwordHash: await hashPassword(input.data.newPassword) }).where(eq(users.id, auth.user.id));
  await db.delete(sessions).where(eq(sessions.userId, auth.user.id));
  await revokeSession(c);
  return c.json({ ok: true, loginRequired: true });
});
org.post('/activation-codes', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('users_create') || !auth.permissions.includes('roles_assign')) return c.json({ error: 'Yetki yok' }, 403);
  const body = await c.req.json().catch(() => null);
  const role = body?.role;
  const unitId = body?.unitId === null || body?.unitId === undefined ? null : Number(body.unitId);
  const customRoleId = Number(body?.customRoleId);
  if (!['member', 'lead', 'advisor'].includes(role) || (unitId !== null && !Number.isSafeInteger(unitId)) || !Number.isSafeInteger(customRoleId) || customRoleId <= 0) return c.json({ error: 'Kod ayarları geçersiz' }, 400);
  if (auth.user.globalRole !== 'super_admin' && (role !== 'member' || unitId === null || !canManageUnit(auth, unitId))) return c.json({ error: 'Birim veya rol yetkisi yok' }, 403);
  const [assignedRole] = await db.select({ id: customRoles.id, isSystem: customRoles.isSystem }).from(customRoles).where(eq(customRoles.id, customRoleId)).limit(1);
  if (!assignedRole || assignedRole.isSystem) return c.json({ error: 'Aktivasyon için geçerli bir rol seçin' }, 400);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join('');
  await db.insert(activationCodes).values({ codeHash: digest(code), role, customRoleId, unitId, expiresAt: new Date(Date.now() + 7 * 86400_000) });
  return c.json({ code, expiresInDays: 7 }, 201);
});
org.get('/units', async c => {
  const auth = c.get('auth');
  const all = await db.select().from(units);
  return c.json({ units: all.filter(unit => unit.isGeneral ? canAccessChannel(auth, unit.id, true) : canAccessChannel(auth, unit.id) || auth.scopes.viewIds.includes(unit.id)) });
});
org.post('/units', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('units_manage')) return c.json({ error: 'Yetki yok' }, 403);
  const input = unitSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Birim bilgileri geçersiz' }, 400);
  if (auth.user.globalRole !== 'super_admin' && (!input.data.parentId || !canManageUnit(auth, input.data.parentId))) return c.json({ error: 'Yetki yok' }, 403);
  if (input.data.isRoom && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Oda oluşturma yetkisi yok' }, 403);
  if (input.data.isGeneral && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Genel kanal oluşturma yetkisi yok' }, 403);
  const [{ insertId }] = await db.insert(units).values({ name: input.data.name, parentId: input.data.parentId || null, isRoom: input.data.isRoom, isGeneral: input.data.isGeneral });
  return c.json({ id: insertId }, 201);
});
org.get('/members', async c => {
  const auth = c.get('auth');
  if (!auth.tabs.includes('members') || !auth.permissions.includes('users_view')) return c.json({ error: 'Yetki yok' }, 403);
  const sorting = z.object({ user_sort: z.enum(['name', 'email', 'is_active', 'created_at']).default('name'), user_direction: z.enum(['asc', 'desc']).default('asc') }).safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!sorting.success) return c.json({ error: 'Kullanıcı sıralaması geçersiz' }, 400);
  const sortColumn = { name: users.name, email: users.email, is_active: users.isActive, created_at: users.createdAt }[sorting.data.user_sort];
  const sort = sorting.data.user_direction === 'asc' ? asc : desc;
  const [people, membershipsList, roleLinks] = await Promise.all([db.select({ id: users.id, name: users.name, email: users.email, globalRole: users.globalRole, customRoleId: users.customRoleId, isActive: users.isActive }).from(users).orderBy(sort(sortColumn), asc(users.id)), db.select().from(memberships), db.select().from(userCustomRoles)]);
  const visible = new Set([...auth.scopes.manageIds, ...auth.scopes.viewIds]);
  const isAll = auth.permissions.includes('users_view');
  return c.json({ members: people.filter(person => isAll || membershipsList.some(m => m.userId === person.id && visible.has(m.unitId))).map(person => ({ ...person, roleIds: roleLinks.filter(link => link.userId === person.id).map(link => link.roleId), email: isAll || auth.permissions.includes('view_pii') ? person.email : null, memberships: membershipsList.filter(m => m.userId === person.id && (isAll || visible.has(m.unitId))) })) });
});
org.patch('/members/:id/profile', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('users_update')) return c.json({ error: 'Yetki yok' }, 403);
  const userId = Number(c.req.param('id'));
  const input = z.object({ name: z.string().trim().min(2).max(120), email: z.email().max(255).transform(value => value.trim().toLowerCase()) }).safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(userId) || userId <= 0 || !input.success) return c.json({ error: 'Kullanıcı bilgileri geçersiz' }, 400);
  try {
    return await db.transaction(async tx => {
      const [person] = await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1);
      if (!person) return c.json({ error: 'Üye bulunamadı' }, 404);
      const [systemRole] = await tx.select({ id: customRoles.id }).from(userCustomRoles).innerJoin(customRoles, eq(userCustomRoles.roleId, customRoles.id)).where(and(eq(userCustomRoles.userId, userId), eq(customRoles.isSystem, true))).limit(1);
      if ((person.globalRole === 'super_admin' || systemRole) && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Yönetici hesabı yalnız sistem yöneticisi tarafından değiştirilebilir' }, 403);
      const emailChanged = person.email !== input.data.email;
      if (person.name === input.data.name && !emailChanged) return c.json({ ok: true, loginRequired: false });
      await tx.update(users).set({ name: input.data.name, email: input.data.email }).where(eq(users.id, userId));
      if (emailChanged) await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'user.profile.updated', entity: 'user', entityId: userId, before: { nameChanged: person.name !== input.data.name, emailChanged }, after: { sessionsRevoked: emailChanged } });
      return c.json({ ok: true, loginRequired: emailChanged });
    });
  } catch { return c.json({ error: 'E-posta başka hesapta kullanılıyor' }, 409); }
});
org.patch('/members/:id/active', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('users_disable')) return c.json({ error: 'Yetki yok' }, 403);
  const userId = Number(c.req.param('id'));
  const input = z.object({ isActive: z.boolean() }).safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(userId) || userId <= 0 || !input.success) return c.json({ error: 'Hesap durumu geçersiz' }, 400);
  return db.transaction(async tx => {
    const activeSystemAdmins = await tx.select({ id: users.id }).from(users)
      .leftJoin(userCustomRoles, eq(userCustomRoles.userId, users.id)).leftJoin(customRoles, eq(customRoles.id, userCustomRoles.roleId))
      .where(and(eq(users.isActive, true), or(eq(customRoles.isSystem, true), and(eq(users.globalRole, 'super_admin'), isNull(users.legacyUserId), isNull(userCustomRoles.userId)))))
      .orderBy(users.id).for('update');
    const [person] = await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1);
    if (!person) return c.json({ error: 'Üye bulunamadı' }, 404);
    const [systemRole] = await tx.select({ id: customRoles.id }).from(userCustomRoles).innerJoin(customRoles, eq(userCustomRoles.roleId, customRoles.id)).where(and(eq(userCustomRoles.userId, userId), eq(customRoles.isSystem, true))).limit(1);
    if ((person.globalRole === 'super_admin' || systemRole) && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Yönetici hesabı yalnız sistem yöneticisi tarafından değiştirilebilir' }, 403);
    if (!input.data.isActive && person.isActive && activeSystemAdmins.some(admin => admin.id === userId) && new Set(activeSystemAdmins.map(admin => admin.id)).size <= 1) return c.json({ error: 'Son sistem yöneticisi pasifleştirilemez' }, 409);
    if (person.isActive === input.data.isActive) return c.json({ ok: true, isActive: person.isActive });
    await tx.update(users).set({ isActive: input.data.isActive }).where(eq(users.id, userId));
    if (!input.data.isActive) await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: input.data.isActive ? 'user.activated' : 'user.disabled', entity: 'user', entityId: userId, before: { isActive: person.isActive }, after: { isActive: input.data.isActive } });
    return c.json({ ok: true, isActive: input.data.isActive });
  });
});
org.patch('/members/:id/password', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('users_reset_password')) return c.json({ error: 'Yetki yok' }, 403);
  const userId = Number(c.req.param('id'));
  const input = z.object({ newPassword: z.string().min(12).max(256).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/) }).safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(userId) || userId <= 0 || !input.success) return c.json({ error: 'Yeni parola en az 12 karakter, büyük/küçük harf ve rakam içermeli' }, 400);
  if (userId === auth.user.id) return c.json({ error: 'Kendi parolanızı profilinizden değiştirin' }, 409);
  const newHash = await hashPassword(input.data.newPassword);
  return db.transaction(async tx => {
    const [person] = await tx.select({ id: users.id, globalRole: users.globalRole }).from(users).where(eq(users.id, userId)).for('update').limit(1);
    if (!person) return c.json({ error: 'Üye bulunamadı' }, 404);
    const [systemRole] = await tx.select({ id: customRoles.id }).from(userCustomRoles).innerJoin(customRoles, eq(userCustomRoles.roleId, customRoles.id)).where(and(eq(userCustomRoles.userId, userId), eq(customRoles.isSystem, true))).limit(1);
    if ((person.globalRole === 'super_admin' || systemRole) && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Yönetici parolası yalnız sistem yöneticisi tarafından değiştirilebilir' }, 403);
    await tx.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'user.password.reset', entity: 'user', entityId: userId, after: { sessionsRevoked: true } });
    return c.json({ ok: true, loginRequired: true });
  });
});
org.get('/roles', async c => {
  if (!c.get('auth').permissions.includes('roles_view') && !c.get('auth').permissions.includes('roles_assign')) return c.json({ error: 'Yetki yok' }, 403);
  const sorting = z.object({ role_sort: z.enum(['name', 'users_count', 'created_at']).default('name'), role_direction: z.enum(['asc', 'desc']).default('asc') }).safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!sorting.success) return c.json({ error: 'Rol sıralaması geçersiz' }, 400);
  const [roleRows, links] = await Promise.all([db.select().from(customRoles), db.select({ roleId: userCustomRoles.roleId }).from(userCustomRoles)]);
  const counts = new Map<number, number>();
  for (const link of links) counts.set(link.roleId, (counts.get(link.roleId) || 0) + 1);
  const roles = roleRows.map(role => ({ ...role, userCount: counts.get(role.id) || 0 }));
  const factor = sorting.data.role_direction === 'asc' ? 1 : -1;
  roles.sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || factor * (sorting.data.role_sort === 'users_count' ? a.userCount - b.userCount : sorting.data.role_sort === 'created_at' ? a.createdAt.getTime() - b.createdAt.getTime() : a.name.localeCompare(b.name, 'tr')) || a.id - b.id);
  return c.json({ roles });
});
org.post('/members', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('users_create') || !auth.permissions.includes('roles_assign')) return c.json({ error: 'Yetki yok' }, 403);
  const input = z.object({ name: z.string().trim().min(2).max(120), email: z.email().max(255).transform(value => value.trim().toLowerCase()), password: z.string().min(12).max(256).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/), roleIds: z.array(z.number().int().positive()).min(1).max(20).refine(ids => new Set(ids).size === ids.length) }).safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Kullanıcı bilgileri veya roller geçersiz' }, 400);
  const passwordHash = await hashPassword(input.data.password);
  try {
    return await db.transaction(async tx => {
      const assignedRoles = await tx.select({ id: customRoles.id, isSystem: customRoles.isSystem }).from(customRoles).where(inArray(customRoles.id, input.data.roleIds)).orderBy(customRoles.id).for('update');
      if (assignedRoles.length !== input.data.roleIds.length) return c.json({ error: 'Rol bulunamadı' }, 404);
      const systemRole = assignedRoles.some(role => role.isSystem);
      if (systemRole && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Sistem rolünü yalnız sistem yöneticisi atayabilir' }, 403);
      const [{ insertId }] = await tx.insert(users).values({ name: input.data.name, email: input.data.email, passwordHash, globalRole: systemRole ? 'super_admin' : 'member', customRoleId: input.data.roleIds[0], isActive: true });
      await tx.insert(userCustomRoles).values(input.data.roleIds.map(roleId => ({ userId: insertId, roleId })));
      await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'user.created', entity: 'user', entityId: insertId, after: { roleIds: input.data.roleIds } });
      return c.json({ id: insertId }, 201);
    });
  } catch { return c.json({ error: 'E-posta başka hesapta kullanılıyor' }, 409); }
});
org.post('/roles', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('roles_create')) return c.json({ error: 'Yetki yok' }, 403);
  const input = customRoleSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Rol bilgileri geçersiz' }, 400);
  if (input.data.roomIds.length) {
    const rooms = await db.select({ id: units.id }).from(units).where(and(inArray(units.id, input.data.roomIds), eq(units.isRoom, true)));
    if (rooms.length !== input.data.roomIds.length) return c.json({ error: 'Oda geçersiz' }, 400);
  }
  return db.transaction(async tx => {
    const [{ insertId }] = await tx.insert(customRoles).values(input.data);
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'role.created', entity: 'custom_role', entityId: insertId, after: { name: input.data.name, description: input.data.description, tabs: input.data.tabs, permissions: input.data.permissions, roomIds: input.data.roomIds, generalAccess: input.data.generalAccess } });
    return c.json({ id: insertId }, 201);
  });
});
org.put('/roles/:id', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('roles_update')) return c.json({ error: 'Yetki yok' }, 403);
  const roleId = Number(c.req.param('id'));
  const input = customRoleSchema.safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(roleId) || roleId <= 0 || !input.success) return c.json({ error: 'Rol bilgileri geçersiz' }, 400);
  if (input.data.roomIds.length) {
    const rooms = await db.select({ id: units.id }).from(units).where(and(inArray(units.id, input.data.roomIds), eq(units.isRoom, true)));
    if (rooms.length !== input.data.roomIds.length) return c.json({ error: 'Oda geçersiz' }, 400);
  }
  return db.transaction(async tx => {
    const [before] = await tx.select().from(customRoles).where(eq(customRoles.id, roleId)).for('update').limit(1);
    if (!before) return c.json({ error: 'Rol bulunamadı' }, 404);
    if (before.isProtected) return c.json({ error: 'Korunan rol değiştirilemez' }, 403);
    await tx.update(customRoles).set(input.data).where(eq(customRoles.id, roleId));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'role.updated', entity: 'custom_role', entityId: roleId, before: { name: before.name, description: before.description, tabs: before.tabs, permissions: before.permissions, roomIds: before.roomIds, generalAccess: before.generalAccess }, after: { name: input.data.name, description: input.data.description, tabs: input.data.tabs, permissions: input.data.permissions, roomIds: input.data.roomIds, generalAccess: input.data.generalAccess } });
    return c.json({ ok: true });
  });
});
org.delete('/roles/:id', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('roles_delete')) return c.json({ error: 'Yetki yok' }, 403);
  const roleId = Number(c.req.param('id'));
  if (!Number.isSafeInteger(roleId) || roleId <= 0) return c.json({ error: 'Rol geçersiz' }, 400);
  return db.transaction(async tx => {
    const [role] = await tx.select({ id: customRoles.id, name: customRoles.name, isProtected: customRoles.isProtected }).from(customRoles).where(eq(customRoles.id, roleId)).for('update').limit(1);
    if (!role) return c.json({ error: 'Rol bulunamadı' }, 404);
    if (role.isProtected) return c.json({ error: 'Korunan rol silinemez' }, 403);
    const [assigned] = await tx.select({ userId: userCustomRoles.userId }).from(userCustomRoles).where(eq(userCustomRoles.roleId, roleId)).limit(1);
    const [legacyAssigned] = await tx.select({ id: users.id }).from(users).where(eq(users.customRoleId, roleId)).limit(1);
    if (assigned || legacyAssigned) return c.json({ error: 'Rol kullanıcıya atanmış; önce atamayı kaldırın' }, 409);
    await tx.delete(customRoles).where(eq(customRoles.id, roleId));
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'role.deleted', entity: 'custom_role', entityId: roleId, before: { name: role.name } });
    return c.json({ ok: true });
  });
});
org.patch('/members/:id/role', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('roles_assign')) return c.json({ error: 'Yetki yok' }, 403);
  const userId = Number(c.req.param('id'));
  const input = z.union([z.object({ roleIds: z.array(z.number().int().positive()).max(20).refine(ids => new Set(ids).size === ids.length) }), z.object({ customRoleId: z.number().int().positive().nullable() })]).safeParse(await c.req.json().catch(() => null));
  if (!Number.isSafeInteger(userId) || userId <= 0 || !input.success) return c.json({ error: 'Rol geçersiz' }, 400);
  const roleIds = 'roleIds' in input.data ? input.data.roleIds : input.data.customRoleId === null ? [] : [input.data.customRoleId];
  return db.transaction(async tx => {
    const activeSystemAdmins = await tx.select({ id: users.id }).from(users)
      .leftJoin(userCustomRoles, eq(userCustomRoles.userId, users.id)).leftJoin(customRoles, eq(customRoles.id, userCustomRoles.roleId))
      .where(and(eq(users.isActive, true), or(eq(customRoles.isSystem, true), and(eq(users.globalRole, 'super_admin'), isNull(users.legacyUserId), isNull(userCustomRoles.userId)))))
      .orderBy(users.id).for('update');
    let found: { id: number; isSystem: boolean }[] = [];
    if (roleIds.length) {
      found = await tx.select({ id: customRoles.id, isSystem: customRoles.isSystem }).from(customRoles).where(inArray(customRoles.id, roleIds)).orderBy(customRoles.id).for('update');
      if (found.length !== roleIds.length) return c.json({ error: 'Rol bulunamadı' }, 404);
    }
    const [person] = await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1);
    if (!person) return c.json({ error: 'Üye bulunamadı' }, 404);
    const currentLinks = await tx.select({ roleId: userCustomRoles.roleId }).from(userCustomRoles).where(eq(userCustomRoles.userId, userId));
    const currentRoles = currentLinks.length ? await tx.select({ isSystem: customRoles.isSystem }).from(customRoles).where(inArray(customRoles.id, currentLinks.map(link => link.roleId))) : [];
    const hadSystemRole = currentRoles.some(role => role.isSystem);
    const getsSystemRole = found.some(role => role.isSystem);
    if (person.globalRole === 'super_admin' && !hadSystemRole) return c.json({ error: 'Yerleşik sistem yöneticisinin rolü değiştirilemez' }, 403);
    if ((hadSystemRole || getsSystemRole) && auth.user.globalRole !== 'super_admin') return c.json({ error: 'Sistem rolünü yalnız sistem yöneticisi atayabilir' }, 403);
    if (hadSystemRole && !getsSystemRole && person.isActive && new Set(activeSystemAdmins.map(admin => admin.id)).size <= 1) return c.json({ error: 'Son sistem yöneticisinin rolü kaldırılamaz' }, 409);
    await tx.delete(userCustomRoles).where(eq(userCustomRoles.userId, userId));
    if (roleIds.length) await tx.insert(userCustomRoles).values(roleIds.map(roleId => ({ userId, roleId })));
    await tx.update(users).set({ customRoleId: roleIds[0] ?? null, globalRole: getsSystemRole ? 'super_admin' : hadSystemRole ? 'member' : person.globalRole }).where(eq(users.id, userId));
    return c.json({ ok: true, roleIds });
  });
});
org.put('/members/:id/units/:unitId', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('units_manage')) return c.json({ error: 'Yetki yok' }, 403);
  const userId = Number(c.req.param('id'));
  const unitId = Number(c.req.param('unitId'));
  const body = await c.req.json().catch(() => null);
  const role = body?.role;
  if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(unitId) || !['member', 'lead', 'advisor'].includes(role)) return c.json({ error: 'Üyelik geçersiz' }, 400);
  if (!canManageUnit(auth, unitId) || (auth.user.globalRole !== 'super_admin' && role !== 'member')) return c.json({ error: 'Yetki yok' }, 403);
  const [person] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  const [unit] = await db.select({ id: units.id }).from(units).where(eq(units.id, unitId)).limit(1);
  if (!person || !unit) return c.json({ error: 'Üye veya birim bulunamadı' }, 404);
  await db.insert(memberships).values({ userId, unitId, role }).onDuplicateKeyUpdate({ set: { role } });
  return c.json({ ok: true });
});
export default org;
