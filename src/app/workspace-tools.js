import { Icon } from '../components/icon.js';
import { countDocuments, countItems as countNotebookItems } from '../features/notebook/library-model.js';
import { countCards, countItems as countIndexCardItems } from '../features/index-cards/tree-model.js';
import {
  countItems as countWordSearchItems,
  countWordSearches,
} from '../features/word-search/library-model.js';

const { h, ref, shallowRef } = window.Vue;

export const WorkspaceTools = {
  name: 'WorkspaceTools',
  props: { workspace: { type: Object, required: true } },
  setup(props) {
    const fileInput = ref(null);
    const pending = shallowRef(null);
    const busy = ref(false);
    const message = ref('');
    const error = ref('');

    async function upload(event) {
      const file = event.target.files[0];
      event.target.value = '';
      if (!file) return;
      busy.value = true;
      pending.value = null;
      error.value = '';
      message.value = '';
      try {
        pending.value = { name: file.name, data: await props.workspace.readBackup(file) };
      } catch (problem) {
        error.value = problem.message || 'The backup could not be read.';
      } finally {
        busy.value = false;
      }
    }

    async function download() {
      busy.value = true;
      error.value = '';
      message.value = '';
      try {
        await props.workspace.downloadBackup();
        message.value = 'Backup downloaded.';
      } catch (problem) {
        error.value = problem.message || 'The backup could not be downloaded.';
      } finally {
        busy.value = false;
      }
    }

    async function replace() {
      busy.value = true;
      error.value = '';
      try {
        await props.workspace.replaceWorkspace(pending.value.data);
        pending.value = null;
        message.value = 'Workspace restored.';
      } catch (problem) {
        error.value = problem.message || 'The workspace could not be restored.';
      } finally {
        busy.value = false;
      }
    }

    return () => h('section', { class: 'workspace-tools', 'aria-label': 'Workspace backups' }, [
      h('h2', { class: 'workspace-tools-heading' }, 'Workspace'),
      h('div', { class: 'workspace-actions' }, [
        h('button', {
          type: 'button',
          class: 'quiet-button',
          disabled: busy.value || !props.workspace.ready.value,
          onClick: download,
        }, [
          h(Icon, { name: 'download' }), busy.value ? 'Working…' : 'Download backup',
        ]),
        h('button', {
          type: 'button',
          class: 'quiet-button',
          disabled: busy.value || !props.workspace.storageAvailable.value,
          onClick: () => fileInput.value.click(),
        }, [h(Icon, { name: 'upload' }), busy.value ? 'Reading backup…' : 'Upload backup']),
        h('input', {
          ref: fileInput,
          type: 'file',
          accept: '.bak,.json,application/gzip,application/json',
          hidden: true,
          onChange: upload,
        }),
      ]),
      pending.value ? h('div', { class: 'backup-review', role: 'region', 'aria-label': 'Review backup' }, [
        h('p', `Replace this workspace with “${pending.value.name}”? This backup contains ${countNotebookItems(pending.value.data.features.notebook.items)} Notebook groups and documents with ${countDocuments(pending.value.data.features.notebook.items)} documents, ${countIndexCardItems(pending.value.data.features['index-cards'].items)} Index Cards groups and sets with ${countCards(pending.value.data.features['index-cards'].items)} cards, plus ${countWordSearchItems(pending.value.data.features['word-search'].items)} Word Search library items with ${countWordSearches(pending.value.data.features['word-search'].items)} word searches. Current data will be replaced, not merged.`),
        h('p', 'Download a backup first if you want to keep the current workspace.'),
        h('div', { class: 'workspace-actions' }, [
          h('button', {
            type: 'button', class: 'quiet-button', disabled: busy.value, onClick: replace,
          }, busy.value ? 'Replacing…' : 'Replace workspace'),
          h('button', {
            type: 'button', class: 'quiet-button', onClick: () => { pending.value = null; },
          }, 'Cancel'),
        ]),
      ]) : null,
      props.workspace.migrationNotice.value
        ? h('p', { class: 'workspace-message', role: 'status' }, props.workspace.migrationNotice.value)
        : null,
      h('p', { class: 'workspace-message', role: 'status' }, message.value),
      error.value ? h('p', { class: 'workspace-error', role: 'alert' }, error.value) : null,
      props.workspace.storageProblem.value
        ? h('p', { class: 'workspace-error', role: 'alert' }, props.workspace.storageProblem.value) : null,
    ]);
  },
};
