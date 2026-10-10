import { computed, onBeforeUnmount, ref } from 'vue';
import { subscribeStudySessions } from '../core/study-activity.ts';
import {
  BACKUP_REMINDER_KEY, defaultBackupMetadata, parseBackupMetadata, reminderStage,
  REMINDER_INTERVALS, type BackupMetadata,
} from './backup-reminder-policy.ts';

const SNOOZE_MS = 24 * 60 * 60 * 1000;

/**
 * Backup reminders use committed authored revisions, not a deep watcher that
 * repeatedly JSON-serializes every document after a keystroke.
 * Reminders are browser-local preferences, not part of the workspace backup.
 */
export function useBackupReminders() {
  const original = (() => {
    try { return parseBackupMetadata(localStorage.getItem(BACKUP_REMINDER_KEY)); }
    catch { return null; }
  })();
  const metadata = ref<BackupMetadata>({ ...(original ?? defaultBackupMetadata()) });
  const problem = ref('');
  const hasData = ref(false);
  const authoredRevision = ref(0);
  const workspaceId = ref<string | null>(null);
  const processing = ref(true);
  const activeStudy = ref(false);
  const dismissedThisSession = ref(false);
  const now = ref(Date.now());

  function writeMetadata() {
    try {
      localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(metadata.value));
      problem.value = '';
    } catch {
      problem.value = 'Backup reminder tracking could not be saved. Keep your downloaded backup somewhere safe.';
    }
  }

  const changed = computed(() => hasData.value && (
    metadata.value.unbackedImport ||
    metadata.value.exportedWorkspaceId !== workspaceId.value ||
    metadata.value.exportedAuthoredRevision === null ||
    metadata.value.exportedAuthoredRevision !== authoredRevision.value
  ));

  function ensureUnbackedClock() {
    const next = changed.value ? metadata.value.firstUnbackedAt ?? Date.now() : null;
    if (next === metadata.value.firstUnbackedAt) return;
    metadata.value.firstUnbackedAt = next;
    writeMetadata();
  }

  function workspaceLoaded(id: string, revision: number, populated: boolean, migratedFromLegacy: boolean) {
    workspaceId.value = id;
    authoredRevision.value = revision;
    hasData.value = populated;
    processing.value = false;
    // Fingerprints from older builds cannot be compared to the new revision
    // ledger. Err on the side of a new backup, never assert prior safety.
    if (populated && (metadata.value.exportedWorkspaceId !== id ||
        (migratedFromLegacy && metadata.value.exportedAuthoredRevision === null))) {
      metadata.value.unbackedImport = true;
    }
    ensureUnbackedClock();
  }

  function workspaceChanged(id: string, revision: number, populated: boolean) {
    workspaceId.value = id;
    authoredRevision.value = revision;
    hasData.value = populated;
    processing.value = false;
    ensureUnbackedClock();
  }

  function recordExport(exportedId: string, exportedRevision: number, initiatedAt: number) {
    if (!Number.isSafeInteger(exportedRevision) || exportedRevision < 0) {
      throw new Error('The exported workspace revision is invalid.');
    }
    metadata.value = {
      ...metadata.value,
      lastExportAt: initiatedAt,
      exportedFingerprint: null,
      exportedAuthoredRevision: exportedRevision,
      exportedWorkspaceId: exportedId,
      firstUnbackedAt: null,
      unbackedImport: false,
      snoozedUntil: null,
    };
    dismissedThisSession.value = false;
    writeMetadata();
    // Other tabs may have committed a newer revision during this export.
    ensureUnbackedClock();
  }

  function workspaceRestored(id: string, revision: number, populated: boolean) {
    workspaceId.value = id;
    authoredRevision.value = revision;
    hasData.value = populated;
    metadata.value.unbackedImport = true;
    metadata.value.firstUnbackedAt = Date.now();
    metadata.value.snoozedUntil = null;
    dismissedThisSession.value = false;
    writeMetadata();
  }

  function interval(days: number | null) {
    if (days !== null && !REMINDER_INTERVALS.some(value => value === days)) return;
    metadata.value.intervalDays = days;
    dismissedThisSession.value = false;
    writeMetadata();
  }
  function dismiss() { dismissedThisSession.value = true; }
  function snooze() {
    metadata.value.snoozedUntil = Date.now() + SNOOZE_MS;
    dismissedThisSession.value = true;
    writeMetadata();
  }

  const stage = computed(() => reminderStage(metadata.value, now.value, changed.value));
  const legacy = computed(() => changed.value && metadata.value.unbackedImport);
  const needsAttention = computed(() => changed.value && metadata.value.intervalDays !== null &&
    (legacy.value || stage.value !== 0));
  const showBanner = computed(() => needsAttention.value && !processing.value && !activeStudy.value &&
    !dismissedThisSession.value &&
    (metadata.value.snoozedUntil === null || now.value >= metadata.value.snoozedUntil));
  const showIndicator = computed(() => needsAttention.value && (legacy.value || stage.value === 3));
  const status = computed(() => {
    if (processing.value) return 'Checking your saved workspace.';
    if (!hasData.value) return 'No saved work to back up yet.';
    if (!changed.value) return 'Your work has not changed since the last backup download.';
    if (metadata.value.lastExportAt === null) return 'No backup download is recorded for this browser.';
    return 'Your workspace has changes since the last backup download.';
  });

  function onStorage(event: StorageEvent) {
    if (event.key !== BACKUP_REMINDER_KEY) return;
    const incoming = parseBackupMetadata(event.newValue);
    if (incoming) {
      metadata.value = incoming;
      ensureUnbackedClock();
    }
  }
  window.addEventListener('storage', onStorage);
  const stopActivity = subscribeStudySessions(active => { activeStudy.value = active; });
  const checkTime = () => { now.value = Date.now(); };
  document.addEventListener('visibilitychange', checkTime);
  const tickTimer = window.setInterval(checkTime, 60_000);
  onBeforeUnmount(() => {
    window.clearInterval(tickTimer);
    document.removeEventListener('visibilitychange', checkTime);
    window.removeEventListener('storage', onStorage);
    stopActivity();
  });

  return {
    metadata, problem, changed, hasData, processing, stage, legacy, needsAttention,
    showBanner, showIndicator, status, recordExport, workspaceRestored, workspaceLoaded,
    workspaceChanged, interval, dismiss, snooze,
  };
}
export type BackupReminders = ReturnType<typeof useBackupReminders>;
