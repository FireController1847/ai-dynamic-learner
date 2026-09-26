import { appConfig } from './app-config.js';
import { features } from '../features/feature-registry.js';
import { NavigationDrawer } from './navigation-drawer.js';
import { pageHref, useNavigation } from './navigation.js';
import { useWorkspace } from './workspace.js';
import { WorkspaceTools } from './workspace-tools.js';

const { computed, createApp, h, KeepAlive, nextTick, ref } = window.Vue;

const navigationItems = [{ id: 'home', label: 'Home', path: '/' }, ...features]
  .map((item) => ({ ...item, href: pageHref(item.path) }));

document.title = appConfig.name;

const App = {
  name: 'App',
  setup() {
    const workspace = useWorkspace();
    const sidebarOpen = ref(false);
    const menuButton = ref(null);
    const main = ref(null);
    let focusContentOnClose = false;
    const { currentPath, navigate } = useNavigation(onNavigate);
    const activeFeature = computed(() => features.find((feature) => feature.path === currentPath.value));

    function closeSidebar() {
      focusContentOnClose = false;
      sidebarOpen.value = false;
    }

    async function onNavigate() {
      focusContentOnClose = true;
      if (sidebarOpen.value) {
        sidebarOpen.value = false;
      } else {
        await nextTick();
        main.value?.focus();
      }
    }

    async function restoreFocus() {
      await nextTick();
      (focusContentOnClose ? main.value : menuButton.value)?.focus();
    }

    return () => h('div', {
      class: 'app-shell',
    }, [
      h('header', { class: 'app-header' }, [
        h('button', {
          ref: menuButton,
          type: 'button',
          class: 'menu-toggle',
          'aria-label': sidebarOpen.value ? 'Close navigation' : 'Open navigation',
          'aria-expanded': sidebarOpen.value,
          'aria-controls': 'app-navigation',
          onClick: () => { sidebarOpen.value = true; },
        }, [h('span', { class: 'menu-icon', 'aria-hidden': 'true' }, [
          h('span'), h('span'), h('span'),
        ])]),
        h('h1', activeFeature.value?.label ?? (currentPath.value === '/' ? appConfig.name : 'Page not found')),
      ]),
      h(NavigationDrawer, {
        open: sidebarOpen.value,
        title: appConfig.name,
        items: navigationItems,
        activePath: currentPath.value,
        onClose: closeSidebar,
        onNavigate: navigate,
        onClosed: restoreFocus,
      }, {
        footer: () => h(WorkspaceTools, { workspace }),
      }),
      workspace.storageProblem.value ? h('p', {
        class: 'workspace-storage-warning', role: 'alert',
      }, workspace.storageProblem.value) : null,
      h('div', { class: 'app-layout' }, [
        h('main', {
          ref: main,
          class: ['app-content', { 'app-content--workspace': activeFeature.value?.id === 'index-cards' }],
          tabindex: -1,
        }, [
          h(KeepAlive, { key: workspace.revision.value }, {
            default: () => activeFeature.value ? h(activeFeature.value.component, {
              key: activeFeature.value.id,
              title: activeFeature.value.label,
              model: workspace.state.value.features[activeFeature.value.id],
            }) : null,
          }),
        ]),
      ]),
    ]);
  },
};

createApp(App).mount('#app');
