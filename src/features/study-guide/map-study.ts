import { computed, defineComponent, h, nextTick, onBeforeUnmount, onDeactivated, ref, type PropType } from 'vue';
import { GuideTypeIcon } from './guide-type-icon.ts';
import { connectedTopicIds, mapStudyProblem, startTopic, topicById } from './map-graph.ts';
import {
  MAP_HEIGHT, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH, MAP_WIDTH, type GuideSection,
  type MapGuideData, type MapTopic,
} from './library-model.ts';

interface StudyPoint {
  sectionId: string;
  bullet: string;
}

export const StudyGuideMapStudy = defineComponent({
  name: 'StudyGuideMapStudy',
  props: {
    data: { type: Object as PropType<MapGuideData>, required: true },
    guideName: { type: String, required: true },
  },
  emits: { edit: () => true },
  setup(props, { emit }) {
    const started = ref(false);
    const visited = ref(new Set<string>());
    const currentId = ref<string | null>(null);
    const path = ref<string[]>([]);
    const revealedCount = ref(0);
    const travelling = ref(false);
    const focused = ref(false);
    const travelTargetId = ref<string | null>(null);
    const scroll = ref<HTMLElement | null>(null);
    const topicHeading = ref<HTMLElement | null>(null);
    const topicPanel = ref<HTMLElement | null>(null);
    const viewMapButton = ref<HTMLButtonElement | null>(null);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const timers = new Set<number>();

    const current = computed(() => topicById(props.data, currentId.value));
    const studyProblem = computed(() => mapStudyProblem(props.data));
    const visitedCount = computed(() => visited.value.size);
    const complete = computed(() => props.data.topics.length > 0 && visited.value.size === props.data.topics.length);

    function points(topic: MapTopic | null): StudyPoint[] {
      if (!topic) return [];
      const result: StudyPoint[] = [];
      for (const section of topic.guide.sections) {
        for (const bullet of section.bullets) {
          if (!bullet.trim()) continue;
          result.push({ sectionId: section.id, bullet });
        }
      }
      return result;
    }

    const currentPoints = computed(() => points(current.value));
    const available = computed(() => currentId.value
      ? connectedTopicIds(props.data, currentId.value).filter(id => !visited.value.has(id))
      : []);

    function clearTimers() {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      travelling.value = false;
      travelTargetId.value = null;
    }

    onBeforeUnmount(clearTimers);
    onDeactivated(clearTimers);

    function later(callback: () => void, delay: number) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delay);
      timers.add(timer);
    }

    function focusTopic(id: string, behavior: ScrollBehavior) {
      nextTick(() => {
        const topic = topicById(props.data, id);
        const container = scroll.value;
        if (!topic || !container) return;
        container.scrollTo({
          left: Math.max(0, topic.x + MAP_TOPIC_WIDTH / 2 - container.clientWidth / 2),
          top: Math.max(0, topic.y + MAP_TOPIC_HEIGHT / 2 - container.clientHeight / 2),
          behavior,
        });
      });
    }

    function showTopic() {
      nextTick(() => {
        focused.value = true;
        nextTick(() => { topicHeading.value?.focus({ preventScroll: true }); });
      });
    }

    function closeTopic() {
      focused.value = false;
      nextTick(() => { viewMapButton.value?.focus({ preventScroll: true }); });
    }

    function markVisited(id: string) {
      if (visited.value.has(id)) return;
      const next = new Set(visited.value);
      next.add(id);
      visited.value = next;
    }

    function prepareCurrent() {
      const topic = current.value;
      if (!topic) return;
      revealedCount.value = 0;
      topicPanel.value?.scrollTo({ top: 0, behavior: 'instant' });
      if (!points(topic).length) markVisited(topic.id);
    }

    function followRevealedPoint() {
      nextTick(() => {
        window.requestAnimationFrame(() => {
          const panel = topicPanel.value;
          if (!panel || !focused.value || travelling.value) return;
          const bullets = panel.querySelectorAll<HTMLElement>('.study-guide-study-bullet');
          const latest = bullets.item(bullets.length - 1);
          if (!latest) return;

          const viewport = panel.getBoundingClientRect();
          const point = latest.getBoundingClientRect();
          // Keep the freshly revealed point readable; include the next action
          // when it fits, so learners can continue without manual scrolling.
          const action = panel.querySelector<HTMLElement>(
            '.study-guide-study-reveal, .study-guide-study-topic-inner > .card-primary-button, ' +
            '.study-guide-study-branch button, .study-guide-study-backtrack button, .study-guide-study-finished button',
          );
          const actionBottom = action?.getBoundingClientRect().bottom ?? point.bottom;
          const bottomOverflow = Math.max(0, Math.max(point.bottom, actionBottom) - (viewport.bottom - 24));
          const keepPointVisible = Math.max(0, point.top - viewport.top - 20);
          const delta = Math.min(bottomOverflow, keepPointVisible);
          if (delta > 0) {
            panel.scrollTo({
              top: panel.scrollTop + delta,
              behavior: reducedMotion.matches ? 'instant' : 'smooth',
            });
          }
        });
      });
    }

    function start() {
      clearTimers();
      if (studyProblem.value) return;
      const first = startTopic(props.data);
      if (!first) return;
      visited.value = new Set();
      currentId.value = first.id;
      path.value = [first.id];
      revealedCount.value = 0;
      started.value = true;
      prepareCurrent();
      focusTopic(first.id, 'auto');
      showTopic();
    }

    function restart() {
      focused.value = false;
      started.value = false;
      nextTick(start);
    }

    function returnToOverview() {
      clearTimers();
      focused.value = false;
      started.value = false;
      currentId.value = null;
    }

    function revealNext() {
      const topic = current.value;
      if (!topic || visited.value.has(topic.id)) return;
      const count = currentPoints.value.length;
      if (revealedCount.value < count) revealedCount.value += 1;
      if (revealedCount.value >= count) markVisited(topic.id);
      followRevealedPoint();
    }

    function travelTo(targetId: string, after: () => void) {
      if (travelling.value) return;
      const duration = reducedMotion.matches ? 0 : 520;
      focused.value = false;
      travelling.value = true;
      travelTargetId.value = targetId;
      focusTopic(targetId, reducedMotion.matches ? 'auto' : 'smooth');
      later(() => {
        currentId.value = targetId;
        travelTargetId.value = null;
        travelling.value = false;
        after();
        showTopic();
      }, duration);
    }

    function visitNext(targetId: string) {
      if (!currentId.value || !available.value.includes(targetId)) return;
      travelTo(targetId, () => {
        path.value = [...path.value, targetId];
        prepareCurrent();
      });
    }

    function backtrackPlan(): { route: string[]; ancestorId: string } | null {
      if (!currentId.value || available.value.length || path.value.length < 2) return null;
      for (let index = path.value.length - 2; index >= 0; index -= 1) {
        const ancestorId = path.value[index];
        const unvisited = connectedTopicIds(props.data, ancestorId).filter(id => !visited.value.has(id));
        if (!unvisited.length) continue;
        return {
          route: path.value.slice(index, path.value.length - 1).reverse(),
          ancestorId,
        };
      }
      return null;
    }

    function backtrack() {
      const plan = backtrackPlan();
      if (!plan || travelling.value) return;
      const { route, ancestorId } = plan;
      const duration = reducedMotion.matches ? 0 : 520;
      focused.value = false;
      travelling.value = true;

      function step(index: number) {
        const targetId = route[index];
        if (!targetId) {
          currentId.value = ancestorId;
          path.value = path.value.slice(0, path.value.indexOf(ancestorId) + 1);
          travelTargetId.value = null;
          travelling.value = false;
          revealedCount.value = points(topicById(props.data, ancestorId)).length;
          topicPanel.value?.scrollTo({ top: 0, behavior: 'instant' });
          // A single remaining trail is not a choice: follow it without
          // reopening the already studied stop or requiring another click.
          const onward = connectedTopicIds(props.data, ancestorId).filter(id => !visited.value.has(id));
          if (onward.length === 1) {
            visitNext(onward[0]);
          } else {
            showTopic();
          }
          return;
        }
        travelTargetId.value = targetId;
        focusTopic(targetId, reducedMotion.matches ? 'auto' : 'smooth');
        later(() => {
          currentId.value = targetId;
          step(index + 1);
        }, duration);
      }

      step(0);
    }

    function connectionLine(connection: MapGuideData['connections'][number]) {
      const from = topicById(props.data, connection.from);
      const to = topicById(props.data, connection.to);
      if (!from || !to) return null;
      const active = currentId.value && travelTargetId.value &&
        ((connection.from === currentId.value && connection.to === travelTargetId.value) ||
         (connection.to === currentId.value && connection.from === travelTargetId.value));
      return h('line', {
        key: connection.id,
        x1: from.x + MAP_TOPIC_WIDTH / 2,
        y1: from.y + MAP_TOPIC_HEIGHT / 2,
        x2: to.x + MAP_TOPIC_WIDTH / 2,
        y2: to.y + MAP_TOPIC_HEIGHT / 2,
        class: { 'is-travelling': active },
      });
    }

    function revealedContent(topic: MapTopic) {
      const shown = currentPoints.value.slice(0, revealedCount.value);
      const bySection = new Map<string, { section: GuideSection | undefined; bullets: string[] }>();
      for (const point of shown) {
        const entry = bySection.get(point.sectionId) ?? {
          section: topic.guide.sections.find(section => section.id === point.sectionId),
          bullets: [],
        };
        entry.bullets.push(point.bullet);
        bySection.set(point.sectionId, entry);
      }
      return [...bySection.entries()].map(([sectionId, entry]) => h('section', {
        key: sectionId, class: 'study-guide-study-section',
      }, [
        entry.section?.title ? h('h4', entry.section.title) : null,
        h('ul', entry.bullets.map((bullet, index) => h('li', {
          key: index, class: 'study-guide-study-bullet',
        }, bullet))),
      ]));
    }

    function routeControls(topic: MapTopic) {
      if (!visited.value.has(topic.id) || travelling.value) return null;
      if (complete.value) return h('div', { class: 'study-guide-study-finished', role: 'status' }, [
        h('strong', 'Map complete'),
        h('p', 'You visited every topic on this study route.'),
        h('div', { class: 'study-guide-study-actions' }, [
          h('button', { type: 'button', class: 'card-primary-button', onClick: restart }, 'Study again'),
          h('button', { type: 'button', class: 'quiet-button', onClick: returnToOverview }, 'Return to overview'),
        ]),
      ]);

      if (available.value.length > 1) {
        return h('div', { class: 'study-guide-study-branch' }, [
          h('strong', 'Choose the next path'),
          h('p', 'This stop branches. Pick which unvisited topic to study next.'),
          h('div', { class: 'study-guide-study-branch-actions' }, available.value.map(id => {
            const next = topicById(props.data, id);
            return next ? h('button', {
              key: id, type: 'button', class: 'quiet-button',
              onClick: () => visitNext(id),
            }, next.title || 'Untitled topic') : null;
          })),
        ]);
      }

      if (available.value.length === 1) {
        const next = topicById(props.data, available.value[0]);
        return next ? h('button', {
          type: 'button', class: 'card-primary-button',
          onClick: () => visitNext(next.id),
        }, 'Continue to ' + (next.title || 'next topic')) : null;
      }

      const plan = backtrackPlan();
      if (plan) {
        const ancestor = topicById(props.data, plan.ancestorId);
        return h('div', { class: 'study-guide-study-backtrack' }, [
          h('p', 'This branch is finished. Go back along the path to continue the map.'),
          h('button', { type: 'button', class: 'card-primary-button', onClick: backtrack },
            'Backtrack to ' + (ancestor?.title || 'previous fork')),
        ]);
      }
      return null;
    }

    return () => {
      if (!started.value) {
        return h('section', { class: 'study-guide-study-intro', 'aria-label': 'Map study overview' }, [
          h('header', { class: 'study-guide-study-intro-header' }, [
            h('div', { class: 'study-guide-study-intro-art', 'aria-hidden': 'true' }, [
              h(GuideTypeIcon, { mode: 'map' }),
            ]),
            h('div', [
              h('p', { class: 'study-guide-study-kicker' }, 'Ready to explore?'),
              h('h3', props.guideName),
              h('p', 'Follow the trail, discover each topic, and reveal what you learn at every stop.'),
            ]),
          ]),
          h('div', { class: 'study-guide-study-pills', 'aria-label': 'Session details' }, [
            h('span', props.data.topics.length + (props.data.topics.length === 1 ? ' topic' : ' topics')),
            h('span', props.data.connections.length + (props.data.connections.length === 1 ? ' path' : ' paths')),
            h('span', 'No score or timer'),
          ]),
          h('div', { class: 'study-guide-study-expect' }, [
            h('h4', 'What to expect'),
            h('p', 'Reveal the current topic’s bullet points one at a time. Finishing a topic marks that stop visited. At forks, choose which branch to take; dead ends send you back along visited paths until there is somewhere new to go.'),
          ]),
          studyProblem.value ? h('p', { class: 'study-guide-map-status', role: 'status' }, studyProblem.value) : null,
          h('div', { class: 'study-guide-study-actions' }, [
            h('button', {
              type: 'button', class: 'card-primary-button', disabled: studyProblem.value !== null, onClick: start,
            }, 'Start adventure'),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => emit('edit') }, 'Edit map'),
          ]),
        ]);
      }

      const topic = current.value;
      if (!topic) return null;
      const currentVisited = visited.value.has(topic.id);
      const travelerId = travelTargetId.value ?? currentId.value;
      const traveler = topicById(props.data, travelerId);

      return h('div', { class: 'study-guide-study-session' }, [
        h('div', { class: 'study-guide-study-toolbar' }, [
          h('div', [
            h('strong', topic.title || 'Untitled topic'),
            h('span', visitedCount.value + ' of ' + props.data.topics.length + ' visited'),
          ]),
          h('div', { class: 'study-guide-study-toolbar-actions' }, [
            h('button', {
              ref: viewMapButton, type: 'button', class: 'quiet-button', disabled: travelling.value,
              onClick: () => { if (focused.value) closeTopic(); else showTopic(); },
            }, focused.value ? 'View map' : 'View points'),
            h('button', { type: 'button', class: 'quiet-button', onClick: returnToOverview }, 'End studying'),
          ]),
        ]),
        h('div', { class: 'study-guide-study-layout' }, [
          h('div', { ref: scroll, class: 'study-guide-study-map-scroll', inert: focused.value }, [
            h('div', {
              class: 'study-guide-study-map',
              style: { width: MAP_WIDTH + 'px', height: MAP_HEIGHT + 'px' },
              'aria-label': 'Study route map',
            }, [
              h('svg', {
                class: 'study-guide-study-route',
                viewBox: '0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT,
                width: MAP_WIDTH, height: MAP_HEIGHT, 'aria-hidden': 'true',
              }, props.data.connections.map(connectionLine)),
              ...props.data.topics.map((entry, index) => h('div', {
                key: entry.id,
                class: ['study-guide-study-stop', {
                  'is-current': entry.id === currentId.value,
                  'is-visited': visited.value.has(entry.id),
                  'is-target': entry.id === travelTargetId.value,
                }],
                style: { left: entry.x + 'px', top: entry.y + 'px' },
              }, [
                h('span', { class: 'study-guide-topic-number' }, visited.value.has(entry.id) ? '✓' : String(index + 1)),
                h('span', { class: 'study-guide-topic-name' }, entry.title || 'Untitled topic'),
              ])),
              traveler ? h('span', {
                class: ['study-guide-traveler', { 'is-moving': travelling.value }],
                style: {
                  left: traveler.x + MAP_TOPIC_WIDTH / 2 + 'px',
                  top: traveler.y + MAP_TOPIC_HEIGHT / 2 + 'px',
                },
                'aria-hidden': 'true',
              }) : null,
            ]),
          ]),
          h('section', {
            ref: topicPanel,
            class: ['study-guide-study-topic', { 'is-visible': focused.value && !travelling.value }],
            'aria-hidden': !focused.value || travelling.value,
            inert: !focused.value || travelling.value,
            'aria-label': 'Current topic study points',
            'aria-live': 'polite',
          }, [
            h('div', { class: 'study-guide-study-close-row' }, [
              h('button', {
                type: 'button',
                class: 'icon-button study-guide-study-close',
                title: 'View map',
                'aria-label': 'Close topic points and view map',
                onClick: closeTopic,
              }, '×'),
            ]),
            h('div', { class: 'study-guide-study-topic-inner' }, [
            travelling.value ? h('div', { class: 'study-guide-study-travelling' }, [
              h('strong', 'Following the path…'),
              h('p', 'Moving to the next stop.'),
            ]) : [
              h('div', { class: 'study-guide-study-topic-heading' }, [
                h('span', currentVisited ? 'Visited' : 'Current stop'),
                h('h3', { ref: topicHeading, tabindex: -1 }, topic.title || 'Untitled topic'),
                topic.description?.trim()
                  ? h('p', { class: 'study-guide-study-topic-description' }, topic.description.trim())
                  : null,
              ]),
              currentPoints.value.length
                ? h('div', { class: 'study-guide-study-points' }, [
                    ...revealedContent(topic),
                    !currentVisited ? h('button', {
                      type: 'button', class: 'quiet-button study-guide-study-reveal',
                      onClick: revealNext,
                    }, revealedCount.value ? 'Reveal next point →' : 'Reveal first point →') : null,
                  ])
                : h('p', { class: 'study-guide-study-empty-topic' }, 'This topic has no bullet points. It counts as visited when you arrive.'),
              currentVisited && !complete.value ? h('p', {
                class: 'study-guide-study-visited-note',
              }, 'All points revealed. This stop is visited.') : null,
              routeControls(topic),
            ],
            ]),
          ]),
        ]),
      ]);
    };
  },
});
