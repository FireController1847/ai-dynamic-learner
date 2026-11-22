import { defineComponent, h, type PropType } from 'vue';
import type { AiSourceUnit } from '../core/ai-source-units.ts';

/** AI-reported source provenance, not verified source coverage or study mastery. */
export const AiSourceUnitCoverage = defineComponent({
  name: 'AiSourceUnitCoverage',
  props: {
    units: { type: Array as PropType<readonly AiSourceUnit[]>, required: true },
    items: { type: Array as PropType<readonly string[]>, required: true },
    itemLabel: { type: String, default: 'items' },
  },
  setup(props) {
    return () => props.units.length ? h('section', {
      class: 'ai-source-unit-coverage', 'aria-label': 'Source-unit coverage',
    }, [
      h('h3', 'Coverage by source unit'),
      h('p', { class: 'study-ai-muted' },
        'AI-reported links between the original source units and generated content. These counts are not independently verified coverage or study progress.'),
      h('ol', props.units.map(unit => h('li', { key: unit.title }, [
        h('details', [
          h('summary', [
            h('strong', unit.title),
            ' · ' + unit.itemNumbers.length + ' ' + props.itemLabel + ' generated' +
              (unit.missingTopics.length ? ' · ' + unit.missingTopics.length + ' reported gaps' : ''),
          ]),
          h('p', { class: 'study-ai-muted' }, unit.kind + ' · original source order'),
          unit.itemNumbers.length ? h('ol', unit.itemNumbers.map(number => h('li', { key: number },
            '#' + number + ' ' + (props.items[number - 1] ?? '(item unavailable)'))))
            : h('p', 'No items were generated for this unit.'),
          unit.missingTopics.length ? h('div', [
            h('strong', 'Potentially missing material'),
            h('ul', unit.missingTopics.map((topic, index) => h('li', { key: index }, topic))),
          ]) : h('p', { class: 'study-ai-muted' }, 'No gaps reported by AI. This does not guarantee complete coverage.'),
        ]),
      ]))),
    ]) : null;
  },
});
