import { eq } from 'drizzle-orm';
import { db, pool } from './db.js';
import { units, users } from '../shared/schema.js';
import { hashPassword } from './auth.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 16) throw new Error('ADMIN_EMAIL ve en az 16 karakterli ADMIN_PASSWORD gerekli');
const existing = await db.select({ id: users.id }).from(users).limit(1);
if (existing.length) throw new Error('Bootstrap yalnız boş users tablosunda çalışır');
const passwordHash = await hashPassword(password);
await db.transaction(async tx => {
  await tx.insert(users).values({ name: 'Sistem Yöneticisi', email, passwordHash, globalRole: 'super_admin' });
  await tx.insert(units).values([{ name: 'Genel', isGeneral: true }, { name: 'Atölye' }]);
});
console.log('İlk sistem yöneticisi oluşturuldu. ADMIN_PASSWORD ortam değişkenini temizleyin.');
await pool.end();
