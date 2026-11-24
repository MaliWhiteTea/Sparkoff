import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const [sourcePath] = process.argv.slice(2).filter(arg => !['--apply', '--validate'].includes(arg));
const apply = process.argv.includes('--apply');
const validate = process.argv.includes('--validate');
if (!sourcePath || apply && validate) throw new Error('Kullanım: stage-v1-blackouts.mjs <V1 SQLite> [--apply|--validate]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Kapalı zaman provası yalnız ayrı yerel migration veritabanında çalışır');
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let rows;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  rows = source.prepare('SELECT * FROM blackout_periods ORDER BY id').all();
} finally { source.close(); }
const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
if (!apply && !validate) { process.stdout.write(`${JSON.stringify({ source: rows.length, sourceHash, applied: false })}\n`); process.exit(0); }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 kapalı zaman tarihi geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) throw new Error('V1 kapalı zaman tarihi geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
let inserted = 0, existing = 0;
try {
  await db.query("SET time_zone = '+00:00'");
  await db.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
  await db.beginTransaction();
  const [foreign] = await db.query('SELECT COUNT(*) AS total FROM blackout_periods WHERE legacy_blackout_id IS NULL');
  if (Number(foreign[0].total)) throw new Error('Prova veritabanında kaynak dışı kapalı zaman var');
  const [printerRows] = await db.query('SELECT id, legacy_printer_id FROM printers WHERE legacy_printer_id IS NOT NULL');
  const printers = new Map(printerRows.map(row => [Number(row.legacy_printer_id), Number(row.id)]));
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id <= 0 || row.printer_id !== null && (!Number.isSafeInteger(row.printer_id) || !printers.has(row.printer_id)) || !['busy', 'maintenance', 'closed'].includes(row.kind) || ![0, 1].includes(row.is_all_day) || row.reason != null && (typeof row.reason !== 'string' || row.reason.length > 255)) throw new Error('V1 kapalı zaman alanı geçersiz');
    const startsAt = date(row.starts_at), endsAt = date(row.ends_at);
    if (startsAt >= endsAt) throw new Error('V1 kapalı zaman aralığı geçersiz');
    const fields = { printer_id: row.printer_id == null ? null : printers.get(row.printer_id), kind: row.kind, is_all_day: row.is_all_day, starts_at: startsAt, ends_at: endsAt, reason: row.reason, created_at: date(row.created_at), updated_at: date(row.updated_at) };
    const [matches] = await db.execute('SELECT * FROM blackout_periods WHERE legacy_blackout_id=? FOR UPDATE', [row.id]);
    if (matches.length) {
      for (const [column, value] of Object.entries(fields)) if ((matches[0][column] == null ? null : String(matches[0][column])) !== (value == null ? null : String(value))) throw new Error(`V2 kapalı zaman kaynakla farklı: ${row.id}.${column}`);
      existing++;
    } else {
      const columns = ['legacy_blackout_id', ...Object.keys(fields)];
      await db.execute(`INSERT INTO blackout_periods (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, [row.id, ...Object.values(fields)]);
      inserted++;
    }
  }
  const [count] = await db.query('SELECT COUNT(*) AS total FROM blackout_periods WHERE legacy_blackout_id IS NOT NULL');
  if (Number(count[0].total) !== rows.length) throw new Error('V1/V2 kapalı zaman sayısı farklı');
  if (validate) await db.rollback(); else await db.commit();
  process.stdout.write(`${JSON.stringify({ source: rows.length, sourceHash, applied: apply, validated: true, inserted, existing })}\n`);
} catch (error) { await db.rollback(); throw error; } finally { await db.end(); }
