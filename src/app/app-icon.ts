import type { FeatureId } from '../features/feature-definitions.ts';

import { defineComponent, h, type PropType } from 'vue';

export type AppIconName = FeatureId | 'dynamic-learner';
type AppIconFormat = 'webp' | 'png' | 'gif';

function appIconUrl(name: AppIconName, format: AppIconFormat): string {
  return new URL(`assets/app-icons/${format}/${name}.${format}`, document.baseURI).href;
}

export const AppIcon = defineComponent({
  name: 'AppIcon',
  props: {
    name: { type: String as PropType<AppIconName>, required: true },
    imageClass: { type: String, default: '' },
  },
  setup(props) {
    return () => props.name === 'anatomy' ? h('img', {
      class: props.imageClass,
      src: new URL('assets/app-icons/anatomy.svg', document.baseURI).href,
      width: 256, height: 256, alt: '', 'aria-hidden': 'true',
    }) : h('picture', { class: 'app-icon-picture' }, [
      h('source', { type: 'image/webp', srcset: appIconUrl(props.name, 'webp') }),
      h('source', { type: 'image/png', srcset: appIconUrl(props.name, 'png') }),
      h('img', {
        class: props.imageClass,
        src: appIconUrl(props.name, 'gif'),
        width: 256,
        height: 256,
        alt: '',
        'aria-hidden': 'true',
      }),
    ]);
  },
});
