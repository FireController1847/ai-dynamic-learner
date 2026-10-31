import { defineComponent, h, ref, type PropType, type VNode } from 'vue';
import { renderTeachingMath as math, renderTeachingRich as rich } from './teaching-text.ts';
import type { TeachingBlock, TeachingChoice, TeachingLesson, TeachingSide } from './teaching-blocks.ts';

function caption(value: string | undefined) {
  return value ? h('div', { class: 'guide-lesson-caption' }, rich(value)) : null;
}
function list(values: string[]) {
  return values.length ? h('ul', { class: 'guide-lesson-list' },
    values.map((value, index) => h('li', { key: index }, math(value)))) : null;
}
function side(value: TeachingSide) {
  return h('div', { class: 'guide-lesson-side' }, [
    h('h5', math(value.label)), rich(value.description), list(value.points),
  ]);
}
function blockHeading(block: TeachingBlock, label: string) {
  return h('header', { class: 'guide-lesson-block-header' }, [
    h('span', { class: 'guide-lesson-block-kind' }, label),
    h('h4', math(block.title)),
  ]);
}
function optionButtons(
  options: TeachingChoice[], selected: string | undefined, onChoose: (id: string) => void,
) {
  return h('div', { class: 'guide-lesson-choice-list', role: 'group' },
    options.map((choice, index) => h('button', {
      key: choice.id, type: 'button', class: ['guide-lesson-choice', { 'is-selected': selected === choice.id }],
      'aria-pressed': selected === choice.id,
      onClick: () => onChoose(choice.id),
    }, [h('span', { class: 'guide-lesson-choice-index' }, String.fromCharCode(65 + index)), h('span', math(choice.label))])));
}
export const TeachingLessonView = defineComponent({
  name: 'TeachingLessonView',
  props: {
    lesson: { type: Object as PropType<TeachingLesson>, required: true },
    responses: { type: Object as PropType<Record<string, string>>, required: true },
  },
  emits: { answer: (_blockId: string, _response: string) => true },
  setup(props, { emit }) {
    const walkthroughs = ref<Set<string>>(new Set());
    function toggleWalkthrough(id: string) {
      const next = new Set(walkthroughs.value);
      if (next.has(id)) next.delete(id); else next.add(id);
      walkthroughs.value = next;
    }
    function answer(id: string, value: string) { emit('answer', id, value); }

    function renderBlock(block: TeachingBlock) {
      let body: VNode | (VNode | null)[] | null = null;
      let name: string = block.kind;
      switch (block.kind) {
        case 'explanation':
          name = 'Learn';
          body = [
            rich(block.body),
            block.highlights?.length ? h('div', { class: 'guide-lesson-highlights' }, [
              h('span', { class: 'guide-lesson-small-label' }, 'Key ideas'),
              ...block.highlights.map((word, index) => h('span', { key: index, class: 'guide-lesson-highlight' }, math(word))),
            ]) : null,
          ];
          break;
        case 'example': {
          name = 'Worked example';
          const expanded = walkthroughs.value.has(block.id);
          body = [
            h('div', { class: 'guide-lesson-scenario' }, [
              h('span', { class: 'guide-lesson-small-label' }, 'Consider this'),
              rich(block.scenario),
            ]),
            h('button', {
              type: 'button', class: 'quiet-button guide-lesson-toggle',
              'aria-expanded': expanded, onClick: () => toggleWalkthrough(block.id),
            }, expanded ? 'Hide walkthrough' : 'Explore the walkthrough'),
            expanded ? h('ol', { class: 'guide-lesson-walkthrough' },
              block.steps.map((step, index) => h('li', { key: index }, rich(step)))) : null,
            h('div', { class: 'guide-lesson-takeaway' }, [
              h('strong', 'Takeaway'), rich(block.takeaway),
            ]),
          ];
          break;
        }
        case 'comparison':
          name = 'Compare';
          body = h('div', { class: 'guide-lesson-comparison' }, [side(block.left), side(block.right)]);
          break;
        case 'table':
          name = 'Table';
          body = [
            h('div', { class: 'guide-lesson-table-scroll', role: 'region',
              'aria-label': block.title + ' table', tabindex: 0 }, [
              h('table', { class: 'guide-lesson-data-table' }, [
                h('thead', [h('tr',
                  block.headers.map((header, column) => h('th', {
                    key: column, scope: 'col',
                  }, math(header))))]),
                h('tbody', block.rows.map((row, rowIndex) => h('tr', { key: rowIndex },
                  row.map((cell, column) => h(column === 0 ? 'th' : 'td', {
                    key: column, ...(column === 0 ? { scope: 'row' } : {}),
                  }, rich(cell)))))),
              ]),
            ]),
            caption(block.caption),
          ];
          break;
        case 'sequence': {
          name = 'Step by step';
          const selected = Math.max(0, Math.min(block.steps.length - 1, Number(props.responses[block.id] ?? 0) || 0));
          body = [
            caption(block.intro),
            h('div', { class: 'guide-lesson-sequence-nav', role: 'group', 'aria-label': block.title + ' steps' },
              block.steps.map((step, index) => h('button', {
                key: index, type: 'button', class: ['guide-lesson-step-tab', { 'is-selected': selected === index }],
                'aria-pressed': selected === index, onClick: () => answer(block.id, String(index)),
              }, [h('span', String(index + 1)), math(step.title)]))),
            h('div', { class: 'guide-lesson-step-detail' }, [
              h('span', { class: 'guide-lesson-small-label' }, 'Step ' + (selected + 1) + ' of ' + block.steps.length),
              h('h5', math(block.steps[selected].title)), rich(block.steps[selected].body),
              h('div', { class: 'guide-lesson-step-actions' }, [
                h('button', { type: 'button', class: 'quiet-button', disabled: selected === 0,
                  onClick: () => answer(block.id, String(selected - 1)) }, 'Previous'),
                h('button', { type: 'button', class: 'quiet-button', disabled: selected >= block.steps.length - 1,
                  onClick: () => answer(block.id, String(selected + 1)) }, 'Next step'),
              ]),
            ]),
          ];
          break;
        }
        case 'diagram': {
          name = 'Visual model';
          const selected = block.nodes.find(node => node.id === props.responses[block.id]) ?? block.nodes[0];
          body = [
            h('div', { class: 'guide-lesson-diagram', role: 'group', 'aria-label': block.title },
              block.nodes.flatMap((node, index) => [
                index > 0 ? h('span', { key: 'link-' + index, class: 'guide-lesson-diagram-arrow', 'aria-hidden': 'true' }, '→') : null,
                h('button', { key: node.id, type: 'button', class: ['guide-lesson-diagram-node', { 'is-selected': selected.id === node.id }],
                  'aria-pressed': selected.id === node.id,
                  onClick: () => answer(block.id, node.id),
                }, [h('span', { class: 'guide-lesson-diagram-dot' }, String(index + 1)), math(node.label)]),
              ])),
            h('div', { class: 'guide-lesson-diagram-detail', role: 'status' }, [
              h('strong', math(selected.label)), rich(selected.detail),
            ]),
            caption(block.caption),
          ];
          break;
        }
        case 'exploration': {
          name = 'Explore';
          const selected = block.choices.find(choice => choice.id === props.responses[block.id]);
          body = [
            h('div', { class: 'guide-lesson-question' }, rich(block.prompt)),
            optionButtons(block.choices, selected?.id, id => answer(block.id, id)),
            selected ? h('div', { class: 'guide-lesson-feedback', role: 'status' }, [
              h('strong', math(selected.label)), rich(selected.explanation),
            ]) : h('p', { class: 'guide-lesson-prompt' }, 'Choose an option to explore what happens. You can try every option.'),
          ];
          break;
        }
        case 'check': {
          name = 'Check your understanding';
          const selected = block.options.find(option => option.id === props.responses[block.id]);
          const correct = selected?.id === block.correctId;
          const correctOption = block.options.find(option => option.id === block.correctId);
          body = [
            h('div', { class: 'guide-lesson-question' }, rich(block.question)),
            optionButtons(block.options, selected?.id, id => answer(block.id, id)),
            selected ? h('div', { class: ['guide-lesson-feedback', { 'is-correct': correct }], role: 'status' }, [
              h('strong', correct ? 'That’s it!' : 'Not quite — here’s why.'),
              rich(selected.explanation),
              !correct && correctOption ? h('div', [
                'The key is: ', h('strong', math(correctOption.label)), '. ', rich(correctOption.explanation),
              ]) : null,
            ]) : h('p', { class: 'guide-lesson-prompt' }, 'No score or penalty. Make a prediction, then read the explanation.'),
          ];
          break;
        }
        case 'connection':
          name = 'Make the connection';
          body = [
            rich(block.body),
            block.next ? h('div', { class: 'guide-lesson-next' }, [
              h('span', { class: 'guide-lesson-small-label' }, 'Coming up'),
              rich(block.next),
            ]) : null,
          ];
          break;
      }
      return h('article', { key: block.id, class: ['guide-lesson-block', 'is-' + block.kind] }, [
        blockHeading(block, name),
        h('div', { class: 'guide-lesson-block-body' }, body),
      ]);
    }
    return () => h('div', { class: 'guide-teaching-lesson' }, [
      props.lesson.blocks.length
        ? props.lesson.blocks.map(renderBlock)
        : h('div', { class: 'guide-lesson-empty' }, [
          h('h4', 'This lesson is ready to build'),
          h('p', 'This map stop has no lesson content yet. You can still visit it or return to the map.'),
        ]),
    ]);
  },
});
