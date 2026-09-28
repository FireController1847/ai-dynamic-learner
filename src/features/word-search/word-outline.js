const { h } = window.Vue;

// One rounded capsule per word, including diagonal and overlapping words.
export function wordOutline(start, end, size, key, kind, point = null) {
  const x = start % size + 0.5;
  const y = Math.floor(start / size) + 0.5;
  const dx = (point?.x ?? end % size + 0.5) - x;
  const dy = (point?.y ?? Math.floor(end / size) + 0.5) - y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return h('g', {
    key, class: ['word-search-outline', `outline-${kind}`],
    style: { transform: `translate(${x}px, ${y}px) rotate(${angle}deg)` },
  }, [h('rect', { x: -0.4, y: -0.4, width: Math.hypot(dx, dy) + 0.8, height: 0.8, rx: 0.4 })]);
}
