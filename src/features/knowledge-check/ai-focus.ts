/** Guidance for AI-chosen question types; never fixed percentages or mandatory types. */
export const REVIEW_AI_FOCUSES = [
  { id: 'default', label: 'Default', icon: 'ai', description: 'Let AI choose the best question types for the material.', prompt: '' },
  { id: 'numerics', icon: 'calculator', label: 'Focus on numerics', description: 'Calculations, quantities, and procedures.',
    prompt: 'Prioritize mathematical reasoning and procedural understanding. Favor reusable Parameterized questions for genuinely variable calculations and algorithms, with well-defined constraints; use typed numeric responses when they test the work better than recognition. Never randomize fixed facts, medical thresholds, or constants.' },
  { id: 'typed', icon: 'pencil', label: 'Focus on typed answers', description: 'Short answers the learner must recall.',
    prompt: 'Prioritize active recall over recognition. Favor Fill in the Blanks for unambiguous short terms, words, symbols, and numbers; use generated typed fields for computed results. Use Short Answer sparingly for uniquely checkable short phrases, and use choices where open-text grading could be ambiguous.' },
  { id: 'memorization', icon: 'cards', label: 'Focus on memorization', description: 'Terms, definitions, and fixed facts.',
    prompt: 'Prioritize retrieving terms, definitions, functions, and fixed facts. Favor concise Fill in the Blanks for uniquely recallable terms, and plausible Multiple Choice for fine distinctions. Use meaningful matching Dropdowns for associations. Vary recall directions without repeating facts or inventing numeric variables.' },
  { id: 'relationships', icon: 'shuffle', label: 'Focus on relationships', description: 'Matching, associations, and comparisons.',
    prompt: 'Prioritize the connections between terms, functions, causes, and outcomes. Favor matching Dropdowns for several related associations, Multiple Choice for discriminating comparisons, and short Fill in the Blanks for missing labels in tables or processes. Avoid trivial matches and ambiguous pairings.' },
  { id: 'application', icon: 'lightbulb', label: 'Focus on application', description: 'Scenarios, reasoning, and method selection.',
    prompt: 'Prioritize applying concepts to new but source-grounded scenarios, interpreting outcomes, and choosing appropriate methods. Favor Parameterized questions for variable logical/numeric procedures, scenario-based Multiple Choice for decisions and reasoning, and concise typed answers where results are uniquely determined. Avoid invented assumptions and gratuitous word problems.' },
] as const;

export type ReviewAiFocus = (typeof REVIEW_AI_FOCUSES)[number]['id'];
export function reviewAiFocusPrompt(focus: ReviewAiFocus | undefined): string {
  return REVIEW_AI_FOCUSES.find(option => option.id === focus)?.prompt ?? '';
}
