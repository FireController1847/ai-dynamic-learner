import { computed, defineComponent, h, onMounted, ref, type PropType } from 'vue';
import { useAiRecovery } from '../../components/use-ai-recovery.ts';
import { MAX_CARDS } from './card-model.ts';
import { AiPromptExchange } from '../../components/ai-prompt-exchange.ts';
import { AiCoverageAcceptance } from '../../components/ai-coverage-acceptance.ts';
import { AiSourceUnitCoverage } from '../../components/ai-source-unit-coverage.ts';
import { AiCoverageSelect } from '../../components/ai-coverage-select.ts';
import { AiPromptStyleSelect } from '../../components/ai-prompt-style-select.ts';
import { DEFAULT_AI_PROMPT_VARIANT, simpleAiPrompt, type AiPromptVariant } from '../../core/ai-prompt-variants.ts';
import { inputValue } from '../../core/dom.ts';
import { maskFillBlankAnswers, parseFillBlankTemplate } from '../../core/fill-blank.ts';
import { fillBlankAiPrompt, parseFillBlankAiImport, FILL_BLANK_IMPORT_FORMAT, type AiBlankStyle, type FillBlankCardsImport } from './fill-blank-ai-format.ts';
import { getSetMode, type SetModeId } from './set-modes.ts';
import { categoryScopedPrompt, type AiCardScope } from '../../core/ai-study-categories.ts';
import {
  answerIsLong, flashCardsAiPrompt, FLASH_CARDS_IMPORT_FORMAT, MAX_AI_IMPORT_LENGTH, parseFlashCardsAiImport,
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
    const stage = ref<'configure' | 'exchange'>(props.direct ? 'exchange' : 'configure');
    const promptVariant = ref<AiPromptVariant>(DEFAULT_AI_PROMPT_VARIANT);
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
      const detailed = props.scope ? categoryScopedPrompt(base, props.scope) : base;
      return promptVariant.value === 'simple' ? simpleAiPrompt(detailed, modeLabel.value,
        `Create up to ${limit.value} ${isFillBlank.value ? 'Fill in the Blanks' : 'Flash Cards'} cards${props.scope ? ' for ' + props.scope.category.title : ''}. Coverage: ${coverage.value}.`,
        isFillBlank.value ? [
          `Blank style: ${blankStyle.value}. Put each correct answer inside {{answer}} and leave clear visible context.`,
          'Use consistent terminology, short accurate statements, and source-supported facts.',
          'Cover requested source objectives without padding with filler.',
        ] : [
          'Ask one clear recall question per card. Use answers of 1–5 words when possible, never long explanations.',
          'Cover requested source objectives without padding with filler.',
        ]) : detailed;
    });
    const longAnswers = computed(() => candidate.value?.mode === 'flash-cards'
      ? candidate.value.data.cards.filter(card => answerIsLong(card.answer)).length : 0);
    const overCapacity = computed(() => (candidate.value?.data.cards.length ?? 0) > props.remainingCards);
    onMounted(() => heading.value?.focus({ preventScroll: true }));
    const recovery = useAiRecovery<IndexCardsAiImportValue>(() => {
      const format = isFillBlank.value ? FILL_BLANK_IMPORT_FORMAT : FLASH_CARDS_IMPORT_FORMAT;
      function parse(text: string): IndexCardsAiImportValue {
        return isFillBlank.value ? { mode: 'fill-in-the-blanks', data: parseFillBlankAiImport(text) }
          : { mode: 'flash-cards', data: parseFlashCardsAiImport(text) };
      }
      return {
        field: 'cards', targetApp: 'index-cards', formats: [format], title: props.scope?.category.title ?? modeLabel.value,
        maxItems: Math.min(MAX_CARDS, props.remainingCards), parse,
        requiredMetadata: props.direct ? [] : ['coverage'],
        validateItem: entry => JSON.stringify(parse(JSON.stringify({ format, version: 1, title: 'Cards', cards: [entry] })).data.cards[0]),
      };
    }, () => modeLabel.value, () => 'cards', value => { candidate.value = value; }, () => { json.value = ''; });
    function preview() {
      candidate.value = null;
      coverageAccepted.value = false;
      problem.value = '';
      recovery.check(json.value);
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

    function renderOptions() { return h('div', { class: 'flash-ai-options' }, [
            h(AiPromptStyleSelect, { value: promptVariant.value, fieldClass: 'flash-ai-option',
              onSelect: value => { promptVariant.value = value; },
            }),
            h(AiCoverageSelect, { value: coverage.value, fieldClass: 'flash-ai-option',
              onSelect: value => { coverage.value = value; },
            }),
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
          ]); }

    return () => h('section', { class: 'flash-ai-workspace', 'aria-labelledby': 'flash-ai-title' }, [
      h('header', { class: 'flash-ai-header' }, [
        h('div', [
          h('p', { class: 'flash-ai-muted' }, `${modeLabel.value} · Saved in ${props.destination}`),
          h('h2', { id: 'flash-ai-title', ref: heading, tabindex: -1 }, props.scope?.category.title ?? (props.direct ? 'Import an AI response' : 'Overall subject')),
          h('p', props.direct ? 'Import an existing set of cards.' : 'Create cards for your selected scope.'),
          h('p', { class: 'flash-ai-muted' }, props.scope?.category.description ?? ''),
        ]),
        h('div', { class: 'flash-ai-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => {
            if (stage.value === 'exchange' && !props.direct) stage.value = 'configure';
            else emit('back');
          } }, 'Back'),
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
        ]),
      ]),
      stage.value === 'configure' ? h('div', { class: 'flash-ai-configuration' }, [
        h('h3', 'Configure ' + modeLabel.value),
        h('p', { class: 'study-ai-muted' }, 'Choose your settings before starting the AI steps.'),
        renderOptions(),
        h('div', { class: 'study-ai-actions' }, [h('button', {
          type: 'button', class: 'card-primary-button', onClick: () => { stage.value = 'exchange'; },
        }, 'Continue to AI')]),
      ]) : h(AiPromptExchange, {
        idPrefix: 'index-cards-ai', label: modeLabel.value, prompt: prompt.value, startInImport: props.direct, importOnly: props.direct, skipSource: Boolean(props.scope),
        json: json.value, problem: problem.value, maxLength: MAX_AI_IMPORT_LENGTH,
        hasPreview: candidate.value !== null,
        promptHelp: props.scope ? 'Create cards for your selected category.' : 'Create cards covering the overall subject.',
        importHelp: 'Upload or paste the AI response to preview the cards.',
        onUpdateJson: (value: string) => { json.value = value; candidate.value = null; coverageAccepted.value = false; problem.value = ''; },
        onValidate: preview,
        recovering: recovery.active.value,
      }, {
        recovery: recovery.panel,
        preview: () => candidate.value ? h('div', { class: 'flash-ai-preview', 'aria-label': `${modeLabel.value} preview` }, [
          h('h3', candidate.value.data.title),
          h('p', { role: 'status' }, `${candidate.value.data.cards.length} cards · ${modeLabel.value} · ${props.remainingCards} card spaces available`),
          longAnswers.value ? h('p', { class: 'flash-ai-muted' }, `${longAnswers.value} ${longAnswers.value === 1 ? 'answer exceeds' : 'answers exceed'} 10 words. Ask your AI to split those into shorter cards, or shorten them after import.`) : null,
          candidate.value.data.sourceUnits?.length ? h(AiSourceUnitCoverage, {
            units: candidate.value.data.sourceUnits,
            items: candidate.value.data.cards.map(card => 'question' in card ? card.question : maskFillBlankAnswers(card.text)),
            itemLabel: 'cards',
          }) : null,
          h('ol', { class: 'flash-ai-cards' }, previewCards(candidate.value)),
          candidate.value.data.coverage ? h(AiCoverageAcceptance, { key: json.value, coverage: candidate.value.data.coverage,
            items: candidate.value.data.cards.map(card => 'question' in card ? card.question : card.text),
            onApproval: (accepted: boolean) => { coverageAccepted.value = accepted; },
          }) : h('p', { class: 'study-ai-muted' }, 'No reliable source coverage inventory is available: completeness cannot be verified.'),
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
