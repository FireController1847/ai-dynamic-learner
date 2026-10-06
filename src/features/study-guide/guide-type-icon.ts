import { h } from 'vue';
import type { StudyGuideMode } from './library-model.ts';
export function GuideTypeIcon({ mode, compact = false }: { mode: StudyGuideMode; compact?: boolean }) {
  const common = { class: compact ? 'ui-icon' : 'study-guide-mode-icon', viewBox: '0 0 96 96', width: compact ? 20 : 96, height: compact ? 20 : 96,
    fill: 'none', stroke: 'currentColor', 'stroke-width': compact ? 5 : 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'aria-hidden': 'true', focusable: 'false' };
  if (mode === 'list') return h('svg', common, [
    h('path', { d: 'M24 12h48v72H24z' }), h('path', { d: 'M34 28h28' }),
    ...[42,54,66].flatMap(y => [h('circle', { cx: 34, cy: y, r: 2, fill: 'currentColor', stroke: 'none' }), h('path', { d: 'M42 ' + y + 'h20' })]),
  ]);
  return h('svg', common, [
    h('path', { d: 'M18 20h60v56H18z', opacity: 0.35 }),
    h('path', { d: 'M28 65C35 44 48 61 54 40S70 33 69 24', 'stroke-width': 3 }),
    h('circle', { cx: 28, cy: 65, r: 6 }), h('circle', { cx: 54, cy: 40, r: 6 }), h('circle', { cx: 69, cy: 24, r: 6 }),
    ...[32,44,56,68].map(x => h('path', { d: 'M' + x + ' 18v60', opacity: 0.18 })),
    ...[32,44,56,68].map(y => h('path', { d: 'M16 ' + y + 'h64', opacity: 0.18 })),
  ]);
}
