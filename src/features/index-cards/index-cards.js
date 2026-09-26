import { DirectoryTree } from './directory-tree.js';
import { CardSet } from './card-set.js';
import { Icon } from '../../components/icon.js';
import { canMove, countCards, findItem, groupOptions, moveItem } from './tree-model.js';

const { computed, h, nextTick, ref } = window.Vue;

export const IndexCards = {
  name: 'IndexCards',
  props: {
    title: { type: String, required: true },
    model: { type: Object, required: true },
  },
  setup(props) {
    const selectedId = ref(null);
    const libraryCollapsed = ref(false);
    const tree = ref(null);
    const showLibraryButton = ref(null);
    const message = ref('');
    const selection = computed(() => findItem(props.model.items, selectedId.value));
    const totalCards = computed(() => countCards(props.model.items));

    async function setLibraryCollapsed(collapsed) {
      libraryCollapsed.value = collapsed;
      await nextTick();
      if (collapsed) showLibraryButton.value?.focus();
      else tree.value?.focusToggle();
    }

    function moveToGroup(event) {
      const targetId = event.target.value || null;
      if (moveItem(props.model.items, selectedId.value, targetId, 'inside')) {
        tree.value.reveal(selectedId.value);
        message.value = `Moved ${selection.value.item.name}.`;
      }
    }

    function reorder(offset) {
      const { siblings, index, item } = selection.value;
      const neighbor = siblings[index + offset];
      if (neighbor && moveItem(props.model.items, item.id, neighbor.id, offset < 0 ? 'before' : 'after')) {
        message.value = `Moved ${item.name} ${offset < 0 ? 'up' : 'down'}.`;
      }
    }

    return () => h('section', { class: 'index-cards-page', 'aria-label': props.title }, [
      h('div', { class: ['index-cards-layout', { 'library-collapsed': libraryCollapsed.value }] }, [
        libraryCollapsed.value ? h('button', {
          ref: showLibraryButton, type: 'button', class: 'icon-button library-floating-toggle',
          title: 'Show library', 'aria-label': 'Show library',
          'aria-expanded': false, 'aria-controls': 'index-cards-library',
          onClick: () => setLibraryCollapsed(false),
        }, [h(Icon, { name: 'panel-open' })]) : null,
        h(DirectoryTree, {
          ref: tree, items: props.model.items, selectedId: selectedId.value,
          collapsed: libraryCollapsed.value,
          onToggleLibrary: () => setLibraryCollapsed(true),
          onSelect: (id) => { selectedId.value = id; message.value = ''; },
        }),
        selection.value ? h('section', {
          class: ['index-cards-detail', { 'is-set': selection.value.item.kind === 'set' }],
          'aria-label': 'Selected item',
        }, [
          h('header', { class: 'item-heading' }, [
            h('h2', selection.value.item.name),
            h('p', { class: 'item-summary' }, selection.value.item.kind === 'group'
              ? `Group · ${selection.value.item.children.length} items`
              : `Set · ${selection.value.item.cards.length} cards`),
          ]),
          selection.value.item.kind === 'set' ? h(CardSet, {
            key: selection.value.item.id, set: selection.value.item, totalCards: totalCards.value,
          }) : null,
          h('details', {
            key: `organization-${selection.value.item.id}`, class: 'item-organization',
            open: selection.value.item.kind === 'group',
          }, [
          h('summary', 'Location and order'),
          h('div', { class: 'item-location' }, [
            h('label', { for: 'index-cards-parent' }, 'Move to group'),
            h('select', {
              id: 'index-cards-parent', value: selection.value.parentId ?? '', onChange: moveToGroup,
            }, [
              h('option', { value: '' }, 'Top level'),
              ...groupOptions(props.model.items, selectedId.value).map((group) => h('option', {
                key: group.id, value: group.id,
                disabled: !canMove(props.model.items, selectedId.value, group.id, 'inside'),
              }, group.label)),
            ]),
          ]),
          h('div', { class: 'item-order-actions' }, [
            h('button', {
              type: 'button', class: 'quiet-button', disabled: selection.value.index === 0,
              onClick: () => reorder(-1),
            }, 'Move up'),
            h('button', {
              type: 'button', class: 'quiet-button',
              disabled: selection.value.index === selection.value.siblings.length - 1,
              onClick: () => reorder(1),
            }, 'Move down'),
          ]),
          ]),
          h('p', { class: 'visually-hidden', role: 'status' }, message.value),
        ]) : null,
      ]),
    ]);
  },
};
