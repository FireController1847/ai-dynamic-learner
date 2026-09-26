import { Icon } from '../../components/icon.js';
import { DeleteConfirmation } from './delete-confirmation.js';
import {
  canMove, countItems, createGroup, deleteItem, findItem,
  MAX_DEPTH, MAX_ITEMS, MAX_NAME_LENGTH, moveItem,
} from './library-model.js';

const { h, nextTick, onDeactivated, ref } = window.Vue;

export const WordSearchLibrary = {
  name: 'WordSearchLibrary',
  props: {
    items: { type: Array, required: true },
    selectedId: { type: String, default: null },
    collapsed: Boolean,
  },
  emits: ['select', 'open-item', 'toggle-library', 'new-word-search'],
  setup(props, { emit, expose }) {
    const expanded = ref(new Set());
    const editingId = ref(null);
    const draft = ref('');
    const input = ref(null);
    const draggedId = ref(null);
    const dropTarget = ref(null);
    const announcement = ref('');
    const pendingDelete = ref(null);
    const createGroupButton = ref(null);
    const collapseButton = ref(null);
    const labels = new Map();
    let deleteTrigger = null;

    onDeactivated(() => { pendingDelete.value = null; });

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
      if (commit && found && name) {
        found.item.name = name;
        announcement.value = `Renamed to ${name}.`;
      }
      editingId.value = null;
      if (focus) {
        await nextTick();
        labels.get(id)?.focus();
      }
    }

    function createGroupRelativeToSelection() {
      if (countItems(props.items) >= MAX_ITEMS) {
        announcement.value = `The Word Search library limit is ${MAX_ITEMS} items.`;
        return;
      }

      const selected = findItem(props.items, props.selectedId);
      if (selected?.item.kind === 'group' && selected.depth >= MAX_DEPTH) {
        announcement.value = `Groups can be at most ${MAX_DEPTH} levels deep.`;
        return;
      }

      const group = createGroup();
      if (selected?.item.kind === 'group') {
        selected.item.children.unshift(group);
        expanded.value.add(selected.item.id);
        announcement.value = `Created a new group inside ${selected.item.name}.`;
      } else if (selected) {
        selected.siblings.splice(selected.index + 1, 0, group);
        announcement.value = `Created a new group after ${selected.item.name}.`;
      } else {
        props.items.unshift(group);
        announcement.value = 'Created a new group at the top level.';
      }
      expanded.value.add(group.id);
      rename(group);
    }

    function requestWordSearchSetup() {
      const selected = findItem(props.items, props.selectedId);
      let parentId = null;
      let parentName = 'Top level';

      if (selected?.item.kind === 'group') {
        parentId = selected.item.id;
        parentName = selected.item.name;
        expanded.value.add(selected.item.id);
      } else if (selected?.parentId) {
        parentId = selected.parentId;
        parentName = findItem(props.items, selected.parentId)?.item.name ?? 'Selected group';
      }

      emit('new-word-search', { parentId, parentName });
      announcement.value = `Opened new word search setup for ${parentName}.`;
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
    expose({ reveal, focusToggle: () => collapseButton.value?.focus() });

    function endDrag() {
      draggedId.value = null;
      dropTarget.value = null;
    }

    function placement(event, item) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientY - bounds.top) / bounds.height;
      if (item.kind === 'group' && ratio >= 0.25 && ratio <= 0.75) return 'inside';
      return ratio < 0.5 ? 'before' : 'after';
    }

    function dragOver(event, id, position) {
      event.stopPropagation();
      if (!draggedId.value || !canMove(props.items, draggedId.value, id, position)) {
        dropTarget.value = null;
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dropTarget.value = { id, position };
    }

    function drop(event, id, position) {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = draggedId.value;
      if (sourceId && moveItem(props.items, sourceId, id, position)) {
        if (position === 'inside' && id) expanded.value.add(id);
        reveal(sourceId);
        emit('select', sourceId);
        announcement.value = `Moved ${findItem(props.items, sourceId).item.name}.`;
      }
      endDrag();
    }

    function rootTarget(position, label) {
      return h('div', {
        class: ['word-search-root-drop', {
          'drop-inside': dropTarget.value?.id === null && dropTarget.value.position === position,
        }],
        onDragover: (event) => dragOver(event, null, position),
        onDrop: (event) => drop(event, null, position),
      }, label);
    }

    function requestDelete(item, event) {
      endDrag();
      if (item.kind === 'group' && item.children.length === 0) {
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
      if (!found) { cancelDelete(); return; }
      const { item, siblings, index, parentId } = found;
      const fallbackId = siblings[index + 1]?.id ?? siblings[index - 1]?.id ?? parentId;
      const removesSelection = props.selectedId === item.id ||
        (item.kind === 'group' && Boolean(findItem(item.children, props.selectedId)));

      deleteItem(props.items, item.id);
      const removed = [item];
      while (removed.length) {
        const next = removed.pop();
        expanded.value.delete(next.id);
        if (next.kind === 'group') removed.push(...next.children);
      }
      if (removesSelection) emit('select', fallbackId);
      pendingDelete.value = null;
      deleteTrigger = null;
      announcement.value = `Deleted ${item.name}${item.kind === 'group' ? ' and everything inside it' : ''}.`;
      await nextTick();
      (labels.get(fallbackId) ?? createGroupButton.value)?.focus();
    }

    function renderItem(item) {
      const isGroup = item.kind === 'group';
      const isOpen = expanded.value.has(item.id);
      const isEditing = editingId.value === item.id;
      const position = dropTarget.value?.id === item.id ? dropTarget.value.position : null;

      return h('li', { key: item.id, class: 'word-search-library-item' }, [
        h('div', {
          class: ['word-search-library-row', {
            'is-selected': props.selectedId === item.id,
            'is-dragging': draggedId.value === item.id,
            [`drop-${position}`]: Boolean(position),
          }],
          draggable: !editingId.value,
          onDragstart: (event) => {
            if (editingId.value) { event.preventDefault(); return; }
            draggedId.value = item.id;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.id);
          },
          onDragend: endDrag,
          onDragover: (event) => dragOver(event, item.id, placement(event, item)),
          onDragleave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) dropTarget.value = null;
          },
          onDrop: (event) => drop(event, item.id, placement(event, item)),
        }, [
          isGroup ? h('button', {
            type: 'button', class: ['word-search-tree-toggle', { 'is-open': isOpen }],
            'aria-label': `${isOpen ? 'Collapse' : 'Expand'} ${item.name}`,
            'aria-expanded': isOpen,
            onClick: () => toggle(item.id),
          }, [h(Icon, { name: 'chevron' })]) : h('span', { class: 'word-search-tree-toggle-space' }),
          h(Icon, { name: isGroup ? 'folder' : 'search' }),
          isEditing ? h('input', {
            ref: input, class: 'word-search-rename', value: draft.value,
            'aria-label': `Rename ${isGroup ? 'group' : 'word search'}`,
            maxlength: MAX_NAME_LENGTH,
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
            type: 'button', class: 'word-search-library-label', title: item.name,
            'aria-pressed': props.selectedId === item.id,
            onClick: () => { emit('select', item.id); emit('open-item'); },
            onKeydown: (event) => {
              if (event.key === 'F2') { event.preventDefault(); rename(item); }
            },
          }, item.name),
          h('button', {
            type: 'button', class: 'icon-button rename-button',
            'aria-label': `Rename ${item.name}`, title: `Rename ${item.name}`,
            onClick: () => rename(item),
          }, [h(Icon, { name: 'pencil' })]),
          h('button', {
            type: 'button', class: 'icon-button delete-button',
            'aria-label': `Delete ${item.name}`, title: `Delete ${item.name}`,
            onClick: (event) => requestDelete(item, event),
          }, [h(Icon, { name: 'trash' })]),
        ]),
        isGroup && isOpen ? h('ul', {
          class: 'word-search-library-children', 'aria-label': item.name,
        }, item.children.map(renderItem)) : null,
      ]);
    }

    return () => h('aside', {
      id: 'word-search-library',
      class: 'word-search-library',
      inert: props.collapsed,
      'aria-hidden': props.collapsed,
      'aria-label': 'Word Search library',
    }, [
      h('div', { class: 'word-search-library-toolbar' }, [
        h('h3', 'Library'),
        h('div', { class: 'word-search-library-actions' }, [
          h('button', {
            ref: createGroupButton,
            type: 'button', class: 'icon-button', title: 'New group',
            'aria-label': 'New group', onClick: createGroupRelativeToSelection,
          }, [h(Icon, { name: 'folder' })]),
          h('button', {
            type: 'button', class: 'icon-button', title: 'New word search',
            'aria-label': 'New word search', onClick: requestWordSearchSetup,
          }, [h(Icon, { name: 'search' })]),
          h('button', {
            ref: collapseButton,
            type: 'button', class: 'icon-button', title: 'Minimize library',
            'aria-label': 'Minimize library', 'aria-expanded': true,
            'aria-controls': 'word-search-library',
            onClick: () => emit('toggle-library'),
          }, [h(Icon, { name: 'panel-close' })]),
        ]),
      ]),
      h('div', { class: 'word-search-library-scroll' }, [
        rootTarget('before', 'Top level'),
        props.items.length
          ? h('ul', { class: 'word-search-library-list', 'aria-label': 'Groups and word searches' },
            props.items.map(renderItem))
          : h('p', { class: 'word-search-library-empty' }, 'No groups or word searches yet.'),
        draggedId.value ? rootTarget('after', 'Move to end of top level') : null,
      ]),
      h('p', { class: 'visually-hidden', role: 'status' }, announcement.value),
      pendingDelete.value ? h(DeleteConfirmation, {
        item: pendingDelete.value,
        onCancel: cancelDelete,
        onConfirm: confirmDelete,
      }) : null,
    ]);
  },
};
