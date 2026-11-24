import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const [sourcePath] = process.argv.slice(2).filter(arg => arg !== '--apply');
const apply = process.argv.includes('--apply');
if (!sourcePath) throw new Error('Kullanım: stage-v1-activity.mjs <V1 SQLite> [--apply]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Etkinlik provası yalnız ayrı yerel migration veritabanında çalışır');
const subjects = new Map([
  ['App\\Models\\InventoryCategory', ['category', 'categories', 'legacy_category_id']],
  ['App\\Models\\InventoryItem', ['material', 'materials', 'legacy_material_id']],
  ['App\\Models\\InventoryMedia', ['material_media', 'material_media', 'legacy_media_id']],
  ['App\\Models\\InventoryTransaction', ['loan', 'loans', 'legacy_loan_id']],
  ['App\\Models\\Printer', ['printer', 'printers', 'legacy_printer_id']],
  ['App\\Models\\Role', ['role', 'custom_roles', 'legacy_role_id']],
  ['App\\Models\\User', ['user', 'users', 'legacy_user_id']],
  ['App\\Models\\FeedbackReport', ['feedback', 'feedbacks', 'legacy_feedback_id']],
]);
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let rows;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  rows = source.prepare('SELECT id, user_id, action, subject_type, subject_id, changed_fields, created_at FROM activity_logs ORDER BY id').all();
} finally { source.close(); }
const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
if (!apply) { process.stdout.write(`${JSON.stringify({ source: rows.length, sourceHash, applied: false })}\n`); process.exit(0); }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 etkinlik zamanı geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) throw new Error('V1 etkinlik zamanı geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
let inserted = 0, existing = 0, missingSubjects = 0;
try {
  await db.query("SET time_zone = '+00:00'");
  await db.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
  await db.beginTransaction();
  const [foreign] = await db.query('SELECT COUNT(*) AS total FROM audit_logs WHERE legacy_activity_log_id IS NULL');
  if (Number(foreign[0].total)) throw new Error('Prova veritabanında kaynak dışı audit kaydı var');
  const [userRows] = await db.query('SELECT id, legacy_user_id FROM users WHERE legacy_user_id IS NOT NULL');
  const users = new Map(userRows.map(row => [Number(row.legacy_user_id), Number(row.id)]));
  const subjectMaps = new Map();
  for (const [sourceType, [, table, legacyColumn]] of subjects) {
    const [targetRows] = await db.query(`SELECT id, ${legacyColumn} AS legacy_id FROM ${table} WHERE ${legacyColumn} IS NOT NULL`);
    subjectMaps.set(sourceType, new Map(targetRows.map(row => [Number(row.legacy_id), Number(row.id)])));
  }
  for (const row of rows) {
    if (!Number.isSafeInteger(row.id) || row.id <= 0 || !Number.isSafeInteger(row.user_id) || !users.has(row.user_id) || (row.subject_id !== null && (!Number.isSafeInteger(row.subject_id) || row.subject_id <= 0)) || !subjects.has(row.subject_type) || typeof row.action !== 'string' || row.action.length < 1 || row.action.length > 90) throw new Error('V1 etkinlik alanı veya bağı geçersiz');
    let changedFields = null;
    if (row.changed_fields != null) {
      try { changedFields = JSON.parse(row.changed_fields); } catch { throw new Error('V1 değişen alan JSON verisi geçersiz'); }
      if (typeof changedFields !== 'object' || changedFields === null) throw new Error('V1 değişen alan verisi geçersiz');
    }
    const entity = subjects.get(row.subject_type)[0];
    const entityId = row.subject_id === null ? null : subjectMaps.get(row.subject_type).get(row.subject_id) ?? null;
    if (entityId === null) missingSubjects++;
    const after = { legacySubjectType: row.subject_type, legacySubjectId: row.subject_id, changedFields, subjectPresent: entityId !== null };
    const fields = { actor_id: users.get(row.user_id), action: `legacy.${row.action}`, entity, entity_id: entityId, before: null, after: JSON.stringify(after), created_at: date(row.created_at) };
    const [matches] = await db.execute('SELECT * FROM audit_logs WHERE legacy_activity_log_id=? FOR UPDATE', [row.id]);
    if (matches.length) {
      const current = matches[0];
      for (const [column, value] of Object.entries(fields)) {
        const actual = column === 'after' ? JSON.stringify(current.after) : current[column] == null ? null : String(current[column]);
        if (actual !== (value == null ? null : String(value))) throw new Error(`V2 etkinlik kaynakla farklı: ${row.id}.${column}`);
      }
      existing++;
    } else {
      const columns = ['legacy_activity_log_id', ...Object.keys(fields)];
      await db.execute(`INSERT INTO audit_logs (${columns.map(column => `\`${column}\``).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, [row.id, ...Object.values(fields)]);
      inserted++;
    }
  }
  const [count] = await db.query('SELECT COUNT(*) AS total FROM audit_logs WHERE legacy_activity_log_id IS NOT NULL');
  if (Number(count[0].total) !== rows.length) throw new Error('V1/V2 etkinlik sayısı farklı');
  await db.commit();
  process.stdout.write(`${JSON.stringify({ source: rows.length, sourceHash, applied: true, inserted, existing, missingSubjects })}\n`);
} catch (error) { await db.rollback(); throw error; } finally { await db.end(); }
