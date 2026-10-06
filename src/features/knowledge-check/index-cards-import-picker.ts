import type { LibraryItem } from '../index-cards/tree-model.ts';
import { DEFAULT_SET_MODE } from '../index-cards/set-modes.ts';
import { SetModeIcon } from '../index-cards/set-mode-icon.ts';
import { Icon } from '../../components/icon.ts';
import { defineComponent, h, ref, type PropType, type VNode } from 'vue';

export const IndexCardsImportPicker = defineComponent({
  name: 'IndexCardsImportPicker',
  props: {
    items: { type: Array as PropType<LibraryItem[]>, required: true },
    selectedId: { type: String as PropType<string | null>, default: null },
  },
  emits: {
    select: (_id: string) => true,
    cancel: () => true,
  },
  setup(props, { emit }) {
    const expanded = ref(new Set<string>());

    function revealSelected(items: LibraryItem[], target: string | null): boolean {
      if (!target) return false;
      for (const item of items) {
        if (item.kind === 'set' && item.id === target) return true;
        if (item.kind === 'group' && revealSelected(item.children, target)) {
          expanded.value.add(item.id);
          return true;
        }
      }
      return false;
    }

    revealSelected(props.items, props.selectedId);

    function toggle(id: string) {
      if (expanded.value.has(id)) expanded.value.delete(id);
      else expanded.value.add(id);
    }

    function renderItem(item: LibraryItem): VNode {
      if (item.kind === 'group') {
        const open = expanded.value.has(item.id);
        return h('li', { key: item.id, class: 'knowledge-import-picker-item' }, [
          h('div', { class: 'knowledge-import-picker-row is-group' }, [
            h('button', {
              type: 'button',
              class: ['knowledge-import-picker-toggle', { 'is-open': open }],
              'aria-label': `${open ? 'Collapse' : 'Expand'} ${item.name}`,
              'aria-expanded': open,
              onClick: () => toggle(item.id),
            }, [h(Icon, { name: 'chevron' })]),
            h(Icon, { name: 'folder' }),
            h('button', {
              type: 'button',
              class: 'knowledge-import-picker-label',
              onClick: () => toggle(item.id),
            }, item.name),
            h('span', { class: 'knowledge-import-picker-count' }, `${item.children.length}`),
          ]),
          open
            ? h('ul', { class: 'knowledge-import-picker-children', 'aria-label': item.name },
              item.children.map(renderItem))
            : null,
        ]);
      }

      const selected = props.selectedId === item.id;
      const mode = item.mode ?? DEFAULT_SET_MODE;
      return h('li', { key: item.id, class: 'knowledge-import-picker-item' }, [
        h('button', {
          type: 'button',
          class: ['knowledge-import-picker-row is-set', { 'is-selected': selected }],
          'aria-pressed': selected,
          onClick: () => emit('select', item.id),
        }, [
          h('span', { class: 'knowledge-import-picker-toggle-space', 'aria-hidden': 'true' }),
          h(SetModeIcon, { mode, compact: true }),
          h('span', { class: 'knowledge-import-picker-set-copy' }, [
            h('strong', item.name),
            h('span', `${mode === 'fill-in-the-blanks' ? 'Fill in the Blanks' : 'Flash Cards'} · ${item.cards.length} ${item.cards.length === 1 ? 'card' : 'cards'}`),
          ]),
          selected ? h(Icon, { name: 'check' }) : null,
        ]),
      ]);
    }

    return () => h('section', {
      class: 'knowledge-import-picker',
      'aria-labelledby': 'knowledge-import-picker-title',
    }, [
      h('header', { class: 'knowledge-import-picker-header' }, [
        h('div', [
          h('h3', { id: 'knowledge-import-picker-title' }, 'Choose an Index Cards set'),
          h('p', 'Select one saved set from your Index Cards library. Groups are shown exactly as they are organized there.'),
        ]),
        h('button', {
          type: 'button',
          class: 'quiet-button',
          onClick: () => emit('cancel'),
        }, 'Back to sources'),
      ]),
      h('div', { class: 'knowledge-import-picker-library' }, [
        props.items.length
          ? h('ul', { class: 'knowledge-import-picker-list', 'aria-label': 'Index Cards groups and sets' },
            props.items.map(renderItem))
          : h('div', { class: 'knowledge-import-picker-empty' }, [
            h(Icon, { name: 'cards' }),
            h('strong', 'No Index Cards sets yet'),
            h('p', 'Create a Flash Cards or Fill in the Blanks set in Index Cards, then return here to import it.'),
          ]),
      ]),
    ]);
  },
});
