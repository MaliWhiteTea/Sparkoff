import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Membership, Unit, User } from '../src/shared/schema.js';

process.env.DATABASE_URL ||= 'mysql://unused@127.0.0.1:3306/unused_test';
const { canAccessChannel, computeScopes } = await import('../src/server/auth.js');
type Auth = import('../src/server/auth.js').Auth;

const unit = (id: number, parentId: number | null, isRoom = false, isGeneral = false) => ({ id, parentId, isRoom, isGeneral }) as Unit;
const membership = (userId: number, unitId: number, role: Membership['role']) => ({ userId, unitId, role }) as Membership;
const person = (globalRole: User['globalRole']) => ({ id: 7, globalRole, customRoleId: null }) as User;
const tree = [unit(1, null, false, true), unit(2, 1), unit(3, 2), unit(4, 1), unit(5, null, true)];

test('normal üye üst birimleri görür, kardeş birime erişemez', () => {
  const scopes = computeScopes(person('member'), tree, [membership(7, 3, 'member')]);
  assert.deepEqual(new Set(scopes.accessIds), new Set([1, 2, 3]));
  assert.deepEqual(scopes.manageIds, []);
  assert.equal(canAccessChannel({ user: person('member'), scopes, tabs: ['chat'], permissions: ['chat_write', 'general'] } as Auth, 4), false);
});

test('sorumlu yalnız kendi alt ağacını yönetir', () => {
  const scopes = computeScopes(person('lead'), tree, [membership(7, 2, 'lead')]);
  assert.deepEqual(new Set(scopes.manageIds), new Set([2, 3]));
  assert.equal(scopes.manageIds.includes(4), false);
});

test('hoca alt ağı görür ve bu kanallara erişir, genel kanala erişmez', () => {
  const user = person('advisor');
  const scopes = computeScopes(user, tree, [membership(7, 2, 'advisor')]);
  const auth = { user, scopes, tabs: ['chat'], permissions: ['chat_write'] } as Auth;
  assert.deepEqual(new Set(scopes.viewIds), new Set([2, 3]));
  assert.equal(canAccessChannel(auth, 3), true);
  assert.equal(canAccessChannel(auth, 1, true), false);
  assert.equal(canAccessChannel(auth, 4), false);
});

test('genel kanal yalnız açık işaretlendiğinde açılır', () => {
  const user = person('member');
  const scopes = computeScopes(user, tree, []);
  const auth = { user, scopes, tabs: ['chat'], permissions: ['chat_write', 'general'] } as Auth;
  assert.equal(canAccessChannel(auth, 1, true), true);
  assert.equal(canAccessChannel(auth, 4), false);
  const lead = { user: person('lead'), scopes, tabs: ['chat'], permissions: ['chat_write', 'general'] } as Auth;
  assert.equal(canAccessChannel(lead, 1, true), true);
});
