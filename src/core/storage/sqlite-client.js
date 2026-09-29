import { workspaceToRows } from './workspace-relational.js';
import { createWorkspaceDelta, isWorkspaceDeltaEmpty } from './workspace-delta.js';

export class SQLiteWorkspaceStorage {
  constructor() {
    this.worker = new Worker(new URL('./sqlite-worker.js', import.meta.url), { type: 'module' });
    this.pending = new Map();
    this.nextId = 1;
    this.failed = null;
    this.confirmedRows = null;
    this.projectedRows = null;
    this.forceReplace = false;

    this.worker.onmessage = (event) => {
      const { id, ok, result, error } = event.data ?? {};
      const request = this.pending.get(id);
      if (!request) return;
      this.pending.delete(id);
      if (ok) request.resolve(result);
      else request.reject(new Error(error || 'SQLite worker operation failed.'));
    };

    const fail = (problem) => {
      const error = problem instanceof Error
        ? problem
        : new Error(problem?.message || 'The SQLite worker stopped unexpectedly.');
      this.failed = error;
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    };
    this.worker.onerror = fail;
    this.worker.onmessageerror = fail;
  }

  call(type, payload = {}, transfer = []) {
    if (this.failed) return Promise.reject(this.failed);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ id, type, payload }, transfer);
      } catch (problem) {
        this.pending.delete(id);
        reject(problem);
      }
    });
  }

  initialize() {
    return this.call('initialize');
  }

  async loadWorkspace() {
    const workspace = await this.call('load');
    this.confirmedRows = workspace ? workspaceToRows(workspace) : null;
    this.projectedRows = this.confirmedRows;
    this.forceReplace = false;
    return workspace;
  }

  async saveWorkspace(workspace) {
    const rows = workspaceToRows(workspace);
    const base = this.forceReplace ? null : this.projectedRows;
    const delta = createWorkspaceDelta(base, rows);

    // Advance the projected state before posting so rapid edit/revert sequences
    // compare against what is already queued, not only what SQLite has confirmed.
    this.projectedRows = rows;
    if (isWorkspaceDeltaEmpty(delta)) return;

    try {
      await this.call('save-delta', { delta });
      this.confirmedRows = rows;
      if (delta.replace) this.forceReplace = false;
    } catch (problem) {
      // A later delta may have been calculated from the failed projected state.
      // The Worker rejects those dependent deltas; the next attempt must replace
      // the relational workspace from a complete current row set.
      this.projectedRows = this.confirmedRows;
      this.forceReplace = true;
      throw problem;
    }
  }

  exportBackup() {
    return this.call('export-backup');
  }

  inspectBackup(bytes) {
    const buffer = bytes instanceof ArrayBuffer
      ? bytes
      : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return this.call('inspect-backup', { bytes: buffer }, [buffer]);
  }

  close() {
    this.worker.terminate();
    this.pending.clear();
  }
}
