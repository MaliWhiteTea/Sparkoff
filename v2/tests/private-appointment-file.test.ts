import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { downloadName, openAppointmentFile, privateFileRoot, removeAppointmentFile } from '../src/server/private-files.js';

test('özel randevu dosyası yalnız kendi UUID dizininden, normal dosya olarak açılır', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'sparkoff-private-'));
  const oldPrivate = process.env.PRIVATE_UPLOAD_DIR;
  const oldPublic = process.env.PUBLIC_UPLOAD_DIR;
  const publicId = '12345678-1234-1234-1234-123456789abc';
  const fileId = 'abcdefab-1234-1234-1234-abcdefabcdef';
  const privateRoot = join(temp, 'private');
  const publicRoot = join(temp, 'public');
  const relative = `appointments/${publicId}/${fileId}.stl`;
  try {
    process.env.PRIVATE_UPLOAD_DIR = privateRoot;
    process.env.PUBLIC_UPLOAD_DIR = publicRoot;
    await mkdir(join(privateRoot, 'appointments', publicId), { recursive: true });
    await mkdir(publicRoot);
    await writeFile(join(privateRoot, relative), 'model');
    const file = await openAppointmentFile(relative, publicId, 5);
    await file.close();
    await assert.rejects(openAppointmentFile(relative, '00000000-0000-0000-0000-000000000000', 5));
    await assert.rejects(openAppointmentFile(relative, publicId, 6));
    await assert.rejects(openAppointmentFile('../public/file.stl', publicId, 5));
    const linkedId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    await symlink(join(privateRoot, relative), join(privateRoot, 'appointments', publicId, `${linkedId}.stl`));
    await assert.rejects(openAppointmentFile(`appointments/${publicId}/${linkedId}.stl`, publicId, 5));
    await removeAppointmentFile(`appointments/${publicId}/${linkedId}.stl`, publicId);
    await access(join(privateRoot, relative));
    await assert.rejects(removeAppointmentFile(`appointments/${publicId}/${linkedId}.stl`, '00000000-0000-0000-0000-000000000000'));
    await removeAppointmentFile(relative, publicId);
    await assert.rejects(access(join(privateRoot, relative)));
    await rm(join(privateRoot, 'appointments', publicId), { recursive: true });
    await removeAppointmentFile(relative, publicId);
    process.env.PRIVATE_UPLOAD_DIR = publicRoot;
    assert.throws(() => privateFileRoot());
    assert.equal(downloadName('satır\n../../model.stl', 'stl'), 'satır_.._.._model.stl');
  } finally {
    if (oldPrivate === undefined) delete process.env.PRIVATE_UPLOAD_DIR; else process.env.PRIVATE_UPLOAD_DIR = oldPrivate;
    if (oldPublic === undefined) delete process.env.PUBLIC_UPLOAD_DIR; else process.env.PUBLIC_UPLOAD_DIR = oldPublic;
    await rm(temp, { recursive: true, force: true });
  }
});
