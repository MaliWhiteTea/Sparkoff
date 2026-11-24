import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoApi } from '../src/client/demo.js';

test('örnek mod yöneticisi çalışma saati ve takvim bölümünü açabilir', async () => {
  const values = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } },
    window: { dispatchEvent: () => true },
  });
  const me = await demoApi<{ permissions: string[] }>('/org/me', {});
  assert.ok(me.permissions.includes('printers_manage_hours'));
  assert.ok(me.permissions.includes('printers_manage_schedule'));
  const hours = await demoApi<{ hours: { weekday: number }[] }>('/printers/manage/hours', {});
  assert.deepEqual(hours.hours.map(row => row.weekday), [1, 2, 3, 4, 5, 6, 7]);
  const blackouts = await demoApi<{ blackouts: { reason: string }[] }>('/printers/manage/blackouts', {});
  assert.equal(blackouts.blackouts[0].reason, 'Örnek bakım aralığı');
  await demoApi('/printers/appointments/1', { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
  await demoApi('/printers/appointments/1', { method: 'PATCH', body: JSON.stringify({ status: 'ready' }) });
  const appointments = await demoApi<{ appointments: { status: string }[] }>('/printers/appointments', {});
  assert.equal(appointments.appointments[0].status, 'ready');
});
