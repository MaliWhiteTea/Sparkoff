import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { Permission, Tab } from '../src/shared/access';
import { canOpenAdmin, canOpenAdminInventory, firstAdminRoute } from '../src/client/navigation';

function access(tabs: Tab[], permissions: Permission[]) {
  return { user: { role: 'member' }, tabs, permissions };
}

test('V1 malzeme moderatörü yönetim envanterine ulaşır', () => {
  const moderator = access(['inventory'], ['inventory_view']);
  assert.equal(canOpenAdminInventory(moderator), true);
  assert.equal(canOpenAdmin(moderator), true);
  assert.equal(firstAdminRoute(moderator), '/admin/inventory');
});

test('kamu envanteri sekmesi yönetim envanteri izni vermez', () => {
  const member = access(['inventory'], []);
  assert.equal(canOpenAdminInventory(member), false);
  assert.equal(canOpenAdmin(member), false);
});

test('ayrı geri bildirim yetkisi olan hesap yönetimden dışlanmaz', () => {
  const reviewer = access([], ['feedback_view']);
  assert.equal(canOpenAdmin(reviewer), true);
  assert.equal(firstAdminRoute(reviewer), '/admin/feedback');
});
