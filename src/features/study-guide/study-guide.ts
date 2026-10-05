import { computed,defineComponent,h,nextTick,onBeforeUnmount,ref,type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { LibraryEmptyState } from '../../components/library-empty-state.ts';
import { useLibrarySelection } from '../../components/use-library-selection.ts';
import { usePersistedPanelResize } from '../../components/use-persisted-panel-resize.ts';
import { StudyGuideLibrary,type StudyGuideLibraryHandle } from './library.ts';
import { canMove,findItem,firstEntry,groupOptions,insertGuide,moveItem,type GuideTarget,type LibraryItem,type StudyGuideMode,type StudyGuideModel } from './library-model.ts';
import { StudyGuideModePicker } from './mode-picker.ts';
import { StudyGuideListEditor } from './list-editor.ts';
import { StudyGuideMapEditor } from './map-editor.ts';
const MIN_LIBRARY_WIDTH=248, LIBRARY_WIDTH_KEY='dynamic-learner.ui.study-guide.library-width';
export const StudyGuide=defineComponent({
  name:'StudyGuide',
  props:{title:{type:String,required:true},model:{type:Object as PropType<StudyGuideModel>,required:true}},
  setup(props){
    const creationTarget=ref<GuideTarget|null>(null);
    const selectedId=useLibrarySelection({firstId:()=>firstEntry(props.model.items)?.id??null,hasItem:id=>findItem(props.model.items,id)!==null,enabled:()=>creationTarget.value===null,onAutoSelect:id=>library.value?.reveal(id)});
    const selection=computed(()=>findItem(props.model.items,selectedId.value));
    const query=window.matchMedia('(max-width: 700px), (max-width: 1100px) and (pointer: coarse)');
    const overlay=ref(query.matches),collapsed=ref(query.matches&&selectedId.value!==null),layout=ref<HTMLElement|null>(null),library=ref<StudyGuideLibraryHandle|null>(null),showLibrary=ref<HTMLButtonElement|null>(null),message=ref('');
    const panel=usePersistedPanelResize({preferenceKey:LIBRARY_WIDTH_KEY,container:layout,panelSelector:'.directory-panel',minWidth:MIN_LIBRARY_WIDTH,maxWidth:640,minRemainingWidth:320,fallbackWidth:280,disabled:()=>overlay.value||collapsed.value});
    function media(e:MediaQueryListEvent){overlay.value=e.matches;panel.resizing.value=false;if(e.matches&&selectedId.value)collapsed.value=true;}query.addEventListener('change',media);onBeforeUnmount(()=>query.removeEventListener('change',media));
    async function setCollapsed(v:boolean){collapsed.value=v;await nextTick();if(v)showLibrary.value?.focus();else library.value?.focusToggle();}
    function target():GuideTarget{const s=selection.value;if(s?.item.kind==='group')return{parentId:s.item.id,parentName:s.item.name,selectedId:s.item.id};if(s)return{parentId:s.parentId,parentName:s.parentId?findItem(props.model.items,s.parentId)?.item.name??'Selected group':'Top level',selectedId:s.item.id};return{parentId:null,parentName:'Top level',selectedId:null};}
    function begin(){creationTarget.value=target();message.value='';if(overlay.value)collapsed.value=true;}
    async function cancel(){creationTarget.value=null;await nextTick();if(collapsed.value)showLibrary.value?.focus();else library.value?.focusNewGuide();}
    function create(mode:StudyGuideMode){if(!creationTarget.value)return;try{const item=insertGuide(props.model.items,creationTarget.value,mode);selectedId.value=item.id;creationTarget.value=null;library.value?.reveal(item.id);message.value='Created '+item.name+'.';nextTick(()=>library.value?.beginRename(item.id));}catch(error){message.value=error instanceof Error?error.message:String(error);}}
    function select(id:string|null){selectedId.value=id;creationTarget.value=null;message.value='';}
    function moveGroup(e:Event){if(!selectedId.value||!selection.value)return;const id=inputValue(e)||null;if(moveItem(props.model.items,selectedId.value,id,'inside')){library.value?.reveal(selectedId.value);message.value='Moved '+selection.value.item.name+'.';}}
    function reorder(offset:number){if(!selection.value)return;const s=selection.value,n=s.siblings[s.index+offset];if(n&&moveItem(props.model.items,s.item.id,n.id,offset<0?'before':'after'))message.value='Moved '+s.item.name+(offset<0?' up.':' down.');}
    function organization(item:LibraryItem){if(!selection.value)return null;return h('details',{class:['item-organization',{'library-group-organization':item.kind==='group'}],open:item.kind==='group'},[
      h('summary',{class:'organization-summary'},'Location and order'),
      h('div',{class:'item-location'},[h('label',{for:'study-guide-parent'},'Move to group'),h('select',{id:'study-guide-parent',value:selection.value.parentId??'',onChange:moveGroup},[
        h('option',{value:''},'Top level'),...groupOptions(props.model.items,selectedId.value).map(g=>h('option',{key:g.id,value:g.id,disabled:!canMove(props.model.items,item.id,g.id,'inside')},g.label))
      ])]),
      h('div',{class:'item-order-actions'},[h('button',{type:'button',class:'quiet-button',disabled:selection.value.index===0,onClick:()=>reorder(-1)},'Move up'),
        h('button',{type:'button',class:'quiet-button',disabled:selection.value.index===selection.value.siblings.length-1,onClick:()=>reorder(1)},'Move down')])
    ]);}
    function detail(){
      if(creationTarget.value)return h('section',{class:'study-guide-detail study-guide-builder-detail',inert:overlay.value&&!collapsed.value},[
        h(StudyGuideModePicker,{destination:creationTarget.value.parentName,onCreate:create,onCancel:cancel}),h('p',{class:'visually-hidden',role:'status'},message.value)
      ]);
      const item=selection.value?.item;
      if(!item||item.kind==='group')return h('section',{class:'study-guide-detail',inert:overlay.value&&!collapsed.value,'aria-label':item?'Selected group':'Study Guide workspace'},[
        h(LibraryEmptyState,{class:{'has-organization':item!==undefined},icon:'document',title:item?.name??'Build your study guide library',
          description:item?'Create a study guide in this group, or select one from the Library.':'Make a simple list or map your topics out visually.',actionLabel:'New study guide',onCreate:begin}),
        item?organization(item):null
      ]);
      return h('section',{class:'study-guide-detail is-guide',inert:overlay.value&&!collapsed.value,'aria-label':'Selected study guide'},[
        h('header',{class:'item-heading study-guide-item-heading'},[h('h2',item.name),h('p',{class:'item-summary'},item.mode==='list'?'List mode':'Map mode')]),
        item.mode==='list'?h('div',{class:'study-guide-list-workspace'},[h(StudyGuideListEditor,{data:item.data})]):h(StudyGuideMapEditor,{data:item.data}),
        organization(item),h('p',{class:'visually-hidden',role:'status'},message.value)
      ]);
    }
    return ()=>h('section',{class:'study-guide-page','aria-label':props.title,onKeydown:(e:KeyboardEvent)=>{if(e.key==='Escape'&&overlay.value&&!collapsed.value&&!(e.target instanceof Element&&e.target.closest('dialog'))){e.preventDefault();void setCollapsed(true);}}},[
      h('div',{ref:layout,class:['study-guide-layout',{'library-collapsed':collapsed.value,'library-resizing':panel.resizing.value}],style:panel.width.value===null?null:{'--library-width':panel.width.value+'px'}},[
        collapsed.value?h('button',{ref:showLibrary,type:'button',class:'icon-button library-floating-toggle',title:'Show library','aria-label':'Show library','aria-expanded':false,'aria-controls':'study-guide-library',onClick:()=>setCollapsed(false)},[h(Icon,{name:'panel-open'})]):null,
        overlay.value&&!collapsed.value?h('button',{type:'button',class:'library-scrim','aria-label':'Close library',onClick:()=>setCollapsed(true)}):null,
        h(StudyGuideLibrary,{ref:library,items:props.model.items,selectedId:selectedId.value,collapsed:collapsed.value,onSelect:select,onOpenItem:()=>{if(overlay.value)void setCollapsed(true);},onToggleLibrary:()=>setCollapsed(true),onNewGuide:begin}),
        !overlay.value&&!collapsed.value?h('div',{class:'library-resizer',role:'separator',tabindex:0,'aria-label':'Resize library','aria-orientation':'vertical','aria-valuemin':MIN_LIBRARY_WIDTH,'aria-valuemax':panel.maxWidth(),'aria-valuenow':Math.round(panel.currentWidth()),onPointerdown:panel.beginResize,onPointermove:panel.resizeFromPointer,onPointerup:panel.endResize,onPointercancel:panel.endResize,onKeydown:panel.resizeFromKeyboard,onDblclick:panel.resetWidth}):null,
        detail()
      ])
    ]);
  }
});
