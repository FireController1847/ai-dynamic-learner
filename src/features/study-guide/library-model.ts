import { createId, isValidId } from '../../core/ids.ts';
import { createTreeOperations, type TreeMovePosition } from '../../core/tree.ts';
import { isRecord } from '../../core/validation.ts';

export type StudyGuideMode = 'list' | 'map';
export interface GuideSection { id: string; title: string; bullets: string[] }
export interface ListGuideData { sections: GuideSection[] }
export interface MapTopic { id: string; title: string; x: number; y: number; guide: ListGuideData }
export interface MapGuideData { topics: MapTopic[] }
export type GuideItem =
  | { id: string; kind: 'guide'; name: string; mode: 'list'; data: ListGuideData }
  | { id: string; kind: 'guide'; name: string; mode: 'map'; data: MapGuideData };
export interface Group { id: string; kind: 'group'; name: string; children: LibraryItem[] }
export type LibraryItem = Group | GuideItem;
export interface StudyGuideModel { items: LibraryItem[] }
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

const tree = createTreeOperations<LibraryItem>({ children: item => item.kind === 'group' ? item.children : null, maxDepth: MAX_DEPTH });
export const { findItem, firstEntry, countItems, deleteItem, canMove, moveItem, groupOptions } = tree;

export function createSection(): GuideSection { return { id: createId(), title: '', bullets: [] }; }
export function createListGuideData(): ListGuideData { return { sections: [] }; }
export function createMapGuideData(): MapGuideData { return { topics: [] }; }
export function createGroup(): Group { return { id: createId(), kind: 'group', name: 'New group', children: [] }; }

export function insertGuide(items: LibraryItem[], target: GuideTarget, mode: StudyGuideMode): GuideItem {
  if (countItems(items) >= MAX_ITEMS) throw new Error('The Study Guide library supports ' + MAX_ITEMS + ' items.');
  const parent = target.parentId ? findItem(items, target.parentId) : null;
  if (target.parentId && (!parent || parent.item.kind !== 'group')) throw new Error('The destination group no longer exists.');
  if (parent && parent.depth >= MAX_DEPTH) throw new Error('Groups can be at most ' + MAX_DEPTH + ' levels deep.');
  const base = { id: createId(), kind: 'guide' as const, name: 'New study guide' };
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
    throw new Error('A Study Guide list has invalid sections.');
  let bullets = 0;
  for (const section of value.sections) {
    if (!isRecord(section) || !isValidId(section.id) || ids.has(section.id) || !Array.isArray(section.bullets) ||
        Object.keys(section).some(key => !['id','title','bullets'].includes(key))) throw new Error('A Study Guide section is invalid.');
    ids.add(section.id); text(section.title, 'Section title');
    bullets += section.bullets.length;
    if (bullets > MAX_BULLETS) throw new Error('A Study Guide can contain up to ' + MAX_BULLETS + ' bullets.');
    for (const bullet of section.bullets) text(bullet, 'Bullet');
  }
}
function mapData(value: unknown, ids: Set<string>): asserts value is MapGuideData {
  if (!isRecord(value) || !Array.isArray(value.topics) || Object.keys(value).some(key => key !== 'topics') || value.topics.length > MAX_TOPICS)
    throw new Error('A Study Guide map has invalid topics.');
  for (const topic of value.topics) {
    if (!isRecord(topic) || !isValidId(topic.id) || ids.has(topic.id) ||
        Object.keys(topic).some(key => !['id','title','x','y','guide'].includes(key)) ||
        typeof topic.x !== 'number' || !Number.isInteger(topic.x) || topic.x < 0 || topic.x > MAP_WIDTH ||
        typeof topic.y !== 'number' || !Number.isInteger(topic.y) || topic.y < 0 || topic.y > MAP_HEIGHT)
      throw new Error('A Study Guide map topic is invalid.');
    ids.add(topic.id); text(topic.title, 'Topic title'); listData(topic.guide, ids);
  }
}

export function validateStudyGuide(value: unknown): asserts value is StudyGuideModel {
  if (!isRecord(value) || !Array.isArray(value.items) || Object.keys(value).some(key => key !== 'items')) throw new Error('The Study Guide library is invalid.');
  const ids = new Set<string>(); let count = 0;
  function visit(items: unknown[], depth: number): void {
    if (items.length && depth > MAX_DEPTH) throw new Error('Study Guide groups are nested too deeply.');
    for (const item of items) {
      if (!isRecord(item) || !isValidId(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > MAX_NAME_LENGTH)
        throw new Error('A Study Guide item has an invalid name or duplicate ID.');
      ids.add(item.id); if (++count > MAX_ITEMS) throw new Error('The Study Guide library is too large.');
      if (item.kind === 'group') {
        if (!Array.isArray(item.children) || Object.keys(item).some(key => !['id','kind','name','children'].includes(key))) throw new Error('A Study Guide group is invalid.');
        visit(item.children, depth + 1);
      } else {
        if (item.kind !== 'guide' || (item.mode !== 'list' && item.mode !== 'map') ||
            Object.keys(item).some(key => !['id','kind','name','mode','data'].includes(key))) throw new Error('A Study Guide entry is invalid.');
        if (item.mode === 'list') listData(item.data, ids); else mapData(item.data, ids);
      }
    }
  }
  visit(value.items, 1);
}
