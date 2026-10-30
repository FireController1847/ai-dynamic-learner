import { createId } from '../../core/ids.ts';
import type { TeachingBlock, TeachingChoice } from './teaching-blocks.ts';

export type TeachingBlockKind = TeachingBlock['kind'];

export const TEACHING_BLOCK_KINDS: readonly { kind: TeachingBlockKind; label: string; help: string }[] = [
  { kind: 'explanation', label: 'Explanation', help: 'Teach an idea in readable paragraphs.' },
  { kind: 'example', label: 'Worked example', help: 'Present a situation, walk through it, then connect the result.' },
  { kind: 'comparison', label: 'Comparison', help: 'Place two related ideas side by side.' },
  { kind: 'sequence', label: 'Step by step', help: 'Let learners inspect the stages of a process.' },
  { kind: 'diagram', label: 'Visual model', help: 'Connect selectable concepts in a visual flow.' },
  { kind: 'exploration', label: 'Exploration', help: 'Let learners try different choices and discover consequences.' },
  { kind: 'check', label: 'Understanding check', help: 'Offer an ungraded question with explanatory feedback.' },
  { kind: 'connection', label: 'Concept connection', help: 'Connect what was learned with what comes next.' },
];

export function newTeachingChoice(): TeachingChoice {
  return { id: createId(), label: 'New choice', explanation: 'Explain what this choice means.' };
}

/** Every new block starts valid for persistence; text editing is staged separately. */
export function newTeachingBlock(kind: TeachingBlockKind): TeachingBlock {
  const id = createId();
  switch (kind) {
    case 'explanation': return { id, kind, title: 'A new concept', body: 'Explain the concept here.', highlights: [] };
    case 'example': return { id, kind, title: 'Worked example', scenario: 'Describe a situation here.',
      steps: ['Describe the first action.'], takeaway: 'Explain what this example teaches.' };
    case 'comparison': return { id, kind, title: 'Compare two ideas',
      left: { label: 'First idea', description: 'Explain the first idea.', points: [] },
      right: { label: 'Second idea', description: 'Explain the second idea.', points: [] } };
    case 'sequence': return { id, kind, title: 'Explore the process',
      steps: [{ title: 'Step one', body: 'Explain the first step.' },
        { title: 'Step two', body: 'Explain the second step.' }] };
    case 'diagram': return { id, kind, title: 'Explore the connections',
      nodes: [{ id: createId(), label: 'First concept', detail: 'Explain the first concept.' },
        { id: createId(), label: 'Second concept', detail: 'Explain the second concept.' }] };
    case 'exploration': return { id, kind, title: 'Explore an outcome', prompt: 'What would happen?',
      choices: [newTeachingChoice(), newTeachingChoice()] };
    case 'check': {
      const options = [newTeachingChoice(), newTeachingChoice()];
      return { id, kind, title: 'Check your understanding',
        question: 'Which answer best applies?', options, correctId: options[0].id };
    }
    case 'connection': return { id, kind, title: 'Connect the ideas',
      body: 'Describe how this idea connects with the larger subject.', next: '' };
  }
}
