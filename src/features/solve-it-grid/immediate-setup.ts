import { computed, defineComponent, h, nextTick, onMounted, ref, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import { MAX_TASK_TEXT_LENGTH, TASK_CATEGORIES, type GridRound } from './task-model.ts';

/** The four entries belong to this draw itself, not to a permanent task list. */
export const ImmediateSetup = defineComponent({
  name: 'ImmediateSetup',
  props: { round: { type: Object as PropType<GridRound>, required: true } },
  emits: { start: () => true },
  setup(props, { emit }) {
    const first = ref<HTMLTextAreaElement | null>(null);
    const ready = computed(() => TASK_CATEGORIES.every(category =>
      !!props.round.slots[category.id].text?.trim()));
    onMounted(() => { void nextTick(() => first.value?.focus()); });
    return () => h('section', { class: 'sig-immediate', 'aria-label': 'Choose what to do right now' }, [
      h('div', { class: 'sig-immediate-heading' }, [
        h('span', { class: 'sig-immediate-symbol', 'aria-hidden': true }, [h(Icon, { name: 'grid' })]),
        h('h3', 'Just the next four things'),
        h('p', 'No need to plan everything. Choose one thing for each part of your grid. You can figure out the rest when you get there.'),
      ]),
      h('div', { class: 'sig-immediate-fields' }, TASK_CATEGORIES.map((category, index) =>
        h('label', { key: category.id, class: ['sig-immediate-field', `sig-immediate-${category.id}`] }, [
          h('span', { class: 'sig-immediate-field-title' }, [
            h(Icon, { name: category.icon }),
            h('strong', `${category.number}. ${category.label}`),
          ]),
          h('span', { class: 'sig-immediate-description' }, category.description),
          h('textarea', {
            ref: index === 0 ? first : undefined,
            rows: 2, maxlength: MAX_TASK_TEXT_LENGTH,
            value: props.round.slots[category.id].text ?? '',
            placeholder: 'One thing I can do…',
            onInput: (event: Event) => {
              if (event.target instanceof HTMLTextAreaElement) {
                props.round.slots[category.id].text = event.target.value;
              }
            },
          }),
        ]))),
      h('div', { class: 'sig-immediate-actions' }, [
        h('p', ready.value ? 'You have everything you need to begin.' : 'Choose something for each quadrant to begin.'),
        h('button', {
          type: 'button', class: 'card-primary-button',
          disabled: !ready.value, onClick: () => emit('start'),
        }, [h(Icon, { name: 'play' }), 'Ready, set, go!']),
      ]),
    ]);
  },
});
