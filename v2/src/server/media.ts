import { resolve, join, dirname } from 'node:path';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const root = resolve(process.env.PUBLIC_UPLOAD_DIR || join(process.cwd(), 'storage/public'));
export function newImagePath(materialId: number, extension: string) { return `inventory-media/${materialId}/${randomBytes(16).toString('hex')}.${extension}`; }
export function newVideoPath(materialId: number, extension: string) { return `inventory-media/${materialId}/${randomBytes(16).toString('hex')}.${extension}`; }
export function mediaDiskPath(relative: string) {
  if (!/^inventory-media\/\d+\/[a-f0-9]{32}\.(jpg|png|webp|mp4|webm)$/.test(relative)) throw new Error('Medya yolu geçersiz');
  return resolve(root, relative);
}
export async function saveMediaFile(relative: string, bytes: Uint8Array) {
  const file = mediaDiskPath(relative);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
}
export async function loadMediaFile(relative: string) { return readFile(mediaDiskPath(relative)); }
export async function removeMediaFile(relative: string) { await rm(mediaDiskPath(relative), { force: true }); }
