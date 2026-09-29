import { h, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue';

export const ReviewSetup = {
  name: 'ReviewSetup',
  props: {
    initialSide: { type: String, required: true },
    initialOrder: { type: String, required: true },
    cardCount: { type: Number, required: true },
    modal: { type: Boolean, default: true },
  },
  emits: ['cancel', 'start'],
  setup(props, { emit }) {
    const dialog = ref(null);
    const heading = ref(null);
    const step = ref(1);
    const side = ref(props.initialSide);
    const order = ref(props.initialOrder);

    function close() {
      if (dialog.value?.open) dialog.value.close();
    }
    onMounted(() => {
      if (props.modal) dialog.value.showModal();
      else dialog.value.show();
    });
    onBeforeUnmount(close);
    onDeactivated(close);

    async function changeStep(value) {
      step.value = value;
      await nextTick();
      heading.value?.focus();
    }

    function choice(value, label, description) {
      const field = step.value === 1 ? side : order;
      return h('label', { class: 'review-choice', key: value }, [
        h('input', {
          type: 'radio', name: step.value === 1 ? 'review-side' : 'review-order',
          value, checked: field.value === value, autofocus: step.value === 1 && field.value === value,
          onChange: () => { field.value = value; },
        }),
        h('span', [h('strong', label), h('span', { class: 'review-choice-description' }, description)]),
      ]);
    }

    return () => h('dialog', {
      ref: dialog, class: 'review-setup', 'aria-labelledby': 'review-setup-heading',
      onCancel: (event) => { event.preventDefault(); emit('cancel'); },
    }, [h('form', {
      onSubmit: (event) => {
        event.preventDefault();
        if (step.value === 1) changeStep(2);
        else emit('start', { side: side.value, order: order.value });
      },
    }, [
      h('p', { class: 'review-setup-step' }, `Set up review · Step ${step.value} of 2 · ${props.cardCount} ${props.cardCount === 1 ? 'card' : 'cards'}`),
      h('h2', { ref: heading, id: 'review-setup-heading', tabindex: -1 }, step.value === 1 ? 'Which side should you see first?' : 'What order should the cards use?'),
      h('p', { class: 'review-setup-description' }, step.value === 1
        ? 'You will see one side first. Try to remember the other side, then flip the card.'
        : `Each card will start on the ${side.value}. Pick the order you want to study them in.`),
      h('fieldset', { class: 'review-choices', key: step.value }, [
        h('legend', { class: 'visually-hidden' }, step.value === 1 ? 'Starting side' : 'Review order'),
        ...(step.value === 1 ? [
          choice('front', 'Front first', 'See the front, then flip to the back.'),
          choice('back', 'Back first', 'See the back, then flip to the front.'),
        ] : [
          choice('forward', 'First to last', 'Start with your first card.'),
          choice('backward', 'Last to first', 'Start with your last card.'),
          choice('shuffle', 'Mix them up', 'Use a new random order.'),
        ]),
      ]),
      h('div', { class: 'review-setup-actions' }, [
        h('button', {
          type: 'button', class: 'quiet-button review-cancel-button',
          onClick: () => emit('cancel'),
        }, 'Cancel'),
        step.value === 2 ? h('button', {
          type: 'button', class: 'quiet-button review-previous-button',
          onClick: () => changeStep(1),
        }, 'Previous step') : null,
        h('button', { type: 'submit', class: 'card-primary-button' }, step.value === 1 ? 'Next' : 'Start review'),
      ]),
    ])]);
  },
};
