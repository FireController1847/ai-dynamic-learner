import { createId } from '../../core/ids.ts';
import type { MapGuideData, MapTopic } from './library-model.ts';
import type { TeachingBlock, TeachingLesson } from './teaching-blocks.ts';

type BlockInput = TeachingBlock extends infer T ? Omit<T, 'id'> : never;
const withId = <T extends { kind: TeachingBlock['kind'] }>(block: T) => ({ id: createId(), ...block });
const choice = (label: string, explanation: string) => ({ id: createId(), label, explanation });
const lesson = (blocks: TeachingBlock[]): TeachingLesson => ({ version: 1, blocks });

/** A real, locally generated map with every renderer type and meaningful interactions. */
export function createTeachingBlocksDemo(): MapGuideData {
  const predict = choice('It must always finish immediately', 'Not necessarily. If both processes hold resources the other needs, each can wait forever.');
  const wait = choice('Each may wait for the other indefinitely', 'Exactly. Circular wait is one of the necessary conditions for deadlock.');
  const memory = choice('Memory is automatically freed', 'Holding a lock does not inherently release memory or solve resource contention.');
  const a = choice('Acquire locks in a shared order', 'Yes. A consistent global lock order prevents circular wait.');
  const b = choice('Acquire locks in arbitrary order', 'This can cause circular wait if processes take different resources first.');
  const c = choice('Keep every lock indefinitely', 'Holding locks indefinitely can make progress impossible.');

  const introduction = lesson([
    withId({ kind: 'explanation', title: 'Welcome to a lesson, not a slideshow',
      body: 'Guide is where ideas become understandable before Review asks you to remember them. A lesson can combine explanation, visuals, examples, and optional activities.\n\nAll content is visible without clicking through individual bullets. Explore only when it adds something useful.',
      highlights: ['Understand first', 'Explore freely', 'Review later'] }),
    withId({ kind: 'example', title: 'An everyday example: sharing two tools',
      scenario: 'Two people need a wrench and a screwdriver. One takes the wrench; the other takes the screwdriver. Neither will put their tool down until they have both.',
      steps: ['Person A picks up the wrench.', 'Person B picks up the screwdriver.', 'A waits for B to release the screwdriver, while B waits for A to release the wrench.', 'Both are stuck unless one releases a resource or the rules change.'],
      takeaway: 'The problem is not slow work. It is a cycle of dependencies.' }),
    withId({ kind: 'comparison', title: 'Two very different situations',
      left: { label: 'Waiting', description: 'A process pauses until a resource is available.', points: ['May resolve naturally', 'Does not necessarily form a cycle'] },
      right: { label: 'Deadlock', description: 'A set of processes are blocked waiting on one another.', points: ['No process in the cycle can progress', 'Needs prevention, avoidance, detection, or recovery'] } }),
    withId({ kind: 'table', title: 'Four conditions of deadlock',
      caption: 'An overview table alongside the interactive examples.',
      headers: ['Condition', 'Meaning'],
      rows: [
        ['Mutual exclusion', 'At least one resource is non-shareable.'],
        ['Hold and wait', 'A process holds resources while requesting others.'],
        ['No preemption', 'A held resource cannot be forcibly taken.'],
        ['Circular wait', 'Each process waits for a resource held by another in a cycle.'],
      ] }),
    withId({ kind: 'sequence', title: 'How circular wait forms',
      intro: 'Select a stage to inspect it. You can jump to any stage without unlocking the previous one.',
      steps: [
        { title: 'A takes Lock 1', body: 'Process A acquires Lock 1 and continues executing.' },
        { title: 'B takes Lock 2', body: 'Process B acquires Lock 2 while A still holds Lock 1.' },
        { title: 'A needs Lock 2', body: 'A must wait, because B is holding Lock 2.' },
        { title: 'B needs Lock 1', body: 'B must also wait. Neither can progress while retaining its lock.' },
      ] }),
    withId({ kind: 'diagram', title: 'Follow the resource dependencies',
      caption: 'A simplified linear walkthrough of a circular dependency. Select any node for an explanation.',
      nodes: [
        { id: createId(), label: 'Process A', detail: 'Process A holds Lock 1 and requests Lock 2.' },
        { id: createId(), label: 'Lock 2', detail: 'Lock 2 cannot be granted to A because B already holds it.' },
        { id: createId(), label: 'Process B', detail: 'Process B holds Lock 2 and requests Lock 1, completing the cycle back to A.' },
      ] }),
    withId({ kind: 'exploration', title: 'Try a prediction',
      prompt: 'What can happen when two processes acquire resources in different orders?',
      choices: [predict, wait, memory] }),
    withId({ kind: 'check', title: 'Check your understanding',
      question: 'Which strategy prevents circular wait in this example?',
      options: [a, b, c], correctId: a.id }),
    withId({ kind: 'connection', title: 'Where this leads',
      body: 'Now that you can recognize circular wait, the next useful question is how an operating system prevents it or recovers after it happens.',
      next: 'Explore the other two stops to see a prevention strategy and practice a new scenario.' }),
  ] as TeachingBlock[]);

  const prevention = lesson([
    withId({ kind: 'explanation', title: 'Preventing circular wait',
      body: 'One common **prevention strategy** is to impose a global ordering on resource acquisition. All processes request locks in the same order.\n\nFor example, request $L_1$ before $L_2$. This removes the possibility of a circular ordering of resource dependencies.',
      highlights: ['Lock ordering', '$L_1$ before $L_2$'] }),
    withId({ kind: 'diagram', title: 'Consistent lock order',
      nodes: [
        { id: createId(), label: 'Request Lock 1', detail: 'Every process follows the same first lock order.' },
        { id: createId(), label: 'Request Lock 2', detail: 'A process requests the second lock only after acquiring the first.' },
        { id: createId(), label: 'Release locks', detail: 'After finishing, a process releases the locks for others.' },
      ] }),
    withId({ kind: 'connection', title: 'Connect the ideas',
      body: 'Recognizing a possible deadlock is different from preventing one. Lock ordering is one way to avoid circular wait.',
      next: 'Visit the practice stop and make one more prediction.' }),
  ] as TeachingBlock[]);
  const practice = lesson([
    withId({ kind: 'example', title: 'Apply the idea',
      scenario: 'Two processes both request Lock 1 before Lock 2.',
      steps: ['The first process holds Lock 1.', 'The other process waits for Lock 1 without holding Lock 2.', 'The first process can obtain Lock 2, finish, and release both locks.', 'The waiting process can then continue.'],
      takeaway: 'A consistent lock ordering prevents this particular circular-wait pattern.' }),
    withId({ kind: 'check', title: 'Think it through',
      question: 'If processes request locks in a consistent global order, which deadlock condition does this strategy prevent?',
      options: [
        { id: createId(), label: 'Circular wait', explanation: 'Correct. Consistent ordering removes the cycle from resource acquisition.' },
        { id: createId(), label: 'Mutual exclusion', explanation: 'No. A lock can still be exclusive even when the order of acquisition is fixed.' },
        { id: createId(), label: 'All resource contention', explanation: 'No. Waiting can still occur without deadlock.' },
      ], correctId: '' }),
  ] as TeachingBlock[]);

  // The keyed answer references the generated, unique choice ID.
  const last = practice.blocks[1];
  if (last.kind === 'check') last.correctId = last.options[0].id;

  const formatting = lesson([
    withId({ kind: "explanation", title: "Markdown: more than plain bullet points",
      body: "## Markdown typography\n\n**Bold** draws attention, *italics* add emphasis, and ~~strikethrough~~ marks revisions. Inline code such as `Process.wait()` stays monospace.\n\n### Lists and nested ideas\n\n- First principle: describe what happens.\n- Second principle: show a **worked example**.\n  - Give the learner context.\n  - Explain why the outcome matters.\n\n> Blockquotes provide a visual way to set apart a key insight.\n\nA horizontal rule separates topics:\n\n---\n\n[Visit Dynamic Learner](https://dynlearn.org) demonstrates a hyperlink, and fenced code is displayed below.\n\n```text\nAcquire(Lock1)\nAcquire(Lock2)\nRelease(Lock2)\nRelease(Lock1)\n```", highlights: ["**Bold** is Markdown","$x^2$ is LaTeX"] }),
    withId({ kind: "explanation", title: "Markdown tables inside explanations",
      body: "Markdown tables work inside any long-form field, including an explanation:\n\n| Concept | Notation | Result |\n| :--- | :---: | ---: |\n| **Inline math** | $x^2$ | *Typeset* |\n| Code | `wait()` | Monospace |\n| Strong emphasis | **important** | Visible |" }),
    withId({ kind: "explanation", title: "LaTeX: inline and displayed mathematics",
      body: "LaTeX works in **long explanations** and in shorter labels.\n\nInline expressions: $x^2+y^2=z^2$ or \\(\\alpha+\\beta=\\gamma\\).\n\nDisplayed equation:\n\n$\n\\int_0^1 x^2\\,dx=\\frac{1}{3}\n$\n\nThe alternate display syntax also works:\n\n\\[\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n\\]", highlights: ["$\\alpha$","$E=mc^2$"] }),
    withId({
      "kind": "table",
      "title": "A structured table with Markdown and LaTeX",
      "caption": "Unlike a Markdown table, this table has dedicated editors for its columns and rows.",
      "headers": [
        "Expression",
        "Interpretation",
        "Complexity"
      ],
      "rows": [
        [
          "$O(1)$",
          "Constant time — **one step**",
          "Useful for array indexing"
        ],
        [
          "$O(\\log n)$",
          "Logarithmic time; binary search",
          "Halving the search space"
        ],
        [
          "$O(n)$",
          "Linear time — *one pass*",
          "Visiting every element"
        ],
        [
          "$O(n^2)$",
          "Quadratic time",
          "Common with nested loops"
        ]
      ]
    }),
    withId({ kind: 'connection', title: 'Pick the right tool',
      body: 'Use a **Markdown table** when the grid is one piece of a larger explanation. Use a dedicated **Table block** when the comparison itself is what you are teaching. Both can contain mathematical notation.',
      next: 'Return to any other map stop to see how these formats combine with interactive questions and diagrams.' }),
  ] as TeachingBlock[]);

  const topics: MapTopic[] = [
    { id: createId(), title: 'Teaching Blocks Gallery', description: 'All nine teaching blocks in one interactive lesson.', x: 96, y: 384,
      guide: { sections: [] }, lesson: introduction },
    { id: createId(), title: 'Visual Prevention', description: 'Explore a short explanation and interactive resource flow.', x: 480, y: 224,
      guide: { sections: [] }, lesson: prevention },
    { id: createId(), title: 'Try It Yourself', description: 'Learn from an example and a gentle understanding check.', x: 480, y: 576,
      guide: { sections: [] }, lesson: practice },
    { id: createId(), title: 'Markdown & LaTeX Showcase', description: 'Explore rich Markdown, math, Markdown tables, and the dedicated Table block.', x: 896, y: 384,
      guide: { sections: [] }, lesson: formatting },
  ];
  return {
    topics,
    connections: [
      { id: createId(), from: topics[0].id, to: topics[1].id },
      { id: createId(), from: topics[0].id, to: topics[2].id },
      { id: createId(), from: topics[1].id, to: topics[3].id },
      { id: createId(), from: topics[2].id, to: topics[3].id },
    ],
    startTopicId: topics[0].id,
  };
}
