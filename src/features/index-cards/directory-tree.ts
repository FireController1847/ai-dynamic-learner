export interface DirectoryTreeHandle { reveal(id: string): void; focusToggle(): void; }
import type { VNode } from 'vue';
import type { LibraryItem, MovePosition } from './tree-model.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { DeleteConfirmation } from './delete-confirmation.ts';
import { canMove, countItems, createItem, deleteItem, findItem, MAX_DEPTH, MAX_ITEMS, MAX_NAME_LENGTH, moveItem } from './tree-model.ts';

import { defineComponent, type PropType, h, nextTick, onDeactivated, ref } from 'vue';

export const DirectoryTree = defineComponent({
  name: 'DirectoryTree',
  props: {
    items: { type: Array as PropType<LibraryItem[]>, required: true },
    selectedId: { type: String as PropType<string | null>, default: null },
    collapsed: Boolean,
  },
  emits: { 'select': (_id: string | null) => true, 'open-item': () => true, 'toggle-library': () => true },
  setup(props, { emit, expose, slots }) {
    const expanded = ref(new Set<string>());
    const editingId = ref<string | null>(null);
    const draft = ref('');
    const input = ref<HTMLInputElement | null>(null);
    const draggedId = ref<string | null>(null);
    const dropTarget = ref<{ id: string | null; position: MovePosition } | null>(null);
    const announcement = ref('');
    const pendingDelete = ref<LibraryItem | null>(null);
    const createGroupButton = ref<HTMLButtonElement | null>(null);
    const collapseButton = ref<HTMLButtonElement | null>(null);
    const labels = new Map<string | null, HTMLElement>();
    let deleteTrigger: HTMLElement | null = null;

    onDeactivated(() => { pendingDelete.value = null; });

    function requestDelete(item: LibraryItem, event: MouseEvent) {
      endDrag();
      const isEmpty = item.kind === 'group' ? item.children.length === 0 : item.cards.length === 0;
      if (isEmpty) {
        confirmDelete(item.id);
        return;
      }
      deleteTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
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
        if (!removed) continue;
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

    async function rename(item: LibraryItem) {
      emit('select', item.id);
      editingId.value = item.id;
      draft.value = item.name;
      await nextTick();
      input.value?.focus();
      input.value?.select();
    }

    async function finishRename(commit: boolean, focus = false) {
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

    function create(kind: 'group' | 'set') {
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

    function toggle(id: string) {
      if (expanded.value.has(id)) expanded.value.delete(id);
      else expanded.value.add(id);
    }

    function reveal(id: string) {
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

    function placement(event: DragEvent, item: LibraryItem): MovePosition {
      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const ratio = (event.clientY - bounds.top) / bounds.height;
      if (item.kind === 'group' && ratio >= 0.25 && ratio <= 0.75) return 'inside';
      return ratio < 0.5 ? 'before' : 'after';
    }

    function dragOver(event: DragEvent, id: string | null, position: MovePosition) {
      event.stopPropagation();
      if (!draggedId.value || !canMove(props.items, draggedId.value, id, position)) {
        dropTarget.value = null;
        if (event.dataTransfer) event.dataTransfer!.dropEffect = 'none';
        return;
      }
      event.preventDefault();
      event.dataTransfer!.dropEffect = 'move';
      dropTarget.value = { id, position };
    }

    function drop(event: DragEvent, id: string | null, position: MovePosition) {
      event.preventDefault();
      event.stopPropagation();
      const sourceId = draggedId.value;
      if (sourceId && moveItem(props.items, sourceId, id, position)) {
        if (position === 'inside' && id) expanded.value.add(id);
        reveal(sourceId);
        emit('select', sourceId);
        announcement.value = `Moved ${findItem(props.items, sourceId)?.item.name}.`;
      }
      endDrag();
    }

    function rootTarget(position: MovePosition, label: string) {
      return h('div', {
        class: ['directory-root-drop', {
          'drop-inside': dropTarget.value?.id === null && dropTarget.value.position === position,
        }],
        onDragover: (event: DragEvent) => dragOver(event, null, position),
        onDrop: (event: DragEvent) => drop(event, null, position),
      }, label);
    }

    function renderItem(item: LibraryItem): VNode {
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
          onDragstart: (event: DragEvent) => {
            if (editingId.value) { event.preventDefault(); return; }
            draggedId.value = item.id;
            event.dataTransfer!.effectAllowed = 'move';
            event.dataTransfer!.setData('text/plain', item.id);
          },
          onDragend: endDrag,
          onDragover: (event: DragEvent) => dragOver(event, item.id, placement(event, item)),
          onDragleave: (event: DragEvent) => {
            if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) dropTarget.value = null;
          },
          onDrop: (event: DragEvent) => drop(event, item.id, placement(event, item)),
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
            onInput: (event: Event) => { draft.value = inputValue(event); },
            onBlur: () => finishRename(true),
            onKeydown: (event: KeyboardEvent) => {
              if (event.isComposing) return;
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                finishRename(event.key === 'Enter', true);
              }
            },
          }) : h('button', {
            ref: (element) => { if (element instanceof HTMLElement) labels.set(item.id, element); else labels.delete(item.id); },
            type: 'button', class: 'directory-label', title: item.name,
            'aria-pressed': props.selectedId === item.id,
            onClick: () => { emit('select', item.id); emit('open-item'); },
            onKeydown: (event: KeyboardEvent) => {
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
            onClick: (event: MouseEvent) => requestDelete(item, event),
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
});
