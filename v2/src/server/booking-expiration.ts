import { and, asc, eq, gt, lte } from 'drizzle-orm';
import { db } from './db.js';
import { appointmentStatusHistories, appointments } from '../shared/schema.js';

export async function expireDueVerifications(): Promise<number> {
  const now = new Date();
  let cursor = 0;
  let expired = 0;
  while (true) {
    const batch = await db.select({ id: appointments.id }).from(appointments).where(and(
      gt(appointments.id, cursor), eq(appointments.status, 'pending_verification'), lte(appointments.verificationExpiresAt, now),
    )).orderBy(asc(appointments.id)).limit(100);
    if (!batch.length) break;
    cursor = batch.at(-1)!.id;
    for (const { id } of batch) {
      expired += await db.transaction(async tx => {
        const [appointment] = await tx.select({ status: appointments.status, expiresAt: appointments.verificationExpiresAt }).from(appointments).where(eq(appointments.id, id)).for('update').limit(1);
        if (!appointment || appointment.status !== 'pending_verification' || !appointment.expiresAt || appointment.expiresAt > now) return 0;
        await tx.update(appointments).set({ status: 'expired', verificationTokenHash: null, updatedAt: now }).where(eq(appointments.id, id));
        await tx.insert(appointmentStatusHistories).values({ appointmentId: id, fromStatus: 'pending_verification', toStatus: 'expired', note: 'E-posta doğrulama süresi doldu.' });
        return 1;
      });
    }
  }
  return expired;
}
