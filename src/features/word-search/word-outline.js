const { h } = window.Vue;

// One rounded capsule per word, including diagonal and overlapping words.
export function wordOutline(start, end, size, key, kind, point = null, word = '') {
  const x = start % size + 0.5;
  const y = Math.floor(start / size) + 0.5;
  const dx = (point?.x ?? end % size + 0.5) - x;
  const dy = (point?.y ?? Math.floor(end / size) + 0.5) - y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const halfLabel = word.length * 0.065;
  const diagonal = dx !== 0 && dy !== 0;

  let labelAngle = angle;
  if (labelAngle > 90) labelAngle -= 180;
  else if (labelAngle < -90) labelAngle += 180;

  const length = Math.hypot(dx, dy);
  const midpointX = x + dx / 2;
  const midpointY = y + dy / 2;
  const normalX = length ? -dy / length : 0;
  const normalY = length ? dx / length : 0;

  return h('g', { key, class: ['word-search-outline', `outline-${kind}`] }, [
    h('g', { style: { transform: `translate(${x}px, ${y}px) rotate(${angle}deg)` } }, [
      h('rect', { x: -0.4, y: -0.4, width: length + 0.8, height: 0.8, rx: 0.4 }),
    ]),
    word ? diagonal
      ? h('text', {
        class: 'word-search-outline-label',
        x: midpointX + normalX * 0.62,
        y: midpointY + normalY * 0.62,
        transform: `rotate(${labelAngle} ${midpointX + normalX * 0.62} ${midpointY + normalY * 0.62})`,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        direction: 'ltr',
        'unicode-bidi': 'isolate',
      }, word)
      : h('text', {
        class: 'word-search-outline-label',
        x: Math.max(halfLabel + 0.05, Math.min(size - halfLabel - 0.05, midpointX)),
        y: Math.min(size + 0.06, Math.max(y, y + dy) + 0.6),
        'text-anchor': 'middle',
        direction: 'ltr',
        'unicode-bidi': 'isolate',
      }, word)
      : null,
  ]);
}
