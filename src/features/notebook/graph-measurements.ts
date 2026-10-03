import { cleanGraphNumber, type GraphColor, type GraphPoint, type GraphVisual } from './graph-model.ts';

export interface GraphSegmentMeasurement {
  id: string; from: GraphPoint; to: GraphPoint; length: number; dx: number; dy: number;
  slope: number | null; angle: number | null; midpoint: { x: number; y: number };
}
export interface GraphAreaMeasurement {
  id: string; pointIds: string[]; connectionIds: string[]; points: GraphPoint[];
  area: number; perimeter: number; center: { x: number; y: number }; color: GraphColor;
}
export interface GraphMeasurements { segments: GraphSegmentMeasurement[]; areas: GraphAreaMeasurement[]; totalLength: number }
interface Neighbor { point: GraphPoint; connectionId: string }

export function measurementNumber(value: number): string {
  if (!Number.isFinite(value)) return 'Out of range';
  const rounded = Number(value.toPrecision(6));
  return `${rounded === cleanGraphNumber(value) ? '' : '≈ '}${rounded}`;
}
export const pointPosition = (point: { x: number; y: number }): string =>
  `(${cleanGraphNumber(point.x)}, ${cleanGraphNumber(point.y)})`;

function orientation(a: GraphPoint, b: GraphPoint, c: GraphPoint): number {
  const first = (b.x - a.x) * (c.y - a.y), second = (b.y - a.y) * (c.x - a.x);
  const cross = first - second;
  return Math.abs(cross) <= 1e-12 * Math.max(Math.abs(first), Math.abs(second)) ? 0 : Math.sign(cross);
}
function onSegment(a: GraphPoint, b: GraphPoint, point: GraphPoint): boolean {
  return point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x) &&
    point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y);
}
function intersects(a: GraphPoint, b: GraphPoint, c: GraphPoint, d: GraphPoint): boolean {
  const abC = orientation(a, b, c), abD = orientation(a, b, d), cdA = orientation(c, d, a), cdB = orientation(c, d, b);
  return (abC * abD < 0 && cdA * cdB < 0) ||
    (!abC && onSegment(a, b, c)) || (!abD && onSegment(a, b, d)) ||
    (!cdA && onSegment(c, d, a)) || (!cdB && onSegment(c, d, b));
}
function bridges(neighbors: Map<string, Neighbor[]>): Set<string> {
  const order = new Map<string, number>(), low = new Map<string, number>(), result = new Set<string>();
  let index = 0;
  function visit(id: string, previous: string | null) {
    order.set(id, ++index); low.set(id, index);
    for (const neighbor of neighbors.get(id) ?? []) {
      if (neighbor.connectionId === previous) continue;
      const next = neighbor.point.id;
      if (!order.has(next)) {
        visit(next, neighbor.connectionId);
        low.set(id, Math.min(low.get(id)!, low.get(next)!));
        if (low.get(next)! > order.get(id)!) result.add(neighbor.connectionId);
      } else low.set(id, Math.min(low.get(id)!, order.get(next)!));
    }
  }
  for (const id of neighbors.keys()) if (!order.has(id)) visit(id, null);
  return result;
}
function polygon(points: GraphPoint[], connectionIds: string[], segments: Map<string, GraphSegmentMeasurement>): GraphAreaMeasurement | null {
  if (points.length < 3 || new Set(points.map(point => point.id)).size !== points.length) return null;
  // Translate before the shoelace sum to reduce cancellation for distant shapes.
  const origin = points[0]!;
  let twiceArea = 0, centerX = 0, centerY = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!, b = points[(index + 1) % points.length]!;
    const ax = a.x - origin.x, ay = a.y - origin.y, bx = b.x - origin.x, by = b.y - origin.y;
    const cross = ax * by - bx * ay;
    twiceArea += cross; centerX += (ax + bx) * cross; centerY += (ay + by) * cross;
  }
  // Clockwise walks describe the unbounded exterior, not an enclosed face.
  if (twiceArea <= 0) return null;
  return { id: [...connectionIds].sort().join(':'), points, pointIds: points.map(point => point.id), connectionIds,
    area: twiceArea / 2, perimeter: connectionIds.reduce((sum, id) => sum + (segments.get(id)?.length ?? 0), 0),
    center: { x: origin.x + centerX / (3 * twiceArea), y: origin.y + centerY / (3 * twiceArea) }, color: origin.color };
}

export function measureGraphDrawing(visual: GraphVisual): GraphMeasurements {
  const points = new Map(visual.points.map(point => [point.id, point]));
  const segments: GraphSegmentMeasurement[] = [];
  const neighbors = new Map<string, Neighbor[]>();
  for (const connection of visual.connections) {
    const from = points.get(connection.from), to = points.get(connection.to);
    if (!from || !to) continue;
    const dx = to.x - from.x, dy = to.y - from.y;
    segments.push({ id: connection.id, from, to, dx, dy, length: Math.hypot(dx, dy),
      slope: dx === 0 ? null : dy / dx, angle: dx === 0 && dy === 0 ? null : Math.atan2(dy, dx) * 180 / Math.PI,
      midpoint: { x: from.x + dx / 2, y: from.y + dy / 2 } });
    if (!neighbors.has(from.id)) neighbors.set(from.id, []);
    if (!neighbors.has(to.id)) neighbors.set(to.id, []);
    neighbors.get(from.id)!.push({ point: to, connectionId: connection.id });
    neighbors.get(to.id)!.push({ point: from, connectionId: connection.id });
  }
  const excluded = bridges(neighbors);
  for (const segment of segments) if (segment.length === 0) excluded.add(segment.id);
  // Crossing or overlapping edges need explicit intersection vertices before area is well-defined.
  const boundaries = segments.filter(segment => !excluded.has(segment.id));
  for (let first = 0; first < boundaries.length; first += 1) {
    for (let second = first + 1; second < boundaries.length; second += 1) {
      const a = boundaries[first]!, b = boundaries[second]!;
      const shared = [a.from, a.to].find(point => point.id === b.from.id || point.id === b.to.id);
      if (shared) {
        const endA = shared.id === a.from.id ? a.to : a.from;
        const endB = shared.id === b.from.id ? b.to : b.from;
        const overlap = orientation(shared, endA, endB) === 0 &&
          (endA.x - shared.x) * (endB.x - shared.x) + (endA.y - shared.y) * (endB.y - shared.y) > 0;
        if (overlap) { excluded.add(a.id); excluded.add(b.id); }
        continue;
      }
      if (intersects(a.from, a.to, b.from, b.to)) { excluded.add(a.id); excluded.add(b.id); }
    }
  }
  for (const [id, list] of neighbors) {
    const center = points.get(id)!;
    neighbors.set(id, list.filter(neighbor => !excluded.has(neighbor.connectionId)).sort((a, b) =>
      Math.atan2(a.point.y - center.y, a.point.x - center.x) - Math.atan2(b.point.y - center.y, b.point.x - center.x)));
  }
  const byId = new Map(segments.map(segment => [segment.id, segment]));
  const visited = new Set<string>(), areas: GraphAreaMeasurement[] = [];
  for (const segment of segments) {
    if (excluded.has(segment.id)) continue;
    for (const [start, next] of [[segment.from, segment.to], [segment.to, segment.from]] as const) {
      if (visited.has(`${start.id}:${next.id}`)) continue;
      const outline: GraphPoint[] = [], connections: string[] = [];
      let from = start, to = next, closed = false;
      for (let step = 0; step <= segments.length * 2; step += 1) {
        const key = `${from.id}:${to.id}`;
        if (visited.has(key)) { closed = from.id === start.id && to.id === next.id; break; }
        visited.add(key); outline.push(from);
        const outgoing = neighbors.get(to.id) ?? [];
        const incoming = outgoing.findIndex(neighbor => neighbor.point.id === from.id);
        if (incoming < 0 || outgoing.length < 2) break;
        connections.push(outgoing[incoming]!.connectionId);
        const following = outgoing[(incoming + outgoing.length - 1) % outgoing.length]!;
        from = to; to = following.point;
      }
      const area = closed ? polygon(outline, connections, byId) : null;
      if (area) areas.push(area);
    }
  }
  return { segments, areas, totalLength: segments.reduce((sum, segment) => sum + segment.length, 0) };
}
