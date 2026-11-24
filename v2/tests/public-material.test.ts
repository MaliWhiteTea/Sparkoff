import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicMaterialView } from '../src/shared/schema.js';

const item = { id: 7, name: 'PLA', kind: 'consumable' as const, unit: 'kg', brand: null, model: null, quantity: '12.000' };

test('durum görünürlüğü kesin stok miktarını açıklamaz', () => {
  assert.deepEqual(publicMaterialView({ ...item, publicVisibility: 'status' }), { id: 7, name: 'PLA', kind: 'consumable', unit: 'kg', brand: null, model: null, availability: 'available', quantity: null });
});

test('kesin görünürlükte miktar yayımlanır', () => {
  assert.equal(publicMaterialView({ ...item, publicVisibility: 'exact' }).quantity, '12.000');
});
