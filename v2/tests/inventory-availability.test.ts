import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableQuantity } from '../src/shared/inventory.js';
import { publicMaterialView } from '../src/shared/schema.js';

test('demirbaş toplamı değişmeden açık ve kısmi teslimler kullanılabilir miktarı azaltır', () => {
  const loans = [
    { quantity: '2.000', returnedQuantity: '1.000', status: 'partial' },
    { quantity: '1.000', returnedQuantity: '0.000', status: 'open' },
    { quantity: '1.000', returnedQuantity: '0.000', status: 'damaged' },
  ];
  assert.equal(availableQuantity('equipment', '3.000', loans), '1.000');
  assert.equal(availableQuantity('loanable', '3.000', loans), '3.000');
});

test('demirbaş kamu kataloğu yalnız kullanılabilir miktarı yayımlar', () => {
  const item = { id: 8, name: 'Lehim İstasyonu', kind: 'equipment' as const, unit: 'adet', brand: null, model: null, quantity: '2.000', publicVisibility: 'exact' };
  const available = availableQuantity(item.kind, item.quantity, [{ quantity: '2.000', returnedQuantity: '0.000', status: 'open' }]);
  assert.deepEqual(publicMaterialView(item, available), { id: 8, name: 'Lehim İstasyonu', kind: 'equipment', unit: 'adet', brand: null, model: null, availability: 'out', quantity: '0.000' });
});
