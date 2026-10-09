import { countChecks, countItems as countKnowledgeCheckItems } from '../features/knowledge-check/library-model.ts';
import type { Workspace, WorkspaceController } from './workspace.ts';
import { requestLeave } from '../core/leave-guards.ts';
import { inputValue } from '../core/dom.ts';
import { Icon } from '../components/icon.ts';
import { countDocuments, countItems as countNotebookItems } from '../features/notebook/library-model.ts';
import { countCards, countItems as countIndexCardItems } from '../features/index-cards/tree-model.ts';
import {
  countItems as countWordSearchItems,
  countWordSearches,
} from '../features/word-search/library-model.ts';
import {
  countCrosswords,
  countItems as countCrosswordItems,
} from '../features/crossword/library-model.ts';

import { defineComponent, type PropType, h, ref, shallowRef } from 'vue';

export const WorkspaceTools = defineComponent({
  name: 'WorkspaceTools',
  props: { workspace: { type: Object as PropType<WorkspaceController>, required: true } },
  setup(props) {
    const fileInput = ref<HTMLInputElement | null>(null);
    const pending = shallowRef<{ name: string; data: Workspace } | null>(null);
    const busy = ref(false);
    const downloading = ref(false);
    const message = ref('');
    const error = ref('');

    async function upload(event: Event) {
      if (!(event.target instanceof HTMLInputElement)) return;
      const file = event.target.files?.[0];
      event.target.value = ''; 
      if (!file) return;
      busy.value = true;
      pending.value = null;
      error.value = '';
      message.value = '';
      try {
        pending.value = { name: file.name, data: await props.workspace.readBackup(file) };
      } catch (problem) {
        error.value = (problem instanceof Error ? problem.message : String(problem)) || 'The backup could not be read.';
      } finally {
        busy.value = false;
      }
    }

    async function download() {
      error.value = '';
      message.value = '';
      downloading.value = true;
      try {
        await props.workspace.downloadBackup();
        message.value = 'Download started. Check your Downloads folder and keep the backup file somewhere safe.';
      } catch (problem) {
        error.value = (problem instanceof Error ? problem.message : String(problem)) || 'The backup could not be downloaded.';
      } finally {
        downloading.value = false;
      }
    }

    async function replace() {
      if (!pending.value || busy.value) return;
      if (!requestLeave()) return;
      busy.value = true;
      error.value = '';
      try {
        await props.workspace.replaceWorkspace(pending.value.data);
        pending.value = null;
        message.value = 'Workspace restored.';
      } catch (problem) {
        error.value = problem instanceof Error ? problem.message : String(problem);
      } finally {
        busy.value = false;
      }
    }

    return () => h('section', { class: 'workspace-tools', 'aria-label': 'Workspace backups' }, [
      h('h2', { class: 'workspace-tools-heading' }, 'Workspace'),
      h('div', { class: 'workspace-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', disabled: downloading.value, onClick: () => { void download(); } }, [
          h(Icon, { name: 'download' }), downloading.value ? 'Preparing backup…' : 'Download backup',
        ]),
        h('button', {
          type: 'button', class: 'quiet-button', disabled: busy.value,
          onClick: () => fileInput.value?.click(),
        }, [h(Icon, { name: 'upload' }), busy.value ? 'Reading backup…' : 'Upload backup']),
        h('input', {
          ref: fileInput, type: 'file', accept: '.json,application/json', hidden: true,
          onChange: upload,
        }),
      ]),
      h('details', { class: 'backup-preferences' }, [
        h('summary', 'Backup status and reminders'),
        h('p', { class: 'backup-status' }, props.workspace.backup.status.value),
        h('p', { class: 'backup-status' }, props.workspace.backup.metadata.value.lastExportAt === null
          ? 'Last download: Not recorded.'
          : `Last download started: ${new Date(props.workspace.backup.metadata.value.lastExportAt).toLocaleString()}.`),
        h('p', { class: 'backup-preferences-help' },
          'Downloads are stored outside this site. Dynamic Learner cannot verify that a file was saved; check your Downloads folder.'),
        h('label', { class: 'backup-preferences-field' }, [
          h('span', 'Remind me to back up'),
          h('select', {
            value: props.workspace.backup.metadata.value.intervalDays === null
              ? 'off' : String(props.workspace.backup.metadata.value.intervalDays),
            onChange: (event: Event) => {
              if (!(event.target instanceof HTMLSelectElement)) return;
              props.workspace.backup.interval(event.target.value === 'off' ? null : Number(event.target.value));
            },
          }, [
            h('option', { value: 'off' }, 'Never'),
            ...([1, 3, 7, 14, 30] as const).map(days =>
              h('option', { key: days, value: String(days) }, `Every ${days} ${days === 1 ? 'day' : 'days'}`)),
          ]),
        ]),
        h('p', { class: 'backup-preferences-help' },
          'Reminders only appear when saved work has changed. Urgency increases after two and three intervals. Snoozing does not reset your backup history.'),
        props.workspace.backup.problem.value
          ? h('p', { class: 'workspace-error', role: 'alert' }, props.workspace.backup.problem.value) : null,
      ]),
      pending.value ? h('div', { class: 'backup-review', role: 'region', 'aria-label': 'Review backup' }, [
        h('p', `Replace this workspace with “${pending.value.name}”? This backup contains ${countNotebookItems(pending.value.data.features.notebook.items)} Notebook groups and documents with ${countDocuments(pending.value.data.features.notebook.items)} documents, ${countIndexCardItems(pending.value.data.features['index-cards'].items)} Index Cards groups and sets with ${countCards(pending.value.data.features['index-cards'].items)} cards, plus ${countWordSearchItems(pending.value.data.features['word-search'].items)} Word Search library items with ${countWordSearches(pending.value.data.features['word-search'].items)} word searches, ${countCrosswordItems(pending.value.data.features.crossword.items)} Crossword library items with ${countCrosswords(pending.value.data.features.crossword.items)} crosswords, and ${pending.value.data.features['todo-list'].items.length} todo lists (including archived lists). This backup also contains ${countKnowledgeCheckItems(pending.value.data.features['knowledge-check'].items)} Review library items with ${countChecks(pending.value.data.features['knowledge-check'].items)} knowledge sets. Current data will be replaced, not merged.`),
        h('p', 'Download a backup first if you want to keep the current workspace.'),
        h('div', { class: 'workspace-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { void replace(); }, disabled: busy.value }, busy.value ? 'Restoring…' : 'Replace workspace'),
          h('button', {
            type: 'button', class: 'quiet-button', onClick: () => { pending.value = null; },
          }, 'Cancel'),
        ]),
      ]) : null,
      h('p', { class: 'workspace-message', role: 'status' }, message.value),
      error.value ? h('p', { class: 'workspace-error', role: 'alert' }, error.value) : null,
      props.workspace.storageProblem.value
        ? h('p', { class: 'workspace-error', role: 'alert' }, props.workspace.storageProblem.value) : null,
    ]);
  },
});
