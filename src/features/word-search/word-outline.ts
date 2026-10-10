import { h } from 'vue';
import type { VNode } from 'vue';

export interface GridPoint { x: number; y: number }

function readableAngle(angle: number): number {
  let value = ((angle % 360) + 360) % 360;
  if (value > 180) value -= 360;
  if (value > 90) value -= 180;
  else if (value < -90) value += 180;
  return value;
}

// One rounded capsule per word, including diagonal and overlapping words.
export function wordOutline(start: number, end: number, size: number, key: string | number,
  kind: string, point: GridPoint | null = null, word = '', boardRotation = 0): VNode {
  const x = start % size + 0.5;
  const y = Math.floor(start / size) + 0.5;
  const dx = (point?.x ?? end % size + 0.5) - x;
  const dy = (point?.y ?? Math.floor(end / size) + 0.5) - y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const halfLabel = word.length * 0.065;
  const sideLabel = dy !== 0;
  const length = Math.hypot(dx, dy);
  const midpointX = x + dx / 2;
  const midpointY = y + dy / 2;
  const normalX = length ? -dy / length : 0;
  const normalY = length ? dx / length : 0;

  const labelX = sideLabel
    ? midpointX + normalX * 0.62
    : Math.max(halfLabel + 0.05, Math.min(size - halfLabel - 0.05, midpointX));
  const labelY = sideLabel
    ? midpointY + normalY * 0.62
    : Math.min(size + 0.06, Math.max(y, y + dy) + 0.6);

  const visualLabelAngle = readableAngle(angle + boardRotation);
  const localLabelAngle = visualLabelAngle - boardRotation;

  return h('g', { key, class: ['word-search-outline', `outline-${kind}`] }, [
    h('g', { style: { transform: `translate(${x}px, ${y}px) rotate(${angle}deg)` } }, [
      h('rect', { x: -0.4, y: -0.4, width: length + 0.8, height: 0.8, rx: 0.4 }),
    ]),
    word ? h('g', {
      class: 'word-search-outline-label-turn',
      style: {
        transform: `translate(${labelX}px, ${labelY}px) rotate(${localLabelAngle}deg)`,
      },
    }, [
      h('text', {
        class: 'word-search-outline-label',
        x: 0,
        y: 0,
        'text-anchor': 'middle',
        'dominant-baseline': sideLabel ? 'middle' : null,
        direction: 'ltr',
        'unicode-bidi': 'isolate',
      }, word),
    ]) : null,
  ]);
}
