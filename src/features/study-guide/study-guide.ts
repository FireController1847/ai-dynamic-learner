import { defineComponent, h } from 'vue';

export const StudyGuide = defineComponent({
  name: 'StudyGuide',
  props: {
    title: { type: String, required: true },
  },
  setup(props) {
    return () => h('section', {
      class: 'study-guide-page',
      'aria-label': props.title,
    });
  },
});
