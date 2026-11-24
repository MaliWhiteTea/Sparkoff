import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialLinkSchema } from '../src/shared/schema.js';

test('kamu kataloğuna eklenen bağlantı yalnız geçerli HTTPS olabilir', () => {
  assert.equal(materialLinkSchema.safeParse({ materialId: 1, externalUrl: 'https://example.org/catalog', title: 'Ürün' }).success, true);
  assert.equal(materialLinkSchema.safeParse({ materialId: 1, externalUrl: 'http://example.org/catalog' }).success, false);
  assert.equal(materialLinkSchema.safeParse({ materialId: 1, externalUrl: 'javascript:alert(1)' }).success, false);
});
