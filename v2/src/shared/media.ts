export function imageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return { mime: 'image/png', extension: 'png' };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
}

export function videoType(bytes: Uint8Array) {
  if (bytes.length >= 16 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (['isom', 'iso2', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'MSNV'].includes(brand)) return { mime: 'video/mp4', extension: 'mp4' };
  }
  if (bytes.length >= 16 && [0x1a, 0x45, 0xdf, 0xa3].every((value, index) => bytes[index] === value)) {
    const header = new TextDecoder('latin1').decode(bytes.slice(0, Math.min(bytes.length, 4096)));
    if (header.includes('webm')) return { mime: 'video/webm', extension: 'webm' };
  }
  return null;
}
