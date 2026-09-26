const { h } = window.Vue;

export const WordSearch = {
  name: 'WordSearch',
  props: { title: { type: String, required: true } },
  setup(props) {
    return () => h('section', { 'aria-label': props.title });
  },
};
