import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';

const dbUrl = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
if (dbUrl.hostname !== '127.0.0.1' || dbUrl.port !== '4319' || dbUrl.pathname !== '/sparkoff_v2_acceptance') throw new Error('Yalnız yerel kabul veritabanı');
if (!process.env.PRIVATE_UPLOAD_DIR?.startsWith('/home/mert/Documents/Proje/Sparkoff/storage/framework/local-test-v2/')) throw new Error('Yalnız yerel özel dosya kökü');
const messages = [];
const sockets = new Set();
const smtp = createServer(socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.write('220 local SMTP\r\n');
  let pending = '', dataMode = false, message = '';
  socket.on('data', chunk => {
    pending += chunk.toString('utf8');
    while (pending.includes('\r\n')) {
      const end = pending.indexOf('\r\n');
      const line = pending.slice(0, end);
      pending = pending.slice(end + 2);
      if (dataMode) {
        if (line === '.') { messages.push(message.replace(/=\n/g, '')); message = ''; dataMode = false; socket.write('250 accepted\r\n'); }
        else message += line + '\n';
      } else if (line.startsWith('EHLO') || line.startsWith('HELO')) socket.write('250-local\r\n250 SIZE 100000000\r\n');
      else if (line.startsWith('RCPT TO') && line.includes('reject@example.invalid')) socket.write('550 rejected\r\n');
      else if (line.startsWith('MAIL FROM') || line.startsWith('RCPT TO')) socket.write('250 OK\r\n');
      else if (line === 'DATA') { dataMode = true; socket.write('354 End data\r\n'); }
      else if (line === 'QUIT') { socket.write('221 Bye\r\n'); socket.end(); }
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
const smtpPort = smtp.address().port;
const port = 4321;
const base = `http://127.0.0.1:${port}`;
const clientKey = `acceptance-${randomUUID()}`;
const api = spawn(process.execPath, ['dist/server/index.js'], {
  env: { ...process.env, PORT: String(port), ONLINE_BOOKING_ENABLED: 'true', PUBLIC_BASE_URL: base,
    SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtpPort), SMTP_FROM: 'Sparkoff <randevu@example.invalid>',
    SMTP_ALLOW_PLAINTEXT_LOCAL: 'true', NODE_ENV: 'test' },
  stdio: 'ignore',
});
const pool = mysql.createPool(process.env.DATABASE_URL);
let printerId, appointmentId, hourId, priorHour, createdHour = false, publicId;
try {
  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (api.exitCode !== null) throw new Error('Yerel API başlatılamadı');
    try { healthy = (await fetch(base + '/api/health')).ok; } catch {}
    if (healthy) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(healthy, 'Yerel API hazır değil');
  const [printer] = await pool.query('INSERT INTO printers (code, name, status) VALUES (?, ?, ?)', [`B-${Date.now()}`, 'Kabul yazıcısı', 'active']);
  printerId = printer.insertId;
  const target = new Date(Date.now() + 3 * 86_400_000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(target).map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  const [hours] = await pool.query('SELECT * FROM operating_hours WHERE weekday=?', [weekday]);
  priorHour = hours[0] || null;
  if (priorHour) {
    hourId = priorHour.id;
    await pool.query('UPDATE operating_hours SET is_open=1, opens_at=?, latest_start_at=? WHERE id=?', ['09:00:00', '17:00:00', hourId]);
  } else {
    const [created] = await pool.query('INSERT INTO operating_hours (weekday, is_open, opens_at, latest_start_at) VALUES (?, 1, ?, ?)', [weekday, '09:00:00', '17:00:00']);
    hourId = created.insertId;
    createdHour = true;
  }
  const available = await fetch(`${base}/api/printers/availability?date=${date}&durationMinutes=30`);
  assert.equal(available.status, 200);
  const availableData = await available.json();
  assert.ok(availableData.printers.find(item => item.id === printerId)?.slots.includes('09:00'));
  function request({ startTime = '09:00', email = 'booking@example.invalid', fileText = 'solid test\nfacet normal 0 0 1\nendfacet\nendsolid test\n' } = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ printerId, date, startTime, durationMinutes: 30, filamentSource: 'own', material: 'PLA', color: 'Beyaz', firstName: 'Kabul', lastName: 'Kişisi', email, rulesAccepted: 'true', privacyNoticeSeen: 'true' })) form.set(key, String(value));
    form.set('file', new Blob([fileText]), 'model.stl');
    return fetch(base + '/api/printers/request', { method: 'POST', body: form, headers: { 'x-real-ip': clientKey } });
  }
  const privateAppointments = join(process.env.PRIVATE_UPLOAD_DIR, 'appointments');
  const beforeRejected = (await readdir(privateAppointments).catch(() => [])).sort();
  assert.equal((await request({ startTime: '09:30', fileText: '<?php echo 1;' })).status, 400);
  assert.equal((await request({ startTime: '09:30', email: 'reject@example.invalid' })).status, 503);
  const [[rejected]] = await pool.query('SELECT COUNT(*) AS total FROM appointments WHERE email=?', ['reject@example.invalid']);
  assert.equal(rejected.total, 0);
  assert.deepEqual((await readdir(privateAppointments).catch(() => [])).sort(), beforeRejected);
  const responses = await Promise.all([request(), request()]);
  const success = responses.find(item => item.status === 201);
  if (success) {
    publicId = (await success.json()).publicId;
    const [[appointment]] = await pool.query('SELECT id, status FROM appointments WHERE public_id=?', [publicId]);
    appointmentId = appointment.id;
    assert.equal(appointment.status, 'pending_verification');
  }
  assert.deepEqual(responses.map(item => item.status).sort(), [201, 409]);
  assert.ok(publicId);
  assert.equal(messages.length, 1);
  const token = messages[0].match(/\/randevu\/dogrula\/[0-9a-f-]{36}\/([a-f0-9]{64})/i)?.[1];
  assert.ok(token, 'Doğrulama bağlantısı e-postada bulunamadı');
  const verified = await fetch(`${base}/api/printers/verification/${publicId}/${token}`, { method: 'POST' });
  assert.equal(verified.status, 200);
  const verifiedData = await verified.json();
  assert.equal(verifiedData.emailSent, true);
  assert.equal(messages.length, 2);
  const tracking = await fetch(base + verifiedData.trackingUrl.replace('/randevu/takip', '/api/printers/tracking'));
  assert.equal(tracking.status, 200);
  assert.equal((await tracking.json()).appointment.status, 'pending_approval');
  const login = await fetch(base + '/api/org/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.ACCEPTANCE_ADMIN_EMAIL, password: process.env.ACCEPTANCE_ADMIN_PASSWORD }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  const { csrfToken } = await login.json();
  assert.ok(cookie && csrfToken);
  const status = await fetch(`${base}/api/printers/appointments/${appointmentId}`, { method: 'PATCH', headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrfToken }, body: JSON.stringify({ status: 'approved' }) });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).emailSent, true);
  assert.equal(messages.length, 3);
  console.log('Başvuru kabulü geçti: multipart/model dosyası, bozuk dosya 400, SMTP reddi ve SQL temizliği 503, eşzamanlı slot 201/409, doğrulama/takip/durum e-postaları.');
} finally {
  if (appointmentId) {
    await pool.query('DELETE FROM appointment_status_histories WHERE appointment_id=?', [appointmentId]);
    await pool.query('DELETE FROM appointment_files WHERE appointment_id=?', [appointmentId]);
    await pool.query('DELETE FROM appointments WHERE id=?', [appointmentId]);
  }
  if (publicId) await rm(join(process.env.PRIVATE_UPLOAD_DIR, 'appointments', publicId), { recursive: true, force: true });
  if (printerId) await pool.query('DELETE FROM printers WHERE id=?', [printerId]);
  if (hourId && createdHour) await pool.query('DELETE FROM operating_hours WHERE id=?', [hourId]);
  else if (priorHour) await pool.query('UPDATE operating_hours SET is_open=?, opens_at=?, latest_start_at=? WHERE id=?', [priorHour.is_open, priorHour.opens_at, priorHour.latest_start_at, priorHour.id]);
  await pool.end();
  api.kill('SIGTERM');
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => smtp.close(resolve));
}
