import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import mysql from 'mysql2/promise';

const [sourcePath, sourceFiles] = process.argv.slice(2).filter(arg => arg !== '--apply');
const apply = process.argv.includes('--apply');
if (!sourcePath || !sourceFiles) throw new Error('Kullanım: stage-v1-feedback.mjs <V1 SQLite> <V1 özel dosya kökü> [--apply]');
const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || !['/sparkoff_v2_acceptance', '/sparkoff_v2_migration', '/sparkoff_v2_migration_clean'].includes(url.pathname)) throw new Error('Geri bildirim provası yalnız ayrı yerel V2 veritabanında çalışır');
const targetRoot = resolve(process.env.PRIVATE_UPLOAD_DIR || '');
if (!process.env.PRIVATE_UPLOAD_DIR || !targetRoot.startsWith(resolve('../storage/framework/local-test-v2') + sep)) throw new Error('Hedef özel dosya kökü yalnız yerel kabul dizini olabilir');
const source = new DatabaseSync(resolve(sourcePath), { readOnly: true });
let rows;
try {
  if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok') throw new Error('V1 SQLite bütünlük kontrolü başarısız');
  rows = source.prepare('SELECT id, type, message, status, admin_note, handled_by, handled_at, created_at, updated_at, image_path, image_original_name, image_mime_type, image_size FROM feedback_reports ORDER BY id').all();
} finally { source.close(); }
function date(value) {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error('V1 geri bildirim zamanı geçersiz');
  const parsed = new Date(value.replace(' ', 'T') + '+03:00');
  if (!Number.isFinite(parsed.getTime())) throw new Error('V1 geri bildirim zamanı geçersiz');
  return parsed.toISOString().slice(0, 19).replace('T', ' ');
}
function imageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', mime: 'image/jpeg' };
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return { extension: 'png', mime: 'image/png' };
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' };
  return null;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const row of rows) {
  if (!Number.isSafeInteger(row.id) || row.id <= 0 || !['suggestion', 'complaint', 'bug'].includes(row.type) || !['new', 'reviewing', 'resolved', 'archived'].includes(row.status) || typeof row.message !== 'string' || row.message.length < 10 || row.message.length > 3000) throw new Error('V1 geri bildirim alanı geçersiz');
  date(row.created_at); date(row.updated_at); date(row.handled_at);
  if (row.image_path && (!/^feedback\/\d+\/[^/]+\.(jpg|jpeg|png|webp)$/i.test(row.image_path) || Number(row.image_path.split('/')[1]) !== row.id || !Number.isSafeInteger(row.image_size) || row.image_size <= 0 || row.image_size > 5 * 1024 * 1024)) throw new Error('V1 geri bildirim görsel meta verisi geçersiz');
}
const summary = { feedbacks: rows.length, images: rows.filter(row => row.image_path).length, applied: false };
if (!apply) { process.stdout.write(`${JSON.stringify(summary)}\n`); process.exit(0); }
const sourceRoot = await realpath(resolve(sourceFiles));
await mkdir(targetRoot, { recursive: true, mode: 0o700 });
const actualTargetRoot = await realpath(targetRoot);
if (actualTargetRoot !== targetRoot) throw new Error('Hedef özel dosya kökü symlink olamaz');
const db = await mysql.createConnection(process.env.DATABASE_URL);
let inserted = 0, existing = 0;
const savedFiles = [];
try {
  await db.beginTransaction();
  for (const row of rows) {
      let image = null, type = null;
      if (row.image_path) {
        const path = await realpath(resolve(sourceRoot, row.image_path));
        if (!path.startsWith(sourceRoot + sep)) throw new Error('V1 görsel yolu kaynak kök dışına çıkıyor');
        image = await readFile(path);
        type = imageType(image);
        if (image.length !== row.image_size || !type || type.mime !== row.image_mime_type) throw new Error('V1 görsel boyutu veya türü geçersiz');
      }
      const [match] = await db.execute("SELECT id, kind, message, status, admin_note, image_path, image_original_name, image_mime_type, image_size, handled_by, DATE_FORMAT(handled_at, '%Y-%m-%d %H:%i:%s') AS handled_at_text, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at_text, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at_text FROM feedbacks WHERE legacy_feedback_id=? FOR UPDATE", [row.id]);
      const [handler] = row.handled_by == null ? [[]] : await db.execute('SELECT id FROM users WHERE legacy_user_id=?', [row.handled_by]);
      if (row.handled_by != null && handler.length !== 1) throw new Error('V1 geri bildirim sorumlusu aktarılmamış');
      const handledBy = handler[0]?.id || null;
      if (match.length) {
        const current = match[0];
        if (current.kind !== row.type || current.message !== row.message || current.status !== row.status || current.admin_note !== row.admin_note || current.image_original_name !== row.image_original_name || current.image_mime_type !== row.image_mime_type || Number(current.image_size || 0) !== Number(row.image_size || 0) || Number(current.handled_by || 0) !== Number(handledBy || 0) || current.handled_at_text !== date(row.handled_at) || current.created_at_text !== date(row.created_at) || current.updated_at_text !== date(row.updated_at) || Boolean(current.image_path) !== Boolean(row.image_path)) throw new Error('Önceden taşınan geri bildirim farklı');
        if (image) {
          const target = await realpath(resolve(targetRoot, current.image_path));
          if (!target.startsWith(targetRoot + sep) || sha(await readFile(target)) !== sha(image)) throw new Error('Önceden taşınan görsel farklı');
        }
        existing++;
      } else {
        const [created] = await db.execute('INSERT INTO feedbacks (legacy_feedback_id, kind, message, status, admin_note, handled_by, handled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [row.id, row.type, row.message, row.status, row.admin_note, handledBy, date(row.handled_at), date(row.created_at), date(row.updated_at)]);
        if (image && type) {
          const relative = `feedback/${created.insertId}/${randomBytes(16).toString('hex')}.${type.extension}`;
          const savedFile = resolve(targetRoot, relative);
          await mkdir(dirname(savedFile), { recursive: true, mode: 0o700 });
          if (!(await realpath(dirname(savedFile))).startsWith(targetRoot + sep)) throw new Error('Hedef görsel yolu kök dışına çıkıyor');
          await writeFile(savedFile, image, { flag: 'wx', mode: 0o600 });
          savedFiles.push(savedFile);
          if (sha(await readFile(savedFile)) !== sha(image)) throw new Error('Hedef görsel hash doğrulaması başarısız');
          await db.execute('UPDATE feedbacks SET image_path=?, image_original_name=?, image_mime_type=?, image_size=? WHERE id=?', [relative, row.image_original_name, type.mime, image.length, created.insertId]);
        }
        inserted++;
      }
  }
  await db.commit();
  process.stdout.write(`${JSON.stringify({ ...summary, applied: true, inserted, existing })}\n`);
} catch (error) {
  await db.rollback();
  for (const file of savedFiles) await rm(file, { force: true }).catch(() => {});
  throw error;
} finally { await db.end(); }
