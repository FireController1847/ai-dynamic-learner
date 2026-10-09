export const BACKUP_REMINDER_KEY = 'dynamic-learner.backup-reminders.v1';
export const REMINDER_INTERVALS = [1, 3, 7, 14, 30] as const;
export type ReminderStage = 0 | 1 | 2 | 3;

export interface BackupMetadata {
  version: 1;
  intervalDays: number | null;
  lastExportAt: number | null;
  exportedFingerprint: string | null; // Legacy metadata: retained for backward compatibility.
  exportedAuthoredRevision: number | null;
  firstUnbackedAt: number | null;
  unbackedImport: boolean;
  snoozedUntil: number | null;
}

export function defaultBackupMetadata(): BackupMetadata {
  return {
    version: 1, intervalDays: 3, lastExportAt: null, exportedFingerprint: null, exportedAuthoredRevision: null,
    firstUnbackedAt: null, unbackedImport: false, snoozedUntil: null,
  };
}

function timestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value : null;
}

export function parseBackupMetadata(text: string | null): BackupMetadata | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const fields = value as Record<string, unknown>;
    if (fields.version !== 1 ||
      (fields.intervalDays !== null && !REMINDER_INTERVALS.some(days => days === fields.intervalDays)) ||
      (fields.exportedFingerprint !== null &&
        (typeof fields.exportedFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fields.exportedFingerprint))) ||
      typeof fields.unbackedImport !== 'boolean') return null;
    return {
      version: 1,
      intervalDays: fields.intervalDays as number | null,
      lastExportAt: timestamp(fields.lastExportAt),
      exportedFingerprint: fields.exportedFingerprint as string | null,
      exportedAuthoredRevision: typeof fields.exportedAuthoredRevision === 'number' &&
        Number.isSafeInteger(fields.exportedAuthoredRevision) && fields.exportedAuthoredRevision >= 0
        ? fields.exportedAuthoredRevision : null,
      firstUnbackedAt: timestamp(fields.firstUnbackedAt),
      unbackedImport: fields.unbackedImport,
      snoozedUntil: timestamp(fields.snoozedUntil),
    };
  } catch {
    return null;
  }
}

export function reminderStage(metadata: BackupMetadata, now: number, changed: boolean): ReminderStage {
  if (!changed || metadata.intervalDays === null) return 0;
  const since = metadata.firstUnbackedAt;
  if (since === null) return 0;
  const elapsed = Math.max(0, now - since);
  const interval = metadata.intervalDays * 86_400_000;
  if (elapsed >= interval * 3) return 3;
  if (elapsed >= interval * 2) return 2;
  if (elapsed >= interval) return 1;
  return 0;
}
