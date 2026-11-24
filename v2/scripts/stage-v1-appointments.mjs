import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import mysql from 'mysql2/promise';

const [sourcePath, sourceFiles] = process.argv.slice(2).filter(arg => !['--apply', '--validate'].includes(arg));
const apply = process.argv.includes('--apply');
const validate = process.argv.includes('--validate');
if (!sourcePath || !sourceFiles || apply && validate) throw new Error('Kullanım: stage-v1-appointments.mjs <V1 SQLite> <V1 özel dosya kökü> [--apply|--validate]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Randevu provası yalnız ayrı yerel migration veritabanında çalışır');
const targetRoot = resolve(process.env.PRIVATE_UPLOAD_DIR || '');
if (!process.env.PRIVATE_UPLOAD_DIR || !targetRoot.startsWith(resolve('../storage/framework/local-test-v2/mariadb-runtime') + sep)) throw new Error('Hedef özel dosya kökü yalnız yerel migration dizininde olabilir');
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let data;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  data = Object.fromEntries([
    ['appointments', 'appointments'], ['files', 'appointment_files'], ['histories', 'appointment_status_histories'],
  ].map(([key, table]) => [key, source.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
} finally { source.close(); }
const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
const summary = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length]));
if (!apply && !validate) { process.stdout.write(`${JSON.stringify({ ...summary, sourceHash, applied: false })}\n`); process.exit(0); }
function date(value, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 randevu tarihi geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) throw new Error('V1 randevu tarihi geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
function positive(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`V1 ${field} geçersiz`);
  return value;
}
function string(value, max, field, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || required && !value || value.length > max) throw new Error(`V1 ${field} geçersiz`);
  return value;
}
const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const filePattern = new RegExp(`^appointments/(${uuid})/(${uuid})\\.(gcode|3mf|stl|step|stp|obj)$`);
const statuses = new Set(['pending_verification', 'pending_approval', 'change_requested', 'approved', 'ready', 'printing', 'completed', 'failed', 'rejected', 'canceled', 'expired']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceRoot = await realpath(resolve(sourceFiles));
await mkdir(targetRoot, { recursive: true, mode: 0o700 });
if (await realpath(targetRoot) !== targetRoot) throw new Error('Hedef özel dosya kökü symlink olamaz');
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
const savedFiles = [];
const appointmentIds = new Map();
let inserted = 0, existing = 0, copiedFiles = 0;
async function stage(table, legacyColumn, sourceId, fields) {
  positive(sourceId, 'kaynak kimliği');
  const [matches] = await db.execute(`SELECT * FROM ${table} WHERE ${legacyColumn}=? FOR UPDATE`, [sourceId]);
  if (matches.length) {
    for (const [column, value] of Object.entries(fields)) if ((matches[0][column] == null ? null : String(matches[0][column])) !== (value == null ? null : String(value))) throw new Error(`V2 randevu kaydı kaynakla farklı: ${table}.${column}`);
    existing++;
    return Number(matches[0].id);
  }
  const columns = [legacyColumn, ...Object.keys(fields)];
  const [created] = await db.execute(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, [sourceId, ...Object.values(fields)]);
  inserted++;
  return Number(created.insertId);
}
try {
  await db.query("SET time_zone = '+00:00'");
  await db.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
  await db.beginTransaction();
  for (const [table, legacyColumn] of [['appointments', 'legacy_appointment_id'], ['appointment_files', 'legacy_appointment_file_id'], ['appointment_status_histories', 'legacy_appointment_history_id']]) {
    const [foreign] = await db.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${legacyColumn} IS NULL`);
    if (Number(foreign[0].total)) throw new Error(`Prova veritabanında kaynak dışı ${table} kaydı var`);
  }
  const [printerRows] = await db.query('SELECT id, legacy_printer_id FROM printers WHERE legacy_printer_id IS NOT NULL');
  const [filamentRows] = await db.query('SELECT id, legacy_filament_id FROM filaments WHERE legacy_filament_id IS NOT NULL');
  const [userRows] = await db.query('SELECT id, legacy_user_id FROM users WHERE legacy_user_id IS NOT NULL');
  const printers = new Map(printerRows.map(row => [Number(row.legacy_printer_id), Number(row.id)]));
  const filaments = new Map(filamentRows.map(row => [Number(row.legacy_filament_id), Number(row.id)]));
  const users = new Map(userRows.map(row => [Number(row.legacy_user_id), Number(row.id)]));
  for (const row of data.appointments) {
    const printerId = printers.get(positive(row.printer_id, 'yazıcı bağı'));
    if (!printerId || !statuses.has(row.status) || !['workshop', 'own'].includes(row.filament_source) || row.filament_id != null && !filaments.has(row.filament_id)) throw new Error('V1 randevu durumu veya bağı geçersiz');
    const startsAt = date(row.starts_at, true), endsAt = date(row.ends_at, true);
    const durationMinutes = positive(row.duration_minutes, 'süre');
    if (startsAt >= endsAt || (Date.parse(endsAt + 'Z') - Date.parse(startsAt + 'Z')) / 60000 !== durationMinutes) throw new Error('V1 randevu aralığı/süresi geçersiz');
    const publicId = string(row.public_id, 64, 'açık kimlik', true);
    if (!new RegExp(`^${uuid}$`).test(publicId)) throw new Error('V1 randevu açık kimliği geçersiz');
    for (const key of ['verification_token_hash', 'tracking_token_hash']) if (row[key] != null && !/^[a-f0-9]{64}$/i.test(row[key])) throw new Error('V1 randevu token özeti geçersiz');
    const fields = {
      public_id: publicId, printer_id: printerId, name: null, first_name: string(row.first_name, 100, 'ad', true), last_name: string(row.last_name, 100, 'soyad', true),
      email: string(row.email, 255, 'e-posta', true), phone: string(row.phone, 30, 'telefon'), starts_at: startsAt, ends_at: endsAt, duration_minutes: durationMinutes,
      status: row.status, filament_source: row.filament_source, filament_id: row.filament_id == null ? null : filaments.get(row.filament_id),
      filament_material: string(row.filament_material, 40, 'filament malzemesi'), filament_color: string(row.filament_color, 80, 'filament rengi'),
      user_note: row.user_note, admin_note: row.admin_note, model_path: null, verification_token_hash: row.verification_token_hash,
      track_token_hash: string(row.tracking_token_hash, 64, 'takip özeti', true), email_verified_at: date(row.email_verified_at), verification_expires_at: date(row.verification_expires_at),
      canceled_at: date(row.canceled_at), privacy_notice_version: string(row.privacy_notice_version, 30, 'KVKK sürümü', true),
      privacy_notice_seen_at: date(row.privacy_notice_seen_at, true), rules_accepted_at: date(row.rules_accepted_at, true),
      retention_exempt_until: date(row.retention_exempt_until), retention_exemption_reason: string(row.retention_exemption_reason, 500, 'saklama istisnası'),
      created_at: date(row.created_at, true), updated_at: date(row.updated_at),
    };
    appointmentIds.set(row.id, { id: await stage('appointments', 'legacy_appointment_id', row.id, fields), publicId });
  }
  for (const row of data.files) {
    const appointment = appointmentIds.get(positive(row.appointment_id, 'dosya randevu bağı'));
    if (!appointment || row.disk !== 'local' || !Number.isSafeInteger(row.size_bytes) || row.size_bytes < 1 || row.size_bytes > 100 * 1024 * 1024) throw new Error('V1 randevu dosyası bağı, diski veya boyutu geçersiz');
    const path = string(row.path, 512, 'özel dosya yolu', true), match = filePattern.exec(path);
    if (!match || match[1].toLowerCase() !== appointment.publicId.toLowerCase() || row.extension?.toLowerCase() !== match[3]) throw new Error('V1 randevu dosya yolu geçersiz');
    let bytes = null;
    if (!row.deleted_at) {
      const actual = await realpath(resolve(sourceRoot, path));
      if (!actual.startsWith(sourceRoot + sep)) throw new Error('V1 randevu dosyası kaynak kök dışına çıkıyor');
      bytes = await readFile(actual);
      if (bytes.length !== row.size_bytes) throw new Error('V1 randevu dosya boyutu farklı');
    }
    const fields = { appointment_id: appointment.id, disk: row.disk, path, original_name: string(row.original_name, 255, 'özgün dosya adı', true), extension: row.extension.toLowerCase(), mime_type: string(row.mime_type, 255, 'MIME'), size_bytes: row.size_bytes, scheduled_deletion_at: date(row.scheduled_deletion_at), deleted_at: date(row.deleted_at), created_at: date(row.created_at, true), updated_at: date(row.updated_at, true) };
    const [before] = await db.execute('SELECT id FROM appointment_files WHERE legacy_appointment_file_id=? FOR UPDATE', [positive(row.id, 'dosya kimliği')]);
    await stage('appointment_files', 'legacy_appointment_file_id', row.id, fields);
    if (bytes) {
      const target = resolve(targetRoot, path);
      if (before.length) {
        const actual = await realpath(target);
        if (!actual.startsWith(targetRoot + sep) || sha(await readFile(actual)) !== sha(bytes)) throw new Error('V2 özel dosya kaynakla farklı');
      } else {
        await mkdir(dirname(target), { recursive: true, mode: 0o700 });
        if (!(await realpath(dirname(target))).startsWith(targetRoot + sep)) throw new Error('V2 özel dosya kök dışına çıkıyor');
        await writeFile(target, bytes, { flag: 'wx', mode: 0o600 });
        savedFiles.push(target);
        if (sha(await readFile(target)) !== sha(bytes)) throw new Error('V2 özel dosya hash doğrulaması başarısız');
        copiedFiles++;
      }
    }
  }
  for (const row of data.histories) {
    const appointment = appointmentIds.get(positive(row.appointment_id, 'geçmiş randevu bağı'));
    const actorId = row.actor_id == null ? null : users.get(row.actor_id);
    if (!appointment || row.actor_id != null && !actorId || !statuses.has(row.to_status) || row.from_status != null && !statuses.has(row.from_status)) throw new Error('V1 randevu geçmişi bağı veya durumu geçersiz');
    await stage('appointment_status_histories', 'legacy_appointment_history_id', row.id, { appointment_id: appointment.id, actor_id: actorId, from_status: row.from_status, to_status: row.to_status, note: row.note, created_at: date(row.created_at, true), updated_at: date(row.updated_at, true) });
  }
  for (const [table, legacyColumn, key] of [['appointments', 'legacy_appointment_id', 'appointments'], ['appointment_files', 'legacy_appointment_file_id', 'files'], ['appointment_status_histories', 'legacy_appointment_history_id', 'histories']]) {
    const [count] = await db.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${legacyColumn} IS NOT NULL`);
    if (Number(count[0].total) !== data[key].length) throw new Error(`V1/V2 ${table} sayısı farklı`);
  }
  if (validate) {
    await db.rollback();
    for (const file of savedFiles) await rm(file, { force: true });
  } else await db.commit();
  process.stdout.write(`${JSON.stringify({ ...summary, sourceHash, applied: apply, validated: true, inserted, existing, copiedFiles })}\n`);
} catch (error) {
  await db.rollback();
  for (const file of savedFiles) await rm(file, { force: true }).catch(() => {});
  throw error;
} finally { await db.end(); }
