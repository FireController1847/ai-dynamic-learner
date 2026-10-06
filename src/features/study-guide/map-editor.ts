import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { createId } from '../../core/ids.ts';
import { inputValue } from '../../core/dom.ts';
import {
  connectedTopicIds, connectTopics, mapStudyProblem, removeConnection,
  removeTopicGraphData, setStartTopic, topicById,
} from './map-graph.ts';
import {
  createListGuideData, MAP_GRID, MAP_HEIGHT, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT,
  MAP_TOPIC_WIDTH, MAP_WIDTH, MAX_TEXT_LENGTH, MAX_TOPICS, type MapGuideData, type MapTopic,
} from './library-model.ts';
import { StudyGuideListEditor } from './list-editor.ts';

const snap = (value: number) => Math.round(value / MAP_GRID) * MAP_GRID;
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

export const StudyGuideMapEditor = defineComponent({
  name: 'StudyGuideMapEditor',
  props: { data: { type: Object as PropType<MapGuideData>, required: true } },
  emits: { study: () => true },
  setup(props, { emit }) {
    const selectedId = ref<string | null>(props.data.topics[0]?.id ?? null);
    const connectingFromId = ref<string | null>(null);
    const drag = ref<{ id: string; clientX: number; clientY: number; x: number; y: number } | null>(null);
    const selected = computed(() => topicById(props.data, selectedId.value));
    const studyProblem = computed(() => mapStudyProblem(props.data));

    function addTopic() {
      if (props.data.topics.length >= MAX_TOPICS) return;
      const index = props.data.topics.length;
      const topic: MapTopic = {
        id: createId(),
        title: 'New topic',
        x: clamp(snap(64 + (index % 5) * 224), MAP_MAX_X),
        y: clamp(snap(64 + Math.floor(index / 5) * 128), MAP_MAX_Y),
        guide: createListGuideData(),
      };
      props.data.topics.push(topic);
      if (props.data.startTopicId === null) props.data.startTopicId = topic.id;
      selectedId.value = topic.id;
      connectingFromId.value = null;
    }

    function removeTopic(id: string) {
      const index = props.data.topics.findIndex(topic => topic.id === id);
      if (index < 0) return;
      removeTopicGraphData(props.data, id);
      props.data.topics.splice(index, 1);
      if (connectingFromId.value === id) connectingFromId.value = null;
      selectedId.value = props.data.topics[Math.min(index, props.data.topics.length - 1)]?.id ?? null;
    }

    function moveTopic(topic: MapTopic, dx: number, dy: number) {
      topic.x = clamp(snap(topic.x + dx), MAP_MAX_X);
      topic.y = clamp(snap(topic.y + dy), MAP_MAX_Y);
    }

    function selectTopic(topic: MapTopic) {
      const from = connectingFromId.value;
      if (from && from !== topic.id) {
        connectTopics(props.data, from, topic.id);
        connectingFromId.value = null;
      }
      selectedId.value = topic.id;
    }

    function pointerDown(event: PointerEvent, topic: MapTopic) {
      if (event.button !== 0 || connectingFromId.value) return;
      selectedId.value = topic.id;
      drag.value = { id: topic.id, clientX: event.clientX, clientY: event.clientY, x: topic.x, y: topic.y };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    function pointerMove(event: PointerEvent, topic: MapTopic) {
      const active = drag.value;
      if (!active || active.id !== topic.id) return;
      topic.x = clamp(snap(active.x + event.clientX - active.clientX), MAP_MAX_X);
      topic.y = clamp(snap(active.y + event.clientY - active.clientY), MAP_MAX_Y);
    }

    function pointerUp(event: PointerEvent) {
      const element = event.currentTarget as HTMLElement;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      drag.value = null;
    }

    function connectionLine(connection: MapGuideData['connections'][number]) {
      const from = topicById(props.data, connection.from);
      const to = topicById(props.data, connection.to);
      if (!from || !to) return null;
      return h('line', {
        key: connection.id,
        x1: from.x + MAP_TOPIC_WIDTH / 2,
        y1: from.y + MAP_TOPIC_HEIGHT / 2,
        x2: to.x + MAP_TOPIC_WIDTH / 2,
        y2: to.y + MAP_TOPIC_HEIGHT / 2,
        class: selectedId.value === from.id || selectedId.value === to.id ? 'is-selected' : null,
      });
    }

    return () => {
      const selectedTopic = selected.value;
      const connected = selectedTopic
        ? connectedTopicIds(props.data, selectedTopic.id)
          .map(id => topicById(props.data, id))
          .filter((topic): topic is MapTopic => topic !== null)
        : [];

      return h('div', { class: 'study-guide-map-editor' }, [
        h('div', { class: 'study-guide-map-toolbar' }, [
          h('div', { class: 'study-guide-map-toolbar-actions' }, [
            h('button', {
              type: 'button', class: 'quiet-button',
              disabled: props.data.topics.length >= MAX_TOPICS, onClick: addTopic,
            }, '+ Topic'),
            h('button', {
              type: 'button',
              class: ['quiet-button', { 'is-active': connectingFromId.value !== null }],
              disabled: !selectedTopic || props.data.topics.length < 2,
              'aria-pressed': connectingFromId.value !== null,
              onClick: () => {
                connectingFromId.value = connectingFromId.value ? null : selectedTopic?.id ?? null;
              },
            }, connectingFromId.value ? 'Cancel connection' : 'Connect'),
          ]),
          h('div', { class: 'study-guide-map-toolbar-study' }, [
            studyProblem.value ? h('span', { class: 'study-guide-map-status' }, studyProblem.value) : null,
            h('button', {
              type: 'button', class: 'card-primary-button',
              disabled: studyProblem.value !== null,
              onClick: () => emit('study'),
            }, 'Start studying'),
          ]),
        ]),
        connectingFromId.value ? h('p', { class: 'study-guide-connection-prompt', role: 'status' },
          'Choose another topic to connect it to this one.') : null,
        h('div', { class: 'study-guide-map-layout' }, [
          h('div', { class: 'study-guide-map-scroll' }, [
            h('div', {
              class: ['study-guide-map-canvas', { 'is-connecting': connectingFromId.value !== null }],
              style: { width: MAP_WIDTH + 'px', height: MAP_HEIGHT + 'px', '--study-guide-grid': MAP_GRID + 'px' },
              role: 'group', 'aria-label': 'Topic map editor',
            }, [
              h('svg', {
                class: 'study-guide-route',
                viewBox: '0 0 ' + MAP_WIDTH + ' ' + MAP_HEIGHT,
                width: MAP_WIDTH, height: MAP_HEIGHT, 'aria-hidden': 'true',
              }, props.data.connections.map(connectionLine)),
              ...props.data.topics.map((topic, index) => h('button', {
                key: topic.id,
                type: 'button',
                class: ['study-guide-topic-stop', {
                  'is-selected': selectedId.value === topic.id,
                  'is-start': props.data.startTopicId === topic.id,
                  'is-connection-source': connectingFromId.value === topic.id,
                }],
                style: { left: topic.x + 'px', top: topic.y + 'px' },
                'aria-label': topic.title + ', topic ' + (index + 1) + (props.data.startTopicId === topic.id ? ', starting topic' : ''),
                onPointerdown: (event: PointerEvent) => pointerDown(event, topic),
                onPointermove: (event: PointerEvent) => pointerMove(event, topic),
                onPointerup: pointerUp,
                onPointercancel: pointerUp,
                onClick: () => selectTopic(topic),
                onKeydown: (event: KeyboardEvent) => {
                  if (connectingFromId.value && event.key === 'Enter') {
                    event.preventDefault();
                    selectTopic(topic);
                    return;
                  }
                  const moves: Record<string, [number, number]> = {
                    ArrowLeft: [-MAP_GRID, 0], ArrowRight: [MAP_GRID, 0],
                    ArrowUp: [0, -MAP_GRID], ArrowDown: [0, MAP_GRID],
                  };
                  const movement = moves[event.key];
                  if (!movement || connectingFromId.value) return;
                  event.preventDefault();
                  moveTopic(topic, movement[0], movement[1]);
                },
              }, [
                h('span', { class: 'study-guide-topic-number' }, String(index + 1)),
                h('span', { class: 'study-guide-topic-name' }, topic.title || 'Untitled topic'),
                props.data.startTopicId === topic.id ? h('span', {
                  class: 'study-guide-topic-start', 'aria-hidden': 'true',
                }, 'Start') : null,
              ])),
            ]),
          ]),
          h('aside', { class: 'study-guide-topic-panel', 'aria-label': 'Selected topic guide' }, selectedTopic ? [
            h('div', { class: 'study-guide-topic-panel-heading' }, [
              h('input', {
                value: selectedTopic.title,
                maxlength: MAX_TEXT_LENGTH,
                placeholder: 'Topic name',
                'aria-label': 'Topic name',
                onInput: (event: Event) => { selectedTopic.title = inputValue(event); },
              }),
              h('div', { class: 'study-guide-topic-actions' }, [
                h('button', {
                  type: 'button', class: 'quiet-button',
                  disabled: props.data.startTopicId === selectedTopic.id,
                  onClick: () => setStartTopic(props.data, selectedTopic.id),
                }, props.data.startTopicId === selectedTopic.id ? 'Starts here' : 'Start here'),
                h('button', {
                  type: 'button', class: 'quiet-button danger-button',
                  onClick: () => removeTopic(selectedTopic.id),
                }, 'Delete topic'),
              ]),
            ]),
            h('section', { class: 'study-guide-connections', 'aria-labelledby': 'study-guide-connections-title' }, [
              h('div', { class: 'study-guide-connections-heading' }, [
                h('h3', { id: 'study-guide-connections-title' }, 'Connections'),
                h('span', String(connected.length)),
              ]),
              connected.length ? h('ul', connected.map(topic => {
                const connection = props.data.connections.find(entry =>
                  (entry.from === selectedTopic.id && entry.to === topic.id) ||
                  (entry.to === selectedTopic.id && entry.from === topic.id));
                return h('li', { key: topic.id }, [
                  h('button', {
                    type: 'button', class: 'study-guide-connection-name',
                    onClick: () => { selectedId.value = topic.id; connectingFromId.value = null; },
                  }, topic.title || 'Untitled topic'),
                  h('button', {
                    type: 'button', class: 'icon-button',
                    title: 'Remove connection to ' + (topic.title || 'Untitled topic'),
                    'aria-label': 'Remove connection to ' + (topic.title || 'Untitled topic'),
                    onClick: () => { if (connection) removeConnection(props.data, connection.id); },
                  }, '×'),
                ]);
              })) : h('p', { class: 'study-guide-topic-help' }, 'No paths yet. Use Connect, then choose another topic.'),
            ]),
            h('p', { class: 'study-guide-topic-help' }, 'This stop has its own mini study guide.'),
            h(StudyGuideListEditor, { data: selectedTopic.guide, compact: true }),
          ] : [
            h('div', { class: 'study-guide-topic-panel-empty' }, [h('p', 'Add a topic to start building the map.')]),
          ]),
        ]),
      ]);
    };
  },
});
