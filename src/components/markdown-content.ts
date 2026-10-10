import { computed, defineComponent, h, useId } from 'vue';
import { renderMarkdown } from './markdown-renderer.ts';

export const MarkdownContent = defineComponent({
  name: 'MarkdownContent',
  props: { text: { type: String, required: true } },
  setup(props) {
    const headingPrefix = `markdown-${useId()}`;
    const blocks = computed(() => props.text.trim() ? renderMarkdown(props.text, [], headingPrefix) : []);
    return () => h('div', { class: 'markdown-content' }, blocks.value);
  },
});
