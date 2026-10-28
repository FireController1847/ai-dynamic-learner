import { computed, defineComponent, h, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { PopupDialog } from '../../components/popup-dialog.ts';
import { GridConstruction } from './grid-construction.ts';
import { TaskCheckIn } from './task-check-in.ts';
import { MAX_ROUND_HISTORY, type TaskSet, type CheckInMode } from './library-model.ts';
import { createRound, markCompleted, nextCategory, remainingCount, roundTask, slotState, TASK_CATEGORIES, taskAvailable, taskCount, undoCompleted, categoryValues, type TaskCategory, type GridRound } from './task-model.ts';

type Phase = 'ready' | 'celebrating' | 'turning' | 'constructing' | 'revealing' | 'complete';
const ROUND_HOLD_MS = 650;
const ROUND_TURN_MS = 380;
const ROUND_REVEAL_MS = 450;
const DOUBLE_ACTIVATION_MS = 600;

export const TaskGrid = defineComponent({
  name: 'TaskGrid',
  props: { item: { type: Object as PropType<TaskSet>, required: true } },
  emits: { edit: () => true },
  setup(props, { emit }) {
    const lists = computed(() => props.item.lists!);
    if (!props.item.round) props.item.round = createRound(lists.value);
    const round = computed(() => props.item.round!);
    const history = computed(() => props.item.history ?? []);
    const viewing = ref<number | null>(null);
    const working = ref<TaskCategory | null>(props.item.checkIn?.category ?? null);
    const now = ref(Date.now());
    const activeCheckIn = computed(() => {
      const state = props.item.checkIn, category = working.value;
      return category && state?.category === category && round.value.number === state.roundNumber &&
        round.value.slots[category].taskId === state.taskId ? state : null;
    });
    const shownRound = computed(() => viewing.value === null ? round.value : history.value[viewing.value] ?? round.value);
    const shownCurrent = computed(() => nextCategory(lists.value, shownRound.value));
    const shownLatestDone = computed(() => [...TASK_CATEGORIES].reverse()
      .find(category => slotState(lists.value, shownRound.value, category.id) === 'done')?.id ?? null);
    const current = computed(() => nextCategory(lists.value, round.value));
    const remaining = computed(() => remainingCount(lists.value));
    const latestDone = computed(() => [...TASK_CATEGORIES].reverse()
      .find(category => slotState(lists.value, round.value, category.id) === 'done')?.id ?? null);
    const total = computed(() => taskCount(lists.value));
    const phase = ref<Phase>('ready');
    const announcement = ref('');
    const resetOpen = ref(false);
    const rewindOpen = ref(false);
    const justCompleted = ref<TaskCategory | null>(null);
    const workFinishing = ref(false);
    const blocked = ref<TaskCategory | null>(null);
    const buttons = new Map<TaskCategory, HTMLButtonElement>();
    const finishHeading = ref<HTMLElement | null>(null);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer: number | undefined, checkTimer: number | undefined, flashTimer: number | undefined;
    let workFinishTimer: number | undefined;
    function stopWorkFinish() {
      if (workFinishTimer !== undefined) window.clearTimeout(workFinishTimer);
      workFinishTimer = undefined;
      workFinishing.value = false;
    }
    let clockTimer: number | undefined;
    function startClock() {
      stopClock(); now.value = Date.now();
      clockTimer = window.setInterval(() => { now.value = Date.now(); }, 1000);
    }
    function stopClock() {
      if (clockTimer !== undefined) window.clearInterval(clockTimer);
      clockTimer = undefined;
    }
    let lastActivation: { category: TaskCategory; at: number } | null = null;
    let active = false;
    function clearTimer() { if (timer !== undefined) window.clearTimeout(timer); timer = undefined; }
    function clearCheck() {
      if (checkTimer !== undefined) window.clearTimeout(checkTimer);
      checkTimer = undefined; justCompleted.value = null;
    }
    function celebrateCheck(category: TaskCategory) {
      clearCheck(); justCompleted.value = category;
      checkTimer = window.setTimeout(() => { checkTimer = undefined; justCompleted.value = null; }, 700);
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
      if (active && viewing.value === null && current.value) buttons.get(current.value)?.focus();
      else if (active && phase.value === 'complete') finishHeading.value?.focus();
    }
    function snapshot(value: GridRound): GridRound {
      return { number: value.number, slots: categoryValues(category => ({ ...value.slots[category.id] })) };
    }
    function showNewItems() {
      if (!active || phase.value !== 'constructing') return;
      phase.value = 'revealing';
      announceCurrent();
      later(() => { phase.value = 'ready'; void focusCurrent(); }, ROUND_REVEAL_MS);
    }
    function revealNext() {
      delete props.item.checkIn;
      working.value = null;
      clearCheck();
      const previous = snapshot(round.value);
      props.item.history = [...history.value, previous].slice(-MAX_ROUND_HISTORY);
      props.item.round = createRound(lists.value, Math.min(Number.MAX_SAFE_INTEGER, previous.number + 1));
      if (reduced.matches) {
        phase.value = 'ready';
        announceCurrent();
        void focusCurrent();
      } else {
        phase.value = 'constructing';
        announcement.value = 'Preparing the next set of items.';
      }
    }
    function cycle(skipGridCelebration = false) {
      if (!active || viewing.value !== null || phase.value !== 'ready' || current.value) return;
      const number = round.value.number;
      const stillCurrent = () => {
        if (round.value.number === number && !current.value && viewing.value === null) return true;
        phase.value = 'ready'; announceCurrent(); return false;
      };
      const proceed = () => {
        if (!stillCurrent()) return;
        if (!remaining.value) { phase.value = 'complete'; void focusCurrent(); return; }
        phase.value = 'turning';
        later(() => { if (stillCurrent()) revealNext(); }, reduced.matches ? 0 : ROUND_TURN_MS);
      };
      if (skipGridCelebration) {
        // The work screen already celebrated completion. Transition straight
        // toward the next draw without a second burst or grid pulse.
        proceed();
      } else {
        phase.value = 'celebrating'; announcement.value = 'You can still undo the latest check.';
        later(proceed, reduced.matches ? 250 : ROUND_HOLD_MS);
      }
    }
    function resume() {
      active = true;
      startClock();
      viewing.value = null;
      working.value = props.item.checkIn?.category ?? null;
      if (!current.value && !remaining.value) phase.value = 'complete';
      else {
        phase.value = 'ready';
        if (!current.value) cycle();
        else {
          announceCurrent();
        }
      }
    }
    watch(() => props.item.round, value => {
      if (!value && props.item.lists) {
        clearTimer(); clearCheck(); viewing.value = null;
        working.value = null; delete props.item.checkIn;
        props.item.round = createRound(props.item.lists);
        phase.value = 'ready';
        if (active) announceCurrent();
      }
    }, { flush: 'sync' });
    watch([current, remaining], () => {
      // Hold the work-screen celebration before navigating to the grid.
      if (workFinishing.value) return;
      // Remote completions do not independently draw and save another round.
      if (active && viewing.value === null && phase.value === 'ready' && !current.value && !remaining.value) phase.value = 'complete';
      else if (active && viewing.value === null && phase.value === 'complete' && current.value) { phase.value = 'ready'; announceCurrent(); }
    });
    watch(() => props.item.history?.length ?? 0, length => {
      // Another tab may replace/remove history while an older round is open.
      if (viewing.value !== null && viewing.value >= length) {
        viewing.value = null; rewindOpen.value = false;
        if (active) resume();
      }
    });
    onMounted(resume);
    onActivated(() => { if (!active) resume(); });
    function suspend() {
      active = false; stopWorkFinish(); clearTimer(); clearCheck(); stopClock();
      clearFlash(); working.value = null;
      resetOpen.value = false; rewindOpen.value = false; viewing.value = null; phase.value = 'ready';
    }
    onDeactivated(suspend);
    onBeforeUnmount(suspend);
    function previousRound() {
      if (!history.value.length || viewing.value === 0) return;
      clearTimer(); clearCheck(); clearFlash();
      phase.value = 'ready'; working.value = null;
      viewing.value = viewing.value === null ? history.value.length - 1 : viewing.value - 1;
      announcement.value = 'Viewing an earlier point. Use Next to move forward, or Return to this point to restore it.';
    }
    function nextRound() {
      if (viewing.value === null) return;
      const next = viewing.value + 1;
      viewing.value = next < history.value.length ? next : null;
      if (viewing.value === null) { resume(); void focusCurrent(); }
      else announcement.value = 'Viewing an earlier point.';
    }
    function rewind() {
      const index = viewing.value;
      if (index === null || !history.value[index]) return;
      const selected = snapshot(history.value[index]);
      const discarded = [...history.value.slice(index + 1), round.value];
      clearTimer(); clearCheck(); clearFlash(); working.value = null;
      delete props.item.checkIn;
      for (const laterRound of discarded.reverse()) {
        for (const category of TASK_CATEGORIES) {
          const task = roundTask(lists.value, laterRound, category.id);
          if (task) undoCompleted(task, laterRound.slots[category.id]);
        }
      }
      props.item.round = selected;
      props.item.history = history.value.slice(0, index);
      viewing.value = null; rewindOpen.value = false; phase.value = 'ready';
      const last = [...TASK_CATEGORIES].reverse()
        .find(category => slotState(lists.value, selected, category.id) === 'done');
      if (last) undo(last.id);
      else {
        // Historical grids can contain only skipped items (e.g. when a user
        // chose something else in each quadrant). Reopen the latest skipped
        // item so returning here remains actionable instead of immediately
        // rotating into a different grid.
        if (!current.value) {
          const skipped = [...TASK_CATEGORIES].reverse().find(category =>
            selected.slots[category.id].skipped && roundTask(lists.value, selected, category.id));
          if (skipped) delete round.value.slots[skipped.id].skipped;
        }
        announceCurrent();
        void focusCurrent();
      }
    }
    function skippedBefore(category: TaskCategory) {
      const target = TASK_CATEGORIES.findIndex(entry => entry.id === category);
      return TASK_CATEGORIES.slice(0, target).filter(entry => slotState(lists.value, round.value, entry.id) === 'ready');
    }
    function complete(category: TaskCategory, celebrateInWork = false) {
      if (viewing.value !== null || phase.value !== 'ready' || slotState(lists.value, round.value, category) !== 'ready') return;
      const task = roundTask(lists.value, round.value, category);
      if (!task || !taskAvailable(task)) return;
      const previous = skippedBefore(category);
      for (const entry of previous) round.value.slots[entry.id].skipped = true;
      clearFlash(); delete props.item.checkIn;
      markCompleted(task, round.value.slots[category]);
      if (celebrateInWork) {
        // Save completion immediately, but hold the full-screen check celebration
        // before returning to the grid. Reloading will retain this completion.
        announcement.value = `Completed: ${task.text}.`;
        return;
      }
      working.value = null; celebrateCheck(category);
      announcement.value = `Completed: ${task.text}. Select this quadrant again to undo.`;
      if (current.value) void focusCurrent(); else cycle();
    }
    function undo(category: TaskCategory) {
      if (viewing.value !== null || !['ready', 'celebrating', 'complete'].includes(phase.value)) return;
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
      clearTimer(); clearCheck(); clearFlash();
      undoCompleted(task, round.value.slots[category]); phase.value = 'ready';
      announcement.value = `Undid ${task.text}.`;
      void focusCurrent();
    }
    function activate(category: TaskCategory, event: MouseEvent) {
      if (viewing.value !== null) return;
      const state = slotState(lists.value, round.value, category);
      const now = Date.now();
      const requiresOverride = state === 'ready' && category !== current.value;
      // A second deliberate activation is required only to skip ahead.
      if (event.detail > 1 && !requiresOverride) return;
      if (state === 'done') {
        undo(category); return;
      }
      if (state !== 'ready' || !['ready', 'revealing'].includes(phase.value)) return;
      const deliberate = event.detail >= 2 || (lastActivation?.category === category && now - lastActivation.at <= DOUBLE_ACTIVATION_MS);
      if (requiresOverride && !deliberate) {
        lastActivation = { category, at: now };
        flash(category, 'Double-click or double-tap to skip ahead. Earlier tasks will stay available.'); return;
      }
      // The reveal animates visually, but never imposes a second unlock delay.
      if (phase.value === 'revealing') { clearTimer(); phase.value = 'ready'; }
      lastActivation = null;
      working.value = category;
      announcement.value = `Work on: ${roundTask(lists.value, round.value, category)?.text ?? ''}`;
    }
    function startWorking(mode: CheckInMode, minutes: number) {
      const category = working.value;
      if (!category || viewing.value !== null || phase.value !== 'ready') return;
      const task = roundTask(lists.value, round.value, category);
      if (!task || slotState(lists.value, round.value, category) !== 'ready') return;
      const time = Date.now(), duration = mode === 'completion' ? 60 : minutes;
      props.item.checkIn = { category, taskId: task.id, roundNumber: round.value.number,
        mode, minutes: duration, startedAt: time, remindAt: time + duration * 60000 };
      now.value = time;
      announcement.value = 'You can work on this and check back in later.';
    }
    function keepWorking() {
      const state = activeCheckIn.value;
      if (!state) return;
      const time = Date.now();
      props.item.checkIn = { ...state, remindAt: time + state.minutes * 60000 };
      now.value = time;
      announcement.value = 'We will check in with you again later.';
    }
    function moveOn() {
      const category = working.value;
      if (!category || viewing.value !== null || phase.value !== 'ready' ||
        slotState(lists.value, round.value, category) !== 'ready') return;
      const task = roundTask(lists.value, round.value, category);
      for (const previous of skippedBefore(category)) round.value.slots[previous.id].skipped = true;
      round.value.slots[category].skipped = true;
      delete props.item.checkIn; working.value = null; clearFlash();
      announcement.value = `Leaving ${task?.text ?? 'this item'} available for later.`;
      if (current.value) void focusCurrent(); else cycle();
    }
    function finishWorking() {
      const category = working.value;
      if (!category || workFinishing.value || viewing.value !== null ||
          phase.value !== 'ready' || slotState(lists.value, round.value, category) !== 'ready') return;
      const task = roundTask(lists.value, round.value, category);
      if (!task || !taskAvailable(task)) return;
      const finishedRound = round.value.number;
      workFinishing.value = true;
      complete(category, true);
      workFinishTimer = window.setTimeout(() => {
        workFinishTimer = undefined;
        workFinishing.value = false;
        working.value = null;
        if (!active || round.value.number !== finishedRound || viewing.value !== null) return;
        // The fullscreen success is the only completion celebration.
        // A completed quadrant keeps a static check after returning.
        if (current.value) void focusCurrent(); else cycle(true);
      }, reduced.matches ? 350 : 1120);
    }
    function returnToGrid() {
      working.value = null;
      announceCurrent();
      void focusCurrent();
    }
    function reset() {
      stopWorkFinish(); delete props.item.checkIn; working.value = null;
      clearTimer(); clearCheck(); clearFlash();
      for (const category of TASK_CATEGORIES) for (const task of lists.value[category.id]) {
        delete task.completed; delete task.timesCompleted;
      }
      props.item.round = createRound(lists.value);
      delete props.item.history;
      viewing.value = null;
      phase.value = 'ready'; resetOpen.value = false; announceCurrent(); void focusCurrent();
    }
    return () => h('div', { class: 'sig-play' }, [
      working.value !== null && viewing.value === null && phase.value === 'ready'
        ? h(TaskCheckIn, {
          key: `${round.value.number}-${working.value}`,
          categoryLabel: TASK_CATEGORIES.find(category => category.id === working.value)?.label ?? '',
          taskText: roundTask(lists.value, round.value, working.value)?.text ?? '',
          focus: activeCheckIn.value, now: now.value,
          completed: workFinishing.value,
          onBack: returnToGrid, onStart: startWorking,
          onContinue: keepWorking, onMoveOn: moveOn, onDone: finishWorking,
        }) : h('figure', { class: ['sig-chart', `is-${phase.value}`, { 'is-history': viewing.value !== null }], 'aria-label': 'Solve-It Grid: stimulation increases upward; fun increases to the right.' }, [
        h('span', { class: 'sig-axis sig-axis-top', 'aria-hidden': true }, [h(Icon, { name: 'arrow-up' }), h('span', 'Stimulation')]),
        h('span', { class: 'sig-axis sig-axis-bottom', 'aria-hidden': true }, [h(Icon, { name: 'arrow-down' }), h('span', 'No stimulation')]),
        h('span', { class: 'sig-axis sig-axis-left', 'aria-hidden': true }, [h(Icon, { name: 'arrow-left' }), h('span', 'No fun')]),
        h('span', { class: 'sig-axis sig-axis-right', 'aria-hidden': true }, [h(Icon, { name: 'arrow-right' }), h('span', 'Fun')]),
        h('div', { class: 'sig-grid-board', 'aria-busy': ['turning', 'constructing', 'revealing'].includes(phase.value) }, [
          ...TASK_CATEGORIES.map(category => {
          const task = roundTask(lists.value, shownRound.value, category.id);
          const state = slotState(lists.value, shownRound.value, category.id);
          const next = category.id === shownCurrent.value;
          const locked = state === 'ready' && (viewing.value !== null || !next);
          const canUndo = state === 'done' && viewing.value === null && shownLatestDone.value === category.id;
          return h('button', {
            key: category.id, type: 'button',
            ref: element => { if (element instanceof HTMLButtonElement) buttons.set(category.id, element); else buttons.delete(category.id); },
            class: ['sig-quadrant', `sig-${category.id}`, `is-${state}`, { 'is-current': next, 'is-locked': locked, 'is-blocked': blocked.value === category.id, 'is-popping': justCompleted.value === category.id && viewing.value === null, 'can-undo': canUndo }],
            style: { '--reveal-delay': `${(category.number - 1) * 65}ms` },
            disabled: viewing.value !== null || state === 'empty' || state === 'skipped' ||
              phase.value === 'turning' || phase.value === 'constructing',
            'aria-label': `${category.number}. ${category.label}. ${task?.text ?? 'Empty'}. ${viewing.value !== null ? 'Earlier point, read-only. Use Return to this point to change progress.' : state === 'ready' ? locked ? 'Activate twice quickly to skip ahead; earlier tasks remain available.' : 'Next item. Select to work on it.' : state === 'done' ? canUndo ? 'Completed. Activate to undo.' : 'Completed. Undo the later quadrant first.' : state === 'skipped' ? 'Skipped for now.' : 'Empty'}`,
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
            state === 'done' ? h('span', { class: 'sig-completed-check', 'aria-hidden': true }, [
              h(Icon, { name: 'check' }),
              justCompleted.value === category.id && viewing.value === null
                ? h('span', { class: 'sig-check-sparkles' }, Array.from({ length: 8 }, (_, index) =>
                  h('i', { style: { '--spark-angle': `${index * 45}deg` } }))) : null,
            ]) : null,
            state === 'ready' ? h('span', {
              class: ['sig-click-cue', { 'sig-safety-lock': locked || blocked.value === category.id }], 'aria-hidden': true,
            }, [h(Icon, { name: locked || blocked.value === category.id ? 'lock' : 'arrow-right' })]) : null,
            // Keep the tooltip mounted while ready, so unblocking can use its
            // intentional one-second fade instead of abruptly removing the element.
            state === 'ready' ? h('span', { class: 'sig-lock-tooltip', 'aria-hidden': true }, [
              h('span', next ? 'Open to work on this' : 'Double-click to skip ahead'),
              !next ? h('span', 'Earlier tasks stay available') : null,
            ]) : null,
            state === 'skipped' ? h('span', { class: 'sig-later-label' }, 'Later') : null,
          ]);
          }),
        ]),
        phase.value === 'celebrating' ? h('div', { class: 'sig-round-burst', 'aria-hidden': true }, Array.from({ length: 16 }, (_, index) => h('i', { style: { '--particle': index } }))) : null,
      ]),
      working.value === null && phase.value === 'constructing' ? h(GridConstruction, { onFinished: showNewItems }) : null,
      working.value === null && viewing.value === null && props.item.checkIn && phase.value === 'ready'
        ? h('button', { type: 'button', class: 'quiet-button sig-checkin-return',
          onClick: () => { working.value = props.item.checkIn?.category ?? null; } },
          [h(Icon, { name: 'heart' }),
            now.value >= props.item.checkIn.remindAt ? 'Time for a gentle check-in' : 'Return to what you were doing'])
        : null,
      working.value === null && history.value.length ? h('nav', { class: 'sig-round-navigation', 'aria-label': 'Grid navigation' }, [
         h('button', { type: 'button', class: 'quiet-button', disabled: viewing.value === 0,
           onClick: previousRound, title: 'Previous' }, [h(Icon, { name: 'arrow-left' }), 'Previous']),
         viewing.value !== null ? h('button', { type: 'button', class: 'quiet-button',
           onClick: nextRound, title: 'Next' }, ['Next', h(Icon, { name: 'arrow-right' })]) : null,
         viewing.value !== null ? h('button', { type: 'button', class: 'quiet-button sig-round-rewind',
           onClick: () => { rewindOpen.value = true; } }, 'Return to this point') : null,
       ]) : null,
       working.value === null && phase.value === 'complete' ? h('section', { class: 'sig-completion' }, [
        h('h3', { ref: finishHeading, tabindex: -1 }, total.value ? 'Clear for now.' : 'Your lists are empty.'),
        h('div', { class: 'sig-play-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') }, 'Edit lists'),
          total.value ? h('button', { type: 'button', class: 'quiet-button', onClick: () => { resetOpen.value = true; } }, 'Start again') : null,
        ]),
      ]) : working.value === null && phase.value === 'ready' && viewing.value === null && !current.value && remaining.value ? h('div', { class: 'sig-play-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: cycle }, 'Continue'),
      ]) : null,
      h('p', { class: 'visually-hidden', role: 'status', 'aria-live': 'polite' }, announcement.value),
      rewindOpen.value && viewing.value !== null ? h(PopupDialog, {
        title: 'Return to this point?', headingId: 'sig-rewind-title',
        onClose: () => { rewindOpen.value = false; },
      }, { default: () => [
        h('p', 'Anything completed after this point will become available again. The latest check here will also be undone. Your items and lists will stay saved.'),
        h('div', { class: 'sig-dialog-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { rewindOpen.value = false; } }, 'Cancel'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: rewind }, 'Return to this point'),
        ]),
      ] }) : null,
      resetOpen.value ? h(PopupDialog, { title: 'Start this task set again?', headingId: 'sig-reset-title', onClose: () => { resetOpen.value = false; } }, { default: () => [
        h('p', 'This clears the completion marks and chooses fresh tasks. Your four lists stay saved.'),
        h('div', { class: 'sig-dialog-actions' }, [h('button', { type: 'button', class: 'quiet-button', onClick: () => { resetOpen.value = false; } }, 'Cancel'), h('button', { type: 'button', class: 'card-primary-button', onClick: reset }, 'Start again')]),
      ] }) : null,
    ]);
  },
});
