export const inventoryCsvHeaders = ['Stok kodu', 'Malzeme', 'Marka', 'Model', 'Tür', 'Kategori', 'Konum kodu', 'Konum', 'Miktar', 'Birim', 'Kritik stok', 'Durum', 'Katalog görünürlüğü', 'Açıklama'];

export type InventoryCsvRow = {
  sku: string | null; name: string; brand: string | null; model: string | null;
  kind: 'consumable' | 'loanable' | 'equipment'; category: string | null;
  locationCode: string | null; location: string | null; quantity: string; unit: string;
  minimumStock: string | null; isActive: boolean; archivedAt: Date | null;
  publicVisibility: string; description: string | null;
};

function csvCell(value: string | null) {
  let safe = value ?? '';
  if (/^[=+\-@]/u.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function inventoryCsv(rows: InventoryCsvRow[]) {
  const lines = inventorySpreadsheetRows(rows);
  return `\uFEFF${lines.map(line => line.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

export function inventorySpreadsheetRows(rows: InventoryCsvRow[]): (string | null)[][] {
  const typeLabel = { consumable: 'Sarf malzemesi', loanable: 'Ödünç verilebilir', equipment: 'Demirbaş' };
  const visibilityLabel: Record<string, string> = { exact: 'Kesin miktar', status: 'Stok durumu', hidden: 'Gizli' };
  return [inventoryCsvHeaders, ...rows.map(row => [
    row.sku, row.name, row.brand, row.model, typeLabel[row.kind], row.category,
    row.locationCode, row.location, row.quantity, row.unit, row.minimumStock,
    row.archivedAt ? 'Arşivlendi' : row.isActive ? 'Aktif' : 'Pasif',
    visibilityLabel[row.publicVisibility] ?? row.publicVisibility, row.description,
  ])];
}
