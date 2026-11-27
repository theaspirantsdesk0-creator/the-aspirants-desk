(function(){
"use strict";
const root=document.getElementById("tadSyllabusTracker");if(!root)return;
const $=s=>root.querySelector(s),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const states=[["not-started","Not started"],["learning","In progress"],["revision","Needs revision"],["completed","Completed"]];
let papers=[],optionals=[];
function read(){try{const v=JSON.parse(localStorage.getItem("tad_state_v5")||"{}");return v&&typeof v==="object"&&v.syllabusTrackerProgress&&typeof v.syllabusTrackerProgress==="object"?v.syllabusTrackerProgress:{}}catch(_){return {}}}
let progress=read();
function save(id,value){
 progress={...progress,[id]:value};
 try{const state=JSON.parse(localStorage.getItem("tad_state_v5")||"{}");state.syllabusTrackerProgress=progress;localStorage.setItem("tad_state_v5",JSON.stringify(state));window.dispatchEvent(new CustomEvent("tad:syllabusTrackerChange",{detail:{id,value,progress}}));}
 catch(_){$("#tadSyllabusNotice").textContent="Browser storage is unavailable. Your latest selection may not persist.";}
 render();
}
function itemCard(item){
 const value=progress[item.id]||"not-started";
 return '<article class="tad-syllabus-item"><div class="tad-syllabus-item-copy"><b>'+esc(item.title)+'</b><small>'+esc(item.detail||item.stage||"Optional subject")+'</small></div><label class="tad-syllabus-select-label" for="status-'+esc(item.id)+'">Progress</label><select id="status-'+esc(item.id)+'" data-syllabus-id="'+esc(item.id)+'">'+states.map(([v,label])=>'<option value="'+v+'"'+(value===v?' selected':'')+'>'+label+'</option>').join("")+'</select></article>';
}
function group(title,items){return '<section class="tad-syllabus-group"><h4>'+esc(title)+' <small>'+items.length+'</small></h4><div class="tad-syllabus-list">'+items.map(itemCard).join("")+'</div></section>'}
function render(){
 const all=[...papers,...optionals.map(name=>({id:"optional-"+name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),title:name,detail:"Optional subject · subject-level tracking"}))];
 const counts=states.map(([v,label])=>[label,all.filter(x=>(progress[x.id]||"not-started")===v).length]);
 const complete=counts.find(x=>x[0]==="Completed")[1],tracked=all.length-counts[0][1];
 $("#tadSyllabusSummary").innerHTML='<strong>'+complete+'/'+all.length+'</strong><small>completed · '+tracked+' started or completed</small>';
 $("#tadSyllabusGroups").innerHTML=group("Prelims",papers.filter(x=>x.stage==="Prelims"))+group("Mains",papers.filter(x=>x.stage==="Mains"))+group("Optional subjects",all.filter(x=>x.id.startsWith("optional-")));
}
root.addEventListener("change",e=>{const select=e.target.closest("select[data-syllabus-id]");if(select)save(select.dataset.syllabusId,states.some(x=>x[0]===select.value)?select.value:"not-started")});
window.addEventListener("storage",e=>{if(e.key==="tad_state_v5"){progress=read();render()}});
window.addEventListener("tad:learningHubLoaded",()=>{progress=read();render()});
async function init(){try{
 const [a,b]=await Promise.all([fetch("data/upsc/syllabus-tracker.json",{cache:"no-store"}),fetch("data/upsc/optional-syllabus.json",{cache:"no-store"})]);
 if(!a.ok||!b.ok)throw Error("Syllabus data unavailable");
 const d=await a.json(),o=await b.json();papers=Array.isArray(d.papers)?d.papers:[];optionals=Array.isArray(o.subjects)?o.subjects:[];
 $("#tadSyllabusNotice").textContent=d.notice+" Optional subject names are sourced from the project's UPSC notification catalogue; optional entries are subject-level, not fabricated topic lists.";
 render();
 }catch(_){$("#tadSyllabusNotice").textContent="The syllabus tracker could not load its data. Please retry after reconnecting.";$("#tadSyllabusGroups").textContent="Tracker unavailable."}}
init();
})();