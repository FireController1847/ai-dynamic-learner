export class SQLiteWorkspaceStorage {
  constructor() {
    this.worker = new Worker(new URL('./sqlite-worker.js', import.meta.url), { type: 'module' });
    this.pending = new Map();
    this.nextId = 1;
    this.failed = null;

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

  loadWorkspace() {
    return this.call('load');
  }

  saveWorkspace(workspace) {
    return this.call('save', { workspace });
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
