import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const source = process.argv[2];
const apply = process.argv.includes('--apply');
const acceptIncomplete = process.argv.includes('--accept-incomplete');
if (!source) throw new Error('Kullanım: stage-v1-roles.mjs <V1 SQLite kopyası> [--apply --accept-incomplete]');
const script = fileURLToPath(new URL('./plan-v1-roles.py', import.meta.url));
const planned = spawnSync('python3', [script, resolve(source)], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
if (![0, 3].includes(planned.status) || !planned.stdout) throw new Error('V1 rol ön kontrolü çalışmadı');
const report = JSON.parse(planned.stdout);
const roles = report.roles;
if (apply && report.blockers.length && !acceptIncomplete) throw new Error('Eşlenemeyen kaynak izinler var; prova için --accept-incomplete gerekli');
const summary = { roles: roles.length, blockedRoles: report.blockers.map(item => item.role), mappedPermissions: roles.reduce((sum, role) => sum + role.mappedPermissions.length, 0), applied: false };
if (!apply) { process.stdout.write(`${JSON.stringify(summary)}\n`); process.exit(0); }
const sourceDb = new DatabaseSync(resolve(source), { readOnly: true });
let sourceDetails;
try { sourceDetails = new Map(sourceDb.prepare('SELECT id, description, created_at, updated_at FROM roles').all().map(row => [row.id, row])); }
finally { sourceDb.close(); }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 rol zamanı geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) throw new Error('V1 rol zamanı geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}

const databaseUrl = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (databaseUrl.hostname !== '127.0.0.1' || databaseUrl.port !== '4319' || !['/sparkoff_v2_acceptance', '/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(databaseUrl.pathname)) throw new Error('Rol provası yalnız ayrı yerel MariaDB veritabanında çalışır');
const tabsFor = role => {
  const tabs = new Set();
  for (const permission of role.mappedPermissions) {
    if (/^(inventory_|loans_)/.test(permission)) tabs.add('inventory');
    if (/^(printers_|appointments_)/.test(permission)) tabs.add('board');
    if (/^(users_|roles_)/.test(permission)) tabs.add('members');
    if (/^(announcements_|staff_announcements_)/.test(permission)) tabs.add('announcements');
    if (/^(audit_logs_|privacy_settings_|workshop_settings_|system_settings_)/.test(permission)) tabs.add('board');
  }
  return [...tabs];
};
const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
let inserted = 0;
let updated = 0;
try {
  await connection.beginTransaction();
  for (const role of roles) {
    if (!role.slug || role.slug.length > 120 || !role.name || role.name.length > 120) throw new Error('V1 rol adı veya slug değeri geçersiz');
    const details = sourceDetails.get(role.id);
    if (!details || details.description != null && typeof details.description !== 'string') throw new Error('V1 rol açıklaması eksik veya geçersiz');
    const createdAt = date(details.created_at), updatedAt = date(details.updated_at);
    const [existing] = await connection.execute('SELECT id, name, description, created_at, updated_at, is_protected, is_system, legacy_role_id, legacy_slug, legacy_permission_keys, permissions, tabs FROM custom_roles WHERE legacy_role_id=? OR legacy_slug=? FOR UPDATE', [role.id, role.slug]);
    if (existing.length > 1) throw new Error('V1 rol kimliği iki V2 kaydıyla çakışıyor');
    if (existing.length) {
      const row = existing[0];
      const sourceKeys = typeof row.legacy_permission_keys === 'string' ? JSON.parse(row.legacy_permission_keys) : row.legacy_permission_keys;
      const effective = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
      const tabs = typeof row.tabs === 'string' ? JSON.parse(row.tabs) : row.tabs;
      if (Number(row.legacy_role_id) !== role.id || row.legacy_slug !== role.slug || row.name !== role.name || Boolean(row.is_protected) !== role.isProtected || Boolean(row.is_system) !== role.isSystem || JSON.stringify(sourceKeys) !== JSON.stringify(role.sourcePermissions) || effective.some(permission => !role.mappedPermissions.includes(permission)) || JSON.stringify(tabs) !== JSON.stringify(tabsFor(role))) throw new Error('Önceden taşınan V1 rolü değişmiş; elle inceleme gerekli');
      const changes = {};
      if (JSON.stringify(effective) !== JSON.stringify(role.mappedPermissions)) changes.permissions = JSON.stringify(role.mappedPermissions);
      if (row.description !== details.description) changes.description = details.description;
      if (row.created_at !== createdAt) changes.created_at = createdAt;
      if (row.updated_at !== updatedAt) changes.updated_at = updatedAt;
      if (Object.keys(changes).length) { await connection.execute(`UPDATE custom_roles SET ${Object.keys(changes).map(key => `${key}=?`).join(',')} WHERE id=?`, [...Object.values(changes), row.id]); updated++; }
      continue;
    }
    await connection.execute('INSERT INTO custom_roles (name, description, tabs, permissions, room_ids, general_access, is_protected, is_system, legacy_role_id, legacy_slug, legacy_permission_keys, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [role.name, details.description, JSON.stringify(tabsFor(role)), JSON.stringify(role.mappedPermissions), JSON.stringify([]), 0, role.isProtected ? 1 : 0, role.isSystem ? 1 : 0, role.id, role.slug, JSON.stringify(role.sourcePermissions), createdAt, updatedAt]);
    inserted++;
  }
  await connection.commit();
  process.stdout.write(`${JSON.stringify({ ...summary, applied: true, inserted, updated })}\n`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
