(function(){
"use strict";
const $=id=>document.getElementById(id);
const SOURCE="https://upsc.gov.in/uploads/2026/05/Civil-Services-Preliminary-Examination-2026-Notice-E.pdf";
let catalogue=null,selectedUnit=0,selectedPaper="ALL",activeQuiz=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function current(){return window.TAD_OPTIONAL_PREP&&typeof window.TAD_OPTIONAL_PREP==="object"?window.TAD_OPTIONAL_PREP:{};}
function localDate(date=new Date()){const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");return y+"-"+m+"-"+d;}
function dateAfter(days){const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+days);return localDate(date);}
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
 const next={...previous,subject,language,level,selectedAt:previous.subject===subject?(previous.selectedAt||new Date().toISOString()):new Date().toISOString(),syllabusVersion:catalogue.version};
 window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));
 closeSetup();
 render();
 const feedback=$("optionalSetupFeedback");if(feedback)feedback.textContent="Your optional subject preference has been saved to your study account.";
}
function activeUnits(){
 if(!catalogue)return [];
 const subject=current().subject||"Anthropology";
 if(subject==="Anthropology")return catalogue.anthropology||[];
 const official=catalogue[subject.toLowerCase()];
 const saved=current().customUnits&&current().customUnits[subject];
 return [...(Array.isArray(official)?official:[]),...(Array.isArray(saved)?saved.map((u,i)=>({...u,custom:true,customIndex:i})):[])];
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
 const mastery=pref.mastery&&typeof pref.mastery==="object"?pref.mastery:{};
 const revisions=pref.revisionSchedule&&typeof pref.revisionSchedule==="object"?pref.revisionSchedule:{};
 const results=Array.isArray(pref.quizResults)?pref.quizResults.filter(x=>x.subject===subject):[];
 const quizCount=results.length,quizCorrect=results.reduce((n,x)=>n+Number(x.score||0),0),quizTotal=results.reduce((n,x)=>n+Number(x.maxScore||0),0);
 const quizAccuracy=quizTotal?Math.round(quizCorrect/quizTotal*100):null;
 const today=localDate(),dueItems=units.map((u,i)=>({u,i,review:revisions[subject+":"+i]})).filter(x=>x.review&&!x.review.completed&&x.review.dueAt<=today);
 const subjectCount=catalogue.subjects.length;
 host.innerHTML=`
 <div class="optional-prep-head">
  <div><span class="eyebrow">YOUR MAINS OPTIONAL</span><h2>${esc(subject)}</h2><p class="muted">Two descriptive papers · 250 marks each · three hours each. Your study language: ${esc(language)}.</p></div>
  <button type="button" class="btn" id="changeOptionalSubject">Change subject</button>
 </div>
 <div class="optional-prep-stats optional-prep-stats-four">
  <div><b>${units.length}</b><span>Syllabus units</span></div>
  <div><b>${done}/${units.length}</b><span>Units studied</span></div>
  <div><b>${quizAccuracy===null?"—":quizAccuracy+"%"}</b><span>MCQ accuracy · ${quizCount} tests</span></div>
  <div><b>${dueItems.length}</b><span>Reviews due</span></div>
 </div>
 <div class="optional-progress-track"><span style="width:${percent}%"></span></div>
 <div class="optional-learning-path"><div><span class="eyebrow">YOUR NEXT STEP</span><strong>${esc((units.find((u,i)=>!progress[subject+":"+i])||units[0]||{}).unit||"Choose a topic")}</strong><small>${done===units.length?"All units marked studied — use revision and tests to consolidate.":"Continue in syllabus order, then attempt the unit test."}</small></div><span class="optional-path-percent">${percent}%</span></div>
 <div class="optional-revision-summary"><strong>Revision queue</strong><span>${dueItems.length?dueItems.length+" unit(s) due today or earlier":"No overdue unit reviews"}</span>${dueItems.length?'<ul>'+dueItems.slice(0,4).map(x=>'<li>'+esc(x.u.unit)+' · Paper '+x.u.paper+'</li>').join("")+'</ul>':""}</div>
 <div class="optional-filter-row"><label>Find a syllabus topic<input id="optionalUnitSearch" type="search" placeholder="Search topics, scholars or keywords…"></label><span id="optionalUnitCount">${filtered.length} of ${units.length} units shown</span></div>
 <div class="optional-paper-tabs" role="group" aria-label="Filter optional paper">
  <button type="button" data-paper="ALL" aria-pressed="${paper==="ALL"}">Both papers</button>
  <button type="button" data-paper="I" aria-pressed="${paper==="I"}">Paper I</button>
  <button type="button" data-paper="II" aria-pressed="${paper==="II"}">Paper II</button>
 </div>
 ${(subject==="Anthropology"||units.some(u=>u.lesson||(u.test&&u.test.length)))?`
 <div class="optional-source-note"><b>Official syllabus reference:</b> Topic labels are study-friendly summaries, not a replacement for the UPSC syllabus. <a href="${SOURCE}" target="_blank" rel="noopener noreferrer">Open official UPSC CSE 2026 notification (PDF)</a>.</div>
  ${subject!=="Anthropology"?`<section class="optional-builder card"><h3>Extend your subject workspace</h3><p class="muted">Add a missing syllabus heading from the official notification. Your custom units remain separate from the verified syllabus map.</p><form id="optionalCustomUnitForm" class="optional-custom-form"><label>Paper <select id="optionalCustomPaper"><option value="I">Paper I</option><option value="II">Paper II</option></select></label><label>Unit / syllabus heading <input id="optionalCustomTitle" required maxlength="140" placeholder="Enter exact syllabus heading"></label><label>Topics or sub-headings <textarea id="optionalCustomTopics" rows="3" placeholder="One topic per line"></textarea></label><button class="btn primary" type="submit">Add my unit</button></form></section>`:""}
  <section class="optional-mastery-loop card"><b>Desk mastery loop</b><p>Learn the concept → connect it to an Indian or contemporary example → test recall → write a Mains answer → revise at spaced intervals.</p><small>A completed lesson alone does not mean a topic is exam-ready. Use the learning stage and revision queue to check retention.</small></section>
 <div class="optional-unit-list">${filtered.map(u=>`
  <article class="optional-unit ${progress[subject+":"+u.index]?"is-done":""}" id="optionalUnit-${u.index}" data-unit-card="${u.index}">
   <div class="optional-unit-top"><span class="pill">Paper ${u.paper}</span><label class="optional-done"><input type="checkbox" data-unit-done="${u.index}" ${progress[subject+":"+u.index]?"checked":""}> Mark unit studied</label></div>
   <h3>${esc(u.unit)}</h3>
   <div class="optional-unit-tools"><label>Learning stage<select data-unit-mastery="${u.index}"><option value="not_started">Not started</option><option value="learning">Learning</option><option value="practised">Practised</option><option value="revision_due">Revision due</option><option value="mastered">Mastered</option></select></label><span class="optional-unit-quiz-meta">${(()=>{const rows=results.filter(x=>x.unit===u.unit);const last=rows[rows.length-1];return rows.length?rows.length+" test(s) · latest "+last.score+"/"+last.maxScore:"No test attempt yet";})()}</span></div>
   <div class="optional-unit-revision"><button class="btn" type="button" data-schedule-review="${u.index}">${revisions[subject+":"+u.index]&&!revisions[subject+":"+u.index].completed?"Scheduled · "+esc(revisions[subject+":"+u.index].dueAt):"Schedule revision"}</button>${revisions[subject+":"+u.index]&&!revisions[subject+":"+u.index].completed?'<button class="btn" type="button" data-complete-review="'+u.index+'">I reviewed this</button>':""}</div>
   <ul>${u.topics.map(t=>"<li>"+esc(t)+"</li>").join("")}</ul>
   ${u.lesson?`<section class="guided-lesson"><h4>Guided lesson</h4><p class="muted">${esc(u.lesson.objective||"")}</p>${(u.lesson.sections||[]).map((section,n)=>`<article><h5>${n+1}. ${esc(section.heading)}</h5>${(section.explanation||[]).map(p=>`<p>${esc(p)}</p>`).join("")}${section.example?`<p><b>Example:</b> ${esc(section.example)}</p>`:""}</article>`).join("")}${u.lesson.keyTerms?`<h5>Key terms</h5><dl>${u.lesson.keyTerms.map(t=>`<dt><b>${esc(t.term)}</b></dt><dd>${esc(t.meaning)}</dd>`).join("")}</dl>`:""}${u.lesson.scholarLens?`<h5>Scholar perspectives</h5><ul>${u.lesson.scholarLens.map(x=>`<li><b>${esc(x.scholar)}:</b> ${esc(x.idea)}</li>`).join("")}</ul>`:""}${u.lesson.answerPractice?`<h5>Mains answer practice</h5><p>${esc(u.lesson.answerPractice)}</p>`:""}${u.lesson.revisionPrompt?`<h5>Revision prompt</h5><p>${esc(u.lesson.revisionPrompt)}</p>`:""}${u.lesson.answerPractice?`<button class="btn" type="button" data-answer-practice="${u.index}">Open in Mains Writing Pad</button>`:""}</section>`:""}
   <details><summary>Open beginner notes and explanation</summary><div class="optional-notes-body">
    <h4>Core explanation</h4>${(u.notes||[]).map(n=>"<p>"+esc(n)+"</p>").join("")||"<p>Use the guided lesson and official syllabus topics above to make your own concise notes.</p>"}
    <h4>Study checklist</h4><ul><li>Define every key term in your own words.</li><li>Prepare one scholar / example / case study where relevant.</li><li>Draw a diagram, flowchart or comparison table where it improves clarity.</li><li>Attempt one 150–250 word answer and review relevance, evidence and structure.</li></ul>
    <h4>Quick self-test</h4><button class="btn primary" type="button" data-unit-quiz="${u.index}">Start this unit's MCQ</button>
   </div></details>
  </article>`).join("")}</div>
 <div id="optionalQuizHost" class="optional-quiz-host" aria-live="polite"></div>
 <p class="muted optional-disclaimer">These are beginner study notes and original unit checks, not official UPSC answers or verified previous-year questions. Cross-check facts with standard books and the official syllabus. The selected language setting is a learning preference; the current lesson text is primarily in English, so a full Tamil translation is not yet available.</p>
 `:`
 <div class="optional-source-note"><b>Official syllabus first:</b> Official syllabus headings are preloaded where available. Add further exact headings from the notification as needed; this workspace does not invent syllabus topics. <a href="${SOURCE}" target="_blank" rel="noopener noreferrer">Open official UPSC 2026 notification (PDF)</a>.</div>
 <section class="optional-builder card"><h3>Build your ${esc(subject)} syllabus tracker</h3><p class="muted">Add units from the official syllabus. Each unit gets notes, completion status, learning stage and spaced revision. Entries save to your study account.</p>
 <form id="optionalCustomUnitForm" class="optional-custom-form"><label>Paper <select id="optionalCustomPaper"><option value="I">Paper I</option><option value="II">Paper II</option></select></label><label>Unit / syllabus heading <input id="optionalCustomTitle" required maxlength="140" placeholder="Enter exact syllabus heading"></label><label>Topics or sub-headings <textarea id="optionalCustomTopics" rows="3" placeholder="Add sub-topics, one per line"></textarea></label><button class="btn primary" type="submit">Add syllabus unit</button></form></section>
 <div class="optional-unit-list">${filtered.map(u=>`
 <article class="optional-unit" data-unit-card="${u.index}"><div class="optional-unit-top"><span class="pill">Paper ${esc(u.paper)}</span><label class="optional-done"><input type="checkbox" data-unit-done="${u.index}" ${progress[subject+":"+u.index]?"checked":""}> Mark unit studied</label></div><h3>${esc(u.unit)}</h3>
 <div class="optional-unit-tools"><label>Learning stage<select data-unit-mastery="${u.index}"><option value="not_started">Not started</option><option value="learning">Learning</option><option value="practised">Practised</option><option value="revision_due">Revision due</option><option value="mastered">Mastered</option></select></label></div>
 ${u.topics&&u.topics.length?'<ul>'+u.topics.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul>':""}
 <div class="optional-custom-notes"><label>Your study notes<textarea rows="5" data-custom-notes="${u.index}" placeholder="Definitions, scholars, examples and answer points…">${esc(u.notes||"")}</textarea></label><button class="btn" type="button" data-save-custom-notes="${u.index}">Save notes</button></div>
 <div class="optional-unit-revision"><button class="btn" type="button" data-schedule-review="${u.index}">Schedule revision</button>${u.custom?'<button class="btn" type="button" data-delete-custom-unit="'+u.customIndex+'">Remove unit</button>':""}</div></article>`).join("")}</div>
 <p class="muted optional-disclaimer">This is a learner-built tracker, not a completed subject-specific lesson bank. Verify headings and notes against the official syllabus and standard sources. Guided lessons, quizzes and model answers will be added in verified batches.</p>
 `}
 `;
 if(subject!=="Anthropology"){
 const addForm=$("optionalCustomUnitForm");
 if(addForm)addForm.addEventListener("submit",event=>{event.preventDefault();const title=$("optionalCustomTitle").value.trim();if(!title)return;const all={...(current().customUnits||{})},rows=Array.isArray(all[subject])?all[subject].slice():[];rows.push({paper:$("optionalCustomPaper").value,unit:title,topics:$("optionalCustomTopics").value.split("\\n").map(x=>x.trim()).filter(Boolean),notes:""});all[subject]=rows;window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:{...current(),customUnits:all}}));render();});
 host.querySelectorAll("[data-save-custom-notes]").forEach(button=>button.addEventListener("click",()=>{const rows={...(current().customUnits||{})},list=(rows[subject]||[]).slice(),i=Number(button.dataset.saveCustomNotes);if(!list[i])return;list[i]={...list[i],notes:host.querySelector('[data-custom-notes="'+i+'"]').value};rows[subject]=list;window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:{...current(),customUnits:rows}}));button.textContent="Saved";}));
 host.querySelectorAll("[data-delete-custom-unit]").forEach(button=>button.addEventListener("click",()=>{const rows={...(current().customUnits||{})},list=(rows[subject]||[]).slice(),i=Number(button.dataset.deleteCustomUnit);list.splice(i,1);rows[subject]=list;window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:{...current(),customUnits:rows}}));render();}));
 }
 const change=$("changeOptionalSubject");if(change)change.addEventListener("click",openSetup);
 host.querySelectorAll("[data-paper]").forEach(b=>b.addEventListener("click",()=>{selectedPaper=b.dataset.paper;render();}));
 host.querySelectorAll("[data-unit-done]").forEach(box=>box.addEventListener("change",()=>{
  const next={...current(),progress:{...(current().progress||{})}};
  next.progress[subject+":"+box.dataset.unitDone]=box.checked;
  window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));
  render();
 }));
 host.querySelectorAll("[data-unit-mastery]").forEach(select=>{select.value=mastery[subject+":"+select.dataset.unitMastery]||"not_started";select.addEventListener("change",()=>{const next={...current(),mastery:{...(current().mastery||{}),[subject+":"+select.dataset.unitMastery]:select.value}};window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));});});
 host.querySelectorAll("[data-schedule-review]").forEach(button=>button.addEventListener("click",()=>{const i=Number(button.dataset.scheduleReview),next={...current(),revisionSchedule:{...(current().revisionSchedule||{})}};next.revisionSchedule[subject+":"+i]={dueAt:dateAfter(1),intervalIndex:0,reviewCount:0,completed:false,updatedAt:new Date().toISOString()};next.mastery={...(next.mastery||{}),[subject+":"+i]:"revision_due"};window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));render();}));
 host.querySelectorAll("[data-complete-review]").forEach(button=>button.addEventListener("click",()=>{const i=Number(button.dataset.completeReview),next={...current(),revisionSchedule:{...(current().revisionSchedule||{})}};const old=next.revisionSchedule[subject+":"+i]||{},step=Math.min(4,Number(old.intervalIndex||0)+1),days=[1,3,7,21,45][step];next.revisionSchedule[subject+":"+i]={...old,intervalIndex:step,reviewCount:Number(old.reviewCount||0)+1,dueAt:dateAfter(days),completed:false,updatedAt:new Date().toISOString()};next.mastery={...(next.mastery||{}),[subject+":"+i]:"practised"};window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));render();}));
 const search=$("optionalUnitSearch");if(search)search.addEventListener("input",()=>{const q=search.value.trim().toLowerCase();let shown=0;host.querySelectorAll("[data-unit-card]").forEach(card=>{const match=!q||card.textContent.toLowerCase().includes(q);card.hidden=!match;if(match)shown++;});const count=$("optionalUnitCount");if(count)count.textContent=shown+" of "+units.length+" units shown";});

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
 const initialMinutes=Math.floor(durationSeconds/60),initialSeconds=durationSeconds%60;
 host.innerHTML='<section class="card optional-quiz-card"><h3>Timed unit test: '+esc(unit.unit)+'</h3><p class="optional-quiz-timer" id="optionalQuizTimer" role="timer" aria-live="off">Time remaining: '+String(initialMinutes).padStart(2,"0")+':'+String(initialSeconds).padStart(2,"0")+'</p><p class="muted">'+questions.length+' questions · '+Math.ceil(durationSeconds/60)+' minutes · unanswered questions count as skipped.</p><form id="optionalQuizForm">'+questions.map((q,i)=>'<fieldset><legend>'+(i+1)+'. '+esc(q.q)+'</legend>'+q.o.map((o,j)=>'<label><input type="radio" name="q'+i+'" value="'+j+'"> '+esc(o)+'</label>').join("")+'</fieldset>').join("")+'<button class="btn primary" type="submit">Submit answers</button></form><div id="optionalQuizResult" role="status"></div></section>';
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
  const masteryNext={...(next.mastery||{})};masteryNext[current().subject+":"+index]=score===questions.length?"mastered":score/questions.length>=.7?"practised":"revision_due";next.mastery=masteryNext;
  if(score<questions.length){next.revisionSchedule={...(next.revisionSchedule||{}),[current().subject+":"+index]:{dueAt:dateAfter(1),intervalIndex:0,reviewCount:0,completed:false,updatedAt:attemptedAt,source:"unit_quiz"}};}
  else if(next.revisionSchedule&&next.revisionSchedule[current().subject+":"+index]){next.revisionSchedule={...next.revisionSchedule,[current().subject+":"+index]:{...next.revisionSchedule[current().subject+":"+index],completed:true,completedAt:attemptedAt}};}
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
const guided=document.createElement("script");guided.src="assets/js/optional-guided-content.js";guided.async=true;document.head.appendChild(guided);
})();