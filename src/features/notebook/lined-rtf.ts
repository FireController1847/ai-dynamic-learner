import type { LinedData } from './document-types.ts';
import type { TextPage } from './lined-pagination.ts';
import type { LinedDisplay } from './display-options.ts';

type PageRanges = { text: TextPage[]; marginText: TextPage[] };

// RTF control characters and Unicode must be encoded rather than inserted as raw text.
function escapeRtf(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[\\{}]|[^\x20-\x7e]/g, (character) => {
    if (character === '\\' || character === '{' || character === '}') return '\\' + character;
    if (character === '\n') return '\\line ';
    if (character === '\t') return '\\tab ';
    const codeUnit = character.charCodeAt(0);
    const signed = codeUnit > 32767 ? codeUnit - 65536 : codeUnit;
    return '\\u' + signed + '?';
  });
}

function usablePages(text: string, pages: TextPage[]): TextPage[] {
  let end = 0;
  for (const page of pages) {
    if (page.start !== end || page.end < end || page.end > text.length) {
      return [{ start: 0, end: text.length }];
    }
    end = page.end;
  }
  return pages.length > 0 && end === text.length ? pages : [{ start: 0, end: text.length }];
}

/** Export currently visible page divisions without mutating the saved Notebook document. */
export function linedPaperRtf(data: LinedData, ranges: PageRanges, options: LinedDisplay): string {
  const main = data.text;
  const margin = data.marginText ?? '';
  const mainPages = usablePages(main, ranges.text);
  const marginPages = usablePages(margin, ranges.marginText);
  const count = Math.max(mainPages.length, marginPages.length, 1 + (data.additionalTitles?.length ?? 0));
  const paper = options.size === 'a4' ? '\\paperw11907\\paperh16840' : '\\paperw12240\\paperh15840';
  const output = [
    '{\\rtf1\\ansi\\deff0\\uc1',
    '{\\fonttbl{\\f0\\fnil Georgia;}}',
    paper,
    '\\margl1440\\margr1440\\margt1440\\margb1440\\f0\\fs24 ',
  ];

  for (let index = 0; index < count; index++) {
    if (index > 0) output.push('\\page ');
    const title = index === 0 ? data.title ?? '' : data.additionalTitles?.[index - 1] ?? '';
    const textRange = mainPages[index];
    const marginRange = marginPages[index];
    const body = textRange ? main.slice(textRange.start, textRange.end) : '';
    const notes = marginRange ? margin.slice(marginRange.start, marginRange.end) : '';

    if (title) output.push('{\\pard\\b\\fs32 ', escapeRtf(title), '\\par}');
    if (body) output.push('{\\pard\\fs24 ', escapeRtf(body), '\\par}');
    if (notes) output.push('{\\pard\\i\\fs20 Margin notes: ', escapeRtf(notes), '\\par}');
    if (!title && !body && !notes) output.push('\\pard\\par ');
  }

  output.push('}');
  return output.join('');
}
