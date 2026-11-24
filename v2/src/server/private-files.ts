import { constants } from 'node:fs';
import { open, realpath, unlink, type FileHandle } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const pathPattern = new RegExp(`^appointments/(${uuid})/(${uuid})\\.(gcode|3mf|stl|step|stp|obj)$`);

export function privateFileRoot(): string {
  const root = resolve(process.env.PRIVATE_UPLOAD_DIR || join(process.cwd(), 'storage/private'));
  const publicRoot = resolve(process.env.PUBLIC_UPLOAD_DIR || join(process.cwd(), 'storage/public'));
  const webRoot = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
  if ([publicRoot, webRoot].some(openRoot => root === openRoot || root.startsWith(`${openRoot}${sep}`))) throw new Error('Özel dosya kökü herkese açık dizin içinde olamaz');
  return root;
}

export async function resolvedPrivateRoot(): Promise<string> {
  const root = await realpath(privateFileRoot());
  const publicRoots = [resolve(process.env.PUBLIC_UPLOAD_DIR || join(process.cwd(), 'storage/public')), resolve(fileURLToPath(new URL('../public/', import.meta.url)))];
  for (const path of publicRoots) {
    const publicRoot = await realpath(path).catch(() => null);
    if (publicRoot && (root === publicRoot || root.startsWith(`${publicRoot}${sep}`))) throw new Error('Özel dosya kökü herkese açık dizin içinde olamaz');
  }
  return root;
}

export async function openAppointmentFile(relative: string, appointmentPublicId: string, expectedSize: number): Promise<FileHandle> {
  const match = pathPattern.exec(relative);
  if (!match || match[1].toLowerCase() !== appointmentPublicId.toLowerCase() || !Number.isSafeInteger(expectedSize) || expectedSize < 1) throw new Error('Özel dosya yolu geçersiz');
  const root = await resolvedPrivateRoot();
  const target = resolve(root, relative);
  const actual = await realpath(target);
  if (!actual.startsWith(`${root}${sep}`)) throw new Error('Özel dosya kökü dışına çıkılamaz');
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size !== expectedSize) throw new Error('Özel dosya boyutu veya türü geçersiz');
    return handle;
  } catch (error) { await handle.close(); throw error; }
}

export function downloadName(original: string, extension: string): string {
  const cleaned = original.replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim().slice(0, 180);
  return cleaned || `model.${extension}`;
}

export async function removeAppointmentFile(relative: string, appointmentPublicId: string): Promise<void> {
  const match = pathPattern.exec(relative);
  if (!match || match[1].toLowerCase() !== appointmentPublicId.toLowerCase()) throw new Error('Özel dosya yolu geçersiz');
  const root = await resolvedPrivateRoot();
  const directory = await realpath(resolve(root, 'appointments', match[1])).catch(error => {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  });
  if (!directory) return;
  if (!directory.startsWith(`${root}${sep}`)) throw new Error('Özel dosya kökü dışına çıkılamaz');
  const target = resolve(directory, match[2] + '.' + match[3]);
  try { await unlink(target); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
