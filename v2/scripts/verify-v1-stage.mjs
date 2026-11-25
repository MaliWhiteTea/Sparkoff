import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import mysql from 'mysql2/promise';

const sourcePath = process.argv[2], sourcePublicPath = process.argv[3], sourcePrivatePath = process.argv[4];
if (!sourcePath) throw new Error('Kullanım: verify-v1-stage.mjs <V1 SQLite> [V1 public dosya kökü] [V1 özel dosya kökü]');
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
  async function compareLookupFields(sourceTable, targetTable, legacyColumn, fields) {
    const sourceRows = source.prepare(`SELECT id, ${fields.join(', ')} FROM ${sourceTable} ORDER BY id`).all();
    const [targetRows] = await db.query(`SELECT ${legacyColumn} AS legacy_id, ${fields.join(', ')} FROM ${targetTable} WHERE ${legacyColumn} IS NOT NULL`);
    const targetMap = new Map(targetRows.map(row => [Number(row.legacy_id), row]));
    if (targetMap.size !== sourceRows.length) throw new Error(`V1/V2 tanım kayıt sayısı farklı: ${sourceTable}`);
    for (const row of sourceRows) {
      const target = targetMap.get(Number(row.id));
      for (const field of fields) {
        const expected = field === 'created_at' || field === 'updated_at' ? sourceUtc(row[field]) : row[field];
        if (!target || expected !== target[field]) throw new Error(`V1/V2 tanım alanı farklı: ${sourceTable}.${field}`);
      }
    }
    return sourceRows.length * fields.length;
  }
  const lookupFieldChecks =
    await compareLookupFields('inventory_categories', 'categories', 'legacy_category_id', ['name', 'slug', 'description', 'sort_order', 'is_active', 'created_at', 'updated_at']) +
    await compareLookupFields('inventory_locations', 'locations', 'legacy_location_id', ['name', 'code', 'description', 'is_public', 'is_active', 'created_at', 'updated_at']);
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
  const sourceMaterials = source.prepare('SELECT id, name, slug, sku, brand, model, item_type, unit, public_visibility, is_active, description, technical_specs, archived_at, created_at, updated_at FROM inventory_items ORDER BY id').all();
  const [targetMaterials] = await db.query('SELECT legacy_material_id, name, slug, sku, brand, model, kind, unit, public_visibility, is_active, is_public, description, technical_specs, archived_at, created_at, updated_at FROM materials WHERE legacy_material_id IS NOT NULL');
  const materialMap = new Map(targetMaterials.map(row => [Number(row.legacy_material_id), row]));
  if (materialMap.size !== sourceMaterials.length) throw new Error('V1/V2 malzeme kimlik alanı kayıt sayısı farklı');
  const identityFields = [['name', 'name'], ['slug', 'slug'], ['sku', 'sku'], ['brand', 'brand'], ['model', 'model'], ['unit', 'unit'], ['public_visibility', 'public_visibility'], ['is_active', 'is_active'], ['description', 'description']];
  for (const row of sourceMaterials) {
    const target = materialMap.get(Number(row.id));
    if (!target) throw new Error('V1/V2 malzeme kimliği eksik');
    for (const [from, to] of identityFields) if (row[from] !== target[to]) throw new Error(`V1/V2 malzeme alanı farklı: ${from}`);
    if ((row.item_type === 'fixed_asset' ? 'equipment' : row.item_type) !== target.kind) throw new Error('V1/V2 malzeme türü farklı');
    if (JSON.stringify(row.technical_specs == null ? null : JSON.parse(row.technical_specs)) !== JSON.stringify(target.technical_specs)) throw new Error('V1/V2 malzeme teknik özellikleri farklı');
    if (Number(target.is_public) !== Number(row.public_visibility !== 'hidden')) throw new Error('V1/V2 malzeme kamu görünürlüğü farklı');
    for (const field of ['archived_at', 'created_at', 'updated_at']) if (sourceUtc(row[field]) !== target[field]) throw new Error(`V1/V2 malzeme zamanı farklı: ${field}`);
  }
  const materialFieldChecks = sourceMaterials.length * (identityFields.length + 6);
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
  const sourceMovements = source.prepare('SELECT id, source_type, source_id FROM stock_movements ORDER BY id').all();
  const [targetMovements] = await db.query('SELECT legacy_movement_id, source_type, source_id FROM stock_movements WHERE legacy_movement_id IS NOT NULL');
  const movementMap = new Map(targetMovements.map(row => [Number(row.legacy_movement_id), row]));
  for (const row of sourceMovements) {
    const target = movementMap.get(Number(row.id));
    const sourceType = row.source_type == null ? null : row.source_type.split('\\').join('/') === 'App/Models/InventoryTransaction' ? 'loan' : undefined;
    const sourceId = sourceType === 'loan' ? targetIds.get('inventory_transactions').get(Number(row.source_id)) : null;
    if (!target || sourceType === undefined || sourceId === undefined || sourceType !== target.source_type || sourceId !== (target.source_id == null ? null : Number(target.source_id))) throw new Error('V1/V2 stok hareketi kaynak bağı farklı');
  }
  const movementSourceChecks = sourceMovements.length * 2;
  const sourceMovementHistory = source.prepare('SELECT id, movement_type, reason, created_at, updated_at FROM stock_movements ORDER BY id').all();
  const [targetMovementHistory] = await db.query('SELECT legacy_movement_id, movement_type, reason, created_at, updated_at FROM stock_movements WHERE legacy_movement_id IS NOT NULL');
  const movementHistoryMap = new Map(targetMovementHistory.map(row => [Number(row.legacy_movement_id), row]));
  function sourceUtc(value) { return value == null ? null : new Date(value.replace(' ', 'T') + '+03:00').toISOString().slice(0, 19).replace('T', ' '); }
  for (const row of sourceMovementHistory) {
    const target = movementHistoryMap.get(Number(row.id));
    if (!target || row.movement_type !== target.movement_type || row.reason !== target.reason || sourceUtc(row.created_at) !== target.created_at || sourceUtc(row.updated_at) !== target.updated_at) throw new Error('V1/V2 stok hareketi geçmiş alanı farklı');
  }
  const movementHistoryChecks = sourceMovementHistory.length * 4;
  const sourceMedia = source.prepare('SELECT id, file_path, external_url, type, title, alt_text, sort_order, is_cover, created_at, updated_at FROM inventory_media ORDER BY id').all();
  const [targetMediaRows] = await db.query('SELECT legacy_media_id, material_id, path, external_url, type, mime, title, alt_text, sort_order, is_cover, created_at, updated_at FROM material_media WHERE legacy_media_id IS NOT NULL');
  const mediaMap = new Map(targetMediaRows.map(row => [Number(row.legacy_media_id), row]));
  const mediaFiles = sourceMedia.filter(row => row.file_path);
  if (mediaFiles.length && (!sourcePublicPath || !process.env.PUBLIC_UPLOAD_DIR)) throw new Error('Medya doğrulaması için kaynak ve hedef dosya kökü gerekli');
  const mediaSourceRoot = mediaFiles.length ? await realpath(resolve(sourcePublicPath)) : null;
  const mediaTargetRoot = mediaFiles.length ? await realpath(resolve(process.env.PUBLIC_UPLOAD_DIR)) : null;
  if (mediaTargetRoot && !mediaTargetRoot.startsWith(resolve('../storage/framework/local-test-v2') + sep)) throw new Error('Medya hedefi yalnız yerel prova dizininde olabilir');
  for (const row of sourceMedia) {
    const target = mediaMap.get(Number(row.id));
    if (!target || row.type !== target.type || row.external_url !== target.external_url || Boolean(row.file_path) !== Boolean(target.path)) throw new Error('V1/V2 envanter medya meta verisi farklı');
    for (const field of ['title', 'alt_text', 'sort_order', 'is_cover', 'created_at', 'updated_at']) {
      const expected = field === 'created_at' || field === 'updated_at' ? sourceUtc(row[field]) : row[field];
      if (expected !== target[field]) throw new Error(`V1/V2 envanter medya alanı farklı: ${field}`);
    }
    if (!row.file_path) {
      if (target.mime !== null) throw new Error('V1/V2 bağlantı medyası MIME alanı farklı');
      continue;
    }
    if (!/^inventory-media\/\d+\/[^/]+\.(jpg|jpeg|png|webp|mp4|webm)$/i.test(row.file_path)) throw new Error('V1 medya yolu geçersiz');
    const materialId = targetIds.get('inventory_items').get(Number(row.file_path.split('/')[1]));
    if (!materialId || materialId !== Number(target.material_id) || !new RegExp(`^inventory-media/${materialId}/[a-f0-9]{32}\\.(jpg|png|webp|mp4|webm)$`).test(target.path)) throw new Error('V2 medya yolu geçersiz');
    const sourceFile = await realpath(resolve(mediaSourceRoot, row.file_path));
    const targetFile = await realpath(resolve(mediaTargetRoot, target.path));
    if (!sourceFile.startsWith(mediaSourceRoot + sep) || !targetFile.startsWith(mediaTargetRoot + sep)) throw new Error('V1/V2 medya dosyası kök dışına çıkıyor');
    const sourceBytes = await readFile(sourceFile), targetBytes = await readFile(targetFile);
    const mime = sourceBytes.length >= 3 && sourceBytes[0] === 255 && sourceBytes[1] === 216 && sourceBytes[2] === 255 ? 'image/jpeg'
      : sourceBytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => sourceBytes[i] === n) ? 'image/png'
      : sourceBytes.length >= 12 && sourceBytes.toString('ascii', 0, 4) === 'RIFF' && sourceBytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp'
      : sourceBytes.length >= 16 && sourceBytes.toString('ascii', 4, 8) === 'ftyp' ? 'video/mp4'
      : sourceBytes.length >= 4 && sourceBytes[0] === 0x1a && sourceBytes[1] === 0x45 && sourceBytes[2] === 0xdf && sourceBytes[3] === 0xa3 ? 'video/webm' : null;
    if (!mime || mime !== target.mime || row.type !== (mime.startsWith('image/') ? 'image' : 'video')) throw new Error('V1/V2 medya gerçek türü veya MIME alanı farklı');
    if (createHash('sha256').update(sourceBytes).digest('hex') !== createHash('sha256').update(targetBytes).digest('hex')) throw new Error('V1/V2 medya dosya özeti farklı');
  }
  const inventoryMediaFiles = mediaFiles.length;
  const inventoryMediaFieldChecks = sourceMedia.length * 6;
  const sourceFeedbackImages = source.prepare('SELECT id, type, message, status, admin_note, handled_by, handled_at, created_at, updated_at, image_path, image_original_name, image_size, image_mime_type FROM feedback_reports ORDER BY id').all();
  const [targetFeedbackImages] = await db.query('SELECT id, legacy_feedback_id, kind, message, status, admin_note, handled_by, handled_at, created_at, updated_at, image_path, image_original_name, image_size, image_mime_type FROM feedbacks WHERE legacy_feedback_id IS NOT NULL');
  const feedbackMap = new Map(targetFeedbackImages.map(row => [Number(row.legacy_feedback_id), row]));
  const feedbackFiles = sourceFeedbackImages.filter(row => row.image_path);
  if (feedbackFiles.length && (!sourcePrivatePath || !process.env.PRIVATE_UPLOAD_DIR)) throw new Error('Geri bildirim görseli doğrulaması için özel dosya kökleri gerekli');
  const feedbackSourceRoot = feedbackFiles.length ? await realpath(resolve(sourcePrivatePath)) : null;
  const feedbackTargetRoot = feedbackFiles.length ? await realpath(resolve(process.env.PRIVATE_UPLOAD_DIR)) : null;
  if (feedbackTargetRoot && !feedbackTargetRoot.startsWith(resolve('../storage/framework/local-test-v2') + sep)) throw new Error('Geri bildirim görseli hedefi yalnız yerel prova dizininde olabilir');
  for (const row of sourceFeedbackImages) {
    const target = feedbackMap.get(Number(row.id));
    const handler = row.handled_by == null ? null : targetIds.get('users').get(Number(row.handled_by));
    if (!target || handler === undefined || row.type !== target.kind || row.message !== target.message || row.status !== target.status || row.admin_note !== target.admin_note || handler !== (target.handled_by == null ? null : Number(target.handled_by)) || sourceUtc(row.handled_at) !== target.handled_at || sourceUtc(row.created_at) !== target.created_at || sourceUtc(row.updated_at) !== target.updated_at) throw new Error('V1/V2 geri bildirim iş alanı farklı');
    if (!target || Boolean(row.image_path) !== Boolean(target.image_path) || row.image_original_name !== target.image_original_name || row.image_size !== target.image_size || row.image_mime_type !== target.image_mime_type) throw new Error('V1/V2 geri bildirim görsel meta verisi farklı');
    if (!row.image_path) continue;
    if (!/^feedback\/\d+\/[^/]+\.(jpg|jpeg|png|webp)$/i.test(row.image_path) || Number(row.image_path.split('/')[1]) !== Number(row.id) || !new RegExp(`^feedback/${target.id}/[a-f0-9]{32}\\.(jpg|png|webp)$`).test(target.image_path)) throw new Error('V1/V2 geri bildirim görsel yolu geçersiz');
    const sourceFile = await realpath(resolve(feedbackSourceRoot, row.image_path));
    const targetFile = await realpath(resolve(feedbackTargetRoot, target.image_path));
    if (!sourceFile.startsWith(feedbackSourceRoot + sep) || !targetFile.startsWith(feedbackTargetRoot + sep)) throw new Error('V1/V2 geri bildirim görseli kök dışına çıkıyor');
    const sourceBytes = await readFile(sourceFile), targetBytes = await readFile(targetFile);
    if (sourceBytes.length !== Number(row.image_size) || targetBytes.length !== sourceBytes.length || createHash('sha256').update(sourceBytes).digest('hex') !== createHash('sha256').update(targetBytes).digest('hex')) throw new Error('V1/V2 geri bildirim görsel dosya özeti farklı');
    const actualMime = sourceBytes.length >= 3 && sourceBytes[0] === 255 && sourceBytes[1] === 216 && sourceBytes[2] === 255 ? 'image/jpeg'
      : sourceBytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => sourceBytes[i] === n) ? 'image/png'
      : sourceBytes.length >= 12 && sourceBytes.toString('ascii', 0, 4) === 'RIFF' && sourceBytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
    if (!actualMime || actualMime !== row.image_mime_type) throw new Error('V1 geri bildirim görselinin gerçek MIME türü farklı');
  }
  const feedbackImageFiles = feedbackFiles.length;
  const feedbackFieldChecks = sourceFeedbackImages.length * 9;
  const sourceLoans = source.prepare('SELECT id, item_type, status, issued_at, due_at, completed_at, anonymized_at, created_at, updated_at, notes, closure_note FROM inventory_transactions ORDER BY id').all();
  const [targetLoanRows] = await db.query('SELECT legacy_loan_id, item_type, status, issued_at, due_at, closed_at, anonymized_at, created_at, updated_at, notes, closure_note FROM loans WHERE legacy_loan_id IS NOT NULL');
  const loanMap = new Map(targetLoanRows.map(row => [Number(row.legacy_loan_id), row]));
  if (loanMap.size !== sourceLoans.length) throw new Error('V1/V2 teslim alanı kayıt sayısı farklı');
  const loanDates = [['issued_at', 'issued_at'], ['due_at', 'due_at'], ['completed_at', 'closed_at'], ['anonymized_at', 'anonymized_at'], ['created_at', 'created_at'], ['updated_at', 'updated_at']];
  for (const row of sourceLoans) {
    const target = loanMap.get(Number(row.id));
    if (!target || (row.item_type === 'fixed_asset' ? 'equipment' : row.item_type) !== target.item_type || (row.status === 'active' ? 'open' : row.status) !== target.status || row.notes !== target.notes || row.closure_note !== target.closure_note) throw new Error('V1/V2 teslim iş alanı farklı');
    for (const [from, to] of loanDates) if (sourceUtc(row[from]) !== target[to]) throw new Error(`V1/V2 teslim zamanı farklı: ${from}`);
  }
  const loanFieldChecks = sourceLoans.length * 10;
  async function comparePrinterFields(sourceTable, targetTable, legacyColumn, fields) {
    const sourceRows = source.prepare(`SELECT id, ${fields.map(([from]) => from).join(', ')} FROM ${sourceTable}`).all();
    const [targetRows] = await db.query(`SELECT ${legacyColumn} AS legacy_id, ${fields.map(([, to]) => to).join(', ')} FROM ${targetTable} WHERE ${legacyColumn} IS NOT NULL`);
    const targetMap = new Map(targetRows.map(row => [Number(row.legacy_id), row]));
    if (targetMap.size !== sourceRows.length) throw new Error(`V1/V2 yazıcı alanı kayıt sayısı farklı: ${sourceTable}`);
    for (const row of sourceRows) {
      const target = targetMap.get(Number(row.id));
      for (const [from, to, kind] of fields) {
        const expected = kind === 'date' ? sourceUtc(row[from]) : kind === 'diameter' ? Number(row[from]).toFixed(2) : row[from];
        if (!target || expected !== target[to]) throw new Error(`V1/V2 yazıcı alanı farklı: ${sourceTable}.${from}`);
      }
    }
    return sourceRows.length * fields.length;
  }
  const printerFieldChecks =
    await comparePrinterFields('printers', 'printers', 'legacy_printer_id', [['code', 'code'], ['name', 'name'], ['status', 'status'], ['description', 'description'], ['sort_order', 'sort_order'], ['created_at', 'created_at', 'date'], ['updated_at', 'updated_at', 'date']]) +
    await comparePrinterFields('filaments', 'filaments', 'legacy_filament_id', [['material', 'name'], ['color', 'color'], ['brand', 'brand'], ['is_available', 'available'], ['diameter_mm', 'diameter_mm', 'diameter'], ['spool_weight_grams', 'spool_weight_grams'], ['nozzle_temp_min', 'nozzle_temp_min'], ['nozzle_temp_max', 'nozzle_temp_max'], ['bed_temp_min', 'bed_temp_min'], ['bed_temp_max', 'bed_temp_max'], ['technical_notes', 'technical_notes'], ['unavailable_reason', 'unavailable_reason'], ['sort_order', 'sort_order'], ['created_at', 'created_at', 'date'], ['updated_at', 'updated_at', 'date']]) +
    await comparePrinterFields('operating_hours', 'operating_hours', 'legacy_operating_hour_id', [['weekday', 'weekday'], ['is_open', 'is_open'], ['opens_at', 'opens_at'], ['latest_start_at', 'latest_start_at'], ['created_at', 'created_at', 'date'], ['updated_at', 'updated_at', 'date']]);
  const settingRows = source.prepare('SELECT key, value, updated_at FROM settings ORDER BY key').all();
  const [targetSettings] = await db.query('SELECT `key`, value, updated_at FROM system_settings ORDER BY `key`');
  if (settingRows.length !== targetSettings.length || settingRows.some((row, index) => row.key !== targetSettings[index].key || JSON.stringify(JSON.parse(row.value)) !== JSON.stringify(targetSettings[index].value) || sourceUtc(row.updated_at) !== targetSettings[index].updated_at)) throw new Error('V1/V2 ayar anahtarı, JSON değeri veya zamanı farklı');
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
  const sourceAnnouncements = source.prepare('SELECT id, title, body, type, placement, audience, is_published, is_pinned, requires_acknowledgement, starts_at, ends_at, created_at, updated_at FROM announcements ORDER BY id').all();
  const [targetAnnouncements] = await db.query('SELECT legacy_announcement_id, title, body, type, placement, audience, is_published, pinned, requires_acknowledgement, starts_at, ends_at, published_at, expires_at, unit_id, created_by, created_at, updated_at FROM announcements WHERE legacy_announcement_id IS NOT NULL');
  const announcementMap = new Map(targetAnnouncements.map(row => [Number(row.legacy_announcement_id), row]));
  if (announcementMap.size !== sourceAnnouncements.length) throw new Error('V1/V2 duyuru alanı kayıt sayısı farklı');
  for (const row of sourceAnnouncements) {
    const target = announcementMap.get(Number(row.id));
    if (!target || row.title !== target.title || row.body !== target.body || row.type !== target.type || row.placement !== target.placement || (row.audience === 'staff' ? 'internal' : row.audience) !== target.audience || Number(row.is_published) !== Number(target.is_published) || Number(row.is_pinned) !== Number(target.pinned) || Number(row.requires_acknowledgement) !== Number(target.requires_acknowledgement) || sourceUtc(row.starts_at) !== target.starts_at || sourceUtc(row.ends_at) !== target.ends_at || sourceUtc(row.created_at) !== target.created_at || sourceUtc(row.updated_at) !== target.updated_at || (row.is_published ? sourceUtc(row.created_at) : null) !== target.published_at || target.expires_at !== null || target.unit_id !== null || target.created_by !== null) throw new Error('V1/V2 duyuru içerik veya yayın alanı farklı');
  }
  const announcementFieldChecks = sourceAnnouncements.length * 16;
  const sourceAnnouncementReads = source.prepare('SELECT announcement_id, user_id, read_at, acknowledged_at FROM announcement_user').all();
  const [targetAnnouncementReads] = await db.query('SELECT announcement_id, user_id, read_at, acknowledged_at FROM announcement_reads');
  const readMap = new Map(targetAnnouncementReads.map(row => [`${row.announcement_id}:${row.user_id}`, row]));
  if (readMap.size !== sourceAnnouncementReads.length) throw new Error('V1/V2 duyuru okundu zamanı kayıt sayısı farklı');
  for (const row of sourceAnnouncementReads) {
    const announcementId = targetIds.get('announcements').get(Number(row.announcement_id));
    const userId = targetIds.get('users').get(Number(row.user_id));
    const target = readMap.get(`${announcementId}:${userId}`);
    if (!target || sourceUtc(row.read_at) !== target.read_at || sourceUtc(row.acknowledged_at) !== target.acknowledged_at) throw new Error('V1/V2 duyuru okundu veya onay zamanı farklı');
  }
  const announcementReadChecks = sourceAnnouncementReads.length * 2;
  const sourceAppointments = source.prepare('SELECT * FROM appointments ORDER BY id').all();
  const [targetAppointments] = await db.query('SELECT * FROM appointments WHERE legacy_appointment_id IS NOT NULL');
  const appointmentMap = new Map(targetAppointments.map(row => [Number(row.legacy_appointment_id), row]));
  if (appointmentMap.size !== sourceAppointments.length) throw new Error('V1/V2 randevu alanı kayıt sayısı farklı');
  const appointmentScalars = ['public_id', 'status', 'first_name', 'last_name', 'email', 'phone', 'duration_minutes', 'filament_source', 'filament_material', 'filament_color', 'user_note', 'admin_note', 'verification_token_hash', 'privacy_notice_version', 'retention_exemption_reason'];
  const appointmentDates = ['starts_at', 'ends_at', 'email_verified_at', 'verification_expires_at', 'canceled_at', 'privacy_notice_seen_at', 'rules_accepted_at', 'retention_exempt_until', 'created_at', 'updated_at'];
  for (const row of sourceAppointments) {
    const target = appointmentMap.get(Number(row.id));
    if (!target) throw new Error('V1/V2 randevu kaydı eksik');
    for (const field of appointmentScalars) if (row[field] !== target[field]) throw new Error(`V1/V2 randevu alanı farklı: ${field}`);
    for (const field of appointmentDates) if (sourceUtc(row[field]) !== target[field]) throw new Error(`V1/V2 randevu zamanı farklı: ${field}`);
    const printerId = targetIds.get('printers').get(Number(row.printer_id));
    const filamentId = row.filament_id == null ? null : targetIds.get('filaments').get(Number(row.filament_id));
    if (printerId === undefined || filamentId === undefined || printerId !== Number(target.printer_id) || filamentId !== (target.filament_id == null ? null : Number(target.filament_id))) throw new Error('V1/V2 randevu yazıcı veya filament bağı farklı');
    if (row.tracking_token_hash !== target.track_token_hash || target.name !== null || target.model_path !== null) throw new Error('V1/V2 randevu türetilmiş alanı farklı');
  }
  const appointmentFieldChecks = sourceAppointments.length * (appointmentScalars.length + appointmentDates.length + 5);
  const sourceAppointmentFiles = source.prepare('SELECT * FROM appointment_files ORDER BY id').all();
  const [targetAppointmentFiles] = await db.query('SELECT * FROM appointment_files WHERE legacy_appointment_file_id IS NOT NULL');
  const appointmentFileMap = new Map(targetAppointmentFiles.map(row => [Number(row.legacy_appointment_file_id), row]));
  if (appointmentFileMap.size !== sourceAppointmentFiles.length) throw new Error('V1/V2 randevu dosyası kayıt sayısı farklı');
  const activeAppointmentFiles = sourceAppointmentFiles.filter(row => row.deleted_at == null);
  if (activeAppointmentFiles.length && (!sourcePrivatePath || !process.env.PRIVATE_UPLOAD_DIR)) throw new Error('Randevu dosyası için özel dosya kökleri gerekli');
  const appointmentSourceRoot = activeAppointmentFiles.length ? await realpath(resolve(sourcePrivatePath)) : null;
  const appointmentTargetRoot = activeAppointmentFiles.length ? await realpath(resolve(process.env.PRIVATE_UPLOAD_DIR)) : null;
  if (appointmentTargetRoot && !appointmentTargetRoot.startsWith(resolve('../storage/framework/local-test-v2') + sep)) throw new Error('Randevu dosyası hedefi yalnız yerel prova dizininde olabilir');
  for (const row of sourceAppointmentFiles) {
    const target = appointmentFileMap.get(Number(row.id));
    const appointmentId = targetIds.get('appointments').get(Number(row.appointment_id));
    if (!target || appointmentId === undefined || appointmentId !== Number(target.appointment_id)) throw new Error('V1/V2 randevu dosyası bağı farklı');
    for (const field of ['disk', 'path', 'original_name', 'mime_type']) if (row[field] !== target[field]) throw new Error(`V1/V2 randevu dosyası alanı farklı: ${field}`);
    if (row.extension?.toLowerCase() !== target.extension || Number(row.size_bytes) !== Number(target.size_bytes)) throw new Error('V1/V2 randevu dosyası uzantısı veya boyutu farklı');
    for (const field of ['scheduled_deletion_at', 'deleted_at', 'created_at', 'updated_at']) if (sourceUtc(row[field]) !== target[field]) throw new Error(`V1/V2 randevu dosyası zamanı farklı: ${field}`);
    if (!/^appointments\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(gcode|3mf|stl|step|stp|obj)$/i.test(row.path)) throw new Error('V1 randevu dosyası yolu geçersiz');
    if (row.deleted_at != null) continue;
    const sourceFile = await realpath(resolve(appointmentSourceRoot, row.path));
    const targetFile = await realpath(resolve(appointmentTargetRoot, target.path));
    if (!sourceFile.startsWith(appointmentSourceRoot + sep) || !targetFile.startsWith(appointmentTargetRoot + sep)) throw new Error('V1/V2 randevu dosyası kök dışına çıkıyor');
    const sourceBytes = await readFile(sourceFile), targetBytes = await readFile(targetFile);
    if (sourceBytes.length !== Number(row.size_bytes) || targetBytes.length !== sourceBytes.length || createHash('sha256').update(sourceBytes).digest('hex') !== createHash('sha256').update(targetBytes).digest('hex')) throw new Error('V1/V2 randevu dosyası özeti farklı');
  }
  const appointmentFileChecks = sourceAppointmentFiles.length * 11;
  const sourceAppointmentHistory = source.prepare('SELECT * FROM appointment_status_histories ORDER BY id').all();
  const [targetAppointmentHistory] = await db.query('SELECT * FROM appointment_status_histories WHERE legacy_appointment_history_id IS NOT NULL');
  const appointmentHistoryMap = new Map(targetAppointmentHistory.map(row => [Number(row.legacy_appointment_history_id), row]));
  if (appointmentHistoryMap.size !== sourceAppointmentHistory.length) throw new Error('V1/V2 randevu geçmişi kayıt sayısı farklı');
  for (const row of sourceAppointmentHistory) {
    const target = appointmentHistoryMap.get(Number(row.id));
    const appointmentId = targetIds.get('appointments').get(Number(row.appointment_id));
    const actorId = row.actor_id == null ? null : targetIds.get('users').get(Number(row.actor_id));
    if (!target || appointmentId === undefined || actorId === undefined || appointmentId !== Number(target.appointment_id) || actorId !== (target.actor_id == null ? null : Number(target.actor_id)) || row.from_status !== target.from_status || row.to_status !== target.to_status || row.note !== target.note || sourceUtc(row.created_at) !== target.created_at || sourceUtc(row.updated_at) !== target.updated_at) throw new Error('V1/V2 randevu geçmişi alanı farklı');
  }
  const appointmentHistoryChecks = sourceAppointmentHistory.length * 7;
  const permissions = source.prepare('SELECT id, key FROM permissions').all();
  const permissionKeys = new Map(permissions.map(row => [row.id, row.key]));
  const permissionLinks = source.prepare('SELECT role_id, permission_id FROM permission_role').all();
  const permissionMapping = JSON.parse(await readFile(new URL('./v1-role-permission-map.json', import.meta.url), 'utf8'));
  const [roleRows] = await db.query('SELECT legacy_role_id, legacy_permission_keys, permissions, tabs FROM custom_roles WHERE legacy_role_id IS NOT NULL');
  let effectivePermissionChecks = 0;
  for (const role of roleRows) {
    const expected = permissionLinks.filter(link => link.role_id === Number(role.legacy_role_id)).map(link => permissionKeys.get(link.permission_id)).sort();
    const actual = (typeof role.legacy_permission_keys === 'string' ? JSON.parse(role.legacy_permission_keys) : role.legacy_permission_keys).slice().sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('V1/V2 rol kaynak izinleri farklı');
    const mapped = [...new Set(expected.map(key => permissionMapping[key]).filter(Boolean))].sort();
    const effective = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
    if (!Array.isArray(effective) || effective.length !== mapped.length || JSON.stringify([...effective].sort()) !== JSON.stringify(mapped)) throw new Error('V1/V2 rol etkin izinleri farklı');
    const tabs = new Set();
    for (const key of mapped) {
      if (/^(inventory_|loans_)/.test(key)) tabs.add('inventory');
      if (/^(printers_|appointments_)/.test(key)) tabs.add('board');
      if (/^(users_|roles_)/.test(key)) tabs.add('members');
      if (/^(announcements_|staff_announcements_)/.test(key)) tabs.add('announcements');
      if (/^(audit_logs_|privacy_settings_|workshop_settings_|system_settings_)/.test(key)) tabs.add('board');
    }
    const actualTabs = typeof role.tabs === 'string' ? JSON.parse(role.tabs) : role.tabs;
    if (!Array.isArray(actualTabs) || actualTabs.length !== tabs.size || JSON.stringify([...actualTabs].sort()) !== JSON.stringify([...tabs].sort())) throw new Error('V1/V2 rol etkin sekmeleri farklı');
    effectivePermissionChecks += mapped.length + tabs.size;
  }
  report.permissions = { source: permissions.length, migratedMetadata: permissions.length, excluded: 0 };
  report.permission_role = { source: permissionLinks.length, migratedMetadata: permissionLinks.length, excluded: 0 };
  const sourceRoles = source.prepare('SELECT id, name, slug, description, is_system, is_protected, created_at, updated_at FROM roles').all();
  const [targetRoles] = await db.query('SELECT legacy_role_id, name, legacy_slug, description, is_system, is_protected, created_at, updated_at FROM custom_roles WHERE legacy_role_id IS NOT NULL');
  const targetRoleMap = new Map(targetRoles.map(role => [Number(role.legacy_role_id), role]));
  function utc(value) { return new Date(value.replace(' ', 'T') + '+03:00').toISOString().slice(0, 19).replace('T', ' '); }
  for (const role of sourceRoles) {
    const target = targetRoleMap.get(role.id);
    if (!target || role.name !== target.name || role.slug !== target.legacy_slug || role.description !== target.description || Number(role.is_system) !== Number(target.is_system) || Number(role.is_protected) !== Number(target.is_protected) || utc(role.created_at) !== target.created_at || utc(role.updated_at) !== target.updated_at) throw new Error('V1/V2 rol kimliği, bayrağı veya zamanı farklı');
  }
  const roleFieldChecks = sourceRoles.length * 7;
  const sourceUsers = source.prepare('SELECT id, name, email, password, role, is_active, email_verified_at, interface_preferences, table_preferences, saved_filters, created_at, updated_at FROM users').all();
  const [targetUsers] = await db.query('SELECT legacy_user_id, name, email, password_hash, global_role, is_active, legacy_role_label, email_verified_at, preferences, created_at, updated_at FROM users WHERE legacy_user_id IS NOT NULL');
  const targetUserMap = new Map(targetUsers.map(user => [Number(user.legacy_user_id), user]));
  const systemRoleIds = new Set(sourceRoles.filter(role => role.is_system).map(role => role.id));
  const sourceRoleLinks = source.prepare('SELECT user_id, role_id FROM role_user').all();
  const systemUsers = new Set(sourceRoleLinks.filter(link => systemRoleIds.has(link.role_id)).map(link => link.user_id));
  for (const user of sourceUsers) {
    const target = targetUserMap.get(user.id);
    const parse = value => value == null ? null : JSON.parse(value);
    const expectedPreferences = { v1: { interfacePreferences: parse(user.interface_preferences), tablePreferences: parse(user.table_preferences), savedFilters: parse(user.saved_filters) } };
    if (!target || target.name !== user.name || target.email !== user.email.trim().toLowerCase() || target.password_hash !== user.password || target.global_role !== (systemUsers.has(user.id) ? 'super_admin' : 'member') || Number(target.is_active) !== Number(user.is_active) || target.legacy_role_label !== user.role || target.email_verified_at !== (user.email_verified_at == null ? null : utc(user.email_verified_at)) || target.created_at !== utc(user.created_at) || target.updated_at !== utc(user.updated_at) || JSON.stringify(target.preferences) !== JSON.stringify(expectedPreferences)) throw new Error('V1/V2 kullanıcı hesap alanı, tercihi veya zamanı farklı');
  }
  const userFieldChecks = sourceUsers.length * 10;
  const auditSubjects = new Map([
    ['App/Models/InventoryCategory', ['category', 'inventory_categories']],
    ['App/Models/InventoryItem', ['material', 'inventory_items']],
    ['App/Models/InventoryMedia', ['material_media', 'inventory_media']],
    ['App/Models/InventoryTransaction', ['loan', 'inventory_transactions']],
    ['App/Models/Printer', ['printer', 'printers']],
    ['App/Models/Role', ['role', 'roles']],
    ['App/Models/User', ['user', 'users']],
    ['App/Models/FeedbackReport', ['feedback', 'feedback_reports']],
  ]);
  const sourceAudit = source.prepare('SELECT id, user_id, action, subject_type, subject_id, changed_fields, created_at FROM activity_logs ORDER BY id').all();
  const [targetAudit] = await db.query('SELECT legacy_activity_log_id, actor_id, action, entity, entity_id, `before`, `after`, created_at FROM audit_logs WHERE legacy_activity_log_id IS NOT NULL');
  const auditMap = new Map(targetAudit.map(row => [Number(row.legacy_activity_log_id), row]));
  if (auditMap.size !== sourceAudit.length) throw new Error('V1/V2 etkinlik alanı kayıt sayısı farklı');
  for (const row of sourceAudit) {
    const target = auditMap.get(Number(row.id));
    const subject = auditSubjects.get(row.subject_type?.split('\\').join('/'));
    if (!subject) throw new Error('V1 etkinlik konu türü eşlenemedi');
    const actorId = targetIds.get('users').get(Number(row.user_id));
    const entityId = row.subject_id == null ? null : targetIds.get(subject[1]).get(Number(row.subject_id)) ?? null;
    const after = { legacySubjectType: row.subject_type, legacySubjectId: row.subject_id, changedFields: row.changed_fields == null ? null : JSON.parse(row.changed_fields), subjectPresent: entityId !== null };
    if (!target || actorId !== Number(target.actor_id) || `legacy.${row.action}` !== target.action || subject[0] !== target.entity || entityId !== (target.entity_id == null ? null : Number(target.entity_id)) || target.before !== null || JSON.stringify(after) !== JSON.stringify(target.after) || sourceUtc(row.created_at) !== target.created_at) throw new Error('V1/V2 etkinlik geçmiş alanı farklı');
  }
  const auditFieldChecks = sourceAudit.length * 7;
  const [audit] = await db.query('SELECT SUM(entity_id IS NULL) AS missing_subjects, SUM(actor_id IS NULL) AS missing_actors FROM audit_logs WHERE legacy_activity_log_id IS NOT NULL');
  if (Number(audit[0].missing_actors || 0)) throw new Error('V1 etkinlik kullanıcı bağı eksik');
  const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
  const totals = Object.entries(report).filter(([table]) => !['permissions', 'permission_role', 'inventoryLegacyImages'].includes(table)).reduce((result, [, row]) => ({ source: result.source + row.source, migrated: result.migrated + row.migrated, excluded: result.excluded + row.excluded }), { source: 0, migrated: 0, excluded: 0 });
  process.stdout.write(`${JSON.stringify({ sourceHash, totals, tables: report, roleFieldChecks, userFieldChecks, effectivePermissionChecks, lookupFieldChecks, inventoryAmountChecks, materialFieldChecks, inventoryRelationChecks, movementSourceChecks, movementHistoryChecks, inventoryMediaFiles, inventoryMediaFieldChecks, feedbackImageFiles, feedbackFieldChecks, loanFieldChecks, printerFieldChecks, announcementFieldChecks, announcementReadChecks, appointmentFieldChecks, appointmentFileChecks, appointmentHistoryChecks, auditFieldChecks, missingActivitySubjects: Number(audit[0].missing_subjects || 0) })}\n`);
} finally { source.close(); await db.end(); }
