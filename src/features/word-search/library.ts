export interface WordSearchLibraryHandle { reveal(id: string): void; focusToggle(): void; focusNewWordSearch(): void; }
import type { VNode } from 'vue';
import type { LibraryItem, MovePosition } from './library-model.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { DeleteConfirmation } from '../../components/delete-confirmation.ts';
import {
  canMove, countItems, countWordSearches, createGroup, deleteItem, findItem, firstEntry,
  MAX_DEPTH, MAX_ITEMS, MAX_NAME_LENGTH, moveItem,
} from './library-model.ts';

import { defineComponent, type PropType, h, nextTick, onDeactivated, ref } from 'vue';

export const WordSearchLibrary = defineComponent({
  name: 'WordSearchLibrary',
  props: {
    items: { type: Array as PropType<LibraryItem[]>, required: true },
    selectedId: { type: String as PropType<string | null>, default: null },
    collapsed: Boolean,
  },
  emits: { 'select': (_id: string | null) => true, 'open-item': () => true, 'toggle-library': () => true, 'new-word-search': (_target: { parentId: string | null; parentName: string }) => true },
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
    const createWordSearchButton = ref<HTMLButtonElement | null>(null);
    const collapseButton = ref<HTMLButtonElement | null>(null);
    const labels = new Map<string | null, HTMLElement>();
    let deleteTrigger: HTMLElement | null = null;

    onDeactivated(() => { pendingDelete.value = null; });

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

    function chosenDestination() {
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

      return { parentId, parentName };
    }

    function requestWordSearchSetup() {
      const target = chosenDestination();
      emit('new-word-search', target);
      announcement.value = 'Opened new word search setup for ' + target.parentName + '.';
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
    expose({
      reveal, focusToggle: () => collapseButton.value?.focus(),
      focusNewWordSearch: () => createWordSearchButton.value?.focus(),
    });

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
        class: ['word-search-root-drop', {
          'drop-inside': dropTarget.value?.id === null && dropTarget.value.position === position,
        }],
        onDragover: (event: DragEvent) => dragOver(event, null, position),
        onDrop: (event: DragEvent) => drop(event, null, position),
      }, label);
    }

    function requestDelete(item: LibraryItem, event: MouseEvent) {
      endDrag();
      if (item.kind === 'group' && item.children.length === 0) {
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
      const { item } = found;
      const removesSelection = props.selectedId === item.id ||
        (item.kind === 'group' && Boolean(findItem(item.children, props.selectedId)));

      deleteItem(props.items, item.id);
      const fallbackId = firstEntry(props.items)?.id ?? null;
      const removed = [item];
      while (removed.length) {
        const next = removed.pop();
        if (!next) continue;
        expanded.value.delete(next.id);
        if (next.kind === 'group') removed.push(...next.children);
      }
      if (removesSelection) {
        if (fallbackId) reveal(fallbackId);
        emit('select', fallbackId);
      }
      pendingDelete.value = null;
      deleteTrigger = null;
      announcement.value = `Deleted ${item.name}${item.kind === 'group' ? ' and everything inside it' : ''}.`;
      await nextTick();
      (labels.get(fallbackId) ?? createGroupButton.value)?.focus();
    }

    function renderItem(item: LibraryItem): VNode {
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
            type: 'button', class: ['word-search-tree-toggle', { 'is-open': isOpen }],
            'aria-label': `${isOpen ? 'Collapse' : 'Expand'} ${item.name}`,
            'aria-expanded': isOpen,
            onClick: () => toggle(item.id),
          }, [h(Icon, { name: 'chevron' })]) : h('span', { class: 'word-search-tree-toggle-space' }),
          h(Icon, { name: isGroup ? 'folder' : 'word-search' }),
          isEditing ? h('input', {
            ref: input, class: 'word-search-rename', value: draft.value,
            'aria-label': `Rename ${isGroup ? 'group' : 'word search'}`,
            maxlength: MAX_NAME_LENGTH,
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
            type: 'button', class: 'word-search-library-label', title: item.name,
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
            ref: createWordSearchButton,
            type: 'button', class: 'icon-button', title: 'New word search',
            'aria-label': 'New word search', onClick: requestWordSearchSetup,
          }, [h(Icon, { name: 'word-search' })]),
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
      slots.footer ? h('div', { class: 'word-search-library-footer' }, slots.footer()) : null,
      pendingDelete.value ? h(DeleteConfirmation, {
        itemName: pendingDelete.value.name,
        itemLabel: pendingDelete.value.kind === 'word-search' ? 'word search' : 'group',
        detail: pendingDelete.value.kind === 'group'
          ? `This also deletes ${countItems(pendingDelete.value.children)} nested library items, including ${countWordSearches(pendingDelete.value.children)} word searches.`
          : 'The saved word search will be removed from the library.',
        confirmLabel: pendingDelete.value.kind === 'group' ? 'Delete group' : 'Delete word search',
        onCancel: cancelDelete,
        onConfirm: confirmDelete,
      }) : null,
    ]);
  },
});
