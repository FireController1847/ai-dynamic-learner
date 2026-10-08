import { createId } from '../../core/ids.ts';
import { MAP_GRID, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH, type MapConnection, type MapGuideData, type MapTopic } from './library-model.ts';

export function topicById(data: MapGuideData, id: string | null | undefined): MapTopic | null {
  return id ? data.topics.find(topic => topic.id === id) ?? null : null;
}

export function startTopic(data: MapGuideData): MapTopic | null {
  return topicById(data, data.startTopicId) ?? data.topics[0] ?? null;
}

export function connectedTopicIds(data: MapGuideData, topicId: string): string[] {
  const connected = new Set<string>();
  for (const connection of data.connections) {
    if (connection.from === topicId) connected.add(connection.to);
    else if (connection.to === topicId) connected.add(connection.from);
  }
  return data.topics.filter(topic => connected.has(topic.id)).map(topic => topic.id);
}

export function connectionBetween(data: MapGuideData, first: string, second: string): MapConnection | null {
  return data.connections.find(connection =>
    (connection.from === first && connection.to === second) ||
    (connection.from === second && connection.to === first)) ?? null;
}

export function connectionWouldCreateCycle(data: MapGuideData, first: string, second: string): boolean {
  if (first === second) return true;
  const reached = new Set<string>([first]);
  const pending = [first];
  while (pending.length) {
    const current = pending.shift();
    if (!current) break;
    for (const neighbor of connectedTopicIds(data, current)) {
      if (neighbor === second) return true;
      if (reached.has(neighbor)) continue;
      reached.add(neighbor);
      pending.push(neighbor);
    }
  }
  return false;
}

export function connectTopics(data: MapGuideData, first: string, second: string): MapConnection | null {
  if (!topicById(data, first) || !topicById(data, second) || connectionWouldCreateCycle(data, first, second)) return null;
  const connection = { id: createId(), from: first, to: second };
  data.connections.push(connection);
  return connection;
}

export function removeConnection(data: MapGuideData, connectionId: string): boolean {
  const index = data.connections.findIndex(connection => connection.id === connectionId);
  if (index < 0) return false;
  data.connections.splice(index, 1);
  return true;
}

export function removeTopicGraphData(data: MapGuideData, topicId: string): void {
  data.connections = data.connections.filter(connection => connection.from !== topicId && connection.to !== topicId);
  if (data.startTopicId === topicId) data.startTopicId = data.topics.find(topic => topic.id !== topicId)?.id ?? null;
}

export function setStartTopic(data: MapGuideData, topicId: string): boolean {
  if (!topicById(data, topicId)) return false;
  data.startTopicId = topicId;
  return true;
}

export function mapStudyProblem(data: MapGuideData): string | null {
  for (const connection of data.connections) {
    const without = { ...data, connections: data.connections.filter(entry => entry.id !== connection.id) };
    if (!connectionWouldCreateCycle(without, connection.from, connection.to)) continue;
    return 'Remove the connection loop before studying.';
  }

  const start = startTopic(data);
  if (!start) return 'Add at least one topic before studying.';
  if (data.topics.length === 1) return null;

  const reached = new Set<string>([start.id]);
  const pending = [start.id];
  while (pending.length) {
    const current = pending.shift();
    if (!current) break;
    for (const neighbor of connectedTopicIds(data, current)) {
      if (reached.has(neighbor)) continue;
      reached.add(neighbor);
      pending.push(neighbor);
    }
  }

  return reached.size === data.topics.length ? null : 'Connect every topic to the map before studying.';
}


export interface MapTopicPosition { x: number; y: number }

function snapped(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value / MAP_GRID) * MAP_GRID));
}

/**
 * Deterministically place a connected acyclic map when no validated AI layout is present.
 * Normal trees progress left-to-right from the starting topic with a small vertical wander;
 * unusually wide/deep trees fall back to breadth-first horizontal grid packing.
 */
export function layoutMapTopics(
  topicIds: readonly string[],
  connections: readonly Pick<MapConnection, 'from' | 'to'>[],
  startId: string,
): Map<string, MapTopicPosition> {
  const order = new Map(topicIds.map((id, index) => [id, index]));
  const adjacency = new Map(topicIds.map(id => [id, [] as string[]]));
  for (const connection of connections) {
    adjacency.get(connection.from)?.push(connection.to);
    adjacency.get(connection.to)?.push(connection.from);
  }
  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
  }

  const levels: string[][] = [];
  const traversal: string[] = [];
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current.id) || !adjacency.has(current.id)) continue;
    visited.add(current.id);
    traversal.push(current.id);
    (levels[current.depth] ??= []).push(current.id);
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (!visited.has(neighbor)) queue.push({ id: neighbor, depth: current.depth + 1 });
    }
  }
  for (const id of topicIds) {
    if (!visited.has(id)) traversal.push(id);
  }

  const roomyXStep = 192;
  const roomyYStep = 96;
  const maxTreeColumns = Math.floor(MAP_MAX_X / roomyXStep) + 1;
  const maxTreeRows = Math.floor(MAP_MAX_Y / roomyYStep) + 1;
  const treeFits = levels.length <= maxTreeColumns && levels.every(level => level.length <= maxTreeRows);
  const positions = new Map<string, MapTopicPosition>();

  if (treeFits) {
    const wander = [0, -64, 32, -32, 64, 0];
    levels.forEach((level, column) => {
      const centerY = MAP_MAX_Y / 2 + (wander[column % wander.length] ?? 0);
      const span = (level.length - 1) * roomyYStep;
      const startY = snapped(centerY - span / 2, MAP_MAX_Y);
      level.forEach((id, row) => {
        positions.set(id, {
          x: column * roomyXStep,
          y: snapped(startY + row * roomyYStep, MAP_MAX_Y),
        });
      });
    });
    return positions;
  }

  const minXStep = Math.ceil(MAP_TOPIC_WIDTH / MAP_GRID) * MAP_GRID;
  const minYStep = Math.ceil(MAP_TOPIC_HEIGHT / MAP_GRID) * MAP_GRID;
  const maxColumns = Math.floor(MAP_MAX_X / minXStep) + 1;
  const columns = Math.max(1, Math.min(maxColumns, Math.ceil(Math.sqrt(Math.max(1, traversal.length) * 1.5))));
  const rows = Math.ceil(traversal.length / columns);
  const xStep = columns <= 1 ? 0 : Math.max(minXStep, Math.floor(MAP_MAX_X / (columns - 1) / MAP_GRID) * MAP_GRID);
  const yStep = rows <= 1 ? 0 : Math.max(minYStep, Math.floor(MAP_MAX_Y / (rows - 1) / MAP_GRID) * MAP_GRID);

  traversal.forEach((id, index) => {
    const row = Math.floor(index / columns);
    const logicalColumn = index % columns;
    const column = row % 2 === 0 ? logicalColumn : columns - logicalColumn - 1;
    positions.set(id, {
      x: snapped(column * xStep, MAP_MAX_X),
      y: snapped(row * yStep, MAP_MAX_Y),
    });
  });
  return positions;
}
