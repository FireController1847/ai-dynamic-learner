import { computed, defineComponent, h, type PropType, type VNode } from 'vue';
import { MAP_PADDING, MAP_CANVAS_HEIGHT, MAP_CANVAS_WIDTH } from './map-presentation.ts';
import { MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH, type GuideMapPattern, type MapTopic } from './library-model.ts';

export const GUIDE_MAP_PATTERNS: readonly { value: GuideMapPattern; label: string }[] = [
  { value: 'water', label: 'Water · rippling waves' },
  { value: 'contours', label: 'Contours · topographic curves' },
  { value: 'constellations', label: 'Constellations · connected stars' },
  { value: 'flow', label: 'Flow · drifting streamlines' },
  { value: 'plain', label: 'Plain · no pattern' },
];

type Point = { x: number; y: number };
const W = MAP_CANVAS_WIDTH, H = MAP_CANVAS_HEIGHT;
const fmt = (v: number) => Number(v.toFixed(1));
const hash = (n: number) => {
  const a = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return a - Math.floor(a);
};
const center = (topic: MapTopic): Point => ({
  x: topic.x + MAP_PADDING + MAP_TOPIC_WIDTH / 2,
  y: topic.y + MAP_PADDING + MAP_TOPIC_HEIGHT / 2,
});
const pointDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** All surfaces are deterministic functions of the authored stop positions. */
function water(topics: readonly Point[]): VNode[] {
  const waves: VNode[] = [];
  for (let row = 0; row < 18; row++) {
    const baseY = 30 + row * 58;
    const coords: string[] = [];
    for (let x = 0; x <= W; x += 28) {
      let y = baseY + 9 * Math.sin(x / 105 + row * 0.58);
      for (const stop of topics.slice(0, 50)) {
        const dx = x - stop.x, dy = baseY - stop.y;
        const influence = Math.exp(-(dx * dx + dy * dy) / 34000);
        y += influence * 11 * Math.sin(dx / 50 + row * 0.32);
      }
      coords.push((x === 0 ? 'M' : 'L') + fmt(x) + ' ' + fmt(y));
    }
    waves.push(h('path', { key: 'wave-' + row, class: 'guide-pattern-line', d: coords.join(' ') }));
  }
  topics.slice(0, 45).forEach((stop, i) => {
    waves.push(h('circle', { key: 'pool-' + i, cx: stop.x, cy: stop.y,
      r: 74 + (i % 3) * 16, class: 'guide-pattern-ring' }));
  });
  return waves;
}

/** Modulated polar contours give each stop a small, organic topographic basin. */
function contours(topics: readonly Point[]): VNode[] {
  const paths: VNode[] = [];
  const count = topics.length > 24 ? 3 : 5;
  for (const [i, stop] of topics.slice(0, 60).entries()) {
    for (let ring = 0; ring < count; ring++) {
      const radius = 39 + ring * 28;
      const coords: string[] = [];
      const phase = hash(i + 19) * Math.PI * 2;
      for (let j = 0; j <= 48; j++) {
        const theta = j / 48 * 2 * Math.PI;
        const mod = 1 + 0.09 * Math.sin(theta * 4 + phase) +
          0.055 * Math.cos(theta * 7 - phase * 0.7);
        const x = stop.x + Math.cos(theta) * radius * mod;
        const y = stop.y + Math.sin(theta) * radius * mod * 0.78;
        coords.push((j ? 'L' : 'M') + fmt(x) + ' ' + fmt(y));
      }
      paths.push(h('path', { key: 'contour-' + i + '-' + ring,
        class: ring === 0 ? 'guide-pattern-accent' : 'guide-pattern-line',
        d: coords.join(' ') + ' Z' }));
    }
  }
  return paths;
}

/** Seeded Voronoi-like star neighborhoods join the authored stop positions. */
function constellations(topics: readonly Point[]): VNode[] {
  const stars: Point[] = [];
  for (let i = 0; i < 115; i++) {
    stars.push({ x: 24 + hash(i * 2 + 1) * (W - 48),
      y: 24 + hash(i * 2 + 2) * (H - 48) });
  }
  const shapes: VNode[] = [];
  for (const [i, star] of stars.entries()) {
    const nearestStop = topics.reduce<{ dist: number; point: Point | null }>((best, candidate) => {
      const dist = pointDistance(star, candidate);
      return dist < best.dist ? { dist, point: candidate } : best;
    }, { dist: Infinity, point: null });
    if (nearestStop.point && nearestStop.dist < 225) {
      shapes.push(h('line', { key: 'link-' + i, class: 'guide-pattern-line',
        x1: star.x, y1: star.y, x2: nearestStop.point.x, y2: nearestStop.point.y }));
    }
    shapes.push(h('circle', { key: 'star-' + i, cx: star.x, cy: star.y,
      r: i % 9 === 0 ? 2.4 : 1.3, class: 'guide-pattern-dot' }));
  }
  topics.slice(0, 65).forEach((stop, i) =>
    shapes.push(h('circle', { key: 'anchor-' + i, cx: stop.x, cy: stop.y,
      r: 30, class: 'guide-pattern-ring' })));
  return shapes;
}

/** Streamlines integrate a smooth, stop-distorted vector field. */
function flow(topics: readonly Point[]): VNode[] {
  const paths: VNode[] = [];
  for (let row = 0; row < 26; row++) {
    let x = 0, y = row * 41 + 5;
    const coords = ['M' + fmt(x) + ' ' + fmt(y)];
    for (let step = 0; step < 73 && x < W + 20; step++) {
      let turn = Math.sin(x / 170 + row * 0.22) * 0.38;
      for (const stop of topics.slice(0, 45)) {
        const dx = x - stop.x, dy = y - stop.y;
        const weight = Math.exp(-(dx * dx + dy * dy) / 57000);
        turn += weight * (dy >= 0 ? 0.65 : -0.65) * Math.cos(dx / 145);
      }
      x += 22;
      y += Math.max(-12, Math.min(12, turn * 10));
      coords.push('L' + fmt(x) + ' ' + fmt(y));
    }
    paths.push(h('path', { key: 'flow-' + row, class: 'guide-pattern-line', d: coords.join(' ') }));
  }
  topics.slice(0, 65).forEach((stop, i) => paths.push(h('circle', { key: 'eddy-' + i,
    cx: stop.x, cy: stop.y, r: 45, class: 'guide-pattern-ring' })));
  return paths;
}

export const GuideMapBackdrop = defineComponent({
  name: 'GuideMapBackdrop',
  props: {
    pattern: { type: String as PropType<GuideMapPattern>, required: true },
    topics: { type: Array as PropType<readonly MapTopic[]>, required: true },
  },
  setup(props) {
    const geometry = computed(() => {
      if (props.pattern === 'plain') return [];
      const stops = props.topics.map(center);
      if (props.pattern === 'water') return water(stops);
      if (props.pattern === 'contours') return contours(stops);
      if (props.pattern === 'constellations') return constellations(stops);
      return flow(stops);
    });
    return () => h('svg', {
      class: ['guide-map-backdrop', 'is-' + props.pattern], viewBox: '0 0 ' + W + ' ' + H,
      width: W, height: H, 'aria-hidden': 'true', focusable: 'false',
    }, geometry.value);
  },
});
