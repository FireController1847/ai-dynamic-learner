import { featureDefinitions, type FeatureId } from '../feature-definitions.ts';
import type { IndexCards } from '../index-cards/tree-model.ts';
import { Icon } from '../../components/icon.ts';
import { SetModeIcon } from '../index-cards/set-mode-icon.ts';
import { IndexCardsImportPicker } from './index-cards-import-picker.ts';
import { createId } from '../../core/ids.ts';
import { inputValue } from '../../core/dom.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import {
  findIndexCardSet,
  importIndexCardSet,
  importQuestionLimitProblem,
  indexCardMappings,
  intermixQuestionGroups,
  shuffleQuestions,
  type IndexCardImportMapping,
} from './import-index-cards.ts';
import type { Question } from './question-model.ts';
import { computed, defineComponent, h, ref, type PropType } from 'vue';

interface ImportPlanItem {
  id: string;
  sourceFeatureId: FeatureId;
  sourceItemId: string;
  mappingId: string;
}

type ImportTab = 'sources' | 'options';
type ImportMixMode = 'grouped' | 'intermixed';

const applicationSources = featureDefinitions.filter((feature) => feature.group === 'applications' && !feature.hidden);

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
    const tab = ref<ImportTab>('sources');
    const items = ref<ImportPlanItem[]>([]);
    const mixMode = ref<ImportMixMode>('grouped');
    const shuffle = ref(false);
    const draggedId = ref<string | null>(null);
    const dropIndex = ref<number | null>(null);
    const pickerItemId = ref<string | null | undefined>(undefined);
    const message = ref('');

    function sourceReady(item: ImportPlanItem): boolean {
      if (item.sourceFeatureId !== 'index-cards') return false;
      const set = findIndexCardSet(props.indexCards.items, item.sourceItemId);
      return Boolean(set && importIndexCardSet(set, item.mappingId as IndexCardImportMapping).length);
    }

    function questionsFor(item: ImportPlanItem): Question[] {
      if (item.sourceFeatureId !== 'index-cards') return [];
      const set = findIndexCardSet(props.indexCards.items, item.sourceItemId);
      if (!set) return [];
      return importIndexCardSet(set, item.mappingId as IndexCardImportMapping);
    }

    const groups = computed(() => items.value.map(questionsFor));
    const questionCount = computed(() => groups.value.reduce((count, group) => count + group.length, 0));
    const limitProblem = computed(() => importQuestionLimitProblem(questionCount.value));
    const canCreate = computed(() => Boolean(name.value.trim()) && items.value.length > 0 &&
      items.value.every(sourceReady) && questionCount.value > 0 && !limitProblem.value);

    function addSource(sourceFeatureId: FeatureId) {
      if (sourceFeatureId !== 'index-cards') return;
      pickerItemId.value = null;
      message.value = '';
    }

    function changeSource(item: ImportPlanItem) {
      if (item.sourceFeatureId !== 'index-cards') return;
      pickerItemId.value = item.id;
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
        }
      } else {
        items.value.push({
          id: createId(),
          sourceFeatureId: 'index-cards',
          sourceItemId,
          mappingId,
        });
      }
      pickerItemId.value = undefined;
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

    function createImportedSet() {
      if (!canCreate.value) return;
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
              ? `Index Cards · ${(set.mode ?? 'flash-cards') === 'fill-in-the-blanks' ? 'Fill in the Blanks' : 'Flash Cards'} · ${set.cards.length} saved · ${importedCount} importable`
              : 'Choose a library set to import.'),
          ]),
        ]),
        h('div', { class: 'knowledge-import-item-options' }, [
          h('div', { class: 'knowledge-import-source-choice' }, [
            h('span', 'Source'),
            h('button', {
              type: 'button',
              class: 'quiet-button',
              onClick: () => changeSource(item),
            }, set ? 'Change set' : 'Choose set'),
          ]),
          h('label', [
            h('span', 'Import as'),
            h('select', {
              value: mapping.id,
              disabled: !set,
              onChange: (event: Event) => { item.mappingId = inputValue(event); },
            }, mappings.map((entry) => h('option', { value: entry.id }, entry.label))),
          ]),
          h('p', set ? mapping.description : 'Choose a library set first.'),
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
      return h('div', { class: 'knowledge-import-sources-page' }, [
        h('section', { class: 'knowledge-import-plan', 'aria-labelledby': 'knowledge-import-plan-title' }, [
          h('div', { class: 'knowledge-import-section-heading' }, [
            h('div', [
              h('h3', { id: 'knowledge-import-plan-title' }, 'Sources'),
              h('p', 'Each row imports one selected library set. Add the same set more than once if you want different mappings or repeated questions.'),
            ]),
            h('span', { class: 'knowledge-info-pill' }, `${questionCount.value} ${questionCount.value === 1 ? 'question' : 'questions'}`),
          ]),
          items.value.length
            ? h('ol', { class: 'knowledge-import-list' }, items.value.map(renderPlanItem))
            : h('div', { class: 'knowledge-import-empty' }, [
              h(Icon, { name: 'upload' }),
              h('strong', 'No import sources yet'),
              h('p', 'Add an application below, then choose the specific library set to import.'),
            ]),
        ]),
        h('section', { class: 'knowledge-import-sources', 'aria-labelledby': 'knowledge-import-source-title' }, [
          h('div', { class: 'knowledge-import-section-heading' }, [
            h('div', [
              h('h3', { id: 'knowledge-import-source-title' }, 'Add from an application'),
              h('p', 'Supported applications expose their saved library here. More import adapters can be added without changing the ordered-plan workflow.'),
            ]),
          ]),
          h('div', { class: 'knowledge-import-source-list' }, applicationSources.map((feature) => {
            const available = feature.id === 'index-cards';
            return h('button', {
              key: feature.id,
              type: 'button',
              class: ['knowledge-import-source-card', { 'is-coming-soon': !available }],
              disabled: !available,
              onClick: () => addSource(feature.id),
            }, [
              h(Icon, { name: feature.icon }),
              h('span', { class: 'knowledge-import-source-copy' }, [
                h('strong', feature.label),
                h('span', available ? 'Choose a saved Flash Cards or Fill in the Blanks set.' : feature.description),
              ]),
              available
                ? h('span', { class: 'knowledge-import-source-add' }, [h(Icon, { name: 'plus' }), 'Add source'])
                : h('span', { class: 'knowledge-import-coming-soon' }, 'Coming soon'),
            ]);
          })),
        ]),
      ]);
    }

    function renderOptions() {
      return h('section', { class: 'knowledge-options knowledge-import-options', 'aria-label': 'Import options' }, [
        h('h3', 'Import options'),
        h('p', { class: 'knowledge-muted' }, 'These options affect how the new knowledge set is constructed. They do not control how a later Study, Quiz, or Test session presents it.'),
        h('fieldset', { class: 'knowledge-import-option-group' }, [
          h('legend', 'Combine sources'),
          h('label', { class: 'knowledge-import-radio-option' }, [
            h('input', { type: 'radio', name: 'import-mix-mode', value: 'grouped', checked: mixMode.value === 'grouped',
              onChange: () => { mixMode.value = 'grouped'; } }),
            h('span', [
              h('strong', 'Keep source blocks together'),
              h('span', 'Questions from each selected library set stay together, following the Sources order.'),
            ]),
          ]),
          h('label', { class: 'knowledge-import-radio-option' }, [
            h('input', { type: 'radio', name: 'import-mix-mode', value: 'intermixed', checked: mixMode.value === 'intermixed',
              onChange: () => { mixMode.value = 'intermixed'; } }),
            h('span', [
              h('strong', 'Intermix sources'),
              h('span', 'Round-robin questions from the selected library sets while preserving each set’s internal order.'),
            ]),
          ]),
        ]),
        h('label', { class: 'knowledge-option-toggle knowledge-import-shuffle-option' }, [
          h('input', {
            type: 'checkbox', checked: shuffle.value,
            onChange: (event: Event) => { shuffle.value = event.target instanceof HTMLInputElement && event.target.checked; },
          }),
          'Shuffle questions while importing',
        ]),
        h('p', { class: 'knowledge-muted' }, 'This randomizes the saved question order itself. Study, Quiz, and Test can still apply their own ordering behavior later, so this is optional.'),
      ]);
    }

    return () => h('section', { class: 'knowledge-set-builder knowledge-import-builder', 'aria-label': 'Import knowledge set' }, [
      h('header', { class: 'knowledge-builder-header' }, [
        h('div', [
          h('h2', 'Import knowledge set'),
          h('p', 'Combine selected library sets from other applications into a new Review knowledge set.'),
        ]),
        h('div', { class: 'knowledge-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Cancel'),
          h('button', { type: 'button', class: 'card-primary-button', disabled: !canCreate.value,
            onClick: createImportedSet }, 'Create knowledge set'),
        ]),
      ]),
      h('p', { class: 'knowledge-muted' }, `Saved in ${props.destination}.`),
      h('aside', { class: 'knowledge-import-sync-note', role: 'note' }, [
        h(Icon, { name: 'duplicate' }),
        h('div', [
          h('strong', 'Importing is not synchronization.'),
          h('p', 'Review creates an independent copy. Later edits in Index Cards will not update this knowledge set, and edits here will not update the cards. Import the source again when you want a fresh copy.'),
        ]),
      ]),
      h('label', { class: 'knowledge-field' }, [
        'Set name',
        h('input', { value: name.value, maxlength: MAX_NAME_LENGTH,
          onInput: (event: Event) => { name.value = inputValue(event); } }),
      ]),
      pickerItemId.value !== undefined
        ? h(IndexCardsImportPicker, {
          items: props.indexCards.items,
          selectedId: pickerItemId.value
            ? items.value.find((entry) => entry.id === pickerItemId.value)?.sourceItemId ?? null
            : null,
          onSelect: selectIndexCardSource,
          onCancel: () => { pickerItemId.value = undefined; },
        })
        : [
          h('div', { class: 'knowledge-builder-tabs', role: 'group', 'aria-label': 'Import builder pages' }, [
            h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': tab.value === 'sources',
              onClick: () => { tab.value = 'sources'; } }, 'Sources'),
            h('button', { type: 'button', class: 'quiet-button', 'aria-pressed': tab.value === 'options',
              onClick: () => { tab.value = 'options'; } }, 'Import options'),
          ]),
          limitProblem.value ? h('p', { class: 'knowledge-message', role: 'alert' }, limitProblem.value) : null,
          message.value ? h('p', { class: 'knowledge-message', role: 'alert' }, message.value) : null,
          tab.value === 'options' ? renderOptions() : renderSources(),
        ],
      items.value.length && !questionCount.value
        ? h('p', { class: 'knowledge-muted knowledge-import-future-note' }, 'The selected sources do not currently contain any complete cards that can become Review questions.')
        : null,
    ]);
  },
});
