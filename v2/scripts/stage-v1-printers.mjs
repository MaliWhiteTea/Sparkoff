import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const [sourcePath] = process.argv.slice(2).filter(value => value !== '--apply');
const apply = process.argv.includes('--apply');
if (!sourcePath) throw new Error('Kullanım: stage-v1-printers.mjs <V1 SQLite> [--apply]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Yazıcı provası yalnız ayrı yerel migration veritabanında çalışır');

const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let data;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  data = Object.fromEntries(['printers', 'filaments', 'operating_hours'].map(table => [table, source.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));
} finally { source.close(); }
const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
const summary = Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, rows.length]));
if (!apply) { process.stdout.write(`${JSON.stringify({ ...summary, sourceHash, applied: false })}\n`); process.exit(0); }

function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 tarih biçimi geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) throw new Error('V1 tarih değeri geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
function integer(value, min, max, field) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`V1 ${field} geçersiz`);
  return value;
}
function length(value, max, field, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || (required && !value) || value.length > max) throw new Error(`V1 ${field} geçersiz`);
  return value;
}
function optionalInt(value, min, max, field) { return value == null ? null : integer(value, min, max, field); }
function diameter(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 3 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) throw new Error('V1 filament çapı geçersiz');
  return value.toFixed(2);
}
function common(row) {
  integer(row.id, 1, Number.MAX_SAFE_INTEGER, 'kimlik');
  return { created_at: date(row.created_at), updated_at: date(row.updated_at) };
}
function sorted(row) { return { sort_order: integer(row.sort_order, 0, 65535, 'sıra'), ...common(row) }; }
const entries = {
  printers: data.printers.map(row => ({ id: row.id, fields: { code: length(row.code, 20, 'yazıcı kodu', true), name: length(row.name, 255, 'yazıcı adı', true), status: ['active', 'inactive', 'maintenance'].includes(row.status) ? row.status : (() => { throw new Error('V1 yazıcı durumu geçersiz'); })(), description: row.description, ...sorted(row) } })),
  filaments: data.filaments.map(row => ({ id: row.id, fields: { name: length(row.material, 120, 'filament malzemesi', true), color: length(row.color, 80, 'filament rengi', true), brand: length(row.brand, 100, 'filament markası'), available: integer(row.is_available, 0, 1, 'filament bulunurluğu'), diameter_mm: diameter(row.diameter_mm), spool_weight_grams: optionalInt(row.spool_weight_grams, 0, 2147483647, 'makara ağırlığı'), nozzle_temp_min: optionalInt(row.nozzle_temp_min, 0, 2147483647, 'nozul alt sıcaklığı'), nozzle_temp_max: optionalInt(row.nozzle_temp_max, 0, 2147483647, 'nozul üst sıcaklığı'), bed_temp_min: optionalInt(row.bed_temp_min, 0, 2147483647, 'tabla alt sıcaklığı'), bed_temp_max: optionalInt(row.bed_temp_max, 0, 2147483647, 'tabla üst sıcaklığı'), technical_notes: row.technical_notes, unavailable_reason: length(row.unavailable_reason, 500, 'filament yokluk nedeni'), ...sorted(row) } })),
  operating_hours: data.operating_hours.map(row => ({ id: row.id, fields: { weekday: integer(row.weekday, 1, 7, 'hafta günü'), is_open: integer(row.is_open, 0, 1, 'açıklık'), opens_at: row.opens_at == null ? null : length(row.opens_at, 8, 'açılış saati'), latest_start_at: row.latest_start_at == null ? null : length(row.latest_start_at, 8, 'son başlangıç saati'), ...common(row) } })),
};
for (const row of entries.operating_hours) for (const field of ['opens_at', 'latest_start_at']) if (row.fields[field] != null && !/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(row.fields[field])) throw new Error('V1 çalışma saati biçimi geçersiz');
if (new Set(entries.operating_hours.map(row => row.fields.weekday)).size !== entries.operating_hours.length) throw new Error('V1 çalışma günü yinelenmiş');

const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
let inserted = 0, existing = 0;
try {
  await db.query("SET time_zone = '+00:00'");
  await db.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
  await db.beginTransaction();
  const tables = [['printers', 'legacy_printer_id'], ['filaments', 'legacy_filament_id'], ['operating_hours', 'legacy_operating_hour_id']];
  for (const [table, legacy] of tables) {
    const [foreign] = await db.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${legacy} IS NULL`);
    if (Number(foreign[0].total)) throw new Error(`Prova veritabanında kaynak dışı ${table} kaydı var`);
    for (const { id, fields } of entries[table]) {
      const [matches] = await db.execute(`SELECT * FROM ${table} WHERE ${legacy}=? FOR UPDATE`, [id]);
      if (matches.length > 1) throw new Error('V2 kaynak kimliği yinelenmiş');
      if (matches.length) {
        for (const [column, value] of Object.entries(fields)) if ((matches[0][column] == null ? null : String(matches[0][column])) !== (value == null ? null : String(value))) throw new Error(`V2 prova kaydı kaynakla farklı: ${table}.${column}`);
        existing++;
      } else {
        const columns = [legacy, ...Object.keys(fields)];
        await db.execute(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, [id, ...Object.values(fields)]);
        inserted++;
      }
    }
    const [count] = await db.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${legacy} IS NOT NULL`);
    if (Number(count[0].total) !== entries[table].length) throw new Error(`V2 ${table} kayıt sayısı V1 ile eşleşmiyor`);
  }
  await db.commit();
  process.stdout.write(`${JSON.stringify({ ...summary, sourceHash, applied: true, inserted, existing })}\n`);
} catch (error) { await db.rollback(); throw error; } finally { await db.end(); }
