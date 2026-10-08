import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { Workspace } from './workspace-format.ts';
import { subscribeStudySessions } from '../core/study-activity.ts';
import {
  BACKUP_REMINDER_KEY, defaultBackupMetadata, parseBackupMetadata, reminderStage,
  REMINDER_INTERVALS, type BackupMetadata,
} from './backup-reminder-policy.ts';

const NOT_CONTENT = new Set(['lastSelectedDocumentId', 'lastSelectedSetId', 'lastSelectedPuzzleId', 'lastSelectedListId']);
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const FINGERPRINT_DELAY_MS = 700;

function hasUserData(workspace: Workspace): boolean {
  return Object.values(workspace.features).some(feature => feature.items.length > 0);
}

async function fingerprint(workspace: Workspace): Promise<string> {
  // Selection is a UI convenience, not a meaningful modification to authored work.
  const canonical = JSON.stringify(workspace, (key: string, value: unknown) =>
    NOT_CONTENT.has(key) ? undefined : value);
  const data = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function useBackupReminders(state: Ref<Workspace>, savedWorkspacePresent: boolean) {
  const saved = (() => {
    try { return localStorage.getItem(BACKUP_REMINDER_KEY); }
    catch { return null; }
  })();
  const restored = parseBackupMetadata(saved);
  const initial = restored ?? defaultBackupMetadata();
  const metadata = ref<BackupMetadata>({ ...initial });
  const problem = ref('');
  const hasData = ref(hasUserData(state.value));
  const changed = ref(hasData.value);
  const activeStudy = ref(false);
  const dismissedThisSession = ref(false);
  const now = ref(Date.now());
  const processing = ref(true);
  let generation = 0;
  let fingerprintTimer: number | undefined;
  let tickTimer: number | undefined;

  function writeMetadata() {
    try {
      localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(metadata.value));
      problem.value = '';
    } catch {
      problem.value = 'Backup reminder tracking could not be saved in this browser. Keep a copy of your downloaded backup.';
    }
  }

  if (!restored && hasData.value && savedWorkspacePresent) {
    // Historical browser data has no known export history. Do not invent one.
    metadata.value.unbackedImport = true;
    metadata.value.firstUnbackedAt = now.value;
    writeMetadata();
  }

  function refreshFingerprint(delay = FINGERPRINT_DELAY_MS) {
    generation += 1;
    const version = generation;
    if (fingerprintTimer !== undefined) window.clearTimeout(fingerprintTimer);
    hasData.value = hasUserData(state.value);
    if (!hasData.value) {
      processing.value = false;
      changed.value = false;
      if (metadata.value.firstUnbackedAt !== null) {
        metadata.value.firstUnbackedAt = null;
        writeMetadata();
      }
      return;
    }
    processing.value = true;
    fingerprintTimer = window.setTimeout(() => {
      fingerprintTimer = undefined;
      void fingerprint(state.value).then(hash => {
        if (version !== generation) return;
        const dirty = metadata.value.unbackedImport || hash !== metadata.value.exportedFingerprint;
        changed.value = dirty;
        processing.value = false;
        const next = dirty ? metadata.value.firstUnbackedAt ?? Date.now() : null;
        if (metadata.value.firstUnbackedAt !== next) {
          metadata.value.firstUnbackedAt = next;
          writeMetadata();
        }
      }).catch(() => {
        if (version !== generation) return;
        // If comparison fails, err on the side of reminding rather than assuming safety.
        processing.value = false;
        changed.value = true;
        if (metadata.value.firstUnbackedAt === null) {
          metadata.value.firstUnbackedAt = Date.now();
          writeMetadata();
        }
        problem.value = 'Backup changes could not be checked. Please download a fresh backup.';
      });
    }, delay);
  }

  watch(state, () => refreshFingerprint(), { deep: true });
  refreshFingerprint(0);

  async function recordExport(text: string, initiatedAt: number): Promise<void> {
    try {
      const exported = JSON.parse(text) as Workspace;
      const hash = await fingerprint(exported);
      metadata.value = {
        ...metadata.value,
        lastExportAt: initiatedAt,
        exportedFingerprint: hash,
        firstUnbackedAt: null,
        unbackedImport: false,
        snoozedUntil: null,
      };
      dismissedThisSession.value = false;
      writeMetadata();
      refreshFingerprint(0); // New edits made during export remain unbacked.
    } catch {
      problem.value = 'The download started, but its tracking record could not be updated. Keep the downloaded file safe.';
    }
  }

  function workspaceRestored() {
    // Importing is not an export, even if its content matches a prior snapshot.
    metadata.value.unbackedImport = true;
    metadata.value.firstUnbackedAt = Date.now();
    metadata.value.snoozedUntil = null;
    dismissedThisSession.value = false;
    writeMetadata();
    refreshFingerprint(0);
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

  const stage = computed(() => reminderStage(metadata.value, now.value, hasData.value && changed.value));
  const legacy = computed(() => hasData.value && metadata.value.unbackedImport);
  const needsAttention = computed(() => hasData.value && changed.value && metadata.value.intervalDays !== null &&
    (legacy.value || stage.value !== 0));
  const showBanner = computed(() => needsAttention.value && !processing.value && !activeStudy.value &&
    !dismissedThisSession.value && (metadata.value.snoozedUntil === null || now.value >= metadata.value.snoozedUntil));
  const showIndicator = computed(() => needsAttention.value && (legacy.value || stage.value === 3));
  const status = computed(() => {
    if (!hasData.value) return 'No saved work to back up yet.';
    if (!changed.value && !processing.value) return 'Your work has not changed since the last backup download.';
    if (metadata.value.lastExportAt === null) return 'No backup download is recorded for this browser.';
    return 'Your workspace has changes since the last backup download.';
  });

  const stopActivity = subscribeStudySessions(active => { activeStudy.value = active; });
  const checkTime = () => { now.value = Date.now(); };
  document.addEventListener('visibilitychange', checkTime);
  tickTimer = window.setInterval(checkTime, 60_000);
  onBeforeUnmount(() => {
    generation += 1;
    if (fingerprintTimer !== undefined) window.clearTimeout(fingerprintTimer);
    if (tickTimer !== undefined) window.clearInterval(tickTimer);
    document.removeEventListener('visibilitychange', checkTime);
    stopActivity();
  });

  return {
    metadata, problem, changed, hasData, processing, stage, legacy, needsAttention,
    showBanner, showIndicator, status, recordExport, workspaceRestored, interval, dismiss, snooze,
  };
}
export type BackupReminders = ReturnType<typeof useBackupReminders>;
