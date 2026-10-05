import { h } from 'vue';
import type { SetModeId } from './set-modes.ts';

export function SetModeIcon({ mode }: { mode: SetModeId }) {
  const common = {
    class: 'index-cards-mode-icon',
    viewBox: '0 0 96 96',
    width: 96,
    height: 96,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2.5,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };

  if (mode === 'flash-cards') {
    return h('svg', common, [
      h('path', { d: 'M22 26h54v42H22Z' }),
      h('path', { d: 'M16 20h54v6M28 68v8h48V34h-6' }),
      h('path', { d: 'M35 40h28M35 49h20M35 58h24' }),
    ]);
  }

  return h('svg', common, [
    h('path', { d: 'M23 13h42l10 10v60H23Z' }),
    h('path', { d: 'M65 13v12h10' }),
    h('path', { d: 'M34 40h29M34 51h9M53 51h10M34 62h15M58 62h5' }),
    h('path', { d: 'M43 54h10M49 65h9', 'stroke-dasharray': '3 4' }),
  ]);
}
