import { Hono } from 'hono';
import { and, desc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { activityLogs, appointmentFiles, appointmentStatusHistories, appointments, auditLogs, loans, systemSettings } from '../../shared/schema.js';
import type { AppEnv } from '../auth.js';
import { removeAppointmentFile } from '../private-files.js';

const route = new Hono<AppEnv>();
const loanRetentionKey = 'loans.personal_data_retention_days';
const loanPrivacySchema = z.object({ retentionDays: z.number().int().min(1).max(36500) });
const retentionDays = (value: unknown) => { const days = Number(value); return Number.isSafeInteger(days) && days >= 1 && days <= 36500 ? days : 30; };
const appointmentPrivacySchema = z.object({ fileRetentionDays: z.number().int().min(1).max(365) });
const appointmentSetting = (value: unknown, fallback: number, max: number) => { const number = Number(value); return Number.isSafeInteger(number) && number >= 1 && number <= max ? number : fallback; };
const privacyKeys = ['privacy.controller_name', 'privacy.controller_address', 'privacy.contact_email', 'privacy.appointment_retention_months', 'privacy.file_retention_days', 'privacy.notice_version', 'privacy.is_draft'] as const;
const privacySettingsSchema = z.object({ controllerName: z.string().trim().min(1).max(255), controllerAddress: z.string().trim().min(1).max(1000), contactEmail: z.email().max(255), appointmentRetentionMonths: z.number().int().min(1).max(120), fileRetentionDays: z.number().int().min(1).max(365), noticeVersion: z.string().trim().min(1).max(30), isDraft: z.boolean() });
export async function currentPrivacySettings() {
  const rows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(inArray(systemSettings.key, [...privacyKeys]));
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
  return { controllerName: typeof values[privacyKeys[0]] === 'string' ? values[privacyKeys[0]] : 'Sparkoff Proje Atölyesi', controllerAddress: typeof values[privacyKeys[1]] === 'string' ? values[privacyKeys[1]] : '', contactEmail: typeof values[privacyKeys[2]] === 'string' ? values[privacyKeys[2]] : 'atolye@sparkoff.tr', appointmentRetentionMonths: appointmentSetting(values[privacyKeys[3]], 12, 120), fileRetentionDays: appointmentSetting(values[privacyKeys[4]], 30, 365), noticeVersion: typeof values[privacyKeys[5]] === 'string' ? values[privacyKeys[5]] : '2026-10-16', isDraft: typeof values[privacyKeys[6]] === 'boolean' ? values[privacyKeys[6]] : true };
}
route.get('/privacy/settings', async c => {
  if (!c.get('auth').permissions.includes('privacy_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  return c.json(await currentPrivacySettings());
});
route.put('/privacy/settings', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('privacy_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  const input = privacySettingsSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'KVKK ayarları geçersiz' }, 400);
  const before = await currentPrivacySettings();
  const values = [input.data.controllerName, input.data.controllerAddress, input.data.contactEmail.toLowerCase(), input.data.appointmentRetentionMonths, input.data.fileRetentionDays, input.data.noticeVersion, input.data.isDraft];
  await db.transaction(async tx => {
    for (let index = 0; index < privacyKeys.length; index++) {
      const key = privacyKeys[index]; const value = values[index];
      await tx.insert(systemSettings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
    }
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'privacy.settings.updated', entity: 'system_setting', before, after: input.data });
  });
  return c.json({ ok: true });
});
route.get('/privacy/appointments', async c => {
  if (!c.get('auth').permissions.includes('privacy_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  const rows = await db.select({ key: systemSettings.key, value: systemSettings.value }).from(systemSettings).where(inArray(systemSettings.key, ['privacy.file_retention_days', 'privacy.appointment_retention_months']));
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
  return c.json({ fileRetentionDays: appointmentSetting(values['privacy.file_retention_days'], 30, 365), appointmentRetentionMonths: appointmentSetting(values['privacy.appointment_retention_months'], 12, 120) });
});
route.put('/privacy/appointments', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('privacy_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  const input = appointmentPrivacySchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Dosya süresi 1–365 gün olmalı' }, 400);
  await db.transaction(async tx => {
    await tx.insert(systemSettings).values({ key: 'privacy.file_retention_days', value: input.data.fileRetentionDays }).onDuplicateKeyUpdate({ set: { value: input.data.fileRetentionDays } });
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'settings.appointment_retention.updated', entity: 'system_setting', after: input.data });
  });
  return c.json(input.data);
});
route.get('/privacy/loans', async c => {
  if (!c.get('auth').permissions.includes('privacy_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  const [setting] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, loanRetentionKey)).limit(1);
  return c.json({ retentionDays: retentionDays(setting?.value) });
});
route.put('/privacy/loans', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('privacy_settings_update')) return c.json({ error: 'Yetki yok' }, 403);
  const input = loanPrivacySchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success) return c.json({ error: 'Saklama süresi 1 ile 36500 gün arasında olmalı' }, 400);
  await db.transaction(async tx => {
    const [before] = await tx.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, loanRetentionKey)).for('update').limit(1);
    await tx.insert(systemSettings).values({ key: loanRetentionKey, value: input.data.retentionDays }).onDuplicateKeyUpdate({ set: { value: input.data.retentionDays } });
    await tx.insert(auditLogs).values({ actorId: auth.user.id, action: 'settings.loan_retention.updated', entity: 'system_setting', after: { key: loanRetentionKey, retentionDays: input.data.retentionDays }, before: { retentionDays: retentionDays(before?.value) } });
  });
  return c.json({ retentionDays: input.data.retentionDays });
});
route.get('/logs', async c => {
  if (!c.get('auth').permissions.includes('audit_logs_view')) return c.json({ error: 'Yetki yok' }, 403);
  return c.json({ logs: await db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(100) });
});
route.get('/overview', async c => {
  const auth = c.get('auth');
  if (!auth.permissions.includes('audit_logs_view')) return c.json({ error: 'Yetki yok' }, 403);
  return c.json({ recent: await db.select().from(activityLogs).orderBy(desc(activityLogs.id)).limit(20) });
});
export async function runRetention(): Promise<{ anonymizedLoans: number; appointmentFilesScheduled: number; appointmentFilesDeleted: number; appointmentFileFailures: number; appointmentsDeleted: number; appointmentFailures: number }> {
  const [setting] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, loanRetentionKey)).limit(1);
  const days = retentionDays(setting?.value);
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 86400_000);
  const anonymized = await db.transaction(async tx => {
    const old = await tx.select({ id: loans.id }).from(loans).where(and(lte(loans.closedAt, cutoff), isNull(loans.anonymizedAt))).for('update');
    if (!old.length) return { anonymizedLoans: 0 };
    await tx.update(loans).set({ borrowerFirstName: null, borrowerLastName: null, borrowerNameOriginal: null, borrowerEmail: null, notes: null, closureNote: null, anonymizedAt: now }).where(inArray(loans.id, old.map(row => row.id)));
    await tx.insert(auditLogs).values({ action: 'inventory.loans.anonymized', entity: 'loan', after: { count: old.length, retentionDays: days } });
    return { anonymizedLoans: old.length };
  });
  const files = await runAppointmentFileRetention(now);
  const appointmentsResult = await runAppointmentRetention(now);
  return { ...anonymized, ...files, ...appointmentsResult };
}
export function monthsAgoNoOverflow(now: Date, months: number): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() - months;
  const first = new Date(Date.UTC(year, month, 1, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(now.getUTCDate(), lastDay));
  return first;
}
export async function runAppointmentRetention(now = new Date()): Promise<{ appointmentsDeleted: number; appointmentFailures: number }> {
  const [setting] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, 'privacy.appointment_retention_months')).limit(1);
  const months = appointmentSetting(setting?.value, 12, 120);
  const cutoff = monthsAgoNoOverflow(now, months);
  const result = { appointmentsDeleted: 0, appointmentFailures: 0 };
  let cursor = 0;
  while (true) {
    const batch = await db.select({ id: appointments.id }).from(appointments).where(and(gt(appointments.id, cursor), inArray(appointments.status, ['completed', 'failed', 'rejected', 'canceled', 'expired']), lte(appointments.endsAt, cutoff), or(isNull(appointments.retentionExemptUntil), lte(appointments.retentionExemptUntil, now)))).orderBy(appointments.id).limit(50);
    if (!batch.length) break;
    for (const candidate of batch) {
      try {
        const deleted = await db.transaction(async tx => {
          const [appointment] = await tx.select({ id: appointments.id, publicId: appointments.publicId, status: appointments.status, endsAt: appointments.endsAt, retentionExemptUntil: appointments.retentionExemptUntil }).from(appointments).where(eq(appointments.id, candidate.id)).for('update').limit(1);
          if (!appointment || !['completed', 'failed', 'rejected', 'canceled', 'expired'].includes(appointment.status) || !appointment.endsAt || appointment.endsAt > cutoff || appointment.retentionExemptUntil && appointment.retentionExemptUntil > now) return false;
          const files = await tx.select({ id: appointmentFiles.id, disk: appointmentFiles.disk, path: appointmentFiles.path, deletedAt: appointmentFiles.deletedAt }).from(appointmentFiles).where(eq(appointmentFiles.appointmentId, appointment.id)).for('update');
          for (const file of files) {
            if (file.deletedAt) continue;
            if (file.disk !== 'local') throw new Error('Desteklenmeyen özel dosya diski');
            await removeAppointmentFile(file.path, appointment.publicId);
          }
          await tx.delete(appointmentFiles).where(eq(appointmentFiles.appointmentId, appointment.id));
          await tx.delete(appointmentStatusHistories).where(eq(appointmentStatusHistories.appointmentId, appointment.id));
          await tx.delete(appointments).where(eq(appointments.id, appointment.id));
          return true;
        });
        if (deleted) result.appointmentsDeleted++;
      } catch { result.appointmentFailures++; }
    }
    cursor = batch[batch.length - 1].id;
  }
  if (Object.values(result).some(Boolean)) await db.insert(auditLogs).values({ action: 'appointments.retention_applied', entity: 'appointment', after: { ...result, appointmentRetentionMonths: months } });
  return result;
}
export async function runAppointmentFileRetention(now = new Date()): Promise<{ appointmentFilesScheduled: number; appointmentFilesDeleted: number; appointmentFileFailures: number }> {
  const [setting] = await db.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, 'privacy.file_retention_days')).limit(1);
  const days = appointmentSetting(setting?.value, 30, 365);
  const result = { appointmentFilesScheduled: 0, appointmentFilesDeleted: 0, appointmentFileFailures: 0 };
  let cursor = 0;
  while (true) {
    const batch = await db.select({ id: appointmentFiles.id, createdAt: appointmentFiles.createdAt }).from(appointmentFiles).where(and(gt(appointmentFiles.id, cursor), isNull(appointmentFiles.deletedAt), isNull(appointmentFiles.scheduledDeletionAt))).orderBy(appointmentFiles.id).limit(100);
    if (!batch.length) break;
    for (const file of batch) {
      const scheduledDeletionAt = new Date(file.createdAt.getTime() + days * 86400_000);
      const updated = await db.update(appointmentFiles).set({ scheduledDeletionAt }).where(and(eq(appointmentFiles.id, file.id), isNull(appointmentFiles.scheduledDeletionAt), isNull(appointmentFiles.deletedAt)));
      if (updated[0].affectedRows) result.appointmentFilesScheduled++;
    }
    cursor = batch[batch.length - 1].id;
  }
  cursor = 0;
  while (true) {
    const batch = await db.select({ id: appointmentFiles.id, disk: appointmentFiles.disk, path: appointmentFiles.path, publicId: appointments.publicId }).from(appointmentFiles).innerJoin(appointments, eq(appointmentFiles.appointmentId, appointments.id)).where(and(gt(appointmentFiles.id, cursor), isNull(appointmentFiles.deletedAt), lte(appointmentFiles.scheduledDeletionAt, now), or(isNull(appointments.retentionExemptUntil), lte(appointments.retentionExemptUntil, now)))).orderBy(appointmentFiles.id).limit(100);
    if (!batch.length) break;
    for (const file of batch) {
      if (file.disk !== 'local') { result.appointmentFileFailures++; continue; }
      try {
        await removeAppointmentFile(file.path, file.publicId);
        const updated = await db.update(appointmentFiles).set({ deletedAt: now }).where(and(eq(appointmentFiles.id, file.id), isNull(appointmentFiles.deletedAt)));
        if (updated[0].affectedRows) result.appointmentFilesDeleted++;
      } catch { result.appointmentFileFailures++; }
    }
    cursor = batch[batch.length - 1].id;
  }
  if (Object.values(result).some(Boolean)) await db.insert(auditLogs).values({ action: 'appointment.files.retention_applied', entity: 'appointment_file', after: { ...result, fileRetentionDays: days } });
  return result;
}
export default route;
