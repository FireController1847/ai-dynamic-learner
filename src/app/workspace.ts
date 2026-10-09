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
  const needsReconcile = ref(false);
  const revision = ref(0);
  const backup = useBackupReminders();
  const api = new WorkspaceDataApi();
  const stopUnavailable = api.subscribeUnavailable(message => {
    // Keep in-memory drafts accessible. This connection cannot be reopened
    // until the tab itself reloads after the schema upgrade.
    storageProblem.value = message;
    needsReconcile.value = true;
  });
  let observer: Awaited<ReturnType<typeof observeWorkspace>> | null = null;
  let unsubscribeRemote: (() => void) | null = null;
  let remoteRefreshTimer: number | undefined;
  let refreshing = false;
  let studyActive = false;
  let lastSequence = 0;
  let remotePending = false;
  let remoteGeneration = 0;
  let disposed = false;

  const updateBackup = (authoredRevision: number, commitSequence: number) => {
    backup.workspaceChanged(api.workspaceIdentity(), authoredRevision, populated(state.value));
    // Only advance past commits we actually observed. Looking up the latest
    // database sequence here can accidentally skip unseen remote edits.
    if (commitSequence !== lastSequence + 1) remotePending = true;
    else if (!remotePending) lastSequence = commitSequence;
  };
  const savingProblem = (message: string) => {
    storageProblem.value = message;
    needsReconcile.value = true;
    remotePending = true;
  };

  async function startObserver(records: Awaited<ReturnType<WorkspaceDataApi['initialSnapshot']>>['records']) {
    observer = await observeWorkspace(state, api, savingProblem, updateBackup, records);
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
    const generationAtStart = remoteGeneration;
    try {
      await nextTick();
      // A failed observer is no longer accepting saves. Never replace its
      // in-memory content in response to remote notifications.
      if (observer?.hasFailed()) {
        needsReconcile.value = true;
        return;
      }
      await observer?.flush();
      const result = await api.refresh(lastSequence);
      if (!result.replaced && result.events?.length === 0) {
        remotePending = false;
        return;
      }
      const snapshot = await api.initialSnapshot(true);
      observer?.stop();
      state.value = snapshot.workspace;
      revision.value += 1;
      lastSequence = snapshot.revisions.commitSequence;
      remotePending = false;
      needsReconcile.value = false;
      await startObserver(snapshot.records);
      backup.workspaceChanged(api.workspaceIdentity(), snapshot.revisions.authoredRevision, populated(snapshot.workspace));
      storageProblem.value = '';
    } catch (error) {
      needsReconcile.value = true;
      storageProblem.value = 'Changes from another tab could not be loaded safely: ' + errorMessage(error) +
        ' Download a copy of your on-screen work before loading the latest saved data.';
    } finally {
      refreshing = false;
      // A tab can commit again while a complete workspace snapshot is being
      // read or rendered. Never clear the newly arrived invalidation.
      if (remoteGeneration !== generationAtStart && !disposed) queueRemoteRefresh();
    }
  }

  function queueRemoteRefresh() {
    if (remoteRefreshTimer !== undefined) clearTimeout(remoteRefreshTimer);
    remoteRefreshTimer = window.setTimeout(() => {
      remoteRefreshTimer = undefined;
      void syncOtherTabs();
    }, 650);
  }

  function watchRemoteChanges() {
    if (unsubscribeRemote) return;
    unsubscribeRemote = api.subscribeRemote(() => {
      remoteGeneration += 1;
      remotePending = true;
      // Debounce a burst of remote edits rather than reloading per keystroke.
      queueRemoteRefresh();
    });
  }

  async function initialize() {
    try {
      await api.ready();
      if (disposed) return;
      const snapshot = await api.initialSnapshot();
      state.value = snapshot.workspace;
      lastSequence = snapshot.revisions.commitSequence;
      await startObserver(snapshot.records);
      if (disposed) return;
      let legacyPresent = false;
      try { legacyPresent = localStorage.getItem('dynamic-learner.workspace.v1') !== null; }
      catch { /* The Data API already handled source storage failures. */ }
      backup.workspaceLoaded(api.workspaceIdentity(), snapshot.revisions.authoredRevision, populated(snapshot.workspace), legacyPresent);
      ready.value = true;
      watchRemoteChanges();
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
    if (!ready.value && !storageProblem.value) throw new Error('The workspace is still loading.');
    const replacement = validateWorkspaceValue(value);
    ready.value = false; // Unmount editors before asynchronous staging begins.
    let replacedSafely = false;
    try {
      await nextTick();
      await observer?.flush();
      await api.restoreWorkspace(replacement);
      observer?.stop();
      const snapshot = await api.initialSnapshot();
      state.value = snapshot.workspace;
      revision.value += 1;
      lastSequence = snapshot.revisions.commitSequence;
      await startObserver(snapshot.records);
      backup.workspaceRestored(api.workspaceIdentity(), snapshot.revisions.authoredRevision, populated(snapshot.workspace));
      storageProblem.value = '';
      needsReconcile.value = false;
      remotePending = false;
      replacedSafely = true;
      watchRemoteChanges();
    } finally {
      // If staging/activation or watcher setup fails, do not reopen an
      // editable workspace that may no longer be attached to persistence.
      ready.value = replacedSafely;
    }
  }

  /**
   * Emergency export intentionally uses the current Vue draft rather than the
   * last persisted snapshot. Do not advance backup reminder metadata.
   */
  async function downloadLocalDraft(): Promise<void> {
    const json = JSON.stringify(state.value);
    if (!json) throw new Error('No workspace draft is available for export.');
    const filename = `dynamic-learner-unsaved-draft-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await downloadText(filename, json, 'application/json', { deferPaint: false });
  }

  /**
   * Explicitly discard a conflicted draft after the user has had a chance to
   * download it. This action never flushes the failed observer into the DB.
   */
  async function reloadSavedWorkspace(): Promise<void> {
    if (refreshing || disposed) return;
    refreshing = true;
    ready.value = false;
    const previousObserver = observer;
    previousObserver?.stop();
    observer = null;
    try {
      // A command already inside IndexedDB can still finish after stop().
      // Drain it before reading the saved state or installing a new observer.
      await previousObserver?.settle();
      const snapshot = await api.initialSnapshot(true);
      state.value = snapshot.workspace;
      revision.value++;
      lastSequence = snapshot.revisions.commitSequence;
      remotePending = false;
      await startObserver(snapshot.records);
      backup.workspaceChanged(api.workspaceIdentity(), snapshot.revisions.authoredRevision, populated(snapshot.workspace));
      storageProblem.value = '';
      needsReconcile.value = false;
      ready.value = true;
    } catch (error) {
      storageProblem.value = 'The saved workspace could not be reloaded: ' + errorMessage(error) +
        ' The on-screen draft remains available for an emergency download.';
      needsReconcile.value = true;
    } finally {
      refreshing = false;
    }
  }

  async function downloadBackup(): Promise<void> {
    const filename = `dynamic-learner-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    if (!ready.value && needsReconcile.value) {
      await downloadLocalDraft();
      return;
    }
    if (!ready.value) {
      // Recover from a valid IDB snapshot if possible, otherwise export the
      // read-only legacy bytes. A failed download itself must not silently
      // trigger a second download of different content.
      let json: string;
      try {
        json = (await api.exportSnapshot()).json;
      } catch {
        const legacy = localStorage.getItem('dynamic-learner.workspace.v1');
        if (!legacy) throw new Error('The workspace is unavailable and no recovery copy could be read.');
        json = legacy;
      }
      await downloadText(filename, json, 'application/json', { deferPaint: false });
      return;
    }
    await nextTick();
    let json: string;
    let exportedSnapshot: { workspaceId: string; revision: number } | null = null;
    try {
      await observer?.flush();
      const snapshot = await api.exportSnapshot();
      json = snapshot.json;
      exportedSnapshot = { workspaceId: snapshot.workspaceId, revision: snapshot.authoredRevision };
    } catch {
      // A failed write or database read must not prevent emergency export.
      // Preserve live unsaved edits, but never mark the export as committed.
      json = JSON.stringify(state.value);
      validateWorkspaceValue(JSON.parse(json) as unknown);
    }
    await downloadText(filename, json, 'application/json', { deferPaint: false });
    if (exportedSnapshot) backup.recordExport(exportedSnapshot.workspaceId, exportedSnapshot.revision, Date.now());
  }

  const stopStudySubscription = subscribeStudySessions(active => {
    const wasActive = studyActive;
    studyActive = active;
    if (wasActive && !active) void syncOtherTabs();
  });

  // An active editor deliberately defers a remote reload. Try again after
  // focus moves away, even if the other tab sends no further broadcasts.
  const onFocusOut = () => {
    if (!remotePending) return;
    // A Save button's click handler can run after the focused input blurs.
    // Let it finish before reconciling and potentially remounting editors.
    window.setTimeout(() => {
      if (!disposed && remotePending) void syncOtherTabs();
    }, 250);
  };
  document.addEventListener('focusout', onFocusOut);

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
    document.removeEventListener('focusout', onFocusOut);
    stopUnavailable();
    api.close();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flushOnHide);
  });

  return { state, ready, revision, storageProblem, needsReconcile,
    readBackup, replaceWorkspace, downloadBackup, downloadLocalDraft, reloadSavedWorkspace, backup };
}
