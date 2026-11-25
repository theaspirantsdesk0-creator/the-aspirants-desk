(function(){
"use strict";
const $=id=>document.getElementById(id);
const SOURCE="https://upsc.gov.in/uploads/2026/05/Civil-Services-Preliminary-Examination-2026-Notice-E.pdf";
let catalogue=null,selectedUnit=0,selectedPaper="ALL",activeQuiz=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function current(){return window.TAD_OPTIONAL_PREP&&typeof window.TAD_OPTIONAL_PREP==="object"?window.TAD_OPTIONAL_PREP:{};}
function fillSubjects(){
 const select=$("optionalSubjectSelect");if(!select||!catalogue)return;
 select.innerHTML=catalogue.subjects.map(s=>'<option value="'+esc(s)+'">'+esc(s)+'</option>').join("");
 const saved=current().subject||"Anthropology";
 select.value=catalogue.subjects.includes(saved)?saved:"Anthropology";
 const notes=$("optionalSubjectFilter");if(notes){notes.innerHTML='<option value="ALL">Paper I + Paper II</option><option value="I">Paper I</option><option value="II">Paper II</option>';notes.value="ALL";}
}
function openSetup(){
 if(!catalogue)return;
 fillSubjects();
 const saved=current();
 if($("optionalStudyLanguage"))$("optionalStudyLanguage").value=saved.language||"Tamil + English";
 if($("optionalStudyLevel"))$("optionalStudyLevel").value=saved.level||"Beginner";
 $("optionalSetupLater").hidden=!saved.subject;
 $("optionalSetupModal").hidden=false;
 $("optionalSubjectSelect").focus();
}
function closeSetup(){if($("optionalSetupModal"))$("optionalSetupModal").hidden=true;}
function saveSelection(){
 const subject=$("optionalSubjectSelect").value;
 const language=$("optionalStudyLanguage").value;
 const level=$("optionalStudyLevel").value;
 const previous=current();
 const next={subject,language,level,selectedAt:previous.subject===subject?(previous.selectedAt||new Date().toISOString()):new Date().toISOString(),syllabusVersion:catalogue.version};
 window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));
 closeSetup();
 render();
 const feedback=$("optionalSetupFeedback");if(feedback)feedback.textContent="Your optional subject preference has been saved to your study account.";
}
function activeUnits(){
 if(!catalogue)return [];
 const subject=current().subject||"Anthropology";
 if(subject==="Anthropology")return catalogue.anthropology||[];
 return [];
}
function render(){
 if(activeQuiz&&activeQuiz.timerId)clearInterval(activeQuiz.timerId);
 activeQuiz=null;
 const host=$("optionalSyllabusWorkspace");if(!host||!catalogue)return;
 const pref=current(),subject=pref.subject||"Anthropology",units=activeUnits();
 const language=pref.language||"Tamil + English";
 const paper=selectedPaper;
 const filtered=units.map((u,i)=>({...u,index:i})).filter(u=>paper==="ALL"||u.paper===paper);
 const progress=pref.progress&&typeof pref.progress==="object"?pref.progress:{};
 const done=units.filter((u,i)=>progress[subject+":"+i]).length;
 const percent=units.length?Math.round(done/units.length*100):0;
 const subjectCount=catalogue.subjects.length;
 host.innerHTML=`
 <div class="optional-prep-head">
  <div><span class="eyebrow">YOUR MAINS OPTIONAL</span><h2>${esc(subject)}</h2><p class="muted">Two descriptive papers · 250 marks each · three hours each. Your study language: ${esc(language)}.</p></div>
  <button type="button" class="btn" id="changeOptionalSubject">Change subject</button>
 </div>
 <div class="optional-prep-stats">
  <div><b>${subjectCount}</b><span>Official subject/literature choices</span></div>
  <div><b>2</b><span>Optional papers</span></div>
  <div><b>${percent}%</b><span>Units studied</span></div>
 </div>
 <div class="optional-progress-track"><span style="width:${percent}%"></span></div>
 <div class="optional-paper-tabs" role="group" aria-label="Filter optional paper">
  <button type="button" data-paper="ALL" aria-pressed="${paper==="ALL"}">Both papers</button>
  <button type="button" data-paper="I" aria-pressed="${paper==="I"}">Paper I</button>
  <button type="button" data-paper="II" aria-pressed="${paper==="II"}">Paper II</button>
 </div>
 ${subject==="Anthropology"?`
 <div class="optional-source-note"><b>Source checked:</b> UPSC CSE 2026 official notification, Anthropology syllabus, pp. 44–48. <a href="${SOURCE}" target="_blank" rel="noopener noreferrer">Open official notification (PDF)</a>. Topic labels below are study-friendly summaries, not a replacement for the official syllabus.</div>
 <div class="optional-unit-list">${filtered.map(u=>`
  <article class="optional-unit ${progress[subject+":"+u.index]?"is-done":""}">
   <div class="optional-unit-top"><span class="pill">Paper ${u.paper}</span><label class="optional-done"><input type="checkbox" data-unit-done="${u.index}" ${progress[subject+":"+u.index]?"checked":""}> Mark unit studied</label></div>
   <h3>${esc(u.unit)}</h3>
   <ul>${u.topics.map(t=>"<li>"+esc(t)+"</li>").join("")}</ul>
   ${u.lesson?`<section class="guided-lesson"><h4>Guided lesson</h4><p class="muted">${esc(u.lesson.objective||"")}</p>${(u.lesson.sections||[]).map((section,n)=>`<article><h5>${n+1}. ${esc(section.heading)}</h5>${(section.explanation||[]).map(p=>`<p>${esc(p)}</p>`).join("")}${section.example?`<p><b>Example:</b> ${esc(section.example)}</p>`:""}</article>`).join("")}${u.lesson.keyTerms?`<h5>Key terms</h5><dl>${u.lesson.keyTerms.map(t=>`<dt><b>${esc(t.term)}</b></dt><dd>${esc(t.meaning)}</dd>`).join("")}</dl>`:""}${u.lesson.scholarLens?`<h5>Scholar perspectives</h5><ul>${u.lesson.scholarLens.map(x=>`<li><b>${esc(x.scholar)}:</b> ${esc(x.idea)}</li>`).join("")}</ul>`:""}${u.lesson.answerPractice?`<h5>Mains answer practice</h5><p>${esc(u.lesson.answerPractice)}</p>`:""}${u.lesson.revisionPrompt?`<h5>Revision prompt</h5><p>${esc(u.lesson.revisionPrompt)}</p>`:""}${u.lesson.answerPractice?`<button class="btn" type="button" data-answer-practice="${u.index}">Open in Mains Writing Pad</button>`:""}</section>`:""}
   <details><summary>Open beginner notes and explanation</summary><div class="optional-notes-body">
    <h4>Core explanation</h4>${u.notes.map(n=>"<p>"+esc(n)+"</p>").join("")}
    <h4>Study checklist</h4><ul><li>Define every key term in your own words.</li><li>Prepare one scholar / example / case study where relevant.</li><li>Draw a diagram, flowchart or comparison table where it improves clarity.</li><li>Attempt one 150–250 word answer and review relevance, evidence and structure.</li></ul>
    <h4>Quick self-test</h4><button class="btn primary" type="button" data-unit-quiz="${u.index}">Start this unit's MCQ</button>
   </div></details>
  </article>`).join("")}</div>
 <div id="optionalQuizHost" class="optional-quiz-host" aria-live="polite"></div>
 <p class="muted optional-disclaimer">These are first-pass beginner notes and unit checks. They are not a complete substitute for standard books, the official syllabus or verified previous-year questions. Further subtopic notes and Mains answer tests will be added unit by unit.</p>
 `:`
 <div class="optional-coming-soon">
  <h3>Subject selected — syllabus workspace prepared</h3>
  <p>The official UPSC notification contains the detailed Paper I and Paper II syllabus for this subject. The structured topic-by-topic notes and original tests for this subject have not yet been authored in this release; they will not be replaced with invented syllabus text.</p>
  <p><a href="${SOURCE}" target="_blank" rel="noopener noreferrer">Open the official UPSC 2026 notification and syllabus (PDF)</a></p>
  <p class="muted">Your selection is saved. General Studies, CSAT, Essay and common learning modules remain available alongside your optional.</p>
 </div>`}
 `;
 const change=$("changeOptionalSubject");if(change)change.addEventListener("click",openSetup);
 host.querySelectorAll("[data-paper]").forEach(b=>b.addEventListener("click",()=>{selectedPaper=b.dataset.paper;render();}));
 host.querySelectorAll("[data-unit-done]").forEach(box=>box.addEventListener("change",()=>{
  const next={...current(),progress:{...(current().progress||{})}};
  next.progress[subject+":"+box.dataset.unitDone]=box.checked;
  window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));
  render();
 }));
 host.querySelectorAll("[data-unit-quiz]").forEach(button=>button.addEventListener("click",()=>startQuiz(Number(button.dataset.unitQuiz))));
 host.querySelectorAll("[data-answer-practice]").forEach(button=>button.addEventListener("click",()=>{
  const selected=activeUnits()[Number(button.dataset.answerPractice)];
  if(!selected||!selected.lesson||!selected.lesson.answerPractice)return;
  window.dispatchEvent(new CustomEvent("tad:mainsPromptSelected",{detail:{
   subject:current().subject||"Anthropology",unit:selected.unit,prompt:selected.lesson.answerPractice
  }}));
  const mainsLink=document.querySelector('[data-nav="mains"]');
  if(mainsLink)mainsLink.click();
 }));
}
function startQuiz(index){
 const unit=activeUnits()[index],host=$("optionalQuizHost");if(!unit||!host)return;
 const questions=unit.test||[];
 if(!questions.length){host.textContent="A test for this unit is being prepared.";return;}
 if(activeQuiz&&activeQuiz.timerId)clearInterval(activeQuiz.timerId);
 const durationSeconds=Math.max(180,questions.length*60);
 const quizRun={index,questions,secondsLeft:durationSeconds,timerId:null,submitted:false};
 activeQuiz=quizRun;
 host.innerHTML='<section class="card optional-quiz-card"><h3>Timed unit test: '+esc(unit.unit)+'</h3><p class="optional-quiz-timer" id="optionalQuizTimer" role="timer" aria-live="off">Time remaining: 05:00</p><p class="muted">Five questions · five minutes · unanswered questions count as skipped.</p><form id="optionalQuizForm">'+questions.map((q,i)=>'<fieldset><legend>'+(i+1)+'. '+esc(q.q)+'</legend>'+q.o.map((o,j)=>'<label><input type="radio" name="q'+i+'" value="'+j+'"> '+esc(o)+'</label>').join("")+'</fieldset>').join("")+'<button class="btn primary" type="submit">Submit answers</button></form><div id="optionalQuizResult" role="status"></div></section>';
 $("optionalQuizForm").addEventListener("submit",async event=>{
  event.preventDefault();
  if(quizRun.submitted)return;
  quizRun.submitted=true;
  if(quizRun.timerId){clearInterval(quizRun.timerId);quizRun.timerId=null;}
  const form=event.currentTarget;
  const submitButton=form.querySelector('button[type="submit"]');
  if(submitButton)submitButton.disabled=true;
  const fd=new FormData(form);let score=0,skippedCount=0;
  const explanations=questions.map((q,i)=>{
   const raw=fd.get("q"+i),got=raw===null?null:Number(raw),skipped=got===null,ok=!skipped&&got===q.a;
   if(skipped)skippedCount++;else if(ok)score++;
   const verdict=skipped?"Skipped":ok?"Correct":"Review";
   return '<p><b>Q'+(i+1)+': '+verdict+'.</b> '+esc(q.w)+'</p>';
  });
  const wrongCount=questions.length-score-skippedCount;
  const attemptedAt=new Date().toISOString();
  const next={...current(),quizResults:[...(Array.isArray(current().quizResults)?current().quizResults:[]),{
   subject:current().subject||"Anthropology",paper:unit.paper,unit:unit.unit,score,maxScore:questions.length,
   wrongCount,skippedCount,attemptedAt
  }].slice(-100)};
  window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));
  const resultHost=$("optionalQuizHost");
  if(!resultHost)return;
  resultHost.innerHTML='<section class="card optional-quiz-card"><h3>Test result</h3><h4>Score: '+score+' / '+questions.length+'</h4><p>Incorrect: '+wrongCount+' · Skipped: '+skippedCount+'</p>'+explanations.join("")+'<p class="muted" id="optionalQuizSaveStatus" role="status">Saving this result to your private study workspace…</p></section>';
  const status=resultHost.querySelector("#optionalQuizSaveStatus");
  const context=window.DESK_AUTH_CONTEXT;
  if(context&&context.user&&context.user.id&&context.supabase&&typeof context.supabase.from==="function"){
   try{
    const {error}=await context.supabase.from("test_results").insert({
     user_id:context.user.id,exam:"UPSC CSE",test_name:"Optional — "+(current().subject||"Anthropology")+" — "+unit.unit,
     score,max_score:questions.length,correct_count:score,wrong_count:wrongCount,skipped_count:skippedCount
    });
    if(error)throw error;
    if(status)status.textContent="Result saved to your private account test history.";
   }catch(error){
    console.warn("Optional quiz history sync failed:",error&&error.message?error.message:error);
    if(status)status.textContent="Attempt remains in this browser's optional-subject record; the separate private test-history entry could not be confirmed. Check your connection before your next attempt.";
   }
  }else{
   if(status)status.textContent="Attempt recorded in this browser only. The private account test history was not updated because you are not signed in.";
  }
 });
 const updateTimer=()=>{
  if(quizRun.submitted)return;
  const remaining=quizRun.secondsLeft;
  const timer=$("optionalQuizTimer");
  if(timer){const minutes=Math.floor(remaining/60),seconds=remaining%60;timer.textContent="Time remaining: "+String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");}
  if(remaining<=0){
   if(quizRun.timerId){clearInterval(quizRun.timerId);quizRun.timerId=null;}
   const form=$("optionalQuizForm");
   if(form&&activeQuiz===quizRun)form.requestSubmit();
   return;
  }
  quizRun.secondsLeft-=1;
 };
 updateTimer();
 quizRun.timerId=setInterval(updateTimer,1000);
 host.scrollIntoView({behavior:"smooth",block:"start"});
}
async function init(){
 try{const r=await fetch("data/upsc/optional-syllabus.json",{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);catalogue=await r.json();fillSubjects();render();}
 catch(e){const host=$("optionalSyllabusWorkspace");if(host)host.innerHTML='<p role="status">Optional syllabus data could not be loaded. Please refresh while online.</p>';return;}
 $("optionalSetupForm").addEventListener("submit",e=>{e.preventDefault();saveSelection();});
 $("optionalSetupLater").addEventListener("click",()=>{if(current().subject)closeSetup();});
 $("openOptionalSetup").addEventListener("click",openSetup);
 window.addEventListener("tad:authStateChanged",event=>{
  const user=event.detail&&event.detail.user;
  if(!user)return;
  const pref=current();
  if(!pref.subject){openSetup();}
  else render();
 });
 window.addEventListener("tad:optionalPrepChanged",render);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
window.TADOptionalPrep={open:openSetup,render};
})();