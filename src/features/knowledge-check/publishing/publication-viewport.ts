export type PublicationZoom = 'page' | 'fit' | number;

/** Screen-only zoom: page dimensions, content wrapping, and print output stay fixed. */
export function attachPublicationViewport(frame: HTMLIFrameElement) {
  const document = frame.contentDocument;
  const found = document?.querySelector<HTMLElement>('.pagedjs_pages');
  if (!document || !found) throw new Error('The publication pages could not be displayed.');
  const pages: HTMLElement = found;
  const style = document.createElement('style');
  // Add viewer chrome AFTER pagination, directly to the iframe. Paged.js's
  // PrintMedia handler drops @media screen and promotes @media print rules when
  // processing publication CSS, which would erase the canvas, gaps and shadows.
  style.textContent = `@media screen {
    html, body { margin: 0; background: #eef0f3; }
    .pagedjs_pages { box-sizing: border-box; padding: 40px; width: max-content; }
    .pagedjs_page {
      margin: 0 auto 40px; background: #fff; outline: 1px solid #949ca9;
      box-shadow: 0 4px 16px #0005;
    }
    .pagedjs_sheet { background: #fff; }
    .publication-preview-stage { position: relative; margin: 0 auto; transition: width 180ms ease, height 180ms ease; }
    .publication-preview-stage > .pagedjs_pages {
      position: absolute; top: 0; left: 0; transform-origin: top left;
      width: var(--publication-canvas-width);
      transition: transform 180ms ease;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .publication-preview-stage, .publication-preview-stage > .pagedjs_pages { transition: none; }
  }
  @media print {
    html, body { background: #fff; }
    .pagedjs_pages { padding: 0; margin: 0; width: auto; min-width: 0; }
    .pagedjs_page { margin: 0; box-shadow: none; outline: none; }
    .publication-preview-stage { display: contents; transition: none; }
    .publication-preview-stage > .pagedjs_pages { position: static; transform: none !important; transition: none; }
  }`;
  document.head.append(style);
  // Measure only after applying viewer styles: the natural canvas width must
  // include a physical sheet and its gutters, rather than the iframe width.
  const bounds = pages.getBoundingClientRect();
  const width = bounds.width, height = Math.max(bounds.height, pages.scrollHeight);
  const firstPage = pages.querySelector<HTMLElement>('.pagedjs_page');
  const pageHeight = (firstPage?.getBoundingClientRect().height ?? height) + 120;
  if (width <= 0 || height <= 0) { style.remove(); throw new Error('The publication preview has no visible size.'); }
  const stage = document.createElement('div');
  stage.className = 'publication-preview-stage';
  pages.replaceWith(stage);
  stage.append(pages);
  let zoom: PublicationZoom = 'fit';
  let scale = 1;
  function update() {
    const fitWidth = Math.max(0.1, (frame.clientWidth - 48) / width);
    const fitPage = Math.max(0.1, (frame.clientHeight - 32) / pageHeight);
    scale = zoom === 'page' ? Math.min(1, fitWidth, fitPage) : zoom === 'fit' ? Math.min(1, fitWidth) : zoom;
    stage.style.width = `${Math.ceil(width * scale)}px`;
    stage.style.height = `${Math.ceil(height * scale)}px`;
    pages.style.setProperty('--publication-canvas-width', `${width}px`);
    pages.style.transform = `scale(${scale})`;
  }
  const observer = new ResizeObserver(update);
  observer.observe(frame);
  update();
  return {
    setZoom(value: PublicationZoom) {
      if (typeof value === 'number' && (!Number.isFinite(value) || value < 0.25 || value > 2)) return;
      zoom = value; update();
    },
    getZoom() { return scale; },
    dispose() { observer.disconnect(); style.remove(); },
  };
}
