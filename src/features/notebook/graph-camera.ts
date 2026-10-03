import { boundedGraphCoordinate, graphZoom, normalizeGraphZoom, type GraphView } from './graph-model.ts';
import { coordinateAt, graphCellSize, type PaperGeometry } from './graph-scene.ts';

export interface GraphPosition { x: number; y: number }
export function cameraAt(paper: PaperGeometry, original: GraphView, world: GraphPosition,
  target: GraphPosition, percent: number): GraphView {
  const zoom = normalizeGraphZoom(percent);
  const scale = original.unitsPerSquare / graphCellSize(paper, { ...original, zoom });
  return { ...original, zoom,
    centerX: boundedGraphCoordinate(world.x - (target.x - paper.left - paper.plotWidth / 2) * scale),
    centerY: boundedGraphCoordinate(world.y + (target.y - paper.top - paper.plotHeight / 2) * scale) };
}
export function zoomGraphAt(paper: PaperGeometry, original: GraphView, point: GraphPosition, percent: number): GraphView {
  if (normalizeGraphZoom(percent) === graphZoom(original)) return original;
  return cameraAt(paper, original, coordinateAt(point, paper, original), point, percent);
}
export function paperPosition(svg: SVGSVGElement, paper: PaperGeometry, client: GraphPosition): GraphPosition {
  const rect = svg.getBoundingClientRect();
  return { x: (client.x - rect.left) * paper.width / (rect.width || paper.width),
    y: (client.y - rect.top) * paper.height / (rect.height || paper.height) };
}
export function insideGraph(paper: PaperGeometry, point: GraphPosition): boolean {
  return point.x >= paper.left && point.x <= paper.left + paper.plotWidth &&
    point.y >= paper.top && point.y <= paper.top + paper.plotHeight;
}
