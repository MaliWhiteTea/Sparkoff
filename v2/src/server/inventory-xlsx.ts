import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { Open } from 'unzipper';
import { inventorySpreadsheetRows, type InventoryCsvRow } from '../shared/inventory-csv.js';

const maxArchiveBytes = 2 * 1024 * 1024;
const maxExpandedBytes = 16 * 1024 * 1024;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if ('formula' in value || 'sharedFormula' in value) throw new Error('Formül içeren hücreler içe aktarılamaz.');
  if ('richText' in value) return value.richText.map(part => part.text).join('');
  if ('text' in value) return value.text;
  throw new Error('Desteklenmeyen XLSX hücre türü.');
}

export async function inventoryXlsxToCsv(base64: string): Promise<string> {
  if (base64.length > Math.ceil(maxArchiveBytes * 4 / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error('XLSX dosyası geçersiz veya 2 MB üzerinde.');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > maxArchiveBytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new Error('Geçerli bir XLSX dosyası seçin.');
  const archive = await Open.buffer(bytes);
  if (archive.files.length > 100 || !archive.files.some(file => file.path === 'xl/workbook.xml')) throw new Error('XLSX çalışma kitabı geçersiz veya çok karmaşık.');
  let expanded = 0;
  for (const file of archive.files) {
    if (file.type === 'Directory') continue;
    if ((file.flags & 1) !== 0 || ![0, 8].includes(file.compressionMethod) || file.uncompressedSize > maxExpandedBytes || expanded + file.uncompressedSize > maxExpandedBytes) throw new Error('XLSX dosyası şifreli veya çok büyük.');
    let actual = 0;
    for await (const chunk of file.stream()) {
      actual += (chunk as Buffer).length;
      if (actual > file.uncompressedSize || expanded + actual > maxExpandedBytes) throw new Error('XLSX dosyası açıldığında çok büyük.');
    }
    expanded += actual;
  }
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([bytes]), { sharedStrings: 'cache', hyperlinks: 'ignore', styles: 'ignore' });
  const rows: string[][] = [];
  for await (const worksheet of reader) {
    for await (const batch of worksheet) {
      for (const row of Array.isArray(batch) ? batch : [batch]) {
        if (row.cellCount > 100) throw new Error('XLSX dosyasında en fazla 100 sütun olabilir.');
        const values = Array.from({ length: row.cellCount }, (_, index) => cellText(row.getCell(index + 1).value));
        if (!values.some(value => value.trim())) continue;
        rows.push(values);
        if (rows.length > 2001) throw new Error('XLSX en fazla 2000 veri satırı içerebilir.');
      }
    }
    break;
  }
  if (rows.length < 2) throw new Error('XLSX dosyasında başlık ve en az bir veri satırı gerekli.');
  const width = rows[0].length;
  if (rows.some(row => row.length > width && row.slice(width).some(value => value.trim()))) throw new Error('XLSX veri satırında başlık dışında sütun var.');
  return `${rows.map(row => Array.from({ length: width }, (_, index) => `"${(row[index] || '').replaceAll('"', '""')}"`).join(';')).join('\r\n')}\r\n`;
}

export async function inventoryXlsx(rows: InventoryCsvRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Envanter');
  for (const row of inventorySpreadsheetRows(rows)) sheet.addRow(row.map(value => value ?? ''));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  for (let index = 1; index <= 14; index++) sheet.getColumn(index).width = index === 2 ? 28 : 18;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
