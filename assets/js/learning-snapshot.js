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