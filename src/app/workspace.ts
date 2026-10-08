import { ref, watch } from 'vue';
import { emptyWorkspace, parseWorkspace, MAX_BACKUP_BYTES, type Workspace } from './workspace-format.ts';
import { downloadText } from '../core/file-download.ts';
import { useBackupReminders } from './backup-reminders.ts';
export type { Workspace } from './workspace-format.ts';
export type WorkspaceController = ReturnType<typeof useWorkspace>;
const STORAGE_KEY = 'dynamic-learner.workspace.v1';

export function useWorkspace() {
  const state = ref(emptyWorkspace());
  const storageProblem = ref('');
  const revision = ref(0);
  let protectStoredCopy = false;
  let savedWorkspacePresent = false;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      state.value = parseWorkspace(saved);
      savedWorkspacePresent = true;
    }
  } catch {
    protectStoredCopy = true;
    storageProblem.value = 'The saved workspace could not be loaded. The stored copy has been left untouched. Download your work before leaving, or upload a valid backup to restore saving.';
  }

  const backup = useBackupReminders(state, savedWorkspacePresent);

  function save() {
    if (protectStoredCopy) return;
    try {
      const text = JSON.stringify(state.value);
      if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error('Workspace too large');
      localStorage.setItem(STORAGE_KEY, text);
      storageProblem.value = '';
    } catch {
      storageProblem.value = 'Browser storage is unavailable or full. Your changes are in memory; download a backup before leaving.';
    }
  }

  watch(state, save, { deep: true });

  async function readBackup(file: File): Promise<Workspace> {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Backups must be smaller than 32 MB.');
    return parseWorkspace(await file.text());
  }

  function replaceWorkspace(value: unknown): void {
    // Revalidate and copy before touching live state; an invalid upload is never applied.
    const replacement = parseWorkspace(JSON.stringify(value));
    protectStoredCopy = false;
    state.value = replacement;
    revision.value += 1;
    backup.workspaceRestored();
    save();
  }

  async function downloadBackup(): Promise<void> {
    const text = JSON.stringify(state.value);
    // Validate the exact full-workspace payload before initiating the download.
    parseWorkspace(text);
    const filename = `dynamic-learner-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await downloadText(filename, text, 'application/json', { deferPaint: false });
    // Browser download APIs cannot confirm that the file was actually saved.
    await backup.recordExport(text, Date.now());
  }

  return { state, revision, storageProblem, readBackup, replaceWorkspace, downloadBackup, backup };
}
