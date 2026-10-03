import { onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue';
import {
  boundedGraphCoordinate, graphZoom, nextGraphZoom,
  type GraphColor, type GraphDivision, type GraphSelection, type GraphView, type GraphVisual,
} from './graph-model.ts';
import { coordinateAt, graphCellSize, type PaperGeometry } from './graph-scene.ts';
import { zoomGraphAt } from './graph-camera.ts';
import { useGraphGestures } from './graph-gestures.ts';
import { cloneGraphVisual, connectGraphPoints, hitGraphVisual, newGraphPoint, placeGraphPoint, removeGraphSelection } from './graph-visual.ts';

export type GraphTool = 'select' | 'point' | 'connect' | 'erase' | 'pan' | 'zoom';
interface Position { x: number; y: number }
interface Interaction {
  paper(): PaperGeometry; view(): GraphView; visual(): GraphVisual; tool(): GraphTool;
  selection(): GraphSelection; color(): GraphColor; snap(): boolean; snapDivisions(): GraphDivision;
  scrubby(): boolean; enabled(): boolean;
  updateView(view: GraphView): void; updateVisual(visual: GraphVisual): void;
  select(selection: GraphSelection): void; coordinate(position: Position | null): void;
  message(message: string): void; beginEdit(): void; endEdit(): void; openOptions(): void;
}
interface Gesture {
  id: number; svg: SVGSVGElement; start: Position; clientX: number; clientY: number;
  view: GraphView; button: number; moved: boolean; kind: GraphTool;
  pointId?: string; pointStart?: Position; before?: GraphVisual; previousAnchor?: string | null;
  previousSelection: GraphSelection;
  target: GraphSelection;
}

export function useGraphInteraction(options: Interaction) {
  // Emitted props settle on Vue's next render; gestures need their latest edits immediately.
  const workingVisual = shallowRef(options.visual());
  const workingView = shallowRef(options.view());
  const visual = () => workingVisual.value;
  const view = () => workingView.value;
  function updateVisual(value: GraphVisual) { workingVisual.value = value; options.updateVisual(value); }
  function updateView(value: GraphView) { workingView.value = value; options.updateView(value); }
  watch(options.visual, value => { workingVisual.value = value; }, { flush: 'sync' });
  watch(options.view, value => { workingView.value = value; }, { flush: 'sync' });
  const dragging = ref(false);
  const connectionAnchor = ref<string | null>(null);
  const hover = ref<Position | null>(null);
  let gesture: Gesture | null = null;
  let frame = 0;
  let pending: (() => void) | null = null;
  let longPress = 0;
  function clearLongPress() { window.clearTimeout(longPress); longPress = 0; }
  const navigation = useGraphGestures({
    paper: options.paper, view, enabled: options.enabled, wheelPan: () => options.tool() === 'pan', updateView,
    interrupt: () => cleanup(true, true), queue, flush,
  });
  function flush() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    const action = pending;
    pending = null;
    action?.();
  }
  function queue(action: () => void) {
    pending = action;
    if (!frame) frame = requestAnimationFrame(flush);
  }
  function position(event: MouseEvent): Position | null {
    if (!(event.currentTarget instanceof SVGSVGElement)) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const paper = options.paper();
    return rect.width && rect.height ? { x: (event.clientX - rect.left) * paper.width / rect.width,
      y: (event.clientY - rect.top) * paper.height / rect.height } : null;
  }
  function hit(at: Position, event: MouseEvent): GraphSelection {
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const radius = Math.max((event instanceof PointerEvent && event.pointerType === 'touch' ? 22 : 11) * options.paper().width / rect.width,
      8 * graphZoom(view()) / 100);
    return hitGraphVisual(at, visual(), options.paper(), view(), radius);
  }
  function report(error: unknown) { options.message(error instanceof Error ? error.message : 'This drawing could not be changed.'); }
  function addPoint(at: Position): string {
    const world = coordinateAt(at, options.paper(), view());
    const point = newGraphPoint(visual(), placeGraphPoint(world.x, world.y, view(), options.snap(), options.snapDivisions()), options.color());
    updateVisual({ ...visual(), points: [...visual().points, point] });
    return point.id;
  }
  function movePoint(id: string, world: Position) {
    const placed = placeGraphPoint(world.x, world.y, view(), options.snap(), options.snapDivisions());
    updateVisual({ ...visual(), points: visual().points.map(point => point.id === id ? { ...point, ...placed } : point) });
  }
  function zoomAt(at: Position, original: GraphView, percent: number): GraphView {
    return zoomGraphAt(options.paper(), original, at, percent);
  }
  function cleanup(cancelled = false, retainCapture = false) {
    clearLongPress();
    const current = gesture;
    gesture = null;
    if (cancelled && current?.before) {
      if (frame) cancelAnimationFrame(frame);
      pending = null; frame = 0;
      updateVisual(current.before);
      options.select(current.previousSelection);
      connectionAnchor.value = current.previousAnchor ?? null;
    } else flush();
    if (current?.before) options.endEdit();
    if (!retainCapture && current?.svg.hasPointerCapture(current.id)) current.svg.releasePointerCapture(current.id);
    dragging.value = false;
    hover.value = null;
  }
  onBeforeUnmount(() => { cleanup(); navigation.reset(); });
  onDeactivated(() => { cleanup(); navigation.reset(); connectionAnchor.value = null; });
  watch(() => [options.tool(), options.enabled()], () => {
    cleanup(); navigation.reset(); connectionAnchor.value = null;
  });
  function begin(event: PointerEvent) {
    const at = position(event), paper = options.paper(), tool = options.tool();
    if (!options.enabled() || !at ||
        (event.button !== 0 && !(tool === 'zoom' && event.button === 2)) ||
        at.x < paper.left || at.x > paper.left + paper.plotWidth ||
        at.y < paper.top || at.y > paper.top + paper.plotHeight ||
        !(event.currentTarget instanceof SVGSVGElement)) return;
    const previousSelection = options.selection();
    const selected = hit(at, event);
    if (event.button === 2 && selected) return;
    const scrollBlank = tool === 'select' && !selected;
    if (navigation.begin(event, scrollBlank)) { if (scrollBlank) options.select(null); return; }
    if (!event.isPrimary || gesture) return;
    if (tool === 'select') {
      options.select(selected);
      if (selected?.kind !== 'point') return;
    }
    if (tool === 'erase' && event.pointerType !== 'touch') {
      if (selected) {
        event.preventDefault(); options.beginEdit();
        updateVisual(removeGraphSelection(visual(), selected));
        options.select(null); options.endEdit();
      }
      return;
    }
    if (tool === 'erase' && !selected) return;
    event.preventDefault();
    event.currentTarget.focus();
    const before = ['select', 'point', 'connect', 'erase'].includes(tool) ? cloneGraphVisual(visual()) : undefined;
    if (before) options.beginEdit();
    try {
      const pointId = tool === 'point' || tool === 'connect'
        ? selected?.kind === 'point' ? selected.id : addPoint(at)
        : selected?.kind === 'point' ? selected.id : undefined;
      if (pointId) options.select({ kind: 'point', id: pointId });
      const pointStart = visual().points.find(point => point.id === pointId);
      const dragStart = tool === 'point' && selected?.kind !== 'point'
        ? coordinateAt(at, paper, view()) : pointStart;
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture = { id: event.pointerId, svg: event.currentTarget, start: at, clientX: event.clientX, clientY: event.clientY,
        view: { ...view() }, button: event.button, moved: false, kind: tool,
        pointId, pointStart: dragStart ? { x: dragStart.x, y: dragStart.y } : undefined,
        before, previousAnchor: connectionAnchor.value, previousSelection, target: selected };
      if (tool === 'connect') connectionAnchor.value = pointId ?? null;
      dragging.value = true;
      if (event.pointerType === 'touch' && selected?.kind === 'point' && tool === 'select') {
        longPress = window.setTimeout(() => {
          if (gesture?.id !== event.pointerId || gesture.moved) return;
          cleanup(true); options.select(selected); options.openOptions();
        }, 550);
      }
    } catch (error) {
      if (before) { updateVisual(before); options.endEdit(); }
      report(error);
    }
  }
  function move(event: PointerEvent) {
    if (navigation.move(event)) return;
    const at = position(event);
    if (!at) return;
    const paper = options.paper();
    hover.value = at;
    const inside = at.x >= paper.left && at.x <= paper.left + paper.plotWidth &&
      at.y >= paper.top && at.y <= paper.top + paper.plotHeight;
    options.coordinate(inside ? coordinateAt(at, paper, view()) : null);
    const current = gesture;
    if (!current || current.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY) > 4) { current.moved = true; clearLongPress(); }
    if (current.kind === 'pan') {
      const scale = current.view.unitsPerSquare / graphCellSize(paper, current.view);
      const view = { ...current.view,
        centerX: boundedGraphCoordinate(current.view.centerX - (at.x - current.start.x) * scale),
        centerY: boundedGraphCoordinate(current.view.centerY + (at.y - current.start.y) * scale) };
      queue(() => updateView(view));
    } else if (current.kind === 'zoom' && current.moved && options.scrubby()) {
      const view = zoomAt(current.start, current.view, graphZoom(current.view) * Math.exp((event.clientX - current.clientX) / 240));
      queue(() => updateView(view));
    } else if ((current.kind === 'select' || current.kind === 'point') && current.pointId && current.pointStart && current.moved) {
      const start = coordinateAt(current.start, paper, current.view);
      const world = coordinateAt(at, paper, current.view);
      const target = { x: current.pointStart.x + world.x - start.x, y: current.pointStart.y + world.y - start.y };
      queue(() => movePoint(current.pointId!, target));
    }
  }
  function end(event: PointerEvent) {
    if (navigation.end(event)) return;
    const current = gesture;
    if (!current || current.id !== event.pointerId) return;
    move(event); flush();
    try {
      if (current.kind === 'zoom' && (!current.moved || !options.scrubby())) {
        updateView(zoomAt(current.start, current.view, nextGraphZoom(current.view, current.button === 2 ? -1 : 1)));
      } else if (current.kind === 'erase' && !current.moved && current.target) {
        updateVisual(removeGraphSelection(visual(), current.target)); options.select(null);
      } else if (current.kind === 'connect' && current.pointId) {
        const at = position(event) ?? current.start;
        const target = current.moved ? hit(at, event) : null;
        const destination = current.moved ? target?.kind === 'point' ? target.id : addPoint(at) : current.pointId;
        const from = current.moved ? current.pointId : current.previousAnchor;
        if (from && visual().points.some(point => point.id === from)) {
          updateVisual(connectGraphPoints(visual(), from, destination, options.color()));
        }
        connectionAnchor.value = destination;
        options.select({ kind: 'point', id: destination });
      }
    } catch (error) { report(error); }
    cleanup();
  }
  function keydown(event: KeyboardEvent) {
    if (!options.enabled()) return;
    if (event.key === 'Escape') { cleanup(true); navigation.reset(); connectionAnchor.value = null; options.select(null); return; }
    if (event.key === 'Enter') { connectionAnchor.value = null; return; }
    const selected = options.selection();
    if (selected && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
      event.preventDefault(); cleanup(true); navigation.reset(); connectionAnchor.value = null;
      options.select(selected); options.openOptions(); return;
    }
    if (selected && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault(); options.beginEdit();
      updateVisual(removeGraphSelection(visual(), selected));
      options.select(null); connectionAnchor.value = null; options.endEdit(); return;
    }
    const directions: Record<string, readonly [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const direction = directions[event.key];
    if (!direction) return;
    const step = view().unitsPerSquare * (event.shiftKey ? 5 : 1);
    if (selected?.kind === 'point' && options.tool() === 'select') {
      const point = visual().points.find(point => point.id === selected.id);
      if (!point) return;
      event.preventDefault(); options.beginEdit();
      const precisionStep = step / options.snapDivisions();
      movePoint(point.id, { x: point.x + direction[0] * precisionStep, y: point.y + direction[1] * precisionStep });
      options.endEdit();
    } else if (options.tool() === 'pan') {
      event.preventDefault();
      const currentView = view();
      updateView({ ...currentView, centerX: boundedGraphCoordinate(currentView.centerX + direction[0] * step),
        centerY: boundedGraphCoordinate(currentView.centerY + direction[1] * step) });
    } else if (options.tool() === 'zoom' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const paper = options.paper();
      updateView(zoomAt({ x: paper.left + paper.plotWidth / 2, y: paper.top + paper.plotHeight / 2 },
        view(), nextGraphZoom(view(), event.key === 'ArrowUp' ? 1 : -1)));
    }
  }
  function cancel(event: PointerEvent) {
    if (navigation.end(event)) return;
    if (gesture?.id === event.pointerId) cleanup(true);
  }
  function contextmenu(event: MouseEvent) {
    if (!options.enabled()) return;
    const at = position(event), selected = at ? hit(at, event) : null;
    if (selected) {
      event.preventDefault(); cleanup(true); connectionAnchor.value = null;
      options.select(selected); options.openOptions();
    } else if (options.tool() === 'zoom') event.preventDefault();
  }
  return { dragging, navigating: navigation.active, connectionAnchor, hover, begin, move, end, keydown,
    cancel, lostCapture: cancel, contextmenu,
    wheel: navigation.wheel, gestureStart: navigation.gestureStart, gestureChange: navigation.gestureChange, gestureEnd: navigation.gestureEnd,
    leave: () => { options.coordinate(null); if (!gesture) hover.value = null; },
  };
}
