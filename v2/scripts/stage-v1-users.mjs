import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const sourcePath = process.argv[2];
const apply = process.argv.includes('--apply');
if (!sourcePath) throw new Error('Kullanım: stage-v1-users.mjs <V1 SQLite kopyası> [--apply]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_acceptance', '/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Kullanıcı provası yalnız ayrı yerel MariaDB veritabanında çalışır');
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let users;
let roles;
let links;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  users = source.prepare('SELECT id, name, email, email_verified_at, password, role, is_active, interface_preferences, table_preferences, saved_filters, created_at, updated_at FROM users ORDER BY id').all();
  roles = source.prepare('SELECT id, is_system FROM roles ORDER BY id').all();
  links = source.prepare('SELECT user_id, role_id FROM role_user ORDER BY user_id, role_id').all();
} finally { source.close(); }
const sourceRoles = new Map(roles.map(role => [role.id, role]));
const linkedByUser = new Map();
for (const link of links) {
  if (!sourceRoles.has(link.role_id)) throw new Error('V1 rol bağı bulunmayan role işaret ediyor');
  linkedByUser.set(link.user_id, [...(linkedByUser.get(link.user_id) || []), link.role_id]);
}
const uniqueEmails = new Set();
for (const user of users) {
  if (!Number.isSafeInteger(user.id) || user.id <= 0 || typeof user.name !== 'string' || !user.name.trim() || user.name.length > 120 || typeof user.email !== 'string' || user.email.length > 255 || !/^\S+@\S+$/.test(user.email) || !/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(user.password)) throw new Error('V1 kullanıcı kimliği, adı, e-postası veya bcrypt özeti geçersiz');
  if (typeof user.role !== 'string' || user.role.length < 1 || user.role.length > 50) throw new Error('V1 eski kullanıcı rol etiketi geçersiz');
  const email = user.email.trim().toLowerCase();
  if (uniqueEmails.has(email)) throw new Error('V1 kaynakta yinelenen e-posta var');
  uniqueEmails.add(email);
}
const summary = { users: users.length, roleLinks: links.length, systemUsers: users.filter(user => (linkedByUser.get(user.id) || []).some(roleId => sourceRoles.get(roleId).is_system)).length, applied: false };
if (!apply) { process.stdout.write(`${JSON.stringify(summary)}\n`); process.exit(0); }
function date(value, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 kullanıcı zamanı geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) throw new Error('V1 kullanıcı zamanı geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
function sourcePreferences(user) {
  const parse = (value, field) => {
    if (value == null) return null;
    let result;
    try { result = JSON.parse(value); } catch { throw new Error(`V1 ${field} JSON biçimi geçersiz`); }
    if (result === null || typeof result !== 'object') throw new Error(`V1 ${field} JSON değeri geçersiz`);
    return result;
  };
  return JSON.stringify({ v1: { interfacePreferences: parse(user.interface_preferences, 'arayüz tercihi'), tablePreferences: parse(user.table_preferences, 'tablo tercihi'), savedFilters: parse(user.saved_filters, 'kayıtlı filtre') } });
}
const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
let inserted = 0;
let existing = 0;
try {
  await connection.beginTransaction();
  const [stagedRoles] = await connection.execute('SELECT id, legacy_role_id FROM custom_roles WHERE legacy_role_id IS NOT NULL FOR UPDATE');
  const targetRoles = new Map(stagedRoles.map(role => [Number(role.legacy_role_id), Number(role.id)]));
  for (const user of users) {
    const sourceRoleIds = linkedByUser.get(user.id) || [];
    const system = sourceRoleIds.some(roleId => sourceRoles.get(roleId).is_system);
    const customRoleIds = sourceRoleIds.map(roleId => {
      const target = targetRoles.get(roleId);
      if (!target) throw new Error('V1 rolü yerel V2 kabul veritabanında hazırlanmamış');
      return target;
    });
    const email = user.email.trim().toLowerCase();
    const fields = { legacy_role_label: user.role, email_verified_at: date(user.email_verified_at), preferences: sourcePreferences(user), created_at: date(user.created_at, true), updated_at: date(user.updated_at, true) };
    const [matches] = await connection.execute('SELECT id, name, email, password_hash, global_role, is_active, legacy_user_id, legacy_role_label, email_verified_at, preferences, created_at, updated_at FROM users WHERE legacy_user_id=? OR email=? FOR UPDATE', [user.id, email]);
    if (matches.length > 1) throw new Error('V1 kullanıcı kimliği ve e-posta iki V2 kaydıyla çakışıyor');
    if (matches.length) {
      const target = matches[0];
      if (Number(target.legacy_user_id) !== user.id || target.name !== user.name || target.email.toLowerCase() !== email || target.password_hash !== user.password || target.global_role !== (system ? 'super_admin' : 'member') || Boolean(target.is_active) !== Boolean(user.is_active)) throw new Error('Önceden taşınan V1 kullanıcısı değişmiş; elle inceleme gerekli');
      const changed = target.legacy_role_label !== fields.legacy_role_label || target.email_verified_at !== fields.email_verified_at || JSON.stringify(target.preferences) !== fields.preferences || target.created_at !== fields.created_at || target.updated_at !== fields.updated_at;
      if (changed) await connection.execute('UPDATE users SET legacy_role_label=?, email_verified_at=?, preferences=?, created_at=?, updated_at=? WHERE id=?', [fields.legacy_role_label, fields.email_verified_at, fields.preferences, fields.created_at, fields.updated_at, target.id]);
      const [assigned] = await connection.execute('SELECT role_id FROM user_custom_roles WHERE user_id=? ORDER BY role_id', [target.id]);
      if (JSON.stringify(assigned.map(row => Number(row.role_id))) !== JSON.stringify([...customRoleIds].sort((a, b) => a - b))) throw new Error('Önceden taşınan V1 kullanıcı rol bağları değişmiş');
      existing++;
      continue;
    }
    const [created] = await connection.execute('INSERT INTO users (name, email, password_hash, global_role, custom_role_id, legacy_user_id, legacy_role_label, email_verified_at, preferences, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [user.name, email, user.password, system ? 'super_admin' : 'member', customRoleIds[0] || null, user.id, fields.legacy_role_label, fields.email_verified_at, fields.preferences, user.is_active ? 1 : 0, fields.created_at, fields.updated_at]);
    for (const roleId of customRoleIds) await connection.execute('INSERT INTO user_custom_roles (user_id, role_id) VALUES (?, ?)', [created.insertId, roleId]);
    inserted++;
  }
  await connection.commit();
  process.stdout.write(`${JSON.stringify({ ...summary, applied: true, inserted, existing })}\n`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally { await connection.end(); }
