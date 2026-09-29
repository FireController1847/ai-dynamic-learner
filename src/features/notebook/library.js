import { Icon } from '../../components/icon.js';
import { DeleteConfirmation } from './delete-confirmation.js';
import { readMarkdownFile } from './document-files.js';
import {
  countItems, createItem, deleteItem, findItem, MAX_DEPTH, MAX_ITEMS, MAX_NAME_LENGTH,
} from './library-model.js';

const { h, nextTick, onBeforeUnmount, onDeactivated, ref } = window.Vue;

export const NotebookLibrary = {
  name: 'NotebookLibrary',
  props: {
    items: { type: Array, required: true },
    selectedId: { type: String, default: null },
    collapsed: Boolean,
    importDocument: { type: Function, required: true },
  },
  emits: ['select', 'open-item', 'toggle-library', 'new-document'],
  setup(props, { emit, expose, slots }) {
    const expanded = ref(new Set());
    const editingId = ref(null);
    const draft = ref('');
    const input = ref(null);
    const collapseButton = ref(null);
    const newDocumentButton = ref(null);
    const announcement = ref('');
    const pendingDelete = ref(null);
    const uploadInput = ref(null);
    const uploading = ref(false);
    const uploadMessage = ref('');
    let uploadTarget = null;
    let disposed = false;
    onBeforeUnmount(() => { disposed = true; });

    async function upload(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || uploading.value) return;
      uploading.value = true;
      uploadMessage.value = 'Importing document…';
      try {
        const contents = await readMarkdownFile(file);
        if (disposed) return;
        props.importDocument(contents, uploadTarget);
        uploadMessage.value = `Imported ${file.name}.`;
      } catch (error) { if (!disposed) uploadMessage.value = error.message; }
      finally { uploading.value = false; }
    }
    const labels = new Map();
    let deleteTrigger = null;
    onDeactivated(() => { pendingDelete.value = null; deleteTrigger = null; });

    async function rename(item) {
      emit('select', item.id);
      editingId.value = item.id;
      draft.value = item.name;
      await nextTick();
      input.value?.focus();
      input.value?.select();
    }

    async function finishRename(commit, focus = false) {
      const id = editingId.value;
      if (!id) return;
      const found = findItem(props.items, id);
      const name = draft.value.trim();
      if (commit && found && name && name.length <= MAX_NAME_LENGTH) {
        found.item.name = name;
        announcement.value = `Renamed to ${name}.`;
      }
      editingId.value = null;
      if (focus) {
        await nextTick();
        labels.get(id)?.focus();
      }
    }

    function createGroup() {
      if (countItems(props.items) >= MAX_ITEMS) {
        announcement.value = `The Notebook limit is ${MAX_ITEMS} groups and documents.`;
        return;
      }

      const selected = findItem(props.items, props.selectedId);
      if (selected?.item.kind === 'group' && selected.depth >= MAX_DEPTH) {
        announcement.value = `Groups can be at most ${MAX_DEPTH} levels deep.`;
        return;
      }

      const item = createItem('group');
      if (selected?.item.kind === 'group') {
        selected.item.children.unshift(item);
        expanded.value.add(selected.item.id);
      } else if (selected) {
        selected.siblings.splice(selected.index + 1, 0, item);
      } else {
        props.items.unshift(item);
      }

      expanded.value.add(item.id);
      emit('select', item.id);
      reveal(item.id);
      rename(item);
    }

    function requestDelete(item, event) {
      const isEmpty = item.kind === 'group' ? item.children.length === 0
        : item.type === 'markdown' ? item.data.markdown.trim().length === 0
          : Object.keys(item.data).length === 0;
      if (isEmpty) {
        confirmDelete(item.id);
        return;
      }
      deleteTrigger = event.currentTarget;
      pendingDelete.value = item;
    }

    async function cancelDelete() {
      pendingDelete.value = null;
      await nextTick();
      if (deleteTrigger?.isConnected) deleteTrigger.focus();
      deleteTrigger = null;
    }

    async function confirmDelete(id = pendingDelete.value?.id) {
      const found = id && findItem(props.items, id);
      if (!found) {
        await cancelDelete();
        return;
      }
      const { item, siblings, index, parentId } = found;
      const fallbackId = siblings[index + 1]?.id ?? siblings[index - 1]?.id ?? parentId ?? null;
      const removesSelection = props.selectedId === item.id ||
        (item.kind === 'group' && Boolean(findItem(item.children, props.selectedId)));
      deleteItem(props.items, item.id);
      const removedItems = [item];
      while (removedItems.length) {
        const removed = removedItems.pop();
        expanded.value.delete(removed.id);
        if (editingId.value === removed.id) editingId.value = null;
        if (removed.kind === 'group') removedItems.push(...removed.children);
      }
      if (removesSelection) emit('select', fallbackId);
      pendingDelete.value = null;
      deleteTrigger = null;
      announcement.value = `Deleted ${item.name}${item.kind === 'group' ? ' and everything inside it' : ''}.`;
      await nextTick();
      (labels.get(fallbackId) ?? newDocumentButton.value)?.focus();
    }

    function toggle(id) {
      if (expanded.value.has(id)) expanded.value.delete(id);
      else expanded.value.add(id);
    }

    function reveal(id) {
      let parentId = findItem(props.items, id)?.parentId;
      while (parentId) {
        expanded.value.add(parentId);
        parentId = findItem(props.items, parentId)?.parentId;
      }
    }

    expose({
      reveal,
      focusToggle: () => collapseButton.value?.focus(),
      focusNewDocument: () => newDocumentButton.value?.focus(),
      beginRename: (id) => {
        const found = findItem(props.items, id);
        if (found) rename(found.item);
      },
    });

    function renderItem(item) {
      const isGroup = item.kind === 'group';
      const isOpen = expanded.value.has(item.id);
      const isEditing = editingId.value === item.id;

      return h('li', { key: item.id, class: 'directory-item' }, [
        h('div', { class: ['directory-row', { 'is-selected': props.selectedId === item.id }] }, [
          isGroup ? h('button', {
            type: 'button', class: ['tree-toggle', { 'is-open': isOpen }],
            'aria-label': `${isOpen ? 'Collapse' : 'Expand'} ${item.name}`,
            'aria-expanded': isOpen,
            onClick: () => toggle(item.id),
          }, [h(Icon, { name: 'chevron' })]) : h('span', { class: 'tree-toggle-space' }),
          h(Icon, { name: isGroup ? 'folder' : 'document' }),
          isEditing ? h('input', {
            ref: input,
            class: 'directory-rename',
            value: draft.value,
            maxlength: MAX_NAME_LENGTH,
            'aria-label': `Rename ${isGroup ? 'group' : 'document'}`,
            onInput: (event) => { draft.value = event.target.value; },
            onBlur: () => finishRename(true),
            onKeydown: (event) => {
              if (event.isComposing) return;
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                finishRename(event.key === 'Enter', true);
              }
            },
          }) : h('button', {
            ref: (element) => { if (element) labels.set(item.id, element); else labels.delete(item.id); },
            type: 'button',
            class: 'directory-label',
            title: item.name,
            'aria-pressed': props.selectedId === item.id,
            onClick: () => { emit('select', item.id); emit('open-item'); },
            onDblclick: () => rename(item),
            onKeydown: (event) => {
              if (event.key === 'F2') {
                event.preventDefault();
                rename(item);
              }
            },
          }, item.name),
          h('button', {
            type: 'button',
            class: 'icon-button rename-button',
            title: `Rename ${item.name}`,
            'aria-label': `Rename ${item.name}`,
            onClick: () => rename(item),
          }, [h(Icon, { name: 'pencil' })]),
          h('button', {
            type: 'button',
            class: 'icon-button delete-button',
            title: `Delete ${item.name}`,
            'aria-label': `Delete ${item.name}`,
            onClick: (event) => requestDelete(item, event),
          }, [h(Icon, { name: 'trash' })]),
        ]),
        isGroup && isOpen ? h('ul', {
          class: 'directory-children',
          'aria-label': item.name,
        }, item.children.map(renderItem)) : null,
      ]);
    }

    return () => h('aside', {
      id: 'notebook-library',
      class: 'directory-panel',
      inert: props.collapsed,
      'aria-hidden': props.collapsed,
      'aria-label': 'Notebook library',
    }, [
      h('div', { class: 'directory-toolbar' }, [
        h('h3', 'Library'),
        h('div', { class: 'directory-create-actions' }, [
          h('button', {
            type: 'button',
            class: 'icon-button',
            title: 'New group',
            'aria-label': 'New group',
            onClick: createGroup,
          }, [h(Icon, { name: 'folder' })]),
          h('button', {
            ref: newDocumentButton,
            type: 'button',
            class: 'icon-button',
            title: 'New document',
            'aria-label': 'New document',
            onClick: () => emit('new-document'),
          }, [h(Icon, { name: 'document' })]),
          h('button', {
            type: 'button', class: ['icon-button', { 'markdown-is-loading': uploading.value }],
            disabled: uploading.value, title: 'Import document', 'aria-label': 'Import document',
            onClick: () => {
              uploadTarget = { selectedId: props.selectedId };
              uploadInput.value?.click();
            },
          }, [h(Icon, { name: uploading.value ? 'loading' : 'upload' })]),
          h('button', {
            ref: collapseButton,
            type: 'button',
            class: 'icon-button',
            title: 'Minimize library',
            'aria-label': 'Minimize library',
            'aria-expanded': true,
            'aria-controls': 'notebook-library',
            onClick: () => emit('toggle-library'),
          }, [h(Icon, { name: 'panel-close' })]),
        ]),
      ]),
      h('input', { ref: uploadInput, type: 'file', accept: '.md', hidden: true, onChange: upload }),
      uploadMessage.value ? h('p', { class: 'notebook-upload-status', role: 'status' }, uploadMessage.value) : null,
      h('div', { class: 'directory-scroll' }, [
        props.items.length
          ? h('ul', { class: 'directory-list', 'aria-label': 'Groups and documents' }, props.items.map(renderItem))
          : h('p', { class: 'directory-empty' }, 'No groups or documents yet.'),
      ]),
      h('p', { class: 'visually-hidden', role: 'status' }, announcement.value),
      slots.footer ? h('div', { class: 'notebook-library-footer' }, slots.footer()) : null,
      pendingDelete.value ? h(DeleteConfirmation, {
        item: pendingDelete.value,
        onCancel: cancelDelete,
        onConfirm: confirmDelete,
      }) : null,
    ]);
  },
};
