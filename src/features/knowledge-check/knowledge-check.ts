import { defineComponent, h } from 'vue';

export const KnowledgeCheck = defineComponent({
  name: 'KnowledgeCheck',
  props: {
    title: { type: String, required: true },
  },
  setup(props) {
    return () => h('section', {
      class: 'knowledge-check-page',
      'aria-label': props.title,
    });
  },
});
