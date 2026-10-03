import { defineComponent, h } from 'vue';

export const Workbook = defineComponent({
  name: 'Workbook',
  setup() {
    return () => h('div', {
      class: 'workbook-workspace',
      'aria-label': 'Workbook workspace',
    });
  },
});
