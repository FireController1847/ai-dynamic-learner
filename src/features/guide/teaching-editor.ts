import { defineComponent, h, ref, type PropType, type VNode } from 'vue';
import { createId } from '../../core/ids.ts';
import { inputValue } from '../../core/dom.ts';
import type { MapTopic } from './library-model.ts';
import { lessonForTopic, MAX_TEACHING_BLOCKS, validateTeachingLesson,
  type TeachingBlock, type TeachingChoice, type TeachingSide, type TeachingStep, type TeachingNode } from './teaching-blocks.ts';
import { copyTeachingBlock, newTeachingBlock, newTeachingChoice, TEACHING_BLOCK_KINDS, type TeachingBlockKind } from './teaching-block-factory.ts';
import { TeachingLessonView } from './teaching-lesson.ts';

type EditableListItem = TeachingStep | TeachingNode | TeachingChoice;
const LIMIT = 10000;

export const TeachingBlocksEditor = defineComponent({
  name: 'TeachingBlocksEditor',
  props: { topic: { type: Object as PropType<MapTopic>, required: true } },
  setup(props) {
    const selectedId = ref<string | null>(props.topic.lesson?.blocks[0]?.id ?? null);
    const draft = ref<TeachingBlock | null>(null);
    const kind = ref<TeachingBlockKind>('explanation');
    const editing = ref(false);
    const preview = ref(false);
    const error = ref('');
    const deleteId = ref<string | null>(null);
    const previewAnswers = ref<Record<string, string>>({});

    function startEdit(block: TeachingBlock) {
      selectedId.value = block.id;
      draft.value = copyTeachingBlock(block);
      editing.value = true;
      preview.value = false;
      deleteId.value = null;
      error.value = '';
    }
    function cancelEdit() {
      editing.value = false;
      draft.value = null;
      error.value = '';
    }
    function lesson() { return props.topic.lesson; }
    function addBlock() {
      const current = lesson();
      if (!current || current.blocks.length >= MAX_TEACHING_BLOCKS) return;
      const block = newTeachingBlock(kind.value);
      current.blocks.push(block);
      startEdit(block);
    }
    function move(id: string, direction: number) {
      const blocks = lesson()?.blocks;
      if (!blocks) return;
      const index = blocks.findIndex(block => block.id === id), next = index + direction;
      if (index < 0 || next < 0 || next >= blocks.length) return;
      const [block] = blocks.splice(index, 1);
      blocks.splice(next, 0, block);
    }
    function remove(id: string) {
      const blocks = lesson()?.blocks;
      if (!blocks) return;
      if (deleteId.value !== id) { deleteId.value = id; return; }
      const index = blocks.findIndex(block => block.id === id);
      if (index < 0) return;
      blocks.splice(index, 1);
      deleteId.value = null;
      if (selectedId.value === id) {
        selectedId.value = blocks[Math.min(index, blocks.length - 1)]?.id ?? null;
        cancelEdit();
      }
    }
    function saveBlock() {
      const current = lesson();
      const candidate = draft.value;
      if (!current || !candidate) return;
      const index = current.blocks.findIndex(block => block.id === candidate.id);
      if (index < 0) return;
      const updated = { version: 1 as const, blocks: current.blocks.map((block, i) => i === index ? candidate : block) };
      try {
        // Validate the complete candidate before mutating any persisted content.
        validateTeachingLesson(updated, new Set<string>());
        current.blocks[index] = copyTeachingBlock(candidate);
        error.value = '';
        cancelEdit();
      } catch (cause) {
        error.value = cause instanceof Error ? cause.message : 'This block needs a little more information.';
      }
    }
    function activateBlocks() {
      if (lesson()) return;
      // Preserve legacy notes in guide.sections and copy them into the new lesson.
      const legacy = lessonForTopic(props.topic);
      props.topic.lesson = { version: 1, blocks: legacy.blocks.map(block =>
        ({ ...block, id: createId() })) };
      if (props.topic.lesson.blocks[0]) startEdit(props.topic.lesson.blocks[0]);
      else editing.value = false;
    }

    function field(label: string, value: string | undefined, update: (value: string) => void,
      multiline = false): VNode {
      const control = {
        value: value ?? '', maxlength: LIMIT, 'aria-label': label,
        onInput: (event: Event) => { update(inputValue(event)); error.value = ''; },
      };
      return h('label', { class: 'guide-teach-field' }, [
        h('span', label),
        multiline ? h('textarea', { ...control, rows: 3 }) : h('input', { ...control, type: 'text' }),
      ]);
    }
    function stringList(title: string, entries: string[], max: number,
      create: string, minimum = 0): VNode {
      return h('fieldset', { class: 'guide-teach-collection' }, [
        h('legend', title),
        ...entries.map((entry, index) => h('div', { key: index, class: 'guide-teach-list-row' }, [
          field(title + ' ' + (index + 1), entry, value => { entries[index] = value; }, true),
          h('button', { type: 'button', class: 'quiet-button', disabled: entries.length <= minimum,
            'aria-label': 'Remove ' + title + ' ' + (index + 1),
            onClick: () => { entries.splice(index, 1); } }, 'Remove'),
        ])),
        h('button', { type: 'button', class: 'quiet-button',
          disabled: entries.length >= max, onClick: () => { entries.push(create); } }, '+ Add ' + title.toLowerCase()),
      ]);
    }
    function sideFields(value: TeachingSide, heading: string): VNode {
      return h('fieldset', { class: 'guide-teach-collection' }, [
        h('legend', heading),
        field('Name', value.label, text => { value.label = text; }),
        field('Explanation', value.description, text => { value.description = text; }, true),
        stringList('Key point', value.points, 12, 'A supporting point.'),
      ]);
    }
    function stepsFields(steps: TeachingStep[]): VNode {
      return h('fieldset', { class: 'guide-teach-collection' }, [
        h('legend', 'Steps'),
        ...steps.map((step, index) => h('div', { class: 'guide-teach-list-card', key: index }, [
          h('strong', 'Step ' + (index + 1)),
          field('Step title', step.title, text => { step.title = text; }),
          field('What happens here?', step.body, text => { step.body = text; }, true),
          h('button', { type: 'button', class: 'quiet-button', disabled: steps.length <= 2,
            onClick: () => { steps.splice(index, 1); } }, 'Remove step'),
        ])),
        h('button', { type: 'button', class: 'quiet-button', disabled: steps.length >= 12,
          onClick: () => { steps.push({ title: 'Another step', body: 'Explain what happens next.' }); } }, '+ Add step'),
      ]);
    }
    function diagramFields(nodes: TeachingNode[]): VNode {
      return h('fieldset', { class: 'guide-teach-collection' }, [
        h('legend', 'Visual nodes (shown left to right)'),
        ...nodes.map((node, index) => h('div', { class: 'guide-teach-list-card', key: node.id }, [
          h('strong', 'Node ' + (index + 1)),
          field('Node label', node.label, text => { node.label = text; }),
          field('What does this node represent?', node.detail, text => { node.detail = text; }, true),
          h('button', { type: 'button', class: 'quiet-button', disabled: nodes.length <= 2,
            onClick: () => { nodes.splice(index, 1); } }, 'Remove node'),
        ])),
        h('button', { type: 'button', class: 'quiet-button', disabled: nodes.length >= 10,
          onClick: () => { nodes.push({ id: createId(), label: 'New node', detail: 'Explain this concept.' }); } }, '+ Add node'),
      ]);
    }
    function choiceFields(choices: TeachingChoice[], correctId?: string,
      updateCorrect?: (id: string) => void): VNode {
      return h('fieldset', { class: 'guide-teach-collection' }, [
        h('legend', correctId === undefined ? 'Possible outcomes' : 'Answer options'),
        ...choices.map((choice, index) => h('div', { class: 'guide-teach-list-card', key: choice.id }, [
          h('strong', 'Option ' + (index + 1)),
          field('Choice label', choice.label, text => { choice.label = text; }),
          field('Explanation shown after choosing', choice.explanation,
            text => { choice.explanation = text; }, true),
          updateCorrect ? h('label', { class: 'guide-teach-correct' }, [
            h('input', { type: 'radio', name: 'guide-teach-correct-' + (draft.value?.id ?? ''),
              checked: correctId === choice.id, onChange: () => updateCorrect(choice.id) }),
            'Correct answer',
          ]) : null,
          h('button', { type: 'button', class: 'quiet-button', disabled: choices.length <= 2,
            onClick: () => {
              choices.splice(index, 1);
              if (choice.id === correctId) updateCorrect?.(choices[0].id);
            } }, 'Remove option'),
        ])),
        h('button', { type: 'button', class: 'quiet-button', disabled: choices.length >= 8,
          onClick: () => { choices.push(newTeachingChoice()); } }, '+ Add option'),
      ]);
    }
    function fields(block: TeachingBlock): (VNode | null)[] {
      const parts: (VNode | null)[] = [
        field('Block title', block.title, value => { block.title = value; }),
      ];
      switch (block.kind) {
        case 'explanation':
          parts.push(field('Explanation', block.body, value => { block.body = value; }, true),
            stringList('Key idea', block.highlights ?? (block.highlights = []), 12, 'Key concept'));
          break;
        case 'example':
          parts.push(field('Scenario', block.scenario, value => { block.scenario = value; }, true),
            stringList('Walkthrough step', block.steps, 12, 'Next action.', 1),
            field('Takeaway', block.takeaway, value => { block.takeaway = value; }, true));
          break;
        case 'comparison':
          parts.push(sideFields(block.left, 'First side'), sideFields(block.right, 'Second side'));
          break;
        case 'sequence':
          parts.push(field('Introduction (optional)', block.intro, value => { block.intro = value; }, true),
            stepsFields(block.steps));
          break;
        case 'diagram':
          parts.push(field('Caption (optional)', block.caption, value => { block.caption = value; }, true),
            diagramFields(block.nodes));
          break;
        case 'exploration':
          parts.push(field('Prompt', block.prompt, value => { block.prompt = value; }, true),
            choiceFields(block.choices));
          break;
        case 'check':
          parts.push(field('Question', block.question, value => { block.question = value; }, true),
            choiceFields(block.options, block.correctId, id => { block.correctId = id; }));
          break;
        case 'connection':
          parts.push(field('How the ideas connect', block.body, value => { block.body = value; }, true),
            field('What comes next? (optional)', block.next, value => { block.next = value; }, true));
          break;
      }
      return parts;
    }

    return () => {
      const current = lesson();
      const blocks = current?.blocks ?? [];
      const selected = blocks.find(block => block.id === selectedId.value);
      return h('section', { class: 'guide-teach-editor', 'aria-label': 'Teaching Blocks authoring' }, [
        h('div', { class: 'guide-teach-heading' }, [
          h('h3', 'Teaching Blocks'),
          h('p', current
            ? 'Build a visual, self-paced lesson. Changes save with the map when you finish each block.'
            : 'Your existing notes can become editable teaching blocks without deleting the original notes.'),
        ]),
        !current ? h('div', { class: 'guide-teach-convert' }, [
          h('p', 'Switch this stop to Teaching Blocks. Your existing bullet notes are copied into explanation blocks and kept as a backup.'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: activateBlocks },
            'Enable Teaching Blocks'),
        ]) : [
          h('div', { class: 'guide-teach-create' }, [
            h('label', { class: 'guide-teach-field' }, [
              h('span', 'New block type'),
              h('select', { value: kind.value, onChange: (event: Event) =>
                { kind.value = inputValue(event) as TeachingBlockKind; } },
                TEACHING_BLOCK_KINDS.map(item => h('option', { key: item.kind, value: item.kind }, item.label))),
            ]),
            h('button', { type: 'button', class: 'card-primary-button',
              disabled: blocks.length >= MAX_TEACHING_BLOCKS, onClick: addBlock }, '+ Add block'),
          ]),
          h('p', { class: 'guide-teach-hint' },
            TEACHING_BLOCK_KINDS.find(item => item.kind === kind.value)?.help ?? ''),
          blocks.length ? h('ol', { class: 'guide-teach-outline', 'aria-label': 'Lesson outline' }, blocks.map((block, index) =>
            h('li', { key: block.id, class: ['guide-teach-outline-row', { 'is-selected': selectedId.value === block.id }] }, [
              h('button', { type: 'button', class: 'guide-teach-outline-select',
                'aria-pressed': selectedId.value === block.id,
                onClick: () => startEdit(block) }, [
                h('span', { class: 'guide-teach-outline-kind' }, block.kind),
                h('strong', block.title),
              ]),
              h('div', { class: 'guide-teach-outline-actions' }, [
                h('button', { type: 'button', class: 'icon-button', disabled: index === 0,
                  'aria-label': 'Move ' + block.title + ' up', onClick: () => move(block.id, -1) }, '↑'),
                h('button', { type: 'button', class: 'icon-button', disabled: index === blocks.length - 1,
                  'aria-label': 'Move ' + block.title + ' down', onClick: () => move(block.id, 1) }, '↓'),
                h('button', { type: 'button', class: 'icon-button',
                  'aria-label': 'Remove ' + block.title, onClick: () => remove(block.id) }, '×'),
              ]),
              deleteId.value === block.id ? h('div', { class: 'guide-teach-delete-confirm' }, [
                h('span', 'Delete this block?'),
                h('button', { type: 'button', class: 'quiet-button', onClick: () => remove(block.id) }, 'Delete'),
                h('button', { type: 'button', class: 'quiet-button', onClick: () => { deleteId.value = null; } }, 'Cancel'),
              ]) : null,
            ]))) : h('p', { class: 'guide-teach-empty' }, 'No blocks yet. Add one to begin your lesson.'),
          h('div', { class: 'guide-teach-tabbar' }, [
            h('button', { type: 'button', class: 'quiet-button',
              'aria-pressed': !preview.value, onClick: () => { preview.value = false; } }, 'Edit'),
            h('button', { type: 'button', class: 'quiet-button',
              'aria-pressed': preview.value, onClick: () => { preview.value = true; } }, 'Preview lesson'),
          ]),
          preview.value
            ? h('div', { class: 'guide-teach-preview' }, [
              h(TeachingLessonView, { lesson: current, responses: previewAnswers.value,
                onAnswer: (id: string, response: string) =>
                  { previewAnswers.value = { ...previewAnswers.value, [id]: response }; } }),
            ])
            : editing.value && selected && draft.value?.id === selected.id
              ? h('div', { class: 'guide-teach-form', key: selected.id }, [
                h('div', { class: 'guide-teach-form-heading' }, [
                  h('strong', 'Edit ' + selected.kind),
                  h('span', 'Draft changes are saved only when valid.'),
                ]),
                ...fields(draft.value),
                error.value ? h('p', { class: 'guide-teach-error', role: 'alert' }, error.value) : null,
                h('div', { class: 'guide-teach-form-actions' }, [
                  h('button', { type: 'button', class: 'card-primary-button', onClick: saveBlock }, 'Save block'),
                  h('button', { type: 'button', class: 'quiet-button', onClick: cancelEdit }, 'Cancel changes'),
                ]),
              ])
              : h('p', { class: 'guide-teach-hint' },
                'Select a block in the outline to edit it, or open the lesson preview.'),
        ],
      ]);
    };
  },
});
