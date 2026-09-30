import type { LibraryItem, Crossword as FeatureModel } from './library-model.ts';
import type { CrosswordLibraryHandle } from './library.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { CrosswordLibrary } from './library.ts';
import { canMove, findItem, groupOptions, moveItem } from './library-model.ts';

import { defineComponent, type PropType, computed, h, onBeforeUnmount, ref } from 'vue';

const MIN_LIBRARY_WIDTH = 248;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.crossword.library-width';

export const Crossword = defineComponent({
  name: 'Crossword',
  props: {
    title: { type: String, required: true },
    model: { type: Object as PropType<FeatureModel>, required: true },
  },
  setup(props) {
    const selectedId = ref<string | null>(null);
    const overlayQuery = window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const libraryOverlay = ref(overlayQuery.matches);
    const libraryCollapsed = ref(false);
    const layout = ref<HTMLElement | null>(null);
    const library = ref<CrosswordLibraryHandle | null>(null);
    const showLibraryButton = ref<HTMLButtonElement | null>(null);
    const message = ref('');

    const {
      width: libraryWidth,
      resizing: libraryResizing,
      maxWidth: maxLibraryWidth,
      currentWidth: currentLibraryWidth,
      resetWidth: resetLibraryWidth,
      beginResize: beginLibraryResize,
      resizeFromPointer: resizeLibraryFromPointer,
      endResize: endLibraryResize,
      resizeFromKeyboard: resizeLibraryFromKeyboard,
    } = usePersistedPanelResize({
      preferenceKey: LIBRARY_WIDTH_KEY,
      container: layout,
      panelSelector: '.crossword-library',
      minWidth: MIN_LIBRARY_WIDTH,
      maxWidth: 640,
      minRemainingWidth: 320,
      fallbackWidth: 280,
      disabled: () => libraryOverlay.value || libraryCollapsed.value,
    });

    const selection = computed(() => findItem(props.model.items, selectedId.value));

    function updateLibraryLayout(event: MediaQueryListEvent) {
      libraryOverlay.value = event.matches;
      libraryResizing.value = false;
      if (event.matches && selectedId.value) libraryCollapsed.value = true;
    }

    overlayQuery.addEventListener('change', updateLibraryLayout);
    onBeforeUnmount(() => overlayQuery.removeEventListener('change', updateLibraryLayout));

    async function setLibraryCollapsed(collapsed: boolean) {
      libraryCollapsed.value = collapsed;
      await import('vue').then(({ nextTick }) => nextTick());
      if (collapsed) showLibraryButton.value?.focus();
      else library.value?.focusToggle();
    }

    function selectItem(id: string | null) {
      selectedId.value = id;
      message.value = '';
    }

    function moveToGroup(event: Event) {
      if (!selectedId.value || !selection.value) return;
      const targetId = inputValue(event) || null;
      if (moveItem(props.model.items, selectedId.value, targetId, 'inside')) {
        library.value?.reveal(selectedId.value);
        message.value = `Moved ${selection.value.item.name}.`;
      }
    }

    function reorder(offset: number) {
      if (!selection.value) return;
      const { siblings, index, item } = selection.value;
      const neighbor = siblings[index + offset];
      if (neighbor && moveItem(props.model.items, item.id, neighbor.id,
          offset < 0 ? 'before' : 'after')) {
        message.value = `Moved ${item.name} ${offset < 0 ? 'up' : 'down'}.`;
      }
    }

    function organizationControls(item: LibraryItem) {
      if (!selection.value) return null;
      return h('details', {
        key: `organization-${item.id}`,
        class: 'crossword-organization',
        open: item.kind === 'group',
      }, [
        h('summary', 'Location and order'),
        h('div', { class: 'crossword-location' }, [
          h('label', { for: 'crossword-parent' }, 'Move to group'),
          h('select', {
            id: 'crossword-parent',
            value: selection.value.parentId ?? '',
            onChange: moveToGroup,
          }, [
            h('option', { value: '' }, 'Top level'),
            ...groupOptions(props.model.items, selectedId.value).map((group) => h('option', {
              key: group.id,
              value: group.id,
              disabled: !canMove(props.model.items, item.id, group.id, 'inside'),
            }, group.label)),
          ]),
        ]),
        h('div', { class: 'crossword-order-actions' }, [
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: selection.value.index === 0,
            onClick: () => reorder(-1),
          }, 'Move up'),
          h('button', {
            type: 'button',
            class: 'quiet-button',
            disabled: selection.value.index === selection.value.siblings.length - 1,
            onClick: () => reorder(1),
          }, 'Move down'),
        ]),
      ]);
    }

    function detail() {
      const item = selection.value?.item;
      if (!item) {
        return h('section', {
          class: 'crossword-detail',
          'aria-label': 'Crossword workspace',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h('div', { class: 'crossword-placeholder' }, [
            h(Icon, { name: 'crossword' }),
            h('h2', 'Build your crossword library'),
            h('p', 'Create groups now to organize your puzzles. Crossword creation and solving are coming next.'),
            h('button', {
              type: 'button',
              class: 'card-primary-button',
              disabled: true,
              title: 'Crossword creation is coming soon',
            }, 'New crossword'),
          ]),
        ]);
      }

      return h('section', {
        class: ['crossword-detail', { 'is-crossword': item.kind === 'crossword' }],
        inert: libraryOverlay.value && !libraryCollapsed.value,
        'aria-label': item.kind === 'group' ? 'Selected group' : 'Selected crossword',
      }, [
        h('header', { class: 'crossword-item-heading' }, [
          h('h2', { tabindex: -1 }, item.name),
          h('p', item.kind === 'group' ? `Group · ${item.children.length} items` : 'Crossword'),
        ]),
        item.kind === 'crossword' ? h('div', { class: 'crossword-placeholder crossword-placeholder-inline' }, [
          h('h3', 'Puzzle tools coming next'),
          h('p', 'This library shell is ready; the crossword editor and solver have not been implemented yet.'),
        ]) : null,
        organizationControls(item),
        h('p', { class: 'visually-hidden', role: 'status' }, message.value),
      ]);
    }

    return () => h('section', {
      class: 'crossword-page',
      'aria-label': props.title,
      onKeydown: (event: KeyboardEvent) => {
        if (event.key === 'Escape' && libraryOverlay.value && !libraryCollapsed.value &&
            !(event.target instanceof Element && event.target.closest('dialog'))) {
          event.preventDefault();
          setLibraryCollapsed(true);
        }
      },
    }, [
      h('div', {
        ref: layout,
        class: ['crossword-layout', {
          'library-collapsed': libraryCollapsed.value,
          'library-resizing': libraryResizing.value,
        }],
        style: libraryWidth.value === null ? null : {
          '--crossword-library-width': `${libraryWidth.value}px`,
        },
      }, [
        libraryCollapsed.value ? h('button', {
          ref: showLibraryButton,
          type: 'button',
          class: 'icon-button crossword-library-floating-toggle',
          title: 'Show library',
          'aria-label': 'Show library',
          'aria-expanded': false,
          'aria-controls': 'crossword-library',
          onClick: () => setLibraryCollapsed(false),
        }, [h(Icon, { name: 'panel-open' })]) : null,
        libraryOverlay.value && !libraryCollapsed.value ? h('button', {
          type: 'button',
          class: 'crossword-library-scrim',
          'aria-label': 'Close library',
          onClick: () => setLibraryCollapsed(true),
        }) : null,
        h(CrosswordLibrary, {
          ref: library,
          items: props.model.items,
          selectedId: selectedId.value,
          collapsed: libraryCollapsed.value,
          onToggleLibrary: () => setLibraryCollapsed(true),
          onSelect: selectItem,
          onOpenItem: () => { if (libraryOverlay.value) setLibraryCollapsed(true); },
        }, {
          footer: () => h('button', {
            type: 'button',
            class: 'quiet-button crossword-settings-button',
            disabled: true,
            title: 'Display settings are coming soon',
          }, ['Settings', h(Icon, { name: 'settings' })]),
        }),
        !libraryOverlay.value && !libraryCollapsed.value ? h('div', {
          class: 'crossword-library-resizer',
          role: 'separator',
          tabindex: 0,
          'aria-label': 'Resize library',
          'aria-orientation': 'vertical',
          'aria-valuemin': MIN_LIBRARY_WIDTH,
          'aria-valuemax': maxLibraryWidth(),
          'aria-valuenow': Math.round(currentLibraryWidth()),
          onPointerdown: beginLibraryResize,
          onPointermove: resizeLibraryFromPointer,
          onPointerup: endLibraryResize,
          onPointercancel: endLibraryResize,
          onKeydown: resizeLibraryFromKeyboard,
          onDblclick: resetLibraryWidth,
        }) : null,
        detail(),
      ]),
    ]);
  },
});
