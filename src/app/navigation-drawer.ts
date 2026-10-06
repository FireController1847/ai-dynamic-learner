import type { FeatureDefinition } from '../features/feature-definitions.ts';
import { AppIcon, type AppIconName } from './app-icon.ts';
export interface NavigationItem extends FeatureDefinition { href: string }
import { Icon } from '../components/icon.ts';

import { defineComponent, type PropType, h, Transition } from 'vue';

export const NavigationDrawer = defineComponent({
  name: 'NavigationDrawer',
  props: {
    open: Boolean,
    title: { type: String, required: true },
    logoName: { type: String as PropType<AppIconName>, default: 'dynamic-learner' },
    homeHref: { type: String, required: true },
    items: { type: Array as PropType<NavigationItem[]>, required: true },
    activePath: { type: String, required: true },
  },
  emits: { 'close': () => true, 'navigate': (_event: MouseEvent, _path: string) => true, 'closed': () => true },
  setup(props, { emit, slots }) {
    return () => h(Transition, {
      name: 'drawer',
      onEnter: (element) => { if (element instanceof HTMLDialogElement) element.showModal(); },
      onAfterLeave: () => emit('closed'),
    }, {
      default: () => props.open ? h('dialog', {
        id: 'app-navigation',
        class: 'navigation-drawer',
        'aria-label': 'Application navigation',
        onCancel: (event: Event) => {
          event.preventDefault();
          emit('close');
        },
        onClick: (event: MouseEvent) => {
          if (event.target === event.currentTarget) emit('close');
        },
      }, [h('div', { class: 'drawer-panel' }, [
        h('div', { class: 'drawer-header' }, [
          h('a', {
            class: 'drawer-brand',
            href: props.homeHref,
            'aria-label': `Go to ${props.title} home`,
            onClick: (event: MouseEvent) => emit('navigate', event, '/'),
          }, [
            h(AppIcon, { name: props.logoName, imageClass: 'app-logo drawer-logo' }),
            h('span', { class: 'drawer-title' }, props.title),
          ]),
          h('button', {
            type: 'button',
            class: 'menu-toggle',
            'aria-label': 'Close navigation',
            autofocus: true,
            onClick: () => emit('close'),
          }, [h('span', { 'aria-hidden': 'true' }, '×')]),
        ]),
        h('nav', { 'aria-label': 'Applications' }, [
          h('ul', props.items.map((item) => h('li', { key: item.id }, [
            h('a', {
              href: item.href,
              class: 'navigation-link',
              'aria-current': props.activePath === item.path ? 'page' : undefined,
              onClick: (event: MouseEvent) => emit('navigate', event, item.path),
            }, [
              item.image
                ? h(AppIcon, { name: item.id, imageClass: 'navigation-link-icon' })
                : item.icon ? h(Icon, { name: item.icon }) : null,
              h('span', item.label),
            ]),
          ]))),
        ]),
        slots.footer ? h('div', { class: 'drawer-footer' }, slots.footer()) : null,
      ])]) : null,
    });
  },
});
