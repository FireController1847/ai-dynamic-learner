import { createId } from '../../core/ids.ts';
import {
  boundedGraphCoordinate, cleanGraphNumber, MAX_GRAPH_CONNECTIONS, MAX_GRAPH_POINTS,
  type GraphColor, type GraphDivision, type GraphPoint, type GraphSelection, type GraphView, type GraphVisual,
} from './graph-model.ts';
import { pointOnPaper, type PaperGeometry } from './graph-scene.ts';

export function cloneGraphVisual(visual: GraphVisual): GraphVisual {
  return { points: visual.points.map(point => ({ ...point })), connections: visual.connections.map(line => ({ ...line })) };
}
export function placeGraphPoint(x: number, y: number, view: GraphView, snap: boolean,
  divisions: GraphDivision = 1): { x: number; y: number } {
  const step = view.unitsPerSquare / divisions;
  const round = (value: number) => boundedGraphCoordinate(snap
    ? Math.round(value / step) * step : value);
  return { x: round(x), y: round(y) };
}
export function newGraphPoint(visual: GraphVisual, position: { x: number; y: number }, color: GraphColor): GraphPoint {
  if (visual.points.length >= MAX_GRAPH_POINTS) throw new Error(`A drawing can have up to ${MAX_GRAPH_POINTS} points.`);
  let number = 0;
  let label = 'A';
  do {
    label = number < 26 ? String.fromCharCode(65 + number) : `P${number + 1}`;
    number += 1;
  } while (visual.points.some(point => point.label === label));
  return { id: createId(), ...position, label, color };
}
export function connectGraphPoints(visual: GraphVisual, from: string, to: string, color: GraphColor): GraphVisual {
  if (from === to || visual.connections.some(line =>
    (line.from === from && line.to === to) || (line.from === to && line.to === from))) return visual;
  if (visual.connections.length >= MAX_GRAPH_CONNECTIONS) throw new Error(`A drawing can have up to ${MAX_GRAPH_CONNECTIONS} connections.`);
  return { ...visual, connections: [...visual.connections, { id: createId(), from, to, color }] };
}
export function removeGraphSelection(visual: GraphVisual, selection: GraphSelection): GraphVisual {
  if (!selection) return visual;
  return selection.kind === 'connection'
    ? { ...visual, connections: visual.connections.filter(line => line.id !== selection.id) }
    : { points: visual.points.filter(point => point.id !== selection.id),
      connections: visual.connections.filter(line => line.from !== selection.id && line.to !== selection.id) };
}
export function hitGraphVisual(position: { x: number; y: number }, visual: GraphVisual, paper: PaperGeometry,
  view: GraphView, radius: number): GraphSelection {
  let nearest: GraphSelection = null;
  let distance = radius;
  for (const point of visual.points) {
    const screen = pointOnPaper(point, paper, view);
    const delta = Math.hypot(position.x - screen.x, position.y - screen.y);
    if (delta <= distance) { nearest = { kind: 'point', id: point.id }; distance = delta; }
  }
  if (nearest) return nearest;
  const points = new Map(visual.points.map(point => [point.id, point]));
  for (const line of visual.connections) {
    const from = points.get(line.from), to = points.get(line.to);
    if (!from || !to) continue;
    const a = pointOnPaper(from, paper, view), b = pointOnPaper(to, paper, view);
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((position.x - a.x) * dx + (position.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const delta = Math.hypot(position.x - a.x - t * dx, position.y - a.y - t * dy);
    if (delta <= distance) { nearest = { kind: 'connection', id: line.id }; distance = delta; }
  }
  return nearest;
}
export function stepGraphUnits(value: number, direction: number, large = false): number {
  // Integer-scaled addition avoids 0.1 + 0.2 style artifacts in spinner/arrow changes.
  const precision = 100000000000;
  return cleanGraphNumber((Math.round(value * precision) + direction * (large ? precision : precision / 10)) / precision);
}
