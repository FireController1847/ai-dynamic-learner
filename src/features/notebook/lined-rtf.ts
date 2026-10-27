import type { LinedData } from './document-types.ts';
import type { TextPage } from './lined-pagination.ts';
import type { LinedDisplay } from './display-options.ts';

type PageRanges = { text: TextPage[]; marginText: TextPage[] };

// Encode RTF syntax and UTF-16 code units; no raw user text becomes an RTF command.
function escapeRtf(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[\\{}]|[^\x20-\x7e]/g, (character) => {
    if (character === '\\' || character === '{' || character === '}') return '\\' + character;
    if (character === '\n') return '\\line ';
    if (character === '\t') return '\\tab ';
    const codeUnit = character.charCodeAt(0);
    return '\\u' + (codeUnit > 32767 ? codeUnit - 65536 : codeUnit) + '?';
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
  return pages.length && end === text.length ? pages : [{ start: 0, end: text.length }];
}

/**
 * Pair each logical writing row with its left-margin indicator.
 * Empty lines remain rows so intentionally spaced numbers and letters keep their positions.
 * Soft-wrapped text can reflow differently in a word processor, but each indicator
 * stays beside the right-hand line it introduces instead of becoming a detached section.
 */
function pageRows(left: string, right: string): { indicator: string; text: string }[] {
  const indicators = left.replace(/\r\n?/g, '\n').split('\n');
  const notes = right.replace(/\r\n?/g, '\n').split('\n');
  return Array.from({ length: Math.max(indicators.length, notes.length) }, (_, index) => ({
    indicator: indicators[index] ?? '',
    text: notes[index] ?? '',
  }));
}

/** Export visible pages into an editable RTF with aligned margin and main-writing columns. */
export function linedPaperRtf(data: LinedData, ranges: PageRanges, options: LinedDisplay): string {
  const main = data.text;
  const margin = data.marginText ?? '';
  const mainPages = usablePages(main, ranges.text);
  const marginPages = usablePages(margin, ranges.marginText);
  const count = Math.max(mainPages.length, marginPages.length, 1 + (data.additionalTitles?.length ?? 0));

  const paperWidth = options.size === 'a4' ? 11907 : 12240;
  const paperHeight = options.size === 'a4' ? 16840 : 15840;
  const contentWidth = paperWidth - 1440; // half-inch side margins
  const marginWidth = 1080; // right-hand writing starts at 1.25 inches
  const font = options.font === 'sans' ? 1 : options.font === 'mono' ? 2 : 0;
  const ink = options.ink === 'blue' ? 3 : options.ink === 'dark' ? 2 : 1;
  const fontSize = Math.round(24 * options.textSize / 100); // half-points
  const rowHeight = options.ruling === 'wide' ? 495 : 405; // twips per ruled row
  const output = [
    '{\\rtf1\\ansi\\deff0\\uc1',
    '{\\fonttbl{\\f0\\froman Georgia;}{\\f1\\fswiss Arial;}{\\f2\\fmodern Consolas;}}',
    '{\\colortbl ;\\red70\\green70\\blue70;\\red0\\green0\\blue0;\\red35\\green74\\blue125;\\red199\\green95\\blue105;\\red174\\green204\\blue229;}',
    '\\paperw' + paperWidth + '\\paperh' + paperHeight,
    '\\margl720\\margr720\\margt720\\margb720 ',
  ];

  for (let page = 0; page < count; page++) {
    if (page) output.push('\\pard\\page ');
    const title = page === 0 ? data.title ?? '' : data.additionalTitles?.[page - 1] ?? '';
    if (title) {
      output.push('\\pard\\keepn\\li' + marginWidth + '\\f' + font + '\\cf' + ink
        + '\\b\\fs' + Math.max(fontSize + 6, 30) + ' ' + escapeRtf(title) + '\\b0\\par ');
    }

    const bodyRange = mainPages[page];
    const marginRange = marginPages[page];
    const body = bodyRange ? main.slice(bodyRange.start, bodyRange.end) : '';
    const annotations = marginRange ? margin.slice(marginRange.start, marginRange.end) : '';

    for (const row of pageRows(annotations, body)) {
      // Borderless RTF tables also preserve the side-by-side relationship when
      // a word processor wraps longer writing inside the right column.
      output.push('\\trowd\\trgaph40\\trleft0\\trrh' + rowHeight,
        '\\clbrdrr\\brdrs\\brdrw7\\brdrcf4\\clbrdrb\\brdrs\\brdrw4\\brdrcf5\\cellx' + marginWidth,
        '\\clbrdrb\\brdrs\\brdrw4\\brdrcf5\\cellx' + contentWidth,
        '\\pard\\intbl\\qr\\ri100\\sl' + rowHeight + '\\slmult0\\f' + font
          + '\\cf' + ink + '\\fs' + fontSize + ' ' + escapeRtf(row.indicator) + '\\cell ',
        '\\pard\\intbl\\ql\\li100\\sl' + rowHeight + '\\slmult0\\f' + font
          + '\\cf' + ink + '\\fs' + fontSize + ' ' + escapeRtf(row.text) + '\\cell\\row ');
    }
  }

  output.push('}');
  return output.join('');
}
