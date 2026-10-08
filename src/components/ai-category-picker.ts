import { defineComponent, h, nextTick, onMounted, ref, type PropType } from 'vue';
import { AiPromptExchange, type AiPromptExchangeHandle } from './ai-prompt-exchange.ts';
import { PopupDialog } from './popup-dialog.ts';
import { categoryResponseJson, studyCategoriesPrompt, parseStudyCategories, type AiCardCategories, type AiCardScope } from '../core/ai-study-categories.ts';
import { readCategoryHistory, rememberCategories, writeCategoryHistory, type CategoryHistoryEntry } from '../core/ai-category-history.ts';
import { MAX_AI_IMPORT_LENGTH } from '../core/ai-json.ts';

export const AiCategoryPicker = defineComponent({
  name: 'AiCategoryPicker',
  props: {
    destination: { type: String, required: true },
    label: { type: String, default: 'Index Cards' },
    initialCategories: { type: Object as PropType<AiCardCategories | null>, default: null },
  },
  emits: { back: () => true, cancel: () => true, select: (_scope: AiCardScope, _categories: AiCardCategories) => true },
  setup(props, { emit }) {
    const categories = ref<AiCardCategories | null>(props.initialCategories);
    const json = ref(props.initialCategories ? categoryResponseJson(props.initialCategories) : '');
    const problem = ref('');
    const heading = ref<HTMLElement | null>(null);
    const exchange = ref<AiPromptExchangeHandle | null>(null);
    const history = ref(readCategoryHistory());
    const clearOpen = ref(false);
    const clearButton = ref<HTMLButtonElement | null>(null);
    const storageMessage = ref('');
    const prompt = studyCategoriesPrompt(props.label);
    onMounted(() => heading.value?.focus());
    function persist() {
      storageMessage.value = writeCategoryHistory(history.value) ? '' : 'History could not be updated in this browser. Your current category list is still available.';
    }
    function validate() {
      problem.value = '';
      categories.value = null;
      try {
        categories.value = parseStudyCategories(json.value);
        history.value = rememberCategories(history.value, categories.value);
        persist();
      } catch (error) { problem.value = error instanceof Error ? error.message : String(error); }
    }
    function reuse(entry: CategoryHistoryEntry) {
      json.value = categoryResponseJson(entry.categories);
      categories.value = parseStudyCategories(json.value);
      problem.value = '';
      history.value = rememberCategories(history.value, categories.value);
      persist();
      exchange.value?.showImport();
    }
    function categoryWorkspace() {
      return h('section', { key: 'categories', class: 'study-ai-workspace', 'aria-labelledby': 'index-cards-category-title' }, [
        h('header', { class: 'study-ai-header' }, [
          h('div', [
            h('p', { class: 'study-ai-muted' }, `${props.label} · Saved in ${props.destination}`),
            h('h2', { id: 'index-cards-category-title', ref: heading, tabindex: -1 }, 'Find your study categories'),
            h('p', 'Step 1 of 2 · Find categories from your source, then choose one for a focused study set.'),
          ]),
          h('div', { class: 'study-ai-actions' }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('cancel') }, 'Cancel'),
          ]),
        ]),
        history.value.length ? h('details', { class: 'study-ai-history', open: true }, [
          h('summary', `Category history (${history.value.length})`),
          h('p', { class: 'study-ai-muted' }, 'Reuse a category list, then use its matching source in your AI conversation.'),
          h('ul', history.value.map(entry => h('li', { key: entry.id }, [
            h('button', { type: 'button', class: 'quiet-button', onClick: () => reuse(entry) }, [
              h('strong', entry.categories.title),
              h('span', { class: 'study-ai-muted' }, `${entry.categories.categories.length} categories · ${new Date(entry.savedAt).toLocaleDateString()}`),
              h('span', 'Use'),
            ]),
          ]))),
          h('button', { ref: clearButton, type: 'button', class: 'quiet-button', onClick: () => { clearOpen.value = true; } }, 'Clear history'),
        ]) : null,
        storageMessage.value ? h('p', { role: 'status', class: 'study-ai-muted' }, storageMessage.value) : null,
        h(AiPromptExchange, {
          ref: exchange, idPrefix: 'index-cards-category', label: 'Categories', prompt,
          json: json.value, problem: problem.value, maxLength: MAX_AI_IMPORT_LENGTH,
          startInImport: categories.value !== null, hasPreview: categories.value !== null,
          validateLabel: 'Validate categories',
          promptHelp: 'Give the AI the source material first. This prompt asks only for categories; you will generate the set after choosing one. You can also reuse a list from category history.',
          importHelp: 'Send the category prompt in the conversation containing your source. Wait for the category JSON, then bring it back here.',
          readyInstructions: ['Paste the category JSON below.', 'Choose Validate categories.', 'Choose a category to generate the second prompt.'],
          onUpdateJson: (value: string) => { json.value = value; categories.value = null; problem.value = ''; },
          onValidate: validate,
        }, {
          preview: () => categories.value ? h('div', { class: 'study-ai-preview' }, [
            h('h3', categories.value.title), h('p', 'Choose a category for your study set.'),
            h('div', { class: 'study-ai-categories', 'aria-label': 'Study categories' }, categories.value.categories.map(category => h('button', {
              key: category.key, type: 'button', class: 'quiet-button study-ai-category',
              onClick: () => { if (categories.value) emit('select', { subject: categories.value.title, category }, categories.value); },
            }, [h('strong', category.title), h('span', category.description)]))),
          ]) : null,
        }),
      ]);
    }
    return () => h('div', [categoryWorkspace(),
      clearOpen.value ? h(PopupDialog, {
        title: 'Clear category history?', headingId: 'index-cards-clear-history', returnFocus: clearButton.value,
        onClose: () => { clearOpen.value = false; },
      }, { default: () => [
        h('p', 'Remove all saved category lists from this browser? Your current list and saved sets will stay available.'),
        h('div', { class: 'study-ai-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => { clearOpen.value = false; } }, 'Cancel'),
          h('button', { type: 'button', class: 'delete-confirm-button', onClick: () => {
            history.value = []; persist(); clearOpen.value = false;
            nextTick(() => heading.value?.focus({ preventScroll: true }));
          } }, 'Clear history'),
        ]),
      ] }) : null,
    ]);
  },
});
