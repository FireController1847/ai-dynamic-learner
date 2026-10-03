import type { DocumentTarget } from './library-model.ts';
import type { DocumentTypeId } from './document-types.ts';
import type { ImportedDocument } from './library.ts';
interface CreationTarget extends DocumentTarget { destination: string }
import type { NotebookLibraryHandle } from './library.ts';
import type { LibraryItem } from './library-model.ts';
import { TIPS_ACTION_EVENT, type TutorialRequest } from '../../core/tutorial.ts';
import type { Notebook as FeatureModel } from './library-model.ts';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { LibraryEmptyState } from '../../components/library-empty-state.ts';
import { useLibrarySelection } from '../../components/use-library-selection.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { DocumentBuilder } from './document-builder.ts';
import { getDocumentType } from './document-types.ts';
import { MarkdownEditor } from './markdown-editor.ts';
import { LinedEditor } from './lined-editor.ts';
import { GraphEditor } from './graph-editor.ts';
import { DisplaySettings } from './display-settings.ts';
import { resolvedNotebookDisplay, notebookDisplayStyles } from './display-options.ts';
import { NotebookLibrary } from './library.ts';
import {
  canMove, countDocuments, countItems, deleteItem, findItem, firstEntry, groupOptions, insertDocument,
  MAX_DOCUMENTS, MAX_ITEMS, moveItem,
} from './library-model.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue';

const MIN_LIBRARY_WIDTH = 248;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.notebook.library-width';

export const Notebook = defineComponent({
  name: 'Notebook',
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
        library.value?.reveal(id);
        if (libraryOverlay.value) libraryCollapsed.value = true;
      },
    });
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
      panelSelector: '.directory-panel',
      minWidth: MIN_LIBRARY_WIDTH,
      maxWidth: 640,
      minRemainingWidth: 320,
      fallbackWidth: 280,
      disabled: () => libraryOverlay.value || libraryCollapsed.value,
    });
    const library = ref<NotebookLibraryHandle | null>(null);
    const showLibraryButton = ref<HTMLButtonElement | null>(null);
    const message = ref('');
    const settingsOpen = ref(false);
    const settingsButton = ref<HTMLButtonElement | null>(null);
    const displayOptions = computed(() => resolvedNotebookDisplay(props.model.display));
    onDeactivated(() => { settingsOpen.value = false; });
    async function closeSettings() {
      settingsOpen.value = false;
      await nextTick();
      settingsButton.value?.focus();
    }

    const selection = computed(() => findItem(props.model.items, selectedId.value));

    watch(() => selection.value?.item, (item) => {
      if (item?.kind === 'document') props.model.lastSelectedDocumentId = item.id;
    }, { immediate: true });
    watch(() => findItem(props.model.items, props.model.lastSelectedDocumentId)?.item.kind, (kind) => {
      if (kind !== 'document' && props.model.lastSelectedDocumentId != null) {
        props.model.lastSelectedDocumentId = null;
      }
    }, { immediate: true });


    function updateLibraryLayout(event: MediaQueryListEvent) {
      libraryOverlay.value = event.matches;
      libraryResizing.value = false;
      if (event.matches && selectedId.value) setLibraryCollapsed(true);
    }

    overlayQuery.addEventListener('change', updateLibraryLayout);
    onBeforeUnmount(() => overlayQuery.removeEventListener('change', updateLibraryLayout));

    onMounted(() => {
      if (selectedId.value) library.value?.reveal(selectedId.value);
      window.addEventListener(TIPS_ACTION_EVENT, handleTipsAction);
    });
    onBeforeUnmount(() => {
      window.removeEventListener(TIPS_ACTION_EVENT, handleTipsAction);
    });

    async function setLibraryCollapsed(collapsed: boolean) {
      libraryCollapsed.value = collapsed;
      await nextTick();
      if (collapsed) showLibraryButton.value?.focus();
      else library.value?.focusToggle();
    }

    function beginDocumentCreation() {
      const current = selection.value;
      let destination = 'Top level';
      if (current?.item.kind === 'group') destination = current.item.name;
      else if (current?.parentId) destination = findItem(props.model.items, current.parentId)?.item.name ?? 'Top level';
      creationTarget.value = { selectedId: selectedId.value, destination };
      message.value = '';
      if (libraryOverlay.value) setLibraryCollapsed(true);
    }

    async function cancelDocumentCreation() {
      creationTarget.value = null;
      await nextTick();
      if (libraryCollapsed.value) showLibraryButton.value?.focus();
      else library.value?.focusNewDocument();
    }

    function createDocument(type: DocumentTypeId) {
      if (!getDocumentType(type)?.available) return;
      if (countItems(props.model.items) >= MAX_ITEMS) {
        message.value = `The Notebook limit is ${MAX_ITEMS} groups and documents.`;
        return;
      }
      if (countDocuments(props.model.items) >= MAX_DOCUMENTS) {
        message.value = `The Notebook limit is ${MAX_DOCUMENTS} documents.`;
        return;
      }

      let item;
      try { item = insertDocument(props.model.items, creationTarget.value, type); }
      catch (error) { message.value = error instanceof Error ? error.message : String(error); return; }
      selectedId.value = item.id;
      creationTarget.value = null;
      library.value?.reveal(item.id);
      nextTick(() => library.value?.beginRename(item.id));
    }

    function importDocument(contents: ImportedDocument, target: DocumentTarget | null) {
      const item = insertDocument(props.model.items, target, 'markdown');
      item.name = contents.name;
      if (item.type === 'markdown') item.data.markdown = contents.markdown;
      selectedId.value = item.id;
      creationTarget.value = null;
      library.value?.reveal(item.id);
      if (libraryOverlay.value) setLibraryCollapsed(true);
    }

    async function restoreTipsState(previous: { selectedId: string | null; lastSelectedDocumentId: string | null; creationTarget: CreationTarget | null; libraryCollapsed: boolean }, temporaryId: string | null = null) {
      if (temporaryId) deleteItem(props.model.items, temporaryId);
      creationTarget.value = previous.creationTarget;
      const previousSelection = previous.selectedId && findItem(props.model.items, previous.selectedId);
      selectedId.value = previousSelection ? previous.selectedId : null;
      libraryCollapsed.value = previous.libraryCollapsed;
      await nextTick();
      const remembered = findItem(props.model.items, previous.lastSelectedDocumentId);
      props.model.lastSelectedDocumentId = remembered?.item.kind === 'document'
        ? previous.lastSelectedDocumentId : null;
    }

    async function prepareTipsAction(action: string) {
      const previous = {
        selectedId: selectedId.value,
        lastSelectedDocumentId: props.model.lastSelectedDocumentId ?? null,
        creationTarget: creationTarget.value,
        libraryCollapsed: libraryCollapsed.value,
      };

      if (action === 'creation') {
        beginDocumentCreation();
        await nextTick();
        return () => restoreTipsState(previous);
      }

      if (action === 'markdown' || action === 'lined') {
        const item = insertDocument(props.model.items, { selectedId: null }, action);
        item.name = 'Lorem ipsum';
        if (item.type === 'markdown') item.data.markdown = '# Lorem ipsum\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n## Dolor sit amet\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
        if (item.type === 'lined') {
          item.name = 'Lined Paper example';
          item.data.title = 'A thought to keep';
          item.data.marginText = '1\n2\n3';
          item.data.text = Array.from({ length: 45 }, (_, index) => `Note ${index + 1}: A little space to think and learn.`).join('\n');
        }
        creationTarget.value = null;
        selectedId.value = item.id;
        if (libraryOverlay.value) libraryCollapsed.value = true;
        library.value?.reveal(item.id);
        await nextTick();
        return () => restoreTipsState(previous, item.id);
      }

      throw new Error('Unknown Notebook tutorial action.');
    }

    function handleTipsAction(event: CustomEvent<TutorialRequest>) {
      const detail = event.detail;
      if (detail?.featureId !== 'notebook') return;
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
      if (neighbor && moveItem(props.model.items, item.id, neighbor.id, offset < 0 ? 'before' : 'after')) {
        message.value = `Moved ${item.name} ${offset < 0 ? 'up' : 'down'}.`;
      }
    }

    function organizationControls(item: LibraryItem) {
      if (!selection.value) return null;
      return h('details', {
        key: `organization-${item.id}`,
        class: ['item-organization', { 'library-group-organization': item.kind === 'group' }],
        open: item.kind === 'group',
      }, [
        h('summary', { class: 'organization-summary' }, 'Location and order'),
        h('div', { class: 'item-location' }, [
          h('label', { for: 'notebook-parent' }, 'Move to group'),
          h('select', {
            id: 'notebook-parent',
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
        h('div', { class: 'item-order-actions' }, [
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

    return () => h('section', {
      class: 'notebook-page',
      style: notebookDisplayStyles(displayOptions.value),
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
        class: ['notebook-layout', {
          'library-collapsed': libraryCollapsed.value,
          'library-resizing': libraryResizing.value,
        }],
        style: libraryWidth.value === null ? null : { '--library-width': `${libraryWidth.value}px` },
      }, [
        libraryCollapsed.value ? h('button', {
          ref: showLibraryButton,
          type: 'button',
          class: 'icon-button library-floating-toggle',
          title: 'Show library',
          'aria-label': 'Show library',
          'aria-expanded': false,
          'aria-controls': 'notebook-library',
          onClick: () => setLibraryCollapsed(false),
        }, [h(Icon, { name: 'panel-open' })]) : null,
        libraryOverlay.value && !libraryCollapsed.value ? h('button', {
          type: 'button',
          class: 'library-scrim',
          'aria-label': 'Close library',
          onClick: () => setLibraryCollapsed(true),
        }) : null,
        h(NotebookLibrary, {
          ref: library,
          items: props.model.items,
          selectedId: selectedId.value,
          collapsed: libraryCollapsed.value,
          importDocument,
          onToggleLibrary: () => setLibraryCollapsed(true),
          onSelect: (id) => { selectedId.value = id; creationTarget.value = null; message.value = ''; },
          onOpenItem: () => { if (libraryOverlay.value) setLibraryCollapsed(true); },
          onNewDocument: beginDocumentCreation,
        }, {
          footer: () => h('button', {
            ref: settingsButton,
            type: 'button',
            class: 'quiet-button library-settings-button',
            onClick: () => { settingsOpen.value = true; },
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
        creationTarget.value ? h('section', {
          class: 'notebook-detail notebook-builder-detail',
          'aria-label': 'Create document',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(DocumentBuilder, {
            destination: creationTarget.value.destination,
            onCreate: createDocument,
            onCancel: cancelDocumentCreation,
          }),
          message.value ? h('p', { class: 'notebook-builder-error', role: 'alert' }, message.value) : null,
        ]) : h('section', {
          class: ['notebook-detail', { 'is-document': selection.value?.item.kind === 'document' }],
          'aria-label': selection.value ? 'Selected item' : 'Notebook getting started',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          selection.value?.item.kind === 'document' ? h('header', { class: 'item-heading' }, [
            h('h2', selection.value.item.name),
            h('p', { class: 'item-summary' }, 'Document'),
          ]) : null,
          selection.value?.item.kind === 'document'
            ? selection.value.item.type === 'markdown'
              ? h(MarkdownEditor, {
                key: selection.value.item.id,
                document: selection.value.item,
              })
              : selection.value.item.type === 'lined'
                ? h(LinedEditor, {
                  key: selection.value.item.id,
                  document: selection.value.item,
                  options: displayOptions.value.lined,
                })
                : h(GraphEditor, {
                  key: selection.value.item.id,
                  document: selection.value.item,
                  options: displayOptions.value.graph,
                })
            : h(LibraryEmptyState, {
              class: { 'has-organization': selection.value !== null },
              icon: 'document',
              title: selection.value?.item.name ?? 'Build your notebook library',
              description: selection.value ? 'Create a document in this group, or select one from the Library.' : 'Create a document and organize your notes in groups.',
              actionLabel: 'New document',
              onCreate: beginDocumentCreation,
            }),
          selection.value ? organizationControls(selection.value.item) : null,
          h('p', { class: 'visually-hidden', role: 'status' }, message.value),
        ]),
      ]),
      settingsOpen.value ? h(DisplaySettings, {
        options: displayOptions.value,
        initialTab: selection.value?.item.kind === 'document' ? selection.value.item.type : 'lined',
        onUpdate: (options) => { props.model.display = options; },
        onClose: closeSettings,
      }) : null,
    ]);
  },
});
