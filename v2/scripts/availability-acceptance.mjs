import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
const base = process.env.ACCEPTANCE_BASE_URL || 'http://127.0.0.1:4320';
if (url.hostname !== '127.0.0.1' || url.port !== '4319' || url.pathname !== '/sparkoff_v2_acceptance' || base !== 'http://127.0.0.1:4320') {
  throw new Error('Yalnız ayrı yerel kabul MariaDB/API kullanılabilir');
}
const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
const parts = Object.fromEntries(formatter.formatToParts(new Date(Date.now() + 86_400_000)).map(part => [part.type, part.value]));
const date = `${parts.year}-${parts.month}-${parts.day}`;
const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
const db = await mysql.createConnection(process.env.DATABASE_URL);
let printerId;
let bookingId;
let blackoutId;
const [priorHours] = await db.execute('SELECT * FROM operating_hours WHERE weekday=?', [weekday]);
try {
  const [printer] = await db.execute('INSERT INTO printers (code, name, status) VALUES (?, ?, ?)', [`AV${randomUUID().slice(0, 8).toUpperCase()}`, 'Müsaitlik kabul yazıcısı', 'active']);
  printerId = printer.insertId;
  await db.execute(`INSERT INTO operating_hours (weekday, is_open, opens_at, latest_start_at) VALUES (?, 1, '09:00:00', '11:00:00')
    ON DUPLICATE KEY UPDATE is_open=1, opens_at='09:00:00', latest_start_at='11:00:00'`, [weekday]);
  const [booking] = await db.execute('INSERT INTO appointments (public_id, printer_id, status, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), printerId, 'approved', `${date} 06:30:00`, `${date} 07:00:00`]);
  bookingId = booking.insertId;
  const [blackout] = await db.execute('INSERT INTO blackout_periods (printer_id, starts_at, ends_at, reason) VALUES (?, ?, ?, ?)',
    [printerId, `${date} 07:30:00`, `${date} 08:00:00`, 'Yerel kabul']);
  blackoutId = blackout.insertId;
  const response = await fetch(`${base}/api/printers/availability?date=${date}&durationMinutes=30`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.printers.find(row => row.id === printerId)?.slots, ['09:00', '10:00', '11:00']);
  const invalid = await fetch(`${base}/api/printers/availability?date=${date}&durationMinutes=7`);
  assert.equal(invalid.status, 400);
  console.log('Müsaitlik SQL kabulü geçti: İstanbul saati, rezervasyon, bakım ve geçersiz süre');
} finally {
  if (blackoutId) await db.execute('DELETE FROM blackout_periods WHERE id=?', [blackoutId]);
  if (bookingId) await db.execute('DELETE FROM appointments WHERE id=?', [bookingId]);
  if (printerId) await db.execute('DELETE FROM printers WHERE id=?', [printerId]);
  if (priorHours.length) {
    const row = priorHours[0];
    await db.execute('UPDATE operating_hours SET is_open=?, opens_at=?, latest_start_at=? WHERE weekday=?', [row.is_open, row.opens_at, row.latest_start_at, weekday]);
  } else await db.execute('DELETE FROM operating_hours WHERE weekday=?', [weekday]);
  await db.end();
}
