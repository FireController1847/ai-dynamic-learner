import { computed, defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { inputValue } from '../../core/dom.ts';
import { createId } from '../../core/ids.ts';
import { registerLeaveGuard } from '../../core/leave-guards.ts';
import { MAX_NAME_LENGTH, type TaskSet } from './library-model.ts';
import { balanceScore, categoryValues, listCounts, MAX_TASK_TEXT_LENGTH, REPEAT_OPTIONS, TASK_CATEGORIES, type GridTask, type TaskCategory, type TaskLists } from './task-model.ts';

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
    const introduction = ref(!props.item);
    const naming = ref(!props.item);
    const expandedOptions = ref<Set<string>>(new Set());
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
      if (introduction.value || props.item) heading.value?.focus();
      else { nameInput.value?.focus(); nameInput.value?.select(); }
    });
    onActivated(() => { active = true; });
    onDeactivated(() => { active = false; });
    onBeforeUnmount(() => { unregister(); window.removeEventListener('beforeunload', beforeUnload); });
    async function beginLists() {
      introduction.value = false;
      naming.value = true; problem.value = '';
      await nextTick();
      nameInput.value?.focus();
      nameInput.value?.select();
    }
    async function backToIntroduction() {
      introduction.value = true; problem.value = '';
      await nextTick(); heading.value?.focus();
    }
    async function beginCategories() {
      if (!name.value.trim()) {
        problem.value = 'Give your task set a name to continue.';
        nameInput.value?.focus(); return;
      }
      naming.value = false; step.value = 0; problem.value = '';
      await nextTick(); heading.value?.focus();
    }
    async function backToName() {
      naming.value = true; problem.value = '';
      await nextTick(); nameInput.value?.focus();
    }
    function toggleOptions(id: string) {
      const next = new Set(expandedOptions.value);
      if (next.has(id)) next.delete(id); else next.add(id);
      expandedOptions.value = next;
    }
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
      const [removed] = tasks.splice(index, 1);
      if (removed && expandedOptions.value.has(removed.id)) {
        const next = new Set(expandedOptions.value);
        next.delete(removed.id); expandedOptions.value = next;
      }
      if (!tasks.length) tasks.push({ id: createId(), text: '' });
      await nextTick(); inputs.get(tasks[Math.min(index, tasks.length - 1)]!.id)?.focus();
    }
    function preserveProgress(category: TaskCategory, task: GridTask) {
      const previous = props.item?.lists?.[category].find(item => item.id === task.id);
      if (previous && previous.text.trim() === task.text.trim() && previous.repeat === task.repeat) {
        if (previous.completed) task.completed = true; else delete task.completed;
        if (previous.timesCompleted !== undefined) task.timesCompleted = previous.timesCompleted;
        else delete task.timesCompleted;
      } else {
        delete task.completed;
        delete task.timesCompleted;
      }
    }
    function update(category: TaskCategory, index: number, event: Event) {
      const task = lists.value[category][index]!;
      task.text = inputValue(event);
      preserveProgress(category, task);
    }
    function setRepeating(category: TaskCategory, index: number, enabled: boolean) {
      const task = lists.value[category][index]!;
      if (enabled) task.repeat = -1; else delete task.repeat;
      preserveProgress(category, task);
    }
    function setRepeatLimit(category: TaskCategory, index: number, value: number) {
      if (!REPEAT_OPTIONS.some(option => option === value)) return;
      const task = lists.value[category][index]!;
      task.repeat = value;
      preserveProgress(category, task);
    }
    function finish() {
      if (!name.value.trim()) { problem.value = 'Give this task set a name.'; return; }
      const clean = categoryValues(category => lists.value[category.id].filter(task => task.text.trim()).map(task => ({ ...task, text: task.text.trim() })));
      emit('save', { name: name.value.trim(), lists: clean });
    }
    return () => {
      if (introduction.value) return h('div', { class: 'sig-builder sig-builder-intro' }, [
        h('header', { class: 'sig-intro-top' }, [
          h('span', { class: 'sig-eyebrow' }, 'New task set'),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { if (canLeave()) emit('cancel'); } }, 'Cancel'),
        ]),
        h('section', { class: 'sig-intro-content', 'aria-labelledby': 'sig-intro-title' }, [
          h('div', { class: 'sig-intro-symbol', 'aria-hidden': true }, [h(Icon, { name: 'grid' })]),
          h('h2', { id: 'sig-intro-title', ref: heading, tabindex: -1 }, 'One thing at a time.'),
          h('p', 'First, we need to figure out what needs to get done. Add whatever comes to mind, as much or as little as you like. It doesn’t have to be perfect.'),
          h('p', 'When you’re ready, the grid will help you focus on one item at a time.'),
          h('div', { class: 'sig-intro-actions' }, [
            h('button', { type: 'button', class: 'card-primary-button', onClick: () => { void beginLists(); } }, [
              'Let’s begin', h(Icon, { name: 'arrow-right' }),
            ]),
            h('span', { class: 'sig-muted' }, 'You can leave lists empty and change them later.'),
          ]),
        ]),
      ]);
      if (naming.value && !props.item) return h('div', { class: 'sig-builder sig-builder-create sig-builder-name' }, [
        h('header', { class: 'sig-intro-top' }, [
          h('span', { class: 'sig-eyebrow' }, 'New task set'),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { if (canLeave()) emit('cancel'); } }, 'Cancel'),
        ]),
        h('section', { class: 'sig-name-content', 'aria-labelledby': 'sig-name-title' }, [
          h('h2', { id: 'sig-name-title', ref: heading, tabindex: -1 }, 'Name your task set'),
          h('label', { class: 'sig-name-field' }, ['Task set name', h('input', {
            ref: nameInput, value: name.value, maxlength: MAX_NAME_LENGTH,
            onInput: (event: Event) => { name.value = inputValue(event); },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); void beginCategories(); }
            },
          })]),
          problem.value ? h('p', { class: 'sig-error', role: 'alert' }, problem.value) : null,
          h('div', { class: 'sig-builder-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { void backToIntroduction(); } }, 'Back'),
            h('button', { type: 'button', class: 'card-primary-button', onClick: () => { void beginCategories(); } }, 'Continue'),
          ]),
        ]),
      ]);
      const category = current.value;
      return h('div', { class: ['sig-builder', { 'sig-builder-create': !props.item }] }, [
        props.item ? h('header', { class: 'sig-builder-header' }, [
          h('div', [h('p', { class: 'sig-eyebrow' }, 'Edit task set'), h('h2', props.item.name)]),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { if (canLeave()) emit('cancel'); } }, 'Cancel'),
        ]) : h('header', { class: 'sig-intro-top' }, [
          h('span', { class: 'sig-eyebrow' }, name.value),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { if (canLeave()) emit('cancel'); } }, 'Cancel'),
        ]),
        props.item ? h('nav', { class: 'sig-steps', 'aria-label': 'Task set creation steps' }, TASK_CATEGORIES.map((entry, index) => h('button', {
          type: 'button', class: ['sig-step', { 'is-current': index === step.value }], 'aria-current': index === step.value ? 'step' : undefined,
          onClick: () => { void go(index); },
        }, [h('span', { class: 'sig-number' }, entry.number), h('span', entry.label), h('small', String(counts.value[entry.id]))]))) : null,
        h('section', { key: category.id, class: 'sig-list-step', 'aria-labelledby': `sig-step-${category.id}` }, [
          h('p', { class: 'sig-eyebrow' }, `Step ${step.value + 1} of 4`),
          h('div', { class: 'sig-list-heading' }, [
            h('h3', { id: `sig-step-${category.id}`, ref: heading, tabindex: -1 }, category.label),
            props.item ? h('ul', { class: 'sig-examples', 'aria-label': `${category.label} examples` }, category.examples.map(example =>
              h('li', { key: example }, example))) : null,
          ]),
          h('p', { class: 'sig-step-description' }, category.description),
          !props.item ? h('details', { class: 'sig-example-disclosure' }, [
            h('summary', 'Need an example?'),
            h('ul', { class: 'sig-examples', 'aria-label': `${category.label} examples` }, category.examples.map(example =>
              h('li', { key: example }, example))),
          ]) : null,
          h('ol', { class: 'sig-task-inputs' }, lists.value[category.id].map((task, index) => h('li', { key: task.id, class: 'sig-item-card' }, [
            h('span', { class: 'sig-task-index', 'aria-hidden': true }, index + 1),
            h('div', { class: 'sig-item-body' }, [
              h('textarea', {
                ref: element => { if (element instanceof HTMLTextAreaElement) inputs.set(task.id, element); else inputs.delete(task.id); },
                rows: 2, value: task.text, maxlength: MAX_TASK_TEXT_LENGTH, placeholder: index === 0 ? category.example : 'Add an item…',
                'aria-label': `${category.label} item ${index + 1}`,
                onInput: (event: Event) => update(category.id, index, event),
                onKeydown: (event: KeyboardEvent) => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void add(category.id, index); } },
              }),
              !props.item ? h('button', {
                type: 'button', class: 'sig-options-toggle',
                'aria-expanded': expandedOptions.value.has(task.id),
                onClick: () => toggleOptions(task.id),
              }, [
                h(Icon, { name: 'settings' }),
                task.repeat !== undefined ? 'Repeating · Options' : 'Options',
                h(Icon, { name: expandedOptions.value.has(task.id) ? 'chevron-up' : 'chevron-down' }),
              ]) : null,
              props.item || expandedOptions.value.has(task.id) ? h('div', { class: 'sig-item-options' }, [
                h('label', { class: 'sig-repeat-toggle' }, [
                  h('input', {
                    type: 'checkbox', checked: task.repeat !== undefined,
                    onChange: (event: Event) => setRepeating(category.id, index, (event.target as HTMLInputElement).checked),
                  }),
                  h(Icon, { name: 'repeat' }), h('span', 'Repeating'),
                ]),
                task.repeat !== undefined ? h('label', { class: 'sig-repeat-limit' }, [
                  h('span', 'Repeat'),
                  h('select', {
                    value: String(task.repeat), 'aria-label': `Number of repeats for ${category.label} item ${index + 1}`,
                    onChange: (event: Event) => setRepeatLimit(category.id, index, Number(inputValue(event))),
                  }, REPEAT_OPTIONS.map(value => h('option', { value: String(value) },
                    value === -1 ? 'Forever (∞)' : `${value} ${value === 1 ? 'extra time' : 'extra times'}`))),
                ]) : null,
                task.repeat !== undefined && (task.timesCompleted ?? 0) > 0
                  ? h('span', { class: 'sig-repeat-progress' },
                    `${task.timesCompleted} completed${task.repeat === -1 ? '' : ` · ${Math.max(0, task.repeat + 1 - (task.timesCompleted ?? 0))} left`}`)
                  : null,
              ]) : null,
            ]),
            h('button', { type: 'button', class: 'icon-button delete-button sig-item-remove', title: 'Remove item', 'aria-label': `Remove ${category.label} item ${index + 1}`, onClick: () => { void remove(category.id, index); } }, [h(Icon, { name: 'trash' })]),
          ]))),
          h('div', { class: 'sig-list-bottom' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { void add(category.id); } }, [h(Icon, { name: 'plus' }), 'Add item']),
            h('span', { class: 'sig-muted' }, `${counts.value[category.id]} ${counts.value[category.id] === 1 ? 'item' : 'items'}`),
          ]),
          props.item ? h('p', { class: 'sig-muted' }, 'Nothing for this list? Leave it empty. Its quadrant will be marked empty.') : null,
        ]),
        props.item ? h('aside', { class: 'sig-balance', 'aria-label': 'List balance' }, [
          h('div', { class: 'sig-balance-heading' }, [h('strong', 'List balance'), h('span', score.value === null ? 'Add a task to begin' : `${score.value} / 100`)]),
          h('div', { class: 'sig-balance-bars' }, TASK_CATEGORIES.map(entry => h('div', [
            h('span', entry.label), h('meter', { min: 0, max: Math.max(1, ...Object.values(counts.value)), value: counts.value[entry.id], 'aria-label': `${entry.label}: ${counts.value[entry.id]} items` }), h('b', String(counts.value[entry.id])),
          ]))),
          h('p', 'A gentle planning aid based on item counts, not effort or time. Balanced lists are encouraged.'),
        ]) : null,
        problem.value || props.error ? h('p', { class: 'sig-error', role: 'alert' }, problem.value || props.error) : null,
        h('footer', { class: 'sig-builder-actions' }, [
          step.value > 0 || !props.item
            ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
              if (step.value > 0) void go(step.value - 1);
              else void backToName();
            } }, 'Back')
            : h('span'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: () => { if (step.value < 3) void go(step.value + 1); else finish(); } },
            step.value < 3 ? props.item ? `Next: ${TASK_CATEGORIES[step.value + 1]!.label}` : 'Continue' : props.item ? 'Save task set' : 'Create task set'),
        ]),
      ]);
    };
  },
});
