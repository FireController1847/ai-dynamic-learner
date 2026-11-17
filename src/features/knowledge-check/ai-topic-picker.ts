import { computed, defineComponent, h, nextTick, onMounted, ref, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { MAX_AI_IMPORT_LENGTH } from '../../core/ai-json.ts';
import { readCategoryHistory, rememberCategories, writeCategoryHistory } from '../../core/ai-category-history.ts';
import { parseStudyCategories, studyCategoriesPrompt, type AiCardCategories, type AiCardScope } from '../../core/ai-study-categories.ts';

type TopicStep = 'topic' | 'generate' | 'response' | 'choose';

/** Review's optional topic path; no mandatory second AI exchange for a known topic. */
export const ReviewAiTopicPicker = defineComponent({
  name: 'ReviewAiTopicPicker',
  props: { current: { type: Object as PropType<AiCardScope | null>, default: null } },
  emits: { back: () => true, select: (_scope: AiCardScope | null) => true },
  setup(props, { emit }) {
    const step = ref<TopicStep>('topic');
    const topic = ref(props.current?.category.title ?? '');
    const history = ref(readCategoryHistory());
    const categories = ref<AiCardCategories | null>(null);
    const raw = ref('');
    const problem = ref('');
    const status = ref('');
    const fallback = ref(false);
    const heading = ref<HTMLElement | null>(null);
    onMounted(() => heading.value?.focus());
    const prompt = computed(() => studyCategoriesPrompt('Review').replace(
      'source material I supplied immediately before this instruction',
      'source material attached to this message or already supplied in this conversation',
    ));
    function go(next: TopicStep) {
      step.value = next;
      problem.value = '';
      status.value = '';
      fallback.value = false;
      void nextTick(() => heading.value?.focus());
    }
    function useTopic() {
      const title = topic.value.trim();
      if (!title || title.length > 120) return;
      emit('select', { subject: 'Study material', category: { key: 'custom-topic', title, description: 'Only this topic as supported by the supplied material.' } });
    }
    function selectList(list: AiCardCategories) {
      categories.value = list;
      history.value = rememberCategories(history.value, list);
      writeCategoryHistory(history.value);
      go('choose');
    }
    async function copy() {
      try {
        await navigator.clipboard.writeText(prompt.value);
        status.value = 'Copied. Send the instructions with your study material in your AI chat.';
        fallback.value = false;
      } catch {
        status.value = 'Select and copy the instructions below.';
        fallback.value = true;
      }
    }
    function check() {
      problem.value = '';
      try {
        let parsed: AiCardCategories;
        try { parsed = parseStudyCategories(raw.value); }
        catch {
          const blocks = [...raw.value.matchAll(/(?:^|\n)\s*```(?:json)?\s*\n([\s\S]*?)\n\s*```/gi)];
          if (blocks.length !== 1) throw new Error('Could not read a topic list.');
          parsed = parseStudyCategories(blocks[0][1]);
        }
        selectList(parsed);
      } catch {
        problem.value = 'We couldn’t read the topic list. Paste the AI’s complete topic response, or go back and enter a topic yourself.';
      }
    }
    const button = (label: string, action: () => void, primary = false, disabled = false) =>
      h('button', { type: 'button', class: primary ? 'card-primary-button' : 'quiet-button', disabled, onClick: action }, label);

    return () => h('section', { class: 'review-ai-panel', 'aria-label': 'Choose a specific topic' }, [
      h('h3', { ref: heading, tabindex: -1 }, step.value === 'topic' ? 'What topic do you want to study?'
        : step.value === 'generate' ? 'Find topics in your notes'
        : step.value === 'response' ? 'Bring back your topic list' : 'Choose a topic'),
      step.value === 'topic' ? [
        h('p', 'Enter a chapter, unit, or concept you want to focus on.'),
        h('label', { class: 'review-ai-name' }, [
          h('span', 'Topic'),
          h('input', { value: topic.value, maxlength: 120, placeholder: 'e.g. Carbohydrate metabolism',
            onInput: (event: Event) => { topic.value = inputValue(event); },
            onKeydown: (event: KeyboardEvent) => { if (event.key === 'Enter') useTopic(); } }),
        ]),
        h('div', { class: 'review-ai-inline-actions' }, [
          button('Use this topic', useTopic, true, !topic.value.trim()),
        ]),
        h('div', { class: 'review-ai-topic-alternative' }, [
          h('p', { class: 'study-ai-muted' }, 'Not sure which topics are in your material?'),
          button('Find topics with AI', () => go('generate')),
        ]),
        history.value.length ? h('details', { class: 'review-ai-secondary-details' }, [
          h('summary', 'Use a saved topic list'),
          h('div', { class: 'review-ai-topic-list' }, history.value.map(entry =>
            button(entry.categories.title + ' · ' + entry.categories.categories.length + ' topics', () => selectList(entry.categories)))),
        ]) : null,
        h('div', { class: 'review-ai-inline-actions review-ai-navigation' }, [
          button('Back', () => emit('back')),
          button('Study the entire subject', () => emit('select', null)),
        ]),
      ] : step.value === 'generate' ? [
        h('p', 'Copy these instructions, then send them with your study material in your AI chat.'),
        h('div', { class: 'review-ai-inline-actions' }, [
          button('Copy instructions', () => { void copy(); }, true),
          h('a', { class: 'quiet-button', href: 'https://chatgpt.com/', target: '_blank', rel: 'noopener noreferrer' }, 'Open ChatGPT'),
        ]),
        status.value ? h('p', { role: 'status', class: 'study-ai-muted' }, status.value) : null,
        fallback.value ? h('textarea', { rows: 5, readonly: true, value: prompt.value, 'aria-label': 'Topic instructions' }) : null,
        h('div', { class: 'review-ai-inline-actions review-ai-navigation' }, [
          button('Back', () => go('topic')),
          button('I have a topic list', () => go('response'), true),
        ]),
      ] : step.value === 'response' ? [
        h('p', 'Copy the AI’s topic list and paste it here.'),
        h('textarea', { rows: 5, value: raw.value, maxlength: MAX_AI_IMPORT_LENGTH, 'aria-label': 'AI topic list',
          placeholder: 'Paste the topic list…', onInput: (event: Event) => { raw.value = inputValue(event); problem.value = ''; } }),
        problem.value ? h('p', { class: 'study-ai-error', role: 'alert' }, problem.value) : null,
        h('div', { class: 'review-ai-inline-actions review-ai-navigation' }, [
          button('Back', () => go('generate')),
          button('Find topics', check, true, !raw.value.trim()),
        ]),
      ] : [
        h('p', 'Choose a topic from ' + (categories.value?.title ?? 'your material') + '.'),
        h('div', { class: 'review-ai-topic-list' }, (categories.value?.categories ?? []).map(category =>
          h('button', { type: 'button', key: category.key, class: 'quiet-button review-ai-topic-option',
            onClick: () => { if (categories.value) emit('select', { subject: categories.value.title, category }); } }, [
            h('strong', category.title), h('span', { class: 'study-ai-muted' }, category.description),
          ]))),
        button('Back', () => go('topic')),
      ],
    ]);
  },
});
