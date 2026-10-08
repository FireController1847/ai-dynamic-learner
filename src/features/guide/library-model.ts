import { createId, isValidId } from '../../core/ids.ts';
import { createTreeOperations, type TreeMovePosition } from '../../core/tree.ts';
import { isRecord } from '../../core/validation.ts';

export type GuideMode = 'list' | 'map';
export interface GuideSection { id: string; title: string; bullets: string[] }
export interface ListGuideData { sections: GuideSection[] }
export interface MapTopic { id: string; title: string; description?: string; x: number; y: number; guide: ListGuideData }
export interface MapConnection { id: string; from: string; to: string }
export interface MapStudySession {
  paused: boolean;
  currentId: string;
  openedIds: string[];
  visitedIds: string[];
  skippedIds: string[];
  revealed: Record<string, number>;
}
export interface MapGuideData {
  topics: MapTopic[];
  connections: MapConnection[];
  startTopicId: string | null;
  session?: MapStudySession;
}
export type GuideItem =
  | { id: string; kind: 'guide'; name: string; mode: 'list'; data: ListGuideData }
  | { id: string; kind: 'guide'; name: string; mode: 'map'; data: MapGuideData };
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | GuideItem;
export interface GuideModel { items: LibraryItem[] }
export interface GuideTarget { parentId: string | null; parentName: string; selectedId?: string | null }
export type MovePosition = TreeMovePosition;

export const MAX_ITEMS = 5000;
export const MAX_DEPTH = 32;
export const MAX_NAME_LENGTH = 120;
export const MAX_SECTIONS = 200;
export const MAX_BULLETS = 2000;
export const MAX_TOPICS = 200;
export const MAX_TEXT_LENGTH = 10000;
export const MAP_WIDTH = 1440;
export const MAP_HEIGHT = 896;
export const MAP_GRID = 32;
export const MAP_TOPIC_WIDTH = 160;
export const MAP_TOPIC_HEIGHT = 56;
export const MAP_MAX_X = Math.floor((MAP_WIDTH - MAP_TOPIC_WIDTH) / MAP_GRID) * MAP_GRID;
export const MAP_MAX_Y = Math.floor((MAP_HEIGHT - MAP_TOPIC_HEIGHT) / MAP_GRID) * MAP_GRID;

const tree = createTreeOperations<LibraryItem>({ children: item => item.kind === 'group' ? item.children : null, maxDepth: MAX_DEPTH });
export const { findItem, firstEntry, countItems, deleteItem, canMove, moveItem, groupOptions } = tree;

export function createSection(): GuideSection { return { id: createId(), title: '', bullets: [] }; }
export function createListGuideData(): ListGuideData { return { sections: [] }; }
export function createMapGuideData(): MapGuideData { return { topics: [], connections: [], startTopicId: null }; }
export function createGroup(): Group { return { id: createId(), kind: 'group', name: 'New group', children: [] }; }

export function insertGuide(items: LibraryItem[], target: GuideTarget, mode: GuideMode): GuideItem {
  if (countItems(items) >= MAX_ITEMS) throw new Error('The Guide library supports ' + MAX_ITEMS + ' items.');
  const parent = target.parentId ? findItem(items, target.parentId) : null;
  if (target.parentId && (!parent || parent.item.kind !== 'group')) throw new Error('The destination group no longer exists.');
  if (parent && parent.depth >= MAX_DEPTH) throw new Error('Groups can be at most ' + MAX_DEPTH + ' levels deep.');
  const base = { id: createId(), kind: 'guide' as const, name: 'New guide' };
  const item: GuideItem = mode === 'list'
    ? { ...base, mode, data: createListGuideData() }
    : { ...base, mode, data: createMapGuideData() };
  const selected = target.selectedId ? findItem(items, target.selectedId) : null;
  if (selected?.item.kind === 'guide' && selected.parentId === target.parentId) selected.siblings.splice(selected.index + 1, 0, item);
  else (parent?.item.kind === 'group' ? parent.item.children : items).unshift(item);
  return item;
}

export function countGuides(items: LibraryItem[]): number {
  return items.reduce((count, item) => count + (item.kind === 'group' ? countGuides(item.children) : 1), 0);
}
export function guideIsEmpty(item: GuideItem): boolean {
  if (item.mode === 'map') return item.data.topics.length === 0;
  return item.data.sections.every(section => !section.title.trim() && section.bullets.every(bullet => !bullet.trim()));
}

function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) throw new Error(label + ' is too long or invalid.');
}
function listData(value: unknown, ids: Set<string>): asserts value is ListGuideData {
  if (!isRecord(value) || !Array.isArray(value.sections) || Object.keys(value).some(key => key !== 'sections') || value.sections.length > MAX_SECTIONS)
    throw new Error('A Guide list has invalid sections.');
  let bullets = 0;
  for (const section of value.sections) {
    if (!isRecord(section) || !isValidId(section.id) || ids.has(section.id) || !Array.isArray(section.bullets) ||
        Object.keys(section).some(key => !['id','title','bullets'].includes(key))) throw new Error('A Guide section is invalid.');
    ids.add(section.id); text(section.title, 'Section title');
    bullets += section.bullets.length;
    if (bullets > MAX_BULLETS) throw new Error('A Guide can contain up to ' + MAX_BULLETS + ' bullets.');
    for (const bullet of section.bullets) text(bullet, 'Bullet');
  }
}
function mapData(value: unknown, ids: Set<string>): asserts value is MapGuideData {
  if (!isRecord(value) || !Array.isArray(value.topics)) throw new Error('A Guide map has invalid topics.');

  if (!Object.hasOwn(value, 'connections')) value.connections = [];
  if (!Object.hasOwn(value, 'startTopicId')) {
    const first = value.topics[0];
    value.startTopicId = isRecord(first) && isValidId(first.id) ? first.id : null;
  }

  if (!Array.isArray(value.connections) ||
      Object.keys(value).some(key => !['topics','connections','startTopicId','session'].includes(key)) ||
      value.topics.length > MAX_TOPICS) throw new Error('A Guide map is invalid.');

  const topicIds = new Set<string>();
  const topicBulletCounts = new Map<string, number>();
  for (const topic of value.topics) {
    if (!isRecord(topic) || !isValidId(topic.id) || ids.has(topic.id) ||
        Object.keys(topic).some(key => !['id','title','description','x','y','guide'].includes(key)) ||
        typeof topic.x !== 'number' || !Number.isInteger(topic.x) || topic.x < 0 || topic.x > MAP_MAX_X || topic.x % MAP_GRID !== 0 ||
        typeof topic.y !== 'number' || !Number.isInteger(topic.y) || topic.y < 0 || topic.y > MAP_MAX_Y || topic.y % MAP_GRID !== 0)
      throw new Error('A Guide map topic is invalid.');
    ids.add(topic.id); topicIds.add(topic.id); text(topic.title, 'Topic title');
    if (Object.hasOwn(topic, 'description')) text(topic.description, 'Topic description');
    listData(topic.guide, ids);
    topicBulletCounts.set(topic.id, topic.guide.sections.reduce((sum, section) =>
      sum + section.bullets.filter(bullet => bullet.trim()).length, 0));
  }

  if (value.startTopicId !== null && (!isValidId(value.startTopicId) || !topicIds.has(value.startTopicId))) {
    throw new Error('The Guide map starting topic is invalid.');
  }
  if (value.topics.length && value.startTopicId === null) value.startTopicId = value.topics[0].id;

  const pairs = new Set<string>();
  const acceptedConnections: MapConnection[] = [];
  const adjacency = new Map<string, Set<string>>();
  for (const topicId of topicIds) adjacency.set(topicId, new Set());

  function alreadyConnected(first: string, second: string): boolean {
    const reached = new Set<string>([first]);
    const pending = [first];
    while (pending.length) {
      const current = pending.shift();
      if (!current) break;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (neighbor === second) return true;
        if (reached.has(neighbor)) continue;
        reached.add(neighbor);
        pending.push(neighbor);
      }
    }
    return false;
  }

  for (const connection of value.connections) {
    if (!isRecord(connection) || !isValidId(connection.id) || ids.has(connection.id) ||
        Object.keys(connection).some(key => !['id','from','to'].includes(key)) ||
        !isValidId(connection.from) || !isValidId(connection.to) ||
        connection.from === connection.to || !topicIds.has(connection.from) || !topicIds.has(connection.to)) {
      throw new Error('A Guide map connection is invalid.');
    }
    const pair = [connection.from, connection.to].sort().join(':');
    if (pairs.has(pair)) throw new Error('A Guide map contains a duplicate connection.');
    pairs.add(pair);
    ids.add(connection.id);

    // v0.3.0 briefly allowed arbitrary undirected graphs. Keep those maps loadable
    // by preserving saved connection order and dropping only edges that close a loop.
    if (alreadyConnected(connection.from, connection.to)) continue;
    acceptedConnections.push({ id: connection.id, from: connection.from, to: connection.to });
    adjacency.get(connection.from)?.add(connection.to);
    adjacency.get(connection.to)?.add(connection.from);
  }
  value.connections = acceptedConnections;

  if (Object.hasOwn(value, 'session')) {
    const session = value.session;
    if (!isRecord(session) ||
        Object.keys(session).some(key => !['paused', 'currentId', 'openedIds', 'visitedIds', 'skippedIds', 'revealed'].includes(key)) ||
        typeof session.paused !== 'boolean' ||
        !isValidId(session.currentId) ||
        !Array.isArray(session.openedIds) || !Array.isArray(session.visitedIds) || !Array.isArray(session.skippedIds) ||
        !isRecord(session.revealed)) {
      throw new Error('The saved Guide map adventure is invalid.');
    }
    const ids = [session.openedIds, session.visitedIds, session.skippedIds];
    for (const entries of ids) {
      if (entries.length > MAX_TOPICS || entries.some(id => !isValidId(id)) || new Set(entries).size !== entries.length)
        throw new Error('The saved Guide map adventure has invalid stop references.');
    }
    if (Object.keys(session.revealed).length > MAX_TOPICS ||
        Object.entries(session.revealed).some(([id, count]) => !isValidId(id) || typeof count !== 'number' ||
          !Number.isInteger(count) || count < 0 || count > MAX_BULLETS)) {
      throw new Error('The saved Guide map adventure has invalid reveal counts.');
    }

    // Authored maps can change after studying. Prune stale references without
    // making an otherwise valid backup unloadable when a topic was removed.
    if (!topicIds.size) {
      delete value.session;
    } else {
      const currentId = topicIds.has(session.currentId) ? session.currentId
        : value.startTopicId ?? value.topics[0].id;
      const openedIds = session.openedIds.filter(id => topicIds.has(id));
      const visitedIds = session.visitedIds.filter(id => topicIds.has(id));
      const skippedIds = session.skippedIds.filter(id => visitedIds.includes(id));
      const revealed = Object.fromEntries(Object.entries(session.revealed)
        .filter(([id]) => topicIds.has(id))
        .map(([id, count]) => {
          return [id, Math.min(count as number, topicBulletCounts.get(id) ?? 0)];
        }));
      value.session = { paused: session.paused, currentId, openedIds, visitedIds, skippedIds, revealed };
    }
  }
}

export function validateGuide(value: unknown): asserts value is GuideModel {
  if (!isRecord(value) || !Array.isArray(value.items) || Object.keys(value).some(key => key !== 'items')) throw new Error('The Guide library is invalid.');
  const ids = new Set<string>(); let count = 0;
  function visit(items: unknown[], depth: number): void {
    if (items.length && depth > MAX_DEPTH) throw new Error('Guide groups are nested too deeply.');
    for (const item of items) {
      if (!isRecord(item) || !isValidId(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > MAX_NAME_LENGTH)
        throw new Error('A Guide item has an invalid name or duplicate ID.');
      ids.add(item.id); if (++count > MAX_ITEMS) throw new Error('The Guide library is too large.');
      if (item.kind === 'group') {
        if (!Array.isArray(item.children) || Object.keys(item).some(key => !['id','kind','name','children'].includes(key))) throw new Error('A Guide group is invalid.');
        visit(item.children, depth + 1);
      } else {
        if (item.kind !== 'guide' || (item.mode !== 'list' && item.mode !== 'map') ||
            Object.keys(item).some(key => !['id','kind','name','mode','data'].includes(key))) throw new Error('A Guide entry is invalid.');
        if (item.mode === 'list') listData(item.data, ids); else mapData(item.data, ids);
      }
    }
  }
  visit(value.items, 1);
}
