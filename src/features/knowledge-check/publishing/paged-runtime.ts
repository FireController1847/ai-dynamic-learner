import { PUBLICATION_FONTS, publicationPaperDimensions, publicationHasCover, validatePublicationSettings, type PublicationSettings, type PublicationView } from './publication-model.ts';
import { attachPublicationViewport, type PublicationZoom } from './publication-viewport.ts';

interface PagedFlow { total: number }
interface PagedPreviewer {
  preview(content: DocumentFragment, styles: Record<string, string>[], target: HTMLElement): Promise<PagedFlow>;
}
interface PagedWindow extends Window {
  Paged?: { Previewer: new () => PagedPreviewer };
}
export interface PaginatedPublication {
  readonly frame: HTMLIFrameElement;
  readonly pageCount: number;
  setZoom(zoom: PublicationZoom): void;
  getZoom(): number;
  /** Reveal only after the caller has applied zoom and restored scroll position. */
  reveal(): Promise<void>;
  /** Release the entire pagination realm, including Paged.js styles and handlers. */
  dispose(): void;
}
export interface PublicationRenderer {
  /** Use text nodes/shared sanitized Markdown; never interpolate authored HTML. */
  content(view: PublicationView, document: Document): DocumentFragment;
  /** Self-contained publication CSS, independent of the app's theme and chrome. */
  styles: readonly string[];
}

export function publicationPageStyles(settings: PublicationSettings): string {
  validatePublicationSettings(settings);
  const paper = publicationPaperDimensions(settings);
  const font = PUBLICATION_FONTS.find(font => font.id === settings.font)!;
  const marginMm = settings.margin === 'standard' ? 20 : 12;
  const margin = `${marginMm}mm`;
  // Leave a few millimetres of safety room for Paged.js rounding/fragmentation.
  const coverHeight = paper.height - 2 * marginMm - 4;
  const coverPageNumber = publicationHasCover(settings)
    ? '@page :first { @bottom-center { content: none; } }'
    : '';
  return `@page {
    size: ${paper.width}mm ${paper.height}mm; margin: ${margin};
    @bottom-center { content: counter(page); font: ${settings.fontSize}pt ${font.css}; }
  }
  ${coverPageNumber}
  html { color-scheme: light; }
  body { margin: 0; color: #000; background: #fff; font: ${settings.fontSize}pt/1.4 ${font.css};
    --publication-cover-height: ${coverHeight}mm;
    --publication-header-rise: ${marginMm / 2}mm;
    --publication-header-outset: ${marginMm / 3}mm; }
  img, table { max-width: 100%; }
  img { height: auto; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  h1, h2, h3 { break-after: avoid; }
  p { orphans: 3; widows: 3; }
  [data-publication-question] { break-inside: avoid; }`;
}

/**
 * On-demand Paged.js Previewer, NOT its auto-running polyfill. A fresh iframe
 * gives each run its own global document: Paged.js 0.4.x injects styles and uses
 * global DOM APIs even when renderTo is supplied. No script/styles touch the app.
 *
 * Renderers supply content/CSS. The frame stays visually hidden while layout
 * runs; callers apply zoom/scroll, reveal it, and dispose the previous frame.
 * This adapter does not open print dialogs, download files or upload content.
 * Keep the host visible for layout and dispose on close/replacement.
 */
export async function paginatePublication(
  host: HTMLElement, view: PublicationView, renderer: PublicationRenderer, signal?: AbortSignal,
): Promise<PaginatedPublication> {
  signal?.throwIfAborted();
  validatePublicationSettings(view.settings);
  if (!host.isConnected) throw new Error('Attach the publication preview before paginating.');
  const frame = document.createElement('iframe');
  frame.title = `${view.title} — publication preview`;
  // Opacity preserves layout measurements while hiding partially paginated pages.
  frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#eef0f3;opacity:0;pointer-events:none';
  frame.inert = true;
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  host.append(frame);
  let rejectCancellation: (reason: unknown) => void = () => {};
  let disposed = false;
  let viewport: ReturnType<typeof attachPublicationViewport> | null = null;
  let entrance: Animation | null = null;
  function checkActive() {
    signal?.throwIfAborted();
    if (disposed) throw new DOMException('Pagination cancelled.', 'AbortError');
  }
  const cancelled = new Promise<never>((_resolve, reject) => { rejectCancellation = reject; });
  const dispose = () => {
    disposed = true;
    entrance?.cancel(); entrance = null;
    viewport?.dispose(); viewport = null;
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
    frame.remove();
  };
  const abort = () => {
    rejectCancellation(signal?.reason ?? new DOMException('Pagination cancelled.', 'AbortError'));
    dispose();
  };
  const timeout = window.setTimeout(() => {
    rejectCancellation(new Error('Pagination took too long. Try a smaller document.'));
    dispose();
  }, 120_000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const work = async () => {
      const doc = frame.contentDocument;
      const realm = frame.contentWindow as PagedWindow | null;
      if (!doc || !realm) throw new Error('The publication preview could not be opened.');
      doc.title = view.title;
      doc.documentElement.lang = document.documentElement.lang || 'en';
      const base = doc.createElement('base');
      base.href = document.baseURI;
      doc.head.append(base);
      await new Promise<void>((resolve, reject) => {
        const script = doc.createElement('script');
        // Webpack emits this pinned browser bundle as a local asset; no CDN.
        script.src = new URL('../../../../node_modules/pagedjs/dist/paged.js', import.meta.url).href;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Paged.js could not be loaded.'));
        doc.head.append(script);
      });
      checkActive();
      if (!realm.Paged) throw new Error('Paged.js did not initialize.');
      const content = renderer.content(view, doc);
      // Paged.js must receive nodes owned by its own document/realm.
      const fragment = doc.importNode(content, true);
      fragment.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
      const styles = [publicationPageStyles(view.settings), ...renderer.styles].join('\n');
      const flow = await new realm.Paged.Previewer().preview(fragment, [{ [base.href]: styles }], doc.body);
      await doc.fonts.ready;
      checkActive();
      if (!Number.isSafeInteger(flow.total) || flow.total < 1) throw new Error('No publication pages were produced.');
      return flow.total;
    };
    const pageCount = await Promise.race([work(), cancelled]);
    viewport = attachPublicationViewport(frame);
    clearTimeout(timeout);
    return { frame, pageCount, setZoom: zoom => viewport?.setZoom(zoom), getZoom: () => viewport?.getZoom() ?? 1,
      async reveal() {
        checkActive();
        frame.style.opacity = '1';
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          entrance = frame.animate([{ opacity: 0, transform: 'translateY(8px)' },
            { opacity: 1, transform: 'translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
          try { await entrance.finished; } catch { checkActive(); }
          entrance = null;
        }
        checkActive();
        frame.style.pointerEvents = '';
        frame.inert = false; frame.tabIndex = 0; frame.removeAttribute('aria-hidden');
      }, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
