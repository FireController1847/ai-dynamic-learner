export interface TreeItem {
  id: string;
  name: string;
}

export interface TreeItemLocation<T extends TreeItem> {
  item: T;
  siblings: T[];
  index: number;
  parentId: string | null;
  depth: number;
}

export type TreeMovePosition = 'before' | 'after' | 'inside';

export interface TreeGroupOption {
  id: string;
  label: string;
}

export interface TreeOperationsOptions<T extends TreeItem> {
  children(item: T): T[] | null;
  maxDepth: number;
}

export function createTreeOperations<T extends TreeItem>(options: TreeOperationsOptions<T>) {
  function findItem(
    items: T[],
    id: string | null | undefined,
    parentId: string | null = null,
    depth = 1,
  ): TreeItemLocation<T> | null {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.id === id) return { item, siblings: items, index, parentId, depth };
      const children = options.children(item);
      if (children) {
        const found = findItem(children, id, item.id, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  function countItems(items: T[]): number {
    return items.reduce((count, item) => {
      const children = options.children(item);
      return count + 1 + (children ? countItems(children) : 0);
    }, 0);
  }

  function deleteItem(items: T[], id: string): T | null {
    const found = findItem(items, id);
    if (!found) return null;
    return found.siblings.splice(found.index, 1)[0];
  }

  function subtreeDepth(item: T): number {
    const children = options.children(item);
    return children?.length ? 1 + Math.max(...children.map(subtreeDepth)) : 1;
  }

  function planMove(
    items: T[],
    sourceId: string,
    targetId: string | null,
    position: TreeMovePosition,
  ) {
    const source = findItem(items, sourceId);
    const target = targetId ? findItem(items, targetId) : null;
    if (!source || (targetId && !target) || sourceId === targetId) return null;
    if (!['before', 'after', 'inside'].includes(position)) return null;

    const targetChildren = target ? options.children(target.item) : null;
    if (target && position === 'inside' && !targetChildren) return null;

    const parentId = target ? (position === 'inside' ? targetId : target.parentId) : null;
    const sourceChildren = options.children(source.item);
    if (parentId === sourceId || (sourceChildren && findItem(sourceChildren, parentId))) return null;

    const depth = target ? target.depth + (position === 'inside' ? 1 : 0) : 1;
    if (depth + subtreeDepth(source.item) - 1 > options.maxDepth) return null;

    const destination = !target ? items
      : position === 'inside' ? targetChildren!
        : target.siblings;
    const index = !target ? (position === 'before' ? 0 : items.length)
      : position === 'inside' ? destination.length
        : target.index + (position === 'after' ? 1 : 0);

    return { source, destination, index };
  }

  function canMove(
    items: T[],
    sourceId: string,
    targetId: string | null,
    position: TreeMovePosition,
  ): boolean {
    return Boolean(planMove(items, sourceId, targetId, position));
  }

  function moveItem(
    items: T[],
    sourceId: string,
    targetId: string | null,
    position: TreeMovePosition,
  ): boolean {
    const plan = planMove(items, sourceId, targetId, position);
    if (!plan) return false;
    let { source, destination, index } = plan;
    if (source.siblings === destination && source.index < index) index -= 1;
    source.siblings.splice(source.index, 1);
    destination.splice(index, 0, source.item);
    return true;
  }

  function groupOptions(
    items: T[],
    excludedId: string | null,
    trail: string[] = [],
  ): TreeGroupOption[] {
    return items.flatMap((item) => {
      const children = options.children(item);
      if (!children || item.id === excludedId) return [];
      const path = [...trail, item.name];
      return [
        { id: item.id, label: path.join(' / ') },
        ...groupOptions(children, excludedId, path),
      ];
    });
  }

  return { findItem, countItems, deleteItem, canMove, moveItem, groupOptions };
}
