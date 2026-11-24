import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './db.js';
import { requestLimits } from '../shared/schema.js';

export function limitKey(kind: string, value: string): string { return createHash('sha256').update(`${kind}:${value.trim().toLowerCase()}`).digest('hex'); }
export async function countAttempt(key: string, maximum: number, windowSeconds: number): Promise<boolean> {
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  await db.insert(requestLimits).values({ key, attempts: 1, resetAt }).onDuplicateKeyUpdate({ set: {
    attempts: sql`IF(${requestLimits.resetAt} <= CURRENT_TIMESTAMP, 1, ${requestLimits.attempts} + 1)`,
    resetAt: sql`IF(${requestLimits.resetAt} <= CURRENT_TIMESTAMP, ${resetAt}, ${requestLimits.resetAt})`,
  } });
  const [entry] = await db.select().from(requestLimits).where(eq(requestLimits.key, key)).limit(1);
  return !!entry && entry.attempts <= maximum;
}
export async function clearAttempts(key: string): Promise<void> { await db.delete(requestLimits).where(eq(requestLimits.key, key)); }
