import test from 'node:test';
import assert from 'node:assert/strict';
import { imageDimensions } from '../src/server/feedback-image.js';

test('geri bildirim PNG boyutu görüntü başlığından okunur', () => {
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=', 'base64');
  assert.deepEqual(imageDimensions(image), { width: 1, height: 1 });
  const oversized = Buffer.from(image);
  oversized.writeUInt32BE(6001, 16);
  assert.equal(imageDimensions(oversized)?.width, 6001);
  assert.equal(imageDimensions(Buffer.from('invalid')), null);
});
