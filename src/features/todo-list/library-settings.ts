import { defineComponent, h, ref, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { useDialog } from '../../components/use-dialog.ts';
import { defaultLibrarySettings, expirySetting, type LibrarySettings } from './library-model.ts';
import { DISPLAY_FIELDS, defaultTodoDisplay, todoDisplayStyles, validateTodoDisplay, type TodoDisplay } from './display-options.ts';

const TABS = ['library', 'display'] as const;
export const TodoLibrarySettings = defineComponent({
  name: 'TodoLibrarySettings',
  props: { settings: { type: Object as PropType<LibrarySettings>, required: true },
    display: { type: Object as PropType<TodoDisplay>, required: true } },
  emits: { update: (_settings: LibrarySettings) => true, 'update-display': (_display: TodoDisplay) => true, close: () => true },
  setup(props, { emit }) {
    const { dialog } = useDialog();
    const tab = ref<(typeof TABS)[number]>('library');
    function selectTab(event: KeyboardEvent, index: number) {
      let next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = (index + 1) % 2;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = 1;
      else return;
      event.preventDefault(); tab.value = TABS[next]!;
      dialog.value?.querySelector<HTMLButtonElement>(`#todo-settings-tab-${tab.value}`)?.focus();
    }
    function control(field: (typeof DISPLAY_FIELDS)[number]) {
      const id = `todo-display-${field.key}`;
      const value = props.display[field.key];
      const update = (event: Event) => {
        const options = { ...props.display, [field.key]: field.choices ? inputValue(event) : Number(inputValue(event)) };
        validateTodoDisplay(options); emit('update-display', options);
      };
      return h('div', { class: 'display-setting', key: field.key }, [
        h('label', { for: id }, field.label),
        field.choices ? h('select', { id, value, onChange: update }, field.choices.map(choice => h('option', { value: choice.value }, choice.label)))
          : h('div', { class: 'display-setting-range' }, [
            h('input', { id, type: 'range', min: field.min, max: field.max, step: field.step, value, onInput: update, 'aria-valuetext': `${value}${field.unit}` }),
            h('output', { for: id }, `${value}${field.unit}`),
          ]),
      ]);
    }
    function preview() {
      return h('div', { class: 'todo-display-preview', 'aria-label': 'Todo List appearance preview' }, [
        h('div', { class: 'todo-task-paper' }, [
          h('section', { class: 'todo-task-section' }, [
            h('div', { class: 'todo-section-priority-area', style: { height: 'calc(var(--todo-row-height) * 3)' } }, [
              h('span', { class: 'todo-section-priority-marker has-priority' }, [h('span', 'P#'), h('input', { value: '1', readonly: true, tabindex: -1, 'aria-label': 'Preview priority number' })]),
            ]),
            h('ul', { class: 'todo-task-rows' }, ['Defer', 'Read 2', 'Check 3'].map((text, index) => h('li', { class: ['todo-task-row', { 'is-skipped': index === 0 }] }, [
              h('div', { class: 'todo-task-margin' }, [
                h('span', { class: ['todo-skip-button', { 'is-active': index === 0 }], 'aria-hidden': 'true' }, '×'),
                h('input', { type: 'checkbox', checked: index === 2, disabled: true, 'aria-label': index === 2 ? 'Preview completed task' : index === 0 ? 'Preview skipped task, unchecked' : 'Preview active task' })]),
              h('div', { class: 'todo-task-writing' }, [
                h('span', { class: 'todo-task-dash' }, '-'), h('span', { class: 'todo-section-prefix' }, 'Class 1:'),
                h('textarea', { value: text, rows: 1, readonly: true, tabindex: -1, style: { height: 'var(--todo-row-height)' }, 'aria-label': 'Preview task' }),
              ]),
            ]))),
          ]),
        ]),
      ]);
    }
    return () => h('dialog', {
      ref: dialog, class: 'display-settings todo-settings', style: todoDisplayStyles(props.display), 'aria-labelledby': 'todo-settings-title',
      onCancel: (event: Event) => { event.preventDefault(); emit('close'); },
    }, [
      h('header', { class: 'display-settings-header' }, [
        h('h2', { id: 'todo-settings-title' }, 'Todo List settings'),
        h('button', { type: 'button', class: 'quiet-button', autofocus: true, onClick: () => emit('close') }, 'Done'),
      ]),
      h('div', { class: 'todo-settings-tabs', role: 'tablist', 'aria-label': 'Settings category' }, TABS.map((name, index) => h('button', {
        type: 'button', role: 'tab', id: `todo-settings-tab-${name}`, 'aria-selected': tab.value === name,
        'aria-controls': `todo-settings-panel-${name}`, tabindex: tab.value === name ? 0 : -1,
        onClick: () => { tab.value = name; }, onKeydown: (event: KeyboardEvent) => selectTab(event, index),
      }, name === 'library' ? 'Library' : 'Display'))),
      h('section', { role: 'tabpanel', id: 'todo-settings-panel-library', 'aria-labelledby': 'todo-settings-tab-library', hidden: tab.value !== 'library', tabindex: 0 }, [
        h('p', { class: 'display-settings-description' }, 'Lists are organized by when you created them. Changes save automatically.'),
        h('div', { class: 'display-settings-fields' }, [
          h('div', { class: 'display-setting' }, [
            h('label', { for: 'todo-library-order' }, 'Date order'),
            h('select', { id: 'todo-library-order', value: props.settings.order, onChange: (event: Event) => {
              const order = inputValue(event); if (order === 'newest' || order === 'oldest') emit('update', { ...props.settings, order });
            } }, [h('option', { value: 'newest' }, 'Newest first'), h('option', { value: 'oldest' }, 'Oldest first')]),
          ]),
          h('div', { class: 'display-setting' }, [
            h('label', { for: 'todo-library-dates' }, 'Date labels'),
            h('select', { id: 'todo-library-dates', value: props.settings.dates, onChange: (event: Event) => {
              const dates = inputValue(event); if (dates === 'long' || dates === 'short') emit('update', { ...props.settings, dates });
            } }, [h('option', { value: 'long' }, 'Full dates'), h('option', { value: 'short' }, 'Short dates')]),
          ]),
        ]),
        h('div', { class: 'display-setting todo-expiry-setting' }, [
          h('label', { for: 'todo-expiry-unit' }, 'Archive after'),
          h('div', { class: 'todo-expiry-controls' }, [
            expirySetting(props.settings) ? h('input', { type: 'number', min: 1, max: 365, step: 1,
              value: expirySetting(props.settings)?.amount, 'aria-label': 'Expiry duration',
              onChange: (event: Event) => {
                const amount = Number(inputValue(event)); const expiry = expirySetting(props.settings);
                if (expiry && Number.isInteger(amount) && amount >= 1 && amount <= 365) emit('update', { ...props.settings, expiry: { ...expiry, amount } });
                else if (event.target instanceof HTMLInputElement) event.target.value = String(expiry?.amount ?? 1);
              },
            }) : null,
            h('select', { id: 'todo-expiry-unit', value: expirySetting(props.settings)?.unit ?? 'never', onChange: (event: Event) => {
              const unit = inputValue(event);
              if (unit === 'never') emit('update', { ...props.settings, expiry: null });
              else if (unit === 'days' || unit === 'weeks' || unit === 'months') emit('update', { ...props.settings, expiry: { amount: expirySetting(props.settings)?.amount ?? 1, unit } });
            } }, [h('option', { value: 'days' }, 'Days'), h('option', { value: 'weeks' }, 'Weeks'), h('option', { value: 'months' }, 'Calendar months'), h('option', { value: 'never' }, 'Never')]),
          ]),
        ]),
        h('p', 'Lists gradually turn gray and move to Archive after this duration from creation. Changes apply to all existing lists immediately, including archived lists. Editing a list does not reset its age. Archived lists stay saved and are included in backups.'),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('update', defaultLibrarySettings()) }, 'Reset library defaults'),
      ]),
      h('section', { role: 'tabpanel', id: 'todo-settings-panel-display', 'aria-labelledby': 'todo-settings-tab-display', hidden: tab.value !== 'display', tabindex: 0 }, [
        h('p', { class: 'display-settings-description' }, 'Applies to all todo lists. Changes save automatically and travel with backups.'),
        h('div', { class: 'display-settings-fields' }, DISPLAY_FIELDS.map(control)),
        h('p', { class: 'display-settings-description' }, 'Text size changes the letters, not the ruling. Positive vertical offsets move text down. Priorities stay centered alongside the tasks.'),
        preview(),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('update-display', defaultTodoDisplay()) }, 'Reset display defaults'),
      ]),
    ]);
  },
});
