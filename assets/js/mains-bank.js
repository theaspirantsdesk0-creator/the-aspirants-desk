(function(){
"use strict";
const HOST_ID="mainsBankHost";
const escapeHTML=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let catalogue=null,selectedPaper="ALL",selectedUnit="ALL";
function host(){return document.getElementById(HOST_ID);}
function render(){
 const root=host();if(!root||!catalogue)return;
 const units=catalogue.units||[];
 const questions=(catalogue.questions||[]).filter(q=>(selectedPaper==="ALL"||q.paper===selectedPaper)&&(selectedUnit==="ALL"||q.unit===selectedUnit));
 root.innerHTML=`
 <div class="mains-bank-head"><div><span class="eyebrow">OPTIONAL SUBJECT · ANTHROPOLOGY</span><h3>Topic-wise Mains answer practice</h3><p class="mains-bank-note">${escapeHTML(catalogue.sourceLabel)} These are original practice prompts, not official previous-year questions.</p></div><span class="pill">${questions.length} questions</span></div>
 <div class="mains-bank-controls">
  <label>Paper
   <select id="mainsBankPaper"><option value="ALL">Paper I + Paper II</option><option value="I">Paper I</option><option value="II">Paper II</option></select>
  </label>
  <label>Topic
   <select id="mainsBankUnit"><option value="ALL">All topics</option>${units.map(u=>'<option value="'+escapeHTML(u)+'">'+escapeHTML(u)+'</option>').join("")}</select>
  </label>
 </div>
 <div class="mains-bank-list">${questions.map(q=>`
  <article class="mains-bank-item">
   <div class="mains-bank-meta"><span class="pill">Paper ${escapeHTML(q.paper)}</span><span class="pill">${q.marks} marks</span><span class="pill">${q.durationMinutes} minutes</span><span class="pill">${q.wordLimit} words</span></div>
   <p class="mains-bank-note">${escapeHTML(q.unit)}</p><h4>${escapeHTML(q.prompt)}</h4>
   <details><summary>View answer framework</summary><p>${escapeHTML(q.framework)}</p></details>
   <div class="btn-row"><button class="btn primary" type="button" data-use-mains="${escapeHTML(q.id)}">Write this answer</button></div>
  </article>`).join("")||'<p class="muted">No questions match these filters.</p>'}</div>`;
 const paper=root.querySelector("#mainsBankPaper"),unit=root.querySelector("#mainsBankUnit");
 paper.value=selectedPaper;unit.value=selectedUnit;
 paper.addEventListener("change",()=>{selectedPaper=paper.value;render();});
 unit.addEventListener("change",()=>{selectedUnit=unit.value;render();});
 root.querySelectorAll("[data-use-mains]").forEach(button=>button.addEventListener("click",()=>{
  const question=catalogue.questions.find(q=>q.id===button.dataset.useMains);if(!question)return;
  window.dispatchEvent(new CustomEvent("tad:mainsPromptSelected",{detail:{
   subject:"Anthropology · Paper "+question.paper,unit:question.unit,prompt:question.prompt,
   framework:question.framework,marks:question.marks,wordLimit:question.wordLimit,durationMinutes:question.durationMinutes,bankId:question.id
  }}));
  const pad=document.getElementById("mainsBox");if(pad)pad.scrollIntoView({behavior:"smooth",block:"center"});
  const start=document.getElementById("mainsStartTimerBtn");if(start)start.focus();
 }));
}
async function init(){
 const root=host();if(!root)return;
 try{const response=await fetch("data/upsc/anthropology-mains-bank.json",{cache:"no-store"});if(!response.ok)throw new Error("HTTP "+response.status);catalogue=await response.json();if(!Array.isArray(catalogue.questions)||catalogue.questions.length===0)throw new Error("Question bank is empty");render();}
 catch(error){root.innerHTML='<p class="muted" role="status">Anthropology Mains questions could not be loaded. Refresh while online.</p>';console.error("Mains bank load failed:",error);}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();