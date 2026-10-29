import { defineComponent, h, ref, Transition, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { CHECK_IN_MINUTES, type ActiveCheckIn, type CheckInMode } from './library-model.ts';
import { MAX_RESUME_NOTE_LENGTH } from './task-model.ts';
import { previewCheckInNotification } from './check-in-notifications.ts';

export const TaskCheckIn = defineComponent({
  name: 'TaskCheckIn',
  props: {
    taskText: { type: String, required: true },
    categoryLabel: { type: String, required: true },
    focus: { type: Object as PropType<ActiveCheckIn | null>, default: null },
    now: { type: Number, required: true },
    completed: { type: Boolean, default: false },
    resumeNote: { type: String, default: '' },
  },
  emits: {
    back: () => true,
    start: (_mode: CheckInMode, _minutes: number) => true,
    continue: () => true,
    moveOn: () => true,
    done: () => true,
    noteChange: (_text: string) => true,
  },
  setup(props, { emit }) {
    const mode = ref<CheckInMode>('both');
    const minutes = ref<number>(25);
    const preview = ref(false);
    const previewMessage = ref('Preview only — no reminder has been scheduled.');
    function closePreview() { preview.value = false; }
    function previewReminder() {
      // Open the in-app preview immediately. The same click requests browser
      // permission if needed, then attempts the sample system notification.
      preview.value = true;
      previewMessage.value = 'Preview only — no reminder has been scheduled.';
      void previewCheckInNotification().then(result => {
        if (!preview.value) return;
        previewMessage.value = result === 'sent'
          ? 'Preview only — a sample system notification was requested. No reminder has been scheduled.'
          : result === 'denied'
            ? 'Preview only — browser notifications are blocked. You can enable them in your browser settings.'
            : result === 'unsupported'
              ? 'Preview only — system notifications are unavailable in this browser or context.'
              : 'Preview only — the browser could not send a system notification. The in-app check-in still works.';
      });
    }
    function doneButton() {
      // The full-screen completion is the only celebration. Saving begins
      // immediately; no second button animation or artificial click delay.
      return h('button', {
        type: 'button',
        class: 'sig-work-done-button',
        'aria-label': 'Mark this item finished',
        onClick: () => {
          if (preview.value && !props.focus) { closePreview(); return; }
          if (!props.completed) emit('done');
        },
      }, [
        h(Icon, { name: 'check' }),
        h('span', 'I’m finished'),
      ]);
    }
    function reflection(count: number) {
      if (count === 0) return null;
      const more = count >= 2;
      return h('div', { class: 'sig-work-reflection', role: 'status' }, [
        h('span', { class: 'sig-work-reflection-count' },
          `Kept going ${count} ${count === 1 ? 'time' : 'times'}`),
        h('p', more
          ? 'You’ve chosen to keep going a few times. What feels important about continuing right now?'
          : 'You’ve chosen to keep going. What would you like more time for?'),
        h('p', 'This unfinished item WILL remain available to resume later. Switching activities won’t mark it complete.'),
        h('p', 'A quick note about where you stopped can make picking it up again easier.'),
      ]);
    }
    function resumeNoteField() {
      return h('div', { class: 'sig-work-resume-note' }, [
        h('label', { for: 'sig-resume-note' }, 'Where I left off (optional)'),
        h('textarea', {
          id: 'sig-resume-note', rows: 2, maxlength: MAX_RESUME_NOTE_LENGTH,
          value: props.resumeNote,
          placeholder: 'A thought, next move, or anything worth remembering…',
          onInput: (event: Event) => {
            if (event.target instanceof HTMLTextAreaElement) emit('noteChange', event.target.value);
          },
        }),
        h('small', 'Saved with this item in this browser, so it’s here when you return. Save any work in other apps separately.'),
      ]);
    }
    const modes: { id: CheckInMode; label: string; detail: string }[] = [
      { id: 'time', label: 'Time', detail: 'Check in after a little while.' },
      { id: 'completion', label: 'Until finished', detail: 'Mark it done whenever you’re ready. Get a reminder after an hour.' },
      { id: 'both', label: 'Both', detail: 'A gentle time reminder and a finish control.' },
    ];
    return () => {
      if (props.completed) return h('section', {
        class: 'sig-work sig-work-finished', 'aria-label': 'Item completed',
      }, [
        h('div', { class: 'sig-work-success', role: 'status' }, [
          h('div', { class: 'sig-work-success-art', 'aria-hidden': true }, [
            h('span', { class: 'sig-work-success-halo' }),
            h('span', { class: 'sig-work-success-mark' }, [h(Icon, { name: 'check' })]),
            h('span', { class: 'sig-work-success-sparks' }, Array.from({ length: 12 }, (_, index) =>
              h('i', { style: { '--spark-angle': `${index * 30}deg` } }))),
          ]),
          h('h3', 'Nicely done!'),
          h('p', props.taskText),
        ]),
      ]);
      const focus = props.focus;
      const previewing = !focus && preview.value;
      const due = previewing || (!!focus && props.now >= focus.remindAt);
      return h('section', { class: 'sig-work', 'aria-label': 'Work on an item' }, [
        h('div', { class: 'sig-work-top' }, [
          h('button', { type: 'button', class: 'quiet-button',
            onClick: () => { if (previewing) closePreview(); else emit('back'); } },
            [h(Icon, { name: 'arrow-left' }), previewing ? 'Back to choices' : 'Back to grid']),
          h('span', { class: 'sig-work-category' }, props.categoryLabel),
        ]),
        h('div', { class: 'sig-work-main' }, [
          h('p', { class: 'sig-work-eyebrow' }, 'One thing at a time'),
          h('h3', props.taskText),
          h(Transition, { name: 'sig-work-stage', mode: 'out-in' }, { default: () =>
            !focus && !previewing ? h('div', { key: 'setup', class: 'sig-work-setup' }, [
            h('p', 'What would help you check back in with yourself? You can always switch activities without finishing.'),
            h('div', { class: 'sig-work-modes', role: 'group', 'aria-label': 'Check-in style' }, modes.map(option =>
              h('button', { type: 'button', class: ['sig-work-mode', { 'is-selected': option.id === mode.value }],
                'aria-pressed': mode.value === option.id, onClick: () => { mode.value = option.id; } },
              [h('strong', option.label), h('small', option.detail)]))),
            h(Transition, { name: 'sig-work-suboption', mode: 'out-in' }, { default: () =>
              mode.value !== 'completion' ? h('div', { key: 'time', class: 'sig-work-timing' }, [
              h('strong', 'Check in after'),
              h('div', { class: 'sig-work-durations', role: 'group', 'aria-label': 'Check-in time' },
                [
                  ...CHECK_IN_MINUTES.map(n => h('button', { type: 'button',
                    class: ['sig-duration', { 'is-selected': minutes.value === n }],
                    'aria-pressed': minutes.value === n, onClick: () => { minutes.value = n; } }, `${n} min`)),
                  h('button', { type: 'button', class: 'sig-work-preview-button',
                    title: 'Preview the check-in and send a sample system notification',
                    'aria-label': 'Preview the check-in and send a test system notification',
                    onClick: previewReminder,
                  }, [h(Icon, { name: 'volume-2' })]),
                ]),
            ]) : h('p', { key: 'reminder', class: 'sig-work-reminder' }, 'A gentle reminder after one hour, even if you are not finished.'),
            }),
            h('button', { type: 'button', class: 'card-primary-button sig-work-start',
              onClick: () => emit('start', mode.value, minutes.value) }, [h(Icon, { name: 'play' }), 'Start working']),
          ]) : due ? h('div', { key: 'checkin', class: 'sig-work-checkin', role: 'status' }, [
            previewing ? h('p', { class: 'sig-work-preview-caption', role: 'status' },
              previewMessage.value) : null,
            h(Icon, { name: 'heart' }),
            h('h4', 'How are you feeling about what you are doing?'),
            h('p', 'You have spent some time here. Nothing has to be finished now.'),
            !previewing && focus ? reflection(focus.keepGoingCount ?? 0) : null,
            h('div', { class: 'sig-work-choices' }, [
              h('button', { type: 'button', class: 'sig-work-option',
                onClick: () => { if (previewing) closePreview(); else emit('continue'); } },
                [h(Icon, { name: 'play' }), h('span', [h('strong', 'Keep going'), h('small', 'Check in again later.')])]),
              h('button', { type: 'button', class: 'sig-work-option',
                onClick: () => { if (previewing) closePreview(); else emit('moveOn'); } },
                [h(Icon, { name: 'refresh-cw' }), h('span', [h('strong', 'Choose something else'), h('small', 'This item stays available.')])]),
            ]),
            h('div', { class: 'sig-work-checkin-finish' }, [doneButton()]),
          ]) : h('div', { key: 'active', class: 'sig-work-active' }, [
            h(Icon, { name: 'heart' }),
            h('p', 'Just focus on what you are doing.'),
            h('span', focus?.mode === 'completion'
              ? 'We will gently check in after an hour.'
              : `We will gently check in after ${focus?.minutes ?? minutes.value} minutes.`),
            h('small', 'There is no deadline to finish.'),
            focus ? reflection(focus.keepGoingCount ?? 0) : null,
            h('div', { class: 'sig-work-actions' }, [
              doneButton(),
              h('button', { type: 'button', class: 'quiet-button sig-work-switch-button',
                onClick: () => emit('moveOn') },
                [h(Icon, { name: 'refresh-cw' }), 'Choose something else']),
            ]),
          ]),
          }),
          !previewing && (focus || props.resumeNote) ? resumeNoteField() : null,
          h('p', { class: 'sig-work-footnote' }, 'You can move on without finishing. This item will remain available later.'),
        ]),
      ]);
    };
  },
});
