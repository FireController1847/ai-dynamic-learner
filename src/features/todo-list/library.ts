import { defineComponent, h, ref, type PropType } from 'vue';
import { DatedLibrary, datedLibraryEmits, datedLibraryProps, type DatedLibraryHandle } from '../../components/dated-library.ts';
import { MAX_LISTS, MAX_NAME_LENGTH, type TodoListRecord } from './library-model.ts';
import { isTodoListComplete } from './task-model.ts';

export type TodoLibraryHandle = DatedLibraryHandle;

export const TodoLibrary = defineComponent({
  name: 'TodoLibrary',
  props: { ...datedLibraryProps, items: { type: Array as PropType<TodoListRecord[]>, required: true } },
  emits: datedLibraryEmits,
  setup(props, { emit, expose }) {
    const library = ref<DatedLibraryHandle | null>(null);
    expose({
      beginRename: async (id: string) => { await library.value?.beginRename(id); },
      focusToggle: () => library.value?.focusToggle(),
      focusSettings: () => library.value?.focusSettings(),
    });
    return () => h(DatedLibrary, {
      ...props, ref: library, libraryId: 'todo-list-library', label: 'Todo List',
      itemLabel: 'todo list', pluralLabel: 'lists', icon: 'checklist',
      maxItems: MAX_LISTS, maxNameLength: MAX_NAME_LENGTH, footerClass: 'todo-library-footer',
      completedIds: props.items.filter(item => isTodoListComplete(item.sections ?? [])).map(item => item.id),
      onCreate: () => emit('create'), onSelect: (id: string) => emit('select', id),
      onOpenItem: () => emit('open-item'), onRename: (id: string, name: string) => emit('rename', id, name),
      onDelete: (id: string) => emit('delete', id), onToggle: () => emit('toggle'),
      onSettings: () => emit('settings'), onArchive: () => emit('archive'),
    });
  },
});
