import { ref } from 'vue';
import { cameraAt, insideGraph, paperPosition, zoomGraphAt, type GraphPosition } from './graph-camera.ts';
import { graphZoom, MAX_GRAPH_ZOOM, MIN_GRAPH_ZOOM, type GraphView } from './graph-model.ts';
import { coordinateAt, type PaperGeometry } from './graph-scene.ts';

interface GestureOptions {
  paper(): PaperGeometry; view(): GraphView; enabled(): boolean; wheelPan(): boolean;
  updateView(view: GraphView): void; interrupt(): void; queue(action: () => void): void; flush(): void;
}
interface Finger extends GraphPosition { svg: SVGSVGElement }
interface Pinch { ids: [number, number]; view: GraphView; world: GraphPosition; distance: number }
interface Scroll { start: GraphPosition; x: HTMLElement | null; y: HTMLElement | null; left: number; top: number }
interface NativePinch { svg: SVGSVGElement; view: GraphView; point: GraphPosition; scale: number }

function scrollParent(svg: SVGSVGElement, axis: 'x' | 'y'): HTMLElement | null {
  for (let element = svg.parentElement; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    const overflow = axis === 'x' ? style.overflowX : style.overflowY;
    const excess = axis === 'x' ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight;
    if (/(auto|scroll)/.test(overflow) && excess > 1) return element;
  }
  return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
}

export function useGraphGestures(options: GestureOptions) {
  const active = ref(false);
  const fingers = new Map<number, Finger>();
  let pinch: Pinch | null = null, scroll: Scroll | null = null, blocked = false;
  let nativePinch: NativePinch | null = null;
  let cursor: GraphPosition | null = null;
  let wheelPercent = 100, wheelTime = 0, publishedZoom = 100;
  const client = (event: MouseEvent): GraphPosition => ({ x: event.clientX, y: event.clientY });
  function pair() {
    const ids = [...fingers.keys()];
    const first = fingers.get(ids[0]!), second = fingers.get(ids[1]!);
    if (!first || !second) return null;
    return { ids: [ids[0]!, ids[1]!] as [number, number], first, second,
      middle: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)) };
  }
  function startPinch() {
    const current = pair();
    if (!current) return;
    options.interrupt(); scroll = null; nativePinch = null; blocked = true; active.value = true;
    const view = { ...options.view() };
    const at = paperPosition(current.first.svg, options.paper(), current.middle);
    pinch = { ids: current.ids, view, distance: current.distance, world: coordinateAt(at, options.paper(), view) };
  }
  function begin(event: PointerEvent, allowScroll: boolean): boolean {
    if (event.pointerType !== 'touch' || !(event.currentTarget instanceof SVGSVGElement)) return false;
    fingers.set(event.pointerId, { ...client(event), svg: event.currentTarget });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (fingers.size >= 2) {
      event.preventDefault();
      if (!pinch) startPinch();
      return true;
    }
    if (allowScroll) {
      const x = scrollParent(event.currentTarget, 'x'), y = scrollParent(event.currentTarget, 'y');
      scroll = { start: client(event), x, y, left: x?.scrollLeft ?? 0, top: y?.scrollTop ?? 0 };
      return true;
    }
    return blocked;
  }
  function move(event: PointerEvent): boolean {
    if (event.pointerType !== 'touch') { cursor = client(event); return false; }
    const finger = fingers.get(event.pointerId);
    if (!finger) return false;
    fingers.set(event.pointerId, { ...finger, ...client(event) });
    if (pinch) {
      const first = fingers.get(pinch.ids[0]), second = fingers.get(pinch.ids[1]);
      if (first && second) {
        const middle = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
        const distance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
        const at = paperPosition(first.svg, options.paper(), middle);
        const view = cameraAt(options.paper(), pinch.view, pinch.world, at, graphZoom(pinch.view) * distance / pinch.distance);
        options.queue(() => options.updateView(view));
      }
      event.preventDefault(); return true;
    }
    if (scroll) {
      const current = scroll;
      const dx = event.clientX - current.start.x, dy = event.clientY - current.start.y;
      options.queue(() => {
        if (current.x) current.x.scrollLeft = current.left - dx;
        if (current.y) current.y.scrollTop = current.top - dy;
      });
      event.preventDefault(); return true;
    }
    return blocked;
  }
  function end(event: PointerEvent): boolean {
    const finger = fingers.get(event.pointerId);
    if (!finger) return false;
    const handled = blocked || !!scroll;
    if (event.type === 'pointerup') move(event);
    options.flush(); fingers.delete(event.pointerId);
    // Keep the remaining finger inert until all fingers lift, avoiding accidental drawing.
    if (pinch) { pinch = null; if (fingers.size >= 2) startPinch(); }
    if (!fingers.size) { scroll = null; blocked = false; active.value = false; }
    if (handled && finger.svg.hasPointerCapture(event.pointerId)) finger.svg.releasePointerCapture(event.pointerId);
    return handled;
  }
  function reset() {
    const previous = [...fingers.entries()];
    fingers.clear(); pinch = null; scroll = null; blocked = false; active.value = false; nativePinch = null;
    for (const [id, finger] of previous) if (finger.svg.hasPointerCapture(id)) finger.svg.releasePointerCapture(id);
    wheelTime = 0; cursor = null;
  }
  function wheel(event: WheelEvent) {
    if (!options.enabled() || !(event.currentTarget instanceof SVGSVGElement)) return;
    const at = paperPosition(event.currentTarget, options.paper(), client(event));
    if (!insideGraph(options.paper(), at) || (!event.ctrlKey && !options.wheelPan())) return;
    event.preventDefault();
    if (nativePinch || fingers.size) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? event.currentTarget.clientHeight : 1;
    if (event.ctrlKey) {
      const now = performance.now(), original = options.view();
      if (now - wheelTime > 180 || graphZoom(original) !== publishedZoom) wheelPercent = graphZoom(original);
      wheelTime = now;
      const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
      wheelPercent = Math.max(MIN_GRAPH_ZOOM, Math.min(MAX_GRAPH_ZOOM, wheelPercent * Math.exp(-delta / 240)));
      const view = zoomGraphAt(options.paper(), original, at, wheelPercent);
      publishedZoom = graphZoom(view);
      options.updateView(view);
    } else {
      const rect = event.currentTarget.getBoundingClientRect(), paper = options.paper(), original = options.view();
      const target = { x: at.x - event.deltaX * unit * paper.width / rect.width,
        y: at.y - event.deltaY * unit * paper.height / rect.height };
      options.updateView(cameraAt(paper, original, coordinateAt(at, paper, original), target, graphZoom(original)));
    }
  }
  function nativePoint(event: Event): { svg: SVGSVGElement; point: GraphPosition } | null {
    if (!(event.currentTarget instanceof SVGSVGElement)) return null;
    const x: unknown = Reflect.get(event, 'clientX'), y: unknown = Reflect.get(event, 'clientY');
    const candidates: GraphPosition[] = [];
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) candidates.push({ x, y });
    if (cursor) candidates.push(cursor);
    for (const position of candidates) {
      const point = paperPosition(event.currentTarget, options.paper(), position);
      if (insideGraph(options.paper(), point)) return { svg: event.currentTarget, point };
    }
    return null;
  }
  function gestureStart(event: Event) {
    if (!options.enabled()) return;
    if (fingers.size) { event.preventDefault(); return; }
    const at = nativePoint(event), scale: unknown = Reflect.get(event, 'scale');
    if (!at || typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return;
    event.preventDefault();
    nativePinch = { ...at, view: { ...options.view() }, scale };
  }
  function gestureChange(event: Event) {
    if (fingers.size) { event.preventDefault(); return; }
    if (!nativePinch) return;
    event.preventDefault();
    const scale: unknown = Reflect.get(event, 'scale');
    if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) {
      options.updateView(zoomGraphAt(options.paper(), nativePinch.view, nativePinch.point,
        graphZoom(nativePinch.view) * scale / nativePinch.scale));
    }
  }
  return { active, begin, move, end, reset, wheel, gestureStart, gestureChange,
    gestureEnd: () => { nativePinch = null; } };
}
