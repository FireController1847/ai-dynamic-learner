import { EntryStatistics } from '../../components/entry-statistics.ts';
import { useStatisticsVisits } from '../../components/statistics-context.ts';
import { hasPuzzle } from './library-model.ts';
import type { CrosswordItem, LibraryItem, PuzzleTarget, Crossword as FeatureModel } from './library-model.ts';
import type { Puzzle } from './puzzle-model.ts';
import type { CrosswordLibraryHandle } from './library.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { LibraryEmptyState } from '../../components/library-empty-state.ts';
import { useLibrarySelection } from '../../components/use-library-selection.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { CrosswordLibrary } from './library.ts';
import { PuzzleForm, PuzzleSummary } from './puzzle-form.ts';
import { PuzzleGame } from './puzzle-game.ts';
import { DisplaySettings } from './display-settings.ts';
import { resolvedDisplayOptions } from './display-options.ts';
import { canMove, findItem, firstEntry, groupOptions, moveItem, saveCrossword } from './library-model.ts';

import {
  defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, ref,
} from 'vue';

export interface SetupTarget extends PuzzleTarget { parentName: string }

const MIN_LIBRARY_WIDTH = 248;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.crossword.library-width';

export const Crossword = defineComponent({
  name: 'Crossword',
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
    const library = ref<CrosswordLibraryHandle | null>(null);
    const showLibraryButton = ref<HTMLButtonElement | null>(null);
    const message = ref('');
    const settingsOpen = ref(false);
    const displayOptions = computed(() => resolvedDisplayOptions(props.model.display));
    let settingsTrigger: HTMLElement | null = null;

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
    useStatisticsVisits('crossword', () => selection.value?.item.id ?? null, () => setupTarget.value === null);

    onDeactivated(() => { settingsOpen.value = false; aiTarget.value = null; });

    function updateLibraryLayout(event: MediaQueryListEvent) {
      libraryOverlay.value = event.matches;
      libraryResizing.value = false;
      if (event.matches && selectedId.value) libraryCollapsed.value = true;
    }

    overlayQuery.addEventListener('change', updateLibraryLayout);
    onBeforeUnmount(() => overlayQuery.removeEventListener('change', updateLibraryLayout));

    function openSettings(trigger: EventTarget | null) {
      settingsTrigger = trigger instanceof HTMLElement ? trigger : null;
      settingsOpen.value = true;
    }

    async function closeSettings() {
      settingsOpen.value = false;
      await nextTick();
      if (settingsTrigger?.isConnected) settingsTrigger.focus();
    }

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

    function openNewCrossword(target: SetupTarget) {
      setupTarget.value = target;
      setupVersion.value += 1;
      message.value = '';
      if (libraryOverlay.value) libraryCollapsed.value = true;
    }

    function editCrossword(item: CrosswordItem) {
      if (!selection.value) return;
      const parentId = selection.value.parentId;
      openNewCrossword({
        itemId: item.id,
        parentId,
        parentName: parentId
          ? findItem(props.model.items, parentId)?.item.name ?? 'Top level'
          : 'Top level',
      });
    }

    async function cancelSetup() {
      setupTarget.value = null;
      await nextTick();
      if (workspaceHeading.value) workspaceHeading.value.focus();
      else if (libraryCollapsed.value) showLibraryButton.value?.focus();
      else library.value?.focusNewCrossword();
    }

    function completeSetup(name: string, puzzle: Puzzle) {
      if (!setupTarget.value) return;
      const item = saveCrossword(props.model.items, setupTarget.value, name, puzzle);
      selectedId.value = item.id;
      setupTarget.value = null;
      library.value?.reveal(item.id);
      message.value = `Saved ${item.name}.`;
      nextTick(() => workspaceHeading.value?.focus());
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
      if (neighbor && moveItem(
        props.model.items,
        item.id,
        neighbor.id,
        offset < 0 ? 'before' : 'after',
      )) {
        message.value = `Moved ${item.name} ${offset < 0 ? 'up' : 'down'}.`;
      }
    }

    function organizationControls(item: LibraryItem) {
      if (!selection.value) return null;
      return h('details', {
        key: `organization-${item.id}`,
        class: ['crossword-organization', { 'library-group-organization': item.kind === 'group' }],
        open: item.kind === 'group',
      }, [
        h('summary', { class: 'organization-summary' }, 'Location and order'),
        item.kind === 'group' ? h(EntryStatistics, { app: 'crossword', id: item.id }) : null,
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
      if (setupTarget.value) {
        const editingItem = findItem(props.model.items, setupTarget.value.itemId)?.item;
        return h('section', {
          class: 'crossword-detail',
          'aria-label': 'Crossword setup',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(PuzzleForm, {
            key: setupVersion.value,
            item: editingItem?.kind === 'crossword' ? editingItem : undefined,
            destination: setupTarget.value.parentName,
            save: completeSetup,
            onCancel: cancelSetup,
          }),
        ]);
      }

      const item = selection.value?.item;
      if (!item || item.kind === 'group') {
        return h('section', {
          class: 'crossword-detail',
          'aria-label': item ? 'Selected group' : 'Crossword workspace',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(LibraryEmptyState, {
            class: { 'has-organization': item !== undefined },
            icon: 'crossword',
            title: item?.name ?? 'Build your crossword library',
            description: item ? 'Create a crossword in this group, or select one from the Library.' : 'Add answers and clues, then organize your puzzles in groups.',
            actionLabel: 'New crossword',
            onCreate: () => openNewCrossword({ parentId: item?.id ?? null, parentName: item?.name ?? 'Top level' }),
          }),
          item ? organizationControls(item) : null,
          h('p', { class: 'visually-hidden', role: 'status' }, message.value),
        ]);
      }

      return h('section', {
        class: 'crossword-detail is-crossword',
        inert: libraryOverlay.value && !libraryCollapsed.value,
        'aria-label': 'Selected crossword',
      }, [
        h('header', { class: 'crossword-item-heading' }, [
          h('h2', { ref: workspaceHeading, tabindex: -1 }, item.name),
          h(EntryStatistics, { app: 'crossword', id: item.id }),
          h('p', 'Crossword'),
        ]),
        hasPuzzle(item)
          ? h(PuzzleGame, {
            key: item.id,
            item,
            options: displayOptions.value,
            onEdit: () => editCrossword(item),
          })
          : h(PuzzleSummary, {
            key: item.id,
            item,
            onEdit: () => editCrossword(item),
          }),
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
          onNewCrossword: openNewCrossword,
        }, {
          footer: () => h('button', {
            type: 'button',
            class: 'quiet-button crossword-settings-button',
            'aria-haspopup': 'dialog',
            onClick: (event: MouseEvent) => openSettings(event.currentTarget),
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
      settingsOpen.value ? h(DisplaySettings, {
        options: displayOptions.value,
        onUpdate: (options) => { props.model.display = options; },
        onClose: closeSettings,
      }) : null,
    ]);
  },
});
