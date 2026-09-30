import type { Workspace, WorkspaceController } from './workspace.ts';
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

    function download() {
      error.value = '';
      try { props.workspace.downloadBackup(); }
      catch (problem) { error.value = (problem instanceof Error ? problem.message : String(problem)) || 'The backup could not be downloaded.'; }
    }

    function replace() {
      if (!pending.value) return;
      try {
        props.workspace.replaceWorkspace(pending.value.data);
        pending.value = null;
        message.value = 'Workspace restored.';
      } catch (problem) { error.value = (problem instanceof Error ? problem.message : String(problem)); }
    }

    return () => h('section', { class: 'workspace-tools', 'aria-label': 'Workspace backups' }, [
      h('h2', { class: 'workspace-tools-heading' }, 'Workspace'),
      h('div', { class: 'workspace-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: download }, [
          h(Icon, { name: 'download' }), 'Download backup',
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
      pending.value ? h('div', { class: 'backup-review', role: 'region', 'aria-label': 'Review backup' }, [
        h('p', `Replace this workspace with “${pending.value.name}”? This backup contains ${countNotebookItems(pending.value.data.features.notebook.items)} Notebook groups and documents with ${countDocuments(pending.value.data.features.notebook.items)} documents, ${countIndexCardItems(pending.value.data.features['index-cards'].items)} Index Cards groups and sets with ${countCards(pending.value.data.features['index-cards'].items)} cards, plus ${countWordSearchItems(pending.value.data.features['word-search'].items)} Word Search library items with ${countWordSearches(pending.value.data.features['word-search'].items)} word searches, ${countCrosswordItems(pending.value.data.features.crossword.items)} Crossword library items with ${countCrosswords(pending.value.data.features.crossword.items)} crosswords, and ${pending.value.data.features['todo-list'].items.length} todo lists (including archived lists). Current data will be replaced, not merged.`),
        h('p', 'Download a backup first if you want to keep the current workspace.'),
        h('div', { class: 'workspace-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: replace }, 'Replace workspace'),
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
