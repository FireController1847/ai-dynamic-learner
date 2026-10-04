import { hasPuzzle } from './library-model.ts';
import type { PuzzleTarget, WordSearchItem } from './library-model.ts';
import type { Puzzle } from './puzzle-model.ts';
export interface SetupTarget extends PuzzleTarget { parentName: string }
import type { WordSearchLibraryHandle } from './library.ts';
import type { LibraryItem } from './library-model.ts';
import { addTutorialActionListener, type TutorialRequest } from '../../../packages/tips/src/index.ts';
import type { WordSearch as FeatureModel } from './library-model.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { LibraryEmptyState } from '../../components/library-empty-state.ts';
import { useLibrarySelection } from '../../components/use-library-selection.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { WordSearchLibrary } from './library.ts';
import { PuzzleForm, PuzzleSummary } from './puzzle-form.ts';
import { PuzzleGame } from './puzzle-game.ts';
import { DisplaySettings } from './display-settings.ts';
import { resolvedDisplayOptions } from './display-options.ts';
import { canMove, deleteItem, findItem, firstEntry, groupOptions, moveItem, saveWordSearch } from './library-model.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

const MIN_LIBRARY_WIDTH = 248;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.word-search.library-width';

export const WordSearch = defineComponent({
  name: 'WordSearch',
  props: {
    title: { type: String, required: true },
    model: { type: Object as PropType<FeatureModel>, required: true },
  },
  setup(props) {
    const setupTarget = ref<SetupTarget | null>(null);
    const selectedId = useLibrarySelection({
      firstId: () => firstEntry(props.model.items)?.id ?? null,
      hasItem: (id) => findItem(props.model.items, id) !== null,
      enabled: () => setupTarget.value === null,
      onAutoSelect: (id) => {
        library.value?.reveal(id);
        if (libraryOverlay.value) libraryCollapsed.value = true;
      },
    });
    const setupVersion = ref(0);
    const workspaceHeading = ref<HTMLElement | null>(null);
    const overlayQuery = window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const libraryOverlay = ref(overlayQuery.matches);
    const libraryCollapsed = ref(overlayQuery.matches && selectedId.value !== null);
    const layout = ref<HTMLElement | null>(null);
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
      panelSelector: '.word-search-library',
      minWidth: MIN_LIBRARY_WIDTH,
      maxWidth: 640,
      minRemainingWidth: 320,
      fallbackWidth: 280,
      disabled: () => libraryOverlay.value || libraryCollapsed.value,
    });
    const library = ref<WordSearchLibraryHandle | null>(null);
    const showLibraryButton = ref<HTMLButtonElement | null>(null);
    const message = ref('');
    const settingsOpen = ref(false);
    const displayOptions = computed(() => resolvedDisplayOptions(props.model.display));
    let settingsTrigger: HTMLElement | null = null;
    onDeactivated(() => { settingsOpen.value = false; });

    function openSettings(trigger: EventTarget | null) {
      settingsTrigger = trigger instanceof HTMLElement ? trigger : null;
      settingsOpen.value = true;
    }

    async function closeSettings() {
      settingsOpen.value = false;
      await nextTick();
      if (settingsTrigger?.isConnected) settingsTrigger.focus();
    }

    const selection = computed(() => findItem(props.model.items, selectedId.value));

    function updateLibraryLayout(event: MediaQueryListEvent) {
      libraryOverlay.value = event.matches;
      libraryResizing.value = false;
      if (event.matches && selectedId.value) libraryCollapsed.value = true;
    }
    overlayQuery.addEventListener('change', updateLibraryLayout);
    onBeforeUnmount(() => overlayQuery.removeEventListener('change', updateLibraryLayout));

    let removeTipsActionListener: (() => void) | null = null;

    onMounted(() => {
      removeTipsActionListener = addTutorialActionListener(handleTipsAction);
    });
    onBeforeUnmount(() => {
      removeTipsActionListener?.();
      removeTipsActionListener = null;
    });

    async function setLibraryCollapsed(collapsed: boolean) {
      libraryCollapsed.value = collapsed;
      await nextTick();
      if (collapsed) showLibraryButton.value?.focus();
      else library.value?.focusToggle();
    }

    function selectItem(id: string | null) {
      selectedId.value = id;
      setupTarget.value = null;
      message.value = '';
    }

    function openNewWordSearch(target: SetupTarget) {
      setupTarget.value = target;
      setupVersion.value += 1;
      message.value = '';
      if (libraryOverlay.value) libraryCollapsed.value = true;
    }

    function editWordSearch(item: WordSearchItem) {
      if (!selection.value) return;
      const parentId = selection.value.parentId;
      openNewWordSearch({
        itemId: item.id, parentId,
        parentName: parentId ? findItem(props.model.items, parentId)?.item.name ?? 'Top level' : 'Top level',
      });
    }

    async function cancelSetup() {
      setupTarget.value = null;
      await nextTick();
      if (workspaceHeading.value) workspaceHeading.value.focus();
      else if (libraryCollapsed.value) showLibraryButton.value?.focus();
      else library.value?.focusNewWordSearch();
    }

    function completeSetup(name: string, puzzle: Puzzle) {
      if (!setupTarget.value) return;
      const item = saveWordSearch(props.model.items, setupTarget.value, name, puzzle);
      selectedId.value = item.id;
      setupTarget.value = null;
      library.value?.reveal(item.id);
      message.value = `Saved ${item.name}.`;
      nextTick(() => workspaceHeading.value?.focus());
    }

    async function restoreTipsState(previous: { selectedId: string | null; setupTarget: SetupTarget | null; libraryCollapsed: boolean }, temporaryId: string | null = null) {
      if (temporaryId) deleteItem(props.model.items, temporaryId);
      setupTarget.value = previous.setupTarget;
      const previousSelection = previous.selectedId && findItem(props.model.items, previous.selectedId);
      selectedId.value = previousSelection ? previous.selectedId : null;
      libraryCollapsed.value = previous.libraryCollapsed;
      await nextTick();
    }

    async function prepareTipsAction(action: string) {
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

    function handleTipsAction(event: CustomEvent<TutorialRequest>) {
      const detail = event.detail;
      if (detail?.featureId !== 'word-search') return;
      detail.handled = true;
      prepareTipsAction(detail.action).then(detail.resolve, detail.reject);
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
        class: ['word-search-organization', { 'library-group-organization': item.kind === 'group' }],
        open: item.kind === 'group',
      }, [
        h('summary', { class: 'organization-summary' }, 'Location and order'),
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
              disabled: !canMove(props.model.items, item.id, group.id, 'inside'),
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
        const editingItem = findItem(props.model.items, setupTarget.value.itemId)?.item;
        return h('section', {
          class: 'word-search-detail', 'aria-label': 'Word search setup',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(PuzzleForm, {
            key: setupVersion.value,
            item: editingItem?.kind === 'word-search' ? editingItem : undefined,
            destination: setupTarget.value.parentName,
            save: completeSetup,
            onCancel: cancelSetup,
          }),
        ]);
      }

      const item = selection.value?.item;
      if (!item || item.kind === 'group') {
        return h('section', {
          class: 'word-search-detail', 'aria-label': item ? 'Selected group' : 'Word Search workspace',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(LibraryEmptyState, {
            class: { 'has-organization': item !== undefined },
            icon: 'word-search',
            title: item?.name ?? 'Build your word-search library',
            description: item ? 'Create a word search in this group, or select one from the Library.' : 'Make a word list, choose your settings, and organize your puzzles in groups.',
            actionLabel: 'New word search',
            onCreate: () => openNewWordSearch({ parentId: item?.id ?? null, parentName: item?.name ?? 'Top level' }),
          }),
          item ? organizationControls(item) : null,
          h('p', { class: 'visually-hidden', role: 'status' }, message.value),
        ]);
      }

      return h('section', {
        class: 'word-search-detail is-search',
        inert: libraryOverlay.value && !libraryCollapsed.value,
        'aria-label': 'Selected word search',
      }, [
        h('header', { class: 'word-search-item-heading' }, [
          h('h2', { ref: workspaceHeading, tabindex: -1 }, item.name),
          h('p', 'Word search'),
        ]),
        hasPuzzle(item)
          ? h(PuzzleGame, { key: item.id, item, options: displayOptions.value, onEdit: () => editWordSearch(item) })
          : h(PuzzleSummary, { key: item.id, item, onEdit: () => editWordSearch(item) }),
        organizationControls(item),
        h('p', { class: 'visually-hidden', role: 'status' }, message.value),
      ]);
    }

    return () => h('section', {
      class: 'word-search-page',
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
            onClick: (event: MouseEvent) => openSettings(event.currentTarget),
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
});
