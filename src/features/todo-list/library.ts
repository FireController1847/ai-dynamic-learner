import { defineComponent, h, nextTick, ref, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { inputValue } from '../../core/dom.ts';
import { ageProgress, archiveTime, expiryLabel, MAX_LISTS, MAX_NAME_LENGTH, type LibrarySettings, type TodoListRecord } from './library-model.ts';
import { isTodoListComplete } from './task-model.ts';

export interface TodoLibraryHandle { beginRename(id: string): Promise<void>; focusToggle(): void; focusSettings(): void }
export const TodoLibrary = defineComponent({
  name: 'TodoLibrary',
  props: {
    items: { type: Array as PropType<TodoListRecord[]>, required: true },
    selectedId: { type: String as PropType<string | null>, default: null },
    settings: { type: Object as PropType<LibrarySettings>, required: true },
    now: { type: Number, required: true },
    total: { type: Number, required: true },
    archiveCount: { type: Number, required: true },
    archived: Boolean, collapsed: Boolean,
  },
  emits: {
    create: () => true, select: (_id: string) => true, 'open-item': () => true, rename: (_id: string, _name: string) => true,
    delete: (_id: string) => true, toggle: () => true, settings: () => true, archive: () => true,
  },
  setup(props, { emit, expose }) {
    const editingId = ref<string | null>(null);
    const draft = ref('');
    const input = ref<HTMLInputElement | null>(null);
    const toggle = ref<HTMLButtonElement | null>(null);
    const settings = ref<HTMLButtonElement | null>(null);
    const labels = new Map<string, HTMLButtonElement>();
    async function beginRename(id: string) {
      const item = props.items.find(item => item.id === id); if (!item) return;
      emit('select', id); editingId.value = id; draft.value = item.name;
      await nextTick(); input.value?.focus(); input.value?.select();
    }
    async function finishRename(save: boolean, focus = false) {
      const id = editingId.value; if (!id) return;
      if (save && draft.value.trim()) emit('rename', id, draft.value.trim());
      editingId.value = null;
      if (focus) { await nextTick(); labels.get(id)?.focus(); }
    }
    expose({ beginRename, focusToggle: () => toggle.value?.focus(), focusSettings: () => settings.value?.focus() });
    function row(item: TodoListRecord) {
      const age = ageProgress(item, props.now, props.settings);
      const expiry = new Date(archiveTime(item, props.settings));
      const expires = Number.isFinite(expiry.getTime());
      return h('li', { key: item.id }, [
        h('div', { class: ['todo-library-row', { 'is-selected': props.selectedId === item.id }],
          style: { '--todo-age': age, '--todo-aged-ink': `color-mix(in srgb, var(--text-color) ${100 - age * 65}%, var(--text-disabled))` } }, [
          h(Icon, { name: 'checklist' }),
          editingId.value === item.id ? h('input', {
            ref: input, class: 'directory-rename', value: draft.value, maxlength: MAX_NAME_LENGTH,
            'aria-label': 'Rename todo list', onInput: (event: Event) => { draft.value = inputValue(event); },
            onBlur: () => finishRename(true), onKeydown: (event: KeyboardEvent) => {
              if (event.isComposing) return;
              if (event.key === 'Enter' || event.key === 'Escape') {
                event.preventDefault(); event.stopPropagation(); void finishRename(event.key === 'Enter', true);
              }
            },
          }) : h('button', {
            ref: element => { if (element instanceof HTMLButtonElement) labels.set(item.id, element); else labels.delete(item.id); },
            type: 'button', class: 'todo-library-label', 'aria-current': props.selectedId === item.id ? 'true' : undefined,
            title: expires ? `${item.name} · ${props.archived ? 'Archived' : 'Archives'} ${expiry.toLocaleString()}` : `${item.name} · No expiry`,
            onClick: () => { emit('select', item.id); emit('open-item'); },
          }, [
            h('span', { class: 'todo-library-name' }, [
              h('span', { class: 'todo-library-name-text' }, item.name),
              isTodoListComplete(item.sections ?? []) ? h('span', {
                class: 'todo-library-complete', title: 'Completed', 'aria-label': 'Completed',
              }, [h(Icon, { name: 'verified' })]) : null,
            ]),
            h('small', [
              expires ? (props.archived ? 'Archived ' : 'Archives ') : 'No expiry',
              expires ? h('time', { datetime: expiry.toISOString() }, expiry.toLocaleDateString()) : null,
            ]),
          ]),
          h('button', { type: 'button', class: 'icon-button', title: `Rename ${item.name}`, 'aria-label': `Rename ${item.name}`,
            onClick: () => beginRename(item.id) }, [h(Icon, { name: 'pencil' })]),
          h('button', { type: 'button', class: 'icon-button delete-button', title: `Delete ${item.name}`, 'aria-label': `Delete ${item.name}`,
            onClick: () => emit('delete', item.id) }, [h(Icon, { name: 'trash' })]),
        ]),
      ]);
    }
    return () => {
      const groups: { date: string; items: TodoListRecord[] }[] = [];
      for (const item of props.items) {
        const date = new Date(item.createdAt).toLocaleDateString(undefined, { dateStyle: props.settings.dates === 'long' ? 'full' : 'short' });
        const last = groups.at(-1);
        if (last?.date === date) last.items.push(item); else groups.push({ date, items: [item] });
      }
      return h('aside', {
        id: 'todo-list-library', class: 'directory-panel todo-library',
        'aria-label': props.archived ? 'Archived todo lists' : 'Todo List library', inert: props.collapsed, 'aria-hidden': props.collapsed,
      }, [
        h('header', { class: 'directory-toolbar' }, [
          h('h3', props.archived ? 'Archive' : 'Library'),
          h('div', { class: 'directory-create-actions' }, [
            h('button', { type: 'button', class: 'icon-button', disabled: props.total >= MAX_LISTS,
              title: 'New todo list', 'aria-label': 'New todo list', onClick: () => emit('create') }, [h(Icon, { name: 'plus' })]),
            h('button', { ref: toggle, type: 'button', class: 'icon-button', title: 'Hide library', 'aria-label': 'Hide library',
              'aria-controls': 'todo-list-library', 'aria-expanded': !props.collapsed, onClick: () => emit('toggle') }, [h(Icon, { name: 'panel-close' })]),
          ]),
        ]),
        h('p', { class: 'todo-library-intro' }, props.archived ? 'Older lists are kept here.' : `Created dates · ${expiryLabel(props.settings)}`),
        h('div', { class: 'directory-scroll' }, groups.length ? groups.map(group => h('section', { key: group.date, class: 'todo-date-section', 'aria-label': `Created ${group.date}` }, [
          h('h4', group.date), h('ul', { class: 'directory-list' }, group.items.map(row)),
        ])) : h('p', { class: 'directory-empty' }, props.archived ? 'No archived lists yet.' : 'No active lists. Create one to begin.')),
        h('footer', { class: 'todo-library-footer' }, [
          h('button', { ref: settings, type: 'button', class: 'quiet-button library-settings-button', onClick: () => emit('settings') }, ['Settings', h(Icon, { name: 'settings' })]),
          h('button', { type: 'button', class: ['quiet-button library-settings-button', { 'is-active': props.archived }],
            'aria-pressed': props.archived, onClick: () => { editingId.value = null; emit('archive'); } }, [
            `Archive (${props.archiveCount})`, h(Icon, { name: 'archive' }),
          ]),
        ]),
      ]);
    };
  },
});
