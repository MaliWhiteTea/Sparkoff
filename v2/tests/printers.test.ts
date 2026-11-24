import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filamentSchema, printerSchema } from '../src/shared/schema.js';

test('V1 yazıcı durumları ve kodu doğrulanır', () => {
  assert.equal(printerSchema.parse({ code: ' mk4 ', name: 'Prusa', status: 'active' }).code, 'MK4');
  assert.equal(printerSchema.safeParse({ code: 'MK4', name: 'Prusa', status: 'available' }).success, false);
});

test('filament sıcaklık aralığı ve kullanılamama nedeni doğrulanır', () => {
  const base = { name: 'PLA', color: 'Şeftali', diameterMm: 1.75, available: false };
  assert.equal(filamentSchema.safeParse({ ...base, nozzleTempMin: 220, nozzleTempMax: 190, unavailableReason: 'Stok bekleniyor' }).success, false);
  assert.equal(filamentSchema.safeParse({ ...base, nozzleTempMin: 190, nozzleTempMax: 220 }).success, false);
  assert.equal(filamentSchema.safeParse({ ...base, nozzleTempMin: 190, nozzleTempMax: 220, unavailableReason: 'Stok bekleniyor' }).success, true);
});
