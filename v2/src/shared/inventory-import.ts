import { inventoryCsvHeaders } from './inventory-csv.js';

export type ImportRow = {
  line: number; name: string; sku: string | null; brand: string | null; model: string | null;
  kind: 'consumable' | 'loanable' | 'equipment'; category: string | null;
  locationCode: string | null; location: string | null; quantity: string; unit: string;
  minimumStock: string | null; status: 'active' | 'inactive' | 'archived';
  publicVisibility: 'exact' | 'status' | 'hidden'; description: string | null;
};

export const importFields = ['sku', 'name', 'brand', 'model', 'kind', 'category', 'locationCode', 'location', 'quantity', 'unit', 'minimumStock', 'status', 'publicVisibility', 'description'] as const;
export type ImportField = typeof importFields[number];
export type ImportMapping = Record<string, ImportField | null>;
export const importFieldLabels: Record<ImportField, string> = { sku: 'Stok kodu', name: 'Malzeme adı', brand: 'Marka', model: 'Model', kind: 'Tür', category: 'Kategori', locationCode: 'Konum kodu', location: 'Konum', quantity: 'Miktar', unit: 'Birim', minimumStock: 'Kritik stok', status: 'Durum', publicVisibility: 'Katalog görünürlüğü', description: 'Açıklama' };
const fields = importFields;
const aliases: Record<string, typeof fields[number]> = Object.fromEntries(inventoryCsvHeaders.map((header, index) => [normalize(header), fields[index]])) as Record<string, typeof fields[number]>;
for (const [label, field] of Object.entries({ 'malzeme adı': 'name', 'ürün': 'name', 'urun': 'name', 'kod': 'sku', 'brand': 'brand', 'üretici': 'brand', 'uretici': 'brand', 'model no': 'model', 'model numarası': 'model', 'yer': 'location', 'tur': 'kind', 'adet': 'quantity', 'minimum stok': 'minimumStock', 'görünürlük': 'publicVisibility', 'aciklama': 'description' })) aliases[normalize(label)] = field as typeof fields[number];

function normalize(value: string) { return value.trim().toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').replaceAll('ü', 'u').replaceAll('ö', 'o').replaceAll('ş', 's').replaceAll('ğ', 'g').replaceAll('ç', 'c'); }
function optional(value: string) { return value.trim() || null; }
function decimal(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized) || Number(normalized) > 9999999999 || !Number.isFinite(Number(normalized))) throw new Error('Miktar 0 ile 9.999.999.999 arasında ve en fazla üç ondalık basamaklı olmalı.');
  return Number(normalized).toFixed(3);
}

function records(csv: string): { line: number; values: string[] }[] {
  const result: { line: number; values: string[] }[] = [];
  let row: string[] = []; let cell = ''; let quoted = false; let line = 1; let rowLine = 1;
  const firstLine = csv.slice(0, csv.indexOf('\n') >= 0 ? csv.indexOf('\n') : csv.length);
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted) quoted = false;
      else if (cell === '') quoted = true;
      else throw new Error(`${line}. satırda geçersiz tırnak.`);
    } else if (char === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(cell); if (row.some(value => value.trim() !== '')) result.push({ line: rowLine, values: row });
      row = []; cell = ''; line++; rowLine = line;
    } else { cell += char; if (char === '\n') line++; }
  }
  if (quoted) throw new Error('CSV içinde kapanmamış tırnak var.');
  row.push(cell); if (row.some(value => value.trim() !== '')) result.push({ line: rowLine, values: row });
  return result;
}

export function inspectInventoryCsv(csv: string) {
  if (new TextEncoder().encode(csv).length > 2 * 1024 * 1024) throw new Error('CSV en fazla 2 MB olabilir.');
  const lines = records(csv.replace(/^\uFEFF/, ''));
  if (lines.length < 2) throw new Error('Başlık ve en az bir veri satırı gerekli.');
  if (lines.length > 2001) throw new Error('CSV en fazla 2000 veri satırı içerebilir.');
  const headers = lines[0].values.map(value => value.trim());
  const normalized = headers.map(normalize);
  if (headers.length > 100 || normalized.some(value => !value) || new Set(normalized).size !== normalized.length) throw new Error('Başlıklar boş, tekrarlı veya 100 sütundan fazla olamaz.');
  for (const row of lines.slice(1)) if (row.values.length !== headers.length) throw new Error(`${row.line}. satırın sütun sayısı başlıklarla eşleşmiyor.`);
  const suggestedMapping = Object.fromEntries(headers.map((header, index) => [header, aliases[normalized[index]] || null])) as ImportMapping;
  return { headers, rowCount: lines.length - 1, sample: lines.slice(1, 6).map(row => ({ line: row.line, values: Object.fromEntries(headers.map((header, index) => [header, row.values[index]])) })), columnQuality: headers.map((header, index) => ({ header, emptyCount: lines.slice(1).filter(row => !row.values[index].trim()).length })), suggestedMapping };
}

function preparedCsv(csv: string, selectedMapping?: ImportMapping) {
  const inspection = inspectInventoryCsv(csv);
  const lines = records(csv.replace(/^\uFEFF/, ''));
  const headers = inspection.headers;
  if (selectedMapping && Object.keys(selectedMapping).some(header => !headers.includes(header))) throw new Error('Dosyada bulunmayan sütun eşlendi.');
  const mapping = headers.map(header => selectedMapping ? selectedMapping[header] || null : inspection.suggestedMapping[header]);
  if (mapping.some(field => field && !fields.includes(field))) throw new Error('Bilinmeyen envanter alanı eşlendi.');
  if (!mapping.includes('name')) throw new Error('Malzeme sütunu bulunamadı.');
  const mapped = mapping.filter(Boolean);
  if (new Set(mapped).size !== mapped.length) throw new Error('Aynı alan birden fazla sütuna eşlenmiş.');
  return { lines: lines.slice(1), mapping };
}

function parseRow(line: number, values: string[], mapping: (ImportField | null)[]): ImportRow {
    const source: Record<string, string> = {};
    values.forEach((value, index) => { if (mapping[index]) source[mapping[index]!] = value.trim(); });
    const name = source.name || '';
    if (!name || name.length > 200) throw new Error(`${line}. satırda malzeme adı geçersiz.`);
    for (const [key, max] of Object.entries({ sku: 100, brand: 120, model: 160, unit: 30, description: 3000 })) {
      if ((source[key] || '').length > max) throw new Error(`${line}. satırda ${key} çok uzun.`);
    }
    const kindValue = normalize(source.kind || 'sarf');
    const kind = ({ 'sarf': 'consumable', 'sarf malzemesi': 'consumable', 'consumable': 'consumable', 'odunc': 'loanable', 'odunc verilebilir': 'loanable', 'loanable': 'loanable', 'demirbas': 'equipment', 'fixed_asset': 'equipment', 'equipment': 'equipment' } as const)[kindValue as 'sarf'];
    const visibilityValue = normalize(source.publicVisibility || 'durum');
    const publicVisibility = ({ 'kesin': 'exact', 'kesin miktar': 'exact', 'exact': 'exact', 'durum': 'status', 'stok durumu': 'status', 'status': 'status', 'gizli': 'hidden', 'hidden': 'hidden' } as const)[visibilityValue as 'durum'];
    const statusValue = normalize(source.status || 'aktif');
    const status = ({ 'aktif': 'active', 'active': 'active', 'pasif': 'inactive', 'inactive': 'inactive', 'arsivlendi': 'archived', 'archived': 'archived' } as const)[statusValue as 'aktif'];
    if (!kind || !publicVisibility || !status) throw new Error(`${line}. satırda tür, görünürlük veya durum tanınmıyor.`);
    return { line, name, sku: optional(source.sku || ''), brand: optional(source.brand || ''), model: optional(source.model || ''), kind,
      category: optional(source.category || ''), locationCode: optional(source.locationCode || ''), location: optional(source.location || ''),
      quantity: decimal(source.quantity || '0'), unit: source.unit || 'adet', minimumStock: source.minimumStock ? decimal(source.minimumStock) : null,
      status, publicVisibility, description: optional(source.description || '') };
}

export function analyzeInventoryCsv(csv: string, selectedMapping?: ImportMapping) {
  const { lines, mapping } = preparedCsv(csv, selectedMapping);
  const rows: ImportRow[] = [];
  const errors: { line: number; message: string }[] = [];
  for (const { line, values } of lines) {
    try { rows.push(parseRow(line, values, mapping)); }
    catch (error) { errors.push({ line, message: (error as Error).message }); }
  }
  return { totalCount: lines.length, rows, errors };
}

export function parseInventoryCsv(csv: string, selectedMapping?: ImportMapping): ImportRow[] {
  const analysis = analyzeInventoryCsv(csv, selectedMapping);
  if (analysis.errors.length) throw new Error(analysis.errors[0].message);
  return analysis.rows;
}

export function importErrors(rows: ImportRow[], existing: { sku?: string | null; name: string }[], existingLocations: { name: string; code: string | null }[]) {
  const key = (value: string) => value.trim().toLocaleLowerCase('tr-TR');
  const skuSet = new Set(existing.map(row => row.sku && key(row.sku)).filter(Boolean));
  const nameSet = new Set(existing.map(row => key(row.name)));
  const seen = new Set<string>();
  const locationNames = new Map(existingLocations.map(row => [key(row.name), key(row.code || '')]));
  const locationCodes = new Map(existingLocations.filter(row => row.code).map(row => [key(row.code!), key(row.name)]));
  const errors: { line: number; message: string }[] = [];
  for (const row of rows) {
    if (row.category && row.category.length > 120) errors.push({ line: row.line, message: 'Kategori adı çok uzun.' });
    if (row.location && row.location.length > 120) errors.push({ line: row.line, message: 'Konum adı çok uzun.' });
    if (row.locationCode && row.locationCode.length > 50) errors.push({ line: row.line, message: 'Konum kodu çok uzun.' });
    if (row.location || row.locationCode) {
      const code = row.locationCode ? key(row.locationCode) : '';
      const knownName = code ? locationCodes.get(code) : undefined;
      const name = row.location ? key(row.location) : knownName || code;
      const knownCode = locationNames.get(name);
      if ((code && knownName && knownName !== name) || (code && knownCode !== undefined && knownCode !== code)) errors.push({ line: row.line, message: 'Konum adı ve kodu mevcut kayıtlarla uyuşmuyor.' });
      if (!locationNames.has(name)) locationNames.set(name, code);
      if (code && !locationCodes.has(code)) locationCodes.set(code, name);
    }
    const duplicateKey = row.sku ? `sku:${key(row.sku)}` : `name:${key(row.name)}`;
    if (seen.has(duplicateKey) || (row.sku ? skuSet.has(key(row.sku)) : nameSet.has(key(row.name)))) errors.push({ line: row.line, message: 'Envanterde veya dosyada tekrar eden malzeme.' });
    seen.add(duplicateKey);
  }
  return errors;
}
