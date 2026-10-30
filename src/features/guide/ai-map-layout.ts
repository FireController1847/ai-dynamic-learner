import { MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH } from './library-model.ts';
import type { MapTopicPosition } from './map-graph.ts';
import { layoutMapTopics } from './map-graph.ts';

export const GUIDE_AI_STOP_GAP = 64;
const GRID_X = 224; // 160px box + 64px breathing room
const GRID_Y = 128; // 56px box + 72px breathing room
export const GUIDE_AI_MAX_SPACED_TOPICS =
  (Math.floor(MAP_MAX_X / GRID_X) + 1) * (Math.floor(MAP_MAX_Y / GRID_Y) + 1);

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

/**
 * AI positions are suggestions, not trusted geometry. Preserve an artful layout
 * when spaced; otherwise repair deterministically without leaving touching stops.
 * Existing manually-authored and legacy maps are not migrated.
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
  if (requested && requested.length === topicIds.length && stopsAreSpaced(requested))
    return new Map(topicIds.map((id, i) => [id, requested[i]]));

  const base = layoutMapTopics(topicIds, connections, startId);
  const proposed = topicIds.map(id => base.get(id) ?? { x: 0, y: 0 });
  if (stopsAreSpaced(proposed)) return base;

  // Fit any map up to capacity, arranging a readable and predictable fallback.
  const columns = Math.floor(MAP_MAX_X / GRID_X) + 1;
  const positions = new Map<string, MapTopicPosition>();
  // Preserve start-to-end order where possible; the route can still be followed.
  topicIds.forEach((id, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    positions.set(id, { x: col * GRID_X, y: row * GRID_Y });
  });
  return positions;
}
