import { nextTick, onBeforeUnmount, ref } from 'vue';
import { emptyWorkspace, parseWorkspace, validateWorkspaceValue, MAX_BACKUP_BYTES, type Workspace } from './workspace-format.ts';
import { downloadText } from '../core/file-download.ts';
import { useBackupReminders } from './backup-reminders.ts';
import { WorkspaceDataApi } from './data/data-api.ts';
import { observeWorkspace } from './data/workspace-observer.ts';
import { subscribeStudySessions } from '../core/study-activity.ts';

export type { Workspace } from './workspace-format.ts';
export type WorkspaceController = ReturnType<typeof useWorkspace>;

function populated(workspace: Workspace): boolean {
  return Object.values(workspace.features).some(feature => feature.items.length > 0);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The Vue workspace is now a compatibility *view* of the IndexedDB repository.
 * The legacy localStorage JSON is read once by the Data API migration and
 * preserved unchanged for recovery; it is no longer a write target.
 */
export function useWorkspace() {
  const state = ref<Workspace>(emptyWorkspace());
  const ready = ref(false);
  const storageProblem = ref('');
  const revision = ref(0);
  const backup = useBackupReminders();
  const api = new WorkspaceDataApi();
  let observer: Awaited<ReturnType<typeof observeWorkspace>> | null = null;
  let unsubscribeRemote: (() => void) | null = null;
  let remoteRefreshTimer: number | undefined;
  let refreshing = false;
  let studyActive = false;
  let lastSequence = 0;
  let disposed = false;

  const updateBackup = (authoredRevision: number) => {
    backup.workspaceChanged(authoredRevision, populated(state.value));
    void api.revisions().then(meta => { lastSequence = Math.max(lastSequence, meta.commitSequence); })
      .catch(() => {});
  };
  const savingProblem = (message: string) => { storageProblem.value = message; };

  async function startObserver() {
    observer = await observeWorkspace(state, api, savingProblem, updateBackup);
  }

  async function syncOtherTabs() {
    if (!ready.value || refreshing || disposed) return;
    if (studyActive) {
      storageProblem.value = 'Another tab changed saved data. Updates will load after your current study session ends.';
      return;
    }
    // Do not tear down a currently focused editor; the record CAS checks
    // prevent a stale edit from silently overwriting the newer database row.
    const focus = document.activeElement;
    if (focus instanceof HTMLElement && focus.matches('input,textarea,[contenteditable="true"]')) {
      storageProblem.value = 'Another tab changed this workspace. Finish editing and switch tabs or reload to see the latest changes.';
      return;
    }
    refreshing = true;
    try {
      await nextTick();
      await observer?.flush();
      const result = await api.refresh(lastSequence);
      if (!result.replaced && result.events?.length === 0) return;
      const incoming = await api.workspace();
      const meta = await api.revisions();
      observer?.stop();
      state.value = incoming;
      revision.value += 1;
      lastSequence = meta.commitSequence;
      await startObserver();
      backup.workspaceChanged(meta.authoredRevision, populated(incoming));
      storageProblem.value = '';
    } catch (error) {
      storageProblem.value = 'Changes from another tab could not be loaded safely: ' + errorMessage(error) +
        ' Keep a backup of any unsaved edits before reloading.';
    } finally {
      refreshing = false;
    }
  }

  async function initialize() {
    try {
      await api.ready();
      if (disposed) return;
      const loaded = await api.workspace();
      const meta = await api.revisions();
      state.value = loaded;
      lastSequence = meta.commitSequence;
      await startObserver();
      if (disposed) return;
      let legacyPresent = false;
      try { legacyPresent = localStorage.getItem('dynamic-learner.workspace.v1') !== null; }
      catch { /* The Data API already handled source storage failures. */ }
      backup.workspaceLoaded(meta.authoredRevision, populated(loaded), legacyPresent);
      ready.value = true;
      unsubscribeRemote = api.subscribeRemote(() => {
        // Rebuild once after a burst of edits in another tab, rather than
        // reconstructing every document for each remote keystroke.
        if (remoteRefreshTimer !== undefined) clearTimeout(remoteRefreshTimer);
        remoteRefreshTimer = window.setTimeout(() => {
          remoteRefreshTimer = undefined;
          void syncOtherTabs();
        }, 650);
      });
    } catch (error) {
      storageProblem.value = 'Your workspace could not be loaded safely: ' + errorMessage(error) +
        ' The previous localStorage copy has not been erased. Do not clear this site’s data.';
      ready.value = false;
    }
  }
  void initialize();

  async function readBackup(file: File): Promise<Workspace> {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('The backup file exceeds the supported size.');
    return parseWorkspace(await file.text());
  }

  async function replaceWorkspace(value: unknown): Promise<void> {
    if (!ready.value) throw new Error('The workspace database is not ready.');
    const replacement = validateWorkspaceValue(value);
    ready.value = false; // Unmount editors before asynchronous staging begins.
    let replacedSafely = false;
    try {
      await nextTick();
      await observer?.flush();
      await api.restoreWorkspace(replacement);
      observer?.stop();
      state.value = replacement;
      revision.value += 1;
      const meta = await api.revisions();
      lastSequence = meta.commitSequence;
      await startObserver();
      backup.workspaceRestored(meta.authoredRevision, populated(replacement));
      storageProblem.value = '';
      replacedSafely = true;
    } finally {
      // If staging/activation or watcher setup fails, do not reopen an
      // editable workspace that may no longer be attached to persistence.
      ready.value = replacedSafely;
    }
  }

  async function downloadBackup(): Promise<void> {
    const filename = `dynamic-learner-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    if (!ready.value) {
      // Even an unreadable legacy workspace must remain recoverable as bytes.
      const legacy = localStorage.getItem('dynamic-learner.workspace.v1');
      if (!legacy) throw new Error('The workspace has not loaded and no recovery copy is available.');
      await downloadText(filename, legacy, 'application/json', { deferPaint: false });
      return;
    }
    await nextTick();
    try {
      await observer?.flush();
    } catch {
      // A failed IDB write must never disable the user's emergency escape.
      // Export the live in-memory content, including unsaved edits, but DO NOT
      // record it as a database snapshot or clear the backup reminder.
      const json = JSON.stringify(state.value);
      validateWorkspaceValue(JSON.parse(json) as unknown);
      await downloadText(filename, json, 'application/json', { deferPaint: false });
      return;
    }
    const snapshot = await api.exportSnapshot();
    await downloadText(filename, snapshot.json, 'application/json', { deferPaint: false });
    backup.recordExport(snapshot.authoredRevision, Date.now());
  }

  const stopStudySubscription = subscribeStudySessions(active => {
    const wasActive = studyActive;
    studyActive = active;
    if (wasActive && !active) void syncOtherTabs();
  });

  const flushOnHide = () => {
    // Best effort only: browsers may terminate a tab without allowing any
    // asynchronous work, so autosaves must happen well before pagehide.
    void observer?.flush().catch(error => {
      storageProblem.value = 'Recent changes may not have been saved: ' + errorMessage(error);
    });
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void syncOtherTabs();
    else flushOnHide();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flushOnHide);
  onBeforeUnmount(() => {
    disposed = true;
    if (remoteRefreshTimer !== undefined) clearTimeout(remoteRefreshTimer);
    observer?.stop();
    unsubscribeRemote?.();
    stopStudySubscription();
    api.close();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flushOnHide);
  });

  return { state, ready, revision, storageProblem, readBackup, replaceWorkspace, downloadBackup, backup };
}
