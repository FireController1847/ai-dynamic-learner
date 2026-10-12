/**
 * Shared generation rules reflect where this app ACTUALLY renders Markdown.
 * Structured answers, puzzle cells, and most study cards remain plain text.
 */
export const AI_MARKDOWN_CONTEXT_GUIDANCE = String.raw`Markdown and KaTeX — optional "context" field:
- Dynamic Learner renders "context" as GitHub-flavored Markdown plus KaTeX mathematics. Use concise Markdown (tables, lists, emphasis, blockquotes, and fenced code) and correctly typeset equations whenever they genuinely help the learner understand or interpret the material.
- Inline math: $E=mc^2$ or \(E=mc^2\). Centered display math: $$\frac{a}{b}$$ or \[\sum_{i=1}^{n} i\]. Prefer display equations on their own lines. Use supported KaTeX math commands, not entire LaTeX documents or raw HTML.
- The output MUST be valid JSON: escape every TeX backslash in the JSON string (JSON must contain \\frac and \\sqrt, not \frac or \sqrt). Encode line breaks inside JSON strings as \n. No need to escape dollar signs in JSON.
- Never put math delimiters inside inline/fenced code unless they are meant to appear literally.
- ONLY the optional "context" field renders Markdown/KaTeX. Keep "prompt", "answer", "correctAnswers", "choices", "matches", "explanation", parameter names, solver expressions, answer keys, and other non-context fields in their required plain-text or code formats. Never put KaTeX in a graded answer value. Keep context useful, source-grounded, and free of answer giveaways.`;

export const AI_PLAIN_TEXT_ONLY_GUIDANCE = String.raw`Markdown and KaTeX: Dynamic Learner CAN render GitHub-flavored Markdown and KaTeX math in explicitly Markdown-enabled fields (for example Review question "context" and Notebook Markdown documents). THIS import format has NO such fields. Keep all output field values plain text; do not insert Markdown markup, $...$ or $$...$$ delimiters, \( ... \), \[ ... \], or LaTeX commands into titles, descriptions, bullets, flash cards, blanks, hints, clues, or answers. Use clear plain-text mathematical notation when needed. The required outer JSON code fence is still allowed.`;
