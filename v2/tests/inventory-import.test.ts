import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inventoryCsv } from '../src/shared/inventory-csv.js';
import { analyzeInventoryCsv, importErrors, inspectInventoryCsv, parseInventoryCsv } from '../src/shared/inventory-import.js';

test('V1 biçimindeki CSV tür, miktar ve görünürlüğü V2 alanlarına çevirir', () => {
  const csv = inventoryCsv([{ sku: 'K-1', name: 'Dijital; Kumpas', brand: null, model: null, kind: 'equipment', category: null, locationCode: null, location: null, quantity: '2.500', unit: 'adet', minimumStock: null, isActive: true, archivedAt: null, publicVisibility: 'status', description: 'Satır 1\nSatır 2' }]);
  const [row] = parseInventoryCsv(csv);
  assert.equal(row.kind, 'equipment');
  assert.equal(row.quantity, '2.500');
  assert.equal(row.publicVisibility, 'status');
  assert.equal(row.name, 'Dijital; Kumpas');
  assert.equal(row.description, 'Satır 1\nSatır 2');
});

test('bozuk CSV ve geçersiz miktar içe alınmaz', () => {
  assert.throws(() => parseInventoryCsv('Malzeme;Miktar\nKumpas;1.2345'), /Miktar/);
  assert.throws(() => parseInventoryCsv('Malzeme;Miktar\n"Kumpas;1'), /tırnak/);
  assert.throws(() => parseInventoryCsv('Malzeme;Miktar\nKumpas;1;fazla'), /sütun/);
});

test('önizleme mevcut stok kodunu ve çakışan konumu bildirir', () => {
  const rows = parseInventoryCsv('Stok kodu;Malzeme;Konum kodu;Konum\nK-1;Kumpas;R1;Raf B');
  const errors = importErrors(rows, [{ sku: 'k-1', name: 'Başka malzeme' }], [{ code: 'R1', name: 'Raf A' }]);
  assert.equal(errors.length, 2);
  assert.ok(errors.some(error => error.message.includes('tekrar')));
  assert.ok(errors.some(error => error.message.includes('Konum')));
});

test('önizleme tek başına verilen konum kodunun dosya içi çakışmasını bildirir', () => {
  const rows = parseInventoryCsv('Stok kodu;Malzeme;Konum kodu;Konum\nA;Birinci;R1;\nB;İkinci;R1;Farklı raf');
  const errors = importErrors(rows, [], []);
  assert.ok(errors.some(error => error.line === 3 && error.message.includes('Konum')));
});

test('tanınmayan CSV başlıkları açık eşlemeyle güvenle içe alınır', () => {
  const csv = 'Başlık A;Başlık B;Başlık C\nÖlçü aleti;2,5;Elektronik';
  const inspection = inspectInventoryCsv(csv);
  assert.deepEqual(inspection.headers, ['Başlık A', 'Başlık B', 'Başlık C']);
  assert.equal(inspection.suggestedMapping['Başlık A'], null);
  assert.throws(() => parseInventoryCsv(csv), /Malzeme sütunu/);
  const [row] = parseInventoryCsv(csv, { 'Başlık A': 'name', 'Başlık B': 'quantity', 'Başlık C': 'category' });
  assert.equal(row.name, 'Ölçü aleti');
  assert.equal(row.quantity, '2.500');
  assert.equal(row.category, 'Elektronik');
});

test('sütun eşlemesi dosyada olmayan başlığı ve tekrar eden alanı reddeder', () => {
  const csv = 'A;B\nKumpas;Ölçüm';
  assert.throws(() => parseInventoryCsv(csv, { A: 'name', C: 'description' }), /Dosyada bulunmayan/);
  assert.throws(() => parseInventoryCsv(csv, { A: 'name', B: 'name' }), /birden fazla/);
  assert.throws(() => inspectInventoryCsv('A;B\nBir;iki;üç'), /sütun sayısı/);
});

test('hatalı miktarlı satır ayrılırken geçerli satır korunur', () => {
  const analysis = analyzeInventoryCsv('Malzeme;Miktar\nSağlam kayıt;2\nHatalı kayıt;1.2345');
  assert.equal(analysis.totalCount, 2);
  assert.equal(analysis.rows.length, 1);
  assert.equal(analysis.rows[0].name, 'Sağlam kayıt');
  assert.equal(analysis.errors[0].line, 3);
  assert.match(analysis.errors[0].message, /Miktar/);
});
