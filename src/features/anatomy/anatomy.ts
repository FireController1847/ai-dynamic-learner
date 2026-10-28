import { computed, defineComponent, h, nextTick, ref } from 'vue';
import { Icon } from '../../components/icon.ts';
import { inputValue } from '../../core/dom.ts';
import { readNumberPreference, writeNumberPreference } from '../../core/ui-preferences.ts';
import { foundationAtlas } from './atlas-catalog.ts';
import { buildAtlasIndex, searchStructures } from './atlas-index.ts';
import type { AtlasOrientation, AtlasSystemId } from './atlas-model.ts';
import { boneInRegion, boneVisibleFrom, muscleInRegion, muscularRegions, skeletalRegions,
  type AnatomyFacing } from './anatomy-regions.ts';
import { AnatomyViewer } from './anatomy-viewer.ts';

// Reference content is bundled locally, independent of workspace saves.
const atlas = buildAtlasIndex(foundationAtlas);
const faceModes: readonly { id: AnatomyFacing; name: string }[] = [
  { id: 'both', name: 'Both' }, { id: 'front', name: 'Front' }, { id: 'back', name: 'Back' },
];
const SYSTEMS_COLLAPSED_KEY = 'dynamic-learner.ui.anatomy.systems-collapsed';
const STRUCTURES_COLLAPSED_KEY = 'dynamic-learner.ui.anatomy.structures-collapsed';

function initialCollapsed(key: string) {
  const stored = readNumberPreference(key);
  return stored === null ? window.matchMedia('(max-width: 700px)').matches : stored === 1;
}

export const Anatomy = defineComponent({
  name: 'Anatomy',
  props: { title: { type: String, required: true } },
  setup(props) {
    const systemId = ref<AtlasSystemId>('skeletal');
    const facing = ref<AnatomyFacing>('both');
    const orientation = computed<AtlasOrientation>(() => facing.value === 'back' ? 'posterior' : 'anterior');
    const regionId = ref('whole-body');
    const selectedId = ref<string | null>(null);
    const search = ref('');

    const systemsCollapsed = ref(initialCollapsed(SYSTEMS_COLLAPSED_KEY));
    const structuresCollapsed = ref(initialCollapsed(STRUCTURES_COLLAPSED_KEY));
    const showSystemsButton = ref<HTMLButtonElement | null>(null);
    const hideSystemsButton = ref<HTMLButtonElement | null>(null);
    const showStructuresButton = ref<HTMLButtonElement | null>(null);
    const hideStructuresButton = ref<HTMLButtonElement | null>(null);

    const system = computed(() => atlas.systems.get(systemId.value));
    // Region selectors focus a whole-body dataset instead of seeking
    // nonexistent per-region view IDs (the former blank-region bug).
    const view = computed(() => atlas.views.get(systemId.value + '.whole-body.' + orientation.value));
    const posteriorView = computed(() => atlas.views.get('muscular.whole-body.posterior'));
    const combinedMuscles = computed(() => systemId.value === 'muscular' && facing.value === 'both');
    const layers = computed(() => {
      const frontLayers = view.value ? atlas.layersByView.get(view.value.id) ?? [] : [];
      if (!combinedMuscles.value || !posteriorView.value) return frontLayers;
      return [...(atlas.layersByView.get(posteriorView.value.id) ?? []), ...frontLayers];
    });
    const focus = computed(() => {
      const options = systemId.value === 'skeletal' ? skeletalRegions
        : systemId.value === 'muscular' ? muscularRegions : undefined;
      return options?.find(region => region.id === regionId.value) ?? options?.[0];
    });
    const shapes = computed(() => {
      const current = view.value ? atlas.shapesByView.get(view.value.id) ?? [] : [];
      // The posterior drawing mirrors anatomical laterality; remap it to the
      // anterior projection when Both overlays both surface diagrams.
      const posterior = combinedMuscles.value && posteriorView.value
        ? (atlas.shapesByView.get(posteriorView.value.id) ?? []).map(shape =>
          ({ ...shape, mirrorX: !shape.mirrorX }))
        : [];
      return [...posterior, ...current].filter(shape => {
        const structure = atlas.structures.get(shape.structureId);
        if (!structure) return false;
        if (systemId.value === 'skeletal') {
          return boneInRegion(structure, regionId.value)
            && boneVisibleFrom(structure, facing.value);
        }
        if (systemId.value === 'muscular') return muscleInRegion(structure, regionId.value);
        return true;
      });
    });
    const occludedIds = computed(() => facing.value === 'both' && systemId.value === 'skeletal'
      ? [...atlas.structures.values()].filter(bone => bone.systemId === 'skeletal'
        && !boneVisibleFrom(bone, 'front')).map(bone => bone.id)
      : []);
    const ghostLayerIds = computed(() => combinedMuscles.value ? ['muscular.surface.posterior'] : []);
    const visibleIds = computed(() => new Set(shapes.value
      .filter(shape => shape.renderMode !== 'etch' && shape.renderMode !== 'cutout')
      .map(shape => shape.structureId)));
    const structures = computed(() => searchStructures(atlas, search.value, systemId.value)
      .filter(item => visibleIds.value.has(item.id)));
    const selected = computed(() => selectedId.value && visibleIds.value.has(selectedId.value)
      ? atlas.structures.get(selectedId.value) : undefined);
    const regions = computed(() => systemId.value === 'skeletal' ? skeletalRegions
      : systemId.value === 'muscular' ? muscularRegions
        : [{ id: 'whole-body', name: 'Whole body' }]);

    function setSystemsCollapsed(collapsed: boolean) {
      systemsCollapsed.value = collapsed;
      writeNumberPreference(SYSTEMS_COLLAPSED_KEY, collapsed ? 1 : 0);
      void nextTick(() => (collapsed ? showSystemsButton : hideSystemsButton).value?.focus());
    }
    function setStructuresCollapsed(collapsed: boolean) {
      structuresCollapsed.value = collapsed;
      writeNumberPreference(STRUCTURES_COLLAPSED_KEY, collapsed ? 1 : 0);
      void nextTick(() => (collapsed ? showStructuresButton : hideStructuresButton).value?.focus());
    }
    function selectSystem(id: AtlasSystemId) {
      systemId.value = id;
      regionId.value = 'whole-body';
      facing.value = 'both';
      selectedId.value = null;
      search.value = '';
    }
    function selectRegion(id: string) {
      regionId.value = id;
      selectedId.value = null;
    }
    function selectStructure(id: string) {
      selectedId.value = id;
      // Selection details live beside the diagram, never below the list.
      // Keep the structure index's collapsed state exactly as the user chose.
    }
    function panelToggle(title: string, target: string, action: () => void, buttonRef: typeof hideSystemsButton) {
      return h('button', {
        ref: buttonRef, type: 'button', class: 'icon-button anatomy-panel-toggle',
        title, 'aria-label': title, 'aria-controls': target, 'aria-expanded': true,
        onClick: action,
      }, [h(Icon, { name: 'panel-close' })]);
    }

    // Navigation lives in the viewer's single white bar alongside its zoom controls.
    function viewerToolbar() {
      return [
        h('div', { class: 'anatomy-viewer-leading' }, [
          systemsCollapsed.value ? h('button', {
            ref: showSystemsButton, type: 'button', class: 'quiet-button anatomy-show-panel',
            'aria-label': 'Show body systems', 'aria-controls': 'anatomy-systems-panel',
            'aria-expanded': false, onClick: () => setSystemsCollapsed(false),
          }, [h(Icon, { name: 'panel-open' }), 'Systems']) : null,
          structuresCollapsed.value ? h('button', {
            ref: showStructuresButton, type: 'button', class: 'quiet-button anatomy-show-panel',
            'aria-label': 'Show structures', 'aria-controls': 'anatomy-structures-panel',
            'aria-expanded': false, onClick: () => setStructuresCollapsed(false),
          }, [h(Icon, { name: 'panel-open' }), 'Structures']) : null,
          h('div', { class: 'anatomy-viewer-identity' }, [
            h('strong', { title: system.value?.description ?? '' }, system.value?.name ?? props.title),
            systemId.value === 'skeletal' || systemId.value === 'muscular' ? null
              : h('span', { class: 'anatomy-viewer-status' }, 'Coming soon'),
          ]),
        ]),
        h('div', { class: 'anatomy-viewer-view-options' }, [
          h('label', { class: 'visually-hidden', for: 'anatomy-region' }, 'Anatomical region'),
          h('select', {
            id: 'anatomy-region', value: regionId.value, title: 'Anatomical region',
            'aria-label': 'Anatomical region',
            onChange: (event: Event) => selectRegion(inputValue(event)),
          }, regions.value.map(region => h('option', { value: region.id }, region.name))),
          h('div', { class: 'anatomy-orientation', role: 'group', 'aria-label': 'Anatomical visibility' },
            faceModes.map(mode => h('button', {
              key: mode.id,
              type: 'button',
              class: ['quiet-button', { 'is-active': facing.value === mode.id }],
              'aria-pressed': facing.value === mode.id,
              title: mode.id === 'both'
                ? (systemId.value === 'muscular' ? 'Overlay anterior and posterior muscles'
                  : 'Show all bones, including those behind others')
                : 'Show the ' + mode.name.toLowerCase() + ' view',
              onClick: () => { facing.value = mode.id; selectedId.value = null; },
            }, mode.name))),
        ]),
      ];
    }

    return () => h('section', {
      class: ['anatomy-page', {
        'systems-collapsed': systemsCollapsed.value,
        'structures-collapsed': structuresCollapsed.value,
      }],
      'aria-label': props.title,
    }, [
      h('aside', { id: 'anatomy-systems-panel', class: 'anatomy-systems',
        hidden: systemsCollapsed.value, 'aria-label': 'Body systems' }, [
        h('div', { class: 'anatomy-panel-top' }, [
          h('div', { class: 'anatomy-panel-heading' }, [
            h('h2', 'Body systems'),
            h('p', 'Explore the major anatomical systems.'),
          ]),
          panelToggle('Hide body systems', 'anatomy-systems-panel',
            () => setSystemsCollapsed(true), hideSystemsButton),
        ]),
        h('nav', { class: 'anatomy-system-list', 'aria-label': 'Choose body system' },
          [...atlas.systems.values()].map(item => h('button', {
            key: item.id, type: 'button',
            class: ['anatomy-system-choice', { 'is-active': item.id === systemId.value }],
            'aria-current': item.id === systemId.value ? 'page' : undefined,
            onClick: () => selectSystem(item.id),
          }, item.name))),
      ]),
      h('div', { class: 'anatomy-workspace' }, [
        view.value
          ? h(AnatomyViewer, {
            key: view.value.id + '.' + regionId.value,
            view: view.value, focus: focus.value, layers: layers.value, shapes: shapes.value,
            occludedIds: occludedIds.value, ghostLayerIds: ghostLayerIds.value,
            showPlaceholder: systemId.value !== 'skeletal' && systemId.value !== 'muscular',
            structures: [...atlas.structures.values()], selectedId: selectedId.value ?? '',
            selectedStructure: selected.value ?? null,
            onSelect: selectStructure,
            onClearSelection: () => { selectedId.value = null; },
          }, { toolbar: viewerToolbar })
          : h('div', { class: 'anatomy-unavailable', role: 'status' }, [
            h('strong', system.value?.name ?? props.title),
            h(Icon, { name: 'anatomy' }),
            h('p', 'This region and view are not available in the atlas yet.'),
          ]),
      ]),
      h('aside', { id: 'anatomy-structures-panel', class: 'anatomy-details',
        hidden: structuresCollapsed.value, 'aria-label': 'Anatomical structures' }, [
        h('div', { class: 'anatomy-panel-top' }, [
          h('div', { class: 'anatomy-panel-heading' }, [
            h('h2', 'Structures'),
            systemId.value === 'skeletal' || systemId.value === 'muscular'
              ? null : h('p', 'Content coming soon.'),
          ]),
          panelToggle('Hide structures', 'anatomy-structures-panel',
            () => setStructuresCollapsed(true), hideStructuresButton),
        ]),
        h('label', { class: 'visually-hidden', for: 'anatomy-search' }, 'Search structures'),
        h('div', { class: 'anatomy-search' }, [
          h(Icon, { name: 'search' }),
          h('input', { id: 'anatomy-search', type: 'search', value: search.value,
            placeholder: 'Search structures', onInput: (event: Event) => { search.value = inputValue(event); } }),
        ]),
        structures.value.length
          ? h('ul', { class: 'anatomy-structure-list' }, structures.value.map(item => h('li', { key: item.id }, [
            h('button', { type: 'button',
              class: ['anatomy-structure-choice', { 'is-active': selectedId.value === item.id }],
              'aria-pressed': selectedId.value === item.id,
              onClick: () => { selectedId.value = item.id; } }, item.name),
          ])))
          : h('p', { class: 'anatomy-empty-structures', role: 'status' },
            search.value.trim()
              ? 'No matching structures in this view.'
              : systemId.value === 'skeletal'
                ? 'No surface-visible bones here. Choose Both to inspect deeper structures.'
                : systemId.value === 'muscular'
                  ? 'No illustrated muscles in this region and view.'
                  : 'Structure diagrams are being prepared.'),

      ]),
    ]);
  },
});
