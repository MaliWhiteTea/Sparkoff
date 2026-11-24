import { randomBytes } from 'node:crypto';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { imageType } from '../shared/media.js';
import { privateFileRoot, resolvedPrivateRoot } from './private-files.js';

const pattern = /^feedback\/(\d+)\/([a-f0-9]{32})\.(jpg|png|webp)$/;
export function newFeedbackImagePath(id: number, extension: string) { return `feedback/${id}/${randomBytes(16).toString('hex')}.${extension}`; }
function diskPath(relative: string, id: number) {
  const match = pattern.exec(relative);
  if (!match || Number(match[1]) !== id) throw new Error('Görsel yolu geçersiz');
  return resolve(privateFileRoot(), relative);
}
export async function saveFeedbackImage(relative: string, id: number, bytes: Uint8Array) {
  await mkdir(privateFileRoot(), { recursive: true, mode: 0o700 });
  const root = await resolvedPrivateRoot();
  diskPath(relative, id);
  const path = resolve(root, relative);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  if (!(await realpath(dirname(path))).startsWith(`${root}${sep}`)) throw new Error('Görsel kök dışına çıkıyor');
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
}
export async function loadFeedbackImage(relative: string, id: number, expectedSize: number) {
  const root = await resolvedPrivateRoot();
  const path = await realpath(diskPath(relative, id));
  if (!path.startsWith(`${root}${sep}`)) throw new Error('Görsel kök dışına çıkıyor');
  const bytes = await readFile(path);
  if (bytes.length !== expectedSize || !imageType(bytes)) throw new Error('Görsel geçersiz');
  return bytes;
}
export async function removeFeedbackImage(relative: string, id: number) { await rm(diskPath(relative, id), { force: true }); }

export function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const type = imageType(bytes)?.extension;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'png' && bytes.length >= 24) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (type === 'webp' && bytes.length >= 30) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === 'VP8X') return { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
    if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === 'VP8L' && bytes[20] === 0x2f) return { width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | (bytes[22] >> 6)) };
  }
  if (type === 'jpg') {
    let at = 2;
    while (at + 4 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      if (marker === 0xd8 || marker === 0xd9) { at += 2; continue; }
      if (marker === 0xda) return null;
      const size = view.getUint16(at + 2);
      if (size < 2 || at + 2 + size > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (size < 7) return null;
        return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
      }
      at += 2 + size;
    }
  }
  return null;
}
