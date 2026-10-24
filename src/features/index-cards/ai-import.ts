import { computed, defineComponent, h, onMounted, ref, type PropType } from 'vue';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { AiCoverageAcceptance } from '../../components/ai-coverage-acceptance.ts';
import { inputValue } from '../../core/dom.ts';
import { maskFillBlankAnswers, parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { fillBlankAiPrompt, parseFillBlankAiImport, type AiBlankStyle, type FillBlankCardsImport } from './fill-blank-ai-format.ts';
import { getSetMode, type SetModeId } from './set-modes.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import {
  answerIsLong, flashCardsAiPrompt, MAX_AI_IMPORT_LENGTH, parseFlashCardsAiImport,
  type AiCardCoverage, type FlashCardsImport,
} from './ai-import-format.ts';

export type IndexCardsAiImportValue =
  | { mode: 'flash-cards'; data: FlashCardsImport }
  | { mode: 'fill-in-the-blanks'; data: FillBlankCardsImport };

export const IndexCardsAiImport = defineComponent({
  name: 'IndexCardsAiImport',
  props: {
    destination: { type: String, required: true },
    remainingCards: { type: Number, required: true },
    mode: { type: String as PropType<SetModeId>, required: true },
    scope: { type: Object as PropType<AiCardScope | null>, default: null },
    direct: Boolean,
  },
  emits: { back: () => true, cancel: () => true, import: (_value: IndexCardsAiImportValue) => true },
  setup(props, { emit }) {
    const coverage = ref<AiCardCoverage>('balanced');
    const limit = ref(20);
    const blankStyle = ref<AiBlankStyle>('connected');
    const json = ref('');
    const problem = ref('');
    const candidate = ref<IndexCardsAiImportValue | null>(null);
    const coverageAccepted = ref(false);
    const heading = ref<HTMLElement | null>(null);
    const modeLabel = computed(() => getSetMode(props.mode)?.label ?? 'Flash Cards');
    const isFillBlank = computed(() => props.mode === 'fill-in-the-blanks');
    const prompt = computed(() => {
      const base = isFillBlank.value ? fillBlankAiPrompt(coverage.value, limit.value, blankStyle.value) : flashCardsAiPrompt(coverage.value, limit.value);
      return props.scope ? categoryScopedPrompt(base, props.scope) : base;
    });
    const longAnswers = computed(() => candidate.value?.mode === 'flash-cards'
      ? candidate.value.data.cards.filter(card => answerIsLong(card.answer)).length : 0);
    const overCapacity = computed(() => (candidate.value?.data.cards.length ?? 0) > props.remainingCards);
    onMounted(() => heading.value?.focus({ preventScroll: true }));
    function preview() {
      candidate.value = null;
      coverageAccepted.value = false;
      problem.value = '';
      try {
        candidate.value = isFillBlank.value
          ? { mode: 'fill-in-the-blanks', data: parseFillBlankAiImport(json.value) }
          : { mode: 'flash-cards', data: parseFlashCardsAiImport(json.value) };
        if (!props.direct && !candidate.value.data.coverage) throw new Error('The AI omitted the mandatory source coverage inventory. Request complete JSON with every subject and matching itemNumbers.');
      } catch (error) { candidate.value = null; problem.value = error instanceof Error ? error.message : String(error); }
    }
    function previewCards(value: IndexCardsAiImportValue) {
      if (value.mode === 'flash-cards') return value.data.cards.map((card, index) => h('li', { key: index }, [
        h('strong', card.question), h('p', card.answer),
      ]));
      return value.data.cards.map((card, index) => {
        const answers = parseFillBlankTemplate(card.text).answers;
        return h('li', { key: index }, [
          h('strong', maskFillBlankAnswers(card.text)),
          h('details', [
            h('summary', `Reveal ${answers.length === 1 ? 'answer' : `${answers.length} answers`}`),
            h('ol', answers.map((answer, answerIndex) => h('li', { key: answerIndex }, answer))),
          ]),
        ]);
      });
    }

    return () => h('section', { class: 'flash-ai-workspace', 'aria-labelledby': 'flash-ai-title' }, [
      h('header', { class: 'flash-ai-header' }, [
        h('div', [
          h('p', { class: 'flash-ai-muted' }, `${modeLabel.value} · Saved in ${props.destination}`),
          h('h2', { id: 'flash-ai-title', ref: heading, tabindex: -1 }, props.scope?.category.title ?? (props.direct ? 'Import an AI response' : 'Overall subject')),
          h('p', props.direct ? 'Import an existing set of cards.' : 'Create cards for your selected scope.'),
          h('p', { class: 'flash-ai-muted' }, props.scope?.category.description ?? ''),
        ]),
        h('div', { class: 'flash-ai-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back'),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        ]),
      ]),
      h(AiPromptExchange, {
        idPrefix: 'index-cards-ai', label: modeLabel.value, prompt: prompt.value, startInImport: props.direct, importOnly: props.direct, skipSource: Boolean(props.scope),
        json: json.value, problem: problem.value, maxLength: MAX_AI_IMPORT_LENGTH,
        hasPreview: candidate.value !== null,
        promptHelp: props.scope ? 'Create cards for your selected category.' : 'Create cards covering the overall subject.',
        importHelp: 'Paste the response from your AI chat to preview the cards.',
        onUpdateJson: (value: string) => { json.value = value; candidate.value = null; coverageAccepted.value = false; problem.value = ''; },
        onValidate: preview,
      }, {
        options: () => h('div', { class: 'flash-ai-options' }, [
            h('label', { class: 'flash-ai-option' }, [h('span', 'Coverage'), h('select', {
              value: coverage.value,
              onChange: (event: Event) => {
                const value = inputValue(event);
                if (value === 'essentials' || value === 'balanced' || value === 'comprehensive') coverage.value = value;
              },
            }, [h('option', { value: 'essentials' }, 'Essentials only'), h('option', { value: 'balanced' }, 'Balanced'),
              h('option', { value: 'comprehensive' }, 'Comprehensive')]), h('small', 'How much to cover: just key facts, a balanced mix, or most of the material.')]),
            h('label', { class: 'flash-ai-option' }, [h('span', 'Maximum cards'), h('select', {
              value: limit.value, onChange: (event: Event) => {
                const value = Number(inputValue(event));
                if ([10, 20, 30, 50].includes(value)) limit.value = value;
              },
            }, [10, 20, 30, 50].map(value => h('option', { value }, String(value)))), h('small', 'An upper limit, not a required number of cards.')]),
            isFillBlank.value ? h('label', { class: 'flash-ai-option' }, [h('span', 'Blank style'), h('select', {
              value: blankStyle.value, onChange: (event: Event) => {
                const value = inputValue(event);
                if (value === 'focused' || value === 'connected') blankStyle.value = value;
              },
            }, [h('option', { value: 'focused' }, 'One focused blank'), h('option', { value: 'connected' }, 'A few related blanks')]), h('small', 'One missing answer or several connected answers per card.')]) : null,
          ]),
        preview: () => candidate.value ? h('div', { class: 'flash-ai-preview', 'aria-label': `${modeLabel.value} preview` }, [
          h('h3', candidate.value.data.title),
          h('p', { role: 'status' }, `${candidate.value.data.cards.length} cards · ${modeLabel.value} · ${props.remainingCards} card spaces available`),
          longAnswers.value ? h('p', { class: 'flash-ai-muted' }, `${longAnswers.value} ${longAnswers.value === 1 ? 'answer exceeds' : 'answers exceed'} 10 words. Ask your AI to split those into shorter cards, or shorten them after import.`) : null,
          h('ol', { class: 'flash-ai-cards' }, previewCards(candidate.value)),
          candidate.value.data.coverage ? h(AiCoverageAcceptance, { key: json.value, coverage: candidate.value.data.coverage,
            items: candidate.value.data.cards.map(card => 'question' in card ? card.question : card.text),
            onApproval: (accepted: boolean) => { coverageAccepted.value = accepted; },
          }) : h('p', { class: 'study-ai-muted' }, 'Legacy JSON without a source coverage inventory: completeness cannot be verified.'),
          overCapacity.value ? h('p', { class: 'flash-ai-error', role: 'alert' }, 'This set exceeds the remaining card capacity. Import fewer cards or remove existing cards first.') : null,
          h('button', {
            type: 'button', class: 'card-primary-button', disabled: overCapacity.value || (Boolean(candidate.value.data.coverage) && !coverageAccepted.value),
            onClick: () => { if (candidate.value && !overCapacity.value && (!candidate.value.data.coverage || coverageAccepted.value)) emit('import', candidate.value); },
          }, isFillBlank.value ? 'Import Fill in the Blanks' : 'Import flash cards'),
        ]) : null,
      }),
    ]);
  },
});
