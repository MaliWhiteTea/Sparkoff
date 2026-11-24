import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || url.pathname !== '/sparkoff_v2_acceptance') throw new Error('Yalnız yerel kabul veritabanı');
const base = process.env.ACCEPTANCE_BASE_URL || 'http://127.0.0.1:4320';
if (!base.startsWith('http://127.0.0.1:')) throw new Error('Yalnız yerel kabul API');
const token = randomBytes(32).toString('hex');
const publicId = randomUUID();
const hash = createHash('sha256').update(token).digest('hex');
const pool = mysql.createPool(process.env.DATABASE_URL);
let appointmentId;
const extraIds = [];
const endpoint = `${base}/api/printers/tracking/${publicId}/${token}`;
try {
  const [created] = await pool.query('INSERT INTO appointments (public_id, status, track_token_hash, email_verified_at, first_name, last_name, email) VALUES (?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?)', [publicId, 'pending_approval', hash, 'Kabul', 'Kişisi', 'tracking@example.invalid']);
  appointmentId = created.insertId;
  await pool.query('INSERT INTO appointment_status_histories (appointment_id, to_status, note) VALUES (?, ?, ?)', [appointmentId, 'pending_approval', 'Doğrulandı']);
  const bad = await fetch(endpoint.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'));
  assert.equal(bad.status, 404);
  const tracked = await fetch(endpoint);
  assert.equal(tracked.status, 200);
  assert.equal(tracked.headers.get('cache-control'), 'private, no-store');
  const payload = await tracked.json();
  assert.equal(payload.appointment.status, 'pending_approval');
  assert.equal(payload.appointment.canCancel, true);
  assert.equal(payload.appointment.history.length, 1);
  assert.equal(JSON.stringify(payload).includes('tracking@example.invalid'), false);
  const canceled = await Promise.all([fetch(endpoint + '/cancel', { method: 'POST' }), fetch(endpoint + '/cancel', { method: 'POST' })]);
  assert.deepEqual(canceled.map(item => item.status), [200, 200]);
  const after = (await (await fetch(endpoint)).json()).appointment;
  assert.equal(after.status, 'canceled');
  assert.equal(after.canCancel, false);
  assert.equal(after.history.filter(item => item.status === 'canceled').length, 1);
  const [[row]] = await pool.query('SELECT COUNT(*) AS total FROM appointment_status_histories WHERE appointment_id=? AND to_status=?', [appointmentId, 'canceled']);
  assert.equal(row.total, 1);
  const verificationToken = randomBytes(32).toString('hex');
  const verificationId = randomUUID();
  const verificationHash = createHash('sha256').update(verificationToken).digest('hex');
  const [verificationCreated] = await pool.query('INSERT INTO appointments (public_id, status, verification_token_hash, verification_expires_at, email) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE), ?)', [verificationId, 'pending_verification', verificationHash, 'verification@example.invalid']);
  extraIds.push(verificationCreated.insertId);
  const verificationUrl = `${base}/api/printers/verification/${verificationId}/${verificationToken}`;
  assert.equal((await (await fetch(verificationUrl)).json()).expired, false);
  const verifiedResponse = await fetch(verificationUrl, { method: 'POST' });
  assert.equal(verifiedResponse.status, 200);
  const verified = await verifiedResponse.json();
  assert.equal(verified.verified, true);
  assert.equal(verified.emailSent, false);
  assert.equal((await fetch(verificationUrl, { method: 'POST' })).status, 404);
  assert.equal((await fetch(base + verified.trackingUrl.replace('/randevu/takip', '/api/printers/tracking'))).status, 200);
  const expiredToken = randomBytes(32).toString('hex');
  const expiredPublicId = randomUUID();
  const [expiredCreated] = await pool.query('INSERT INTO appointments (public_id, status, verification_token_hash, verification_expires_at) VALUES (?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE))', [expiredPublicId, 'pending_verification', createHash('sha256').update(expiredToken).digest('hex')]);
  extraIds.push(expiredCreated.insertId);
  const expiredUrl = `${base}/api/printers/verification/${expiredPublicId}/${expiredToken}`;
  assert.equal((await (await fetch(expiredUrl)).json()).expired, true);
  assert.equal((await (await fetch(expiredUrl, { method: 'POST' })).json()).expired, true);
  const [[expiredRow]] = await pool.query('SELECT status FROM appointments WHERE id=?', [expiredCreated.insertId]);
  assert.equal(expiredRow.status, 'expired');
  const cronPublicId = randomUUID();
  const [cronCreated] = await pool.query('INSERT INTO appointments (public_id, status, verification_token_hash, verification_expires_at, ends_at) VALUES (?, ?, ?, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY))', [cronPublicId, 'pending_verification', createHash('sha256').update(randomBytes(32)).digest('hex')]);
  extraIds.push(cronCreated.insertId);
  assert.equal((await fetch(base + '/api/internal/expire-verifications', { method: 'POST' })).status, 403);
  const cronResponse = await fetch(base + '/api/internal/expire-verifications', { method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET } });
  assert.equal(cronResponse.status, 200);
  assert.ok((await cronResponse.json()).expiredVerifications >= 1);
  const [[cronExpired]] = await pool.query('SELECT status, verification_token_hash FROM appointments WHERE id=?', [cronCreated.insertId]);
  assert.equal(cronExpired.status, 'expired');
  assert.equal(cronExpired.verification_token_hash, null);
  console.log('Takip kabulü geçti: geçersiz token 404, özel alan maskeleme, eşzamanlı iptal, tek kullanımlık doğrulama ve cron süresi dolan kayıt.');
} finally {
  for (const id of extraIds) {
    await pool.query('DELETE FROM appointment_status_histories WHERE appointment_id=?', [id]);
    await pool.query('DELETE FROM appointments WHERE id=?', [id]);
  }
  if (appointmentId) {
    await pool.query('DELETE FROM appointment_status_histories WHERE appointment_id=?', [appointmentId]);
    await pool.query('DELETE FROM appointments WHERE id=?', [appointmentId]);
  }
  await pool.end();
}
