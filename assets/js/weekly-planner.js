(function(){
"use strict";
const host=document.getElementById("tadWeeklyPlanner");if(!host)return;
const $=id=>document.getElementById(id),KEY="tad_state_v5";
let chapters=[],plan=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function root(){try{const x=JSON.parse(localStorage.getItem(KEY)||"{}");return x&&typeof x==="object"?x:{}}catch(_){return {}}}
function save(){const s=root();s.weeklyStudyPlan=plan;try{localStorage.setItem(KEY,JSON.stringify(s))}catch(_){}window.dispatchEvent(new CustomEvent("tad:weeklyStudyPlanChange",{detail:plan}));}
function recallStats(p,id){const vals=Object.values(p[id]?.recall||{});const attempts=vals.reduce((n,x)=>n+Number(x.attempts||0),0),conf=vals.reduce((n,x)=>n+Number(x.confident||0),0);return {attempts,rate:attempts?conf/attempts:1}}
function build(){
 const s=root(),p=s.notesStudioProgress||{},today=new Date();today.setHours(0,0,0,0);
 const due=chapters.filter(c=>p[c.id]?.nextReviewAt&&Date.parse(p[c.id].nextReviewAt)<=Date.now()).sort((a,b)=>Date.parse(p[a.id].nextReviewAt)-Date.parse(p[b.id].nextReviewAt));
 const weak=chapters.map(c=>({c,...recallStats(p,c.id)})).filter(x=>x.attempts&&x.rate<.7).sort((a,b)=>a.rate-b.rate);
 const untouched=chapters.filter(c=>!p[c.id]||!["complete","started","revision"].includes(p[c.id].status));
 const pool=[],seen=new Set();
 function add(type,c,minutes,why){if(!c||seen.has(type+":"+c.id))return;seen.add(type+":"+c.id);pool.push({id:type+"-"+c.id+"-"+pool.length,type,title:c.title,chapterId:c.id,minutes,reason:why,done:false})}
 due.slice(0,7).forEach(c=>add("revision",c,25,"Scheduled revision is due"));
 weak.slice(0,7).forEach(x=>add("recall",x.c,20,"Recorded recall confidence: "+Math.round(x.rate*100)+"%"));
 untouched.slice(0,7).forEach(c=>add("study",c,35,"Not yet tracked — build the foundation"));
 chapters.filter(c=>p[c.id]?.status==="started").slice(0,4).forEach(c=>add("study",c,30,"Continue a topic already in progress"));
 if(!pool.length)chapters.slice(0,5).forEach(c=>add("recall",c,20,"Use active recall to check retention"));
 const dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
 const start=new Date(today);const offset=(start.getDay()+6)%7;start.setDate(start.getDate()-offset);
 const days=Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(start.getDate()+i);return {date:date.toISOString().slice(0,10),label:dayNames[date.getDay()],tasks:[]}});
 const maxDays=Math.max(3,Math.min(7,Number(s.weeklyGoals?.days||s.studyGoals?.days||5)));
 pool.forEach((task,i)=>{const dayIndex=i%maxDays;days[dayIndex].tasks.push(task)});
 plan={weekStart:days[0].date,generatedAt:new Date().toISOString(),days,source:"notesStudioProgress"};
 save();render();
}
function render(){
 if(!plan||!Array.isArray(plan.days)){$("tadWeeklyPlanMeta").textContent="No plan saved yet. Build a plan to get started.";$("tadWeeklyPlanList").innerHTML='<p class="muted">Select “Build this week’s plan” to create a realistic schedule.</p>';return}
 const tasks=plan.days.flatMap(d=>d.tasks||[]),done=tasks.filter(t=>t.done).length,total=tasks.length;
 $("tadWeeklyPlanMeta").textContent=done+" of "+total+" tasks completed · Week starting "+new Date(plan.weekStart+"T00:00:00").toLocaleDateString();
 $("tadWeeklyPlanList").innerHTML=plan.days.map((d,di)=>'<section class="tad-weekly-plan-day"><div class="tad-weekly-plan-dayhead"><strong>'+esc(d.label)+'</strong><small>'+new Date(d.date+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})+'</small></div>'+(d.tasks?.length?'<ul>'+d.tasks.map(t=>'<li class="'+(t.done?'is-done':'')+'"><label><input type="checkbox" data-day="'+di+'" data-task="'+esc(t.id)+'" '+(t.done?'checked':'')+'><span><b>'+esc(t.title)+'</b><small>'+esc(t.type.toUpperCase())+' · '+t.minutes+' min · '+esc(t.reason)+'</small></span></label></li>').join("")+'</ul>':'<p class="muted">Flexible study / rest day</p>')+'</section>').join("");
}
host.addEventListener("change",e=>{const input=e.target.closest('input[type="checkbox"][data-day][data-task]');if(!input||!plan)return;const task=plan.days[Number(input.dataset.day)]?.tasks?.find(t=>t.id===input.dataset.task);if(!task)return;task.done=input.checked;save();render()});
$("tadWeeklyPlanBuild").addEventListener("click",build);
window.addEventListener("tad:notesStudioProgressChange",()=>{if(plan)render()});
window.addEventListener("tad:learningHubLoaded",()=>{const s=root();plan=s.weeklyStudyPlan||plan;render()});
window.addEventListener("storage",e=>{if(e.key===KEY){plan=root().weeklyStudyPlan||plan;render()}});
(async()=>{try{const r=await fetch("data/notes/gs-foundations.json",{cache:"no-store"});if(!r.ok)throw Error();const d=await r.json();chapters=Array.isArray(d.chapters)?d.chapters:[];plan=root().weeklyStudyPlan||null;render()}catch(_){$("tadWeeklyPlanList").textContent="Foundation chapter data is unavailable right now."}})();
})();