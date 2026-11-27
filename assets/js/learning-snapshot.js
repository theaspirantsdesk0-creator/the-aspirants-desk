(function(){
"use strict";
const host=document.getElementById("tadLearningSnapshot");if(!host)return;
const $=id=>host.querySelector(id.startsWith("#")?id:"#"+id);
let chapters=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function read(){try{const s=JSON.parse(localStorage.getItem("tad_state_v5")||"{}");return s&&typeof s==="object"?s.notesStudioProgress||{}:{}}catch(_){return {}}}
function render(){
 const p=read(),now=Date.now(),total=chapters.length;
 const done=chapters.filter(c=>p[c.id]?.status==="complete").length;
 const started=chapters.filter(c=>p[c.id]?.status==="started").length;
 const flagged=chapters.filter(c=>p[c.id]?.status==="revision").length;
 const due=chapters.filter(c=>p[c.id]?.nextReviewAt&&Date.parse(p[c.id].nextReviewAt)<=now);
 const weak=chapters.map(c=>{const r=Object.values(p[c.id]?.recall||{});const attempts=r.reduce((n,x)=>n+Number(x.attempts||0),0),conf=r.reduce((n,x)=>n+Number(x.confident||0),0);return {c,attempts,conf,rate:attempts?conf/attempts:1}}).filter(x=>x.attempts).sort((a,b)=>a.rate-b.rate||b.attempts-a.attempts).slice(0,3);
 const bySubject=new Map();
 chapters.forEach(c=>{
  const key=String(c.subject||"Other"),x=bySubject.get(key)||{total:0,done:0,started:0,revision:0,attempts:0,confident:0,due:0};
  const v=p[c.id]||{};x.total++;
  if(v.status==="complete")x.done++;else if(v.status==="started")x.started++;else if(v.status==="revision")x.revision++;
  if(v.nextReviewAt&&Date.parse(v.nextReviewAt)<=now)x.due++;
  Object.values(v.recall||{}).forEach(r=>{x.attempts+=Number(r.attempts||0);x.confident+=Number(r.confident||0)});
  bySubject.set(key,x);
 });
 $("#tadSubjectMastery").innerHTML=bySubject.size?[...bySubject.entries()].map(([name,x])=>{
  const progress=x.total?Math.round(x.done/x.total*100):0,confidence=x.attempts?Math.round(x.confident/x.attempts*100):null;
  return '<article class="tad-subject-card"><div class="tad-subject-card-head"><b>'+esc(name)+'</b><strong>'+progress+'%</strong></div><div class="tad-snapshot-track"><span style="width:'+progress+'%"></span></div><div class="tad-subject-meta">'+x.done+'/'+x.total+' completed · '+x.started+' in progress · '+x.revision+' flagged · '+x.due+' due</div><div class="tad-subject-meta">'+(confidence===null?'Active recall: not recorded':'Active-recall confidence: '+confidence+'% across '+x.attempts+' attempts')+'</div></article>';
 }).join(""):'<p class="muted">No subject chapters are available yet.</p>';
 const pct=total?Math.round(done/total*100):0;
 $("#snapshotStats").innerHTML=[["Completed",done],["In progress",started],["Revise",flagged],["Due now",due.length]].map(([label,n])=>'<div class="tad-snapshot-stat"><strong>'+n+'</strong><span>'+label+'</span></div>').join("");
 $("#snapshotBar").style.width=pct+"%";$("#snapshotPercent").textContent=pct+"%";
 $("#snapshotAdvice").textContent=due.length?due.length+" topic revision"+(due.length===1?" is":"s are")+" due. Start with the oldest due topic.":flagged?flagged+" topic"+(flagged===1?" needs":"s need")+" another look.":weak.length?"Use active recall to identify topics that need more practice.":"Mark a chapter as you study to build your personal learning picture.";
 $("#snapshotWeak").innerHTML=weak.length?weak.map(x=>'<li><span>'+esc(x.c.title)+'</span><small>'+Math.round(x.rate*100)+'% confident · '+x.attempts+' attempts</small></li>').join(""):'<li class="muted">Your active-recall weak topics will appear here after practice.</li>';
 $("#snapshotDue").innerHTML=due.length?due.sort((a,b)=>Date.parse(p[a.id].nextReviewAt)-Date.parse(p[b.id].nextReviewAt)).slice(0,4).map(c=>'<li><span>'+esc(c.title)+'</span><small>Review due</small></li>').join(""):'<li class="muted">No chapter revisions are due right now.</li>';
}
async function init(){try{const r=await fetch("data/notes/gs-foundations.json",{cache:"no-store"});if(!r.ok)throw Error();const d=await r.json();chapters=Array.isArray(d.chapters)?d.chapters:[];render()}catch(_){host.querySelector(".tad-snapshot-body").textContent="Study snapshot is temporarily unavailable. Open Notes Studio to view your progress."}}
window.addEventListener("tad:notesStudioProgressChange",render);
window.addEventListener("tad:learningHubLoaded",()=>window.setTimeout(render,0));
window.addEventListener("storage",e=>{if(e.key==="tad_state_v5")render()});
init();
})();