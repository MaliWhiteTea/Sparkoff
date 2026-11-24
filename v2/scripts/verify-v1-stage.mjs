import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import mysql from 'mysql2/promise';

const sourcePath = process.argv[2], sourcePublicPath = process.argv[3];
if (!sourcePath) throw new Error('Kullanım: verify-v1-stage.mjs <V1 SQLite> [V1 public dosya kökü]');
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
  const legacyImages = source.prepare('SELECT id, image_path FROM inventory_items WHERE image_path IS NOT NULL AND image_path <> \'\' ORDER BY id').all();
  const [targetImageRows] = await db.query('SELECT legacy_material_id, image_path FROM materials WHERE legacy_material_id IS NOT NULL');
  const imagePaths = new Map(targetImageRows.map(row => [Number(row.legacy_material_id), row.image_path]));
  if (targetImageRows.length !== report.inventory_items.source) throw new Error('Tekil görsel için malzeme sayısı farklı');
  if (targetImageRows.filter(row => row.image_path).length !== legacyImages.length) throw new Error('V1/V2 tekil görsel sayısı farklı');
  if (legacyImages.length) {
    if (!sourcePublicPath || !process.env.PUBLIC_UPLOAD_DIR) throw new Error('Tekil görsel doğrulaması için kaynak ve hedef dosya kökü gerekli');
    const sourceRoot = await realpath(resolve(sourcePublicPath));
    const targetRoot = await realpath(resolve(process.env.PUBLIC_UPLOAD_DIR));
    if (!targetRoot.startsWith(resolve('../storage/framework/local-test-v2') + sep)) throw new Error('Tekil görsel hedefi yalnız yerel prova dizininde olabilir');
    for (const row of legacyImages) {
      if (typeof row.image_path !== 'string' || row.image_path.length > 512 || row.image_path.startsWith('/') || row.image_path.includes('\\') || row.image_path.split('/').some(part => !part || part === '.' || part === '..') || /[\u0000-\u001f\u007f]/.test(row.image_path) || !/\.(jpg|jpeg|png|webp)$/i.test(row.image_path)) throw new Error('V1 tekil görsel yolu geçersiz');
      const sourceFile = await realpath(resolve(sourceRoot, row.image_path));
      if (!sourceFile.startsWith(sourceRoot + sep)) throw new Error('V1 tekil görseli kaynak kök dışına çıkıyor');
      const sourceDigest = createHash('sha256').update(await readFile(sourceFile)).digest('hex');
      const materialId = targetIds.get('inventory_items').get(Number(row.id));
      const targetRelative = imagePaths.get(Number(row.id));
      if (!materialId || !new RegExp(`^inventory-legacy/${materialId}/${sourceDigest}\\.(jpg|png|webp)$`).test(targetRelative || '')) throw new Error('V2 tekil görsel yolu veya özeti farklı');
      const targetFile = await realpath(resolve(targetRoot, targetRelative));
      if (!targetFile.startsWith(targetRoot + sep) || createHash('sha256').update(await readFile(targetFile)).digest('hex') !== sourceDigest) throw new Error('V1/V2 tekil görsel dosya özeti farklı');
    }
  }
  report.inventoryLegacyImages = { source: legacyImages.length, migrated: legacyImages.length, excluded: 0 };
  function milli(value) {
    if (value == null) return null;
    const amount = Number(value);
    const scaled = Math.round(amount * 1000);
    if (!Number.isSafeInteger(scaled) || Math.abs(amount * 1000 - scaled) > 1e-6) throw new Error('V1/V2 stok sayısı veya hassasiyeti geçersiz');
    return scaled;
  }
  async function compareAmounts(sourceTable, targetTable, legacyColumn, columns) {
    const sourceRows = source.prepare(`SELECT id, ${columns.map(([from]) => from).join(', ')} FROM ${sourceTable}`).all();
    const [targetRows] = await db.query(`SELECT ${legacyColumn} AS legacy_id, ${columns.map(([, to]) => to).join(', ')} FROM ${targetTable} WHERE ${legacyColumn} IS NOT NULL`);
    const targetMap = new Map(targetRows.map(row => [Number(row.legacy_id), row]));
    if (targetMap.size !== sourceRows.length) throw new Error(`V1/V2 sayısal kayıt sayısı farklı: ${sourceTable}`);
    for (const row of sourceRows) {
      const target = targetMap.get(Number(row.id));
      for (const [from, to] of columns) if (!target || milli(row[from]) !== milli(target[to])) throw new Error(`V1/V2 sayısal alan farklı: ${sourceTable}.${from}`);
    }
    return sourceRows.length * columns.length;
  }
  const inventoryAmountChecks =
    await compareAmounts('inventory_items', 'materials', 'legacy_material_id', [['quantity', 'quantity'], ['minimum_stock', 'minimum_stock']]) +
    await compareAmounts('inventory_transactions', 'loans', 'legacy_loan_id', [['quantity', 'quantity'], ['quantity_returned', 'returned_quantity']]) +
    await compareAmounts('stock_movements', 'stock_movements', 'legacy_movement_id', [['quantity_change', 'delta'], ['balance_after', 'balance_after']]);
  const sourceMaterials = source.prepare('SELECT id, name, slug, sku, brand, model, item_type, unit, public_visibility, is_active FROM inventory_items ORDER BY id').all();
  const [targetMaterials] = await db.query('SELECT legacy_material_id, name, slug, sku, brand, model, kind, unit, public_visibility, is_active FROM materials WHERE legacy_material_id IS NOT NULL');
  const materialMap = new Map(targetMaterials.map(row => [Number(row.legacy_material_id), row]));
  if (materialMap.size !== sourceMaterials.length) throw new Error('V1/V2 malzeme kimlik alanı kayıt sayısı farklı');
  const identityFields = [['name', 'name'], ['slug', 'slug'], ['sku', 'sku'], ['brand', 'brand'], ['model', 'model'], ['unit', 'unit'], ['public_visibility', 'public_visibility'], ['is_active', 'is_active']];
  for (const row of sourceMaterials) {
    const target = materialMap.get(Number(row.id));
    if (!target) throw new Error('V1/V2 malzeme kimliği eksik');
    for (const [from, to] of identityFields) if (row[from] !== target[to]) throw new Error(`V1/V2 malzeme alanı farklı: ${from}`);
    if ((row.item_type === 'fixed_asset' ? 'equipment' : row.item_type) !== target.kind) throw new Error('V1/V2 malzeme türü farklı');
  }
  const materialFieldChecks = sourceMaterials.length * (identityFields.length + 1);
  async function compareRelations(sourceTable, targetTable, legacyColumn, relations) {
    const sourceRows = source.prepare(`SELECT id, ${relations.map(([from]) => from).join(', ')} FROM ${sourceTable}`).all();
    const [targetRows] = await db.query(`SELECT ${legacyColumn} AS legacy_id, ${relations.map(([, to]) => to).join(', ')} FROM ${targetTable} WHERE ${legacyColumn} IS NOT NULL`);
    const targetMap = new Map(targetRows.map(row => [Number(row.legacy_id), row]));
    if (targetMap.size !== sourceRows.length) throw new Error(`V1/V2 ilişki kayıt sayısı farklı: ${sourceTable}`);
    for (const row of sourceRows) {
      const target = targetMap.get(Number(row.id));
      if (!target) throw new Error(`V1/V2 ilişki kaydı eksik: ${sourceTable}`);
      for (const [from, to, mapName] of relations) {
        const mapped = row[from] == null ? null : targetIds.get(mapName).get(Number(row[from]));
        if (mapped === undefined || mapped !== (target[to] == null ? null : Number(target[to]))) throw new Error(`V1/V2 ilişki farklı: ${sourceTable}.${from}`);
      }
    }
    return sourceRows.length * relations.length;
  }
  const inventoryRelationChecks =
    await compareRelations('inventory_items', 'materials', 'legacy_material_id', [['category_id', 'category_id', 'inventory_categories'], ['location_id', 'location_id', 'inventory_locations']]) +
    await compareRelations('inventory_transactions', 'loans', 'legacy_loan_id', [['inventory_item_id', 'material_id', 'inventory_items'], ['issued_by', 'issued_by', 'users'], ['closed_by', 'closed_by', 'users']]) +
    await compareRelations('stock_movements', 'stock_movements', 'legacy_movement_id', [['inventory_item_id', 'material_id', 'inventory_items'], ['user_id', 'actor_id', 'users'], ['reversed_movement_id', 'reversed_movement_id', 'stock_movements']]) +
    await compareRelations('inventory_media', 'material_media', 'legacy_media_id', [['inventory_item_id', 'material_id', 'inventory_items']]);
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
  const totals = Object.entries(report).filter(([table]) => !['permissions', 'permission_role', 'inventoryLegacyImages'].includes(table)).reduce((result, [, row]) => ({ source: result.source + row.source, migrated: result.migrated + row.migrated, excluded: result.excluded + row.excluded }), { source: 0, migrated: 0, excluded: 0 });
  process.stdout.write(`${JSON.stringify({ sourceHash, totals, tables: report, inventoryAmountChecks, materialFieldChecks, inventoryRelationChecks, missingActivitySubjects: Number(audit[0].missing_subjects || 0) })}\n`);
} finally { source.close(); await db.end(); }
