import { h, type VNode, type VNodeChild } from 'vue';
import { renderMarkdown } from '../../components/markdown-renderer.ts';
import { renderLatexAttribute } from '../../components/latex-module.ts';

/**
 * Short teaching labels keep their literal characters (including Markdown
 * punctuation), but recognize math delimiters. Long content is passed through
 * the application's existing sanitized Markdown/KaTeX renderer instead.
 */
export interface TeachingMathPart { kind: 'text' | 'inline' | 'display'; value: string; raw?: string }
const mathPattern = /\\\[([\s\S]*?)\\\]|\\\(([^\n]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^\n$]+?)\$/g;

export function tokenizeTeachingMath(source: string): TeachingMathPart[] {
  const result: TeachingMathPart[] = [];
  let cursor = 0;
  for (const match of source.matchAll(mathPattern)) {
    const at = match.index;
    const raw = match[0];
    const content = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    if (!content.trim() || content.length > 4000) continue;
    // A single escaped dollar is ordinary text, as are prices like "$5 and $10".
    if (raw.startsWith('$') && !raw.startsWith('$$') && (
      (at > 0 && source[at - 1] === '\\') ||
      /\s/.test(content[0]) || /\s/.test(content[content.length - 1]) ||
      /\d/.test(source[at + raw.length] ?? '')
    )) continue;
    if (at > cursor) result.push({ kind: 'text', value: source.slice(cursor, at) });
    result.push({
      kind: raw.startsWith('$$') || raw.startsWith('\\[') ? 'display' : 'inline',
      value: content, raw,
    });
    cursor = at + raw.length;
  }
  if (cursor < source.length) result.push({ kind: 'text', value: source.slice(cursor) });
  return result;
}

/** Text and safely rendered KaTeX; no arbitrary authored HTML is executed. */
export function renderTeachingMath(text: string): VNodeChild[] {
  return tokenizeTeachingMath(text).map(part => {
    if (part.kind === 'text') return part.value;
    let html: string | null;
    try { html = renderLatexAttribute(encodeURIComponent(part.value), part.kind === 'display'); }
    catch { html = null; }
    return html !== null ? h('span', {
      class: part.kind === 'display' ? 'guide-lesson-math-display' : 'guide-lesson-math-inline',
      innerHTML: html,
    }) : h('code', part.raw ?? part.value);
  });
}

/** Full Markdown including lists, emphasis, code, and inline/display LaTeX. */
export function renderTeachingRich(text: string): VNode {
  return h('div', { class: 'markdown-content guide-lesson-rich' },
    renderMarkdown(text, [], 'guide-teaching-heading'));
}
