import { computed, defineComponent, h, nextTick, onBeforeUnmount, onDeactivated, onMounted, onUpdated, reactive, ref, type PropType } from 'vue';
import { todoDisplayStyles, type TodoDisplay } from './display-options.ts';
import { DeleteConfirmation } from '../../components/delete-confirmation.ts';
import { inputValue } from '../../core/dom.ts';
import type { SectionSort, TodoListRecord } from './library-model.ts';
import { MAX_SECTIONS, MAX_TASKS, MAX_TASK_TEXT, newSection, newTask, orderedTasks, sectionPriority, priorityNumber, formatPriority, type TodoSection, type TodoTask } from './task-model.ts';

export const TodoTaskEditor = defineComponent({
  name: 'TodoTaskEditor',
  props: { item: { type: Object as PropType<TodoListRecord>, required: true },
    display: { type: Object as PropType<TodoDisplay>, required: true } },
  setup(props) {
    if (!props.item.sections?.length) props.item.sections = [newSection()];
    const sections = computed(() => props.item.sections ?? []);
    const sortMode = computed<SectionSort>(() => props.item.sectionSort ?? 'custom');
    const displaySections = computed(() => {
      if (sortMode.value === 'custom') return sections.value;
      return sections.value.map((section, index) => ({ section, index })).sort((a, b) => {
        if (sortMode.value === 'name') {
          const left = a.section.title.trim();
          const right = b.section.title.trim();
          if (!left && right) return 1;
          if (left && !right) return -1;
          const byName = left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
          return byName || a.index - b.index;
        }
        const priorityValue = (section: TodoSection) => {
          const priority = priorityNumber(sectionPriority(section));
          if (!priority) return Number.POSITIVE_INFINITY;
          const value = Number(priority);
          return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
        };
        return priorityValue(a.section) - priorityValue(b.section) || a.index - b.index;
      }).map(entry => entry.section);
    });
    // Lift the first legacy task priority once so section priority survives row edits/removal.
    for (const section of sections.value) if (section.priority === undefined) section.priority = formatPriority(sectionPriority(section));
    const count = computed(() => sections.value.reduce((sum, section) => sum + section.tasks.filter(task => !task.skipped && (task.text.trim() || task.done)).length, 0));
    const storedCount = computed(() => sections.value.reduce((sum, section) => sum + section.tasks.length, 0));
    const completed = computed(() => sections.value.reduce((sum, section) => sum + section.tasks.filter(task => task.done && !task.skipped).length, 0));
    const skipped = computed(() => sections.value.reduce((sum, section) => sum + section.tasks.filter(task => task.skipped).length, 0));
    const root = ref<HTMLElement | null>(null);
    const fields = new Map<string, HTMLTextAreaElement>();
    const sectionElements = new Map<string, HTMLElement>();
    const priorityHeights = reactive(new Map<string, number>());
    const names = new Map<string, HTMLInputElement>();
    const drafts = reactive(new Map<string, TodoTask>());
    const editingName = ref<string | null>(null);
    const pendingSection = ref<TodoSection | null>(null);
    const undo = ref<{ section: TodoSection; index: number; task: TodoTask } | null>(null);
    const message = ref('');
    function isMeaningfulTask(task: TodoTask) { return !!(task.text.trim() || task.done || task.skipped); }
    function isSectionComplete(section: TodoSection) {
      const tasks = section.tasks.filter(isMeaningfulTask);
      return tasks.length > 0 && tasks.every(task => task.done || task.skipped);
    }
    const completedSections = reactive(new Set<string>(sections.value.filter(isSectionComplete).map(section => section.id)));
    const celebratingTasks = reactive(new Set<string>());
    const celebratingSections = reactive(new Set<string>());
    const taskCelebrationTimers = new Map<string, number>();
    const sectionCelebrationTimers = new Map<string, number>();
    function stopTaskCelebration(id: string) {
      const timer = taskCelebrationTimers.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      taskCelebrationTimers.delete(id); celebratingTasks.delete(id);
    }
    function stopSectionCelebration(id: string) {
      const timer = sectionCelebrationTimers.get(id);
      if (timer !== undefined) window.clearTimeout(timer);
      sectionCelebrationTimers.delete(id); celebratingSections.delete(id);
    }
    function celebrateTask(id: string) {
      stopTaskCelebration(id); celebratingTasks.add(id);
      taskCelebrationTimers.set(id, window.setTimeout(() => stopTaskCelebration(id), 820));
    }
    function celebrateSection(id: string) {
      stopSectionCelebration(id); celebratingSections.add(id);
      sectionCelebrationTimers.set(id, window.setTimeout(() => stopSectionCelebration(id), 2200));
    }
    function syncSectionCompletion(section: TodoSection, celebrate: boolean) {
      const complete = isSectionComplete(section);
      const wasComplete = completedSections.has(section.id);
      if (!complete) {
        completedSections.delete(section.id); stopSectionCelebration(section.id); return;
      }
      completedSections.add(section.id);
      if (celebrate && !wasComplete) celebrateSection(section.id);
    }
    function clearCelebrations() {
      for (const timer of taskCelebrationTimers.values()) window.clearTimeout(timer);
      for (const timer of sectionCelebrationTimers.values()) window.clearTimeout(timer);
      taskCelebrationTimers.clear(); sectionCelebrationTimers.clear();
      celebratingTasks.clear(); celebratingSections.clear();
    }
    onDeactivated(() => {
      pendingSection.value = null; editingName.value = null; clearCelebrations();
    });
    function draftFor(section: TodoSection) {
      let draft = drafts.get(section.id);
      if (!draft) { draft = newTask(); drafts.set(section.id, draft); }
      return draft;
    }
    function size(field: HTMLTextAreaElement) {
      const lineHeight = Number.parseFloat(getComputedStyle(field).lineHeight) || props.display.rowSpacing;
      field.style.height = '0px';
      field.style.height = `${Math.ceil(field.scrollHeight / lineHeight) * lineHeight}px`;
    }
    function centerPriorities() {
      for (const [id, section] of sectionElements) {
        const last = section.querySelector<HTMLElement>('.todo-task-row:last-child');
        const blankHeight = last && (last.classList.contains('is-draft') || last.classList.contains('is-empty')) ? last.offsetHeight : 0;
        priorityHeights.set(id, Math.max(props.display.rowSpacing, section.offsetHeight - blankHeight));
      }
    }
    function resize() { fields.forEach(size); centerPriorities(); }
    let observer: ResizeObserver | null = null;
    let lastWidth = -1;
    onMounted(() => {
      resize(); observer = new ResizeObserver(entries => {
        const width = entries.find(entry => entry.target === root.value)?.contentRect.width;
        if (width !== undefined && width !== lastWidth) { lastWidth = width; resize(); } else centerPriorities();
      });
      if (root.value) observer.observe(root.value);
      sectionElements.forEach(section => observer?.observe(section));
    });
    onUpdated(resize);
    onBeforeUnmount(() => { observer?.disconnect(); clearCelebrations(); });
    async function focusTask(id: string) { await nextTick(); fields.get(id)?.focus(); }
    async function editName(taskId: string) {
      editingName.value = taskId; await nextTick(); names.get(taskId)?.focus(); names.get(taskId)?.select();
    }
    async function splitSection(section: TodoSection, index: number, task: TodoTask) {
      if (sections.value.length >= MAX_SECTIONS) { message.value = 'The section limit has been reached.'; return; }
      const next = newSection();
      // An empty row acts as the separator; tasks after it belong to the new section.
      const ordered = orderedTasks(section);
      const following = ordered.slice(index);
      section.tasks = ordered.slice(0, index);
      if (following[0]?.id === task.id) following.shift();
      next.tasks = following.length ? following : [];
      const sectionIndex = sections.value.indexOf(section);
      sections.value.splice(sectionIndex + 1, 0, next);
      syncSectionCompletion(section, false); syncSectionCompletion(next, false);
      drafts.delete(section.id);
      const first = orderedTasks(next)[0] ?? draftFor(next);
      await editName(first.id);
      message.value = 'New section. Name it here, or press Enter to start writing.';
    }
    async function deleteTask(section: TodoSection, index: number) {
      const task = orderedTasks(section)[index]; if (!task) return;
      const storedIndex = section.tasks.indexOf(task);
      undo.value = { section, index: storedIndex, task }; section.tasks.splice(storedIndex, 1);
      stopTaskCelebration(task.id); syncSectionCompletion(section, false);
      message.value = 'Task removed. Undo is available.';
      const remaining = orderedTasks(section);
      await focusTask((remaining[index] ?? remaining[index - 1] ?? draftFor(section)).id);
    }
    async function restoreTask() {
      const saved = undo.value; if (!saved || storedCount.value >= MAX_TASKS || !sections.value.includes(saved.section)) return;
      saved.section.tasks.splice(saved.index, 0, saved.task); syncSectionCompletion(saved.section, false); undo.value = null;
      message.value = 'Task restored.'; await focusTask(saved.task.id);
    }
    async function moveTask(section: TodoSection, index: number, direction: number) {
      const ordered = orderedTasks(section); const task = ordered[index]; const neighbor = ordered[index + direction];
      if (!task || !neighbor || !!task.skipped !== !!neighbor.skipped) return;
      const target = section.tasks.indexOf(neighbor);
      section.tasks.splice(section.tasks.indexOf(task), 1); section.tasks.splice(target, 0, task); await focusTask(task.id);
    }
    async function moveSection(section: TodoSection, direction: number) {
      if (sortMode.value !== 'custom') return;
      const index = sections.value.indexOf(section);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= sections.value.length) return;
      sections.value.splice(index, 1); sections.value.splice(target, 0, section);
      message.value = 'Section moved.';
      await focusTask((orderedTasks(section)[0] ?? draftFor(section)).id);
    }
    function setSortMode(mode: SectionSort) {
      props.item.sectionSort = mode;
      message.value = mode === 'custom' ? 'Using custom section order.' : `Sections sorted by ${mode}.`;
    }
    async function cancelSectionDelete() {
      const section = pendingSection.value; pendingSection.value = null;
      if (section) await focusTask((orderedTasks(section)[0] ?? draftFor(section)).id);
    }
    async function toggleSkipped(section: TodoSection, task: TodoTask, trigger: EventTarget | null) {
      task.skipped = !task.skipped;
      if (task.skipped) task.done = false;
      stopTaskCelebration(task.id); syncSectionCompletion(section, !!task.skipped);
      message.value = task.skipped ? 'Task skipped or deferred. It stays in this list, unchecked.' : 'Task restored to active.';
      await nextTick();
      if (trigger instanceof HTMLButtonElement && trigger.isConnected) trigger.focus();
      else fields.get(task.id)?.focus();
    }
    function taskRow(section: TodoSection, task: TodoTask, index: number, ordered: TodoTask[], draft = false) {
      const first = index === 0;
      const named = !!section.title.trim();
      const canMove = (direction: number) => !!ordered[index + direction] && !!ordered[index + direction]?.skipped === !!task.skipped;
      return h('li', { key: task.id, class: ['todo-task-row', { 'is-skipped': task.skipped, 'is-draft': draft, 'is-section-start': first, 'is-empty': !task.text.trim() && !task.done && !task.skipped }] }, [
        h('div', { class: 'todo-task-margin' }, [
          !draft ? h('button', {
            type: 'button', class: ['todo-skip-button', { 'is-active': task.skipped }],
            title: task.skipped ? 'Restore task' : 'Skip / defer task', 'aria-pressed': !!task.skipped,
            'aria-label': `${task.skipped ? 'Restore' : 'Skip / defer'} task: ${task.text || 'Untitled task'}`,
            onClick: (event: MouseEvent) => toggleSkipped(section, task, event.currentTarget),
          }, '×') : null,
          !draft ? h('input', { type: 'checkbox', checked: task.done,
            class: { 'is-celebrating': celebratingTasks.has(task.id) },
            'aria-label': `${task.skipped ? 'Complete skipped/deferred task' : 'Complete task'}: ${section.title ? `${section.title}: ` : ''}${task.text || 'Untitled task'}`,
            onChange: (event: Event) => {
              if (event.target instanceof HTMLInputElement) {
                task.done = event.target.checked;
                if (task.done) {
                  task.skipped = false; celebrateTask(task.id);
                  message.value = 'Task completed. Nice work.';
                } else {
                  stopTaskCelebration(task.id); message.value = 'Task marked incomplete.';
                }
                syncSectionCompletion(section, task.done);
              }
            } }) : h('span', { class: 'todo-checkbox-space', 'aria-hidden': 'true' }),
          !draft && celebratingTasks.has(task.id) ? [
            h('span', { class: 'todo-check-fallout', 'aria-hidden': 'true' },
              Array.from({ length: 7 }, (_, particle) => h('span', {
                class: `todo-check-fallout-particle todo-check-fallout-particle-${particle + 1}`,
              }, '✦'))),
            h('span', { class: 'todo-check-sparks', 'aria-hidden': 'true' }, [
              h('span', { class: 'todo-check-spark-ring' },
                Array.from({ length: 8 }, (_, spark) => h('span', { class: `todo-check-spark todo-check-spark-${spark + 1}` }, '✦'))),
            ]),
          ] : null,
        ]),
        h('div', { class: 'todo-task-writing' }, [
          h('span', { class: 'todo-task-dash', 'aria-hidden': 'true' }, '-'),
          editingName.value === task.id ? h('input', {
            ref: element => { if (element instanceof HTMLInputElement) names.set(task.id, element); else names.delete(task.id); },
            class: 'todo-section-name', value: section.title, maxlength: 120, placeholder: 'Section',
            style: { width: `${Math.max(7, Math.min(24, section.title.length + 1))}ch` },
            'aria-label': 'Section name, applied to every task in this section',
            onInput: (event: Event) => { section.title = inputValue(event); }, onBlur: () => { editingName.value = null; },
            onKeydown: (event: KeyboardEvent) => {
              if (event.isComposing) return;
              if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); editingName.value = null; void focusTask(task.id); }
            },
          }) : named || first ? h('button', { type: 'button', class: ['todo-section-prefix', { 'is-unnamed': !named }],
            title: 'Rename this section for all its tasks', 'aria-label': `Rename section ${section.title || 'Untitled'}`, onClick: () => editName(task.id),
          }, named ? `${section.title}:` : 'Section') : null,
          h('textarea', {
            ref: element => { if (element instanceof HTMLTextAreaElement) fields.set(task.id, element); else fields.delete(task.id); },
            rows: 1, value: task.text, maxlength: MAX_TASK_TEXT, disabled: draft && storedCount.value >= MAX_TASKS,
            'aria-label': draft ? `New task in ${section.title || 'this section'}` : `Task ${index + 1} in ${section.title || 'this section'}`,
            onInput: (event: Event) => {
              task.text = inputValue(event);
              if (draft && task.text && storedCount.value < MAX_TASKS) { section.tasks.push(task); drafts.delete(section.id); }
              syncSectionCompletion(section, false);
              if (event.target instanceof HTMLTextAreaElement) size(event.target);
            },
            onKeydown: (event: KeyboardEvent) => {
              if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
              event.preventDefault();
              if (!task.text.trim() && !task.done && !task.skipped) { void splitSection(section, index, task); return; }
              if (storedCount.value >= MAX_TASKS || !(event.target instanceof HTMLTextAreaElement)) return;
              const field = event.target; const next = newTask();
              next.text = task.text.slice(field.selectionEnd); task.text = task.text.slice(0, field.selectionStart);
              section.tasks.splice(section.tasks.indexOf(task) + 1, 0, next); void focusTask(next.id);
            },
          }),
        ]),
        !draft || first ? h('details', { class: 'todo-row-tools' }, [
          h('summary', { 'aria-label': first ? 'Task and section options' : 'Task options', title: 'Options' }, '⋯'),
          h('div', { class: 'todo-row-menu', onClick: (event: MouseEvent) => {
            if (event.target instanceof Element) event.target.closest('details')?.removeAttribute('open');
          } }, [
            !draft ? [
              h('button', { type: 'button', disabled: !canMove(-1), onClick: () => moveTask(section, index, -1) }, 'Move up'),
              h('button', { type: 'button', disabled: !canMove(1), onClick: () => moveTask(section, index, 1) }, 'Move down'),
              h('button', { type: 'button', class: 'delete-button', onClick: () => deleteTask(section, index) }, 'Remove task'),
            ] : null,
            first ? [
              h('button', { type: 'button', onClick: () => editName(task.id) }, 'Name section'),
              sortMode.value === 'custom' ? [
                h('button', { type: 'button', disabled: sections.value.indexOf(section) <= 0, onClick: () => moveSection(section, -1) }, 'Move section up'),
                h('button', { type: 'button', disabled: sections.value.indexOf(section) >= sections.value.length - 1, onClick: () => moveSection(section, 1) }, 'Move section down'),
              ] : null,
              h('button', { type: 'button', class: 'delete-button', onClick: () => { pendingSection.value = section; } }, 'Remove section'),
            ] : null,
          ]),
        ]) : null,
      ]);
    }
    function sectionRows(section: TodoSection) {
      const ordered = orderedTasks(section);
      const last = ordered.at(-1);
      return [
        ...ordered.map((task, index) => taskRow(section, task, index, ordered)),
        // An empty writing row stays below both the skipped and regular tasks.
        last?.text.trim() || last?.done || last?.skipped || !ordered.length
          ? taskRow(section, draftFor(section), ordered.length, ordered, true) : null,
      ];
    }
    return () => h('div', { ref: root, class: 'todo-task-editor', style: todoDisplayStyles(props.display) }, [
      h('div', { class: 'todo-editor-toolbar' }, [
        h('div', { class: 'todo-sort-control', role: 'group', 'aria-label': 'Sort sections' }, [
          h('span', { class: 'todo-sort-label' }, 'Sort'),
          ...(['custom', 'name', 'priority'] as const).map(mode => h('button', {
            type: 'button', class: { 'is-active': sortMode.value === mode }, 'aria-pressed': sortMode.value === mode,
            onClick: () => setSortMode(mode),
          }, mode === 'custom' ? 'Custom' : mode[0]!.toUpperCase() + mode.slice(1))),
        ]),
        h('p', { class: 'todo-editor-progress' }, `${completed.value}/${count.value} done${skipped.value ? ` · ${skipped.value} skipped` : ''}`),
        undo.value ? h('button', { type: 'button', class: 'quiet-button', disabled: storedCount.value >= MAX_TASKS, onClick: restoreTask }, 'Undo remove') : null,
      ]),
      h('div', { class: ['todo-task-paper', { 'is-sorted': sortMode.value !== 'custom' }] }, [
        h('h2', { class: 'todo-paper-title' }, props.item.name),
        ...displaySections.value.map((section, sectionIndex) => h('section', {
        key: section.id, class: ['todo-task-section', { 'is-celebrating': celebratingSections.has(section.id) }],
        ref: element => {
          const previous = sectionElements.get(section.id);
          if (previous === element) return;
          if (previous) observer?.unobserve(previous);
          if (element instanceof HTMLElement) { sectionElements.set(section.id, element); observer?.observe(element); }
          else { sectionElements.delete(section.id); priorityHeights.delete(section.id); }
        }, 'aria-label': section.title || `Section ${sectionIndex + 1}` }, [
        celebratingSections.has(section.id) ? h('div', { class: 'todo-section-celebration', 'aria-hidden': 'true' }, [
          h('div', { class: 'todo-section-party' }, Array.from({ length: 18 }, (_, particle) =>
            h('span', { class: ['todo-party-piece', { 'is-star': particle % 5 === 0 }] }, particle % 5 === 0 ? '✦' : ''))),
        ]) : null,
        h('div', { class: 'todo-section-priority-area', style: { height: `${priorityHeights.get(section.id) ?? props.display.rowSpacing}px` } }, [
          h('label', { class: ['todo-section-priority-marker', { 'has-priority': !!sectionPriority(section) }] }, [
            h('span', { 'aria-hidden': 'true' }, 'P#'),
            h('input', { value: priorityNumber(sectionPriority(section)), maxlength: 10, inputmode: 'numeric', placeholder: '1',
              'aria-label': `Priority number for section ${section.title || sectionIndex + 1}`,
              title: 'Type a number, such as 1 for P#1',
              onInput: (event: Event) => { section.priority = formatPriority(inputValue(event)); },
            }),
          ]),
        ]),
        h('ul', { class: 'todo-task-rows' }, sectionRows(section)),
      ])),
      ]),
      h('p', { class: 'visually-hidden', role: 'status' }, message.value),
      pendingSection.value ? h(DeleteConfirmation, { itemName: pendingSection.value.title || 'Untitled section', itemLabel: 'section', detail: 'All tasks in this section will be removed.', confirmLabel: 'Delete section',
        onCancel: cancelSectionDelete, onConfirm: async () => {
          const deleting = pendingSection.value;
          const index = sections.value.findIndex(section => section.id === deleting?.id);
          if (index >= 0) sections.value.splice(index, 1);
          if (deleting) { completedSections.delete(deleting.id); stopSectionCelebration(deleting.id); }
          if (!sections.value.length) sections.value.push(newSection());
          undo.value = null; pendingSection.value = null; message.value = 'Section deleted.';
          const section = sections.value[Math.max(0, index - 1)]!;
          await focusTask((orderedTasks(section)[0] ?? draftFor(section)).id);
        },
      }) : null,
    ]);
  },
});
