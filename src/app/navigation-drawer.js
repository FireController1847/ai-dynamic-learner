const { h, Transition } = window.Vue;

export const NavigationDrawer = {
  name: 'NavigationDrawer',
  props: {
    open: Boolean,
    title: { type: String, required: true },
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
          h('span', { class: 'drawer-title' }, props.title),
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
              href: item.path,
              class: 'navigation-link',
              'aria-current': props.activePath === item.path ? 'page' : undefined,
              onClick: (event) => emit('navigate', event, item.path),
            }, item.label),
          ]))),
        ]),
        slots.footer ? h('div', { class: 'drawer-footer' }, slots.footer()) : null,
      ])]) : null,
    });
  },
};
