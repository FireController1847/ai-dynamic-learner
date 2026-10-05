import { computed, defineComponent, h, ref, type PropType } from 'vue';
import { createId } from '../../core/ids.ts';
import { inputValue } from '../../core/dom.ts';
import { createListGuideData, MAP_GRID, MAP_HEIGHT, MAP_MAX_X, MAP_MAX_Y, MAP_TOPIC_HEIGHT, MAP_TOPIC_WIDTH, MAP_WIDTH, MAX_TEXT_LENGTH, MAX_TOPICS, type MapGuideData, type MapTopic } from './library-model.ts';
import { StudyGuideListEditor } from './list-editor.ts';
const snap=(v:number)=>Math.round(v/MAP_GRID)*MAP_GRID;
const clamp=(v:number,max:number)=>Math.max(0,Math.min(max,v));
export const StudyGuideMapEditor=defineComponent({
  name:'StudyGuideMapEditor', props:{data:{type:Object as PropType<MapGuideData>,required:true}},
  setup(props){
    const selectedId=ref<string|null>(props.data.topics[0]?.id??null);
    const drag=ref<{id:string;clientX:number;clientY:number;x:number;y:number}|null>(null);
    const selected=computed(()=>props.data.topics.find(t=>t.id===selectedId.value)??null);
    function addTopic(){
      if (props.data.topics.length >= MAX_TOPICS) return;
      const i=props.data.topics.length;
      const topic:MapTopic={id:createId(),title:'New topic',x:snap(64+(i%5)*224),y:snap(64+Math.floor(i/5)*128),guide:createListGuideData()};
      props.data.topics.push(topic); selectedId.value=topic.id;
    }
    function removeTopic(id:string){const i=props.data.topics.findIndex(t=>t.id===id);if(i<0)return;props.data.topics.splice(i,1);selectedId.value=props.data.topics[Math.min(i,props.data.topics.length-1)]?.id??null;}
    function move(topic:MapTopic,dx:number,dy:number){topic.x=clamp(snap(topic.x+dx),MAP_MAX_X);topic.y=clamp(snap(topic.y+dy),MAP_MAX_Y);}
    function down(e:PointerEvent,topic:MapTopic){if(e.button!==0)return;selectedId.value=topic.id;drag.value={id:topic.id,clientX:e.clientX,clientY:e.clientY,x:topic.x,y:topic.y};(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);}
    function moving(e:PointerEvent,topic:MapTopic){const d=drag.value;if(!d||d.id!==topic.id)return;topic.x=clamp(snap(d.x+e.clientX-d.clientX),MAP_MAX_X);topic.y=clamp(snap(d.y+e.clientY-d.clientY),MAP_MAX_Y);}
    function up(e:PointerEvent){const el=e.currentTarget as HTMLElement;if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);drag.value=null;}
    const points=()=>props.data.topics.map(t=>String(t.x+MAP_TOPIC_WIDTH/2)+','+String(t.y+MAP_TOPIC_HEIGHT/2)).join(' ');
    return ()=>h('div',{class:'study-guide-map-editor'},[
      h('div',{class:'study-guide-map-toolbar'},[h('button',{type:'button',class:'card-primary-button',disabled:props.data.topics.length>=MAX_TOPICS,onClick:addTopic},'+ Topic'),
        h('span',props.data.topics.length+(props.data.topics.length===1?' topic':' topics'))]),
      h('div',{class:'study-guide-map-layout'},[
        h('div',{class:'study-guide-map-scroll'},[h('div',{class:'study-guide-map-canvas',style:{width:MAP_WIDTH+'px',height:MAP_HEIGHT+'px','--study-guide-grid':MAP_GRID+'px'},role:'group','aria-label':'Topic map'},[
          props.data.topics.length>1?h('svg',{class:'study-guide-route',viewBox:'0 0 '+MAP_WIDTH+' '+MAP_HEIGHT,width:MAP_WIDTH,height:MAP_HEIGHT,'aria-hidden':'true'},[h('polyline',{points:points()})]):null,
          ...props.data.topics.map((topic,i)=>h('button',{key:topic.id,type:'button',class:['study-guide-topic-stop',{'is-selected':selectedId.value===topic.id}],
            style:{left:topic.x+'px',top:topic.y+'px'},'aria-label':topic.title+', topic '+(i+1),
            onPointerdown:(e:PointerEvent)=>down(e,topic),onPointermove:(e:PointerEvent)=>moving(e,topic),onPointerup:up,onPointercancel:up,
            onClick:()=>{selectedId.value=topic.id;},
            onKeydown:(e:KeyboardEvent)=>{const m:Record<string,[number,number]>={ArrowLeft:[-MAP_GRID,0],ArrowRight:[MAP_GRID,0],ArrowUp:[0,-MAP_GRID],ArrowDown:[0,MAP_GRID]};const d=m[e.key];if(d){e.preventDefault();move(topic,d[0],d[1]);}}},[
              h('span',{class:'study-guide-topic-number'},String(i+1)),h('span',{class:'study-guide-topic-name'},topic.title||'Untitled topic')
            ]))
        ])]),
        h('aside',{class:'study-guide-topic-panel','aria-label':'Selected topic guide'},selected.value?[
          h('div',{class:'study-guide-topic-panel-heading'},[
            h('input',{value:selected.value.title,maxlength:MAX_TEXT_LENGTH,placeholder:'Topic name','aria-label':'Topic name',onInput:(e:Event)=>{selected.value!.title=inputValue(e);}}),
            h('button',{type:'button',class:'quiet-button danger-button',onClick:()=>removeTopic(selected.value!.id)},'Delete topic')
          ]),
          h('p',{class:'study-guide-topic-help'},'This stop has its own mini study guide.'),
          h(StudyGuideListEditor,{data:selected.value.guide,compact:true})
        ]:[h('div',{class:'study-guide-topic-panel-empty'},[h('p','Add a topic to start building the map.')])])
      ])
    ]);
  }
});
