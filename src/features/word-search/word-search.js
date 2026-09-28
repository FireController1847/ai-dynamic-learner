import { Icon } from '../../components/icon.js';
import { WordSearchLibrary } from './library.js';
import { PuzzleForm, PuzzleSummary } from './puzzle-form.js';
import { canMove, findItem, groupOptions, moveItem, saveWordSearch } from './library-model.js';
import { clearPreference, readNumberPreference, writeNumberPreference } from '../../core/ui-preferences.js';

const { computed, h, nextTick, onBeforeUnmount, onMounted, ref } = window.Vue;

const MIN_LIBRARY_WIDTH = 248;
const MAX_LIBRARY_WIDTH = 640;
const MIN_DETAIL_WIDTH = 320;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.word-search.library-width';

export const WordSearch = {
  name: 'WordSearch',
  props: {
    title: { type: String, required: true },
    model: { type: Object, required: true },
  },
  setup(props) {
    const selectedId = ref(null);
    const setupTarget = ref(null);
    const setupVersion = ref(0);
    const workspaceHeading = ref(null);
    const overlayQuery = window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const libraryOverlay = ref(overlayQuery.matches);
    const libraryCollapsed = ref(false);
    const libraryWidth = ref(readNumberPreference(LIBRARY_WIDTH_KEY));
    const libraryResizing = ref(false);
    const layout = ref(null);
    const library = ref(null);
    const showLibraryButton = ref(null);
    const message = ref('');

    const selection = computed(() => findItem(props.model.items, selectedId.value));

    function updateLibraryLayout(event) {
      libraryOverlay.value = event.matches;
      libraryResizing.value = false;
      if (event.matches && selectedId.value) libraryCollapsed.value = true;
    }
    overlayQuery.addEventListener('change', updateLibraryLayout);
    onBeforeUnmount(() => overlayQuery.removeEventListener('change', updateLibraryLayout));

    function maxLibraryWidth() {
      const available = layout.value?.clientWidth ?? (MAX_LIBRARY_WIDTH + MIN_DETAIL_WIDTH);
      return Math.max(MIN_LIBRARY_WIDTH, Math.min(MAX_LIBRARY_WIDTH, available - MIN_DETAIL_WIDTH));
    }

    function currentLibraryWidth() {
      return libraryWidth.value ??
        layout.value?.querySelector('.word-search-library')?.getBoundingClientRect().width ??
        280;
    }

    function setLibraryWidth(width) {
      libraryWidth.value = Math.round(Math.min(Math.max(width, MIN_LIBRARY_WIDTH), maxLibraryWidth()));
      writeNumberPreference(LIBRARY_WIDTH_KEY, libraryWidth.value);
    }

    function resetLibraryWidth() {
      clearPreference(LIBRARY_WIDTH_KEY);
      libraryWidth.value = null;
    }

    function keepLibraryWidthInBounds() {
      if (libraryWidth.value !== null) setLibraryWidth(libraryWidth.value);
    }

    function beginLibraryResize(event) {
      if (event.button !== 0 || libraryOverlay.value || libraryCollapsed.value) return;
      event.preventDefault();
      libraryResizing.value = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeLibraryFromPointer(event);
    }

    function resizeLibraryFromPointer(event) {
      if (!libraryResizing.value || !layout.value) return;
      const bounds = layout.value.getBoundingClientRect();
      setLibraryWidth(event.clientX - bounds.left);
    }

    function endLibraryResize(event) {
      libraryResizing.value = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    function resizeLibraryFromKeyboard(event) {
      const step = event.shiftKey ? 48 : 16;
      let width = currentLibraryWidth();
      if (event.key === 'ArrowLeft') width -= step;
      else if (event.key === 'ArrowRight') width += step;
      else if (event.key === 'Home') width = MIN_LIBRARY_WIDTH;
      else if (event.key === 'End') width = maxLibraryWidth();
      else return;
      event.preventDefault();
      setLibraryWidth(width);
    }

    onMounted(() => {
      keepLibraryWidthInBounds();
      window.addEventListener('resize', keepLibraryWidthInBounds);
    });
    onBeforeUnmount(() => window.removeEventListener('resize', keepLibraryWidthInBounds));

    async function setLibraryCollapsed(collapsed) {
      libraryCollapsed.value = collapsed;
      await nextTick();
      if (collapsed) showLibraryButton.value?.focus();
      else library.value?.focusToggle();
    }

    function selectItem(id) {
      selectedId.value = id;
      setupTarget.value = null;
      message.value = '';
    }

    function openNewWordSearch(target) {
      setupTarget.value = target;
      setupVersion.value += 1;
      message.value = '';
      if (libraryOverlay.value) libraryCollapsed.value = true;
    }

    function editWordSearch(item) {
      const parentId = selection.value.parentId;
      openNewWordSearch({
        itemId: item.id, parentId,
        parentName: parentId ? findItem(props.model.items, parentId).item.name : 'Top level',
      });
    }

    async function cancelSetup() {
      setupTarget.value = null;
      await nextTick();
      if (workspaceHeading.value) workspaceHeading.value.focus();
      else if (libraryCollapsed.value) showLibraryButton.value?.focus();
      else library.value?.focusNewWordSearch();
    }

    function completeSetup(name, puzzle) {
      const item = saveWordSearch(props.model.items, setupTarget.value, name, puzzle);
      selectedId.value = item.id;
      setupTarget.value = null;
      library.value?.reveal(item.id);
      message.value = `Saved ${item.name}.`;
      nextTick(() => workspaceHeading.value?.focus());
    }

    function moveToGroup(event) {
      const targetId = event.target.value || null;
      if (moveItem(props.model.items, selectedId.value, targetId, 'inside')) {
        library.value?.reveal(selectedId.value);
        message.value = `Moved ${selection.value.item.name}.`;
      }
    }

    function reorder(offset) {
      const { siblings, index, item } = selection.value;
      const neighbor = siblings[index + offset];
      if (neighbor && moveItem(props.model.items, item.id, neighbor.id,
          offset < 0 ? 'before' : 'after')) {
        message.value = `Moved ${item.name} ${offset < 0 ? 'up' : 'down'}.`;
      }
    }

    function organizationControls(item) {
      return h('details', { class: 'word-search-organization', open: item.kind === 'group' }, [
        h('summary', 'Location and order'),
        h('div', { class: 'word-search-location' }, [
          h('label', { for: 'word-search-parent' }, 'Move to group'),
          h('select', {
            id: 'word-search-parent',
            value: selection.value.parentId ?? '',
            onChange: moveToGroup,
          }, [
            h('option', { value: '' }, 'Top level'),
            ...groupOptions(props.model.items, selectedId.value).map((group) => h('option', {
              key: group.id,
              value: group.id,
              disabled: !canMove(props.model.items, selectedId.value, group.id, 'inside'),
            }, group.label)),
          ]),
        ]),
        h('div', { class: 'word-search-order-actions' }, [
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
      if (setupTarget.value) {
        return h('section', {
          class: 'word-search-detail', 'aria-label': 'Word search setup',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(PuzzleForm, {
            key: setupVersion.value,
            item: setupTarget.value.itemId ? findItem(props.model.items, setupTarget.value.itemId)?.item : null,
            destination: setupTarget.value.parentName,
            save: completeSetup,
            onCancel: cancelSetup,
          }),
        ]);
      }

      const item = selection.value?.item;
      if (!item) {
        return h('section', {
          class: 'word-search-detail', 'aria-label': 'Word Search workspace',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h('div', { class: 'word-search-placeholder' }, [
            h(Icon, { name: 'word-search' }),
            h('h2', 'Build your word-search library'),
            h('p', 'Make a word list around a topic you love, choose your settings, and keep everything organized in groups.'),
            h('button', {
              type: 'button', class: 'card-primary-button',
              onClick: () => openNewWordSearch({ parentId: null, parentName: 'Top level' }),
            }, 'New word search'),
          ]),
        ]);
      }

      return h('section', {
        class: 'word-search-detail',
        inert: libraryOverlay.value && !libraryCollapsed.value,
        'aria-label': item.kind === 'group' ? 'Selected group' : 'Selected word search',
      }, [
        h('header', { class: 'word-search-item-heading' }, [
          h('h2', { ref: workspaceHeading, tabindex: -1 }, item.name),
          h('p', item.kind === 'group'
            ? `Group · ${item.children.length} items`
            : 'Word search'),
        ]),
        item.kind === 'word-search' ? h(PuzzleSummary, {
          item, onEdit: () => editWordSearch(item),
        }) : h('div', { class: 'word-search-group-message' }, [
          h('p', 'This group can contain nested groups and word searches.'),
        ]),
        organizationControls(item),
        h('p', { class: 'visually-hidden', role: 'status' }, message.value),
      ]);
    }

    return () => h('section', {
      class: 'word-search-page',
      'aria-label': props.title,
      onKeydown: (event) => {
        if (event.key === 'Escape' && libraryOverlay.value && !libraryCollapsed.value &&
            !event.target.closest('dialog')) {
          event.preventDefault();
          setLibraryCollapsed(true);
        }
      },
    }, [
      h('div', {
        ref: layout,
        class: ['word-search-layout', {
          'library-collapsed': libraryCollapsed.value,
          'library-resizing': libraryResizing.value,
        }],
        style: libraryWidth.value === null ? null : {
          '--word-search-library-width': `${libraryWidth.value}px`,
        },
      }, [
        libraryCollapsed.value ? h('button', {
          ref: showLibraryButton,
          type: 'button',
          class: 'icon-button word-search-library-floating-toggle',
          title: 'Show library',
          'aria-label': 'Show library',
          'aria-expanded': false,
          'aria-controls': 'word-search-library',
          onClick: () => setLibraryCollapsed(false),
        }, [h(Icon, { name: 'panel-open' })]) : null,
        libraryOverlay.value && !libraryCollapsed.value ? h('button', {
          type: 'button',
          class: 'word-search-library-scrim',
          'aria-label': 'Close library',
          onClick: () => setLibraryCollapsed(true),
        }) : null,
        h(WordSearchLibrary, {
          ref: library,
          items: props.model.items,
          selectedId: selectedId.value,
          collapsed: libraryCollapsed.value,
          onToggleLibrary: () => setLibraryCollapsed(true),
          onSelect: selectItem,
          onOpenItem: () => { if (libraryOverlay.value) setLibraryCollapsed(true); },
          onNewWordSearch: openNewWordSearch,
        }),
        !libraryOverlay.value && !libraryCollapsed.value ? h('div', {
          class: 'word-search-library-resizer',
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
};
