import { DatabaseSync } from 'node:sqlite';
import { createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import mysql from 'mysql2/promise';

const [sourcePath, sourcePublicRoot, keyFile] = process.argv.slice(2).filter(value => value !== '--apply');
const apply = process.argv.includes('--apply');
if (!sourcePath || !sourcePublicRoot || !keyFile) throw new Error('Kullanım: stage-v1-inventory.mjs <V1 SQLite> <V1 public dosya kökü> <V1 .env> [--apply]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Envanter provası yalnız ayrı yerel migration veritabanında çalışır');
const targetRoot = resolve(process.env.PUBLIC_UPLOAD_DIR || '');
if (!process.env.PUBLIC_UPLOAD_DIR || !targetRoot.startsWith(resolve('../storage/framework/local-test-v2') + sep)) throw new Error('Hedef medya kökü yalnız yerel prova dizininde olabilir');
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let data;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  data = Object.fromEntries([
    ['categories', 'inventory_categories'], ['locations', 'inventory_locations'], ['materials', 'inventory_items'],
    ['loans', 'inventory_transactions'], ['movements', 'stock_movements'], ['media', 'inventory_media'],
  ].map(([name, table]) => [name, source.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
} finally { source.close(); }
const summary = Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length]));
const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
if (!apply) { process.stdout.write(`${JSON.stringify({ ...summary, sourceHash, applied: false })}\n`); process.exit(0); }
const keyLine = (await readFile(resolve(keyFile), 'utf8')).split(/\r?\n/).find(line => /^APP_KEY=/.test(line));
const keyText = keyLine?.slice(8).trim().replace(/^['"]|['"]$/g, '');
if (!keyText?.startsWith('base64:')) throw new Error('V1 APP_KEY bulunamadı veya biçimi geçersiz');
const key = Buffer.from(keyText.slice(7), 'base64');
if (key.length !== 32) throw new Error('V1 APP_KEY uzunluğu geçersiz');
function decrypt(value) {
  if (value == null) return null;
  const payload = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  if (typeof payload.iv !== 'string' || typeof payload.value !== 'string' || typeof payload.mac !== 'string') throw new Error('V1 şifreli alan geçersiz');
  const expected = createHmac('sha256', key).update(payload.iv + payload.value).digest();
  const actual = Buffer.from(payload.mac, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('V1 şifreli alan MAC doğrulaması başarısız');
  const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(payload.iv, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.value, 'base64')), decipher.final()]).toString('utf8');
}
function date(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 tarih biçimi geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime())) throw new Error('V1 tarih değeri geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
function decimal(value) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 999999999999 || Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-7) throw new Error('V1 stok hassasiyeti geçersiz');
  return value.toFixed(3);
}
function imageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', mime: 'image/jpeg' };
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return { extension: 'png', mime: 'image/png' };
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' };
  if (bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp') return { extension: 'mp4', mime: 'video/mp4' };
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return { extension: 'webm', mime: 'video/webm' };
  return null;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceRoot = await realpath(resolve(sourcePublicRoot));
await mkdir(targetRoot, { recursive: true, mode: 0o700 });
if (await realpath(targetRoot) !== targetRoot) throw new Error('Hedef medya kökü symlink olamaz');
const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
const savedFiles = [];
const maps = { categories: new Map(), locations: new Map(), materials: new Map(), loans: new Map(), movements: new Map(), media: new Map() };
let inserted = 0, existing = 0;
async function stage(table, legacyColumn, sourceId, fields) {
  if (!Number.isSafeInteger(sourceId) || sourceId <= 0) throw new Error('V1 kaynak kimliği geçersiz');
  const [rows] = await connection.execute(`SELECT * FROM ${table} WHERE ${legacyColumn}=? FOR UPDATE`, [sourceId]);
  if (rows.length > 1) throw new Error('V2 kaynak kimliği yinelenmiş');
  if (rows.length) {
    const row = rows[0];
    for (const [column, value] of Object.entries(fields)) {
      const expected = value == null ? null : String(value);
      const actual = row[column] == null ? null : String(row[column]);
      if (actual !== expected) throw new Error(`V2 prova kaydı kaynakla farklı: ${table}.${column}`);
    }
    existing++;
    return Number(row.id);
  }
  const columns = [legacyColumn, ...Object.keys(fields)];
  const values = [sourceId, ...Object.values(fields)];
  const [result] = await connection.execute(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values);
  inserted++;
  return Number(result.insertId);
}
function mapped(map, sourceId, field) {
  if (sourceId == null) return null;
  const id = map.get(sourceId);
  if (!id) throw new Error(`V1 ${field} bağı hedefte bulunamadı`);
  return id;
}
try {
  await connection.query("SET time_zone = '+00:00'");
  await connection.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
  await connection.beginTransaction();
  for (const table of ['categories', 'locations', 'materials', 'loans', 'stock_movements', 'material_media']) {
    const [rows] = await connection.execute(`SELECT COUNT(*) AS total FROM ${table} WHERE ${table === 'categories' ? 'legacy_category_id' : table === 'locations' ? 'legacy_location_id' : table === 'materials' ? 'legacy_material_id' : table === 'loans' ? 'legacy_loan_id' : table === 'stock_movements' ? 'legacy_movement_id' : 'legacy_media_id'} IS NULL`);
    if (Number(rows[0].total)) throw new Error('Prova veritabanında kaynak dışı envanter kaydı var');
  }
  const [userRows] = await connection.execute('SELECT id, legacy_user_id FROM users WHERE legacy_user_id IS NOT NULL');
  const users = new Map(userRows.map(row => [Number(row.legacy_user_id), Number(row.id)]));
  for (const row of data.categories) maps.categories.set(row.id, await stage('categories', 'legacy_category_id', row.id, { name: row.name, slug: row.slug, description: row.description, sort_order: row.sort_order, is_active: row.is_active, created_at: date(row.created_at), updated_at: date(row.updated_at) }));
  for (const row of data.locations) maps.locations.set(row.id, await stage('locations', 'legacy_location_id', row.id, { name: row.name, code: row.code, description: row.description, is_public: row.is_public, is_active: row.is_active, created_at: date(row.created_at), updated_at: date(row.updated_at) }));
  for (const row of data.materials) {
    const specs = row.technical_specs == null ? null : JSON.stringify(JSON.parse(row.technical_specs));
    const kind = row.item_type === 'fixed_asset' ? 'equipment' : row.item_type;
    if (!['consumable', 'loanable', 'equipment'].includes(kind) || !['exact', 'status', 'hidden'].includes(row.public_visibility)) throw new Error('V1 malzeme türü veya görünürlüğü geçersiz');
    const materialId = await stage('materials', 'legacy_material_id', row.id, { name: row.name, slug: row.slug, sku: row.sku, brand: row.brand, model: row.model, kind, unit: row.unit, category_id: mapped(maps.categories, row.category_id, 'kategori'), location_id: mapped(maps.locations, row.location_id, 'konum'), quantity: decimal(row.quantity), minimum_stock: decimal(row.minimum_stock), public_visibility: row.public_visibility, is_public: row.public_visibility === 'hidden' ? 0 : 1, description: row.description, technical_specs: specs, is_active: row.is_active, archived_at: date(row.archived_at), created_at: date(row.created_at), updated_at: date(row.updated_at) });
    maps.materials.set(row.id, materialId);
    const [stored] = await connection.execute('SELECT image_path FROM materials WHERE id=? FOR UPDATE', [materialId]);
    if (!row.image_path) {
      if (stored[0].image_path) throw new Error('V1 eski malzeme görseli kaynakta yok, hedefte var');
      continue;
    }
    if (typeof row.image_path !== 'string' || row.image_path.length > 512 || row.image_path.startsWith('/') || row.image_path.includes('\\') || row.image_path.split('/').some(part => !part || part === '.' || part === '..') || /[\u0000-\u001f\u007f]/.test(row.image_path) || !/\.(jpg|jpeg|png|webp)$/i.test(row.image_path)) throw new Error('V1 eski malzeme görsel yolu geçersiz');
    const sourceImagePath = await realpath(resolve(sourceRoot, row.image_path));
    if (!sourceImagePath.startsWith(sourceRoot + sep)) throw new Error('V1 eski malzeme görseli kaynak kök dışına çıkıyor');
    const bytes = await readFile(sourceImagePath);
    const type = imageType(bytes);
    if (!type?.mime.startsWith('image/') || bytes.length > 8 * 1024 * 1024) throw new Error('V1 eski malzeme görselinin türü veya boyutu geçersiz');
    const relative = `inventory-legacy/${materialId}/${sha(bytes)}.${type.extension}`;
    if (stored[0].image_path) {
      if (stored[0].image_path !== relative) throw new Error('Önceden taşınan eski malzeme görsel yolu farklı');
      const actual = await realpath(resolve(targetRoot, relative));
      if (!actual.startsWith(targetRoot + sep) || sha(await readFile(actual)) !== sha(bytes)) throw new Error('Önceden taşınan eski malzeme görseli farklı');
      continue;
    }
    const target = resolve(targetRoot, relative);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    if (!(await realpath(dirname(target))).startsWith(targetRoot + sep)) throw new Error('Hedef eski malzeme görsel yolu kök dışına çıkıyor');
    await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
    savedFiles.push(target);
    if (sha(await readFile(target)) !== sha(bytes)) throw new Error('Hedef eski malzeme görseli hash doğrulaması başarısız');
    await connection.execute('UPDATE materials SET image_path=? WHERE id=?', [relative, materialId]);
  }
  for (const row of data.loans) {
    const name = decrypt(row.recipient_name), email = decrypt(row.recipient_email);
    if (row.anonymized_at && (name || email || row.notes || row.closure_note)) throw new Error('Anonimleştirilmiş teslimde kişi verisi var');
    if (name && name.length > 500 || email && email.length > 255) throw new Error('V1 teslim kişi alanı hedef sınırını aşıyor');
    const kind = row.item_type === 'fixed_asset' ? 'equipment' : row.item_type;
    const status = row.status === 'active' ? 'open' : row.status;
    if (!['consumable', 'loanable', 'equipment'].includes(kind) || !['open', 'completed', 'damaged', 'lost', 'reversed'].includes(status)) throw new Error('V1 teslim türü veya durumu geçersiz');
    maps.loans.set(row.id, await stage('loans', 'legacy_loan_id', row.id, { material_id: mapped(maps.materials, row.inventory_item_id, 'malzeme'), borrower_first_name: null, borrower_last_name: null, borrower_name_original: name, borrower_email: email, issued_by: mapped(users, row.issued_by, 'düzenleyen kullanıcı'), closed_by: mapped(users, row.closed_by, 'kapatan kullanıcı'), item_type: kind, quantity: decimal(row.quantity), returned_quantity: decimal(row.quantity_returned), status, issued_at: date(row.issued_at), due_at: date(row.due_at), closed_at: date(row.completed_at), anonymized_at: date(row.anonymized_at), notes: row.notes, closure_note: row.closure_note, created_at: date(row.created_at), updated_at: date(row.updated_at) }));
  }
  for (const row of data.movements) {
    const sourceType = row.source_type == null ? null : row.source_type === 'App\\Models\\InventoryTransaction' ? 'loan' : null;
    if (row.source_type && !sourceType) throw new Error('V1 stok hareketi kaynak türü eşlenemedi');
    maps.movements.set(row.id, await stage('stock_movements', 'legacy_movement_id', row.id, { material_id: mapped(maps.materials, row.inventory_item_id, 'malzeme'), movement_type: row.movement_type, delta: decimal(row.quantity_change), balance_after: decimal(row.balance_after), reason: row.reason, actor_id: mapped(users, row.user_id, 'hareket kullanıcısı'), source_type: sourceType, source_id: sourceType === 'loan' ? mapped(maps.loans, row.source_id, 'teslim kaynağı') : null, created_at: date(row.created_at), updated_at: date(row.updated_at) }));
  }
  for (const row of data.movements) if (row.reversed_movement_id) {
    const movementId = mapped(maps.movements, row.id, 'hareket');
    const originalId = mapped(maps.movements, row.reversed_movement_id, 'ters hareket');
    const [current] = await connection.execute('SELECT reversed_movement_id FROM stock_movements WHERE id=? FOR UPDATE', [movementId]);
    if (current[0].reversed_movement_id && Number(current[0].reversed_movement_id) !== originalId) throw new Error('Önceden taşınan ters hareket bağı farklı');
    if (!current[0].reversed_movement_id) await connection.execute('UPDATE stock_movements SET reversed_movement_id=? WHERE id=?', [originalId, movementId]);
  }
  for (const row of data.media) {
    const materialId = mapped(maps.materials, row.inventory_item_id, 'medya malzemesi');
    let bytes = null, type = null, relative = null;
    if (row.file_path) {
      if (!/^inventory-media\/\d+\/[^/]+\.(jpg|jpeg|png|webp|mp4|webm)$/i.test(row.file_path) || Number(row.file_path.split('/')[1]) !== row.inventory_item_id) throw new Error('V1 medya yolu geçersiz');
      const path = await realpath(resolve(sourceRoot, row.file_path));
      if (!path.startsWith(sourceRoot + sep)) throw new Error('V1 medya yolu kaynak kök dışına çıkıyor');
      bytes = await readFile(path);
      type = imageType(bytes);
      if (!type || row.type !== (type.mime.startsWith('image/') ? 'image' : 'video')) throw new Error('V1 medya türü geçersiz');
    } else if (row.type !== 'link' || !row.external_url?.startsWith('https://')) throw new Error('V1 medya bağlantısı geçersiz');
    const [matches] = await connection.execute('SELECT * FROM material_media WHERE legacy_media_id=? FOR UPDATE', [row.id]);
    if (matches.length) {
      relative = matches[0].path;
      if (bytes) {
        if (!relative || !new RegExp(`^inventory-media/${materialId}/[a-f0-9]{32}\\.${type.extension}$`).test(relative)) throw new Error('Önceden taşınan medya yolu geçersiz');
        const actual = await realpath(resolve(targetRoot, relative));
        if (!actual.startsWith(targetRoot + sep) || sha(await readFile(actual)) !== sha(bytes)) throw new Error('Önceden taşınan medya farklı');
      }
    } else if (bytes) relative = `inventory-media/${materialId}/${randomBytes(16).toString('hex')}.${type.extension}`;
    const mediaId = await stage('material_media', 'legacy_media_id', row.id, { material_id: materialId, type: row.type, path: relative, external_url: row.external_url, mime: type?.mime || null, title: row.title, alt_text: row.alt_text, sort_order: row.sort_order, is_cover: row.is_cover, created_at: date(row.created_at), updated_at: date(row.updated_at) });
    maps.media.set(row.id, mediaId);
    if (bytes && !matches.length) {
      const target = resolve(targetRoot, relative);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      if (!(await realpath(dirname(target))).startsWith(targetRoot + sep)) throw new Error('Hedef medya yolu kök dışına çıkıyor');
      await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
      savedFiles.push(target);
      if (sha(await readFile(target)) !== sha(bytes)) throw new Error('Hedef medya hash doğrulaması başarısız');
    }
  }
  for (const [name, table, column] of [['categories', 'categories', 'legacy_category_id'], ['locations', 'locations', 'legacy_location_id'], ['materials', 'materials', 'legacy_material_id'], ['loans', 'loans', 'legacy_loan_id'], ['movements', 'stock_movements', 'legacy_movement_id'], ['media', 'material_media', 'legacy_media_id']]) {
    const [rows] = await connection.execute(`SELECT COUNT(*) AS total FROM ${table} WHERE ${column} IS NOT NULL`);
    if (Number(rows[0].total) !== data[name].length) throw new Error(`V2 ${name} kayıt sayısı V1 ile eşleşmiyor`);
  }
  const [stock] = await connection.execute('SELECT COALESCE(SUM(quantity),0) AS total FROM materials WHERE legacy_material_id IS NOT NULL');
  const sourceStock = data.materials.reduce((sum, row) => sum + Math.round(row.quantity * 1000), 0);
  if (Math.round(Number(stock[0].total) * 1000) !== sourceStock) throw new Error('V1/V2 stok toplamı farklı');
  await connection.commit();
  process.stdout.write(`${JSON.stringify({ ...summary, sourceHash, applied: true, inserted, existing, stockMilliUnits: sourceStock })}\n`);
} catch (error) {
  await connection.rollback();
  for (const file of savedFiles) await rm(file, { force: true }).catch(() => {});
  throw error;
} finally { await connection.end(); }
