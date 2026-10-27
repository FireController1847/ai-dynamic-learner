import { computed, defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { PopupDialog } from '../../components/popup-dialog.ts';
import type { TaskSet } from './library-model.ts';
import { createRound, nextCategory, remainingCount, roundTask, slotState, TASK_CATEGORIES, taskCount, type TaskCategory } from './task-model.ts';

type Phase = 'ready' | 'celebrating' | 'turning' | 'blank' | 'revealing' | 'complete';
const SAFETY_PAUSE_MS = 3000;
const DOUBLE_ACTIVATION_MS = 600;

export const TaskGrid = defineComponent({
  name: 'TaskGrid',
  props: { item: { type: Object as PropType<TaskSet>, required: true } },
  emits: { edit: () => true },
  setup(props, { emit }) {
    const lists = computed(() => props.item.lists!);
    if (!props.item.round) props.item.round = createRound(lists.value);
    const round = computed(() => props.item.round!);
    const current = computed(() => nextCategory(lists.value, round.value));
    const remaining = computed(() => remainingCount(lists.value));
    const total = computed(() => taskCount(lists.value));
    const latestDone = computed(() => [...TASK_CATEGORIES].reverse().find(category => slotState(lists.value, round.value, category.id) === 'done')?.id ?? null);
    const phase = ref<Phase>('ready');
    const announcement = ref('');
    const resetOpen = ref(false);
    const safetyLocked = ref(false);
    const blocked = ref<TaskCategory | null>(null);
    const buttons = new Map<TaskCategory, HTMLButtonElement>();
    const finishHeading = ref<HTMLElement | null>(null);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: number | undefined, safetyTimer: number | undefined, flashTimer: number | undefined;
    let lastActivation: { category: TaskCategory; at: number } | null = null;
    let active = false;
    function clearTimer() { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; }
    function clearSafety() {
      if (safetyTimer !== undefined) window.clearTimeout(safetyTimer);
      safetyTimer = undefined; safetyLocked.value = false; lastActivation = null;
    }
    function startSafety() {
      clearSafety(); safetyLocked.value = true;
      safetyTimer = window.setTimeout(() => { safetyTimer = undefined; safetyLocked.value = false; lastActivation = null; }, SAFETY_PAUSE_MS);
    }
    function clearFlash() {
      if (flashTimer !== undefined) window.clearTimeout(flashTimer);
      flashTimer = undefined; blocked.value = null;
    }
    function flash(category: TaskCategory, message: string) {
      clearFlash();
      blocked.value = category; announcement.value = message;
      flashTimer = window.setTimeout(() => { blocked.value = null; flashTimer = undefined; }, 1800);
    }
    function later(action: () => void, delay: number) { clearTimer(); timer = window.setTimeout(() => { timer = undefined; if (active) action(); }, delay); }
    function announceCurrent() {
      const entry = TASK_CATEGORIES.find(category => category.id === current.value);
      announcement.value = entry ? `Next: ${entry.number}, ${entry.label}. ${roundTask(lists.value, round.value, entry.id)?.text}` : 'Your grid is clear.';
    }
    async function focusCurrent() {
      await nextTick();
      if (active && current.value) buttons.get(current.value)?.focus();
      else if (active && phase.value === 'complete') finishHeading.value?.focus();
    }
    function revealNext() {
      clearSafety();
      props.item.round = createRound(lists.value, Math.min(Number.MAX_SAFE_INTEGER, round.value.number + 1));
      phase.value = 'blank';
      later(() => {
        phase.value = 'revealing';
        later(() => { phase.value = 'ready'; startSafety(); announceCurrent(); void focusCurrent(); }, reduced.matches ? 0 : 900);
      }, reduced.matches ? 0 : 240);
    }
    function cycle() {
      if (!active || phase.value !== 'ready' || current.value) return;
      const number = round.value.number;
      const stillCurrent = () => {
        if (round.value.number === number && !current.value) return true;
        phase.value = 'ready'; announceCurrent(); return false;
      };
      phase.value = 'celebrating'; announcement.value = 'Select the latest completed quadrant to undo.';
      later(() => {
        if (!stillCurrent()) return;
        if (!remaining.value) { phase.value = 'complete'; void focusCurrent(); return; }
        phase.value = 'turning';
        later(() => { if (stillCurrent()) revealNext(); }, reduced.matches ? 0 : 680);
      }, 2500);
    }
    function resume() {
      active = true;
      if (!current.value && !remaining.value) phase.value = 'complete';
      else { phase.value = 'ready'; if (!current.value) cycle(); else announceCurrent(); }
    }
    watch(() => props.item.round, value => {
      if (!value && props.item.lists) { clearTimer(); clearSafety(); props.item.round = createRound(props.item.lists); phase.value = 'ready'; }
    }, { flush: 'sync' });
    watch([current, remaining], () => {
      // Remote completions do not independently draw and save another round.
      if (active && phase.value === 'ready' && !current.value && !remaining.value) phase.value = 'complete';
      else if (active && phase.value === 'complete' && current.value) { phase.value = 'ready'; announceCurrent(); }
    });
    onMounted(resume);
    onActivated(() => { if (!active) resume(); });
    function suspend() {
      active = false; clearTimer(); clearSafety();
      clearFlash();
      resetOpen.value = false; phase.value = 'ready';
    }
    onDeactivated(suspend);
    onBeforeUnmount(suspend);
    function skippedBefore(category: TaskCategory) {
      const target = TASK_CATEGORIES.findIndex(entry => entry.id === category);
      return TASK_CATEGORIES.slice(0, target).filter(entry => slotState(lists.value, round.value, entry.id) === 'ready');
    }
    function complete(category: TaskCategory) {
      if (phase.value !== 'ready' || slotState(lists.value, round.value, category) !== 'ready') return;
      const previous = skippedBefore(category);
      for (const entry of previous) round.value.slots[entry.id].skipped = true;
      const task = roundTask(lists.value, round.value, category);
      if (!task) return;
      clearFlash(); clearSafety(); task.completed = true;
      announcement.value = `Completed: ${task.text}. Select this quadrant again to undo.`;
      if (current.value) void focusCurrent(); else cycle();
    }
    function undo(category: TaskCategory) {
      if (!['ready', 'celebrating', 'complete'].includes(phase.value)) return;
      if (latestDone.value !== category) {
        const latest = TASK_CATEGORIES.find(entry => entry.id === latestDone.value);
        flash(category, latest ? `Undo ${latest.label} first.` : 'There is no completed task to undo.'); return;
      }
      const task = roundTask(lists.value, round.value, category);
      if (!task) return;
      const index = TASK_CATEGORIES.findIndex(entry => entry.id === category);
      let previous = -1;
      for (let i = 0; i < index; i++) if (slotState(lists.value, round.value, TASK_CATEGORIES[i]!.id) === 'done') previous = i;
      // The route only advances, so skipped slots between the previous
      // completed quadrant and this one belong to the action being undone.
      for (let i = previous + 1; i < index; i++) delete round.value.slots[TASK_CATEGORIES[i]!.id].skipped;
      clearTimer(); clearSafety(); clearFlash();
      delete task.completed; phase.value = 'ready';
      announcement.value = `Undid ${task.text}.`;
      void focusCurrent();
    }
    function activate(category: TaskCategory, event: MouseEvent) {
      const state = slotState(lists.value, round.value, category);
      const now = Date.now();
      const requiresOverride = state === 'ready' && (safetyLocked.value || category !== current.value);
      // Double activation is the confirmation for both skipping and the pause.
      if (event.detail > 1 && !requiresOverride) return;
      if (state === 'done') {
        undo(category); return;
      }
      if (state !== 'ready' || phase.value !== 'ready') return;
      const deliberate = event.detail >= 2 || (lastActivation?.category === category && now - lastActivation.at <= DOUBLE_ACTIVATION_MS);
      if (requiresOverride && !deliberate) {
        lastActivation = { category, at: now };
        flash(category, category !== current.value
          ? 'Double-click or double-tap to skip ahead. Earlier tasks will stay available.'
          : 'Brief safety pause. Double-click, double-tap, or activate twice quickly to override.'); return;
      }
      lastActivation = null; complete(category);
    }
    function reset() {
      clearTimer(); clearSafety(); clearFlash();
      for (const category of TASK_CATEGORIES) for (const task of lists.value[category.id]) delete task.completed;
      props.item.round = createRound(lists.value);
      phase.value = 'ready'; resetOpen.value = false; announceCurrent(); void focusCurrent();
    }
    return () => h('div', { class: 'sig-play' }, [
      h('figure', { class: ['sig-chart', `is-${phase.value}`], 'aria-label': 'Solve-It Grid: stimulation increases upward; fun increases to the right.' }, [
        h('span', { class: 'sig-axis sig-axis-top', 'aria-hidden': true }, [h(Icon, { name: 'arrow-up' }), h('span', 'Stimulation')]),
        h('span', { class: 'sig-axis sig-axis-bottom', 'aria-hidden': true }, [h(Icon, { name: 'arrow-down' }), h('span', 'No stimulation')]),
        h('span', { class: 'sig-axis sig-axis-left', 'aria-hidden': true }, [h(Icon, { name: 'arrow-left' }), h('span', 'No fun')]),
        h('span', { class: 'sig-axis sig-axis-right', 'aria-hidden': true }, [h(Icon, { name: 'arrow-right' }), h('span', 'Fun')]),
        h('div', { class: 'sig-grid-board', 'aria-busy': ['turning', 'blank', 'revealing'].includes(phase.value) }, TASK_CATEGORIES.map(category => {
          const task = roundTask(lists.value, round.value, category.id);
          const state = slotState(lists.value, round.value, category.id);
          const next = category.id === current.value;
          const locked = state === 'ready' && (safetyLocked.value || !next);
          const canUndo = state === 'done' && latestDone.value === category.id;
          return h('button', {
            key: category.id, type: 'button',
            ref: element => { if (element instanceof HTMLButtonElement) buttons.set(category.id, element); else buttons.delete(category.id); },
            class: ['sig-quadrant', `sig-${category.id}`, `is-${state}`, { 'is-current': next, 'is-locked': locked, 'is-blocked': blocked.value === category.id, 'can-undo': canUndo }],
            style: { '--reveal-delay': `${(category.number - 1) * 160}ms` },
            disabled: state === 'empty' || state === 'skipped' || ['turning', 'blank', 'revealing'].includes(phase.value),
            'aria-label': `${category.number}. ${category.label}. ${task?.text ?? 'Empty'}. ${state === 'ready' ? locked ? next ? 'Safety pause. Activate twice quickly to complete.' : 'Activate twice quickly to skip ahead; earlier tasks remain available.' : 'Next task. Complete.' : state === 'done' ? canUndo ? 'Completed. Activate to undo.' : 'Completed. Undo the later quadrant first.' : state === 'skipped' ? 'Skipped for now.' : 'Empty'}`,
            onClick: (event: MouseEvent) => activate(category.id, event),
            onKeydown: (event: KeyboardEvent) => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault(); },
          }, [
            h('span', { class: 'sig-number sig-quadrant-number', 'aria-hidden': true }, category.number),
            h('span', { class: 'sig-quadrant-heading' }, [
              h(Icon, { name: category.icon }), h('span', category.label),
            ]),
            h('span', { class: 'sig-task-content', key: task?.id ?? 'empty' }, [
              h('span', { class: 'sig-task-text' }, task?.text ?? 'Nothing here for now.'),
            ]),
            state === 'done' ? h('span', { class: 'sig-completed-check', 'aria-hidden': true }, [h(Icon, { name: 'check' })]) : null,
            state === 'ready' || blocked.value === category.id ? h('span', {
              class: ['sig-click-cue', { 'sig-safety-lock': locked || blocked.value === category.id }], 'aria-hidden': true,
            }, [h(Icon, { name: locked || blocked.value === category.id ? 'lock' : 'check' })]) : null,
            locked ? h('span', { class: 'sig-lock-tooltip', 'aria-hidden': true }, [
              h('span', 'Click again to finish'),
              !next ? h('span', 'Skips earlier tasks') : null,
            ]) : null,
            state === 'skipped' ? h('span', { class: 'sig-later-label' }, 'Later') : null,
          ]);
        })),
        phase.value === 'celebrating' ? h('div', { class: 'sig-round-burst', 'aria-hidden': true }, Array.from({ length: 16 }, (_, index) => h('i', { style: { '--particle': index } }))) : null,
      ]),
      phase.value === 'complete' ? h('section', { class: 'sig-completion' }, [
        h('h3', { ref: finishHeading, tabindex: -1 }, total.value ? 'Clear for now.' : 'Your lists are empty.'),
        h('div', { class: 'sig-play-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') }, 'Edit lists'),
          total.value ? h('button', { type: 'button', class: 'quiet-button', onClick: () => { resetOpen.value = true; } }, 'Start again') : null,
        ]),
      ]) : phase.value === 'ready' && !current.value && remaining.value ? h('div', { class: 'sig-play-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: cycle }, 'Continue'),
      ]) : h('p', { class: 'sig-play-help' }, safetyLocked.value ? 'Briefly paused. Double-click or double-tap a locked task to complete it anyway.' : 'Select a task to complete it; double-click a lock to skip ahead. Select the latest check to undo.'),
      h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' }, announcement.value),
      resetOpen.value ? h(PopupDialog, { title: 'Start this task set again?', headingId: 'sig-reset-title', onClose: () => { resetOpen.value = false; } }, { default: () => [
        h('p', 'This clears the completion marks and chooses fresh tasks. Your four lists stay saved.'),
        h('div', { class: 'sig-dialog-actions' }, [h('button', { type: 'button', class: 'quiet-button', onClick: () => { resetOpen.value = false; } }, 'Cancel'), h('button', { type: 'button', class: 'card-primary-button', onClick: reset }, 'Start again')]),
      ] }) : null,
    ]);
  },
});
