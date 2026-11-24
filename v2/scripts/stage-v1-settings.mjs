import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const [sourcePath] = process.argv.slice(2).filter(arg => arg !== '--apply');
const apply = process.argv.includes('--apply');
if (!sourcePath) throw new Error('Kullanım: stage-v1-settings.mjs <V1 SQLite> [--apply]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Ayar provası yalnız ayrı yerel migration veritabanında çalışır');
const keys = new Set([
  'booking.slot_minutes', 'booking.maximum_duration_hours', 'booking.verification_hold_minutes',
  'uploads.maximum_file_size_mb', 'uploads.allowed_extensions',
  'privacy.controller_name', 'privacy.controller_address', 'privacy.contact_email',
  'privacy.appointment_retention_months', 'privacy.file_retention_days',
  'privacy.notice_version', 'privacy.is_draft',
]);
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let rows;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  rows = source.prepare('SELECT id, key, value, updated_at FROM settings ORDER BY key').all();
} finally { source.close(); }
const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
const skippedKeys = rows.filter(row => !keys.has(row.key)).map(row => row.key);
const summary = { source: rows.length, mapped: rows.length - skippedKeys.length, skippedKeys, sourceHash };
if (!apply) { process.stdout.write(`${JSON.stringify({ ...summary, applied: false })}\n`); process.exit(0); }
if (skippedKeys.length) throw new Error('V1 ayarları için eşlenmemiş anahtarlar var');
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 ayar zamanı geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) throw new Error('V1 ayar zamanı geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
const mapped = rows.map(row => {
  if (!Number.isSafeInteger(row.id) || row.id <= 0 || !keys.has(row.key)) throw new Error('V1 ayar kimliği/anahtarı geçersiz');
  let value;
  try { value = JSON.parse(row.value); } catch { throw new Error(`V1 ayar JSON değeri geçersiz: ${row.key}`); }
  if (row.key === 'uploads.allowed_extensions') {
    if (!Array.isArray(value) || !value.length || value.some(item => typeof item !== 'string' || !/^[a-z0-9]{1,10}$/.test(item))) throw new Error('V1 dosya uzantısı ayarı geçersiz');
  } else if (row.key === 'privacy.is_draft') {
    if (typeof value !== 'boolean') throw new Error('V1 taslak ayarı geçersiz');
  } else if (row.key.startsWith('privacy.') && !row.key.endsWith('_months') && !row.key.endsWith('_days')) {
    if (typeof value !== 'string') throw new Error(`V1 metin ayarı geçersiz: ${row.key}`);
  } else if (!Number.isSafeInteger(value) || value < 1) throw new Error(`V1 sayısal ayar geçersiz: ${row.key}`);
  return { key: row.key, value: JSON.stringify(value), updatedAt: date(row.updated_at) };
});
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
let inserted = 0, existing = 0;
try {
  await db.query("SET time_zone = '+00:00'");
  await db.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
  await db.beginTransaction();
  const [other] = await db.query('SELECT `key` FROM system_settings');
  if (other.some(row => !keys.has(row.key))) throw new Error('Prova veritabanında kaynak dışı ayar var');
  for (const row of mapped) {
    const [match] = await db.execute('SELECT `key`, value, updated_at FROM system_settings WHERE `key`=? FOR UPDATE', [row.key]);
    if (match.length) {
      if (JSON.stringify(match[0].value) !== row.value || match[0].updated_at !== row.updatedAt) throw new Error(`V2 prova ayarı kaynakla farklı: ${row.key}`);
      existing++;
    } else {
      await db.execute('INSERT INTO system_settings (`key`, value, updated_at) VALUES (?, ?, ?)', [row.key, row.value, row.updatedAt]);
      inserted++;
    }
  }
  const [count] = await db.query('SELECT COUNT(*) AS total FROM system_settings');
  if (Number(count[0].total) !== mapped.length) throw new Error('V1/V2 ayar sayısı farklı');
  await db.commit();
  process.stdout.write(`${JSON.stringify({ ...summary, applied: true, inserted, existing })}\n`);
} catch (error) { await db.rollback(); throw error; } finally { await db.end(); }
