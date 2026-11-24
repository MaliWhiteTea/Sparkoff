import assert from 'node:assert/strict';

const database = new URL(process.env.DATABASE_URL || 'mysql://invalid/');
const base = process.env.CI_SMOKE_BASE_URL || 'http://127.0.0.1:4320';
if (process.env.CI !== 'true' || database.hostname !== '127.0.0.1' || database.pathname !== '/sparkoff_v2_ci' || base !== 'http://127.0.0.1:4320') {
  throw new Error('Bu kabul yalnız ayrı yerel CI veritabanında çalışır');
}
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('CI yöneticisi eksik');

async function call(path, { method = 'GET', body, cookie, csrf, expected = 200 } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return { response, result };
}

let ready = false;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const response = await fetch(`${base}/api/health`);
    if (response.ok) { ready = true; break; }
  } catch { /* Sunucu henüz dinlemiyor. */ }
  await new Promise(resolve => setTimeout(resolve, 250));
}
assert.ok(ready, 'CI API sunucusu başlatılamadı');

await call('/inventory/search', { expected: 401 });
await call('/inventory/options', { expected: 401 });
const login = await call('/org/login', { method: 'POST', body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
const csrf = login.result.csrfToken;
assert.ok(cookie && csrf);
const auth = { cookie, csrf };
assert.equal((await call('/inventory/count', auth)).result.total, 0);
assert.equal((await call('/inventory/search', auth)).result.total, 0);

const created = [];
for (let index = 1; index <= 25; index++) {
  const result = await call('/inventory', { ...auth, method: 'POST', expected: 201, body: { name: `CI Malzeme ${String(index).padStart(2, '0')}`, kind: 'consumable', unit: 'adet', quantity: index, publicVisibility: 'exact' } });
  created.push(result.result.id);
}
assert.equal((await call('/inventory/count', auth)).result.total, 25);
assert.equal((await call('/inventory/options', auth)).result.materials.length, 25);
const first = (await call('/inventory/search?page=1', auth)).result;
const second = (await call('/inventory/search?page=2', auth)).result;
assert.equal(first.total, 25);
assert.equal(first.materials.length, 24);
assert.equal(second.materials.length, 1);
assert.deepEqual([...first.materials, ...second.materials].map(item => item.id), created);
assert.ok(first.materials.every(item => !('imagePath' in item)));
assert.equal((await call('/inventory/search?sort=quantity&status=active', auth)).result.total, 25);
await call('/inventory/search?page=0', { ...auth, expected: 400 });
assert.equal((await call('/inventory/media/search', auth)).result.total, 0);
process.stdout.write('Temiz CI veritabanında giriş, yetki, 25 kayıt, envanter sayfalama ve medya listesi geçti.\n');
