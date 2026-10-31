import { AI_COMPLETE_COVERAGE_PROMPT } from '../../core/ai-subject-coverage.ts';
import { DEFAULT_TEACHING_WEIGHTS, TEACHING_TYPES } from './ai-teaching-mix.ts';
import { guideAiFileOutputInstructions } from './ai-file-output.ts';
import { GUIDE_CONFIDENCE_PROMPT, GUIDE_CONFIDENCE_EXAMPLE } from './ai-confidence.ts';
import { guideAiFocusPrompt } from './ai-focus.ts';
import { GUIDE_AI_STOP_GAP, GUIDE_AI_MAX_SPACED_TOPICS } from './ai-map-layout.ts';
import { MAP_GRID, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH } from './library-model.ts';
import type { GuideAiPromptOptions } from './ai-import.ts';

const EXAMPLE = {
  format: 'dynamic-learner-guide-map', version: 2,
  title: 'Understanding operating systems', background: 'flow', startTopic: 'foundations',
  coverage: [{ subject: 'Core process concepts', itemNumbers: [1] }],
  confidence: GUIDE_CONFIDENCE_EXAMPLE,
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

export const GUIDE_OVERALL_DEFAULT_BLOCKS = 50;
export const GUIDE_CATEGORY_DEFAULT_BLOCKS = 30;

/** Overall lessons can grow with breadth; focused category lessons keep a strict count. */
export function overallTeachingBlockRange(target: number): { min: number; max: number } {
  return {
    min: Math.max(1, target - Math.max(2, Math.round(target * 0.10))),
    max: Math.min(80, target + Math.max(3, Math.round(target * 0.20))),
  };
}

export function guideAiTeachingPrompt(options: GuideAiPromptOptions, isOverall = true): string {
  const target = options.targetBlocks ?? (isOverall ? GUIDE_OVERALL_DEFAULT_BLOCKS : GUIDE_CATEGORY_DEFAULT_BLOCKS);
  const { min, max } = overallTeachingBlockRange(target);
  const countGoal = isOverall ? 'ABOUT ' + target + ' (normally ' + min + '–' + max + ')' : 'EXACTLY ' + target;
  const weights = options.weights ?? DEFAULT_TEACHING_WEIGHTS;
  const focus = options.mixMode === 'custom' ? '' : guideAiFocusPrompt(options.aiFocus);
  const mix = options.mixMode === 'custom'
    ? 'Custom teaching mix (approximate percentages over the entire map): ' +
      TEACHING_TYPES.map(type => type + ' ' + weights[type] + '%').join('; ') +
      '. Aim for ' + countGoal + ' meaningful Teaching Blocks across the whole map; the mix percentages are approximate. ' +
      (isOverall ? 'The total may adapt to the breadth of the source; avoid filler.' : 'The selected total is strict; do not pad with filler.')
    : 'Let AI choose the most educationally appropriate teaching block types for each concept. HEAVILY PREFER parameterized worked examples whenever the source genuinely supports changing inputs, formulas, algorithms, rules or calculations; reuse one sound template rather than hardcoding many nearly identical worked examples. Aim for EXACTLY ' +
      countGoal + ' meaningful Teaching Blocks across the whole map. ' +
      (isOverall ? 'Adapt within the preferred band when the overall source requires it; explain substantial deviations.' : 'Deviate only when the source makes the exact count educationally unsound.')
  return [
    'Using the original source material supplied earlier in this AI conversation, create a Dynamic Learner Guide MAP. The Guide TEACHES concepts before Review tests retention.',
    'Think like an excellent instructor building an interactive textbook, not a bulleted outline. Build understanding, teach WHY, supply context, select appropriate examples, visual models, explanations, comparisons and gentle questions. Never invent unsupported facts.',
    'Coverage: ' + options.coverage + '. Detail: ' + options.detail + '.',
    'LEARNING JOURNEY — ABSOLUTE PRIORITY: Guide is a teacher, not a surprise exam. DO NOT introduce a Check, memory prompt, predictive challenge or independent task until the learner has first encountered clear, sufficient teaching of the exact rule and its prerequisite concepts. No gotcha questions, grading pressure, forced answers, timers or unexplained terminology. Even when asking for prediction, precede it with the necessary worked explanation or source-backed conceptual setup. Include explicit examples before expecting independent application.',
    'DESIGN THE ENTIRE MAP AS A SPIRAL OF UNDERSTANDING, NOT A STACK OF ARTICLES: Early stops (roughly first third of the main learning path) establish foundational vocabulary, intuition, concrete examples and observed demonstrations. Middle stops reuse these foundations with worked variation, guided choices, predictions with clues and gentle applications. Later stops connect concepts, explore harder conditions and return to earlier taught ideas with less support. Difficulty should rise from the prerequisite structure of the SOURCE, not from arbitrary numbering or coordinate position. Never assume material was mastered because a stop was marked visited.',
    'DISTRIBUTED REVISITS: Return to important ideas after approximately 2–4 other relevant stops, where the map length and branching permit, then again when combined with a new concept. These are spaced across the learning PATH, not claims of day-based spaced repetition or measured long-term retention. The revisit must add a fresh connection or context rather than repeat identical wording. A learner on a side branch may have missed another branch; only refer to lessons that are ancestors or otherwise unambiguously already taught on that route.',
    'INTERACTION WITHOUT PREMATURE TESTING: Interleave brief explanation, exploration tabs, visual comparison, a supported thought experiment, worked example or solver demonstration, and a later gentle retrieval invitation. Avoid uninterrupted walls of explanation blocks and avoid excessive questions. Each interaction must serve understanding, not merely add clicks. Explain the WHY after any reveal; allow learners to skip guessing, get a clue or revisit the explanation without penalty.',
    'GUIDED-PRACTICE BLOCK: kind:"guided-practice",title,stage:"guided"|"apply"|"revisit",setup (source-backed teaching shown FIRST),prompt (small thought experiment AFTER teaching),hint (useful nonjudgmental clue),reveal (clear explained answer or reasoning),optional reflection (connection or implication). Use stage "guided" close to first instruction, "apply" after an earlier demonstration, and "revisit" only in a LATER stop after a prior source-backed introduction. Even revisit includes a short setup reminder; never assume recall or demand accuracy. The learner can always reveal the explanation and is never graded. These exercises are NOT replacements for Review or tests.',
    'FOR ALGORITHMS: Teach the governing rule and model the first state transitions before asking the learner to predict. Solver traces should move naturally from demonstrated steps to supported prediction, then independent prediction, while always retaining a reminder and reveal option. Ensure each trace entry shows exactly what changed and why. Generated algorithms cannot teach properly from a final answer alone.',

    mix,
    (isOverall
      ? 'TEACHING BLOCK COUNT — OVERALL SCOPE: The user selected ' + target + ' total Teaching Blocks as a TARGET, not a rigid quota. Aim near ' + target + ' across ALL stops; ' + min + '–' + max + ' is the usual planning range for a whole subject. Count every top-level lesson.blocks entry and distribute them deliberately, but prioritize complete, source-grounded teaching over a mathematically exact total.'
      : 'TEACHING BLOCK COUNT — CATEGORY SCOPE: The user selected EXACTLY ' + target + ' TOTAL Teaching Blocks across ALL stops. Allocate them BEFORE writing JSON and recount every top-level lesson.blocks item before exporting. The total should be EXACTLY ' + target + '. Avoid accidental overproduction or underproduction.') +
      ' A parameterized block counts as ONE Teaching Block regardless of generated examples; walkthrough steps and solver trace entries are NOT blocks.',
    (isOverall
      ? 'OVERALL COUNT FLEXIBILITY: Small differences within ' + min + '–' + max + ' are expected when justified by the breadth and depth of the source; do not add material just to reach ' + target + '. Go outside this range only when the source genuinely requires it for clear prerequisite teaching, scope coverage, or to avoid filler. Briefly identify substantial count deviations and their reason in confidence.coverageExplanation.'
      : 'CATEGORY COUNT EXCEPTIONS — RARE AND EXPLAINED: Treat ' + target + ' as a firm total. Deviate only if the source cannot sustain this many meaningful blocks or absolutely necessary prerequisites cannot fit. Keep any unavoidable difference as small as possible and explain the concrete reason in confidence.coverageExplanation.') +
      ' Never invent facts, omit essential teaching, repeat explanations or split identical content merely to satisfy a count.',
    'STOP COUNT — STRONG DEFAULT: Generate EXACTLY 5, 6, or 7 purposeful Map stops (prefer 6) for ordinary material. Do NOT treat 8–18 stops as the default. Combine closely related source headings into individual teaching destinations, each containing several blocks. Use fewer than 5 only if the source or selected block count is genuinely too small; use more than 7 only if the source breadth, prerequisites or unusually large block count genuinely require separate destinations. Do not add stops solely to fill the map or mirror each source heading. Explain any necessary exception briefly in confidence.coverageExplanation.',
    'PLAN AND VERIFY BOTH COUNTS: Create a normally 5–7-stop main path and allocate Teaching Blocks across its lessons BEFORE writing the JSON. Recount all top-level lesson.blocks entries before exporting. ' +
      (isOverall ? 'For Overall, aim near ' + target + ', usually ' + min + '–' + max + ' if the source supports it; small meaningful variations are acceptable.' : 'For this category, total EXACTLY ' + target + ' unless a genuine source-backed exception must be explained.') +
      ' The stop count is a separate 5–7 target. Source accuracy and teaching quality take precedence over either count.',
    'PARAMETERIZED TEACHING PRIORITY — IMPORTANT: Borrow Review\'s parameterized-generation discipline, adapted for TEACHING rather than grading. LOGIC / NUMBERS / PROCEDURES: FAVOR reusable parameterized Teaching Blocks wherever inputs, calculations, rules, equations, decision procedures or algorithms can genuinely vary. Prefer many valid generated instances of a method over one static numerical result or several hardcoded copies. This applies to source-supported algebra, statistics, operating systems calculations, algorithm tracing, and any other variable-based reasoning.',
    'Whenever the lesson teaches a repeatable computation, strongly favor a parameterized block with a complete source-grounded prompt, 1–12 instructional steps explaining HOW the result is derived, a takeaway, realistic variable ranges, satisfiable constraints, and computed answers that depend on generated variables. Use simpler explanations, comparisons, explorations and tables alongside them to teach intuition; do not create meaningless numeric problems for nonnumeric material.',
    'PARAMETER SAFETY AND CORRECTNESS: Use only formulas, input ranges, units, procedures and variable relationships that the supplied source explicitly establishes. NEVER invent sample quantities, input distributions, historical facts, constants, diagnostic thresholds, randomizable definitions or scenarios merely to force parameterization. Do not randomize genuinely fixed quantities. If no defensible variable ranges can be derived from the source, teach the concept without parameterization.',
    'PREFER SIMPLE EXPRESSION RULES: Generate rules.version=1, between 1 and 32 independent or derived variables, valid constraints, and 1–20 computed answers. Integer or decimal inputs have inclusive min/max; derived inputs use expressions; each answer has a unique key and exactly one expression/solverKey. Every computed answer MUST truly depend on generated values. Expressions support arithmetic, comparisons, boolean operators and documented safe math functions, not JavaScript. Avoid cyclic dependencies, impossible constraints, hardcoded lookup outputs and needless complexity. For algorithms whose state transitions exceed the restricted expressions, use a validated top-level solver package as described below.',
    'ALGORITHM EXECUTION — ESSENTIAL FOR OPERATING SYSTEMS AND PROCEDURAL MATERIAL: When the source teaches manual execution of CPU schedulers (FCFS, SJF, SRTF, RR), page replacement (FIFO, LRU), safe-state/deadlock algorithms, sorting/traversal, or another sequence of state transitions, create a PARAMETERIZED Teaching Block with a COMPLETE self-contained solver in the optional top-level solvers array. Such algorithms often cannot be expressed correctly with one arithmetic expression. Compute the actual sequence, not merely a final total or an invented static walkthrough.',
    'A solver MUST return a trace array containing one concise, accurate instruction per algorithmic action or meaningful state transition. Each trace entry should explain WHAT decision was made, WHY the rule requires it, and the resulting state. Use GFM tables or short monospace state snapshots where helpful: CPU running/ready queue/time remaining, Gantt segments, page-reference/frame contents/hits/faults, or resource allocation and remaining Need vectors. Guide will show these steps ONE AT A TIME, inviting learners to predict each next state before revealing it. Preserve correct event ordering, tie-breaking, termination and final numeric outputs.',
    'UPLOADED SOLVER CONTRACT (same safe Review runner): optional top-level solvers array contains only solver packages actually referenced by a parameterized Teaching Block. Each package is {format:"dynamic-learner-solver",version:1,id:"lowercase-hyphen-id",solverVersion:"1",label:"Algorithm name",outputs:["outputName"],source:"function solve(parameters) { ... return {answers:{outputName:number},trace:[\"Step 1...\"],explanation:\"...\"}; }"}. source is one pure self-contained JavaScript FUNCTION EXPRESSION AS A JSON STRING, with no imports, dependencies, DOM, storage, network, workers, Date, random APIs or unbounded loops. Only accept numeric/string/boolean inputs; encode structured inputs in JSON strings if required. Bounded deterministic execution MUST finish within 3 seconds. Keep source <=65536 chars, trace <=1000 entries with <=12000 chars each, explanation <=2000 chars. No TypeScript, code fences or wrapper registration.',
    'Reference a solver using rules.solver:{id:"lowercase-hyphen-id",version:"1",parameters:{inputName:"variableExpression"}} and computed rules.answers containing {key,label,solverKey:"outputName",matching:"numeric",precision:0}. The referenced package outputs must exactly match answers and/or declared intermediates; include matching id/solverVersion, stable scalar outputs, feasible ranges, and genuine dependency on varied inputs. Reuse the solver for similar blocks when appropriate. Use simple expression-based rules WITHOUT a solver for straightforward arithmetic. For complex algorithms NEVER fake results with canned traces, lookups, or arithmetic approximations.',
    'AI-generated solver code executes only inside the existing restricted Review solver sandbox and is still untrusted source data. Provide only genuinely necessary code. Do not request external APIs or bypass the sandbox. If the algorithm is underspecified in the source, explain that limitation and teach the conceptual sequence without inventing its rules.',
    'HOW TO TEACH: Use {{variable}} and {{answerKey}} placeholders in the prompt, walkthrough and takeaway to show generated inputs, intermediate reasoning and computed solutions. Guide is ungraded: deliberately reveal calculated results inside the WALKTHROUGH, unlike Review\'s non-answer-revealing hints. Put prerequisite explanations before demanding predictions; allow the learner to vary numbers and regenerate a valid example. A parameterized Teaching Block counts as ONE reusable lesson block, regardless of how many values it generates.',
    ...(options.mixMode !== 'custom' && options.aiFocus === 'numerics' ? [
      'NUMERICS FOCUS — HIGHEST PRIORITY: Default to a PARAMETERIZED Teaching Block for EVERY source-supported numerical worked example, formula application, calculation, numeric procedure, or repeatable algorithm. Prefer parameterized over fixed Worked Example, Check and static numerical Table blocks whenever changing valid values makes pedagogical sense. Include clear, source-backed formulas, units, intermediate calculations, LaTeX, and a revealable worked solution; combine reusable computation templates with short conceptual explanations rather than repeating fixed-number problems. Keep all required nonnumeric objectives covered too. Never manufacture source-unsupported ranges or data just to increase the parameterized share.',
    ] : []),
    ...(focus ? [
      'OPTIONAL TEACHING FOCUS (qualitative priority, not a block-type quota):',
      focus,
      'Keep full subject coverage and use only source-supported facts. The selected focus changes how material is taught, not which objectives may be omitted.',
    ] : []),
    AI_COMPLETE_COVERAGE_PROMPT,
    GUIDE_CONFIDENCE_PROMPT,
    'Coverage itemNumbers are 1-based topic indices in the topics array. Be honest about source gaps.',
    '',
    'SUPPORTED TEACHING BLOCK KINDS (exact fields, no app-generated IDs):',
    '- explanation: kind,title,body (Markdown),optional highlights (short text array).',
    '- example: kind,title,scenario (Markdown),steps (Markdown string array),takeaway (Markdown).',
    '- parameterized: kind,title,prompt (Markdown template),steps (1–12 Markdown template strings),takeaway (Markdown template),rules. STRONGLY PREFERRED for source-supported numeric or algorithmic procedures with varying inputs. Reuse the SAME Review parameter rules schema: rules={version:1,variables:[{name,kind:\'integer\',min,max}, ...],constraints:[],answers:[{key,label,expression,matching:\'numeric\',precision:0}]}. Use {{name}} for numeric variables and {{answerKey}} for computed results in prompt/steps/takeaway. Every answer expression MUST depend on generated values, and all identifiers must be unique. For complex algorithms, reference a solver package from the top-level solvers array. This is a TEACHING walkthrough, not a graded Review question.',
    '- comparison: kind,title,left and right each containing {label,description,points:[short strings]}.',
    '- table: kind,title,optional caption,headers (2–8 strings),rows (1–20 arrays with equal columns). Markdown/LaTeX in cells.',
    '- sequence: kind,title,optional intro,steps (2–12 objects containing title,body).',
    '- diagram: kind,title,optional caption,nodes (2–10 objects containing label,detail). A selectable conceptual flow.',
    '- exploration: kind,title,prompt,choices (2–8 objects containing label,explanation). No scoring.',
    '- guided-practice: kind,title,stage ("guided","apply","revisit"),setup (teach the idea FIRST),prompt (small prediction/reflection),hint (gentle clue),reveal (model reasoning and answer),optional reflection (new connection). NO grading. Use frequently to break up reading, after sufficient instruction, and schedule meaningful revisits later.',
    '- check: kind,title,question,options (2–8 objects containing label,explanation),correctIndex (zero-based integer). Gentle ungraded feedback.',
    '- connection: kind,title,body,optional next. Help the learner connect adjacent topics.',
    '',
    'GUIDED-PRACTICE EXAMPLE (source-supported; insert after introducing a concept):',
    JSON.stringify({ kind: 'guided-practice', title: 'Trace one scheduling choice',
      stage: 'guided', setup: 'A nonpreemptive FCFS scheduler runs the earliest ready process until it finishes.',
      prompt: 'If P1 arrives before P2 and both are ready, which runs first under FCFS?',
      hint: 'Focus on arrival order; FCFS does not interrupt the chosen process.',
      reveal: 'P1 runs first because FCFS selects the earliest ready process.',
      reflection: 'How would a preemptive policy change what happens when a new process arrives?' }),
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

    'ILLUSTRATIVE FIFO PAGE-REPLACEMENT SOLVER (adapt to the source, never substitute unsupported numbers):',
    JSON.stringify({
      format: 'dynamic-learner-solver', version: 1, id: 'fifo-trace', solverVersion: '1',
      label: 'FIFO page replacement', outputs: ['faultCount'],
      source: 'function solve(p) { const pages=[p.p0,p.p1,p.p2,p.p3,p.p4]; const frames=[]; let faults=0; const trace=[]; for (let i=0;i<pages.length;i++) { const page=pages[i]; let action="Hit: page already loaded"; if (!frames.includes(page)) { faults++; if (frames.length===3) frames.shift(); frames.push(page); action="Fault: load page; evict the oldest page if frames were full"; } trace.push("Reference "+(i+1)+": page "+page+". "+action+".\\n\\nFrames (oldest to newest): "+frames.join(" | ")+". Faults: "+faults); } return {answers:{faultCount:faults},trace}; }',
    }),
    'For the FIFO example, use five source-supported integer variables p0..p4 and rules.solver={id:"fifo-trace",version:"1",parameters:{p0:"p0",p1:"p1",p2:"p2",p3:"p3",p4:"p4"}}; rules.answers=[{key:"faults",label:"Page faults",solverKey:"faultCount",matching:"numeric",precision:0}]. Prefer a fully correct state trace over an attractive but fictional one.',
    'Use Markdown in longer text (headings, emphasis, lists, code, comparison tables) and LaTeX in any field: $x^2$, \\(x^2\\), $...$ or \\[...\\]. No arbitrary block kinds, HTML, JavaScript, source citation tokens, or arbitrary external URLs.',
    'Within each stop, begin with enough explanation or a model for what follows; only then introduce guided practice, exploration or a gentle check. Never open a stop with a cold recall test. Each map topic MUST have lesson: {"version":1,"blocks":[...]}, commonly about ' + Math.max(1, Math.round(target / 7)) + '–' + Math.ceil(target / 5) + ' useful blocks per stop for this ' + target + '-block target, adjusted for actual lesson needs; at most 80 per stop. No legacy sections/bullets in a new map. Every required string nonempty, <=10000 characters. Never create stored IDs. Parameterized blocks count as one block each and should appear where generating multiple worked examples genuinely improves understanding.',
    '',
    'MAP DESIGN IS A FIRST-CLASS TEACHING FEATURE: Make the route feel like an illustrated adventure with meaningful destinations, not a worksheet grid. The main path should travel across the canvas with an irregular rhythm, gentle S-bends and occasional purpose-driven side trails.',
    'Think in LEARNING DESTINATIONS: combine closely related headings into one stop containing several well-chosen Teaching Blocks. A normal Guide Map should contain EXACTLY 5, 6 or 7 purposeful stops, preferably 6. Do NOT make a stop for every fact, heading or Teaching Block. Use more or fewer ONLY when genuinely justified by the source or requested total. Preserve required learning objectives inside lessons even when multiple objectives share a stop.',
    'Before choosing coordinates, imagine the complete graph as a journey. Identify a main trail, where branches leave and rejoin through backtracking, and which related lessons should sit near each other. Keep directly connected stops visually close whenever the canvas allows.',
    'Avoid orderly rows or columns, identical coordinate increments, staircase diagrams, regular lattices and snake-shaped page-filling grids. Positions should differ organically in BOTH x and y; use the available open space to give a pleasing winding, branching route.',
    'MAP BACKGROUND — SELECT A DISTINCT WORLD: Set the top-level "background" field to EXACTLY ONE of "water", "contours", "constellations", "flow", "fireflies", "circuit", "programming" or "power-lines". This is ONE background for the whole map, not one per stop. Choose thoughtfully to complement the subject and mood: Water for fluid processes, cycles or nature; Contours for terrain, geography or layered systems; Constellations for astronomy, patterns, abstraction and connected ideas; Flow for motion and transitions; Fireflies for life sciences, ecology, discovery or warm exploration; Circuit for computer science hardware, electronics, architecture and networks; Programming for code, algorithms, software engineering or cybersecurity; Power Lines for electricity, energy grids, railroads, transportation infrastructure or engineering systems. These are suggestions rather than mandatory mappings.',
    'BACKGROUND VARIETY — IMPORTANT: Do not default to "contours" for every map. Vary choices between generated guides, especially when multiple themes are suitable. Explore ALL eight worlds over time, including Circuit and Programming for computer science topics, and Power Lines for electric infrastructure or railway systems. For ambiguous material choose a fitting imaginative alternative instead of repeatedly selecting the same default. Do not pretend to know earlier maps unless the user supplied them. Never use "plain" in a newly generated Map. Include your selected background in the downloadable JSON and verify that the value is allowed.',
    'MAP ART DIRECTION:',
    '- Design a creative, connected adventure tree, progressing mainly left to right with gentle vertical wandering and short, meaningful branch trails. Avoid straight lines, hub-and-spoke layouts, loops and disconnected topics.',
    '- Boxes are ' + MAP_TOPIC_WIDTH + 'x' + MAP_TOPIC_HEIGHT + ' px; leave at least ' + GUIDE_AI_STOP_GAP + ' px CLEAR SPACE between their boundaries. No touching or near-touching blocks.',
    '- Supply snapped [x,y] coordinates for ALL topics or NONE. x 0–' + MAP_MAX_X + ', y 0–' + MAP_MAX_Y + ', step ' + MAP_GRID + '. Choose an imaginative, coherent layout instead of evenly spaced grid coordinates. The app will reflow cramped or obvious grid layouts.',
    '- Maximum ' + GUIDE_AI_MAX_SPACED_TOPICS + ' topics (typically much fewer). N topics require exactly N-1 unique, acyclic [fromKey,toKey] connections. Each stop reachable from startTopic. Make learning progression coherent.',
    '- Give meaningful 1–2 sentence descriptions to build curiosity. No filler stops. If uncertain about map positions, omit ALL position fields and let the app create a spaced route.',
    '',
    guideAiFileOutputInstructions('map'),
    'The downloadable JSON file must use format "dynamic-learner-guide-map" and version 2, with title, background, startTopic, coverage, confidence, topics, connections and OPTIONAL solvers (only when a Parameterized block truly requires algorithm execution).',
    'The following shows the JSON structure to write INTO THE FILE. It is an illustrative schema ONLY: its two example stops and four sample blocks are NOT an instruction about output size. Your real output should normally have 5–7 stops and ' + countGoal + ' Teaching Blocks unless source coverage warrants an exception:',
    String.fromCharCode(96).repeat(3) + 'json',
    JSON.stringify(EXAMPLE, null, 2),
    String.fromCharCode(96).repeat(3),
    'FINAL SELF-CHECK: Count the topics array and sum every lesson.blocks array. Aim for 5, 6 or 7 purposeful stops. ' +
      (isOverall ? 'Overall Teaching Block count should be near ' + target + ' (ordinarily ' + min + '–' + max + '), adjusting to meaningful source breadth and avoiding filler. Explain any substantial deviation from this band in confidence.coverageExplanation.' : 'The category Teaching Block count should be EXACTLY ' + target + '; explain any rare unavoidable deviation in confidence.coverageExplanation.') +
      ' Never manufacture material solely to reach a numeric target.',
  ].join('\n');
}
