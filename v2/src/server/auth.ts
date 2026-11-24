import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { compare as compareBcrypt } from 'bcryptjs';
import { and, eq, gt, inArray } from 'drizzle-orm';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context, MiddlewareHandler } from 'hono';
import { db } from './db.js';
import { customRoles, memberships, sessions, TAB_PATHS, PERMISSIONS, units, userCustomRoles, users, type GlobalRole, type Membership, type Permission, type Tab, type Unit, type User } from '../shared/schema.js';

const scrypt = promisify(scryptCallback);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const cookieName = process.env.NODE_ENV === 'production' ? '__Host-sparkoff_sid' : 'sparkoff_sid_dev';
export type Scopes = { manageIds: number[]; accessIds: number[]; viewIds: number[] };
export type Auth = { user: User; scopes: Scopes; tabs: Tab[]; permissions: Permission[]; roleIds: number[]; csrfToken?: string };
export type AppEnv = { Variables: { auth: Auth } };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(encoded)) {
    try { return await compareBcrypt(password, encoded); } catch { return false; }
  }
  const [algorithm, salt, expectedHex] = encoded.split(':');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(expectedHex || '')) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function descendants(root: number, children: Map<number, number[]>): number[] {
  const seen = new Set<number>();
  const pending = [root];
  while (pending.length) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(children.get(current) || []));
  }
  return [...seen];
}
export function computeScopes(user: User, allUnits: Unit[], ownMemberships: Membership[]): Scopes {
  const allIds = allUnits.map(unit => unit.id);
  if (user.globalRole === 'super_admin') return { manageIds: allIds, accessIds: allIds, viewIds: allIds };
  const children = new Map<number, number[]>();
  const parents = new Map<number, number | null>();
  for (const unit of allUnits) {
    parents.set(unit.id, unit.parentId);
    if (unit.parentId !== null) children.set(unit.parentId, [...(children.get(unit.parentId) || []), unit.id]);
  }
  const manage = new Set<number>();
  const view = new Set<number>();
  const access = new Set<number>();
  for (const membership of ownMemberships) {
    access.add(membership.unitId);
    if (membership.role === 'lead') for (const id of descendants(membership.unitId, children)) manage.add(id);
    if (membership.role === 'advisor') for (const id of descendants(membership.unitId, children)) view.add(id);
    let parent = parents.get(membership.unitId);
    const seen = new Set<number>();
    while (parent !== null && parent !== undefined && !seen.has(parent)) {
      seen.add(parent); access.add(parent); parent = parents.get(parent);
    }
  }
  for (const id of manage) { access.add(id); view.add(id); }
  return { manageIds: [...manage], accessIds: [...access], viewIds: [...view] };
}
export function isGlobalAdmin(role: GlobalRole): boolean { return role === 'super_admin'; }
export function canManageUnit(auth: Auth, unitId: number): boolean { return isGlobalAdmin(auth.user.globalRole) || auth.scopes.manageIds.includes(unitId); }
export function canAccessChannel(auth: Auth, unitId: number, isGeneral = false): boolean {
  if (isGeneral) {
    return isGlobalAdmin(auth.user.globalRole) || auth.permissions.includes('general');
  }
  return auth.scopes.accessIds.includes(unitId) || (auth.user.globalRole === 'advisor' && auth.scopes.viewIds.includes(unitId));
}
export function hasTab(auth: Auth, tab: Tab): boolean { return auth.user.globalRole === 'super_admin' || auth.tabs.includes(tab); }
export function firstRoute(auth: Auth): string { return (auth.tabs.map(tab => TAB_PATHS[tab])[0]) || '/app/profile'; }

export async function issueSession(c: Context, userId: number): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  await db.insert(sessions).values({ id: digest(token), userId, csrfHash: digest(csrf), expiresAt: new Date(Date.now() + 14 * 86400_000) });
  setCookie(c, cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', path: '/', maxAge: 14 * 86400 });
  return csrf;
}
export async function revokeSession(c: Context): Promise<void> {
  const token = getCookie(c, cookieName);
  if (token) await db.delete(sessions).where(eq(sessions.id, digest(token)));
  deleteCookie(c, cookieName, { path: '/' });
}
export async function loadAuth(c: Context): Promise<Auth | null> {
  const token = getCookie(c, cookieName);
  if (!token) return null;
  const [session] = await db.select().from(sessions).where(and(eq(sessions.id, digest(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!session) return null;
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user || !user.isActive) return null;
  const [allUnits, ownMemberships] = await Promise.all([db.select().from(units), db.select().from(memberships).where(eq(memberships.userId, user.id))]);
  const roleLinks = await db.select({ roleId: userCustomRoles.roleId }).from(userCustomRoles).where(eq(userCustomRoles.userId, user.id));
  const roles = roleLinks.length ? await db.select().from(customRoles).where(inArray(customRoles.id, roleLinks.map(link => link.roleId))) : [];
  const allPermissions: Permission[] = [...PERMISSIONS];
  const hasSystemRole = roles.some(role => role.isSystem);
  const privileged = hasSystemRole || (user.globalRole === 'super_admin' && roleLinks.length === 0 && user.legacyUserId === null);
  const effectiveUser: User = { ...user, globalRole: privileged ? 'super_admin' : user.globalRole === 'super_admin' ? 'member' : user.globalRole };
  const scopes = computeScopes(effectiveUser, allUnits, ownMemberships);
  if (!privileged) for (const role of roles) for (const roomId of role.roomIds) if (allUnits.some(unit => unit.id === roomId && unit.isRoom) && !scopes.accessIds.includes(roomId)) scopes.accessIds.push(roomId);
  const permissions = privileged ? allPermissions : [...new Set(roles.flatMap(role => role.permissions).filter(permission => allPermissions.includes(permission)))];
  if (roles.some(role => role.generalAccess) && !permissions.includes('general')) permissions.push('general');
  const tabs = privileged ? [...Object.keys(TAB_PATHS)] as Tab[] : [...new Set(roles.flatMap(role => role.tabs))];
  return { user: effectiveUser, scopes, tabs, permissions, roleIds: roles.map(role => role.id) };
}
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = await loadAuth(c);
  if (!auth) return c.json({ error: 'Oturum gerekli' }, 401);
  c.set('auth', auth);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    const allowed = process.env.APP_ORIGIN;
    if (origin && allowed && origin !== allowed) return c.json({ error: 'Geçersiz kaynak' }, 403);
    const token = c.req.header('x-csrf-token') || '';
    const cookieToken = getCookie(c, cookieName);
    const [session] = cookieToken ? await db.select({ csrfHash: sessions.csrfHash }).from(sessions).where(eq(sessions.id, digest(cookieToken))).limit(1) : [];
    if (!session || digest(token) !== session.csrfHash) return c.json({ error: 'CSRF doğrulaması başarısız' }, 403);
  }
  await next();
};
export function requireTab(tab: Tab): MiddlewareHandler<AppEnv> {
  return async (c, next) => hasTab(c.get('auth'), tab) ? next() : c.json({ error: 'Sekme yetkisi yok', firstRoute: firstRoute(c.get('auth')) }, 403);
}
