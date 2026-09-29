import { Icon } from '../components/icon.js';

import { h, Transition } from 'vue';

export const NavigationDrawer = {
  name: 'NavigationDrawer',
  props: {
    open: Boolean,
    title: { type: String, required: true },
    logoSrc: { type: String, default: '' },
    homeHref: { type: String, required: true },
    items: { type: Array, required: true },
    activePath: { type: String, required: true },
  },
  emits: ['close', 'navigate', 'closed'],
  setup(props, { emit, slots }) {
    return () => h(Transition, {
      name: 'drawer',
      onEnter: (element) => element.showModal(),
      onAfterLeave: () => emit('closed'),
    }, {
      default: () => props.open ? h('dialog', {
        id: 'app-navigation',
        class: 'navigation-drawer',
        'aria-label': 'Application navigation',
        onCancel: (event) => {
          event.preventDefault();
          emit('close');
        },
        onClick: (event) => {
          if (event.target === event.currentTarget) emit('close');
        },
      }, [h('div', { class: 'drawer-panel' }, [
        h('div', { class: 'drawer-header' }, [
          h('a', {
            class: 'drawer-brand',
            href: props.homeHref,
            'aria-label': `Go to ${props.title} home`,
            onClick: (event) => emit('navigate', event, '/'),
          }, [
            props.logoSrc ? h('img', { class: 'app-logo drawer-logo', src: props.logoSrc, alt: '', 'aria-hidden': 'true' }) : null,
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
              onClick: (event) => emit('navigate', event, item.path),
            }, [
              item.imageSrc ? h('img', {
                class: 'navigation-link-icon',
                src: item.imageSrc,
                alt: '',
                'aria-hidden': 'true',
              }) : item.icon ? h(Icon, { name: item.icon }) : null,
              h('span', item.label),
            ]),
          ]))),
        ]),
        slots.footer ? h('div', { class: 'drawer-footer' }, slots.footer()) : null,
      ])]) : null,
    });
  },
};
