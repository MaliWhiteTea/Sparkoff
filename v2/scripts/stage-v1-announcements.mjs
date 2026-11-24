import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql from 'mysql2/promise';

const [sourcePath] = process.argv.slice(2).filter(arg => !['--apply', '--validate'].includes(arg));
const apply = process.argv.includes('--apply');
const validate = process.argv.includes('--validate');
if (!sourcePath || apply && validate) throw new Error('Kullanım: stage-v1-announcements.mjs <V1 SQLite> [--apply|--validate]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Duyuru provası yalnız ayrı yerel migration veritabanında çalışır');
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let data;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  data = {
    announcements: source.prepare('SELECT * FROM announcements ORDER BY id').all(),
    roles: source.prepare('SELECT * FROM announcement_role ORDER BY announcement_id, role_id').all(),
    reads: source.prepare('SELECT * FROM announcement_user ORDER BY announcement_id, user_id').all(),
  };
} finally { source.close(); }
const sourceHash = createHash('sha256').update(await readFile(resolve(sourcePath))).digest('hex');
const summary = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length]));
if (!apply && !validate) { process.stdout.write(`${JSON.stringify({ ...summary, sourceHash, applied: false })}\n`); process.exit(0); }
function date(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 duyuru zamanı geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 3 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== value) throw new Error('V1 duyuru zamanı geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
function positive(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`V1 ${field} geçersiz`);
  return value;
}
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, dateStrings: true, timezone: 'Z' });
let inserted = 0, existing = 0;
try {
  await db.query("SET time_zone = '+00:00'");
  await db.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
  await db.beginTransaction();
  const [foreign] = await db.query('SELECT COUNT(*) AS total FROM announcements WHERE legacy_announcement_id IS NULL');
  if (Number(foreign[0].total)) throw new Error('Prova veritabanında kaynak dışı duyuru var');
  const [roleRows] = await db.query('SELECT id, legacy_role_id FROM custom_roles WHERE legacy_role_id IS NOT NULL');
  const [userRows] = await db.query('SELECT id, legacy_user_id FROM users WHERE legacy_user_id IS NOT NULL');
  const roleIds = new Map(roleRows.map(row => [Number(row.legacy_role_id), Number(row.id)]));
  const userIds = new Map(userRows.map(row => [Number(row.legacy_user_id), Number(row.id)]));
  const announcementIds = new Map();
  for (const row of data.announcements) {
    positive(row.id, 'duyuru kimliği');
    if (typeof row.title !== 'string' || !row.title || row.title.length > 200 || typeof row.body !== 'string' || !row.body || !['info', 'warning', 'maintenance', 'urgent'].includes(row.type) || !['all', 'home', 'printers'].includes(row.placement) || !['public', 'staff', 'both'].includes(row.audience) || ![0, 1].includes(row.is_published) || ![0, 1].includes(row.is_pinned) || ![0, 1].includes(row.requires_acknowledgement)) throw new Error('V1 duyuru alanı geçersiz');
    const createdAt = date(row.created_at), updatedAt = date(row.updated_at), startsAt = date(row.starts_at), endsAt = date(row.ends_at);
    if (!createdAt || !updatedAt || startsAt && endsAt && startsAt >= endsAt) throw new Error('V1 duyuru tarihi geçersiz');
    const fields = { title: row.title, body: row.body, type: row.type, placement: row.placement, audience: row.audience === 'staff' ? 'internal' : row.audience, unit_id: null, pinned: row.is_pinned, requires_acknowledgement: row.requires_acknowledgement, is_published: row.is_published, starts_at: startsAt, ends_at: endsAt, published_at: row.is_published ? createdAt : null, expires_at: null, created_by: null, created_at: createdAt, updated_at: updatedAt };
    const [matches] = await db.execute('SELECT * FROM announcements WHERE legacy_announcement_id=? FOR UPDATE', [row.id]);
    if (matches.length) {
      for (const [column, value] of Object.entries(fields)) if ((matches[0][column] == null ? null : String(matches[0][column])) !== (value == null ? null : String(value))) throw new Error(`V2 duyuru kaynakla farklı: ${row.id}.${column}`);
      announcementIds.set(row.id, Number(matches[0].id));
      existing++;
    } else {
      const columns = ['legacy_announcement_id', ...Object.keys(fields)];
      const [created] = await db.execute(`INSERT INTO announcements (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, [row.id, ...Object.values(fields)]);
      announcementIds.set(row.id, Number(created.insertId));
      inserted++;
    }
  }
  for (const row of data.roles) {
    const announcementId = announcementIds.get(positive(row.announcement_id, 'duyuru rol bağı'));
    const roleId = roleIds.get(positive(row.role_id, 'duyuru rol bağı'));
    if (!announcementId || !roleId) throw new Error('V1 duyuru rol bağı hedefte bulunamadı');
    await db.execute('INSERT IGNORE INTO announcement_roles (announcement_id, role_id) VALUES (?, ?)', [announcementId, roleId]);
  }
  for (const row of data.reads) {
    const announcementId = announcementIds.get(positive(row.announcement_id, 'duyuru okundu bağı'));
    const userId = userIds.get(positive(row.user_id, 'duyuru okundu bağı'));
    if (!announcementId || !userId) throw new Error('V1 duyuru okundu bağı hedefte bulunamadı');
    const readAt = date(row.read_at), acknowledgedAt = date(row.acknowledged_at);
    if (!readAt || acknowledgedAt && acknowledgedAt < readAt) throw new Error('V1 okundu/onay zamanı geçersiz');
    const [matches] = await db.execute('SELECT read_at, acknowledged_at FROM announcement_reads WHERE announcement_id=? AND user_id=? FOR UPDATE', [announcementId, userId]);
    if (matches.length) {
      if (matches[0].read_at !== readAt || matches[0].acknowledged_at !== acknowledgedAt) throw new Error('V2 duyuru okundu bağı kaynakla farklı');
    } else await db.execute('INSERT INTO announcement_reads (announcement_id, user_id, read_at, acknowledged_at) VALUES (?, ?, ?, ?)', [announcementId, userId, readAt, acknowledgedAt]);
  }
  const [announcementCount] = await db.query('SELECT COUNT(*) AS total FROM announcements WHERE legacy_announcement_id IS NOT NULL');
  const [roleCount] = await db.query('SELECT COUNT(*) AS total FROM announcement_roles');
  const [readCount] = await db.query('SELECT COUNT(*) AS total FROM announcement_reads');
  if (Number(announcementCount[0].total) !== data.announcements.length || Number(roleCount[0].total) !== data.roles.length || Number(readCount[0].total) !== data.reads.length) throw new Error('V1/V2 duyuru veya bağ sayısı farklı');
  if (validate) await db.rollback(); else await db.commit();
  process.stdout.write(`${JSON.stringify({ ...summary, sourceHash, applied: apply, validated: true, inserted, existing })}\n`);
} catch (error) { await db.rollback(); throw error; } finally { await db.end(); }
