import { computed, defineComponent, h, ref, watch, type PropType } from 'vue';
import { Icon } from '../../components/icon.ts';
import type { AtlasStructure, AtlasSystemId } from './atlas-model.ts';
import { groupAnatomyStructures, parseAnatomyClassification } from './anatomy-structure-groups.ts';

// A small, reusable disclosure tree: groups come from the same canonical
// classifications as the identification quiz, without duplicating an
// independent anatomical taxonomy in the UI.
export const AnatomyStructureTree = defineComponent({
  name: 'AnatomyStructureTree',
  props: {
    systemId: { type: String as PropType<AtlasSystemId>, required: true },
    structures: { type: Array as PropType<readonly AtlasStructure[]>, required: true },
    selectedId: { type: String, default: '' },
    query: { type: String, default: '' },
  },
  emits: { select: (_id: string) => true },
  setup(props, { emit }) {
    const open = ref<Record<string, boolean>>({});
    const sections = computed(() => groupAnatomyStructures(props.structures));
    const searching = computed(() => Boolean(props.query.trim()));
    const categoryKey = (category: string) => props.systemId + '/category/' + category;
    const subgroupKey = (category: string, subgroup: string) =>
      props.systemId + '/subgroup/' + category + '/' + subgroup;
    function expanded(key: string, defaultOpen: boolean) {
      return searching.value || (open.value[key] ?? defaultOpen);
    }
    function toggle(key: string, defaultOpen: boolean) {
      // A live search keeps all matching results visible; the remembered
      // disclosure state is unaffected when the query is cleared.
      if (searching.value) return;
      open.value = { ...open.value, [key]: !expanded(key, defaultOpen) };
    }
    watch(() => props.selectedId, id => {
      const structure = props.structures.find(item => item.id === id);
      if (!structure) return;
      const { category, subgroup } = parseAnatomyClassification(structure.classification);
      const next = { ...open.value, [categoryKey(category)]: true };
      if (subgroup) next[subgroupKey(category, subgroup)] = true;
      open.value = next;
    }, { immediate: true });

    function leaf(item: AtlasStructure) {
      const selected = item.id === props.selectedId;
      return h('li', { key: item.id }, [
        h('button', {
          type: 'button',
          class: ['anatomy-structure-choice', { 'is-active': selected }],
          'aria-pressed': selected,
          onClick: () => emit('select', item.id),
        }, item.name),
      ]);
    }
    function disclosure(label: string, count: number, key: string,
      defaultOpen: boolean, level: 'category' | 'subgroup') {
      const isOpen = expanded(key, defaultOpen);
      return h('button', {
        type: 'button',
        class: ['anatomy-structure-disclosure', 'is-' + level],
        'aria-expanded': isOpen,
        disabled: searching.value,
        'aria-label': (isOpen ? 'Collapse ' : 'Expand ') + label + ', ' + count + ' structures',
        onClick: () => toggle(key, defaultOpen),
      }, [
        h(Icon, { name: 'chevron-down', class: ['anatomy-structure-chevron', { 'is-collapsed': !isOpen }] }),
        h('span', { class: 'anatomy-structure-group-label' }, label),
        h('span', { class: 'anatomy-structure-count', 'aria-hidden': 'true' }, String(count)),
      ]);
    }
    return () => h('nav', {
      class: 'anatomy-structure-tree',
      'aria-label': 'Grouped anatomical structures',
    }, [
      h('ul', { class: 'anatomy-structure-categories' }, sections.value.map(section => {
        const rootKey = categoryKey(section.name);
        const rootOpen = expanded(rootKey, true);
        return h('li', { key: rootKey }, [
          disclosure(section.name, section.count, rootKey, true, 'category'),
          rootOpen ? h('ul', { class: 'anatomy-structure-children' }, [
            ...section.direct.map(leaf),
            ...section.subgroups.map(subgroup => {
              const key = subgroupKey(section.name, subgroup.name);
              const isOpen = expanded(key, false);
              return h('li', { key }, [
                disclosure(subgroup.name, subgroup.structures.length, key, false, 'subgroup'),
                isOpen ? h('ul', { class: 'anatomy-structure-children is-leaves' },
                  subgroup.structures.map(leaf)) : null,
              ]);
            }),
          ]) : null,
        ]);
      })),
    ]);
  },
});
