import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { test } from 'node:test';
import { sendBookingStatus, sendBookingTracking, sendBookingVerification } from '../src/server/booking-mail.js';

test('doğrulama ve takip bağlantıları yerel SMTP alıcısına iletilir', async () => {
  const messages: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 local SMTP\r\n');
    let pending = '';
    let dataMode = false;
    let message = '';
    socket.on('data', chunk => {
      pending += chunk.toString('utf8');
      while (pending.includes('\r\n')) {
        const boundary = pending.indexOf('\r\n');
        const line = pending.slice(0, boundary);
        pending = pending.slice(boundary + 2);
        if (dataMode) {
          if (line === '.') { messages.push(message); message = ''; dataMode = false; socket.write('250 accepted\r\n'); }
          else message += line + '\n';
          continue;
        }
        if (line.startsWith('EHLO') || line.startsWith('HELO')) socket.write('250-local\r\n250 SIZE 1000000\r\n');
        else if (line.startsWith('MAIL FROM') || line.startsWith('RCPT TO')) socket.write('250 OK\r\n');
        else if (line === 'DATA') { dataMode = true; socket.write('354 End data\r\n'); }
        else if (line === 'QUIT') { socket.write('221 Bye\r\n'); socket.end(); }
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(address.port);
  process.env.SMTP_FROM = 'Sparkoff <randevu@example.invalid>';
  process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:4320';
  process.env.SMTP_ALLOW_PLAINTEXT_LOCAL = 'true';
  process.env.NODE_ENV = 'test';
  try {
    await sendBookingVerification('person@example.invalid', '00000000-0000-4000-8000-000000000001', 'A'.repeat(64));
    await sendBookingTracking('person@example.invalid', '00000000-0000-4000-8000-000000000001', 'B'.repeat(64));
    await sendBookingStatus({ to: 'person@example.invalid', status: 'approved', firstName: 'Deniz', startsAt: new Date('2027-01-11T06:00:00Z'), durationMinutes: 30, printer: 'Kabul yazıcısı', adminNote: 'Hazır' });
    assert.equal(messages.length, 3);
    assert.ok(messages[0].replace(/=\n/g, '').includes('/randevu/dogrula/00000000-0000-4000-8000-000000000001/' + 'A'.repeat(64)));
    assert.ok(messages[1].replace(/=\n/g, '').includes('/randevu/takip/00000000-0000-4000-8000-000000000001/' + 'B'.repeat(64)));
    assert.ok(messages[2].includes('30 dakika'));
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
