import { computed, defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { inputValue } from '../../core/dom.ts';
import { createId } from '../../core/ids.ts';
import { registerLeaveGuard } from '../../core/leave-guards.ts';
import { MAX_NAME_LENGTH, type TaskSet } from './library-model.ts';
import { balanceScore, categoryValues, listCounts, MAX_TASK_TEXT_LENGTH, TASK_CATEGORIES, type TaskCategory, type TaskLists } from './task-model.ts';

export interface TaskSetDraft { name: string; lists: TaskLists }
export interface TaskSetBuilderHandle { canLeave(): boolean }

export const TaskSetBuilder = defineComponent({
  name: 'TaskSetBuilder',
  props: { item: { type: Object as PropType<TaskSet | null>, default: null }, error: { type: String, default: '' } },
  emits: { save: (_draft: TaskSetDraft) => true, cancel: () => true },
  setup(props, { emit, expose }) {
    const today = new Date();
    const day = today.getDate();
    const suffix = day >= 11 && day <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th');
    const name = ref(props.item?.name ?? `Task set for ${today.toLocaleString('en-US', { month: 'long' })} ${day}${suffix}`);
    const lists = ref<TaskLists>(categoryValues(category => {
      const tasks = props.item?.lists?.[category.id];
      return tasks?.length ? tasks.map(task => ({ ...task })) : [{ id: createId(), text: '' }];
    }));
    const original = JSON.stringify({ name: name.value, lists: lists.value });
    const dirty = computed(() => original !== JSON.stringify({ name: name.value, lists: lists.value }));
    const step = ref(0), problem = ref('');
    const current = computed(() => TASK_CATEGORIES[step.value]!);
    const counts = computed(() => listCounts(lists.value));
    const score = computed(() => balanceScore(counts.value));
    const heading = ref<HTMLElement | null>(null);
    const nameInput = ref<HTMLInputElement | null>(null);
    const inputs = new Map<string, HTMLTextAreaElement>();
    let active = true;
    function canLeave() { return !dirty.value || window.confirm('Discard the unsaved task-set setup?'); }
    expose({ canLeave });
    const unregister = registerLeaveGuard(() => !active || canLeave());
    function beforeUnload(event: BeforeUnloadEvent) { if (active && dirty.value) { event.preventDefault(); event.returnValue = ''; } }
    onMounted(() => {
      window.addEventListener('beforeunload', beforeUnload);
      nameInput.value?.focus(); nameInput.value?.select();
    });
    onActivated(() => { active = true; });
    onDeactivated(() => { active = false; });
    onBeforeUnmount(() => { unregister(); window.removeEventListener('beforeunload', beforeUnload); });
    async function go(index: number) {
      if (!name.value.trim()) { problem.value = 'Give this task set a name before continuing.'; return; }
      step.value = index; problem.value = '';
      await nextTick(); heading.value?.focus();
    }
    async function add(category: TaskCategory, after?: number) {
      const task = { id: createId(), text: '' };
      lists.value[category].splice(after === undefined ? lists.value[category].length : after + 1, 0, task);
      await nextTick(); inputs.get(task.id)?.focus();
    }
    async function remove(category: TaskCategory, index: number) {
      const tasks = lists.value[category];
      tasks.splice(index, 1);
      if (!tasks.length) tasks.push({ id: createId(), text: '' });
      await nextTick(); inputs.get(tasks[Math.min(index, tasks.length - 1)]!.id)?.focus();
    }
    function update(category: TaskCategory, index: number, event: Event) {
      const task = lists.value[category][index]!;
      task.text = inputValue(event);
      const previous = props.item?.lists?.[category].find(item => item.id === task.id);
      if (previous?.completed && previous.text.trim() === task.text.trim()) task.completed = true;
      else delete task.completed;
    }
    function finish() {
      if (!name.value.trim()) { problem.value = 'Give this task set a name.'; return; }
      const clean = categoryValues(category => lists.value[category.id].filter(task => task.text.trim()).map(task => ({ ...task, text: task.text.trim() })));
      emit('save', { name: name.value.trim(), lists: clean });
    }
    return () => {
      const category = current.value;
      return h('div', { class: 'sig-builder' }, [
        h('header', { class: 'sig-builder-header' }, [
          h('div', [h('p', { class: 'sig-eyebrow' }, props.item ? 'Edit task set' : 'New task set'), h('h2', props.item?.name ?? 'Build a plan you can act on')]),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { if (canLeave()) emit('cancel'); } }, 'Cancel'),
        ]),
        h('nav', { class: 'sig-steps', 'aria-label': 'Task set creation steps' }, TASK_CATEGORIES.map((entry, index) => h('button', {
          type: 'button', class: ['sig-step', { 'is-current': index === step.value }], 'aria-current': index === step.value ? 'step' : undefined,
          onClick: () => { void go(index); },
        }, [h('span', { class: 'sig-number' }, entry.number), h('span', entry.label), h('small', String(counts.value[entry.id]))]))),
        step.value === 0 && !props.item ? h('label', { class: 'sig-name-field' }, ['Task set name', h('input', {
          ref: nameInput, value: name.value, maxlength: MAX_NAME_LENGTH, onInput: (event: Event) => { name.value = inputValue(event); },
        })]) : null,
        h('section', { key: category.id, class: 'sig-list-step', 'aria-labelledby': `sig-step-${category.id}` }, [
          h('p', { class: 'sig-eyebrow' }, `Step ${step.value + 1} of 4`),
          h('div', { class: 'sig-list-heading' }, [
            h('h3', { id: `sig-step-${category.id}`, ref: heading, tabindex: -1 }, category.label),
            h('ul', { class: 'sig-examples', 'aria-label': `${category.label} examples` }, category.examples.map(example =>
              h('li', { key: example }, example))),
          ]),
          h('p', { class: 'sig-step-description' }, category.description),
          h('ol', { class: 'sig-task-inputs' }, lists.value[category.id].map((task, index) => h('li', { key: task.id }, [
            h('span', { class: 'sig-task-index', 'aria-hidden': true }, index + 1),
            h('textarea', {
              ref: element => { if (element instanceof HTMLTextAreaElement) inputs.set(task.id, element); else inputs.delete(task.id); },
              rows: 2, value: task.text, maxlength: MAX_TASK_TEXT_LENGTH, placeholder: index === 0 ? category.example : 'Add a task…',
              'aria-label': `${category.label} task ${index + 1}`,
              onInput: (event: Event) => update(category.id, index, event),
              onKeydown: (event: KeyboardEvent) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void add(category.id, index); } },
            }),
            h('button', { type: 'button', class: 'icon-button delete-button', title: 'Remove task', 'aria-label': `Remove ${category.label} task ${index + 1}`, onClick: () => { void remove(category.id, index); } }, [h(Icon, { name: 'trash' })]),
          ]))),
          h('div', { class: 'sig-list-bottom' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { void add(category.id); } }, [h(Icon, { name: 'plus' }), 'Add item']),
            h('span', { class: 'sig-muted' }, `${counts.value[category.id]} ${counts.value[category.id] === 1 ? 'item' : 'items'}`),
          ]),
          h('p', { class: 'sig-muted' }, 'Nothing for this list? Leave it empty. Its quadrant will be marked empty.'),
        ]),
        h('aside', { class: 'sig-balance', 'aria-label': 'List balance' }, [
          h('div', { class: 'sig-balance-heading' }, [h('strong', 'List balance'), h('span', score.value === null ? 'Add a task to begin' : `${score.value} / 100`)]),
          h('div', { class: 'sig-balance-bars' }, TASK_CATEGORIES.map(entry => h('div', [
            h('span', entry.label), h('meter', { min: 0, max: Math.max(1, ...Object.values(counts.value)), value: counts.value[entry.id], 'aria-label': `${entry.label}: ${counts.value[entry.id]} items` }), h('b', String(counts.value[entry.id])),
          ]))),
          h('p', 'A gentle planning aid based on item counts, not effort or time. Balanced lists are encouraged.'),
        ]),
        problem.value || props.error ? h('p', { class: 'sig-error', role: 'alert' }, problem.value || props.error) : null,
        h('footer', { class: 'sig-builder-actions' }, [
          step.value > 0 ? h('button', { type: 'button', class: 'quiet-button', onClick: () => { void go(step.value - 1); } }, 'Back') : h('span'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => { if (step.value < 3) void go(step.value + 1); else finish(); } },
            step.value < 3 ? `Next: ${TASK_CATEGORIES[step.value + 1]!.label}` : props.item ? 'Save task set' : 'Create task set'),
        ]),
      ]);
    };
  },
});
