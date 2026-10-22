import { defineComponent, h, nextTick, onMounted, ref, watch, type PropType } from 'vue';
import { AiPromptExchange } from './ai-prompt-exchange.ts';
import { PopupDialog } from './popup-dialog.ts';
import { Icon } from './icon.ts';
import { studyCategoriesPrompt, parseStudyCategories, type AiCardCategories, type AiCardScope } from '../core/ai-study-categories.ts';
import { readCategoryHistory, rememberCategories, writeCategoryHistory, type CategoryHistoryEntry } from '../core/ai-category-history.ts';
import { MAX_AI_IMPORT_LENGTH } from '../core/ai-json.ts';

type CategoryStage = 'start' | 'saved' | 'generate' | 'choose';

export const AiCategoryPicker = defineComponent({
  name: 'AiCategoryPicker',
  props: {
    destination: { type: String, required: true },
    label: { type: String, default: 'Index Cards' },
    totalSteps: { type: Number, default: 2 },
    initialCategories: { type: Object as PropType<AiCardCategories | null>, default: null },
  },
  emits: { back: () => true, cancel: () => true, select: (_scope: AiCardScope, _categories: AiCardCategories) => true },
  setup(props, { emit }) {
    const history = ref(readCategoryHistory());
    const categories = ref<AiCardCategories | null>(props.initialCategories);
    const stage = ref<CategoryStage>(props.initialCategories ? 'choose' : 'start');
    const chosenFrom = ref<'saved' | 'generate' | 'start'>('start');
    const importExisting = ref(false);
    const json = ref('');
    const problem = ref('');
    const heading = ref<HTMLElement | null>(null);
    const historyList = ref<HTMLUListElement | null>(null);
    const clearButton = ref<HTMLButtonElement | null>(null);
    const clearOpen = ref(false);
    const storageMessage = ref('');
    const prompt = studyCategoriesPrompt(props.label);

    onMounted(() => heading.value?.focus({ preventScroll: true }));
    watch(stage, async () => {
      await nextTick();
      heading.value?.focus({ preventScroll: true });
    });

    function persist() {
      storageMessage.value = writeCategoryHistory(history.value) ? '' : 'Category history could not be saved in this browser.';
    }
    function goBack() {
      if (stage.value === 'start') emit('back');
      else if (stage.value === 'choose') stage.value = chosenFrom.value;
      else stage.value = 'start';
    }
    function newCategories(direct = false) {
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
      try {
        const parsed = parseStudyCategories(json.value);
        categories.value = parsed;
        chosenFrom.value = 'generate';
        history.value = rememberCategories(history.value, parsed);
        persist();
        stage.value = 'choose';
      } catch (error) {
        problem.value = error instanceof Error ? error.message : String(error);
      }
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
      if (stage.value === 'start') return [
        h('div', { class: 'ai-category-options' }, [
          history.value.length ? option('Use saved categories', 'Choose from category lists you have used before.', () => { stage.value = 'saved'; }, 'folder') : null,
          option('Find categories with AI', 'Create a category list from your study material.', () => newCategories(), 'ai'),
        ]),
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
          prompt, promptHelp: 'Have your AI find the main categories in your source material.',
          importHelp: 'Paste the category list from your AI chat.',
          json: json.value, problem: problem.value, maxLength: MAX_AI_IMPORT_LENGTH,
          startInImport: importExisting.value, importOnly: importExisting.value,
          validateLabel: 'Check categories',
          onUpdateJson: (value: string) => { json.value = value; problem.value = ''; },
          onValidate: checkResponse,
        }),
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
      if (stage.value === 'start') return 'Choose a category';
      if (stage.value === 'saved') return 'Saved categories';
      if (stage.value === 'generate') return importExisting.value ? 'Import categories' : 'Find categories with AI';
      return categories.value?.title ?? 'Choose a category';
    }
    function subtitle() {
      if (stage.value === 'start') return history.value.length ? 'Use saved categories or find new ones with AI.' : 'Find categories in your study material with AI.';
      if (stage.value === 'saved') return 'Choose a category list to browse.';
      if (stage.value === 'generate') return importExisting.value
        ? 'Bring in a category list you already have.'
        : 'Ask an AI to organize your material, then pick a category.';
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
