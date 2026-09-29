import { Icon } from '../../components/icon.js';
import { WordSearchLibrary } from './library.js';
import { PuzzleForm, PuzzleSummary } from './puzzle-form.js';
import { PuzzleGame } from './puzzle-game.js';
import { DisplaySettings } from './display-settings.js';
import { resolvedDisplayOptions } from './display-options.js';
import { canMove, deleteItem, findItem, groupOptions, moveItem, saveWordSearch } from './library-model.js';
import { clearPreference, readNumberPreference, writeNumberPreference } from '../../core/ui-preferences.js';

import { computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

const MIN_LIBRARY_WIDTH = 248;
const MAX_LIBRARY_WIDTH = 640;
const MIN_DETAIL_WIDTH = 320;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.word-search.library-width';
const TIPS_ACTION_EVENT = 'dynamic-learner:tips-action';

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
    const settingsOpen = ref(false);
    const displayOptions = computed(() => resolvedDisplayOptions(props.model.display));
    let settingsTrigger = null;
    onDeactivated(() => { settingsOpen.value = false; });

    function openSettings(trigger) {
      settingsTrigger = trigger;
      settingsOpen.value = true;
    }

    async function closeSettings() {
      settingsOpen.value = false;
      await nextTick();
      if (settingsTrigger?.isConnected) settingsTrigger.focus();
    }

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
      window.addEventListener(TIPS_ACTION_EVENT, handleTipsAction);
    });
    onBeforeUnmount(() => {
      window.removeEventListener('resize', keepLibraryWidthInBounds);
      window.removeEventListener(TIPS_ACTION_EVENT, handleTipsAction);
    });

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

    async function restoreTipsState(previous, temporaryId = null) {
      if (temporaryId) deleteItem(props.model.items, temporaryId);
      setupTarget.value = previous.setupTarget;
      const previousSelection = previous.selectedId && findItem(props.model.items, previous.selectedId);
      selectedId.value = previousSelection ? previous.selectedId : null;
      libraryCollapsed.value = previous.libraryCollapsed;
      await nextTick();
    }

    async function prepareTipsAction(action) {
      const previous = {
        selectedId: selectedId.value,
        setupTarget: setupTarget.value,
        libraryCollapsed: libraryCollapsed.value,
      };

      if (action === 'creation') {
        openNewWordSearch({ parentId: null, parentName: 'Top level' });
        await nextTick();
        return () => restoreTipsState(previous);
      }

      if (action === 'play') {
        const item = saveWordSearch(props.model.items, {
          parentId: null,
          parentName: 'Top level',
        }, 'Lorem ipsum', {
          words: ['LOREM', 'IPSUM', 'DOLOR', 'AMET'],
          size: 10,
          difficulty: 'easy',
          instructions: 'Lorem ipsum dolor sit amet.',
          studyMode: 'words',
          hints: {},
        });
        setupTarget.value = null;
        selectedId.value = item.id;
        if (libraryOverlay.value) libraryCollapsed.value = true;
        library.value?.reveal(item.id);
        await nextTick();
        return () => restoreTipsState(previous, item.id);
      }

      throw new Error('Unknown Word Search tutorial action.');
    }

    function handleTipsAction(event) {
      const detail = event.detail;
      if (detail?.featureId !== 'word-search') return;
      detail.handled = true;
      prepareTipsAction(detail.action).then(detail.resolve, detail.reject);
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
      return h('details', { key: `organization-${item.id}`, class: 'word-search-organization', open: item.kind === 'group' }, [
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
        class: ['word-search-detail', { 'is-search': item.kind === 'word-search' }],
        inert: libraryOverlay.value && !libraryCollapsed.value,
        'aria-label': item.kind === 'group' ? 'Selected group' : 'Selected word search',
      }, [
        h('header', { class: 'word-search-item-heading' }, [
          h('h2', { ref: workspaceHeading, tabindex: -1 }, item.name),
          h('p', item.kind === 'group'
            ? `Group · ${item.children.length} items`
            : 'Word search'),
        ]),
        item.kind === 'word-search' ? h(item.puzzle ? PuzzleGame : PuzzleSummary, {
          key: item.id, item, onEdit: () => editWordSearch(item),
          ...(item.puzzle ? { options: displayOptions.value } : {}),
        }) : null,
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
        }, {
          footer: () => h('button', {
            type: 'button', class: 'quiet-button word-search-settings-button', 'aria-haspopup': 'dialog',
            onClick: (event) => openSettings(event.currentTarget),
          }, ['Settings', h(Icon, { name: 'settings' })]),
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
      settingsOpen.value ? h(DisplaySettings, {
        options: displayOptions.value,
        onUpdate: (options) => { props.model.display = options; },
        onClose: closeSettings,
      }) : null,
    ]);
  },
};
