import { defineComponent, h, nextTick, ref, type PropType } from 'vue';
import { MarkdownContent } from '../../components/markdown-content.ts';
import { inputValue } from '../../core/dom.ts';
import { MAX_QUESTION_CONTEXT, type Question } from './question-model.ts';

export const QuestionContextEditor = defineComponent({
  name: 'QuestionContextEditor',
  props: { question: { type: Object as PropType<Question>, required: true } },
  setup(props) {
    const expanded = ref(Boolean(props.question.context?.trim()));
    const input = ref<HTMLTextAreaElement | null>(null);
    return () => h('div', { class: 'knowledge-context-editor' }, [
      !expanded.value ? h('button', { type: 'button', class: 'quiet-button', onClick: () => {
        expanded.value = true; nextTick(() => input.value?.focus());
      } }, 'Add context (Markdown)') : [
        h('label', { class: 'knowledge-field' }, ['Context (optional Markdown)', h('textarea', {
          ref: input, rows: 6, maxlength: MAX_QUESTION_CONTEXT, value: props.question.context ?? '',
          placeholder: 'Add a passage, table, list, or code sample…',
          onInput: (event: Event) => { props.question.context = inputValue(event); },
        })]),
        h('p', { class: 'knowledge-muted' }, 'Supports GFM tables, lists, task lists, links, code, and strikethrough. The question above stays the main title; Fill in the Blanks keeps its blank-aware prompt.'),
        props.question.context?.trim() ? h('details', { class: 'knowledge-context-preview' }, [
          h('summary', 'Preview context'), h(MarkdownContent, { text: props.question.context, class: 'knowledge-question-context' }),
        ]) : null,
      ],
    ]);
  },
});
