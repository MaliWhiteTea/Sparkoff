import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { inventoryXlsx, inventoryXlsxToCsv } from '../src/server/inventory-xlsx.js';
import { parseInventoryCsv } from '../src/shared/inventory-import.js';

test('XLSX içe aktarımında sütun eşleme ve üç ondalıklı miktar korunur', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Veri');
  sheet.addRow(['A', 'B', 'C']);
  sheet.addRow(['Türkçe kumpas', 2.5, 'Demirbaş']);
  const csv = await inventoryXlsxToCsv(Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64'));
  const [row] = parseInventoryCsv(csv, { A: 'name', B: 'quantity', C: 'kind' });
  assert.equal(row.name, 'Türkçe kumpas');
  assert.equal(row.quantity, '2.500');
  assert.equal(row.kind, 'equipment');
});

test('formül ve geçersiz XLSX arşivi içe alınmaz', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Veri');
  sheet.addRow(['Malzeme', 'Miktar']);
  sheet.addRow([{ formula: '1+1', result: 2 }, 1]);
  await assert.rejects(inventoryXlsxToCsv(Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64')), /Formül/);
  await assert.rejects(inventoryXlsxToCsv(Buffer.from('sahte dosya').toString('base64')), /XLSX/);
});

test('XLSX dışa aktarımında formüle benzeyen ad metin olarak saklanır', async () => {
  const bytes = await inventoryXlsx([{ sku: 'K-1', name: '=1+1', brand: null, model: null, kind: 'consumable', category: null, locationCode: null, location: null, quantity: '1.000', unit: 'adet', minimumStock: null, isActive: true, archivedAt: null, publicVisibility: 'status', description: null }]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const cell = workbook.worksheets[0].getCell(2, 2);
  assert.equal(cell.value, '=1+1');
  assert.equal(cell.type, ExcelJS.ValueType.String);
});
