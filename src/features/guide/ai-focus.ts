/**
 * Teaching priorities are qualitative, not hard quotas for block types.
 * Guide should teach before Review tests retention; no graded typed answers.
 */
export const GUIDE_AI_FOCUSES = [
  { id: 'default', label: 'Default', icon: 'ai',
    description: 'Let AI choose the best ways to teach the material.',
    prompt: '' },
  { id: 'numerics', label: 'Focus on numerics', icon: 'calculator',
    description: 'Equations, calculations, and worked methods.',
    prompt: 'Prioritize numerical and mathematical understanding where the source supports it. Teach formulas step by step with worked examples, readable LaTeX, tables of assumptions and results, and intuitive explanations of why methods work. Clearly distinguish variables, constants and units. Do not invent calculations for inherently nonnumeric subjects.' },
  { id: 'recall', label: 'Focus on active recall', icon: 'pencil',
    description: 'Pause to predict, recall, and explain key ideas.',
    prompt: 'Prioritize low-pressure retrieval while teaching: concise explanations followed by gentle, ungraded understanding checks, prediction-based explorations, and informative feedback. Include enough instruction before each check to make it fair. Questions are for learning, not scoring; do not promise typed-answer grading that Guide does not support.' },
  { id: 'memorization', label: 'Focus on memorization', icon: 'cards',
    description: 'Definitions, terminology, and fixed facts.',
    prompt: 'Prioritize building durable memory for source-backed terms, definitions, distinctions and fixed facts. Introduce concepts in context, highlight compact takeaway phrases, organize comparisons and tables, and weave in gentle ungraded checks and connections to reinforce recall. Avoid rote repetition and do not invent mnemonic facts.' },
  { id: 'relationships', label: 'Focus on relationships', icon: 'shuffle',
    description: 'Connections, comparisons, and cause and effect.',
    prompt: 'Prioritize relationships between concepts: why they differ, what causes what, how systems interact, and how steps connect. Favor clear comparisons, structured tables, conceptual diagrams, sequences, and connections. Make every relationship concrete and understandable, not merely a list of associations.' },
  { id: 'application', label: 'Focus on application', icon: 'lightbulb',
    description: 'Realistic scenarios, decisions, and reasoning.',
    prompt: 'Prioritize applying concepts with source-grounded examples, worked situations, method-selection walkthroughs, exploration choices and reflective understanding checks. Show reasoning and consequences before moving to new material. Avoid invented constraints, artificial numerical exercises and unsupported scenarios.' },
] as const;

export type GuideAiFocus = (typeof GUIDE_AI_FOCUSES)[number]['id'];

export function guideAiFocusPrompt(focus: GuideAiFocus | undefined): string {
  return GUIDE_AI_FOCUSES.find(option => option.id === focus)?.prompt ?? '';
}
