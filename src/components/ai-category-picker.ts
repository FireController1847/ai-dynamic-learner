import { defineComponent, h, nextTick, onMounted, ref, watch, type PropType } from 'vue';
import { useAiRecovery } from './use-ai-recovery.ts';
import { AiPromptExchange } from './ai-prompt-exchange.ts';
import { AiSourceIntro } from './ai-source-intro.ts';
import { AiPromptStyleSelect } from './ai-prompt-style-select.ts';
import { DEFAULT_AI_PROMPT_VARIANT, simpleAiPrompt, type AiPromptVariant } from '../core/ai-prompt-variants.ts';
import { PopupDialog } from './popup-dialog.ts';
import { Icon } from './icon.ts';
import { studyCategoriesPrompt, parseStudyCategories, STUDY_CATEGORIES_FORMAT, MAX_CATEGORIES, type AiCardCategories, type AiCardScope } from '../core/ai-study-categories.ts';
import { readCategoryHistory, rememberCategories, writeCategoryHistory, type CategoryHistoryEntry } from '../core/ai-category-history.ts';
import { MAX_AI_IMPORT_LENGTH } from '../core/ai-json.ts';
import type { AiTargetApp } from '../core/ai-app-identity.ts';

type CategoryStage = 'source' | 'start' | 'saved' | 'generate' | 'choose';

export const AiCategoryPicker = defineComponent({
  name: 'AiCategoryPicker',
  props: {
    destination: { type: String, required: true },
    label: { type: String, default: 'Index Cards' },
    targetApp: { type: String as PropType<AiTargetApp>, required: true },
    totalSteps: { type: Number, default: 2 },
    initialCategories: { type: Object as PropType<AiCardCategories | null>, default: null },
  },
  emits: { back: () => true, cancel: () => true, select: (_scope: AiCardScope, _categories: AiCardCategories) => true },
  setup(props, { emit }) {
    const history = ref(readCategoryHistory());
    const categories = ref<AiCardCategories | null>(props.initialCategories);
    const stage = ref<CategoryStage>(props.initialCategories ? 'choose' : 'source');
    const chosenFrom = ref<'saved' | 'generate' | 'start'>('start');
    const importExisting = ref(false);
    const json = ref('');
    const problem = ref('');
    const heading = ref<HTMLElement | null>(null);
    const historyList = ref<HTMLUListElement | null>(null);
    const clearButton = ref<HTMLButtonElement | null>(null);
    const clearOpen = ref(false);
    const storageMessage = ref('');
    const promptVariant = ref<AiPromptVariant>(DEFAULT_AI_PROMPT_VARIANT);
    const prompt = () => {
      const detailed = studyCategoriesPrompt(props.label, props.targetApp);
      return promptVariant.value === 'simple' ? simpleAiPrompt(detailed, props.label,
        'Identify a few distinct categories covering every major source topic, retaining the original order.',
        ['Use 1–40 categories with unique key, title and concise description.',
         'Do not split every heading into its own category; merge only genuinely related topics.',
         'Keep all important subject matter represented, without invented facts.']) : detailed;
    };

    const recovery = useAiRecovery(() => ({
      field: 'categories', targetApp: props.targetApp, formats: [STUDY_CATEGORIES_FORMAT], title: 'Study topics', maxItems: MAX_CATEGORIES,
      parse: (text: string) => parseStudyCategories(text, props.targetApp),
      validateItem: entry => {
        const category = parseStudyCategories(JSON.stringify({ format: STUDY_CATEGORIES_FORMAT, targetApp: props.targetApp, version: 1, title: 'Topics', categories: [entry] }), props.targetApp).categories[0];
        return category.key;
      },
      conflicts: (entry, kept) => {
        const title = (value: unknown) => {
          if (typeof value !== 'object' || value === null || !('title' in value) || typeof value.title !== 'string') return '';
          return value.title.trim().replace(/\s+/gu, ' ').toLowerCase();
        };
        return kept.some(item => title(item) === title(entry));
      },
    }), () => props.label + ' categories', () => 'categories', acceptCategories, () => { json.value = ''; });
    onMounted(() => heading.value?.focus({ preventScroll: true }));
    watch(stage, async () => {
      await nextTick();
      heading.value?.focus({ preventScroll: true });
    });

    function persist() {
      storageMessage.value = writeCategoryHistory(history.value) ? '' : 'Category history could not be saved in this browser.';
    }
    function goBack() {
      if (stage.value === 'source') emit('back');
      else if (stage.value === 'start') {
        if (props.initialCategories) emit('back');
        else stage.value = 'source';
      }
      else if (stage.value === 'choose') stage.value = chosenFrom.value;
      else stage.value = 'start';
    }
    function newCategories(direct = false) {
      recovery.reset();
      importExisting.value = direct;
      problem.value = '';
      json.value = '';
      stage.value = 'generate';
    }
    function useSaved(entry: CategoryHistoryEntry) {
      categories.value = entry.categories;
      chosenFrom.value = 'saved';
      problem.value = '';
      history.value = rememberCategories(history.value, entry.categories);
      persist();
      stage.value = 'choose';
    }
    function checkResponse() {
      problem.value = '';
      recovery.check(json.value);
    }
    function acceptCategories(parsed: AiCardCategories) {
      categories.value = parsed;
      chosenFrom.value = 'generate';
      history.value = rememberCategories(history.value, parsed);
      persist();
      stage.value = 'choose';
    }
    function removeSaved(entry: CategoryHistoryEntry) {
      const index = history.value.findIndex(item => item.id === entry.id);
      if (index < 0) return;
      history.value = history.value.filter(item => item.id !== entry.id);
      persist();
      nextTick(() => {
        if (!history.value.length) {
          stage.value = 'start';
          return;
        }
        const buttons = historyList.value?.querySelectorAll<HTMLButtonElement>('.study-ai-history-remove');
        buttons?.[Math.min(index, buttons.length - 1)]?.focus({ preventScroll: true });
      });
    }

    const option = (title: string, description: string, onClick: () => void, iconName: string) =>
      h('button', { type: 'button', class: 'quiet-button ai-category-option', onClick }, [
        h(Icon, { name: iconName }), h('span', [h('strong', title), h('span', description)]),
        h(Icon, { name: 'chevron' }),
      ]);

    function body() {
      if (stage.value === 'source') return [
        h(AiSourceIntro, { continueLabel: 'Continue to categories', onNext: () => { stage.value = 'start'; } }),
      ];
      if (stage.value === 'start') return [
        h('div', { class: 'ai-category-options' }, [
          history.value.length ? option('Use saved categories', 'Use a saved list that matches the notes you shared.', () => { stage.value = 'saved'; }, 'folder') : null,
          option('Find categories with AI', 'Create a category list from your study material.', () => newCategories(), 'ai'),
        ]),
        h(AiPromptStyleSelect, { value: promptVariant.value,
          onSelect: value => { promptVariant.value = value; },
        }),
        h('div', { class: 'ai-category-secondary' }, [
          h('button', { type: 'button', class: 'quiet-button outline-button', onClick: () => newCategories(true) }, 'Import an existing AI response'),
        ]),
      ];

      if (stage.value === 'saved') return [
        h('ul', { ref: historyList, class: 'ai-category-history-list' }, history.value.map(entry => h('li', { key: entry.id }, [
          h('button', { type: 'button', class: 'quiet-button study-ai-history-use', onClick: () => useSaved(entry) }, [
            h('span', [h('strong', entry.categories.title), h('span', entry.categories.categories.length + ' categories · ' + new Date(entry.savedAt).toLocaleDateString())]),
            h(Icon, { name: 'chevron' }),
          ]),
          h('button', {
            type: 'button', class: 'icon-button delete-button study-ai-history-remove',
            title: 'Remove ' + entry.categories.title + ' from history',
            'aria-label': 'Remove ' + entry.categories.title + ' from category history',
            onClick: () => removeSaved(entry),
          }, [h(Icon, { name: 'trash' })]),
        ]))),
        h('div', { class: 'ai-category-secondary' }, [
          h('button', { ref: clearButton, type: 'button', class: 'quiet-button', onClick: () => { clearOpen.value = true; } }, 'Clear history'),
        ]),
      ];

      if (stage.value === 'generate') return [
        h(AiPromptExchange, {
          key: importExisting.value ? 'existing' : 'new', idPrefix: 'study-category', label: 'Categories',
          prompt: prompt(), promptHelp: 'Have your AI find the main categories in your source material.',
          importHelp: 'Upload or paste the category list from your AI chat.',
          json: json.value, problem: problem.value, maxLength: MAX_AI_IMPORT_LENGTH,
          startInImport: importExisting.value, importOnly: importExisting.value, skipSource: true,
          validateLabel: 'Check categories',
          onUpdateJson: (value: string) => { json.value = value; problem.value = ''; },
          onValidate: checkResponse,
          recovering: recovery.active.value,
        }, { recovery: recovery.panel }),
      ];

      return categories.value ? [
        h('div', { class: 'ai-category-selection', 'aria-label': 'Available categories' },
          categories.value.categories.map(category => h('button', {
            type: 'button', key: category.key, class: 'quiet-button study-ai-category',
            onClick: () => { if (categories.value) emit('select', { subject: categories.value.title, category }, categories.value); },
          }, [
            h('span', [h('strong', category.title), h('span', category.description)]),
            h(Icon, { name: 'chevron' }),
          ]))),
      ] : null;
    }

    function title() {
      if (stage.value === 'source') return 'Share your study material';
      if (stage.value === 'start') return 'Choose a category';
      if (stage.value === 'saved') return 'Saved categories';
      if (stage.value === 'generate') return importExisting.value ? 'Import categories' : 'Find categories with AI';
      return categories.value?.title ?? 'Choose a category';
    }
    function subtitle() {
      if (stage.value === 'source') return 'Give the AI your notes first. Choose or create categories afterward.';
      if (stage.value === 'start') return history.value.length ? 'Use saved categories or find new ones with AI.' : 'Find categories in your study material with AI.';
      if (stage.value === 'saved') return 'Choose the list for the material in your AI chat.';
      if (stage.value === 'generate') return importExisting.value
        ? 'Bring in a category list you already have.'
        : 'Use the same AI conversation to organize the material you already shared.';
      return 'Choose a category to create your study set.';
    }

    return () => h('div', [
      h('section', { class: 'study-ai-workspace ai-category-workspace', 'aria-labelledby': 'study-category-title' }, [
        h('header', { class: 'study-ai-header ai-category-header' }, [
          h('div', [
            h('p', { class: 'study-ai-muted' }, props.label + ' · Saved in ' + props.destination),
            h('h2', { id: 'study-category-title', ref: heading, tabindex: -1 }, title()),
            h('p', subtitle()),
          ]),
          h('div', { class: 'study-ai-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: goBack }, 'Back'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
          ]),
        ]),
        (stage.value === 'source' || stage.value === 'start' || stage.value === 'saved' || stage.value === 'choose') ? h('div', { class: 'ai-exchange-progress', 'aria-label': 'Category creation progress' }, [
          h('span', { class: stage.value === 'source' ? 'is-active' : 'is-complete', 'aria-current': stage.value === 'source' ? 'step' : undefined }, '1 · Source'),
          h(Icon, { name: 'chevron' }),
          h('span', { class: stage.value !== 'source' ? 'is-active' : '', 'aria-current': stage.value !== 'source' ? 'step' : undefined }, '2 · Categories'),
        ]) : null,
        storageMessage.value ? h('p', { class: 'study-ai-muted', role: 'status' }, storageMessage.value) : null,
        body(),
      ]),
      clearOpen.value ? h(PopupDialog, {
        title: 'Clear category history?', headingId: 'clear-category-history', returnFocus: clearButton.value,
        onClose: () => { clearOpen.value = false; },
      }, { default: () => [
        h('p', 'Remove all saved category lists from this browser? Your created study sets will not be affected.'),
        h('div', { class: 'study-ai-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { clearOpen.value = false; } }, 'Cancel'),
          h('button', { type: 'button', class: 'delete-confirm-button', onClick: () => {
            history.value = [];
            persist();
            clearOpen.value = false;
            stage.value = 'start';
          } }, 'Clear history'),
        ]),
      ] }) : null,
    ]);
  },
});
