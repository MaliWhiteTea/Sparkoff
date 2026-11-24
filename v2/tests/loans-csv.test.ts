import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loanCsvCell, loanCsvLine } from '../src/shared/loans-csv.js';

test('teslim CSV alanı formül ve satır kırma enjeksiyonunu hücre içinde tutar', () => {
  assert.equal(loanCsvCell(' =1+1'), '"\' =1+1"');
  assert.equal(loanCsvCell('Ali"\r\nVeli'), '"Ali""\r\nVeli"');
  assert.equal(loanCsvLine(['=HYPERLINK("https://example.invalid")', null]), '"\'=HYPERLINK(""https://example.invalid"")";""\r\n');
});
