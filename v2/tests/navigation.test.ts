import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import type { Permission, Tab } from '../src/shared/access';
import { canOpenAdmin, canOpenAdminAnnouncements, canOpenAdminInventory, canOpenAdminMembers, canOpenAdminPrinters, firstAdminRoute } from '../src/client/navigation';

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
  assert.equal(canOpenAdminPrinters(reviewer), false);
  assert.equal(firstAdminRoute(reviewer), '/admin/feedback');
});

test('yazıcı yetkisi olmadan pano sekmesi yazıcı ekranını açmaz', () => {
  const reviewer = access(['board'], ['feedback_view']);
  assert.equal(canOpenAdminPrinters(reviewer), false);
});

test('yalnız yazıcı yetkisi olan hesap yönetim yazıcı ekranına ulaşır', () => {
  const operator = access([], ['printers_view']);
  assert.equal(canOpenAdminPrinters(operator), true);
  assert.equal(canOpenAdmin(operator), true);
  assert.equal(firstAdminRoute(operator), '/admin/printers');
});

test('üye sekmesi tek başına yönetim üyeler ekranını açmaz', () => {
  const member = access(['members'], []);
  assert.equal(canOpenAdminMembers(member), false);
  assert.equal(canOpenAdmin(member), false);
});

test('üye veya rol görüntüleme yetkisi ekranı açar', () => {
  for (const permission of ['users_view', 'roles_view', 'roles_create', 'units_manage'] as Permission[]) {
    const operator = access(['members'], [permission]);
    assert.equal(canOpenAdminMembers(operator), true);
    assert.equal(firstAdminRoute(operator), '/admin/members');
  }
  assert.equal(canOpenAdminMembers(access(['members'], ['users_create'])), false);
  assert.equal(canOpenAdminMembers(access(['members'], ['users_create', 'roles_assign'])), true);
  assert.equal(canOpenAdminMembers(access([], ['users_view'])), false);
});

test('duyuru yönetimi için sunucu gibi sekme ve izin birlikte gerekir', () => {
  const permissionOnly = access([], ['announcements_view']);
  assert.equal(canOpenAdminAnnouncements(permissionOnly), false);
  assert.equal(canOpenAdmin(permissionOnly), false);
  const viewer = access(['announcements'], ['announcements_view']);
  assert.equal(canOpenAdminAnnouncements(viewer), true);
  assert.equal(firstAdminRoute(viewer), '/admin/announce');
  assert.equal(canOpenAdminAnnouncements(access(['announcements'], [])), false);
});
