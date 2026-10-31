import { AI_COMPLETE_COVERAGE_PROMPT } from '../../core/ai-subject-coverage.ts';
import { DEFAULT_TEACHING_WEIGHTS, TEACHING_TYPES } from './ai-teaching-mix.ts';
import { guideAiFocusPrompt } from './ai-focus.ts';
import { GUIDE_AI_STOP_GAP, GUIDE_AI_MAX_SPACED_TOPICS } from './ai-map-layout.ts';
import { MAP_GRID, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH } from './library-model.ts';
import type { GuideAiPromptOptions } from './ai-import.ts';

const EXAMPLE = {
  format: 'dynamic-learner-guide-map', version: 2,
  title: 'Understanding operating systems', startTopic: 'foundations',
  coverage: [{ subject: 'Core process concepts', itemNumbers: [1] }],
  topics: [
    { key: 'foundations', title: 'The foundations', position: [64, 384],
      description: 'Begin with a big-picture explanation and test a prediction.',
      lesson: { version: 1, blocks: [
        { kind: 'explanation', title: 'Begin here',
          body: '**Processes** have an address space; threads are execution paths within a process.' },
        { kind: 'comparison', title: 'Two related ideas',
          left: { label: 'Process', description: 'Resource container.', points: ['Own address space'] },
          right: { label: 'Thread', description: 'Execution path.', points: ['Shares process resources'] } },
        { kind: 'check', title: 'Check understanding', question: 'What shares a process address space?',
          options: [{ label: 'Threads', explanation: 'Threads share the containing process address space.' },
            { label: 'Unrelated processes', explanation: 'Processes generally use separate address spaces.' }],
          correctIndex: 0 },
      ] } },
    { key: 'applications', title: 'Apply your knowledge', position: [352, 256],
      lesson: { version: 1, blocks: [
        { kind: 'example', title: 'Worked example', scenario: 'A scheduler needs to select work.',
          steps: ['Identify runnable tasks.', 'Apply the scheduling policy.'],
          takeaway: 'Scheduling selects runnable work.' },
      ] } },
  ],
  connections: [['foundations', 'applications']],
};

export function guideAiTeachingPrompt(options: GuideAiPromptOptions): string {
  const target = options.targetBlocks ?? 30;
  const weights = options.weights ?? DEFAULT_TEACHING_WEIGHTS;
  const focus = options.mixMode === 'custom' ? '' : guideAiFocusPrompt(options.aiFocus);
  const mix = options.mixMode === 'custom'
    ? 'Custom teaching mix (approximate percentages over the entire map): ' +
      TEACHING_TYPES.map(type => type + ' ' + weights[type] + '%').join('; ') +
      '. Target ' + target + ' meaningful blocks. Do not add filler to meet quotas.'
    : 'Let AI choose the most educationally appropriate teaching block types for each concept. Target around ' +
      target + ' meaningful blocks overall, or fewer when source material is limited.';
  return [
    'Using the original source material supplied earlier in this AI conversation, create a Dynamic Learner Guide MAP. The Guide TEACHES concepts before Review tests retention.',
    'Think like an excellent instructor building an interactive textbook, not a bulleted outline. Build understanding, teach WHY, supply context, select appropriate examples, visual models, explanations, comparisons and gentle questions. Never invent unsupported facts.',
    'Coverage: ' + options.coverage + '. Detail: ' + options.detail + '.',
    mix,
    ...(focus ? [
      'OPTIONAL TEACHING FOCUS (qualitative priority, not a block-type quota):',
      focus,
      'Keep full subject coverage and use only source-supported facts. The selected focus changes how material is taught, not which objectives may be omitted.',
    ] : []),
    AI_COMPLETE_COVERAGE_PROMPT,
    'Coverage itemNumbers are 1-based topic indices in the topics array. Be honest about source gaps.',
    '',
    'SUPPORTED TEACHING BLOCK KINDS (exact fields, no app-generated IDs):',
    '- explanation: kind,title,body (Markdown),optional highlights (short text array).',
    '- example: kind,title,scenario (Markdown),steps (Markdown string array),takeaway (Markdown).',
    '- parameterized: kind,title,prompt (Markdown template),steps (1–12 Markdown template strings),takeaway (Markdown template),rules. Use ONLY for genuinely variable-driven worked examples such as calculations, dynamic algorithms and formulas. Reuse the SAME Review parameter rules schema: rules={version:1,variables:[{name,kind:\'integer\',min,max}, ...],constraints:[],answers:[{key,label,expression,matching:\'numeric\',precision:0}]}. Use {{name}} for numeric variables and {{answerKey}} for computed results in prompt/steps/takeaway. Every answer expression MUST depend on generated values, and all identifiers must be unique. No uploaded solver packages or scripts. This is a TEACHING walkthrough, not a graded Review question.',
    '- comparison: kind,title,left and right each containing {label,description,points:[short strings]}.',
    '- table: kind,title,optional caption,headers (2–8 strings),rows (1–20 arrays with equal columns). Markdown/LaTeX in cells.',
    '- sequence: kind,title,optional intro,steps (2–12 objects containing title,body).',
    '- diagram: kind,title,optional caption,nodes (2–10 objects containing label,detail). A selectable conceptual flow.',
    '- exploration: kind,title,prompt,choices (2–8 objects containing label,explanation). No scoring.',
    '- check: kind,title,question,options (2–8 objects containing label,explanation),correctIndex (zero-based integer). Gentle ungraded feedback.',
    '- connection: kind,title,body,optional next. Help the learner connect adjacent topics.',
    '',
    'PARAMETERIZED EXAMPLE SCHEMA (only when genuinely educational, never copy unrelated example facts):',
    JSON.stringify({
      kind: 'parameterized', title: 'Compute the area',
      prompt: 'A rectangle is {{width}} by {{height}} units. What is its area?',
      steps: ['Identify width {{width}} and height {{height}}.',
        'Multiply them: {{width}} × {{height}} = {{area}}.'],
      takeaway: 'The area is {{area}} square units.',
      rules: { version: 1, variables: [
        { name: 'width', kind: 'integer', min: 2, max: 12 },
        { name: 'height', kind: 'integer', min: 2, max: 12 },
      ], constraints: [], answers: [
        { key: 'area', label: 'Area', expression: 'width * height',
          matching: 'numeric', precision: 0 },
      ] },
    }),
    'Use Markdown in longer text (headings, emphasis, lists, code, comparison tables) and LaTeX in any field: $x^2$, \\(x^2\\), $...$ or \\[...\\]. No arbitrary block kinds, HTML, JavaScript, source citation tokens, or arbitrary external URLs.',
    'Each map topic MUST have lesson: {"version":1,"blocks":[...]}, usually 2–8 useful blocks; at most 80. No legacy sections/bullets in a new map. Every required string nonempty, <=10000 characters. Never create stored IDs. Parameterized blocks count as one block each and should appear where generating multiple worked examples genuinely improves understanding.',
    '',
    'MAP DESIGN IS A FIRST-CLASS TEACHING FEATURE: Make the route feel like an illustrated adventure with meaningful destinations, not a worksheet grid. The main path should travel across the canvas with an irregular rhythm, gentle S-bends and occasional purpose-driven side trails.',
    'Think in LEARNING DESTINATIONS: combine closely related headings into a single stop containing several well-chosen Teaching Blocks. A normal guide often needs about 8–18 purposeful stops, not a separate stop for every fact or source heading. Preserve EVERY source learning objective inside the lessons even when multiple objectives share a stop.',
    'Before choosing coordinates, imagine the complete graph as a journey. Identify a main trail, where branches leave and rejoin through backtracking, and which related lessons should sit near each other. Keep directly connected stops visually close whenever the canvas allows.',
    'Avoid orderly rows or columns, identical coordinate increments, staircase diagrams, regular lattices and snake-shaped page-filling grids. Positions should differ organically in BOTH x and y; use the available open space to give a pleasing winding, branching route.',
    'MAP ART DIRECTION:',
    '- Design a creative, connected adventure tree, progressing mainly left to right with gentle vertical wandering and short, meaningful branch trails. Avoid straight lines, hub-and-spoke layouts, loops and disconnected topics.',
    '- Boxes are ' + MAP_TOPIC_WIDTH + 'x' + MAP_TOPIC_HEIGHT + ' px; leave at least ' + GUIDE_AI_STOP_GAP + ' px CLEAR SPACE between their boundaries. No touching or near-touching blocks.',
    '- Supply snapped [x,y] coordinates for ALL topics or NONE. x 0–' + MAP_MAX_X + ', y 0–' + MAP_MAX_Y + ', step ' + MAP_GRID + '. Choose an imaginative, coherent layout instead of evenly spaced grid coordinates. The app will reflow cramped or obvious grid layouts.',
    '- Maximum ' + GUIDE_AI_MAX_SPACED_TOPICS + ' topics (typically much fewer). N topics require exactly N-1 unique, acyclic [fromKey,toKey] connections. Each stop reachable from startTopic. Make learning progression coherent.',
    '- Give meaningful 1–2 sentence descriptions to build curiosity. No filler stops. If uncertain about map positions, omit ALL position fields and let the app create a spaced route.',
    '',
    'Return ONLY a complete fenced JSON code block with format "dynamic-learner-guide-map" and version 2, with title, startTopic, coverage, topics and connections.',
    'The following is a SCHEMA example, not source material to reuse:',
    String.fromCharCode(96).repeat(3) + 'json',
    JSON.stringify(EXAMPLE, null, 2),
    String.fromCharCode(96).repeat(3),
    'If the source cannot support the target, use fewer blocks and explain the gaps in the coverage statistics. Accuracy and teaching value come first.',
  ].join('\n');
}
