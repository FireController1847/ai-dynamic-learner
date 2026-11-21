import { defineComponent, h } from 'vue';

/** Review-style configuration heading shared by every AI creation workflow. */
export const AiOptionsHeader = defineComponent({
  name: 'AiOptionsHeader',
  props: {
    app: { type: String, required: true },
    destination: { type: String, required: true },
    title: { type: String, required: true },
    scope: { type: String, default: '' },
    headingId: { type: String, default: '' },
    backLabel: { type: String, default: 'Back' },
  },
  emits: { back: () => true, cancel: () => true },
  setup(props, { emit }) {
    return () => h('header', { class: 'study-ai-header ai-options-header' }, [
      h('div', [
        h('p', { class: 'study-ai-muted' }, `${props.app} · Saved in ${props.destination}`),
        h('h2', { id: props.headingId || undefined, tabindex: -1 }, props.title),
        h('p', 'Choose your settings before starting the AI steps.'),
        props.scope ? h('p', { class: 'study-ai-muted' }, props.scope) : null,
      ]),
      h('div', { class: 'study-ai-actions' }, [
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, props.backLabel),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
      ]),
    ]);
  },
});
