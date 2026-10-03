import { computed, defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch, type PropType } from 'vue';
import { defaultTodoDisplay, type TodoDisplay } from './display-options.ts';
import { TodoTaskEditor } from './task-editor.ts';
import { DeleteConfirmation } from '../../components/delete-confirmation.ts';
import { Icon } from '../../components/icon.ts';
import { LibraryEmptyState } from '../../components/library-empty-state.ts';
import { useLibrarySelection } from '../../components/use-library-selection.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { TodoLibrary, type TodoLibraryHandle } from './library.ts';
import { TodoLibrarySettings } from './library-settings.ts';
import { createList, defaultLibrarySettings, isArchived, MAX_NAME_LENGTH, orderedLists, type TodoLists } from './library-model.ts';

export const TodoList = defineComponent({
  name: 'TodoList',
  props: {
    title: { type: String, required: true },
    model: { type: Object as PropType<TodoLists>, required: true },
  },
  setup(props) {
    const now = ref(Date.now());
    const settings = computed(() => props.model.settings ?? defaultLibrarySettings());
    const activeItems = computed(() => orderedLists(props.model.items.filter(item => !isArchived(item, now.value, settings.value)), settings.value));
    const archivedItems = computed(() => orderedLists(props.model.items.filter(item => isArchived(item, now.value, settings.value)), settings.value));
    const archiveOpen = ref(activeItems.value.length === 0 && archivedItems.value.length > 0);
    const visibleItems = computed(() => archiveOpen.value ? archivedItems.value : activeItems.value);
    const refreshClock = () => { now.value = Date.now(); };
    let timer: number | null = null;
    function startClock() { refreshClock(); if (timer === null) timer = window.setInterval(refreshClock, 60_000); }
    function stopClock() { if (timer !== null) window.clearInterval(timer); timer = null; }
    onActivated(() => {
      startClock();
      archiveOpen.value = activeItems.value.length === 0 && archivedItems.value.length > 0;
    });
    const selectedId = useLibrarySelection({
      firstId: () => visibleItems.value[0]?.id ?? null,
      hasItem: (id) => props.model.items.some(item => item.id === id),
      onAutoSelect: () => { if (overlay.value) collapsed.value = true; },
    });
    const settingsOpen = ref(false);
    const message = ref('');
    const pendingDelete = ref<string | null>(null);
    const layout = ref<HTMLElement | null>(null);
    const library = ref<TodoLibraryHandle | null>(null);
    const showLibraryButton = ref<HTMLButtonElement | null>(null);
    const overlayQuery = window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const overlay = ref(overlayQuery.matches);
    const collapsed = ref(overlay.value && selectedId.value !== null);
    const panel = usePersistedPanelResize({
      preferenceKey: 'dynamic-learner.ui.todo-list.library-width', container: layout,
      panelSelector: '.directory-panel', minWidth: 280, maxWidth: 600, minRemainingWidth: 320, fallbackWidth: 320,
      disabled: () => overlay.value || collapsed.value,
    });
    const display = computed(() => props.model.display ?? defaultTodoDisplay());
    const selected = computed(() => props.model.items.find(item => item.id === selectedId.value) ?? null);
    const archiveCount = computed(() => archivedItems.value.length);
    function changeLayout(event: MediaQueryListEvent) {
      overlay.value = event.matches; panel.resizing.value = false;
      if (event.matches && selectedId.value) collapsed.value = true;
    }
    onMounted(() => { startClock(); document.addEventListener('visibilitychange', refreshClock); overlayQuery.addEventListener('change', changeLayout); });
    onDeactivated(() => { stopClock(); settingsOpen.value = false; pendingDelete.value = null; });
    onBeforeUnmount(() => { stopClock(); document.removeEventListener('visibilitychange', refreshClock); overlayQuery.removeEventListener('change', changeLayout); });
    watch(() => selected.value?.id, id => {
      if (id) props.model.lastSelectedListId = id;
      else if (props.model.lastSelectedListId && !props.model.items.some(item => item.id === props.model.lastSelectedListId)) props.model.lastSelectedListId = null;
    }, { immediate: true });
    watch(() => selected.value ? isArchived(selected.value, now.value, settings.value) : false, archived => {
      // Keep an open list visible when expiry passes or the configured duration changes.
      if (selected.value) archiveOpen.value = archived;
    });
    async function setCollapsed(value: boolean) {
      collapsed.value = value; await nextTick();
      if (value) showLibraryButton.value?.focus(); else library.value?.focusToggle();
    }
    async function create() {
      refreshClock();
      try {
        const item = createList(props.model.items, now.value);
        archiveOpen.value = false; selectedId.value = item.id; message.value = 'Created a new todo list.';
        collapsed.value = false; await nextTick(); await library.value?.beginRename(item.id);
      } catch (error) { message.value = error instanceof Error ? error.message : String(error); }
    }
    function select(id: string) {
      selectedId.value = id; message.value = '';
    }
    function rename(id: string, name: string) {
      const item = props.model.items.find(item => item.id === id);
      if (item && name.trim() && name.length <= MAX_NAME_LENGTH) { item.name = name; message.value = `Renamed to ${name}.`; }
    }
    async function remove(id: string) {
      const index = props.model.items.findIndex(item => item.id === id); if (index < 0) return;
      const item = props.model.items[index]!;
      props.model.items.splice(index, 1);
      if (props.model.lastSelectedListId === id) props.model.lastSelectedListId = null;
      if (selectedId.value === id) selectedId.value = visibleItems.value[0]?.id ?? null;
      message.value = `Deleted ${item.name}.`;
      await nextTick(); library.value?.focusToggle();
    }
    async function closeSettings() { settingsOpen.value = false; await nextTick(); library.value?.focusSettings(); }
    return () => h('section', {
      class: 'todo-list-page', 'aria-label': props.title,
      onKeydown: (event: KeyboardEvent) => {
        if (event.key === 'Escape' && overlay.value && !collapsed.value && !(event.target instanceof Element && event.target.closest('dialog'))) {
          event.preventDefault(); void setCollapsed(true);
        }
      },
    }, [
      h('div', { ref: layout, class: ['todo-list-layout', { 'library-collapsed': collapsed.value, 'library-resizing': panel.resizing.value }],
        style: panel.width.value === null ? null : { '--library-width': `${panel.width.value}px` } }, [
        collapsed.value ? h('button', { ref: showLibraryButton, type: 'button', class: 'icon-button library-floating-toggle',
          title: 'Show library', 'aria-label': 'Show library', 'aria-controls': 'todo-list-library', 'aria-expanded': false,
          onClick: () => setCollapsed(false) }, [h(Icon, { name: 'panel-open' })]) : null,
        overlay.value && !collapsed.value ? h('button', { type: 'button', class: 'library-scrim', 'aria-label': 'Close library', onClick: () => setCollapsed(true) }) : null,
        h(TodoLibrary, {
          ref: library, items: visibleItems.value, selectedId: selectedId.value, settings: settings.value, now: now.value,
          total: props.model.items.length, archiveCount: archiveCount.value, archived: archiveOpen.value, collapsed: collapsed.value,
          onCreate: create, onSelect: select, onRename: rename, onDelete: (id: string) => {
            const item = props.model.items.find(item => item.id === id);
            if (item?.sections?.some(section => section.title.trim() || section.priority?.trim() || section.tasks.some(task => task.text.trim() || task.priority?.trim() || task.done || task.skipped))) pendingDelete.value = id;
            else void remove(id);
          }, onToggle: () => setCollapsed(true),
          onOpenItem: () => { if (overlay.value) void setCollapsed(true); },
          onSettings: () => { settingsOpen.value = true; },
          onArchive: () => { archiveOpen.value = !archiveOpen.value; selectedId.value = null; message.value = ''; },
        }),
        !overlay.value && !collapsed.value ? h('div', {
          class: 'library-resizer', role: 'separator', tabindex: 0, 'aria-label': 'Resize library', 'aria-orientation': 'vertical',
          'aria-valuemin': 280, 'aria-valuemax': panel.maxWidth(), 'aria-valuenow': Math.round(panel.currentWidth()),
          onPointerdown: panel.beginResize, onPointermove: panel.resizeFromPointer, onPointerup: panel.endResize,
          onPointercancel: panel.endResize, onKeydown: panel.resizeFromKeyboard, onDblclick: panel.resetWidth,
        }) : null,
        h('section', { class: 'todo-list-detail', inert: overlay.value && !collapsed.value, 'aria-label': selected.value ? selected.value.name : 'Todo List getting started' }, [
          selected.value ? h(TodoTaskEditor, { key: selected.value.id, item: selected.value, display: display.value }) : h(LibraryEmptyState, {
            icon: 'plus',
            title: archiveOpen.value ? 'Your past lists' : 'Build your todo library',
            description: archiveOpen.value ? 'No archived lists yet. Create a new list to get started.' : 'Create a list for your next steps.',
            actionLabel: 'New todo list',
            onCreate: create,
          }),
        ]),
      ]),
      h('p', { class: 'visually-hidden', role: 'status' }, message.value),
      pendingDelete.value ? h(DeleteConfirmation, { itemName: props.model.items.find(item => item.id === pendingDelete.value)?.name ?? 'Todo list', itemLabel: 'todo list', detail: 'All sections and tasks in this list will be removed.', confirmLabel: 'Delete list',
        onCancel: async () => { pendingDelete.value = null; await nextTick(); library.value?.focusToggle(); },
        onConfirm: () => { const id = pendingDelete.value; pendingDelete.value = null; if (id) void remove(id); },
      }) : null,
      settingsOpen.value ? h(TodoLibrarySettings, { settings: settings.value, display: display.value,
        onUpdateDisplay: (value: TodoDisplay) => { props.model.display = value; },
        onUpdate: value => { props.model.settings = value; }, onClose: closeSettings }) : null,
    ]);
  },
});
