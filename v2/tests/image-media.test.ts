import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageType, videoType } from '../src/shared/media.js';

test('fotoğraf türü dosya adına değil içeriğin imzasına göre belirlenir', () => {
  assert.deepEqual(imageType(new Uint8Array([0xff, 0xd8, 0xff, 0x00])), { mime: 'image/jpeg', extension: 'jpg' });
  assert.deepEqual(imageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), { mime: 'image/png', extension: 'png' });
  assert.equal(imageType(new TextEncoder().encode('<svg onload="alert(1)"/>')), null);
});

test('video türü MP4 ve WebM imzasından belirlenir', () => {
  assert.deepEqual(videoType(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0])), { mime: 'video/mp4', extension: 'mp4' });
  assert.deepEqual(videoType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 119, 101, 98, 109, 0, 0, 0, 0])), { mime: 'video/webm', extension: 'webm' });
  assert.equal(videoType(new TextEncoder().encode('<script>alert(1)</script>')), null);
});
