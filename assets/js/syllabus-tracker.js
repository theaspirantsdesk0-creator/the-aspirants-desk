(function(){
"use strict";
const root=document.getElementById("tadSyllabusTracker");if(!root)return;
const $=s=>root.querySelector(s),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const states=[["not-started","Not started"],["learning","In progress"],["revision","Needs revision"],["completed","Completed"]];
let papers=[],topics=[],optionals=[],notes=[],csatCount=0;
function state(){try{const v=JSON.parse(localStorage.getItem("tad_state_v5")||"{}");return v&&typeof v==="object"?v:{}}catch(_){return {}}}
function read(){return state().syllabusTrackerProgress||{}}
function readTopics(){return state().syllabusTopicProgress||{}}
let progress=read(),topicProgress=readTopics();
function savePaper(id,value){progress={...progress,[id]:value};persist("syllabusTrackerProgress",progress);render()}
function saveTopic(id,patch){topicProgress={...topicProgress,[id]:{...(topicProgress[id]||{}),...patch}};persist("syllabusTopicProgress",topicProgress);render()}
function persist(key,value){try{const s=state();s[key]=value;localStorage.setItem("tad_state_v5",JSON.stringify(s));window.dispatchEvent(new CustomEvent("tad:syllabusTrackerChange",{detail:{key,progress:value}}))}catch(_){$("#tadSyllabusNotice").textContent="Browser storage is unavailable. Your latest change may not persist."}}
function statusSelect(id,value,kind){return '<select aria-label="Topic progress" data-kind="'+kind+'" data-id="'+esc(id)+'">'+states.map(([v,l])=>'<option value="'+v+'"'+(value===v?' selected':'')+'>'+l+'</option>').join("")+'</select>'}
function topicCard(t){
 const p=topicProgress[t.id]||{},value=p.status||"not-started",due=p.revisionDate||"";
 return '<article class="tad-syllabus-topic"><div class="tad-syllabus-topic-title"><b>'+esc(t.title)+'</b>'+(t.hasNotes?'<a href="#notesStudio">Open study notes ↗</a>':'<small>Study material not yet linked</small>')+'</div><div class="tad-syllabus-topic-controls">'+statusSelect(t.id,value,"topic")+'<label>Revision date<input type="date" data-date-id="'+esc(t.id)+'" value="'+esc(due)+'"></label></div></article>';
}
function render(){
 const all=[...papers,...optionals.map(name=>({id:"optional-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),title:name,detail:"Optional subject · subject-level tracking"}))];
 const total=all.length,completed=all.filter(x=>(progress[x.id]||"not-started")==="completed").length,started=all.filter(x=>["learning","revision","completed"].includes(progress[x.id])).length;
 $("#tadSyllabusSummary").innerHTML='<strong>'+completed+'/'+total+'</strong><small>papers / subjects completed · '+started+' started</small>';
 const group=(title,items)=>'<section class="tad-syllabus-group"><h4>'+esc(title)+' <small>'+items.length+'</small></h4><div class="tad-syllabus-list">'+items.map(item=>'<article class="tad-syllabus-item"><div class="tad-syllabus-item-copy"><b>'+esc(item.title)+'</b><small>'+esc(item.detail||item.stage||"Optional subject")+'</small></div>'+statusSelect(item.id,progress[item.id]||"not-started","paper")+'</article>').join("")+'</div></section>';
 const topicGroups=topics.map(groupData=>{
  const paper=papers.find(p=>p.id===groupData.paper);if(!paper)return "";
  const rows=groupData.items.map((title,i)=>({id:groupData.paper+"-topic-"+(i+1),title,hasNotes:notes.some(n=>n.paper===paper.title.replace("General Studies ","GS ")||n.paper===paper.title)}));
  const done=rows.filter(t=>(topicProgress[t.id]?.status||"not-started")==="completed").length;
  return '<details class="tad-syllabus-topic-group"><summary><span>'+esc(paper.title)+'</span><small>'+done+'/'+rows.length+' topics complete</small></summary><div class="tad-syllabus-topic-list">'+rows.map(topicCard).join("")+(groupData.paper==="prelims-csat"?'<p class="tad-syllabus-practice">'+csatCount+' published CSAT practice questions currently in the question dataset. <a href="#mockPracticeSection">Open practice area ↗</a></p>':'')+'</div></details>';
 }).join("");
 $("#tadSyllabusGroups").innerHTML=group("Prelims",papers.filter(x=>x.stage==="Prelims"))+group("Mains",papers.filter(x=>x.stage==="Mains"))+'<section class="tad-syllabus-group"><h4>Topic-level checklist</h4><p class="muted">Mark each syllabus area, schedule a revision date and open linked Notes Studio material where available.</p>'+topicGroups+'</section>'+group("Optional subjects",all.filter(x=>x.id.startsWith("optional-")));
}
root.addEventListener("change",e=>{
 const s=e.target.closest("select[data-id]");if(s){const valid=states.some(x=>x[0]===s.value)?s.value:"not-started";if(s.dataset.kind==="topic")saveTopic(s.dataset.id,{status:valid});else savePaper(s.dataset.id,valid);return}
 const date=e.target.closest("input[data-date-id]");if(date)saveTopic(date.dataset.dateId,{revisionDate:date.value});
});
window.addEventListener("storage",e=>{if(e.key==="tad_state_v5"){progress=read();topicProgress=readTopics();render()}});
window.addEventListener("tad:learningHubLoaded",()=>{progress=read();topicProgress=readTopics();render()});
async function init(){try{
 const [a,b,c,e]=await Promise.all([fetch("data/upsc/syllabus-tracker.json",{cache:"no-store"}),fetch("data/upsc/optional-syllabus.json",{cache:"no-store"}),fetch("data/notes/gs-foundations.json",{cache:"no-store"}),fetch("data/questions/csat.json",{cache:"no-store"})]);
 if(!a.ok||!b.ok||!c.ok||!e.ok)throw Error("Syllabus data unavailable");
 const d=await a.json(),o=await b.json(),n=await c.json(),q=await e.json();
 papers=d.papers||[];topics=d.topics||[];optionals=o.subjects||[];notes=n.chapters||[];csatCount=Array.isArray(q)?q.filter(x=>x.status==="published").length:0;
 $("#tadSyllabusNotice").textContent=d.notice+" Optional subject names are from the 2026 notification catalogue; only subject-level tracking is available for optionals at present.";
 render();
 }catch(_){$("#tadSyllabusNotice").textContent="The syllabus tracker could not load its data. Please retry after reconnecting.";$("#tadSyllabusGroups").textContent="Tracker unavailable."}}
init();
})();