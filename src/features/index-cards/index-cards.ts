import type { DirectoryTreeHandle } from './directory-tree.ts';
import type { LibraryItem, SetTarget } from './tree-model.ts';
import type { SetModeId } from './set-modes.ts';
interface CreationTarget extends SetTarget { destination: string }
import { addTutorialActionListener, type TutorialRequest } from '../../../packages/tips/src/index.ts';
import type { IndexCards as FeatureModel } from './tree-model.ts';
import { inputValue } from '../../core/dom.ts';
import { DirectoryTree } from './directory-tree.ts';
import { SetBuilder } from './set-builder.ts';
import { getSetMode } from './set-modes.ts';
import { CardSet } from './card-set.ts';
import { DisplaySettings } from './display-settings.ts';
import { defaultDisplayOptions, displayStyles } from './display-options.ts';
import { Icon } from '../../components/icon.ts';
import { LibraryEmptyState } from '../../components/library-empty-state.ts';
import { useLibrarySelection } from '../../components/use-library-selection.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { canMove, countCards, createItem, deleteItem, findItem, firstEntry, groupOptions, insertSet, moveItem } from './tree-model.ts';
import { createCard } from './card-model.ts';
import { clearPreference, readNumberPreference, writeNumberPreference } from '../../core/ui-preferences.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';

const MIN_LIBRARY_WIDTH = 248;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.index-cards.library-width';
const CARD_LIST_WIDTH_KEY = 'dynamic-learner.ui.index-cards.card-list-width';

export const IndexCards = defineComponent({
  name: 'IndexCards',
  props: {
    title: { type: String, required: true },
    model: { type: Object as PropType<FeatureModel>, required: true },
  },
  setup(props) {
    const creationTarget = ref<CreationTarget | null>(null);
    const selectedId = useLibrarySelection({
      firstId: () => firstEntry(props.model.items)?.id ?? null,
      hasItem: (id) => findItem(props.model.items, id) !== null,
      enabled: () => creationTarget.value === null,
      onAutoSelect: (id) => {
        tree.value?.reveal(id);
        if (libraryOverlay.value) libraryCollapsed.value = true;
      },
    });
    // Keep this breakpoint aligned with styles/mobile.css.
    const overlayQuery = window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const libraryOverlay = ref(overlayQuery.matches);
    const libraryCollapsed = ref(overlayQuery.matches && selectedId.value !== null);
    const cardListWidth = ref(readNumberPreference(CARD_LIST_WIDTH_KEY));
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
      panelSelector: '.directory-panel',
      minWidth: MIN_LIBRARY_WIDTH,
      maxWidth: 640,
      minRemainingWidth: 320,
      fallbackWidth: 280,
      disabled: () => libraryOverlay.value || libraryCollapsed.value,
    });
    function updateLibraryLayout(event: MediaQueryListEvent) {
      libraryOverlay.value = event.matches;
      libraryResizing.value = false;
      if (event.matches && selectedId.value) setLibraryCollapsed(true);
    }
    overlayQuery.addEventListener('change', updateLibraryLayout);
    onBeforeUnmount(() => overlayQuery.removeEventListener('change', updateLibraryLayout));
    const tree = ref<DirectoryTreeHandle | null>(null);
    const showLibraryButton = ref<HTMLButtonElement | null>(null);
    const message = ref('');
    const settingsOpen = ref(false);
    const tutorialReviewSetId = ref<string | null>(null);
    const settingsButton = ref<HTMLButtonElement | null>(null);
    const displayOptions = computed(() => props.model.display ?? defaultDisplayOptions());
    onDeactivated(() => { settingsOpen.value = false; });

    async function closeSettings() {
      settingsOpen.value = false;
      await nextTick();
      settingsButton.value?.focus();
    }
    const selection = computed(() => findItem(props.model.items, selectedId.value));
    const totalCards = computed(() => countCards(props.model.items));

    // Remember sets only; browsing a group must not replace the last opened set.
    watch(() => selection.value?.item, (item) => {
      if (item?.kind === 'set') props.model.lastSelectedSetId = item.id;
    }, { immediate: true });
    watch(() => findItem(props.model.items, props.model.lastSelectedSetId)?.item.kind, (kind) => {
      if (kind !== 'set' && props.model.lastSelectedSetId != null) {
        props.model.lastSelectedSetId = null;
      }
    }, { immediate: true });
    function setCardListWidth(width: number) {
      cardListWidth.value = width;
      writeNumberPreference(CARD_LIST_WIDTH_KEY, width);
    }

    function resetCardListWidth() {
      clearPreference(CARD_LIST_WIDTH_KEY);
      cardListWidth.value = null;
    }

    let removeTipsActionListener: (() => void) | null = null;

    onMounted(() => {
      if (selectedId.value) tree.value?.reveal(selectedId.value);
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
      else tree.value?.focusToggle();
    }

    function beginSetCreation() {
      const current = selection.value;
      let destination = 'Top level';
      if (current?.item.kind === 'group') destination = current.item.name;
      else if (current?.parentId) destination = findItem(props.model.items, current.parentId)?.item.name ?? 'Top level';
      creationTarget.value = { selectedId: selectedId.value, destination };
      message.value = '';
      if (libraryOverlay.value) setLibraryCollapsed(true);
    }

    async function cancelSetCreation() {
      creationTarget.value = null;
      await nextTick();
      if (libraryCollapsed.value) showLibraryButton.value?.focus();
      else tree.value?.focusNewSet();
    }

    function createSet(mode: SetModeId) {
      if (!getSetMode(mode)?.available) return;
      let item;
      try { item = insertSet(props.model.items, creationTarget.value, mode); }
      catch (error) { message.value = error instanceof Error ? error.message : String(error); return; }
      selectedId.value = item.id;
      creationTarget.value = null;
      tree.value?.reveal(item.id);
      nextTick(() => tree.value?.beginRename(item.id));
    }

    function moveToGroup(event: Event) {
      if (!selectedId.value || !selection.value) return;
      const targetId = inputValue(event) || null;
      if (moveItem(props.model.items, selectedId.value, targetId, 'inside')) {
        tree.value?.reveal(selectedId.value);
        message.value = `Moved ${selection.value.item.name}.`;
      }
    }

    function reorder(offset: number) {
      if (!selection.value) return;
      const { siblings, index, item } = selection.value;
      const neighbor = siblings[index + offset];
      if (neighbor && moveItem(props.model.items, item.id, neighbor.id, offset < 0 ? 'before' : 'after')) {
        message.value = `Moved ${item.name} ${offset < 0 ? 'up' : 'down'}.`;
      }
    }

    async function restoreTipsState(previous: { selectedId: string | null; lastSelectedSetId: string | null; creationTarget: CreationTarget | null; libraryCollapsed: boolean }, temporaryId: string) {
      if (temporaryId) deleteItem(props.model.items, temporaryId);
      if (tutorialReviewSetId.value === temporaryId) tutorialReviewSetId.value = null;
      const previousSelection = previous.selectedId && findItem(props.model.items, previous.selectedId);
      creationTarget.value = previous.creationTarget;
      selectedId.value = previousSelection ? previous.selectedId : null;
      libraryCollapsed.value = previous.libraryCollapsed;
      await nextTick();
      const remembered = findItem(props.model.items, previous.lastSelectedSetId);
      props.model.lastSelectedSetId = remembered?.item.kind === 'set'
        ? previous.lastSelectedSetId : null;
    }

    async function prepareTipsAction(action: string) {
      const previous = {
        selectedId: selectedId.value,
        lastSelectedSetId: props.model.lastSelectedSetId ?? null,
        creationTarget: creationTarget.value,
        libraryCollapsed: libraryCollapsed.value,
      };

      if (action === 'set') {
        creationTarget.value = null;
        const item = createItem('set');
        item.name = 'Lorem ipsum';
        props.model.items.unshift(item);
        selectedId.value = item.id;
        if (libraryOverlay.value) libraryCollapsed.value = true;
        tree.value?.reveal(item.id);
        await nextTick();
        return () => restoreTipsState(previous, item.id);
      }

      if (action === 'review') {
        creationTarget.value = null;
        const item = createItem('set');
        item.name = 'Lorem ipsum';
        item.cards.push(
          createCard({
            title: 'Lorem ipsum',
            front: 'Lorem ipsum dolor sit amet.',
            back: 'Consectetur adipiscing elit.',
          }),
          createCard({
            title: 'Dolor sit amet',
            front: 'Sed do eiusmod tempor incididunt.',
            back: 'Ut labore et dolore magna aliqua.',
          }),
          createCard({
            title: 'Magna aliqua',
            front: 'Ut enim ad minim veniam.',
            back: 'Quis nostrud exercitation ullamco.',
          }),
        );
        props.model.items.unshift(item);
        selectedId.value = item.id;
        if (libraryOverlay.value) libraryCollapsed.value = true;
        tree.value?.reveal(item.id);
        tutorialReviewSetId.value = item.id;
        await nextTick();
        return () => restoreTipsState(previous, item.id);
      }

      throw new Error('Unknown Index Cards tutorial action.');
    }

    function handleTipsAction(event: CustomEvent<TutorialRequest>) {
      const detail = event.detail;
      if (detail?.featureId !== 'index-cards') return;
      detail.handled = true;
      prepareTipsAction(detail.action).then(detail.resolve, detail.reject);
    }

    return () => h('section', {
      class: 'index-cards-page', 'aria-label': props.title, style: displayStyles(displayOptions.value),
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
        class: ['index-cards-layout', {
          'library-collapsed': libraryCollapsed.value,
          'library-resizing': libraryResizing.value,
        }],
        style: libraryWidth.value === null ? null : { '--library-width': `${libraryWidth.value}px` },
      }, [
        libraryCollapsed.value ? h('button', {
          ref: showLibraryButton, type: 'button', class: 'icon-button library-floating-toggle',
          title: 'Show library', 'aria-label': 'Show library',
          'aria-expanded': false, 'aria-controls': 'index-cards-library',
          onClick: () => setLibraryCollapsed(false),
        }, [h(Icon, { name: 'panel-open' })]) : null,
        libraryOverlay.value && !libraryCollapsed.value ? h('button', {
          type: 'button', class: 'library-scrim', 'aria-label': 'Close library',
          onClick: () => setLibraryCollapsed(true),
        }) : null,
        h(DirectoryTree, {
          ref: tree, items: props.model.items, selectedId: selectedId.value,
          collapsed: libraryCollapsed.value,
          onToggleLibrary: () => setLibraryCollapsed(true),
          onNewSet: beginSetCreation,
          onSelect: (id) => { selectedId.value = id; creationTarget.value = null; message.value = ''; },
          onOpenItem: () => { if (libraryOverlay.value) setLibraryCollapsed(true); },
        }, {
          footer: () => h('button', {
            ref: settingsButton, type: 'button', class: 'quiet-button library-settings-button',
            'aria-haspopup': 'dialog', onClick: () => { settingsOpen.value = true; },
          }, ['Settings', h(Icon, { name: 'settings' })]),
        }),
        !libraryOverlay.value && !libraryCollapsed.value ? h('div', {
          class: 'library-resizer',
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
        h('section', {
          class: ['index-cards-detail', { 'is-set': selection.value?.item.kind === 'set' }],
          'aria-label': creationTarget.value ? 'Choose an Index Cards mode' : selection.value ? 'Selected item' : 'Index Cards getting started',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          creationTarget.value ? h(SetBuilder, {
            destination: creationTarget.value.destination,
            onCreate: createSet,
            onCancel: cancelSetCreation,
          }) : null,
          !creationTarget.value && selection.value?.item.kind === 'set' ? h('header', { class: 'item-heading' }, [
            h('h2', selection.value.item.name),
            h('p', { class: 'item-summary' }, `${getSetMode(selection.value.item.mode)?.label ?? 'Flash Cards'} · ${selection.value.item.cards.length} cards`),
          ]) : null,
          !creationTarget.value && selection.value?.item.kind === 'set' ? h(CardSet, {
            key: selection.value.item.id,
            set: selection.value.item,
            totalCards: totalCards.value,
            cardListWidth: cardListWidth.value,
            tutorialReview: tutorialReviewSetId.value === selection.value.item.id,
            onResizeCardList: setCardListWidth,
            onResetCardList: resetCardListWidth,
          }) : !creationTarget.value ? h(LibraryEmptyState, {
            class: { 'has-organization': selection.value !== null },
            icon: 'cards',
            title: selection.value?.item.name ?? 'Build your index-card library',
            description: selection.value ? 'Create a set in this group, or select one from the Library.' : 'Create a set of cards and organize your sets in groups.',
            actionLabel: 'New set',
            onCreate: beginSetCreation,
          }) : null,
          !creationTarget.value && selection.value ? h('details', {
            key: `organization-${selection.value.item.id}`,
            class: ['item-organization', { 'library-group-organization': selection.value.item.kind === 'group' }],
            open: selection.value.item.kind === 'group',
          }, [
          h('summary', { class: 'organization-summary' }, 'Location and order'),
          h('div', { class: 'item-location' }, [
            h('label', { for: 'index-cards-parent' }, 'Move to group'),
            h('select', {
              id: 'index-cards-parent', value: selection.value.parentId ?? '', onChange: moveToGroup,
            }, [
              h('option', { value: '' }, 'Top level'),
              ...groupOptions(props.model.items, selectedId.value).map((group) => h('option', {
                key: group.id, value: group.id,
                disabled: !canMove(props.model.items, selection.value?.item.id ?? '', group.id, 'inside'),
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
          ]) : null,
          h('p', { class: 'visually-hidden', role: 'status' }, message.value),
        ]),
      ]),
      settingsOpen.value ? h(DisplaySettings, {
        options: displayOptions.value,
        onUpdate: (options) => { props.model.display = options; },
        onClose: closeSettings,
      }) : null,
    ]);
  },
});
