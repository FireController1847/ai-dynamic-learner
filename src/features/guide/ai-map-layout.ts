import { MAP_GRID, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH } from './library-model.ts';
import type { MapTopicPosition } from './map-graph.ts';

export const GUIDE_AI_STOP_GAP = 64;
const SPACING_X = MAP_TOPIC_WIDTH + GUIDE_AI_STOP_GAP;
const SPACING_Y = Math.ceil((MAP_TOPIC_HEIGHT + GUIDE_AI_STOP_GAP) / MAP_GRID) * MAP_GRID;
const MAX_COLUMNS = Math.floor(MAP_MAX_X / SPACING_X) + 1;
const MAX_ROWS = Math.floor(MAP_MAX_Y / SPACING_Y) + 1;
export const GUIDE_AI_MAX_SPACED_TOPICS = MAX_COLUMNS * MAX_ROWS;

export function stopsAreSpaced(positions: readonly MapTopicPosition[], gap = GUIDE_AI_STOP_GAP): boolean {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i], b = positions[j];
      const separated = a.x + MAP_TOPIC_WIDTH + gap <= b.x ||
        b.x + MAP_TOPIC_WIDTH + gap <= a.x ||
        a.y + MAP_TOPIC_HEIGHT + gap <= b.y ||
        b.y + MAP_TOPIC_HEIGHT + gap <= a.y;
      if (!separated) return false;
    }
  }
  return true;
}

/** AI may suggest valid-but-uninspiring coordinates in a strict rectangular grid. */
function looksLikeGrid(positions: readonly MapTopicPosition[]): boolean {
  if (positions.length < 10) return false;
  const sameX = new Map<number, number>();
  const sameY = new Map<number, number>();
  for (const { x, y } of positions) {
    sameX.set(x, (sameX.get(x) ?? 0) + 1);
    sameY.set(y, (sameY.get(y) ?? 0) + 1);
  }
  const clustered = (values: Map<number, number>) =>
    [...values.values()].filter(count => count >= 3).reduce((sum, count) => sum + count, 0);
  return clustered(sameX) >= positions.length * 0.7 &&
    clustered(sameY) >= positions.length * 0.7;
}

/** Put adjacent stops next to each other along the map trail, including branches. */
function pathOrder(
  topicIds: readonly string[],
  connections: readonly { from: string; to: string }[],
  startId: string,
): string[] {
  const adjacency = new Map(topicIds.map(id => [id, [] as string[]]));
  for (const edge of connections) {
    adjacency.get(edge.from)?.push(edge.to);
    adjacency.get(edge.to)?.push(edge.from);
  }
  const order = new Map(topicIds.map((id, index) => [id, index]));
  for (const children of adjacency.values())
    children.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const result: string[] = [], seen = new Set<string>();
  function visit(id: string) {
    if (seen.has(id) || !adjacency.has(id)) return;
    seen.add(id);
    result.push(id);
    // Follow each meaningful branch rather than scattering its descendants
    // according to a flat, row-major array of topic names.
    for (const next of adjacency.get(id) ?? []) visit(next);
  }
  visit(startId);
  for (const id of topicIds) visit(id);
  return result;
}

/**
 * Deterministic, organic trail packing. A serpentine route means consecutive
 * stops remain neighbors when the path turns onto another row; progressive
 * column offsets and a gentle vertical wave avoid a wall of identical boxes.
 *
 * No random numbers, no overlap, no values outside the snapped map canvas.
 * For a packed 34-stop guide some rows are unavoidable; that is a physical
 * limit of the fixed map viewport, not a reason to draw long diagonal lines.
 */
function trailLayout(
  topicIds: readonly string[],
  connections: readonly { from: string; to: string }[],
  startId: string,
): Map<string, MapTopicPosition> {
  const count = topicIds.length;
  const columns = Math.min(MAX_COLUMNS, Math.max(Math.ceil(count / MAX_ROWS),
    Math.ceil(Math.sqrt(count * 1.35))));
  const rows = Math.ceil(count / columns);
  const xSlack = MAP_MAX_X - (columns - 1) * SPACING_X;
  const ySlack = MAP_MAX_Y - (rows - 1) * SPACING_Y;

  // Leave enough slack for up-and-down movement as the route crosses columns.
  const xMargin = Math.min(MAP_GRID, Math.floor(xSlack / (2 * MAP_GRID)) * MAP_GRID);
  const xExtra = Math.max(0, xSlack - xMargin);
  const yWave = Math.min(64, Math.floor(ySlack / (2 * MAP_GRID)) * MAP_GRID);
  const yMargin = Math.min(32, Math.floor((ySlack - yWave) / (2 * MAP_GRID)) * MAP_GRID);
  const yDrift = Math.max(0, ySlack - yMargin - yWave);

  const columnX = Array.from({ length: columns }, (_, column) => {
    const spread = columns < 2 ? 0 : Math.floor(xExtra * column / (columns - 1) / MAP_GRID) * MAP_GRID;
    return xMargin + column * SPACING_X + spread;
  });
  const wave = [0, 32, 64, 32, 0, 64, 32];
  const columnY = Array.from({ length: columns }, (_, column) =>
    Math.min(yWave, wave[column % wave.length]));

  const result = new Map<string, MapTopicPosition>();
  pathOrder(topicIds, connections, startId).forEach((id, index) => {
    const row = Math.floor(index / columns);
    const ordinal = index % columns;
    const column = row % 2 === 0 ? ordinal : columns - 1 - ordinal;
    const drift = rows < 2 ? 0 : Math.floor(yDrift * row / (rows - 1) / MAP_GRID) * MAP_GRID;
    result.set(id, {
      x: columnX[column],
      y: yMargin + row * SPACING_Y + drift + columnY[column],
    });
  });
  return result;
}

/**
 * AI positions are suggestions, not trusted geometry. Preserve genuinely
 * organic, well-spaced placements; recompose cramped or rigid-grid suggestions
 * as a connected winding trail. Existing saved/manual maps are untouched.
 */
export function layoutSpacedAiMap(
  topicIds: readonly string[],
  connections: readonly { from: string; to: string }[],
  startId: string,
  requested?: readonly MapTopicPosition[],
): Map<string, MapTopicPosition> {
  if (topicIds.length > GUIDE_AI_MAX_SPACED_TOPICS)
    throw new Error('This map is too large for comfortably separated stops. Split it into smaller maps of at most ' +
      GUIDE_AI_MAX_SPACED_TOPICS + ' topics.');
  if (requested && requested.length === topicIds.length &&
      stopsAreSpaced(requested) && !looksLikeGrid(requested))
    return new Map(topicIds.map((id, index) => [id, requested[index]]));

  const generated = trailLayout(topicIds, connections, startId);
  if (!stopsAreSpaced([...generated.values()]))
    throw new Error('The map could not arrange stops with enough room. Try fewer topics.');
  return generated;
}
