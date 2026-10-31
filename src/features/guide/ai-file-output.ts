/** Shared Guide AI output contract for both Map and List generation. */
export function guideAiFileOutputInstructions(mode: 'map' | 'list'): string {
  const filename = mode === 'map' ? 'dynamic-learner-guide-map.json' : 'dynamic-learner-guide-list.json';
  return `OUTPUT AS A DOWNLOADABLE JSON FILE, NOT A CHAT CODE BLOCK:
- Create an actual UTF-8 .json file named ${filename}, containing the COMPLETE valid JSON object matching the schema below. Attach the file to your reply so the user can download and import it into Dynamic Learner.
- Do not print JSON in chat, do not respond with a fenced JSON code block, do not split the response into parts, and do not truncate the file. Check that the file contains syntactically valid JSON before providing it.
- If your AI environment cannot create or attach a downloadable file, briefly explain the limitation and provide the COMPLETE raw JSON as a fallback. Do not claim to have attached a file unless it was actually created and attached.
- Any example JSON shown below explains the file's structure only; it is NOT an instruction to return a code block.`;
}
