import { appConfig } from './app-config.ts';
import { pageHref } from './navigation.ts';
import { featureDefinitions } from '../features/feature-definitions.ts';
import { Icon } from '../components/icon.ts';

import { defineComponent, type PropType, h, onMounted, onBeforeUnmount, ref } from 'vue';

export const HomePage = defineComponent({
  name: 'HomePage',
  emits: { 'navigate': (_event: MouseEvent, _path: string) => true },
  setup(props, { emit }) {
    const today = ref(new Date());
    const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' });
    const refreshDate = () => { today.value = new Date(); };
    let timer: number | undefined;
    onMounted(() => {
      timer = window.setInterval(refreshDate, 60000);
      document.addEventListener('visibilitychange', refreshDate);
    });
    onBeforeUnmount(() => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDate);
    });

    return () => {
      const date = today.value;
      const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return h('div', { class: 'home-page' }, [
        h('section', { 'aria-labelledby': 'home-apps-title' }, [
          h('h2', { id: 'home-apps-title' }, 'Your learning apps'),
          h('p', { class: 'home-intro' }, 'Choose a place to begin.'),
          h('ul', { class: 'home-app-grid' }, featureDefinitions.filter((feature) => !feature.hidden).map((feature) =>
            h('li', { key: feature.id }, [
              h('a', {
                class: 'home-app-card', href: pageHref(feature.path),
                onClick: (event: MouseEvent) => emit('navigate', event, feature.path),
              }, [
                feature.image
                  ? h('img', {
                    class: 'home-app-icon',
                    src: new URL(feature.image, document.baseURI).href,
                    alt: '',
                    'aria-hidden': 'true',
                  })
                  : feature.icon ? h(Icon, { name: feature.icon }) : null,
                h('h3', feature.label),
                h('p', feature.description),
                h('span', { class: 'home-app-open' }, ['Open ', feature.label, h(Icon, { name: 'chevron' })]),
              ]),
            ]))),
        ]),
        h('footer', { class: 'home-footer' }, [
          h('p', 'Your workspace saves in this browser. Keep a downloadable backup from the navigation menu.'),
          h('div', { class: 'home-footer-details' }, [
            h('span', ['Licensed under ', h('a', {
              href: `${appConfig.repositoryUrl}/blob/main/LICENSE`,
            }, appConfig.license)]),
            h('a', { href: appConfig.repositoryUrl }, 'GitHub repository'),
            h('span', ['Today · ', h('time', { datetime: dateValue }, formatter.format(date))]),
          ]),
        ]),
      ]);
    };
  },
});
