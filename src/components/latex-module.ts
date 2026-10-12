import { renderToString } from 'katex';
import type { TokenizerExtension } from 'marked';

/** Shared LaTeX tokenization for the Markdown lexer. Code blocks stay literal. */
type MathToken = { type: string; raw: string; text: string };
const MAX_TEX_LENGTH = 4000;

/** Encode TeX in a placeholder attribute, never unescaped user HTML. */
function placeholder(tex: string, display: boolean): string {
  const tag = display ? 'div' : 'span';
  return '<' + tag + ' data-dl-latex="' + encodeURIComponent(tex) + '"></' + tag + '>';
}

const displayMath: TokenizerExtension = {
  name: 'dl-display-math',
  level: 'block',
  start: (src: string) => {
    const at = src.search(/(?:^|\n)[ \t]*(?:\$\$|\\\[)/);
    return at < 0 ? undefined : at === 0 ? 0 : at + 1;
  },
  tokenizer(src: string) {
    const open = src.startsWith('$$') ? '$$' : src.startsWith('\\[') ? '\\[' : null;
    if (!open) return;
    const close = open === '$$' ? '$$' : '\\]';
    const end = src.indexOf(close, open.length);
    if (end < 0) return;
    const text = src.slice(open.length, end).trim();
    if (!text) return;
    return { type: 'dl-display-math', raw: src.slice(0, end + close.length), text };
  },
  renderer(token) {
    return placeholder((token as MathToken).text, true);
  },
};

const inlineMath: TokenizerExtension = {
  name: 'dl-inline-math',
  level: 'inline',
  start: (src: string) => {
    const slash = src.indexOf('\\(');
    const dollar = src.search(/\$(?!\$)/);
    return slash < 0 ? dollar < 0 ? undefined : dollar
      : dollar < 0 ? slash : Math.min(slash, dollar);
  },
  tokenizer(src: string) {
    if (src.startsWith('\\(')) {
      const end = src.indexOf('\\)', 2);
      if (end < 0) return;
      const text = src.slice(2, end);
      if (!text.trim() || text.includes('\n')) return;
      return { type: 'dl-inline-math', raw: src.slice(0, end + 2), text };
    }
    if (!src.startsWith('$') || src.startsWith('$$') || !src[1] || /\s/.test(src[1])) return;
    // Keep ordinary currency strings like "$5 and $10" as text.
    for (let end = 1; end < src.length && src[end] !== '\n'; end++) {
      if (src[end] !== '$' || src[end - 1] === '\\') continue;
      if (/\s/.test(src[end - 1]!) || /\d/.test(src[end + 1] ?? '')) return;
      const text = src.slice(1, end);
      if (!text) return;
      return { type: 'dl-inline-math', raw: src.slice(0, end + 1), text };
    }
  },
  renderer(token) {
    return placeholder((token as MathToken).text, false);
  },
};

export const markdownMathExtensions: TokenizerExtension[] = [displayMath, inlineMath];

/** Only sanitized math placeholders call this; KaTeX runs with trust disabled. */
export function renderLatexAttribute(encoded: string, display: boolean): string | null {
  let tex: string;
  try { tex = decodeURIComponent(encoded); }
  catch { return null; }
  if (!tex.trim() || tex.length > MAX_TEX_LENGTH) return null;
  try {
    return renderToString(tex, {
      displayMode: display, output: 'htmlAndMathml',
      throwOnError: false, trust: false, strict: 'ignore',
      maxExpand: 100, maxSize: 20,
    });
  } catch {
    return null;
  }
}
