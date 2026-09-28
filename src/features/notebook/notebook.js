import { Icon } from '../../components/icon.js';
import { clearPreference, readNumberPreference, writeNumberPreference } from '../../core/ui-preferences.js';
import { DisplaySettings } from './display-settings.js';
import { NotebookLibrary } from './library.js';
import { canMove, findItem, groupOptions, moveItem } from './library-model.js';

const { computed, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } = window.Vue;

const MIN_LIBRARY_WIDTH = 248;
const MAX_LIBRARY_WIDTH = 640;
const MIN_DETAIL_WIDTH = 320;
const LIBRARY_WIDTH_KEY = 'dynamic-learner.ui.notebook.library-width';

export const Notebook = {
  name: 'Notebook',
  props: {
    title: { type: String, required: true },
    model: { type: Object, required: true },
  },
  setup(props) {
    const remembered = findItem(props.model.items, props.model.lastSelectedDocumentId);
    const selectedId = ref(remembered?.item.kind === 'document' ? remembered.item.id : null);
    const overlayQuery = window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const libraryOverlay = ref(overlayQuery.matches);
    const libraryCollapsed = ref(overlayQuery.matches && selectedId.value !== null);
    const libraryWidth = ref(readNumberPreference(LIBRARY_WIDTH_KEY));
    const libraryResizing = ref(false);
    const layout = ref(null);
    const library = ref(null);
    const showLibraryButton = ref(null);
    const settingsButton = ref(null);
    const settingsOpen = ref(false);
    const message = ref('');

    const selection = computed(() => findItem(props.model.items, selectedId.value));

    watch(() => selection.value?.item, (item) => {
      if (item?.kind === 'document') props.model.lastSelectedDocumentId = item.id;
    });

    onDeactivated(() => { settingsOpen.value = false; });

    function updateLibraryLayout(event) {
      libraryOverlay.value = event.matches;
      libraryResizing.value = false;
      if (event.matches && selectedId.value) setLibraryCollapsed(true);
    }

    overlayQuery.addEventListener('change', updateLibraryLayout);
    onBeforeUnmount(() => overlayQuery.removeEventListener('change', updateLibraryLayout));

    function maxLibraryWidth() {
      const available = layout.value?.clientWidth ?? (MAX_LIBRARY_WIDTH + MIN_DETAIL_WIDTH);
      return Math.max(MIN_LIBRARY_WIDTH, Math.min(MAX_LIBRARY_WIDTH, available - MIN_DETAIL_WIDTH));
    }

    function currentLibraryWidth() {
      return libraryWidth.value ??
        layout.value?.querySelector('.directory-panel')?.getBoundingClientRect().width ??
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
      if (selectedId.value) library.value?.reveal(selectedId.value);
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

    async function closeSettings() {
      settingsOpen.value = false;
      await nextTick();
      settingsButton.value?.focus();
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
      if (neighbor && moveItem(props.model.items, item.id, neighbor.id, offset < 0 ? 'before' : 'after')) {
        message.value = `Moved ${item.name} ${offset < 0 ? 'up' : 'down'}.`;
      }
    }

    function organizationControls(item) {
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
              disabled: !canMove(props.model.items, selectedId.value, group.id, 'inside'),
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
          onToggleLibrary: () => setLibraryCollapsed(true),
          onSelect: (id) => { selectedId.value = id; message.value = ''; },
          onOpenItem: () => { if (libraryOverlay.value) setLibraryCollapsed(true); },
        }, {
          footer: () => h('button', {
            ref: settingsButton,
            type: 'button',
            class: 'quiet-button library-settings-button',
            'aria-haspopup': 'dialog',
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
        selection.value ? h('section', {
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
            ? h('div', { class: 'notebook-editor-scaffold' }, [
              h('article', { class: 'notebook-document-surface', 'aria-label': 'Document editor scaffold' }, [
                h('span', { class: 'notebook-document-label' }, 'Document editor'),
                h('h3', selection.value.item.name),
                h('p', 'Rich Markdown editing will be added here.'),
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
      settingsOpen.value ? h(DisplaySettings, { onClose: closeSettings }) : null,
    ]);
  },
};
