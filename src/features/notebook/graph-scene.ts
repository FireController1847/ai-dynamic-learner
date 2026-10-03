import type { GraphDisplay } from './display-options.ts';
import type { GraphPlot } from './graph-expression.ts';
import { defaultGraphAnnotations, graphInk, graphZoom, type GraphAnnotations, type GraphColor,
  type GraphDivision, type GraphSelection, type GraphView, type GraphVisual } from './graph-model.ts';
import { measureGraphDrawing, measurementNumber, pointPosition, type GraphMeasurements } from './graph-measurements.ts';

export interface PaperGeometry {
  width: number; height: number; cell: number; left: number; top: number;
  plotWidth: number; plotHeight: number; label: string; ruling: string;
}
export interface SvgMark {
  tag: 'rect' | 'path' | 'circle' | 'text'; attributes: Record<string, string | number>; text?: string;
}
export interface RenderPlot { plot: GraphPlot; color: GraphColor }
export interface GraphSceneDetails {
  visual?: GraphVisual; selection?: GraphSelection; subdivisions?: GraphDivision; screenScale?: number;
  annotations?: GraphAnnotations; measurements?: GraphMeasurements;
}
interface Point { x: number; y: number }

export function paperGeometry(options: GraphDisplay): PaperGeometry {
  const width = options.size === 'letter' ? 816 : 210 * 96 / 25.4;
  const height = options.size === 'letter' ? 1056 : 297 * 96 / 25.4;
  const cell = options.grid === 'quarter' ? 24 : options.grid === 'fifth' ? 19.2 : 5 * 96 / 25.4;
  const plotWidth = Math.floor((width - 96) / (2 * cell)) * 2 * cell;
  const plotHeight = Math.floor((height - 168) / (2 * cell)) * 2 * cell;
  return { width, height, cell, left: (width - plotWidth) / 2, top: 96, plotWidth, plotHeight,
    label: options.size === 'letter' ? 'US Letter · 8.5 × 11 in' : 'A4 · 210 × 297 mm',
    ruling: options.grid === 'quarter' ? '¼-inch squares' : options.grid === 'fifth' ? '⅕-inch squares' : '5 mm squares',
  };
}
export function graphCellSize(paper: PaperGeometry, view: GraphView): number { return paper.cell * graphZoom(view) / 100; }
export function coordinateAt(point: Point, paper: PaperGeometry, view: GraphView): Point {
  const cell = graphCellSize(paper, view);
  return {
    x: view.centerX + (point.x - paper.left - paper.plotWidth / 2) * view.unitsPerSquare / cell,
    y: view.centerY - (point.y - paper.top - paper.plotHeight / 2) * view.unitsPerSquare / cell,
  };
}
export function pointOnPaper(point: Point, paper: PaperGeometry, view: GraphView): Point {
  const cell = graphCellSize(paper, view);
  return {
    x: paper.left + paper.plotWidth / 2 + (point.x - view.centerX) * cell / view.unitsPerSquare,
    y: paper.top + paper.plotHeight / 2 - (point.y - view.centerY) * cell / view.unitsPerSquare,
  };
}
export function graphNumber(value: number): string {
  if (Math.abs(value) < 1e-10) return '0';
  return Number(value.toPrecision(5)).toString();
}
const rounded = (value: number) => Number(value.toFixed(3));

// Clip each plotted segment to the writing area, keeping extreme values out of SVG paths.
function clipSegment(a: Point, b: Point, paper: PaperGeometry): string {
  const dx = b.x - a.x, dy = b.y - a.y;
  const limits = [[-dx, a.x - paper.left], [dx, paper.left + paper.plotWidth - a.x],
    [-dy, a.y - paper.top], [dy, paper.top + paper.plotHeight - a.y]];
  let first = 0, last = 1;
  for (const [direction, distance] of limits) {
    if (direction === 0) { if (distance! < 0) return ''; continue; }
    const ratio = distance! / direction!;
    if (direction! < 0) first = Math.max(first, ratio);
    else last = Math.min(last, ratio);
    if (first > last) return '';
  }
  return `M${rounded(a.x + first * dx)},${rounded(a.y + first * dy)}L${rounded(a.x + last * dx)},${rounded(a.y + last * dy)}`;
}

function functionPath(evaluate: (x: number) => number, paper: PaperGeometry, view: GraphView): string {
  let path = '', remaining = 6000;
  const sample = (pixelX: number): Point => {
    const x = coordinateAt({ x: pixelX, y: paper.top }, paper, view).x;
    const y = evaluate(x);
    return { x: pixelX, y: pointOnPaper({ x, y }, paper, view).y };
  };
  function segment(a: Point, b: Point, depth: number): void {
    if (--remaining < 0) return;
    const middle = sample((a.x + b.x) / 2);
    const finite = [a.y, middle.y, b.y].every(y => Number.isFinite(y) && Math.abs(y) < 1e12);
    const deviation = Math.abs(middle.y - (a.y + b.y) / 2);
    if (depth < 7 && (!finite || deviation > 1.5)) {
      if (![a.y, middle.y, b.y].some(Number.isFinite)) return;
      segment(a, middle, depth + 1);
      segment(middle, b, depth + 1);
    } else if (finite && deviation <= 3) {
      path += clipSegment(a, b, paper);
    }
  }
  const steps = Math.ceil(paper.plotWidth / 3);
  let previous = sample(paper.left);
  for (let index = 1; index <= steps && remaining > 0; index += 1) {
    const next = sample(paper.left + index * paper.plotWidth / steps);
    segment(previous, next, 0);
    previous = next;
  }
  return path;
}

export function graphScene(view: GraphView, options: GraphDisplay, plots: readonly RenderPlot[], details: GraphSceneDetails = {}): SvgMark[] {
  const { visual, selection = null, subdivisions = 1, screenScale = 1, annotations = defaultGraphAnnotations() } = details;
  const paper = paperGeometry(options);
  const magnification = graphZoom(view) / 100;
  const cell = graphCellSize(paper, view);
  const labelStep = [1, 2, 5, 10, 20, 50, 100].find(step => step * cell * screenScale >= 50) ?? 100;
  const marks: SvgMark[] = [{ tag: 'rect', attributes: { width: paper.width, height: paper.height,
    fill: options.paper === 'white' ? '#ffffff' : '#fff9ec' } }];
  const origin = pointOnPaper({ x: 0, y: 0 }, paper, view);
  const right = paper.left + paper.plotWidth, bottom = paper.top + paper.plotHeight;
  let minor = '', major = '', subdivisionLines = '';
  const labels: SvgMark[] = [];
  const label = (x: number, y: number, value: string, anchor: string) => labels.push({ tag: 'text',
    attributes: { x: rounded(x), y: rounded(y), fill: '#58677c', 'font-size': 12,
      'font-family': 'Segoe UI, sans-serif', 'text-anchor': anchor }, text: value });
  for (const axis of ['x', 'y'] as const) {
    const start = axis === 'x' ? paper.left : paper.top;
    const end = axis === 'x' ? right : bottom;
    const base = origin[axis];
    const from = Math.ceil((start - base) / cell);
    const to = Math.floor((end - base) / cell);
    // Only visible lines are visited, even with a distant saved center.
    for (let index = from; index <= to; index += 1) {
      const pixel = rounded(base + index * cell);
      const line = axis === 'x' ? `M${pixel},${paper.top}V${bottom}` : `M${paper.left},${pixel}H${right}`;
      if (options.emphasis === 'fifths' && index % 5 === 0) major += line;
      else minor += line;
      if (options.numbers === 'show' && index % labelStep === 0 && index !== 0) {
        if (axis === 'x') label(pixel, Math.max(paper.top + 16, Math.min(bottom - 6, origin.y + 17)),
          graphNumber(index * view.unitsPerSquare), 'middle');
        else label(Math.max(paper.left + 6, Math.min(right - 48, origin.x + 7)), pixel - 4,
          graphNumber(-index * view.unitsPerSquare), 'start');
      }
    }
    const spacing = cell / subdivisions;
    // Omit subdivisions when they would blend into a dense gray texture.
    if (subdivisions > 1 && spacing * screenScale >= 2) {
      for (let index = Math.ceil((start - base) / spacing); index <= Math.floor((end - base) / spacing); index += 1) {
        if (index % subdivisions === 0) continue;
        const pixel = rounded(base + index * spacing);
        subdivisionLines += axis === 'x' ? `M${pixel},${paper.top}V${bottom}` : `M${paper.left},${pixel}H${right}`;
      }
    }
  }
  marks.push({ tag: 'path', attributes: { d: subdivisionLines, fill: 'none', stroke: '#e3edf5', 'stroke-width': 0.5 } },
    { tag: 'path', attributes: { d: minor, fill: 'none', stroke: '#c8dced', 'stroke-width': 0.7 * Math.max(1, magnification) } },
    { tag: 'path', attributes: { d: major, fill: 'none', stroke: '#a0bbd2', 'stroke-width': Math.max(1, magnification) } },
    { tag: 'rect', attributes: { x: paper.left, y: paper.top, width: paper.plotWidth, height: paper.plotHeight,
      fill: 'none', stroke: '#b6ccde', 'stroke-width': 0.7 } });
  if (options.axes === 'show') {
    let axes = '';
    if (origin.x >= paper.left && origin.x <= right) axes += `M${origin.x},${paper.top}V${bottom}`;
    if (origin.y >= paper.top && origin.y <= bottom) axes += `M${paper.left},${origin.y}H${right}`;
    marks.push({ tag: 'path', attributes: { d: axes, fill: 'none', stroke: '#687f95', 'stroke-width': 1.3 } });
    if (origin.y >= paper.top && origin.y <= bottom) label(right - 8, origin.y - 8, 'x', 'end');
    if (origin.x >= paper.left && origin.x <= right) label(origin.x + 10, paper.top + 16, 'y', 'start');
  }
  if (options.numbers === 'show' && origin.x >= paper.left && origin.x <= right - 12 &&
      origin.y >= paper.top && origin.y <= bottom - 18) label(origin.x + 7, origin.y + 17, '0', 'start');
  for (const { plot, color } of plots) {
    const ink = graphInk(color);
    if (plot.kind === 'point') {
      const point = pointOnPaper(plot, paper, view);
      if (point.x >= paper.left && point.x <= right && point.y >= paper.top && point.y <= bottom) {
        marks.push({ tag: 'circle', attributes: { cx: point.x, cy: point.y, r: 4.5 * Math.max(0.75, magnification), fill: ink } });
      }
    } else {
      const x = plot.kind === 'vertical' ? pointOnPaper({ x: plot.x, y: 0 }, paper, view).x : 0;
      const d = plot.kind === 'vertical'
        ? x >= paper.left && x <= right ? `M${x},${paper.top}V${bottom}` : ''
        : functionPath(plot.evaluate, paper, view);
      marks.push({ tag: 'path', attributes: { d, fill: 'none', stroke: ink, 'stroke-width': 2.4 * Math.max(0.75, magnification),
        'stroke-linecap': 'round', 'stroke-linejoin': 'round' } });
    }
  }
  marks.push(...labels);
  if (visual) {
    const measurements = details.measurements ?? measureGraphDrawing(visual);
    const measurementLabels: SvgMark[] = [];
    const annotation = (position: Point, text: string, ink: string) => {
      if (position.x < paper.left || position.x > right || position.y < paper.top || position.y > bottom) return;
      measurementLabels.push({ tag: 'text', text, attributes: { x: position.x, y: position.y, fill: ink,
        'font-size': 14, 'font-family': 'Segoe UI, sans-serif', 'text-anchor': 'middle',
        stroke: options.paper === 'white' ? '#ffffff' : '#fff9ec', 'stroke-width': 4,
        'paint-order': 'stroke fill', 'data-graph-annotation': 'true' } });
    };
    if (annotations.areas) {
      for (const area of measurements.areas) {
        const outline = area.points.map(point => pointOnPaper(point, paper, view));
        marks.push({ tag: 'path', attributes: { d: outline.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join('') + 'Z',
          fill: graphInk(area.color), 'fill-opacity': 0.08, 'data-graph-annotation': 'true' } });
        annotation(pointOnPaper(area.center, paper, view), `${measurementNumber(area.area)} units²`, graphInk(area.color));
      }
    }
    const points = new Map(visual.points.map(point => [point.id, point]));
    for (const line of visual.connections) {
      const from = points.get(line.from), to = points.get(line.to);
      if (!from || !to) continue;
      marks.push({ tag: 'path', attributes: {
        d: clipSegment(pointOnPaper(from, paper, view), pointOnPaper(to, paper, view), paper),
        fill: 'none', stroke: graphInk(line.color), 'stroke-width': (selection?.id === line.id ? 5 : 2.8) * Math.max(0.75, magnification), 'stroke-linecap': 'round',
      } });
    }
    if (annotations.lengths) {
      for (const segment of measurements.segments) {
        const midpoint = pointOnPaper(segment.midpoint, paper, view);
        annotation({ x: midpoint.x, y: midpoint.y - 10 }, `${measurementNumber(segment.length)} units`, '#3d536b');
      }
    }
    marks.push(...measurementLabels);
    for (const point of visual.points) {
      const position = pointOnPaper(point, paper, view);
      if (position.x < paper.left || position.x > right || position.y < paper.top || position.y > bottom) continue;
      marks.push({ tag: 'circle', attributes: { cx: position.x, cy: position.y, r: 6 * Math.max(0.75, magnification),
        fill: graphInk(point.color), stroke: '#ffffff', 'stroke-width': 1.5 } });
      if (selection?.id === point.id) marks.push({ tag: 'circle', attributes: {
        cx: position.x, cy: position.y, r: 11 * Math.max(0.75, magnification), fill: 'none', stroke: graphInk(point.color), 'stroke-width': 1.5,
      } });
      const showCoordinates = point.showCoordinates ?? annotations.coordinates;
      const pointText = [annotations.names ? point.label : '', showCoordinates ? pointPosition(point) : ''].filter(Boolean).join(' ');
      if (pointText) marks.push({ tag: 'text', text: pointText, attributes: {
        x: Math.min(position.x + 10 * Math.max(1, magnification), right - 18),
        y: Math.max(position.y - 10 * Math.max(1, magnification), paper.top + 18),
        fill: graphInk(point.color), 'font-family': 'Segoe UI, sans-serif', 'font-size': Math.max(12, Math.min(28, 16 * magnification)),
        'data-graph-annotation': 'true',
      } });
    }
  }
  return marks;
}
