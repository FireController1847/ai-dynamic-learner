import { defineComponent, h, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { createSection, MAX_TEXT_LENGTH, type ListGuideData } from './library-model.ts';
export const StudyGuideListEditor = defineComponent({
  name:'StudyGuideListEditor',
  props:{ data:{type:Object as PropType<ListGuideData>,required:true}, compact:Boolean },
  setup(props){
    return () => h('div',{class:['study-guide-list-editor',{'is-compact':props.compact}]},[
      props.data.sections.length ? h('div',{class:'study-guide-sections'},props.data.sections.map((section,si)=>h('section',{key:section.id,class:'study-guide-section'},[
        h('div',{class:'study-guide-section-heading'},[
          h('input',{class:'study-guide-section-title',value:section.title,maxlength:MAX_TEXT_LENGTH,placeholder:'Title','aria-label':'Section title',
            onInput:(e:Event)=>{section.title=inputValue(e);}}),
          h('button',{type:'button',class:'icon-button study-guide-remove',title:'Remove title','aria-label':'Remove title',
            onClick:()=>props.data.sections.splice(si,1)},'×')
        ]),
        h('div',{class:'study-guide-bullets'},section.bullets.map((bullet,bi)=>h('div',{key:bi,class:'study-guide-bullet-row'},[
          h('span',{'aria-hidden':'true'},'•'),
          h('input',{value:bullet,maxlength:MAX_TEXT_LENGTH,placeholder:'Bullet point','aria-label':'Bullet ' + (bi+1),
            onInput:(e:Event)=>{section.bullets[bi]=inputValue(e);},}),
          h('button',{type:'button',class:'icon-button study-guide-remove',title:'Remove bullet','aria-label':'Remove bullet',
            onClick:()=>section.bullets.splice(bi,1)},'×')
        ]))),
        h('button',{type:'button',class:'quiet-button study-guide-add-bullet',onClick:()=>section.bullets.push('')},'+ Bullet')
      ]))) : h('div',{class:'study-guide-list-empty'},[h('p','Add a title, then put the things you need to remember underneath it.')]),
      h('button',{type:'button',class:'quiet-button study-guide-add-section',onClick:()=>props.data.sections.push(createSection())},'+ Title')
    ]);
  }
});
