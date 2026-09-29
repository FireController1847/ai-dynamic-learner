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
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { DocumentBuilder } from './document-builder.ts';
import { getDocumentType } from './document-types.ts';
import { MarkdownEditor } from './markdown-editor.ts';
import { NotebookLibrary } from './library.ts';
import {
  canMove, countDocuments, countItems, deleteItem, findItem, groupOptions, insertDocument,
  MAX_DOCUMENTS, MAX_ITEMS, moveItem,
} from './library-model.ts';

import { defineComponent, type PropType, computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const MIN_LIBRARY_WIDTH = 248;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.notebook.library-width';

export const Notebook = defineComponent({
  name: 'Notebook',
  props: {
    title: { type: String, required: true },
    model: { type: Object as PropType<FeatureModel>, required: true },
  },
  setup(props) {
    const remembered = findItem(props.model.items, props.model.lastSelectedDocumentId);
    const selectedId = ref(remembered?.item.kind === 'document' ? remembered.item.id : null);
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
    const creationTarget = ref<CreationTarget | null>(null);
    const message = ref('');

    const selection = computed(() => findItem(props.model.items, selectedId.value));

    watch(() => selection.value?.item, (item) => {
      if (item?.kind === 'document') props.model.lastSelectedDocumentId = item.id;
    });
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

      if (action === 'markdown') {
        const item = insertDocument(props.model.items, { selectedId: null }, 'markdown');
        item.name = 'Lorem ipsum';
        if (item.type === 'markdown') item.data.markdown = '# Lorem ipsum\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n## Dolor sit amet\n\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
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
        class: 'item-organization',
        open: item.kind === 'group',
      }, [
        h('summary', 'Location and order'),
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
            type: 'button',
            class: 'quiet-button library-settings-button notebook-coming-control',
            'aria-disabled': true,
            'aria-describedby': 'notebook-coming-settings',
          }, ['Settings', h(Icon, { name: 'settings' }), h('span', {
            id: 'notebook-coming-settings', class: 'notebook-coming-tooltip', role: 'tooltip',
          }, 'Coming soon!')]),
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
        ]) : selection.value ? h('section', {
          class: ['notebook-detail', { 'is-document': selection.value.item.kind === 'document' }],
          'aria-label': 'Selected item',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h('header', { class: 'item-heading' }, [
            h('h2', selection.value.item.name),
            h('p', { class: 'item-summary' }, selection.value.item.kind === 'group'
              ? `Group · ${selection.value.item.children.length} items`
              : 'Document'),
          ]),
          selection.value.item.kind === 'document'
            ? selection.value.item.type === 'markdown'
              ? h(MarkdownEditor, {
                key: selection.value.item.id,
                document: selection.value.item,
              })
              : h('div', { class: 'notebook-editor-scaffold' }, [
                h('article', { class: 'notebook-document-surface', 'aria-label': 'Document editor scaffold' }, [
                  h('span', { class: 'notebook-document-label' }, getDocumentType(selection.value.item.type)?.label ?? 'Document'),
                  h('h3', selection.value.item.name),
                  h('p', `${getDocumentType(selection.value.item.type)?.label ?? 'Document'} editing will be added here.`),
                ]),
              ])
            : null,
          organizationControls(selection.value.item),
          h('p', { class: 'visually-hidden', role: 'status' }, message.value),
        ]) : h('section', {
          class: 'notebook-empty-state',
          'aria-label': 'Notebook getting started',
          inert: libraryOverlay.value && !libraryCollapsed.value,
        }, [
          h(Icon, { name: 'document' }),
          h('h2', 'Create a document to begin'),
          h('p', 'Use the document button in the Library to start a new note.'),
        ]),
      ]),
    ]);
  },
});
