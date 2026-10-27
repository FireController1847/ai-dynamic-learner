import { defineComponent, h, ref, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { CHECK_IN_MINUTES, type ActiveCheckIn, type CheckInMode } from './library-model.ts';

export const TaskCheckIn = defineComponent({
  name: 'TaskCheckIn',
  props: {
    taskText: { type: String, required: true },
    categoryLabel: { type: String, required: true },
    focus: { type: Object as PropType<ActiveCheckIn | null>, default: null },
    now: { type: Number, required: true },
  },
  emits: {
    back: () => true,
    start: (_mode: CheckInMode, _minutes: number) => true,
    continue: () => true,
    moveOn: () => true,
    done: () => true,
  },
  setup(props, { emit }) {
    const mode = ref<CheckInMode>('both');
    const minutes = ref<number>(25);
    const modes: { id: CheckInMode; label: string; detail: string }[] = [
      { id: 'time', label: 'Time', detail: 'Check in after a little while.' },
      { id: 'completion', label: 'Until finished', detail: 'Work until you feel done. Get a reminder after an hour.' },
      { id: 'both', label: 'Both', detail: 'A gentle time reminder, or finish sooner.' },
    ];
    return () => {
      const focus = props.focus;
      const due = !!focus && props.now >= focus.remindAt;
      return h('section', { class: 'sig-work', 'aria-label': 'Work on an item' }, [
        h('div', { class: 'sig-work-top' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') },
            [h(Icon, { name: 'arrow-left' }), 'Back to grid']),
          h('span', { class: 'sig-work-category' }, props.categoryLabel),
        ]),
        h('div', { class: 'sig-work-main' }, [
          h('p', { class: 'sig-work-eyebrow' }, 'One thing at a time'),
          h('h3', props.taskText),
          !focus ? h('div', { class: 'sig-work-setup' }, [
            h('p', 'What would help you check back in with yourself? You can always switch activities without finishing.'),
            h('div', { class: 'sig-work-modes', role: 'group', 'aria-label': 'Check-in style' }, modes.map(option =>
              h('button', { type: 'button', class: ['sig-work-mode', { 'is-selected': option.id === mode.value }],
                'aria-pressed': mode.value === option.id, onClick: () => { mode.value = option.id; } },
              [h('strong', option.label), h('small', option.detail)]))),
            mode.value !== 'completion' ? h('div', { class: 'sig-work-timing' }, [
              h('strong', 'Check in after'),
              h('div', { class: 'sig-work-durations', role: 'group', 'aria-label': 'Check-in time' },
                CHECK_IN_MINUTES.map(n => h('button', { type: 'button',
                  class: ['sig-duration', { 'is-selected': minutes.value === n }],
                  'aria-pressed': minutes.value === n, onClick: () => { minutes.value = n; } }, `${n} min`))),
            ]) : h('p', { class: 'sig-work-reminder' }, 'A gentle reminder after one hour, even if you are not finished.'),
            h('button', { type: 'button', class: 'card-primary-button sig-work-start',
              onClick: () => emit('start', mode.value, minutes.value) }, [h(Icon, { name: 'play' }), 'Start working']),
          ]) : due ? h('div', { class: 'sig-work-checkin', role: 'status' }, [
            h(Icon, { name: 'heart' }),
            h('h4', 'How are you feeling about what you are doing?'),
            h('p', 'You have spent some time here. Nothing has to be finished now.'),
            h('div', { class: 'sig-work-choices' }, [
              h('button', { type: 'button', class: 'sig-work-option', onClick: () => emit('continue') },
                [h(Icon, { name: 'play' }), h('span', [h('strong', 'Keep going'), h('small', 'Check in again later.')])]),
              h('button', { type: 'button', class: 'sig-work-option', onClick: () => emit('moveOn') },
                [h(Icon, { name: 'refresh-cw' }), h('span', [h('strong', 'Choose something else'), h('small', 'This item stays available.')])]),
              h('button', { type: 'button', class: 'sig-work-option', onClick: () => emit('done') },
                [h(Icon, { name: 'check' }), h('span', [h('strong', 'I am finished'), h('small', 'Mark this item complete.')])]),
            ]),
          ]) : h('div', { class: 'sig-work-active' }, [
            h(Icon, { name: 'heart' }),
            h('p', 'Just focus on what you are doing.'),
            h('span', focus.mode === 'completion'
              ? 'We will gently check in after an hour.'
              : `We will gently check in after ${focus.minutes} minutes.`),
            h('small', 'There is no deadline to finish.'),
          ]),
          focus && !due ? h('div', { class: 'sig-work-actions' }, [
            focus.mode !== 'time' ? h('label', { class: 'sig-work-finish-toggle' }, [
              h('input', { type: 'checkbox', checked: false, onChange: () => emit('done') }),
              h('span', 'I am finished with this'),
            ]) : h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('done') },
              [h(Icon, { name: 'check' }), 'I am finished']),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('moveOn') },
              [h(Icon, { name: 'refresh-cw' }), 'Choose something else']),
          ]) : null,
          h('p', { class: 'sig-work-footnote' }, 'You can move on without finishing. This item will remain available later.'),
        ]),
      ]);
    };
  },
});
