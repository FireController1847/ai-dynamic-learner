import { featureGroups, type FeatureDefinition } from '../features/feature-definitions.ts';
import { AppIcon, type AppIconName } from './app-icon.ts';
export interface NavigationItem extends FeatureDefinition { href: string }
import { Icon } from '../components/icon.ts';

import { defineComponent, type PropType, h, Transition } from 'vue';

const primaryGroups = featureGroups.filter(group => group.id !== 'tools');

export const NavigationDrawer = defineComponent({
  name: 'NavigationDrawer',
  props: {
    open: Boolean,
    title: { type: String, required: true },
    logoName: { type: String as PropType<AppIconName>, default: 'dynamic-learner' },
    homeHref: { type: String, required: true },
    changelogHref: { type: String, required: true },
    items: { type: Array as PropType<NavigationItem[]>, required: true },
    activePath: { type: String, required: true },
  },
  emits: { 'close': () => true, 'navigate': (_event: MouseEvent, _path: string) => true, 'closed': () => true },
  setup(props, { emit, slots }) {
    function navigationItem(item: NavigationItem) {
      return h('li', { key: item.id }, [
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
      ]);
    }

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
            'aria-label': 'Go to ' + props.title + ' home',
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
        h('nav', { class: 'drawer-navigation', 'aria-label': 'Learning apps' }, [
          (() => {
            const tools = props.items.filter(item => item.group === 'tools');
            return tools.length ? h('details', {
              class: 'navigation-tools',
              open: tools.some(item => item.path === props.activePath) || undefined,
            }, [
              h('summary', { class: 'navigation-tools-summary' }, [
                h('span', 'Tools'),
                h(Icon, { name: 'chevron-down' }),
              ]),
              h('ul', { class: 'navigation-tools-list' }, tools.map(navigationItem)),
            ]) : null;
          })(),
          h('div', { class: 'navigation-primary' }, primaryGroups.flatMap(group => {
            const items = props.items.filter(item => item.group === group.id);
            return items.length ? [h('section', {
              key: group.id,
              class: 'navigation-group',
              'aria-labelledby': 'navigation-group-' + group.id,
            }, [
              h('h2', { id: 'navigation-group-' + group.id, class: 'navigation-group-heading' }, group.label),
              h('ul', items.map(navigationItem)),
            ])] : [];
          })),
        ]),
        slots.footer ? h('div', { class: 'drawer-footer' }, [
          h('nav', { class: 'drawer-utility-navigation', 'aria-label': 'Project information' }, [
            h('a', {
              href: props.changelogHref,
              class: 'quiet-button drawer-utility-link',
              'aria-current': props.activePath === '/changelog/' ? 'page' : undefined,
              onClick: (event: MouseEvent) => emit('navigate', event, '/changelog/'),
            }, [h(Icon, { name: 'history-settings' }), 'Changelog']),
          ]),
          slots.footer(),
        ]) : null,
      ])]) : null,
    });
  },
});
