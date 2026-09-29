import { Icon } from '../../components/icon.js';
import { DeleteConfirmation } from './delete-confirmation.js';
import { canMove, countItems, createItem, deleteItem, findItem, MAX_DEPTH, MAX_ITEMS, MAX_NAME_LENGTH, moveItem } from './tree-model.js';

import { h, nextTick, onDeactivated, ref } from 'vue';

export const DirectoryTree = {
  name: 'DirectoryTree',
  props: {
    items: { type: Array, required: true },
    selectedId: { type: String, default: null },
    collapsed: Boolean,
  },
  emits: ['select', 'open-item', 'toggle-library'],
  setup(props, { emit, expose, slots }) {
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

    function requestDelete(item, event) {
      endDrag();
      const isEmpty = item.kind === 'group' ? item.children.length === 0 : item.cards.length === 0;
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
      if (!found) { cancelDelete(); return; }
      const { item, siblings, index, parentId } = found;
      const fallbackId = siblings[index + 1]?.id ?? siblings[index - 1]?.id ?? parentId;
      const removesSelection = props.selectedId === item.id ||
        (item.kind === 'group' && Boolean(findItem(item.children, props.selectedId)));

      deleteItem(props.items, item.id);
      const removedItems = [item];
      while (removedItems.length) {
        const removed = removedItems.pop();
        expanded.value.delete(removed.id);
        if (removed.kind === 'group') removedItems.push(...removed.children);
      }
      if (removesSelection) emit('select', fallbackId);
      pendingDelete.value = null;
      deleteTrigger = null;
      announcement.value = `Deleted ${item.name}${item.kind === 'group' ? ' and everything inside it' : ''}.`;
      await nextTick();
      (labels.get(fallbackId) ?? createGroupButton.value)?.focus();
    }

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

    function create(kind) {
      if (countItems(props.items) >= MAX_ITEMS) {
        announcement.value = `The workspace limit is ${MAX_ITEMS} groups and sets.`;
        return;
      }

      const selected = findItem(props.items, props.selectedId);
      if (selected?.item.kind === 'group' && selected.depth >= MAX_DEPTH) {
        announcement.value = `Groups can be at most ${MAX_DEPTH} levels deep.`;
        return;
      }

      const item = createItem(kind);
      if (selected?.item.kind === 'group') {
        selected.item.children.unshift(item);
        expanded.value.add(selected.item.id);
        announcement.value = `Created a new ${kind} inside ${selected.item.name}.`;
      } else if (selected) {
        selected.siblings.splice(selected.index + 1, 0, item);
        announcement.value = `Created a new ${kind} after ${selected.item.name}.`;
      } else {
        props.items.unshift(item);
        announcement.value = `Created a new ${kind} at the top level.`;
      }

      if (kind === 'group') expanded.value.add(item.id);
      rename(item);
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
        class: ['directory-root-drop', {
          'drop-inside': dropTarget.value?.id === null && dropTarget.value.position === position,
        }],
        onDragover: (event) => dragOver(event, null, position),
        onDrop: (event) => drop(event, null, position),
      }, label);
    }

    function renderItem(item) {
      const isGroup = item.kind === 'group';
      const isOpen = expanded.value.has(item.id);
      const isEditing = editingId.value === item.id;
      const position = dropTarget.value?.id === item.id ? dropTarget.value.position : null;
      return h('li', { key: item.id, class: 'directory-item' }, [
        h('div', {
          class: ['directory-row', {
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
            type: 'button', class: ['tree-toggle', { 'is-open': isOpen }],
            'aria-label': `${isOpen ? 'Collapse' : 'Expand'} ${item.name}`,
            'aria-expanded': isOpen,
            onClick: () => toggle(item.id),
          }, [h(Icon, { name: 'chevron' })]) : h('span', { class: 'tree-toggle-space' }),
          h(Icon, { name: isGroup ? 'folder' : 'cards' }),
          isEditing ? h('input', {
            ref: input, class: 'directory-rename', value: draft.value,
            'aria-label': `Rename ${item.kind}`, maxlength: MAX_NAME_LENGTH,
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
            type: 'button', class: 'directory-label', title: item.name,
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
        isGroup && isOpen ? h('ul', { class: 'directory-children', 'aria-label': item.name },
          item.children.map(renderItem)) : null,
      ]);
    }

    return () => h('aside', {
      id: 'index-cards-library', class: 'directory-panel',
      inert: props.collapsed, 'aria-hidden': props.collapsed,
      'aria-label': 'Index Cards library',
    }, [
      h('div', { class: 'directory-toolbar' }, [
        h('h3', 'Library'),
        h('div', { class: 'directory-create-actions' }, [
          h('button', {
            ref: createGroupButton,
            type: 'button', class: 'icon-button', title: 'New group',
            'aria-label': 'New group', onClick: () => create('group'),
          }, [h(Icon, { name: 'folder' })]),
          h('button', {
            type: 'button', class: 'icon-button', title: 'New set',
            'aria-label': 'New set', onClick: () => create('set'),
          }, [h(Icon, { name: 'cards' })]),
          h('button', {
            ref: collapseButton, type: 'button', class: 'icon-button',
            title: 'Minimize library', 'aria-label': 'Minimize library',
            'aria-expanded': true, 'aria-controls': 'index-cards-library',
            onClick: () => emit('toggle-library'),
          }, [h(Icon, { name: 'panel-close' })]),
        ]),
      ]),
      h('div', { id: 'index-cards-directory', class: 'directory-scroll' }, [
        rootTarget('before', 'Top level'),
        props.items.length
          ? h('ul', { class: 'directory-list', 'aria-label': 'Groups and sets' }, props.items.map(renderItem))
          : h('p', { class: 'directory-empty' }, 'No groups or sets yet.'),
        draggedId.value ? rootTarget('after', 'Move to end of top level') : null,
      ]),
      slots.footer ? h('div', { class: 'directory-footer' }, slots.footer()) : null,
      h('p', { class: 'visually-hidden', role: 'status' }, announcement.value),
      pendingDelete.value ? h(DeleteConfirmation, {
        item: pendingDelete.value, onCancel: cancelDelete, onConfirm: confirmDelete,
      }) : null,
    ]);
  },
};
