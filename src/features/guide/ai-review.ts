import { defineComponent, h, ref, type PropType } from 'vue';
import type { SimpleGuideImport } from './ai-import.ts';

const METRICS = [
  ['examConfidence','Exam confidence','Likely relevance to exam topics; no actual exam prediction is verified.'],
  ['subjectConfidence','Subject confidence','How closely the generated explanations match the original material.'],
  ['studyConfidence','Study confidence','How useful the teaching, examples and practice appear for learning.'],
] as const;

/** A quick, reversible review—not a mandatory coverage checklist. */
export const GuideAiReview = defineComponent({
  name:'GuideAiReview',
  props: {
    candidate:{type:Object as PropType<SimpleGuideImport>,required:true},
    direct:Boolean,
    targetBlocks:{type:Number,default:0},
  },
  emits:{back:()=>true,cancel:()=>true,create:()=>true},
  setup(props,{emit}){
    const notice=ref(''), fallback=ref(false);
    function improvement(){
      const c=props.candidate.confidence;
      if(!c)return '';
      const low=[['Coverage',c.overallCoverage],['Exam',c.examConfidence],
        ['Subject',c.subjectConfidence],['Study',c.studyConfidence]]
        .filter(([,n])=>Number(n)<80).map(([name,n])=>name+': '+n+'%');
      return 'Using the ORIGINAL source in this AI conversation, revise the COMPLETE Dynamic Learner Guide JSON. '+
        'Improve these AI-estimated areas if justified: '+(low.join('; ')||'none specifically below 80')+'. '+
        'Potentially missed subjects: '+(c.uncoveredSubjects.join('; ')||'none specifically identified')+'. '+
        'Improve accurate teaching, worked examples, scaffolded practice and meaningful revisits as needed, '+
        'without inventing unsupported source facts. Preserve good material; update the coverage inventory, '+
        'all four confidence estimates, explanations and uncoveredSubjects honestly. '+
        'Return the COMPLETE corrected downloadable Guide JSON file in the same format.';
    }
    async function copyImprovement(){
      try{await navigator.clipboard.writeText(improvement());
        notice.value='Request copied. Send it to the same AI conversation, then return to JSON and import the new file.';
        fallback.value=false;
      }catch{notice.value='Copy the request below into your AI conversation.';fallback.value=true;}
    }
    return()=>{
      const c=props.candidate.confidence,guide=props.candidate;
      const names=guide.mode==='map'?guide.topics.map(t=>t.title):guide.sections.map(s=>s.title);
      const blockCount=guide.mode==='map'?guide.topics.reduce((sum,t)=>sum+(t.lesson?.blocks.length??0),0):0;
      const low=c&&[c.overallCoverage,c.examConfidence,c.subjectConfidence,c.studyConfidence].some(n=>n<80);
      return h('section',{class:'guide-ai-workspace guide-ai-review','aria-labelledby':'guide-ai-review-title'},[
        h('header',{class:'guide-ai-header'},[
          h('div',{class:'guide-ai-heading'},[
            h('span',{class:'guide-ai-kicker'},'Final review · Not imported yet'),
            h('h2',{id:'guide-ai-review-title',tabindex:-1},'Review your guide'),
            h('p','See the AI estimates and a concise preview, then decide when to create it. No manual subject checklist.'),
          ]),
          h('div',{class:'guide-ai-actions'},[
            h('button',{type:'button',class:'quiet-button',onClick:()=>emit('back')},'Back to JSON'),
            h('button',{type:'button',class:'quiet-button',onClick:()=>emit('cancel')},'Cancel'),
          ]),
        ]),
        !props.direct?h('p',{class:'guide-ai-review-progress'},'Step 5 · Review'):null,
        h('p',{class:'guide-ai-review-disclaimer'},'Percentages are predictions supplied by the AI, not independently verified coverage, mastery or exam probabilities.'),
        c?h('section',{class:'guide-ai-review-confidence','aria-label':'AI coverage estimates'},[
          h('div',{class:'guide-ai-review-ring',style:{'--coverage':c.overallCoverage+'%'},'aria-label':'Estimated overall coverage '+c.overallCoverage+' percent'},[
            h('div',[h('strong',c.overallCoverage+'%'),h('span','Overall coverage')]),
          ]),
          h('div',{class:'guide-ai-review-metrics'},METRICS.map(([key,label,description])=>
            h('div',{class:'guide-ai-review-metric',key},[
              h('div',[h('strong',label),h('span',c[key]+'%')]),
              h('p',description),
              h('div',{class:'guide-ai-review-meter',role:'progressbar','aria-label':label,
                'aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':c[key]},[
                  h('span',{style:{width:c[key]+'%'}}),
                ]),
            ]))),
          h('div',{class:'guide-ai-review-notes'},[
            h('p',c.coverageExplanation),
            c.uncoveredSubjects.length?h('div',[
              h('strong','Potential coverage gaps'),
              h('ul',c.uncoveredSubjects.map((subject,i)=>h('li',{key:i},subject))),
            ]):null,
            h('p',c.confidenceExplanation),
          ]),
        ]):h('p',{class:'guide-ai-review-disclaimer'},'This older JSON contains no AI confidence estimates. You can still preview and import it.'),
        c&&(low||c.uncoveredSubjects.length)?h('div',{class:'guide-ai-review-improve'},[
          h('strong','Some areas might benefit from improvement'),
          h('p','You can ask AI for a revised file, or keep the current guide.'),
          h('button',{type:'button',class:'quiet-button',onClick:()=>{void copyImprovement();}},'Copy improvement request'),
          notice.value?h('p',{role:'status'},notice.value):null,
          fallback.value?h('textarea',{readonly:true,rows:5,value:improvement(),'aria-label':'AI improvement request'}):null,
        ]):null,
        h('section',{class:'guide-ai-review-outline','aria-label':'Guide preview'},[
          h('h3',guide.title),
          guide.mode==='map' ? h('p',{class:'guide-ai-review-disclaimer'},
            'Map background: ' + (guide.background ?? 'contours').replace(/^./,letter=>letter.toUpperCase())) : null,
          h('div',{class:'guide-ai-review-counts'},[
            h('div',[h('strong',String(names.length)),h('span',guide.mode==='map'?'Map stops':'List sections')]),
            guide.mode==='map'?h('div',[h('strong',String(blockCount)),h('span','Teaching Blocks')]):null,
            guide.coverage?h('div',[h('strong',String(guide.coverage.length)),h('span','AI-listed subjects')]):null,
            props.targetBlocks>0&&guide.mode==='map'&&blockCount!==props.targetBlocks?
              h('div',[h('strong','≈'+props.targetBlocks),h('span','Requested target')]):null,
          ]),
          h('details',{class:'guide-ai-review-details',open:true},[
            h('summary',guide.mode==='map'?'Map stops and teaching blocks':'Guide sections'),
            h('ol',guide.mode==='map'?guide.topics.map(t=>h('li',{key:t.key},[
              h('strong',t.title),
              t.description?h('p',t.description):null,
              t.lesson?h('p',t.lesson.blocks.length+' Teaching Blocks · '+
                t.lesson.blocks.map(b=>b.kind.replace(/-/g,' ')).join(', ')):null,
            ])):guide.sections.map((sec,i)=>h('li',{key:i},[
              h('strong',sec.title),h('p',sec.bullets.length+' notes · '+
                sec.bullets.slice(0,2).map(b=>b.trim()).join('; ')),
            ]))),
          ]),
          guide.coverage?.length?h('details',{class:'guide-ai-review-details'},[
            h('summary','AI-reported subject coverage ('+guide.coverage.length+')'),
            h('p','The AI claims these subjects are covered at the linked stops/sections. Links are validated, but source completeness is not automatically checked.'),
            h('ul',{class:'guide-ai-review-subjects'},guide.coverage.map(item=>
              h('li',{key:item.subject},[
                h('strong',item.subject),
                h('span',item.itemNumbers.map(n=>names[n-1]??'Unknown').join(' · ')),
              ]))),
          ]):null,
        ]),
        h('div',{class:'guide-ai-review-actions'},[
          h('button',{type:'button',class:'quiet-button',onClick:()=>emit('back')},'Back to JSON'),
          h('button',{type:'button',class:'card-primary-button',onClick:()=>emit('create')},'Create guide'),
        ]),
      ]);
    };
  },
});
