import unzipper from 'unzipper';

export const bookingExtensions = ['gcode', '3mf', 'stl', 'step', 'stp', 'obj'] as const;
export type BookingExtension = typeof bookingExtensions[number];

export async function validBookingFile(bytes: Buffer, extension: BookingExtension): Promise<boolean> {
  if (!bytes.length) return false;
  const prefix = bytes.subarray(0, 4096).toString('latin1');
  if (prefix.toLowerCase().includes('<?php')) return false;
  if (extension === 'stl') {
    if (/^\s*solid\b/i.test(prefix) && /facet/i.test(prefix)) return true;
    return bytes.length >= 84 && 84 + bytes.readUInt32LE(80) * 50 === bytes.length;
  }
  if (extension === '3mf') {
    try {
      const archive = await unzipper.Open.buffer(bytes);
      return archive.files.some(file => file.path === '[Content_Types].xml') &&
        archive.files.some(file => /^3D\/.+\.model$/i.test(file.path));
    } catch { return false; }
  }
  if (prefix.includes('\0')) return false;
  if (extension === 'gcode') return /(^|\r?\n)\s*(?:[GMT]\d+|;)/i.test(prefix);
  if (extension === 'step' || extension === 'stp') return prefix.toUpperCase().includes('ISO-10303-21;') && prefix.toUpperCase().includes('HEADER;');
  if (extension === 'obj') return /(^|\r?\n)\s*v\s+[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?\s+[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/i.test(prefix) &&
    /(^|\r?\n)\s*f\s+-?\d+(?:\/[^\s]+)?\s+-?\d+(?:\/[^\s]+)?\s+-?\d+(?:\/[^\s]+)?/i.test(prefix);
  return false;
}
