(function(){
"use strict";
const host=document.getElementById("optionalSyllabusWorkspace");
if(!host)return;
let catalogue=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state=()=>window.TAD_OPTIONAL_PREP&&typeof window.TAD_OPTIONAL_PREP==="object"?window.TAD_OPTIONAL_PREP:{};
function renderGuided(){
 if(!catalogue)return;
 const heading=host.querySelector(".optional-prep-head h2");
 const subject=heading&&heading.textContent.trim();
 if(!subject||subject==="Anthropology")return;
 const units=catalogue[subject.toLowerCase()];
 if(!Array.isArray(units))return;
 host.querySelectorAll("[data-unit-card]").forEach(card=>{
  if(card.querySelector(".optional-guided-added"))return;
  const index=Number(card.dataset.unitCard),unit=units[index];
  if(!unit)return;
  const lesson=unit.lesson;
  if(lesson){
   const section=document.createElement("section");
   section.className="guided-lesson optional-guided-added";
   section.innerHTML='<h4>Guided beginner lesson</h4><p class="muted">'+esc(lesson.objective||"")+'</p>'+
    (lesson.sections||[]).map((s,i)=>'<article><h5>'+(i+1)+'. '+esc(s.heading)+'</h5>'+(s.explanation||[]).map(p=>'<p>'+esc(p)+'</p>').join("")+(s.example?'<p><b>Example:</b> '+esc(s.example)+'</p>':"")).join("")+
    (lesson.keyTerms?'<h5>Key terms</h5><dl>'+lesson.keyTerms.map(x=>'<dt><b>'+esc(x.term)+'</b></dt><dd>'+esc(x.meaning)+'</dd>').join("")+'</dl>':"")+
    (lesson.scholarLens?'<h5>Thinker perspectives</h5><ul>'+lesson.scholarLens.map(x=>'<li><b>'+esc(x.scholar)+':</b> '+esc(x.idea)+'</li>').join("")+'</ul>':"")+
    (lesson.answerPractice?'<h5>Mains answer practice</h5><p>'+esc(lesson.answerPractice)+'</p><button class="btn" type="button" data-guided-answer="'+index+'">Open in Mains Writing Pad</button>':"")+
    (lesson.revisionPrompt?'<h5>Revision prompt</h5><p>'+esc(lesson.revisionPrompt)+'</p>':"");
   const notes=card.querySelector(".optional-custom-notes");
   if(notes)notes.before(section);else card.append(section);
  }
  if(Array.isArray(unit.test)&&unit.test.length){
   const quiz=document.createElement("details");
   quiz.className="optional-guided-added";
   quiz.innerHTML='<summary>Original unit practice · '+unit.test.length+' MCQs</summary><form data-guided-quiz="'+index+'">'+
    unit.test.map((q,i)=>'<fieldset><legend>'+(i+1)+'. '+esc(q.q)+'</legend>'+q.o.map((o,j)=>'<label><input type="radio" name="q'+i+'" value="'+j+'"> '+esc(o)+'</label>').join("")+'</fieldset>').join("")+
    '<button class="btn primary" type="submit">Submit answers</button></form><div class="guided-quiz-result" role="status"></div>';
   const notes=card.querySelector(".optional-custom-notes");
   if(notes)notes.before(quiz);else card.append(quiz);
  }
 });
}
host.addEventListener("submit",event=>{
 const form=event.target.closest("form[data-guided-quiz]");
 if(!form)return;
 event.preventDefault();
 const index=Number(form.dataset.guidedQuiz);
 const heading=host.querySelector(".optional-prep-head h2");
 const subject=heading?heading.textContent.trim():"";
 const unit=(catalogue&&catalogue[subject.toLowerCase()]||[])[index];
 if(!unit||!Array.isArray(unit.test))return;
 const fd=new FormData(form);let score=0,skipped=0;
 const feedback=unit.test.map((q,i)=>{
  const value=fd.get("q"+i),correct=value!==null&&Number(value)===q.a;
  if(value===null)skipped++;else if(correct)score++;
  return '<p><b>Q'+(i+1)+': '+(value===null?"Skipped":correct?"Correct":"Review")+'.</b> '+esc(q.w)+'</p>';
 });
 const wrong=unit.test.length-score-skipped,at=new Date().toISOString(),old=state();
 const next={...old,quizResults:[...(Array.isArray(old.quizResults)?old.quizResults:[]),{subject,paper:unit.paper,unit:unit.unit,score,maxScore:unit.test.length,wrongCount:wrong,skippedCount:skipped,attemptedAt:at}].slice(-100)};
 next.mastery={...(old.mastery||{}),[subject+":"+index]:score===unit.test.length?"mastered":score/unit.test.length>=.7?"practised":"revision_due"};
 if(score<unit.test.length)next.revisionSchedule={...(old.revisionSchedule||{}),[subject+":"+index]:{dueAt:at.slice(0,10),intervalIndex:0,reviewCount:0,completed:false,updatedAt:at,source:"optional_unit_quiz"}};
 window.dispatchEvent(new CustomEvent("tad:optionalPrepSave",{detail:next}));
 const result=form.parentElement.querySelector(".guided-quiz-result");
 if(result)result.innerHTML='<h4>Score: '+score+' / '+unit.test.length+'</h4><p>Incorrect: '+wrong+' · Skipped: '+skipped+'</p>'+feedback.join("");
 form.querySelectorAll("input,button").forEach(el=>el.disabled=true);
});
host.addEventListener("click",event=>{
 const button=event.target.closest("[data-guided-answer]");
 if(!button)return;
 const index=Number(button.dataset.guidedAnswer),heading=host.querySelector(".optional-prep-head h2");
 const subject=heading?heading.textContent.trim():"";
 const unit=(catalogue&&catalogue[subject.toLowerCase()]||[])[index];
 if(!unit||!unit.lesson||!unit.lesson.answerPractice)return;
 window.dispatchEvent(new CustomEvent("tad:mainsPromptSelected",{detail:{subject,unit:unit.unit,prompt:unit.lesson.answerPractice}}));
 const mains=document.querySelector('[data-nav="mains"]');
 if(mains)mains.click();
});
fetch("data/upsc/optional-syllabus.json",{cache:"no-store"}).then(response=>{
 if(!response.ok)throw new Error("HTTP "+response.status);
 return response.json();
}).then(data=>{
 catalogue=data;
 renderGuided();
 new MutationObserver(renderGuided).observe(host,{childList:true,subtree:true});
}).catch(error=>console.warn("Optional guided lesson extension could not load:",error));
})();