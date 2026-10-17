import {useId,useRef,useState} from 'react';

export default function EvidenceTabs({sections,label='Supporting evidence'}) {
  const [chosen,setChosen]=useState('');
  const id=useId();
  const buttons=useRef([]);
  const active=sections.find(section=>section.id===chosen) || sections[0];
  if(!active)return null;
  function move(event,index) {
    const next=event.key==='Home'?0:event.key==='End'?sections.length-1:event.key==='ArrowRight'?(index+1)%sections.length:event.key==='ArrowLeft'?(index+sections.length-1)%sections.length:null;
    if(next===null)return;
    event.preventDefault();setChosen(sections[next].id);buttons.current[next]?.focus();
  }
  return <div className="fc-evidence-tabs">
    <div role="tablist" aria-label={label}>{sections.map((section,index)=><button key={section.id} ref={element=>{buttons.current[index]=element;}} type="button" role="tab" id={`${id}-tab-${section.id}`} aria-controls={`${id}-panel-${section.id}`} aria-selected={active.id===section.id} tabIndex={active.id===section.id?0:-1} onClick={()=>setChosen(section.id)} onKeyDown={event=>move(event,index)}>{section.title}</button>)}</div>
    {sections.map(section=><section key={section.id} role="tabpanel" hidden={active.id!==section.id} id={`${id}-panel-${section.id}`} aria-labelledby={`${id}-tab-${section.id}`} tabIndex={active.id===section.id?0:-1}>{active.id===section.id?section.content:null}</section>)}
  </div>;
}
