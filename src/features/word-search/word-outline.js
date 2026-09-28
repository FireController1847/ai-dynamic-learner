const { h } = window.Vue;

// One rounded capsule per word, including diagonal and overlapping words.
export function wordOutline(start, end, size, key, kind, point = null, word = '') {
  const x = start % size + 0.5;
  const y = Math.floor(start / size) + 0.5;
  const dx = (point?.x ?? end % size + 0.5) - x;
  const dy = (point?.y ?? Math.floor(end / size) + 0.5) - y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const halfLabel = word.length * 0.065;
  return h('g', { key, class: ['word-search-outline', `outline-${kind}`] }, [
    h('g', { style: { transform: `translate(${x}px, ${y}px) rotate(${angle}deg)` } }, [
      h('rect', { x: -0.4, y: -0.4, width: Math.hypot(dx, dy) + 0.8, height: 0.8, rx: 0.4 }),
    ]),
    // Keep the canonical word upright and LTR even when its grid letters run backward.
    word ? h('text', {
      class: 'word-search-outline-label',
      x: Math.max(halfLabel + 0.05, Math.min(size - halfLabel - 0.05, x + dx / 2)),
      y: Math.min(size + 0.06, Math.max(y, y + dy) + 0.6),
      'text-anchor': 'middle', direction: 'ltr', 'unicode-bidi': 'isolate',
    }, word) : null,
  ]);
}
