import { createId } from '../../core/ids.ts';
import type { MapConnection, MapGuideData, MapTopic } from './library-model.ts';

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
