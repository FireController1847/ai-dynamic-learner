import type { Workspace } from '../workspace-format.ts';
import { emptyWorkspace, parseWorkspace } from '../workspace-format.ts';
import { createId, isValidId } from '../../core/ids.ts';
import {
  IndexedDataStore, DataApiError, type DataChange, type DataCommit,
  type DataOperation, type DataStoreName, type IndexedRow,
} from '../../core/data/indexeddb.ts';
import { hydrateWorkspace, workspaceRows } from './workspace-mapping.ts';
import type { DocumentTypeId, DocumentDataByType } from '../../features/notebook/document-types.ts';
import { validateDocumentData } from '../../features/notebook/document-types.ts';
import type { Card } from '../../features/index-cards/card-model.ts';
import { validateCards } from '../../features/index-cards/card-model.ts';
import type { Question } from '../../features/knowledge-check/question-model.ts';
import { validateQuestions } from '../../features/knowledge-check/question-model.ts';
import type { TodoTask } from '../../features/todo-list/task-model.ts';
import { validateSections } from '../../features/todo-list/task-model.ts';

export interface Versioned<T> { value: T; revision: number }
export type DataListener = (change: DataChange) => void;

const LEGACY_KEY = 'dynamic-learner.workspace.v1';

/** Order independent object comparison for one-time migration verification. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort().map(key => JSON.stringify(key) + ':' + canonical(object[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

/**
 * The application-facing local data service. Features receive named domains,
 * not native IDB handles. The old Vue-workspace adapter will be migrated to
 * these commands incrementally; no legacy data is erased on initialization.
 */
export class WorkspaceDataApi {
  private readonly store = new IndexedDataStore();
  private workspaceId: string | null = null;

  async ready(): Promise<void> {
    if (this.workspaceId) return;
    await this.store.open();
    let workspaceId = await this.store.activeWorkspaceId();
    if (!workspaceId) {
      // The original localStorage source is read-only during migration.
      // A corrupt copy blocks initialization; never replace it with emptiness.
      let legacy: string | null;
      try { legacy = localStorage.getItem(LEGACY_KEY); }
      catch { throw new DataApiError('unavailable', 'The previous workspace could not be accessed.'); }
      const imported = legacy === null ? emptyWorkspace() : parseWorkspace(legacy);
      const stagedId = createId();
      await this.store.stageRows(workspaceRows(stagedId, imported));
      const hydrated = await hydrateWorkspace(this.store, stagedId);
      if (canonical(imported) !== canonical(hydrated)) {
        throw new DataApiError('validation', 'The imported workspace did not survive the database round-trip.');
      }
      try { await this.store.activate(stagedId, null, new Date().toISOString()); }
      catch (error) {
        if (!(error instanceof DataApiError) || error.code !== 'conflict') throw error;
        // Two new tabs may race the initial import. Respect the winner.
      }
      workspaceId = await this.store.activeWorkspaceId();
    }
    if (!workspaceId) throw new DataApiError('unavailable', 'No active workspace is available.');
    // Check the complete stored model before granting edit access.
    await hydrateWorkspace(this.store, workspaceId);
    this.workspaceId = workspaceId;
  }

  private active(): string {
    if (!this.workspaceId) throw new DataApiError('unavailable', 'The data API is not initialized.');
    return this.workspaceId;
  }

  subscribe(listener: DataListener): () => void {
    return this.store.subscribe(listener);
  }

  async workspace(): Promise<Workspace> {
    return hydrateWorkspace(this.store, this.active());
  }

  async read<T extends IndexedRow>(store: DataStoreName, key: IDBValidKey): Promise<Versioned<T> | null> {
    const record = await this.store.get<T>(store, key);
    return record ? { value: record, revision: record.revision ?? 0 } : null;
  }

  async list<T extends IndexedRow>(store: DataStoreName, predicate: (row: T) => boolean): Promise<Versioned<T>[]> {
    const workspaceId = this.active();
    const records = await this.store.all<T>(store);
    return records.filter(record => record.workspaceId === workspaceId && predicate(record))
      .map(record => ({ value: record, revision: record.revision ?? 0 }));
  }

  private async save(store: DataStoreName, key: IDBValidKey, value: IndexedRow,
    expectedRevision: number | null, scope: string, authored = true): Promise<DataCommit> {
    return this.store.commit(this.active(), [{
      store, key, type: 'put', value, expectedRevision,
    }], { authored, scopes: [scope] });
  }

  private async remove(store: DataStoreName, key: IDBValidKey, expectedRevision: number, scope: string): Promise<DataCommit> {
    return this.store.commit(this.active(), [{
      store, key, type: 'delete', expectedRevision,
    }], { authored: true, scopes: [scope] });
  }

  /** Unlike the legacy deep watcher, this writes only the active document body. */
  readonly notebook = {
    getDocument: async (id: string) => {
      if (!isValidId(id)) throw new DataApiError('validation', 'Invalid document ID.');
      return this.read<{ workspaceId: string; id: string; type: DocumentTypeId; data: DocumentDataByType[DocumentTypeId]; revision: number }>(
        'notebookDocuments', [this.active(), id]);
    },
    saveDocument: async (id: string, type: DocumentTypeId, data: DocumentDataByType[DocumentTypeId], expectedRevision: number) => {
      if (!isValidId(id)) throw new DataApiError('validation', 'Invalid document ID.');
      validateDocumentData(type, data);
      const workspaceId = this.active();
      return this.save('notebookDocuments', [workspaceId, id], { workspaceId, id, type, data }, expectedRevision, 'notebook:' + id);
    },
  };

  readonly indexCards = {
    getCard: async (setId: string, id: string) =>
      this.read<IndexedRow & Card>('indexCards', [this.active(), setId, id]),
    saveCard: async (setId: string, card: Card, expectedRevision: number) => {
      if (!isValidId(setId)) throw new DataApiError('validation', 'Invalid card set ID.');
      validateCards([card], new Set<string>());
      const workspaceId = this.active();
      return this.save('indexCards', [workspaceId, setId, card.id], {
        workspaceId, setId, ...card,
      }, expectedRevision, 'index-cards:' + setId);
    },
  };

  readonly todoLists = {
    getTask: async (listId: string, sectionId: string, taskId: string) =>
      this.read<IndexedRow & TodoTask>('todoTasks', [this.active(), listId, sectionId, taskId]),
    saveTask: async (listId: string, sectionId: string, task: TodoTask, expectedRevision: number) => {
      if (![listId, sectionId].every(isValidId)) throw new DataApiError('validation', 'Invalid task destination.');
      validateSections([{ id: sectionId, title: '', tasks: [task] }]);
      const workspaceId = this.active();
      return this.save('todoTasks', [workspaceId, listId, sectionId, task.id], {
        workspaceId, listId, sectionId, ...task,
      }, expectedRevision, 'todo-list:' + listId);
    },
  };

  readonly review = {
    getQuestion: async (setId: string, id: string) =>
      this.read<IndexedRow & Question>('reviewQuestions', [this.active(), setId, id]),
    saveQuestion: async (setId: string, question: Question, expectedRevision: number) => {
      if (!isValidId(setId)) throw new DataApiError('validation', 'Invalid Review set.');
      validateQuestions([question]);
      const workspaceId = this.active();
      return this.save('reviewQuestions', [workspaceId, setId, question.id], {
        workspaceId, setId, ...question,
      }, expectedRevision, 'knowledge-check:' + setId);
    },
  };

  /**
   * General multi-record command for app-owned transactions (group moves,
   * cascading deletes, imports). Callers must validate their domain invariants.
   */
  async commit(operations: readonly DataOperation[], scopes: readonly string[], authored = true): Promise<DataCommit> {
    return this.store.commit(this.active(), operations, { authored, scopes });
  }

  async deleteCard(setId: string, cardId: string, expectedRevision: number): Promise<DataCommit> {
    return this.remove('indexCards', [this.active(), setId, cardId], expectedRevision, 'index-cards:' + setId);
  }

  /**
   * Replacement installs a second verified workspace and flips the active
   * pointer; pending writes from the old workspace are rejected by the store.
   */
  async restoreWorkspace(payload: unknown): Promise<void> {
    // Reuse the same runtime validators as the existing JSON upload path.
    const parsed = parseWorkspace(JSON.stringify(payload));
    const previous = this.active();
    const stagedId = createId();
    await this.store.stageRows(workspaceRows(stagedId, parsed));
    const hydrated = await hydrateWorkspace(this.store, stagedId);
    if (canonical(parsed) !== canonical(hydrated)) {
      throw new DataApiError('validation', 'The restored workspace failed integrity verification.');
    }
    await this.store.activate(stagedId, previous, new Date().toISOString());
    this.workspaceId = stagedId;
  }

  async exportWorkspaceJson(): Promise<string> {
    // A full snapshot is intentionally constructed only for a user-initiated
    // backup, not for routine mutations.
    return JSON.stringify(await this.workspace());
  }

  close() { this.store.close(); this.workspaceId = null; }
}
