import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryCsv } from '../src/shared/inventory-csv.js';

test('CSV Türkçe başlık, demirbaş eşlemesi ve formül güvenliğiyle dışa aktarılır', () => {
  const csv = inventoryCsv([{ sku: '=S1', name: 'Lehim; "İstasyonu"', brand: null, model: null, kind: 'equipment', category: 'Araçlar', locationCode: null, location: null, quantity: '2.000', unit: 'adet', minimumStock: null, isActive: true, archivedAt: null, publicVisibility: 'status', description: '+FORMUL' }]);
  assert.ok(csv.startsWith('\uFEFF"Stok kodu";"Malzeme"'));
  assert.ok(csv.includes('"\'=S1";"Lehim; ""İstasyonu"""'));
  assert.ok(csv.includes('"Demirbaş"'));
  assert.ok(csv.includes('"Stok durumu";"\'+FORMUL"'));
});
