import { aiFileOutputInstructions } from '../../core/ai-file-output.ts';

/** Keep Guide's filenames and output wording stable while sharing the contract. */
export function guideAiFileOutputInstructions(mode: 'map' | 'list'): string {
  return aiFileOutputInstructions(mode === 'map' ? 'dynamic-learner-guide-map.json' : 'dynamic-learner-guide-list.json');
}
