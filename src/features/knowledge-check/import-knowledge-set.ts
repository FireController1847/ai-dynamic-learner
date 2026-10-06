import { featureDefinitions, type FeatureId } from '../feature-definitions.ts';
import { Icon } from '../../components/icon.ts';
import { createId } from '../../core/ids.ts';
import { inputValue } from '../../core/dom.ts';
import { MAX_NAME_LENGTH } from './library-model.ts';
import { defineComponent, h, ref } from 'vue';

interface ImportMapping {
  id: string;
  label: string;
  description: string;
}

interface ImportPlanItem {
  id: string;
  sourceFeatureId: FeatureId;
  mappingId: string;
}

type ImportTab = 'sources' | 'options';
type ImportMixMode = 'grouped' | 'intermixed';

const DEFAULT_MAPPING: ImportMapping = {
  id: 'default',
  label: 'Use the app’s default Review mapping',
  description: 'Use the source app’s recommended question conversion when its importer is connected.',
};

const IMPORT_MAPPINGS: Partial<Record<FeatureId, readonly ImportMapping[]>> = {
  'index-cards': [
    {
      id: 'match-card-type',
      label: 'Match each card type',
      description: 'Flash Cards become question-and-answer items; Fill in the Blanks keep their blank structure.',
    },
    {
      id: 'front-to-back',
      label: 'Front → back',
      description: 'Use the front as the prompt and the back as the expected answer where supported.',
    },
  ],
  'word-search': [
    {
      id: 'clue-to-word',
      label: 'Clue → word',
      description: 'Use each available clue as the prompt and its word as the expected answer.',
    },
    {
      id: 'word-to-clue',
      label: 'Word → clue',
      description: 'Reverse supported clue pairs so the word becomes the prompt.',
    },
  ],
  crossword: [
    {
      id: 'clue-to-answer',
      label: 'Clue → answer',
      description: 'Use crossword clues as prompts and their entries as expected answers.',
    },
    {
      id: 'answer-to-clue',
      label: 'Answer → clue',
      description: 'Reverse the relationship and ask for each clue from its answer.',
    },
  ],
};

const applicationSources = featureDefinitions.filter((feature) => feature.group === 'applications' && !feature.hidden);

function mappingsFor(featureId: FeatureId): readonly ImportMapping[] {
  return IMPORT_MAPPINGS[featureId] ?? [DEFAULT_MAPPING];
}

export const ImportKnowledgeSet = defineComponent({
  name: 'ImportKnowledgeSet',
  props: { destination: { type: String, required: true } },
  emits: { back: () => true },
  setup(props, { emit }) {
    const name = ref('Imported knowledge set');
    const tab = ref<ImportTab>('sources');
    const items = ref<ImportPlanItem[]>([]);
    const mixMode = ref<ImportMixMode>('grouped');
    const shuffle = ref(false);
    const draggedId = ref<string | null>(null);
    const dropIndex = ref<number | null>(null);

    function addSource(sourceFeatureId: FeatureId) {
      const mapping = mappingsFor(sourceFeatureId)[0]!;
      items.value.push({ id: createId(), sourceFeatureId, mappingId: mapping.id });
    }

    function removeSource(id: string) {
      items.value = items.value.filter((item) => item.id !== id);
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

    function sourceDefinition(featureId: FeatureId) {
      return featureDefinitions.find((feature) => feature.id === featureId)!;
    }

    function renderPlanItem(item: ImportPlanItem, index: number) {
      const feature = sourceDefinition(item.sourceFeatureId);
      const mappings = mappingsFor(item.sourceFeatureId);
      const mapping = mappings.find((entry) => entry.id === item.mappingId) ?? mappings[0]!;
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
          h(Icon, { name: feature.icon }),
          h('div', [
            h('strong', feature.label),
            h('span', 'Source selection will come from this app’s library.'),
          ]),
        ]),
        h('div', { class: 'knowledge-import-item-options' }, [
          h('label', [
            h('span', 'Import as'),
            h('select', {
              value: item.mappingId,
              onChange: (event: Event) => {
                if (!(event.target instanceof HTMLSelectElement)) return;
                item.mappingId = event.target.value;
              },
            }, mappings.map((entry) => h('option', { value: entry.id }, entry.label))),
          ]),
          h('p', mapping.description),
        ]),
        h('div', { class: 'knowledge-import-item-actions' }, [
          h('button', {
            type: 'button',
            class: 'icon-button',
            title: 'Move up',
            'aria-label': `Move ${feature.label} source up`,
            disabled: index === 0,
            onClick: () => moveSource(index, -1),
          }, [h(Icon, { name: 'chevron-up' })]),
          h('button', {
            type: 'button',
            class: 'icon-button',
            title: 'Move down',
            'aria-label': `Move ${feature.label} source down`,
            disabled: index === items.value.length - 1,
            onClick: () => moveSource(index, 1),
          }, [h(Icon, { name: 'chevron-down' })]),
          h('button', {
            type: 'button',
            class: 'icon-button delete-button',
            title: 'Remove import source',
            'aria-label': `Remove ${feature.label} import source`,
            onClick: () => removeSource(item.id),
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
              h('p', 'Arrange sources in the order you want their questions constructed into the new set.'),
            ]),
            h('span', { class: 'knowledge-info-pill' }, `${items.value.length} ${items.value.length === 1 ? 'source' : 'sources'}`),
          ]),
          items.value.length
            ? h('ol', { class: 'knowledge-import-list' }, items.value.map(renderPlanItem))
            : h('div', { class: 'knowledge-import-empty' }, [
              h(Icon, { name: 'upload' }),
              h('strong', 'No import sources yet'),
              h('p', 'Add an application below to begin building the import order.'),
            ]),
        ]),
        h('section', { class: 'knowledge-import-sources', 'aria-labelledby': 'knowledge-import-source-title' }, [
          h('div', { class: 'knowledge-import-section-heading' }, [
            h('div', [
              h('h3', { id: 'knowledge-import-source-title' }, 'Add from an application'),
              h('p', 'Each application can be added more than once so separate future library selections can be combined.'),
            ]),
          ]),
          h('div', { class: 'knowledge-import-source-list' }, applicationSources.map((feature) =>
            h('button', {
              key: feature.id,
              type: 'button',
              class: 'knowledge-import-source-card',
              onClick: () => addSource(feature.id),
            }, [
              h(Icon, { name: feature.icon }),
              h('span', { class: 'knowledge-import-source-copy' }, [
                h('strong', feature.label),
                h('span', feature.description),
              ]),
              h('span', { class: 'knowledge-import-source-add' }, [
                h(Icon, { name: 'plus' }),
                'Add source',
              ]),
            ]))),
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
            h('input', {
              type: 'radio', name: 'import-mix-mode', value: 'grouped',
              checked: mixMode.value === 'grouped',
              onChange: () => { mixMode.value = 'grouped'; },
            }),
            h('span', [
              h('strong', 'Keep source blocks together'),
              h('span', 'Questions from each source stay together, following the source order from the Sources page.'),
            ]),
          ]),
          h('label', { class: 'knowledge-import-radio-option' }, [
            h('input', {
              type: 'radio', name: 'import-mix-mode', value: 'intermixed',
              checked: mixMode.value === 'intermixed',
              onChange: () => { mixMode.value = 'intermixed'; },
            }),
            h('span', [
              h('strong', 'Intermix sources'),
              h('span', 'Distribute questions from the configured sources throughout the constructed knowledge set.'),
            ]),
          ]),
        ]),
        h('label', { class: 'knowledge-option-toggle knowledge-import-shuffle-option' }, [
          h('input', {
            type: 'checkbox',
            checked: shuffle.value,
            onChange: (event: Event) => {
              shuffle.value = event.target instanceof HTMLInputElement && event.target.checked;
            },
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
          h('p', 'Combine material from other applications into a new Review knowledge set.'),
        ]),
        h('div', { class: 'knowledge-actions' }, [
          h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Cancel'),
          h('button', { type: 'button', class: 'card-primary-button', disabled: true }, 'Create knowledge set'),
        ]),
      ]),
      h('p', { class: 'knowledge-muted' }, `Saved in ${props.destination}.`),
      h('label', { class: 'knowledge-field' }, [
        'Set name',
        h('input', {
          value: name.value,
          maxlength: MAX_NAME_LENGTH,
          onInput: (event: Event) => { name.value = inputValue(event); },
        }),
      ]),
      h('aside', { class: 'knowledge-import-sync-note', role: 'note' }, [
        h(Icon, { name: 'duplicate' }),
        h('div', [
          h('strong', 'Importing is not synchronization.'),
          h('p', 'Review will create an independent copy. Changes you make later in the source app will not update this knowledge set, and changes here will not update the source. To bring in newer source content, create a new import.'),
        ]),
      ]),
      h('div', { class: 'knowledge-builder-tabs', role: 'group', 'aria-label': 'Import builder pages' }, [
        h('button', {
          type: 'button', class: 'quiet-button', 'aria-pressed': tab.value === 'sources',
          onClick: () => { tab.value = 'sources'; },
        }, 'Sources'),
        h('button', {
          type: 'button', class: 'quiet-button', 'aria-pressed': tab.value === 'options',
          onClick: () => { tab.value = 'options'; },
        }, 'Import options'),
      ]),
      tab.value === 'options' ? renderOptions() : renderSources(),
      h('p', { class: 'knowledge-muted knowledge-import-future-note' }, 'Source-library selection and final knowledge-set creation will be connected when import adapters are implemented.'),
    ]);
  },
});
