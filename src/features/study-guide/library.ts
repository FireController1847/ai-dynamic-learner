export interface StudyGuideLibraryHandle { reveal(id:string):void; focusToggle():void; focusNewGuide():void; beginRename(id:string):void }
import type { VNode } from 'vue';
import { defineComponent,h,nextTick,onDeactivated,ref,type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { Icon } from '../../components/icon.ts';
import { DeleteConfirmation } from '../../components/delete-confirmation.ts';
import { GuideTypeIcon } from './guide-type-icon.ts';
import { countGuides,countItems,createGroup,deleteItem,findItem,firstEntry,guideIsEmpty,MAX_DEPTH,MAX_ITEMS,MAX_NAME_LENGTH,type LibraryItem } from './library-model.ts';
export const StudyGuideLibrary=defineComponent({
  name:'StudyGuideLibrary',
  props:{items:{type:Array as PropType<LibraryItem[]>,required:true},selectedId:{type:String as PropType<string|null>,default:null},collapsed:Boolean},
  emits:{select:(_id:string|null)=>true,'open-item':()=>true,'toggle-library':()=>true,'new-guide':()=>true},
  setup(props,{emit,expose}){
    const expanded=ref(new Set<string>()),editingId=ref<string|null>(null),draft=ref(''),input=ref<HTMLInputElement|null>(null);
    const labels=new Map<string|null,HTMLElement>();const collapseButton=ref<HTMLButtonElement|null>(null),newGuideButton=ref<HTMLButtonElement|null>(null);
    const announcement=ref(''),pendingDelete=ref<LibraryItem|null>(null);let deleteTrigger:HTMLElement|null=null;
    onDeactivated(()=>{pendingDelete.value=null;deleteTrigger=null;});
    function reveal(id:string){let p=findItem(props.items,id)?.parentId;while(p){expanded.value.add(p);p=findItem(props.items,p)?.parentId;}}
    async function rename(item:LibraryItem){emit('select',item.id);editingId.value=item.id;draft.value=item.name;await nextTick();input.value?.focus();input.value?.select();}
    async function finish(commit:boolean,focus=false){const id=editingId.value;if(!id)return;const found=findItem(props.items,id),name=draft.value.trim();if(commit&&found&&name&&name.length<=MAX_NAME_LENGTH){found.item.name=name;announcement.value='Renamed to '+name+'.';}editingId.value=null;if(focus){await nextTick();labels.get(id)?.focus();}}
    function addGroup(){if(countItems(props.items)>=MAX_ITEMS){announcement.value='The Study Guide library limit is '+MAX_ITEMS+' items.';return;}const selected=findItem(props.items,props.selectedId);if(selected?.item.kind==='group'&&selected.depth>=MAX_DEPTH){announcement.value='Groups can be at most '+MAX_DEPTH+' levels deep.';return;}const group=createGroup();if(selected?.item.kind==='group'){selected.item.children.unshift(group);expanded.value.add(selected.item.id);}else if(selected)selected.siblings.splice(selected.index+1,0,group);else props.items.unshift(group);expanded.value.add(group.id);reveal(group.id);void rename(group);}
    function requestDelete(item:LibraryItem,e:MouseEvent){const empty=item.kind==='group'?item.children.length===0:guideIsEmpty(item);if(empty){void confirmDelete(item.id);return;}deleteTrigger=e.currentTarget instanceof HTMLElement?e.currentTarget:null;pendingDelete.value=item;}
    async function cancelDelete(){pendingDelete.value=null;await nextTick();if(deleteTrigger?.isConnected)deleteTrigger.focus();deleteTrigger=null;}
    async function confirmDelete(id=pendingDelete.value?.id){const found=id&&findItem(props.items,id);if(!found){await cancelDelete();return;}const item=found.item;const removes=props.selectedId===item.id||(item.kind==='group'&&Boolean(findItem(item.children,props.selectedId)));deleteItem(props.items,item.id);const fallback=firstEntry(props.items)?.id??null;if(removes)emit('select',fallback);pendingDelete.value=null;deleteTrigger=null;announcement.value='Deleted '+item.name+(item.kind==='group'?' and everything inside it.':'.');await nextTick();(labels.get(fallback)??newGuideButton.value)?.focus();}
    expose({reveal,focusToggle:()=>collapseButton.value?.focus(),focusNewGuide:()=>newGuideButton.value?.focus(),beginRename:(id:string)=>{const found=findItem(props.items,id);if(found)void rename(found.item);}});
    function toggle(id:string){if(expanded.value.has(id))expanded.value.delete(id);else expanded.value.add(id);}
    function renderItem(item:LibraryItem):VNode{const group=item.kind==='group',open=expanded.value.has(item.id),editing=editingId.value===item.id;return h('li',{key:item.id,class:'directory-item'},[
      h('div',{class:['directory-row',{'is-selected':props.selectedId===item.id}]},[
        group?h('button',{type:'button',class:['tree-toggle',{'is-open':open}],'aria-label':(open?'Collapse ':'Expand ')+item.name,'aria-expanded':open,onClick:()=>toggle(item.id)},[h(Icon,{name:'chevron'})]):h('span',{class:'tree-toggle-space'}),
        group?h(Icon,{name:'folder'}):h(GuideTypeIcon,{mode:item.mode,compact:true}),
        editing?h('input',{ref:input,class:'directory-rename',value:draft.value,maxlength:MAX_NAME_LENGTH,'aria-label':'Rename '+(group?'group':'study guide'),onInput:(e:Event)=>{draft.value=inputValue(e);},onBlur:()=>finish(true),onKeydown:(e:KeyboardEvent)=>{if(!e.isComposing&&(e.key==='Enter'||e.key==='Escape')){e.preventDefault();e.stopPropagation();void finish(e.key==='Enter',true);}}})
          :h('button',{ref:(el)=>{if(el instanceof HTMLElement)labels.set(item.id,el);else labels.delete(item.id);},type:'button',class:'directory-label',title:item.name,'aria-pressed':props.selectedId===item.id,onClick:()=>{emit('select',item.id);emit('open-item');},onDblclick:()=>rename(item),onKeydown:(e:KeyboardEvent)=>{if(e.key==='F2'){e.preventDefault();void rename(item);}}},item.name),
        h('button',{type:'button',class:'icon-button rename-button',title:'Rename '+item.name,'aria-label':'Rename '+item.name,onClick:()=>rename(item)},[h(Icon,{name:'pencil'})]),
        h('button',{type:'button',class:'icon-button delete-button',title:'Delete '+item.name,'aria-label':'Delete '+item.name,onClick:(e:MouseEvent)=>requestDelete(item,e)},[h(Icon,{name:'trash'})])
      ]),
      group&&open?h('ul',{class:'directory-children','aria-label':item.name},item.children.map(renderItem)):null
    ]);}
    return ()=>h('aside',{id:'study-guide-library',class:'directory-panel',inert:props.collapsed,'aria-hidden':props.collapsed,'aria-label':'Study Guide library'},[
      h('div',{class:'directory-toolbar'},[h('h3','Library'),h('div',{class:'directory-create-actions'},[
        h('button',{type:'button',class:'icon-button',title:'New group','aria-label':'New group',onClick:addGroup},[h(Icon,{name:'folder'})]),
        h('button',{ref:newGuideButton,type:'button',class:'icon-button',title:'New study guide','aria-label':'New study guide',onClick:()=>emit('new-guide')},[h(Icon,{name:'document'})]),
        h('button',{ref:collapseButton,type:'button',class:'icon-button',title:'Minimize library','aria-label':'Minimize library','aria-expanded':true,'aria-controls':'study-guide-library',onClick:()=>emit('toggle-library')},[h(Icon,{name:'panel-close'})])
      ])]),
      h('div',{class:'directory-scroll'},[props.items.length?h('ul',{class:'directory-list','aria-label':'Groups and study guides'},props.items.map(renderItem)):h('p',{class:'directory-empty'},'No groups or study guides yet.')]),
      h('p',{class:'visually-hidden',role:'status'},announcement.value),
      pendingDelete.value?h(DeleteConfirmation,{itemName:pendingDelete.value.name,itemLabel:pendingDelete.value.kind==='group'?'group':'study guide',
        detail:pendingDelete.value.kind==='group'?'This also deletes everything inside this group, including '+countGuides(pendingDelete.value.children)+' study guides.':'The study guide and its content will be removed from the library.',
        confirmLabel:pendingDelete.value.kind==='group'?'Delete group':'Delete study guide',onCancel:cancelDelete,onConfirm:confirmDelete}):null
    ]);
  }
});
