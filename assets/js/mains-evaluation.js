(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const btn=$("mainsEvaluateBtn"),status=$("mainsEvaluationStatus"),result=$("mainsEvaluationResult"),history=$("mainsEvaluationHistory");
if(!btn||!status||!result||!history)return;
let activePrompt=null;
window.addEventListener("tad:mainsPromptSelected",event=>{activePrompt=event.detail||null;});
function setStatus(message,kind){status.textContent=message;status.classList.toggle("is-error",kind==="error");status.classList.toggle("is-success",kind==="success");}
function listBlock(title,items){
 const values=Array.isArray(items)?items:[];
 return '<section><h4>'+esc(title)+'</h4>'+(values.length?'<ul>'+values.map(item=>'<li>'+esc(item)+'</li>').join("")+'</ul>':'<p class="muted">Nothing specific to flag here.</p>')+'</section>';
}
function renderEvaluation(record){
 const ev=record&&record.evaluation;if(!ev)return;
 const criteria=Array.isArray(ev.criteria)?ev.criteria:[];
 result.innerHTML=`
 <div class="mains-evaluation-score"><div><strong>${esc(ev.estimated_mark)} / ${esc(ev.max_marks)}</strong><small>AI-estimated practice mark</small></div><div><b>${esc(record.subject||"UPSC Mains")}</b><small>${esc(record.unit||"General answer practice")} · ${esc(ev.word_count)} / ${esc(ev.word_limit)} words</small></div></div>
 <p>${esc(ev.overall_feedback||"")}</p>
 <h4>Assessment rubric</h4>
 <div class="mains-evaluation-rubric">${criteria.map(c=>'<article class="mains-evaluation-criterion"><div class="mains-evaluation-criterion-head"><span>'+esc(c.name)+'</span><span>'+esc(c.score)+' / 4</span></div><div class="mains-evaluation-bar"><span style="width:'+Math.max(0,Math.min(100,Number(c.score)/4*100))+'%"></span></div><p>'+esc(c.feedback)+'</p></article>').join("")}</div>
 <div class="mains-evaluation-feedback">${listBlock("What worked well",ev.strengths)}${listBlock("What to improve",ev.improvements)}${listBlock("Points you may have missed",ev.missing_points)}${listBlock("Factual checks to make",ev.factual_cautions)}${listBlock("Suggested rewrite plan",ev.rewrite_plan)}</div>
 <p class="mains-evaluation-disclaimer">AI-generated formative feedback. The mark is an estimate, not an official UPSC score. Verify factual cautions against reliable sources.</p>`;
}
function renderHistory(){
 const rows=typeof window.TAD_GET_MAINS_EVALUATIONS==="function"?window.TAD_GET_MAINS_EVALUATIONS():[];
 if(!rows.length){history.textContent="No evaluations saved yet. Complete an answer and request feedback to start your history.";return;}
 history.innerHTML='<div class="mains-evaluation-history-list">'+rows.slice(0,10).map((r,i)=>'<article class="mains-evaluation-history-item"><div><b>'+esc(r.evaluation?.estimated_mark)+' / '+esc(r.evaluation?.max_marks)+'</b><p>'+esc(r.prompt||"Mains answer")+'</p><small>'+esc(r.evaluatedAt?new Date(r.evaluatedAt).toLocaleString():"Saved evaluation")+'</small></div><button type="button" class="btn" data-view-evaluation="'+i+'">View</button></article>').join("")+'</div>';
 history.querySelectorAll("[data-view-evaluation]").forEach(button=>button.addEventListener("click",()=>{
  const row=rows[Number(button.dataset.viewEvaluation)];if(row){renderEvaluation(row);setStatus("Previous evaluation opened.", "success");}
 }));
}
btn.addEventListener("click",async()=>{
 const db=window.TAD_SUPABASE;
 if(typeof window.TAD_CAN_EVALUATE_MAINS!=="function"||!window.TAD_CAN_EVALUATE_MAINS()){
  setStatus("Sign in with a learner account to evaluate and privately save your answer history.","error");return;
 }
 const answer=$("mainsBox")?.value.trim()||"";
 const prompt=window.TAD_ACTIVE_MAINS_PROMPT||activePrompt||{};
 const question=prompt.prompt||($("mainsQuestionText")?.textContent||"").replace(/^Q\.\s*/,"");
 const marks=Number(prompt.marks)||((Number(prompt.wordLimit)||150)===250?15:10);
 const wordLimit=Number(prompt.wordLimit)|| (marks===15?250:150);
 if(!question.trim()){setStatus("Choose a question from the Mains bank or enter a question first.","error");return;}
 if(answer.length<40){setStatus("Write a little more before requesting an evaluation. A meaningful answer needs at least 40 characters.","error");return;}
 btn.disabled=true;btn.textContent="Evaluating…";setStatus("Anbuu is reviewing your answer against the practice rubric. This may take a short moment.");
 try{
  const response=await db.functions.invoke("ai-assistant",{body:{action:"evaluate_mains_answer",question,answer,subject:prompt.subject||$("mainsQuestionPaper")?.textContent||"UPSC Mains",unit:prompt.unit||"",maxMarks:marks,wordLimit}});
  if(response.error||!response.data?.evaluation)throw new Error(response.data?.error||response.error?.message||"Evaluation could not be completed.");
  const record={id:(window.crypto&&crypto.randomUUID?crypto.randomUUID():String(Date.now())),prompt:question,subject:prompt.subject||$("mainsQuestionPaper")?.textContent||"UPSC Mains",unit:prompt.unit||"",answer,evaluation:response.data.evaluation,evaluatedAt:response.data.evaluation.evaluated_at||new Date().toISOString()};
  renderEvaluation(record);
  const saved=await window.TAD_SAVE_MAINS_EVALUATION(record);
  if(saved)setStatus("Evaluation complete and saved to your private learner account. It will sync across devices.","success");
  else setStatus("Evaluation complete, but cloud saving could not be confirmed. It remains on this device for now; retry saving when online.","error");
  renderHistory();
 }catch(error){setStatus(error.message||"Anbuu could not evaluate this answer. Please try again later.","error");}
 finally{btn.disabled=false;btn.textContent="✦ Evaluate with Anbuu";}
});
window.addEventListener("tad:mainsEvaluationsUpdated",renderHistory);
window.addEventListener("tad:mainsStateReady",renderHistory);
renderHistory();
})();