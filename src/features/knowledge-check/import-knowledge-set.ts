import { featureDefinitions, type FeatureId } from '../feature-definitions.ts';
import type { IndexCards } from '../index-cards/tree-model.ts';
import { Icon } from '../../components/icon.ts';
import { SetModeIcon } from '../index-cards/set-mode-icon.ts';
import { IndexCardsImportPicker } from './index-cards-import-picker.ts';
import { FillBlankImportResolution } from './fill-blank-import-resolution.ts';
import { createId } from '../../core/ids.ts';
import { inputValue } from '../../core/dom.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import {
  fillBlankCardsWithoutBlanks,
  findIndexCardSet,
  importIndexCardSet,
  importQuestionLimitProblem,
  indexCardMappings,
  indexCardPotentialImportCount,
  intermixQuestionGroups,
  shuffleQuestions,
  type BlanklessFillCardActions,
  type IndexCardImportMapping,
} from './import-index-cards.ts';
import type { Question } from './question-model.ts';
import { computed, defineComponent, h, ref, Transition, type PropType } from 'vue';

interface ImportPlanItem {
  id: string;
  sourceFeatureId: FeatureId;
  sourceItemId: string;
  mappingId: string;
  blanklessActions: BlanklessFillCardActions;
}

type ImportStep = 'sources' | 'options' | 'review';
type ResolutionAction = 'advance' | 'create' | null;
type ImportMixMode = 'grouped' | 'intermixed';

export const ImportKnowledgeSet = defineComponent({
  name: 'ImportKnowledgeSet',
  props: {
    destination: { type: String, required: true },
    indexCards: { type: Object as PropType<IndexCards>, required: true },
  },
  emits: {
    back: () => true,
    create: (_name: string, _questions: Question[]) => true,
  },
  setup(props, { emit }) {
    const name = ref('Imported knowledge set');
    const step = ref<ImportStep>('sources');
    const goingBack = ref(false);
    const stepRegion = ref<HTMLElement | null>(null);
    const items = ref<ImportPlanItem[]>([]);
    const mixMode = ref<ImportMixMode>('grouped');
    const shuffle = ref(false);
    const draggedId = ref<string | null>(null);
    const dropIndex = ref<number | null>(null);
    const pickerItemId = ref<string | null | undefined>(undefined);
    const resolutionItemId = ref<string | null>(null);
    const afterResolution = ref<ResolutionAction>(null);
    const message = ref('');

    function sourceReady(item: ImportPlanItem): boolean {
      if (item.sourceFeatureId !== 'index-cards') return false;
      return Boolean(findIndexCardSet(props.indexCards.items, item.sourceItemId));
    }

    function questionsFor(item: ImportPlanItem): Question[] {
      if (item.sourceFeatureId !== 'index-cards') return [];
      const set = findIndexCardSet(props.indexCards.items, item.sourceItemId);
      if (!set) return [];
      return importIndexCardSet(set, item.mappingId as IndexCardImportMapping, item.blanklessActions);
    }

    function blanklessCardsFor(item: ImportPlanItem) {
      if (item.sourceFeatureId !== 'index-cards') return [];
      const set = findIndexCardSet(props.indexCards.items, item.sourceItemId);
      return set ? fillBlankCardsWithoutBlanks(set) : [];
    }

    function unresolvedBlanklessCount(item: ImportPlanItem): number {
      return blanklessCardsFor(item).filter((card) => !item.blanklessActions[card.cardId]).length;
    }

    const groups = computed(() => items.value.map(questionsFor));
    const questionCount = computed(() => groups.value.reduce((count, group) => count + group.length, 0));
    const unresolvedCount = computed(() => items.value.reduce((count, item) => count + unresolvedBlanklessCount(item), 0));
    const potentialCount = computed(() => items.value.reduce((count, item) => {
      if (item.sourceFeatureId !== 'index-cards') return count;
      const set = findIndexCardSet(props.indexCards.items, item.sourceItemId);
      return set ? count + indexCardPotentialImportCount(
        set,
        item.mappingId as IndexCardImportMapping,
        item.blanklessActions,
      ) : count;
    }, 0));
    const limitProblem = computed(() => unresolvedCount.value ? '' : importQuestionLimitProblem(questionCount.value));
    const potentialLimitProblem = computed(() => importQuestionLimitProblem(potentialCount.value));
    const canContinue = computed(() => items.value.length > 0 && items.value.every(sourceReady) &&
      potentialCount.value > 0 && !potentialLimitProblem.value);
    const canCreate = computed(() => Boolean(name.value.trim()) && items.value.length > 0 &&
      items.value.every(sourceReady) && potentialCount.value > 0 && !limitProblem.value);
    const resolutionItem = computed(() =>
      resolutionItemId.value ? items.value.find((item) => item.id === resolutionItemId.value) ?? null : null);

    function addSource(sourceFeatureId: FeatureId) {
      if (sourceFeatureId !== 'index-cards') return;
      pickerItemId.value = null;
      goingBack.value = false;
      message.value = '';
    }

    function changeSource(item: ImportPlanItem) {
      if (item.sourceFeatureId !== 'index-cards') return;
      pickerItemId.value = item.id;
      goingBack.value = false;
      message.value = '';
    }

    function selectIndexCardSource(sourceItemId: string) {
      const set = findIndexCardSet(props.indexCards.items, sourceItemId);
      if (!set) return;
      const mappingId = indexCardMappings(set)[0]!.id;
      if (pickerItemId.value) {
        const item = items.value.find((entry) => entry.id === pickerItemId.value);
        if (item) {
          item.sourceItemId = sourceItemId;
          item.mappingId = mappingId;
          item.blanklessActions = {};
        }
      } else {
        items.value.push({
          id: createId(),
          sourceFeatureId: 'index-cards',
          sourceItemId,
          mappingId,
          blanklessActions: {},
        });
      }
      pickerItemId.value = undefined;
      goingBack.value = true;
    }

    function removeSource(id: string) {
      items.value = items.value.filter((item) => item.id !== id);
      message.value = '';
    }

    function moveSource(index: number, offset: -1 | 1) {
      const target = index + offset;
      if (target < 0 || target >= items.value.length) return;
      const [item] = items.value.splice(index, 1);
      if (!item) return;
      items.value.splice(target, 0, item);
    }

    function moveDragged(toIndex: number) {
      const id = draggedId.value;
      if (!id) return;
      const fromIndex = items.value.findIndex((item) => item.id === id);
      if (fromIndex < 0 || toIndex < 0 || toIndex >= items.value.length || fromIndex === toIndex) return;
      const [item] = items.value.splice(fromIndex, 1);
      if (!item) return;
      items.value.splice(toIndex, 0, item);
    }

    function setStep(next: ImportStep, backward = false) {
      goingBack.value = backward;
      step.value = next;
      message.value = '';
    }

    function openResolution(item: ImportPlanItem, action: ResolutionAction = null) {
      resolutionItemId.value = item.id;
      afterResolution.value = action;
    }

    function continueSources() {
      if (!items.value.length) {
        message.value = 'Add at least one Index Cards set to continue.';
        return;
      }
      if (!items.value.every(sourceReady)) {
        message.value = 'A selected set is no longer available. Choose another set or remove it.';
        return;
      }
      const unresolved = items.value.find((item) => unresolvedBlanklessCount(item) > 0);
      if (unresolved) {
        openResolution(unresolved, 'advance');
        return;
      }
      if (!questionCount.value) {
        message.value = 'None of the selected cards can become questions. Choose another set or keep a card as a Statement.';
        return;
      }
      const problem = importQuestionLimitProblem(questionCount.value);
      if (problem) {
        message.value = problem;
        return;
      }
      setStep('options');
    }

    function createImportedSet() {
      if (!name.value.trim() || !items.value.length || !items.value.every(sourceReady)) return;
      const unresolved = items.value.find((item) => unresolvedBlanklessCount(item) > 0);
      if (unresolved) {
        openResolution(unresolved, 'create');
        return;
      }
      if (!questionCount.value) {
        message.value = 'The current decisions discard every importable card. Keep at least one card or remove this source.';
        return;
      }
      const problem = importQuestionLimitProblem(questionCount.value);
      if (problem) {
        message.value = problem;
        return;
      }
      const orderedGroups = groups.value;
      let questions = mixMode.value === 'intermixed'
        ? intermixQuestionGroups(orderedGroups)
        : orderedGroups.flat();
      if (shuffle.value) questions = shuffleQuestions(questions);
      emit('create', name.value.trim(), questions);
    }

    function renderPlanItem(item: ImportPlanItem, index: number) {
      const feature = featureDefinitions.find((entry) => entry.id === item.sourceFeatureId)!;
      const set = item.sourceFeatureId === 'index-cards'
        ? findIndexCardSet(props.indexCards.items, item.sourceItemId)
        : null;
      const mappings = indexCardMappings(set);
      const mapping = mappings.find((entry) => entry.id === item.mappingId) ?? mappings[0]!;
      const importedCount = questionsFor(item).length;
      const blankless = blanklessCardsFor(item);
      const unresolvedBlankless = unresolvedBlanklessCount(item);
      const statementCount = blankless.filter((card) => item.blanklessActions[card.cardId] === 'statement').length;
      const discardCount = blankless.filter((card) => item.blanklessActions[card.cardId] === 'discard').length;

      return h('li', {
        key: item.id,
        class: ['knowledge-import-item', {
          'is-dragging': draggedId.value === item.id,
          'is-drop-target': dropIndex.value === index && draggedId.value !== item.id,
        }],
        draggable: true,
        onDragstart: (event: DragEvent) => {
          draggedId.value = item.id;
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', item.id);
          }
        },
        onDragover: (event: DragEvent) => {
          event.preventDefault();
          dropIndex.value = index;
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        },
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          moveDragged(index);
          draggedId.value = null;
          dropIndex.value = null;
        },
        onDragend: () => {
          draggedId.value = null;
          dropIndex.value = null;
        },
      }, [
        h('div', { class: 'knowledge-import-item-order', 'aria-hidden': 'true' }, [
          h(Icon, { name: 'grip' }),
          h('span', String(index + 1)),
        ]),
        h('div', { class: 'knowledge-import-item-app' }, [
          set
            ? h(SetModeIcon, { mode: set.mode ?? 'flash-cards', compact: true })
            : h(Icon, { name: feature.icon }),
          h('div', [
            h('strong', set?.name ?? feature.label),
            h('span', set
              ? `${(set.mode ?? 'flash-cards') === 'fill-in-the-blanks' ? 'Fill in the Blanks' : 'Flash Cards'} · ${set.cards.length} cards`
              : 'Select another source'),
          ]),
          h('span', { class: 'knowledge-import-item-count' }, `${importedCount} ready`),
        ]),
        h('div', { class: 'knowledge-import-item-options' }, [
          h('button', {
            type: 'button', class: 'quiet-button knowledge-import-change-source',
            onClick: () => changeSource(item),
          }, 'Change set'),
          mappings.length > 1 ? h('label', { class: 'knowledge-import-direction' }, [
            h('span', 'Question direction'),
            h('select', {
              value: mapping.id,
              disabled: !set,
              title: mapping.description,
              onChange: (event: Event) => { item.mappingId = inputValue(event); },
            }, mappings.map((entry) => h('option', { value: entry.id }, entry.label))),
          ]) : null,
          blankless.length ? h('button', {
            type: 'button',
            class: ['quiet-button', 'knowledge-import-decisions', { 'is-pending': unresolvedBlankless > 0 }],
            onClick: () => openResolution(item),
          }, [
            h(Icon, { name: unresolvedBlankless ? 'lightbulb' : 'check' }),
            unresolvedBlankless
              ? `Resolve ${unresolvedBlankless} ${unresolvedBlankless === 1 ? 'card' : 'cards'}`
              : `${statementCount} Statements · ${discardCount} skipped`,
          ]) : null,
        ]),
        h('div', { class: 'knowledge-import-item-actions' }, [
          h('button', {
            type: 'button', class: 'icon-button', title: 'Move up',
            'aria-label': `Move ${feature.label} source up`, disabled: index === 0,
            onClick: () => moveSource(index, -1),
          }, [h(Icon, { name: 'chevron-up' })]),
          h('button', {
            type: 'button', class: 'icon-button', title: 'Move down',
            'aria-label': `Move ${feature.label} source down`, disabled: index === items.value.length - 1,
            onClick: () => moveSource(index, 1),
          }, [h(Icon, { name: 'chevron-down' })]),
          h('button', {
            type: 'button', class: 'icon-button delete-button', title: 'Remove import source',
            'aria-label': `Remove ${feature.label} import source`, onClick: () => removeSource(item.id),
          }, [h(Icon, { name: 'trash' })]),
        ]),
      ]);
    }


    function renderSources() {
      return h('section', { class: 'knowledge-import-step-content', 'aria-label': 'Select sources' }, [
        h('header', { class: 'knowledge-import-step-heading' }, [
          h('h3', 'Choose your sources'),
          h('p', 'Pick one or more saved Index Cards sets.'),
        ]),
        items.value.length ? h('div', { class: 'knowledge-import-source-summary' }, [
          h('strong', `${items.value.length} ${items.value.length === 1 ? 'set' : 'sets'} selected`),
          h('span', `${questionCount.value} questions${unresolvedCount.value ? ` · ${unresolvedCount.value} decisions needed` : ''}`),
        ]) : null,
        items.value.length
          ? h('ol', { class: 'knowledge-import-list', 'aria-label': 'Selected sets' },
            items.value.map(renderPlanItem))
          : h('div', { class: 'knowledge-import-start-empty' }, [
            h(Icon, { name: 'cards' }),
            h('strong', 'Start with an Index Cards set'),
            h('p', 'Flash Cards and Fill in the Blanks can become Review questions.'),
          ]),
        items.value.length && !potentialCount.value
          ? h('p', { class: 'knowledge-message', role: 'status' },
            'These sets have no importable questions yet. Try another set or change the question direction.') : null,
        h('button', {
          type: 'button', class: 'quiet-button knowledge-import-add-source',
          onClick: () => addSource('index-cards'),
        }, [h(Icon, { name: 'plus' }), items.value.length ? 'Add another set' : 'Choose an Index Cards set']),
      ]);
    }

    function renderOptions() {
      return h('section', { class: 'knowledge-import-step-content', 'aria-label': 'Arrange imported questions' }, [
        h('header', { class: 'knowledge-import-step-heading' }, [
          h('h3', 'Arrange your questions'),
          h('p', 'Choose how the imported questions will be ordered.'),
        ]),
        items.value.length > 1 ? h('fieldset', { class: 'knowledge-import-combine-options' }, [
          h('legend', 'When combining sets'),
          h('div', { class: 'knowledge-import-combine-grid' }, [
            h('label', { class: 'knowledge-import-radio-option' }, [
              h('input', { type: 'radio', name: 'import-mix-mode', value: 'grouped',
                checked: mixMode.value === 'grouped',
                onChange: () => { mixMode.value = 'grouped'; } }),
              h('span', [
                h('strong', 'Keep sets together'),
                h('span', 'Finish one set before the next.'),
              ]),
            ]),
            h('label', { class: 'knowledge-import-radio-option' }, [
              h('input', { type: 'radio', name: 'import-mix-mode', value: 'intermixed',
                checked: mixMode.value === 'intermixed',
                onChange: () => { mixMode.value = 'intermixed'; } }),
              h('span', [
                h('strong', 'Alternate between sets'),
                h('span', 'Take turns drawing from each set.'),
              ]),
            ]),
          ]),
        ]) : null,
        h('label', { class: 'knowledge-import-shuffle-choice' }, [
          h('input', {
            type: 'checkbox', checked: shuffle.value,
            onChange: (event: Event) => { shuffle.value = event.target instanceof HTMLInputElement && event.target.checked; },
          }),
          h('span', [
            h('strong', 'Shuffle imported questions'),
            h('span', 'Randomize the saved order.'),
          ]),
        ]),
      ]);
    }

    function renderReview() {
      return h('section', { class: 'knowledge-import-step-content', 'aria-label': 'Review import' }, [
        h('header', { class: 'knowledge-import-step-heading' }, [
          h('h3', 'Ready to import'),
          h('p', 'Give your knowledge set a name and check the details.'),
        ]),
        h('label', { class: 'knowledge-field knowledge-import-name' }, [
          'Knowledge set name',
          h('input', {
            value: name.value, maxlength: MAX_NAME_LENGTH,
            onInput: (event: Event) => { name.value = inputValue(event); },
          }),
        ]),
        h('dl', { class: 'knowledge-import-recap' }, [
          h('div', [h('dt', 'Destination'), h('dd', props.destination)]),
          h('div', [h('dt', 'Sources'), h('dd', `${items.value.length} Index Cards ${items.value.length === 1 ? 'set' : 'sets'}`)]),
          h('div', [h('dt', 'Questions'), h('dd', String(questionCount.value))]),
          h('div', [h('dt', 'Order'), h('dd', shuffle.value ? 'Shuffled'
            : items.value.length > 1 && mixMode.value === 'intermixed' ? 'Alternating sets' : 'Original set order')]),
        ]),
        h('p', { class: 'knowledge-import-copy-note' }, [
          h(Icon, { name: 'duplicate' }),
          'This creates a separate copy. Changes to the original cards won’t sync.',
        ]),
      ]);
    }

    function renderProgress() {
      const steps: { id: ImportStep; label: string }[] = [
        { id: 'sources', label: 'Sources' },
        { id: 'options', label: 'Arrange' },
        { id: 'review', label: 'Review' },
      ];
      const current = steps.findIndex((entry) => entry.id === step.value);
      return h('ol', { class: 'knowledge-import-progress', 'aria-label': 'Import progress' },
        steps.map((entry, index) => h('li', {
          key: entry.id, class: { 'is-current': index === current, 'is-complete': index < current },
          'aria-current': index === current ? 'step' : undefined,
        }, [
          h('span', { class: 'knowledge-import-progress-mark', 'aria-hidden': 'true' },
            index < current ? [h(Icon, { name: 'check' })] : String(index + 1)),
          h('span', entry.label),
        ])));
    }

    return () => h('section', {
      class: ['knowledge-set-builder', 'knowledge-import-builder', { 'is-backward': goingBack.value }],
      'aria-label': 'Import knowledge set',
    }, [
      h('header', { class: 'knowledge-import-flow-header' }, [
        h('div', [
          h('span', { class: 'knowledge-import-kicker' }, 'REVIEW / IMPORT'),
          h('h2', 'Import knowledge set'),
        ]),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Cancel'),
      ]),
      renderProgress(),
      h(Transition, {
        name: 'knowledge-import-stage', mode: 'out-in',
        onAfterEnter: () => { stepRegion.value?.focus({ preventScroll: true }); },
      }, {
        default: () => h('div', {
          key: pickerItemId.value !== undefined ? 'picker' : step.value,
          ref: stepRegion, tabindex: -1, role: 'region',
          'aria-label': pickerItemId.value !== undefined ? 'Choose an Index Cards set' :
            step.value === 'sources' ? 'Choose sources' : step.value === 'options' ? 'Arrange questions' : 'Review import',
          class: 'knowledge-import-stage',
        }, pickerItemId.value !== undefined
          ? [h(IndexCardsImportPicker, {
            items: props.indexCards.items,
            selectedId: pickerItemId.value
              ? items.value.find((entry) => entry.id === pickerItemId.value)?.sourceItemId ?? null
              : null,
            onSelect: selectIndexCardSource,
            onCancel: () => { goingBack.value = true; pickerItemId.value = undefined; },
          })]
          : [step.value === 'sources' ? renderSources()
            : step.value === 'options' ? renderOptions() : renderReview()]),
      }),
      pickerItemId.value === undefined ? [
        potentialLimitProblem.value && step.value === 'sources'
          ? h('p', { class: 'knowledge-message', role: 'alert' }, potentialLimitProblem.value) : null,
        message.value ? h('p', { class: 'knowledge-message', role: 'alert' }, message.value) : null,
        h('footer', { class: 'knowledge-import-flow-footer' }, [
          h('span', { class: 'knowledge-import-footer-count' }, items.value.length
            ? `${questionCount.value} ${questionCount.value === 1 ? 'question' : 'questions'}`
            : 'No sources selected'),
          h('div', { class: 'knowledge-import-footer-actions' }, [
            step.value !== 'sources' ? h('button', {
              type: 'button', class: 'quiet-button',
              onClick: () => setStep(step.value === 'review' ? 'options' : 'sources', true),
            }, 'Back') : null,
            step.value === 'sources' ? h('button', {
              type: 'button', class: 'card-primary-button', disabled: !canContinue.value,
              onClick: continueSources,
            }, ['Continue', h(Icon, { name: 'chevron' })])
              : step.value === 'options' ? h('button', {
                type: 'button', class: 'card-primary-button', onClick: () => setStep('review'),
              }, ['Review import', h(Icon, { name: 'chevron' })])
                : h('button', {
                  type: 'button', class: 'card-primary-button', disabled: !canCreate.value,
                  onClick: createImportedSet,
                }, 'Create knowledge set'),
          ]),
        ]),
      ] : null,
      resolutionItem.value ? h(FillBlankImportResolution, {
        entries: blanklessCardsFor(resolutionItem.value),
        initial: resolutionItem.value.blanklessActions,
        onCancel: () => {
          resolutionItemId.value = null;
          afterResolution.value = null;
        },
        onApply: (actions: BlanklessFillCardActions) => {
          const item = resolutionItem.value;
          if (!item) return;
          item.blanklessActions = { ...actions };
          const action = afterResolution.value;
          resolutionItemId.value = null;
          afterResolution.value = null;
          message.value = '';
          if (action === 'advance') continueSources();
          else if (action === 'create') createImportedSet();
        },
      }) : null,
    ]);
  },
});
