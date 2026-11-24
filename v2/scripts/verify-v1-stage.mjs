import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Kullanım: verify-v1-stage.mjs <V1 SQLite>');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Doğrulama yalnız ayrı yerel migration veritabanında çalışır');
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
const mappings = [
  ['roles', 'custom_roles', 'legacy_role_id'], ['users', 'users', 'legacy_user_id'],
  ['inventory_categories', 'categories', 'legacy_category_id'], ['inventory_locations', 'locations', 'legacy_location_id'],
  ['inventory_items', 'materials', 'legacy_material_id'], ['inventory_transactions', 'loans', 'legacy_loan_id'],
  ['stock_movements', 'stock_movements', 'legacy_movement_id'], ['inventory_media', 'material_media', 'legacy_media_id'],
  ['printers', 'printers', 'legacy_printer_id'], ['filaments', 'filaments', 'legacy_filament_id'],
  ['operating_hours', 'operating_hours', 'legacy_operating_hour_id'], ['blackout_periods', 'blackout_periods', 'legacy_blackout_id'],
  ['feedback_reports', 'feedbacks', 'legacy_feedback_id'], ['activity_logs', 'audit_logs', 'legacy_activity_log_id'],
  ['announcements', 'announcements', 'legacy_announcement_id'],
  ['appointments', 'appointments', 'legacy_appointment_id'], ['appointment_files', 'appointment_files', 'legacy_appointment_file_id'],
  ['appointment_status_histories', 'appointment_status_histories', 'legacy_appointment_history_id'],
];
const report = {};
const targetIds = new Map();
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  await db.query("SET time_zone = '+00:00'");
  for (const [sourceTable, targetTable, legacyColumn] of mappings) {
    const sourceIds = source.prepare(`SELECT id FROM ${sourceTable} ORDER BY id`).all().map(row => Number(row.id));
    const [targetRows] = await db.query(`SELECT id, ${legacyColumn} AS legacy_id FROM ${targetTable} ORDER BY ${legacyColumn}`);
    const targetSourceIds = targetRows.map(row => Number(row.legacy_id));
    if (JSON.stringify(sourceIds) !== JSON.stringify(targetSourceIds) || targetSourceIds.some(id => !Number.isSafeInteger(id) || id <= 0)) throw new Error(`V1/V2 kaynak kimliği farklı: ${sourceTable}`);
    report[sourceTable] = { source: sourceIds.length, migrated: targetSourceIds.length, excluded: 0 };
    targetIds.set(sourceTable, new Map(targetRows.map(row => [Number(row.legacy_id), Number(row.id)])));
  }
  const settingRows = source.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const [targetSettings] = await db.query('SELECT `key`, value FROM system_settings ORDER BY `key`');
  if (settingRows.length !== targetSettings.length || settingRows.some((row, index) => row.key !== targetSettings[index].key || JSON.stringify(JSON.parse(row.value)) !== JSON.stringify(targetSettings[index].value))) throw new Error('V1/V2 ayar anahtarı veya JSON değeri farklı');
  report.settings = { source: settingRows.length, migrated: targetSettings.length, excluded: 0 };
  async function pivot(sourceTable, targetTable, sourceColumns, targetColumns, mapTables) {
    const sourceRows = source.prepare(`SELECT ${sourceColumns.join(',')} FROM ${sourceTable}`).all();
    const [targetRows] = await db.query(`SELECT ${targetColumns.join(',')} FROM ${targetTable}`);
    const expected = sourceRows.map(row => sourceColumns.map((column, index) => {
      const id = targetIds.get(mapTables[index]).get(Number(row[column]));
      if (!id) throw new Error(`V1 ${sourceTable} bağı hedefte bulunamadı`);
      return id;
    }).join(':')).sort();
    const actual = targetRows.map(row => targetColumns.map(column => Number(row[column])).join(':')).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`V1/V2 bağ tablosu farklı: ${sourceTable}`);
    report[sourceTable] = { source: sourceRows.length, migrated: targetRows.length, excluded: 0 };
  }
  await pivot('role_user', 'user_custom_roles', ['user_id', 'role_id'], ['user_id', 'role_id'], ['users', 'roles']);
  await pivot('announcement_role', 'announcement_roles', ['announcement_id', 'role_id'], ['announcement_id', 'role_id'], ['announcements', 'roles']);
  await pivot('announcement_user', 'announcement_reads', ['announcement_id', 'user_id'], ['announcement_id', 'user_id'], ['announcements', 'users']);
  const permissions = source.prepare('SELECT id, key FROM permissions').all();
  const permissionKeys = new Map(permissions.map(row => [row.id, row.key]));
  const permissionLinks = source.prepare('SELECT role_id, permission_id FROM permission_role').all();
  const [roleRows] = await db.query('SELECT legacy_role_id, legacy_permission_keys FROM custom_roles WHERE legacy_role_id IS NOT NULL');
  for (const role of roleRows) {
    const expected = permissionLinks.filter(link => link.role_id === Number(role.legacy_role_id)).map(link => permissionKeys.get(link.permission_id)).sort();
    const actual = (typeof role.legacy_permission_keys === 'string' ? JSON.parse(role.legacy_permission_keys) : role.legacy_permission_keys).slice().sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('V1/V2 rol kaynak izinleri farklı');
  }
  report.permissions = { source: permissions.length, migratedMetadata: permissions.length, excluded: 0 };
  report.permission_role = { source: permissionLinks.length, migratedMetadata: permissionLinks.length, excluded: 0 };
  const sourceRoles = source.prepare('SELECT id, description, created_at, updated_at FROM roles').all();
  const [targetRoles] = await db.query('SELECT legacy_role_id, description, created_at, updated_at FROM custom_roles WHERE legacy_role_id IS NOT NULL');
  const targetRoleMap = new Map(targetRoles.map(role => [Number(role.legacy_role_id), role]));
  function utc(value) { return new Date(value.replace(' ', 'T') + '+03:00').toISOString().slice(0, 19).replace('T', ' '); }
  for (const role of sourceRoles) {
    const target = targetRoleMap.get(role.id);
    if (!target || role.description !== target.description || utc(role.created_at) !== target.created_at || utc(role.updated_at) !== target.updated_at) throw new Error('V1/V2 rol açıklaması veya zamanı farklı');
  }
  const sourceUsers = source.prepare('SELECT id, role, email_verified_at, interface_preferences, table_preferences, saved_filters, created_at, updated_at FROM users').all();
  const [targetUsers] = await db.query('SELECT legacy_user_id, legacy_role_label, email_verified_at, preferences, created_at, updated_at FROM users WHERE legacy_user_id IS NOT NULL');
  const targetUserMap = new Map(targetUsers.map(user => [Number(user.legacy_user_id), user]));
  for (const user of sourceUsers) {
    const target = targetUserMap.get(user.id);
    const parse = value => value == null ? null : JSON.parse(value);
    const expectedPreferences = { v1: { interfacePreferences: parse(user.interface_preferences), tablePreferences: parse(user.table_preferences), savedFilters: parse(user.saved_filters) } };
    if (!target || target.legacy_role_label !== user.role || target.email_verified_at !== (user.email_verified_at == null ? null : utc(user.email_verified_at)) || target.created_at !== utc(user.created_at) || target.updated_at !== utc(user.updated_at) || JSON.stringify(target.preferences) !== JSON.stringify(expectedPreferences)) throw new Error('V1/V2 kullanıcı eski etiketi, tercihi veya zamanı farklı');
  }
  const [audit] = await db.query('SELECT SUM(entity_id IS NULL) AS missing_subjects, SUM(actor_id IS NULL) AS missing_actors FROM audit_logs WHERE legacy_activity_log_id IS NOT NULL');
  if (Number(audit[0].missing_actors || 0)) throw new Error('V1 etkinlik kullanıcı bağı eksik');
  const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
  const totals = Object.entries(report).filter(([table]) => !['permissions', 'permission_role'].includes(table)).reduce((result, [, row]) => ({ source: result.source + row.source, migrated: result.migrated + row.migrated, excluded: result.excluded + row.excluded }), { source: 0, migrated: 0, excluded: 0 });
  process.stdout.write(`${JSON.stringify({ sourceHash, totals, tables: report, missingActivitySubjects: Number(audit[0].missing_subjects || 0) })}\n`);
} finally { source.close(); await db.end(); }
