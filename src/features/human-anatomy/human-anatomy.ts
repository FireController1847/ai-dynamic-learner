import { computed, defineComponent, h, ref } from 'vue';
import { Icon } from '../../components/icon.ts';
import { inputValue } from '../../core/dom.ts';
import { foundationAtlas } from './atlas-catalog.ts';
import { buildAtlasIndex, searchStructures } from './atlas-index.ts';
import type { AtlasOrientation, AtlasSystemId } from './atlas-model.ts';
import { AnatomyViewer } from './anatomy-viewer.ts';

// Reference content is bundled locally, independent of user workspace saves.
const atlas = buildAtlasIndex(foundationAtlas);
const viewOrientations: readonly AtlasOrientation[] = ['anterior', 'posterior'];

export const HumanAnatomy = defineComponent({
  name: 'HumanAnatomy',
  props: { title: { type: String, required: true } },
  setup(props) {
    const systemId = ref<AtlasSystemId>('skeletal');
    const orientation = ref<AtlasOrientation>('anterior');
    const regionId = ref('whole-body');
    const selectedId = ref<string | null>(null);
    const search = ref('');

    const system = computed(() => atlas.systems.get(systemId.value));
    const view = computed(() => [...atlas.views.values()].find(item => item.systemId === systemId.value
      && item.regionId === regionId.value && item.orientation === orientation.value));
    const layers = computed(() => view.value ? atlas.layersByView.get(view.value.id) ?? [] : []);
    const shapes = computed(() => view.value ? atlas.shapesByView.get(view.value.id) ?? [] : []);
    const structures = computed(() => searchStructures(atlas, search.value, systemId.value));
    const selected = computed(() => selectedId.value ? atlas.structures.get(selectedId.value) : undefined);
    const regions = computed(() => [...atlas.regions.values()].filter(region => [...atlas.views.values()].some(
      candidate => candidate.systemId === systemId.value && candidate.regionId === region.id,
    )));
    function selectSystem(id: AtlasSystemId) {
      systemId.value = id;
      regionId.value = 'whole-body';
      orientation.value = 'anterior';
      selectedId.value = null;
      search.value = '';
    }
    function selectRegion(id: string) {
      regionId.value = id;
      selectedId.value = null;
      if (!view.value) orientation.value = 'anterior';
    }

    return () => h('section', { class: 'human-anatomy-page', 'aria-label': props.title }, [
      h('aside', { class: 'anatomy-systems', 'aria-label': 'Body systems' }, [
        h('div', { class: 'anatomy-panel-heading' }, [
          h('h2', 'Body systems'),
          h('p', 'Explore the major anatomical systems.'),
        ]),
        h('nav', { class: 'anatomy-system-list', 'aria-label': 'Choose body system' },
          [...atlas.systems.values()].map(item => h('button', {
            key: item.id, type: 'button',
            class: ['anatomy-system-choice', { 'is-active': item.id === systemId.value }],
            'aria-current': item.id === systemId.value ? 'true' : undefined,
            onClick: () => selectSystem(item.id),
          }, item.name))),
      ]),
      h('div', { class: 'anatomy-workspace' }, [
        h('header', { class: 'anatomy-workspace-heading' }, [
          h('div', [
            h('p', { class: 'anatomy-eyebrow' }, 'Human Anatomy'),
            h('h1', system.value?.name ?? props.title),
            h('p', { class: 'anatomy-system-description' }, system.value?.description ?? ''),
          ]),
          h('span', { class: 'anatomy-foundation-label' }, 'Atlas foundation'),
        ]),
        h('div', { class: 'anatomy-toolbar' }, [
          h('label', { for: 'anatomy-region' }, 'Region'),
          h('select', { id: 'anatomy-region', value: regionId.value,
            onChange: (event: Event) => selectRegion(inputValue(event)) },
          regions.value.map(region => h('option', { value: region.id }, region.name))),
          h('div', { class: 'anatomy-orientation', role: 'group', 'aria-label': 'Body orientation' },
            viewOrientations.map(next => h('button', {
              key: next,
              type: 'button',
              class: ['quiet-button', { 'is-active': orientation.value === next }],
              'aria-pressed': orientation.value === next,
              disabled: ![...atlas.views.values()].some(item => item.systemId === systemId.value
                && item.regionId === regionId.value && item.orientation === next),
              onClick: () => { orientation.value = next; selectedId.value = null; },
            }, next === 'anterior' ? 'Front' : 'Back'))),
        ]),
        view.value
          ? h(AnatomyViewer, {
            key: view.value.id, view: view.value, layers: layers.value, shapes: shapes.value,
            structures: [...atlas.structures.values()], selectedId: selectedId.value ?? '',
            onSelect: (id: string) => { selectedId.value = id; },
          })
          : h('div', { class: 'anatomy-unavailable', role: 'status' }, [
            h(Icon, { name: 'anatomy' }),
            h('p', 'This region and view are not available in the atlas yet.'),
          ]),
      ]),
      h('aside', { class: 'anatomy-details', 'aria-label': 'Anatomical structures' }, [
        h('div', { class: 'anatomy-panel-heading' }, [
          h('h2', 'Structures'),
          h('p', 'Select an anatomical structure to learn more.'),
        ]),
        h('label', { class: 'visually-hidden', for: 'anatomy-search' }, 'Search structures'),
        h('div', { class: 'anatomy-search' }, [
          h(Icon, { name: 'search' }),
          h('input', { id: 'anatomy-search', type: 'search', value: search.value,
            placeholder: 'Search structures', onInput: (event: Event) => { search.value = inputValue(event); } }),
        ]),
        structures.value.length
          ? h('ul', { class: 'anatomy-structure-list' }, structures.value.map(item => h('li', { key: item.id }, [
            h('button', { type: 'button', class: ['anatomy-structure-choice', { 'is-active': selectedId.value === item.id }],
              onClick: () => { selectedId.value = item.id; } }, item.name),
          ])))
          : h('p', { class: 'anatomy-empty-structures', role: 'status' },
            search.value.trim() ? 'No matching structures in this system.' : 'Structures will appear here as anatomy datasets are added.'),
        selected.value ? h('section', { class: 'anatomy-structure-detail', 'aria-label': 'Selected structure' }, [
          h('h3', selected.value.name),
          h('p', selected.value.classification),
          selected.value.description ? h('p', selected.value.description) : null,
        ]) : null,
      ]),
    ]);
  },
});
