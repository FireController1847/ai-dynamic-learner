import { computed, defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch, type PropType } from 'vue';
import { DatedLibrary, type DatedLibraryHandle } from '../../components/dated-library.ts';
import { DatedLibrarySettingsFields } from '../../components/dated-library-settings-fields.ts';
import { DeleteConfirmation } from '../../components/delete-confirmation.ts';
import { Icon } from '../../components/icon.ts';
import { LibraryEmptyState } from '../../components/library-empty-state.ts';
import { PopupDialog } from '../../components/popup-dialog.ts';
import { useLibrarySelection } from '../../components/use-library-selection.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { defaultLibrarySettings, isArchived, orderedDatedItems } from '../../core/dated-library.ts';
import { createTaskSet, MAX_NAME_LENGTH, MAX_TASK_SETS, type SolveItGridModel } from './library-model.ts';
import { TaskSetBuilder, type TaskSetBuilderHandle, type TaskSetDraft } from './task-set-builder.ts';
import { TaskGrid } from './task-grid.ts';
import { taskCount } from './task-model.ts';

const MIN_LIBRARY_WIDTH = 280;

export const SolveItGrid = defineComponent({
  name: 'SolveItGrid',
  props: {
    title: { type: String, required: true },
    model: { type: Object as PropType<SolveItGridModel>, required: true },
  },
  setup(props) {
    const now = ref(Date.now());
    const settings = computed(() => props.model.settings ?? defaultLibrarySettings());
    const activeItems = computed(() => orderedDatedItems(props.model.items.filter(item => !isArchived(item, now.value, settings.value)), settings.value));
    const archivedItems = computed(() => orderedDatedItems(props.model.items.filter(item => isArchived(item, now.value, settings.value)), settings.value));
    const archiveOpen = ref(activeItems.value.length === 0 && archivedItems.value.length > 0);
    const visibleItems = computed(() => archiveOpen.value ? archivedItems.value : activeItems.value);
    const query = window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const overlay = ref(query.matches);
    const collapsed = ref(query.matches);
    const layout = ref<HTMLElement | null>(null);
    const detail = ref<HTMLElement | null>(null);
    const library = ref<DatedLibraryHandle | null>(null);
    const showLibrary = ref<HTMLButtonElement | null>(null);
    const settingsOpen = ref(false);
    const message = ref('');
    const builderMode = ref<'new' | 'edit' | null>(null);
    const builderSequence = ref(0);
    const builder = ref<TaskSetBuilderHandle | null>(null);
    const creationError = ref('');
    const pendingDelete = ref<string | null>(null);
    const selectedId = useLibrarySelection({
      firstId: () => visibleItems.value[0]?.id ?? null,
      hasItem: id => props.model.items.some(item => item.id === id),
      enabled: () => builderMode.value === null,
      onAutoSelect: () => { if (overlay.value) collapsed.value = true; },
    });
    const selected = computed(() => props.model.items.find(item => item.id === selectedId.value) ?? null);
    const panel = usePersistedPanelResize({
      preferenceKey: 'dynamic-learner.ui.solve-it-grid.library-width',
      container: layout, panelSelector: '.directory-panel',
      minWidth: MIN_LIBRARY_WIDTH, maxWidth: 600, minRemainingWidth: 320, fallbackWidth: 320,
      disabled: () => overlay.value || collapsed.value,
    });

    const refreshClock = () => { now.value = Date.now(); };
    let timer: number | null = null;
    function startClock() { refreshClock(); if (timer === null) timer = window.setInterval(refreshClock, 60_000); }
    function stopClock() { if (timer !== null) window.clearInterval(timer); timer = null; }
    function media(event: MediaQueryListEvent) {
      overlay.value = event.matches;
      panel.resizing.value = false;
      if (event.matches && selectedId.value) collapsed.value = true;
    }
    onMounted(() => {
      startClock();
      document.addEventListener('visibilitychange', refreshClock);
      query.addEventListener('change', media);
    });
    onActivated(() => {
      startClock();
      archiveOpen.value = activeItems.value.length === 0 && archivedItems.value.length > 0;
    });
    onDeactivated(() => { stopClock(); settingsOpen.value = false; panel.resizing.value = false; builderMode.value = null; pendingDelete.value = null; });
    onBeforeUnmount(() => {
      stopClock();
      document.removeEventListener('visibilitychange', refreshClock);
      query.removeEventListener('change', media);
    });
    watch(() => selected.value?.id, id => {
      if (id) props.model.lastSelectedTaskSetId = id;
      else if (props.model.lastSelectedTaskSetId && !props.model.items.some(item => item.id === props.model.lastSelectedTaskSetId)) {
        props.model.lastSelectedTaskSetId = null;
      }
    }, { immediate: true });
    watch(() => selected.value ? isArchived(selected.value, now.value, settings.value) : false, archived => {
      if (selected.value) archiveOpen.value = archived;
    });

    async function setCollapsed(value: boolean) {
      collapsed.value = value;
      await nextTick();
      if (value) showLibrary.value?.focus();
      else library.value?.focusToggle();
    }
    function canLeaveBuilder() { return builder.value?.canLeave() ?? true; }
    function create() {
      if (!canLeaveBuilder()) return;
      builderSequence.value++;
      builderMode.value = 'new'; creationError.value = ''; message.value = '';
      if (overlay.value) collapsed.value = true;
    }
    function edit() {
      if (!canLeaveBuilder()) return;
      builderMode.value = 'edit'; creationError.value = ''; message.value = '';
      if (overlay.value) collapsed.value = true;
    }
    async function save(draft: TaskSetDraft) {
      try {
        const item = builderMode.value === 'new'
          ? createTaskSet(props.model.items, draft.name, draft.lists, Date.now()) : selected.value;
        if (!item) throw new Error('This task set no longer exists.');
        if (builderMode.value === 'edit') {
          item.name = draft.name; item.lists = draft.lists; delete item.round; delete item.history; delete item.checkIn;
        }
        refreshClock();
        archiveOpen.value = isArchived(item, now.value, settings.value);
        selectedId.value = item.id;
        builderMode.value = null;
        message.value = 'Task set saved. Your grid is ready.';
        if (overlay.value) collapsed.value = true;
        await nextTick();
        detail.value?.querySelector<HTMLElement>('.sig-quadrant.is-current, .sig-completion h3')?.focus();
      } catch (error) { creationError.value = error instanceof Error ? error.message : String(error); }
    }
    function select(id: string) {
      if (!canLeaveBuilder()) return;
      builderMode.value = null; selectedId.value = id; message.value = '';
    }
    function openArchive() {
      if (!canLeaveBuilder()) return;
      builderMode.value = null; archiveOpen.value = !archiveOpen.value; selectedId.value = null; message.value = '';
    }
    function requestDelete(id: string) {
      if (!canLeaveBuilder()) return;
      builderMode.value = null;
      const item = props.model.items.find(item => item.id === id);
      if (item?.lists && taskCount(item.lists)) pendingDelete.value = id;
      else void remove(id);
    }
    function rename(id: string, name: string) {
      const item = props.model.items.find(item => item.id === id);
      if (item && name.trim() && name.length <= MAX_NAME_LENGTH) {
        item.name = name.trim();
        message.value = `Renamed to ${item.name}.`;
      }
    }
    async function remove(id: string) {
      const index = props.model.items.findIndex(item => item.id === id);
      if (index < 0) return;
      const item = props.model.items[index]!;
      props.model.items.splice(index, 1);
      if (props.model.lastSelectedTaskSetId === id) props.model.lastSelectedTaskSetId = null;
      if (selectedId.value === id) selectedId.value = visibleItems.value[0]?.id ?? null;
      message.value = `Deleted ${item.name}.`;
      await nextTick();
      library.value?.focusToggle();
    }
    async function closeSettings() {
      settingsOpen.value = false;
      await nextTick();
      library.value?.focusSettings();
    }

    return () => h('section', {
      class: 'solve-it-grid-page', 'aria-label': props.title,
      onKeydown: (event: KeyboardEvent) => {
        if (event.key === 'Escape' && overlay.value && !collapsed.value && !(event.target instanceof Element && event.target.closest('dialog'))) {
          event.preventDefault();
          void setCollapsed(true);
        }
      },
    }, [
      h('div', {
        ref: layout,
        class: ['solve-it-grid-layout', { 'library-collapsed': collapsed.value, 'library-resizing': panel.resizing.value }],
        style: panel.width.value === null ? null : { '--library-width': `${panel.width.value}px` },
      }, [
        collapsed.value ? h('button', {
          ref: showLibrary, type: 'button', class: 'icon-button library-floating-toggle',
          title: 'Show library', 'aria-label': 'Show library',
          'aria-expanded': false, 'aria-controls': 'solve-it-grid-library',
          onClick: () => { void setCollapsed(false); },
        }, [h(Icon, { name: 'panel-open' })]) : null,
        overlay.value && !collapsed.value ? h('button', {
          type: 'button', class: 'library-scrim', 'aria-label': 'Close library',
          onClick: () => { void setCollapsed(true); },
        }) : null,
        h(DatedLibrary, {
          ref: library, libraryId: 'solve-it-grid-library', label: 'Solve-It Grid',
          itemLabel: 'task set', pluralLabel: 'task sets', icon: 'grid', maxItems: MAX_TASK_SETS,
          maxNameLength: MAX_NAME_LENGTH, items: visibleItems.value, selectedId: selectedId.value,
          settings: settings.value, now: now.value, total: props.model.items.length,
          archiveCount: archivedItems.value.length, archived: archiveOpen.value, collapsed: collapsed.value,
          onCreate: create, onSelect: select,
          onRename: rename, onDelete: requestDelete, onToggle: () => { void setCollapsed(true); },
          onOpenItem: () => { if (overlay.value) void setCollapsed(true); },
          onSettings: () => { settingsOpen.value = true; },
          onArchive: openArchive,
        }),
        !overlay.value && !collapsed.value ? h('div', {
          class: 'library-resizer', role: 'separator', tabindex: 0,
          'aria-label': 'Resize library', 'aria-orientation': 'vertical',
          'aria-valuemin': MIN_LIBRARY_WIDTH, 'aria-valuemax': panel.maxWidth(),
          'aria-valuenow': Math.round(panel.currentWidth()),
          onPointerdown: panel.beginResize, onPointermove: panel.resizeFromPointer,
          onPointerup: panel.endResize, onPointercancel: panel.endResize,
          onKeydown: panel.resizeFromKeyboard, onDblclick: panel.resetWidth,
        }) : null,
        h('section', {
          ref: detail, class: 'solve-it-grid-detail', 'aria-label': selected.value?.name ?? 'Task set workspace',
          inert: overlay.value && !collapsed.value,
        }, builderMode.value ? [
          h(TaskSetBuilder, {
            key: builderMode.value === 'new' ? `new-task-set-${builderSequence.value}` : selected.value?.id,
            ref: builder, item: builderMode.value === 'edit' ? selected.value : null, error: creationError.value,
            onSave: save, onCancel: async () => {
              builderMode.value = null; creationError.value = '';
              await nextTick();
              if (collapsed.value) showLibrary.value?.focus(); else library.value?.focusToggle();
            },
          }),
        ] : selected.value ? [
          h('header', { class: 'item-heading' }, [
            h(Icon, { name: 'grid' }), h('h2', selected.value.name),
            selected.value.lists ? h('button', { type: 'button', class: 'quiet-button', onClick: edit }, [h(Icon, { name: 'pencil' }), 'Edit lists']) : null,
          ]),
          selected.value.lists ? h(TaskGrid, { key: selected.value.id, item: selected.value, onEdit: edit }) : h(LibraryEmptyState, {
            icon: 'grid', title: 'Give this task set its four lists',
            description: 'Build Fires, Passive Fun, Shoulds & Oughts, and Stimulating Fun, one list at a time.',
            actionLabel: 'Set up task set', onCreate: edit,
          }),
        ] : [
          h(LibraryEmptyState, {
            icon: 'plus', title: archiveOpen.value ? 'Your past task sets' : 'Build your task set library',
            description: archiveOpen.value ? 'No archived task sets yet. Create a new task set to begin.' : 'Build four lists, then turn them into one task at a time.',
            actionLabel: 'New task set', onCreate: create,
          }),
        ]),
      ]),
      h('p', { class: 'visually-hidden', role: 'status' }, message.value),
      pendingDelete.value ? h(DeleteConfirmation, {
        itemName: props.model.items.find(item => item.id === pendingDelete.value)?.name ?? 'Task set',
        itemLabel: 'task set', detail: 'Its four lists and saved progress will be removed.', confirmLabel: 'Delete task set',
        onCancel: () => { pendingDelete.value = null; },
        onConfirm: () => { const id = pendingDelete.value; pendingDelete.value = null; if (id) void remove(id); },
      }) : null,
      settingsOpen.value ? h(PopupDialog, {
        title: 'Solve-It Grid library settings', headingId: 'solve-it-grid-settings-title', width: 520,
        onClose: closeSettings,
      }, { default: () => h(DatedLibrarySettingsFields, {
        settings: settings.value, idPrefix: 'solve-it-grid', pluralLabel: 'task sets',
        onUpdate: value => { props.model.settings = value; },
      }) }) : null,
    ]);
  },
});
