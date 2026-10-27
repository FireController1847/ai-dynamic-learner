import type { LinedData } from './document-types.ts';
import type { TextPage } from './lined-pagination.ts';

type PageRanges = { text: TextPage[]; marginText: TextPage[] };

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

function pairedLines(margin: string, main: string): string[] {
  const left = margin.replace(/\r\n?/g, '\n').split('\n');
  const right = main.replace(/\r\n?/g, '\n').split('\n');
  const width = Math.max(0, ...left.map(value => value.length));
  const lines: string[] = [];

  for (let line = 0; line < Math.max(left.length, right.length); line++) {
    const indicator = left[line] ?? '';
    const text = right[line] ?? '';
    lines.push(indicator && text
      ? indicator.padEnd(width) + '  ' + text
      : indicator || (width && text ? ' '.repeat(width + 2) + text : text));
  }
  return lines;
}

/** Plain-text download: put margin indicators beside their matching note lines. */
export function linedPaperText(data: LinedData, ranges: PageRanges): string {
  const textPages = usablePages(data.text, ranges.text);
  const marginText = data.marginText ?? '';
  const marginPages = usablePages(marginText, ranges.marginText);
  const pageCount = Math.max(textPages.length, marginPages.length, 1 + (data.additionalTitles?.length ?? 0));
  const pages: string[] = [];

  for (let page = 0; page < pageCount; page++) {
    const title = page === 0 ? data.title ?? '' : data.additionalTitles?.[page - 1] ?? '';
    const text = textPages[page]
      ? data.text.slice(textPages[page]!.start, textPages[page]!.end) : '';
    const margin = marginPages[page]
      ? marginText.slice(marginPages[page]!.start, marginPages[page]!.end) : '';
    const lines = pairedLines(margin, text);
    // Leave intentional empty rows inside each page, but not an extra empty row at its end.
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    pages.push([...(title ? [title, ''] : []), ...lines].join('\n'));
  }

  return pages.join('\n\n') + '\n';
}
