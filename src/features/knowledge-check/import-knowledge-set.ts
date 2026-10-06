import { featureDefinitions, type FeatureId } from '../feature-definitions.ts';
import { Icon } from '../../components/icon.ts';
import { createId } from '../../core/ids.ts';
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
    const items = ref<ImportPlanItem[]>([]);
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

    return () => h('section', { class: 'knowledge-import', 'aria-label': 'Import knowledge set' }, [
      h('header', { class: 'knowledge-import-header' }, [
        h('div', [
          h('p', { class: 'knowledge-check-builder-eyebrow' }, 'Import knowledge set'),
          h('h2', 'Build an import plan'),
          h('p', `Import into ${props.destination}. Add sources in the order you want their questions to appear.`),
        ]),
        h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('back') }, 'Back'),
      ]),
      h('aside', { class: 'knowledge-import-sync-note', role: 'note' }, [
        h(Icon, { name: 'duplicate' }),
        h('div', [
          h('strong', 'Importing is not synchronization.'),
          h('p', 'Review will create an independent copy. Changes you make later in the source app will not update this knowledge set, and changes here will not update the source. To bring in newer source content, create a new import.'),
        ]),
      ]),
      h('section', { class: 'knowledge-import-plan', 'aria-labelledby': 'knowledge-import-plan-title' }, [
        h('div', { class: 'knowledge-import-section-heading' }, [
          h('div', [
            h('h3', { id: 'knowledge-import-plan-title' }, 'Question order'),
            h('p', 'Drag rows or use the arrow buttons to reorder them. Imported questions will be appended in this exact source order.'),
          ]),
          h('span', { class: 'knowledge-info-pill' }, `${items.value.length} ${items.value.length === 1 ? 'source' : 'sources'}`),
        ]),
        items.value.length
          ? h('ol', { class: 'knowledge-import-list' }, items.value.map(renderPlanItem))
          : h('div', { class: 'knowledge-import-empty' }, [
            h(Icon, { name: 'upload' }),
            h('strong', 'No import sources yet'),
            h('p', 'Add an application below to begin arranging the future question order.'),
          ]),
      ]),
      h('section', { class: 'knowledge-import-sources', 'aria-labelledby': 'knowledge-import-source-title' }, [
        h('div', { class: 'knowledge-import-section-heading' }, [
          h('div', [
            h('h3', { id: 'knowledge-import-source-title' }, 'Add from an application'),
            h('p', 'Each source can be added more than once so separate libraries or sets can eventually be combined in one Review knowledge set.'),
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
      h('footer', { class: 'knowledge-import-footer' }, [
        h('p', { class: 'knowledge-muted' }, 'Source-library selection and knowledge-set creation will be connected in a later step.'),
        h('button', { type: 'button', class: 'card-primary-button', disabled: true }, 'Create imported knowledge set'),
      ]),
    ]);
  },
});
