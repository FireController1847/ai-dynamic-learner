import { createId, isValidId } from '../../core/ids.ts';
import { isRecord } from '../../core/validation.ts';

export const GRAPH_COLORS = [
  { id: 'blue', label: 'Blue', ink: '#2563b8' },
  { id: 'red', label: 'Red', ink: '#c44545' },
  { id: 'green', label: 'Green', ink: '#288154' },
  { id: 'purple', label: 'Purple', ink: '#8750ad' },
  { id: 'orange', label: 'Orange', ink: '#b86820' },
  { id: 'teal', label: 'Teal', ink: '#16828a' },
] as const;
export type GraphColor = typeof GRAPH_COLORS[number]['id'];
export interface GraphExpression { id: string; source: string; color: GraphColor; hidden: boolean }
export interface GraphView { centerX: number; centerY: number; unitsPerSquare: number; zoom?: number }
export const GRAPH_DIVISIONS = [
  { value: 1, label: 'Whole squares' }, { value: 2, label: '½ square' },
  { value: 4, label: '¼ square' }, { value: 5, label: '⅕ square' }, { value: 10, label: '⅒ square' },
] as const;
export type GraphDivision = typeof GRAPH_DIVISIONS[number]['value'];
export interface GraphPoint { id: string; x: number; y: number; label: string; color: GraphColor; showCoordinates?: boolean }
export interface GraphConnection { id: string; from: string; to: string; color: GraphColor }
export interface GraphVisual { points: GraphPoint[]; connections: GraphConnection[] }
export type GraphSelection = { kind: 'point' | 'connection'; id: string } | null;
export interface GraphAnnotations { names: boolean; coordinates: boolean; lengths: boolean; areas: boolean }
export function defaultGraphAnnotations(): GraphAnnotations {
  return { names: true, coordinates: false, lengths: false, areas: false };
}
export interface GraphData {
  title: string; notes: string; expressions: GraphExpression[]; view: GraphView;
  // Accept the former mode field in saved sheets; both editing methods now share the graph.
  mode?: 'expressions' | 'visual'; visual?: GraphVisual; annotations?: GraphAnnotations;
}
export const MAX_EXPRESSIONS = 20;
export const MAX_EXPRESSION_LENGTH = 240;
export const MIN_GRAPH_SCALE = 0.0001;
export const MAX_GRAPH_SCALE = 10000;
export const MAX_GRAPH_CENTER = 1000000;
export const MAX_GRAPH_POINTS = 200;
export const MAX_GRAPH_CONNECTIONS = 500;
export const MIN_GRAPH_ZOOM = 25;
export const MAX_GRAPH_ZOOM = 400;
const ZOOM_STEPS = [25, 33, 50, 67, 75, 100, 125, 150, 200, 300, 400];
export const graphZoom = (view: GraphView): number => view.zoom ?? 100;
export const normalizeGraphZoom = (value: number): number =>
  Math.round(Math.max(MIN_GRAPH_ZOOM, Math.min(MAX_GRAPH_ZOOM, value)));
export function nextGraphZoom(view: GraphView, direction: 1 | -1): number {
  const current = graphZoom(view);
  return direction === 1 ? ZOOM_STEPS.find(value => value > current) ?? MAX_GRAPH_ZOOM
    : ZOOM_STEPS.findLast(value => value < current) ?? MIN_GRAPH_ZOOM;
}

export function defaultGraphView(): GraphView { return { centerX: 0, centerY: 0, unitsPerSquare: 1, zoom: 100 }; }
export function createGraphData(): GraphData {
  return { title: '', notes: '', expressions: [], view: defaultGraphView(),
    visual: { points: [], connections: [] }, annotations: defaultGraphAnnotations() };
}
export function createGraphExpression(index: number, source = ''): GraphExpression {
  return { id: createId(), source, color: GRAPH_COLORS[index % GRAPH_COLORS.length]!.id, hidden: false };
}
export function graphInk(color: GraphColor): string {
  return GRAPH_COLORS.find(choice => choice.id === color)!.ink;
}
export function graphIsEmpty(data: GraphData): boolean {
  return !data.title.trim() && !data.notes.trim() && data.expressions.every(expression => !expression.source.trim()) &&
    !data.visual?.points.length;
}
export const cleanGraphNumber = (value: number): number => Number(value.toPrecision(12));
export const boundedGraphCoordinate = (value: number): number =>
  cleanGraphNumber(Math.max(-MAX_GRAPH_CENTER, Math.min(MAX_GRAPH_CENTER, value)));
function finiteNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
export function validateGraphData(value: unknown): asserts value is GraphData {
  if (!isRecord(value) || Object.keys(value).some(key => !['title', 'notes', 'expressions', 'view', 'mode', 'visual', 'annotations'].includes(key)) ||
      typeof value.title !== 'string' || value.title.length > 120 ||
      typeof value.notes !== 'string' || value.notes.length > 20000 ||
      !Array.isArray(value.expressions) || value.expressions.length > MAX_EXPRESSIONS || !isRecord(value.view)) {
    throw new Error('A Graph Paper document contains unsupported data or exceeds its limits.');
  }
  if (Object.hasOwn(value, 'mode') && value.mode !== 'expressions' && value.mode !== 'visual') {
    throw new Error('The Graph Paper editing mode is invalid.');
  }
  if (Object.hasOwn(value, 'visual')) validateGraphVisual(value.visual);
  if (Object.hasOwn(value, 'annotations')) {
    const annotations = value.annotations;
    const fields = ['names', 'coordinates', 'lengths', 'areas'];
    if (!isRecord(annotations) || Object.keys(annotations).some(key => !fields.includes(key)) ||
        fields.some(key => typeof annotations[key] !== 'boolean')) throw new Error('Graph Paper annotation settings are invalid.');
  }
  const view = value.view;
  if (Object.keys(view).some(key => !['centerX', 'centerY', 'unitsPerSquare', 'zoom'].includes(key)) ||
      !finiteNumber(view.centerX, -MAX_GRAPH_CENTER, MAX_GRAPH_CENTER) ||
      !finiteNumber(view.centerY, -MAX_GRAPH_CENTER, MAX_GRAPH_CENTER) ||
      !finiteNumber(view.unitsPerSquare, MIN_GRAPH_SCALE, MAX_GRAPH_SCALE) ||
      (Object.hasOwn(view, 'zoom') && (!finiteNumber(view.zoom, MIN_GRAPH_ZOOM, MAX_GRAPH_ZOOM) || !Number.isInteger(view.zoom)))) {
    throw new Error('The Graph Paper view is invalid.');
  }
  const ids = new Set<string>();
  for (const expression of value.expressions) {
    if (!isRecord(expression) || Object.keys(expression).some(key => !['id', 'source', 'color', 'hidden'].includes(key)) ||
        !isValidId(expression.id) || ids.has(expression.id) ||
        typeof expression.source !== 'string' || expression.source.length > MAX_EXPRESSION_LENGTH ||
        !GRAPH_COLORS.some(color => color.id === expression.color) || typeof expression.hidden !== 'boolean') {
      throw new Error('A Graph Paper expression is invalid.');
    }
    ids.add(expression.id);
  }
}

export function validateGraphVisual(value: unknown): asserts value is GraphVisual {
  if (!isRecord(value) || Object.keys(value).some(key => !['points', 'connections'].includes(key)) ||
      !Array.isArray(value.points) || value.points.length > MAX_GRAPH_POINTS ||
      !Array.isArray(value.connections) || value.connections.length > MAX_GRAPH_CONNECTIONS) {
    throw new Error('The Graph Paper visual drawing is invalid or exceeds its limits.');
  }
  const pointIds = new Set<string>();
  for (const point of value.points) {
    if (!isRecord(point) || Object.keys(point).some(key => !['id', 'x', 'y', 'label', 'color', 'showCoordinates'].includes(key)) ||
        !isValidId(point.id) || pointIds.has(point.id) ||
        !finiteNumber(point.x, -MAX_GRAPH_CENTER, MAX_GRAPH_CENTER) ||
        !finiteNumber(point.y, -MAX_GRAPH_CENTER, MAX_GRAPH_CENTER) ||
        typeof point.label !== 'string' || point.label.length > 60 || !GRAPH_COLORS.some(color => color.id === point.color) ||
        (Object.hasOwn(point, 'showCoordinates') && typeof point.showCoordinates !== 'boolean')) {
      throw new Error('A visual graph point is invalid.');
    }
    pointIds.add(point.id);
  }
  const ids = new Set(pointIds);
  const pairs = new Set<string>();
  for (const connection of value.connections) {
    if (!isRecord(connection) || Object.keys(connection).some(key => !['id', 'from', 'to', 'color'].includes(key)) ||
        !isValidId(connection.id) || ids.has(connection.id) ||
        typeof connection.from !== 'string' || typeof connection.to !== 'string' ||
        !pointIds.has(connection.from) || !pointIds.has(connection.to) || connection.from === connection.to ||
        !GRAPH_COLORS.some(color => color.id === connection.color)) {
      throw new Error('A visual graph connection is invalid.');
    }
    const pair = [connection.from, connection.to].sort().join(':');
    if (pairs.has(pair)) throw new Error('A visual graph has a duplicate connection.');
    ids.add(connection.id);
    pairs.add(pair);
  }
}
