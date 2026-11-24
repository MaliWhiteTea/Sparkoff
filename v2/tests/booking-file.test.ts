import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validBookingFile } from '../src/server/booking-file.js';

test('3D dosya biçimi uzantı ve gerçek içerikle doğrulanır', async () => {
  const binaryStl = Buffer.alloc(84 + 50);
  binaryStl.writeUInt32LE(1, 80);
  assert.equal(await validBookingFile(binaryStl, 'stl'), true);
  binaryStl.writeUInt32LE(2, 80);
  assert.equal(await validBookingFile(binaryStl, 'stl'), false);
  assert.equal(await validBookingFile(Buffer.from('G1 X1 Y2\n'), 'gcode'), true);
  assert.equal(await validBookingFile(Buffer.from('G1 X1\0Y2'), 'gcode'), false);
  assert.equal(await validBookingFile(Buffer.from('ISO-10303-21;\nHEADER;'), 'step'), true);
  assert.equal(await validBookingFile(Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n'), 'obj'), true);
  assert.equal(await validBookingFile(Buffer.from('v 0 0 0\n'), 'obj'), false);
  assert.equal(await validBookingFile(Buffer.from('<?php echo 1;\nG1 X1'), 'gcode'), false);
  assert.equal(await validBookingFile(Buffer.from('not a ZIP'), '3mf'), false);
});
