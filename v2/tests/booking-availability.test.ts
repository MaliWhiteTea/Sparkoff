import assert from 'node:assert/strict';
import { test } from 'node:test';
import { availableStartTimes, istanbulParts } from '../src/server/booking-availability.js';

test('İstanbul çalışma saatleri UTC ana çevrilir; randevu, bakım ve süresi dolan bekleme ayrılır', () => {
  assert.deepEqual(istanbulParts(new Date('2027-01-11T06:00:00Z')), { date: '2027-01-11', time: '09:00' });
  const slots = availableStartTimes({
    date: '2027-01-11', opensAt: '09:00:00', latestStartAt: '11:00:00', slotMinutes: 30,
    durationMinutes: 30, now: new Date('2027-01-01T00:00:00Z'),
    blackouts: [{ startsAt: new Date('2027-01-11T07:30:00Z'), endsAt: new Date('2027-01-11T08:00:00Z') }],
    reservations: [
      { startsAt: new Date('2027-01-11T06:30:00Z'), endsAt: new Date('2027-01-11T07:00:00Z'), status: 'approved', verificationExpiresAt: null },
      { startsAt: new Date('2027-01-11T08:00:00Z'), endsAt: new Date('2027-01-11T08:30:00Z'), status: 'pending_verification', verificationExpiresAt: new Date('2026-12-31T00:00:00Z') },
    ],
  });
  assert.deepEqual(slots, ['09:00', '10:00', '11:00']);
});

test('geçmiş saat ve bozuk çalışma saati müsait görünmez', () => {
  const common = { date: '2027-01-11', latestStartAt: '10:00', slotMinutes: 30, durationMinutes: 30, blackouts: [], reservations: [] };
  assert.deepEqual(availableStartTimes({ ...common, opensAt: '09:00', now: new Date('2027-01-11T06:00:00Z') }), ['09:30', '10:00']);
  assert.deepEqual(availableStartTimes({ ...common, opensAt: 'bozuk', now: new Date('2027-01-01T00:00:00Z') }), []);
});
