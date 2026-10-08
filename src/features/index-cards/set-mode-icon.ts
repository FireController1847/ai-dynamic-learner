import { h } from 'vue';
import type { SetModeId } from './set-modes.ts';

export function SetModeIcon({ mode, compact = false }: { mode: SetModeId; compact?: boolean }) {
  const common = {
    class: compact ? 'ui-icon index-card-set-type-icon' : 'index-cards-mode-icon',
    viewBox: '0 0 96 96',
    width: compact ? 20 : 96,
    height: compact ? 20 : 96,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': compact ? 5 : 2.5,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };

  if (mode === 'flash-cards') {
    return h('svg', common, [
      h('rect', { x: 23, y: 25, width: 54, height: 38, rx: 4 }),
      h('path', { d: 'M18 32v38h52' }),
      h('path', { d: 'M31 38h34M31 48h24' }),
    ]);
  }

  return h('svg', common, [
    h('rect', { x: 19, y: 25, width: 58, height: 42, rx: 4 }),
    h('path', { d: 'M28 39h15M54 39h14M28 52h9M48 52h20' }),
    h('path', { d: 'M43 42h11M37 55h11', 'stroke-dasharray': compact ? '6 5' : '3 4' }),
  ]);
}
