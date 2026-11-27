(function(){
"use strict";
const $=id=>document.getElementById(id);
const root=$("mockExamRoot");
if(!root)return;
const sb=window.TAD_SUPABASE;
const DRAFT_PREFIX="tad_mock_draft_v1_";
const CATALOG=[
 {code:"UPSC-PRELIMS-GS1",title:"UPSC Prelims · General Studies Paper I",stage:"prelims",type:"GS Paper I",duration:120,marks:200,expected:100},
 {code:"UPSC-PRELIMS-CSAT",title:"UPSC Prelims · CSAT Paper II",stage:"prelims",type:"CSAT Paper II",duration:120,marks:200,expected:80},
 {code:"UPSC-MAINS-GS1",title:"UPSC Mains · General Studies I",stage:"mains",type:"GS I",duration:180,marks:250,expected:20},
 {code:"UPSC-MAINS-GS2",title:"UPSC Mains · General Studies II",stage:"mains",type:"GS II",duration:180,marks:250,expected:20},
 {code:"UPSC-MAINS-GS3",title:"UPSC Mains · General Studies III",stage:"mains",type:"GS III",duration:180,marks:250,expected:20},
 {code:"UPSC-MAINS-GS4",title:"UPSC Mains · General Studies IV (Ethics)",stage:"mains",type:"GS IV",duration:180,marks:250,expected:20},
 {code:"UPSC-MAINS-ANTHRO-I",title:"UPSC Mains · Anthropology Paper I",stage:"mains",type:"Anthropology Paper I",optional:"Anthropology",duration:180,marks:250,expected:20},
 {code:"UPSC-MAINS-ANTHRO-II",title:"UPSC Mains · Anthropology Paper II",stage:"mains",type:"Anthropology Paper II",optional:"Anthropology",duration:180,marks:250,expected:20}
];
let user=null,profile=null,optionalSubject="",papers=[],attempt=null,questions=[],answers={},marked=new Set(),index=0,timer=null,saveTimer=null,expiresAt=0,startedAt=0,submitting=false,saveQueue=Promise.resolve(),savedPracticeHistory=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>String(Math.max(0,n)).padStart(2,"0");
const timeLeft=()=>Math.max(0,Math.ceil((expiresAt-Date.now())/1000));
const sectionName=q=>q.section_key||"Main";
function status(msg){const el=$("mockStatus");if(el)el.textContent=msg;}
function admin(){return profile&&profile.role==="admin";}
function readOptional(payload){
 const candidates=[payload?.optionalPrep?.subject,payload?.optionalSubject,payload?.optional_subject,payload?.optional?.subject,payload?.preferences?.optionalSubject];
 if(!candidates.some(v=>typeof v==="string"&&v.trim())){try{const local=JSON.parse(localStorage.getItem("tad_state_v5")||"{}");candidates.unshift(local?.optionalPrep?.subject);}catch(e){}}
 const found=candidates.find(v=>typeof v==="string"&&v.trim());if(found)return found;try{return localStorage.getItem("tad_optional_subject")||"";}catch(e){return ""}
}
async function boot(){
 if(!sb){root.innerHTML='<div class="card"><h2>Mock examination system</h2><p>Supabase is not connected in this browser session. Sign in again or reload the site.</p></div>';return;}
 const {data:{session}}=await sb.auth.getSession();user=session?.user||null;
 if(!user){root.innerHTML='<div class="card"><h2>Sign in to access mock examinations</h2><p>Your attempts and reports are private to your account.</p><a class="btn primary" href="#home">Go to sign in</a></div>';return;}
 const [p,u]=await Promise.all([
  sb.from("profiles").select("role,display_name").eq("id",user.id).maybeSingle(),
  sb.from("user_data").select("payload").eq("user_id",user.id).maybeSingle()
 ]);
 if(p.error||!p.data){root.innerHTML='<div class="card"><h2>Account role could not be verified</h2><p>Reload after signing in. Mock examination access is paused until your account permissions can be checked.</p></div>';return;}profile=p.data;optionalSubject=readOptional(u.data?.payload||{});savedPracticeHistory=typeof window.TAD_GET_TOPIC_PRACTICE_HISTORY==="function"?window.TAD_GET_TOPIC_PRACTICE_HISTORY().slice(0,50):(Array.isArray(u.data?.payload?.practiceHistory)?u.data.payload.practiceHistory.slice(0,50):[]);
 if(profile.role!=="learner"&&!admin()){root.innerHTML='<div class="card"><h2>Mock examinations are for learner accounts</h2><p>Sign in with a learner account to attempt papers. Owner/admin access remains available for paper management.</p></div>';return;}
 await loadPapers();await loadRecent();renderCatalog();initTopicPractice();initAdaptivePractice(u.data?.payload||{});initMainsTopicStudio();renderTopicPracticeHistory();loadMainsImprovementDashboard();await loadAnalytics();
 if(admin())$("mockAdminPanel").classList.remove("mock-hidden");
}
async function loadPapers(){
 const {data,error}=await sb.from("mock_exam_papers").select("id,code,title,exam_stage,paper_type,optional_subject,duration_minutes,total_marks,is_published,sections").order("created_at",{ascending:false});
 if(error){status("Could not load examination papers: "+error.message);papers=[];}else{
  papers=data||[];
  const {data:qrows,error:qerror}=await sb.from("mock_exam_questions").select("paper_id").eq("is_active",true);
  if(!qerror){const counts={};(qrows||[]).forEach(q=>counts[q.paper_id]=(counts[q.paper_id]||0)+1);papers.forEach(p=>p.question_count=counts[p.id]||0);}
 }
}


let adaptiveSections=[];
function initAdaptivePractice(payload){
 const host=$("tadAdaptiveRecommendations"),refresh=$("tadAdaptiveRefresh");if(!host)return;
 const run=async()=>{
  host.innerHTML='<p class="mock-save">Checking your saved practice history and published MCQ sections…</p>';
  const available=papers.filter(p=>p.is_published&&(!p.optional_subject||!optionalSubject||p.optional_subject.toLowerCase()===optionalSubject.toLowerCase()));
  if(!available.length){host.innerHTML='<p class="mock-save">No published MCQ papers are available for this account’s optional-subject selection yet.</p>';return;}
  try{
   const {data,error}=await sb.from("mock_exam_questions").select("paper_id,section_key").in("paper_id",available.map(p=>p.id)).eq("is_active",true).eq("question_type","mcq").limit(5000);
   if(error)throw error;
   const sectionMap=new Map();
   (data||[]).forEach(row=>{if(!row.section_key)return;const key=row.paper_id+"::"+row.section_key;sectionMap.set(key,{paperId:row.paper_id,section:row.section_key,count:(sectionMap.get(key)?.count||0)+1});});
   const history=Array.isArray(payload.practiceHistory)?payload.practiceHistory:(savedPracticeHistory||[]);
   const scores=new Map();
   history.forEach(h=>{if(!h||!h.paperId||!h.section)return;const key=h.paperId+"::"+h.section;const x=scores.get(key)||{attempts:0,accuracy:[],latest:""};x.attempts++;if(Number.isFinite(Number(h.accuracy)))x.accuracy.push(Number(h.accuracy));const date=h.completedAt||"";if(Date.parse(date)>Date.parse(x.latest||""))x.latest=date;scores.set(key,x);});
   const candidates=[...sectionMap.values()].map(s=>{
    const p=available.find(x=>x.id===s.paperId),h=scores.get(s.paperId+"::"+s.section),avg=h?.accuracy.length?h.accuracy.reduce((a,b)=>a+b,0)/h.accuracy.length:null;
    const reason=!h?"Not practised yet":avg<70?"Recent accuracy below 70%":avg<85?"Opportunity to strengthen accuracy":"Maintain this topic with spaced practice";
    const priority=!h?2:avg<70?0:avg<85?1:3;
    return {...s,paper:p,attempts:h?.attempts||0,accuracy:avg,latest:h?.latest||"",reason,priority};
   }).sort((a,b)=>a.priority-b.priority||(a.accuracy??101)-(b.accuracy??101)||a.attempts-b.attempts).slice(0,4);
   adaptiveSections=candidates;
   host.innerHTML=candidates.length?candidates.map((x,i)=>'<article class="tad-adaptive-card"><div><span class="tad-adaptive-rank">NEXT '+(i+1)+'</span><strong>'+esc(x.paper.title)+'</strong></div><h4>'+esc(practiceLabel(x.section))+'</h4><p>'+esc(x.reason)+'</p><small>'+x.count+' active MCQ(s) · '+x.attempts+' previous set(s)'+(x.accuracy===null?'':' · '+x.accuracy.toFixed(1)+'% average accuracy')+'</small><button type="button" class="btn primary" data-adaptive-start="'+esc(x.paperId+'::'+x.section)+'">Practise this section</button></article>').join(""):'<p class="mock-save">No active MCQ sections were found in the published papers.</p>';
   host.querySelectorAll("[data-adaptive-start]").forEach(button=>button.addEventListener("click",()=>{
    const item=candidates.find(x=>x.paperId+"::"+x.section===button.dataset.adaptiveStart);if(!item)return;
    const paperSel=$("mockPracticePaper"),sectionSel=$("mockPracticeSection"),countSel=$("mockPracticeCount"),start=$("mockPracticeStart");
    if(!paperSel||!sectionSel||!start)return;
    paperSel.value=item.paperId;paperSel.dispatchEvent(new Event("change"));
    let waits=0;const setSection=()=>{if([...sectionSel.options].some(o=>o.value===item.section)){sectionSel.value=item.section;sectionSel.dispatchEvent(new Event("change"));if(countSel)countSel.value="10";start.disabled=false;start.click();}else if(++waits<30&&!sectionSel.disabled)setTimeout(setSection,100);else{practiceStatus("That section could not be loaded. Refresh suggestions or choose a section manually.");}};
    setTimeout(setSection,100);
    $("mockTopicPractice")?.scrollIntoView({behavior:"smooth",block:"start"});
   }));
  }catch(e){host.innerHTML='<p class="mock-warning">Adaptive recommendations could not load: '+esc(e.message||"Please retry.")+'</p>';}
 };
 run();if(refresh&&!refresh.dataset.bound){refresh.dataset.bound="1";refresh.addEventListener("click",run);}
}

let practiceQuestions=[],practiceIndex=0,practiceCorrect=0,practiceWrong=0,practiceStartedAt=0,practiceSeconds=0,practiceTimer=null,practiceAnswered=false,practiceSubmitting=false;
function practiceStatus(message){const el=$("mockPracticeStatus");if(el)el.textContent=message;}
function practiceLabel(value){return String(value||"").replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
function renderTopicPracticeHistory(){
 const host=$("mockPracticeHistory");if(!host)return;
 const rows=savedPracticeHistory.slice(0,5);
 host.innerHTML=rows.length?'<h3>Recent topic practice</h3>'+rows.map(x=>'<div class="mock-practice-history-row"><div><b>'+esc(x.topic||"Topic practice")+'</b><span>'+esc(x.completedAt?new Date(x.completedAt).toLocaleString():"Saved result")+'</span></div><strong>'+Number(x.accuracy||0)+'% · '+Number(x.correct||0)+'/'+Number(x.total||0)+'</strong></div>').join(""):'<p class="mock-save">Your recent practice results will appear here after your first completed set.</p>';
}
function initTopicPractice(){
 const paperSel=$("mockPracticePaper"),sectionSel=$("mockPracticeSection"),countSel=$("mockPracticeCount"),startBtn=$("mockPracticeStart");
 if(!paperSel||!sectionSel||!countSel||!startBtn)return;
 const refreshSections=async()=>{
  sectionSel.innerHTML='<option value="">Loading sections…</option>';sectionSel.disabled=true;startBtn.disabled=true;
  const paper=papers.find(p=>p.id===paperSel.value&&p.is_published);
  if(!paper){sectionSel.innerHTML='<option value="">Choose a section</option>';return;}
  try{
   const {data,error}=await sb.from("mock_exam_questions").select("section_key").eq("paper_id",paper.id).eq("is_active",true).eq("question_type","mcq").order("sort_order");
   if(error)throw error;
   const sections=[...new Set((data||[]).map(q=>q.section_key).filter(Boolean))];
   sectionSel.innerHTML='<option value="">Choose a section</option>'+sections.map(s=>'<option value="'+esc(s)+'">'+esc(practiceLabel(s))+'</option>').join("");
   sectionSel.disabled=!sections.length;
   practiceStatus(sections.length?"Choose a section and question count.":"This published paper has no MCQ sections available for focused practice.");
  }catch(e){sectionSel.innerHTML='<option value="">Sections unavailable</option>';practiceStatus("Could not load sections: "+e.message);}
 };
 const previous=paperSel.value;
 const available=papers.filter(p=>p.is_published&&(!p.optional_subject||!optionalSubject||p.optional_subject.toLowerCase()===optionalSubject.toLowerCase()));
 paperSel.innerHTML='<option value="">Choose a published paper</option>'+available.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title)+'</option>').join("");
 paperSel.value=available.some(p=>p.id===previous)?previous:"";
 if(!paperSel.dataset.bound){
  paperSel.dataset.bound="1";
  paperSel.addEventListener("change",refreshSections);
  sectionSel.addEventListener("change",()=>{startBtn.disabled=!(paperSel.value&&sectionSel.value);});
  startBtn.addEventListener("click",startTopicPractice);
 }
 if(paperSel.value)refreshSections();
 else{sectionSel.innerHTML='<option value="">Choose a section</option>';sectionSel.disabled=true;startBtn.disabled=true;practiceStatus(available.length?"Select a paper to load its available MCQ sections.":"No published MCQ papers are available for your selected optional-subject setting.");}
}
async function startTopicPractice(){
 const paper=papers.find(p=>p.id===$("mockPracticePaper")?.value),section=$("mockPracticeSection")?.value;
 if(!paper||!section)return;
 const start=$("mockPracticeStart");if(start)start.disabled=true;
 practiceStatus("Preparing a randomised topic practice set…");
 try{
  const {data,error}=await sb.from("mock_exam_questions").select("id,section_key,question_no,question_type,prompt,options,marks,negative_marks,sort_order").eq("paper_id",paper.id).eq("section_key",section).eq("question_type","mcq").eq("is_active",true).order("sort_order").limit(200);
  if(error)throw error;
  const pool=data||[];if(!pool.length)throw new Error("No active MCQs are available in this section.");
  const count=Math.min(Number($("mockPracticeCount")?.value||10),pool.length);
  practiceQuestions=pool.map(q=>({...q})).sort(()=>Math.random()-.5).slice(0,count);
  practiceIndex=0;practiceCorrect=0;practiceWrong=0;practiceAnswered=false;practiceSubmitting=false;practiceStartedAt=Date.now();practiceSeconds=count*60;
  $("mockPracticeSession").hidden=false;
  $("mockPracticeStart").disabled=false;
  renderTopicPracticeQuestion();
  clearInterval(practiceTimer);
  practiceTimer=setInterval(()=>{practiceSeconds--;const clock=$("mockPracticeClock");if(clock)clock.textContent=Math.floor(Math.max(0,practiceSeconds)/60)+":"+String(Math.max(0,practiceSeconds)%60).padStart(2,"0");if(practiceSeconds<=0){clearInterval(practiceTimer);finishTopicPractice(true);}},1000);
 }catch(e){practiceStatus("Practice set could not be started: "+e.message);if(start)start.disabled=false;}
}
function renderTopicPracticeQuestion(){
 const host=$("mockPracticeSession"),q=practiceQuestions[practiceIndex];if(!host||!q)return;
 const options=Array.isArray(q.options)?q.options:[];
 host.innerHTML='<div class="mock-practice-top"><span>Question '+(practiceIndex+1)+' of '+practiceQuestions.length+'</span><b id="mockPracticeClock">'+Math.floor(practiceSeconds/60)+':'+String(practiceSeconds%60).padStart(2,"0")+'</b></div><div class="mock-progress"><span style="width:'+((practiceIndex)/practiceQuestions.length*100)+'%"></span></div><p class="mock-save">'+esc(practiceLabel(q.section_key))+' · '+Number(q.marks||2)+' marks</p><h3 class="mock-practice-prompt">'+esc(q.prompt)+'</h3><div class="mock-practice-options">'+options.map(o=>'<button type="button" class="mock-practice-option" data-practice-answer="'+esc(o.key)+'"><b>'+esc(o.key)+'.</b> '+esc(o.text)+'</button>').join("")+'</div><div id="mockPracticeFeedback" class="mock-practice-feedback" aria-live="polite"></div><div class="mock-actions"><button type="button" class="btn" id="mockPracticeNext" disabled>'+(practiceIndex===practiceQuestions.length-1?"Finish set":"Next question")+'</button></div>';
 host.querySelectorAll("[data-practice-answer]").forEach(btn=>btn.addEventListener("click",()=>checkTopicPracticeAnswer(q,btn.dataset.practiceAnswer,btn)));
 $("mockPracticeNext").addEventListener("click",()=>{if(practiceIndex>=practiceQuestions.length-1)finishTopicPractice(false);else{practiceIndex++;practiceAnswered=false;renderTopicPracticeQuestion();}});
}
async function checkTopicPracticeAnswer(q,answer,chosen){
 if(practiceAnswered||practiceSubmitting)return;practiceSubmitting=true;
 const buttons=$("mockPracticeSession").querySelectorAll("[data-practice-answer]");buttons.forEach(b=>b.disabled=true);
 const feedback=$("mockPracticeFeedback");if(feedback)feedback.textContent="Checking your answer…";
 try{
  const {data,error}=await sb.rpc("check_published_practice_answer",{p_question_id:q.id,p_answer:answer});
  if(error)throw error;
  const result=Array.isArray(data)?data[0]:data;if(!result)throw new Error("No answer-check result was returned.");
  practiceAnswered=true;
  if(result.is_correct){practiceCorrect++;chosen.classList.add("is-correct");}
  else{practiceWrong++;chosen.classList.add("is-wrong");buttons.forEach(b=>{if(b.dataset.practiceAnswer===result.correct_answer)b.classList.add("is-correct");});}
  const mark=result.is_correct?Number(result.marks||0):-Number(result.negative_marks||0);
  if(feedback)feedback.innerHTML='<strong class="'+(result.is_correct?"practice-good":"practice-bad")+'">'+(result.is_correct?"Correct":"Not quite")+' · '+(mark>0?"+":"")+mark.toFixed(2)+' marks</strong><p><b>Correct answer: '+esc(result.correct_answer)+'</b></p><p>'+esc(result.explanation||"No explanation was supplied for this question.")+'</p>';
  const next=$("mockPracticeNext");if(next)next.disabled=false;
 }catch(e){buttons.forEach(b=>b.disabled=false);if(feedback)feedback.textContent="Answer check failed: "+e.message+". You can retry.";chosen.disabled=false;}
 finally{practiceSubmitting=false;}
}
async function finishTopicPractice(timeExpired){
 clearInterval(practiceTimer);
 const paper=papers.find(p=>p.id===$("mockPracticePaper")?.value),section=$("mockPracticeSection")?.value||"";
 const total=practiceQuestions.length,accuracy=total?Math.round(practiceCorrect/total*100):0;
 const elapsed=Math.max(0,Math.round((Date.now()-practiceStartedAt)/1000));
 const skipped=Math.max(0,total-practiceCorrect-practiceWrong);
 const record={topic:(paper?.title||"Practice")+" · "+practiceLabel(section),paperId:paper?.id||null,section,correct:practiceCorrect,wrong:practiceWrong,skipped,total,accuracy,elapsedSeconds:elapsed,timeExpired:Boolean(timeExpired)};
 let saved=false;try{if(typeof window.TAD_RECORD_TOPIC_PRACTICE==="function")saved=await window.TAD_RECORD_TOPIC_PRACTICE(record);}catch(e){console.warn("Practice history save failed",e);}
 if(saved){savedPracticeHistory.unshift({...record,completedAt:new Date().toISOString()});savedPracticeHistory=savedPracticeHistory.slice(0,50);renderTopicPracticeHistory();}
 const host=$("mockPracticeSession");if(host)host.innerHTML='<div class="mock-practice-result"><span class="eyebrow">PRACTICE COMPLETE</span><h3>'+accuracy+'% accuracy</h3><div class="mock-analytics-kpis"><div class="mock-analytics-kpi"><b>'+practiceCorrect+'</b><span>Correct</span></div><div class="mock-analytics-kpi"><b>'+practiceWrong+'</b><span>Incorrect</span></div><div class="mock-analytics-kpi"><b>'+skipped+'</b><span>Unanswered</span></div><div class="mock-analytics-kpi"><b>'+total+'</b><span>Total questions</span></div></div><p>'+(timeExpired?"Time expired. ":"")+(accuracy<70?"A revision reminder has been scheduled for tomorrow. Review the explanations and retry this section.":"Good work. Continue with another section or revisit this one later.")+'</p><p class="mock-save">'+(saved?"Saved on this device; cloud sync is attempted when connected.":"Result shown for this session; local saving was unavailable.")+'</p><button type="button" class="btn primary" id="mockPracticeAgain">Build another set</button></div>';
 practiceStatus("Completed "+(paper?.title||"practice")+" · "+practiceLabel(section));
 $("mockPracticeAgain")?.addEventListener("click",()=>{if(host)host.hidden=true;practiceStatus("Choose a question count and start another set.");});
}


let mainsStudioQuestions=[],mainsStudioQuestion=null,mainsStudioTimer=null,mainsStudioRemaining=0,mainsStudioRunning=false,mainsStudioSaveTimer=null,mainsStudioDirty=false;
function mainsStudioStatus(message){const el=$("mainsStudioSaveStatus");if(el)el.textContent=message;}
function mainsStudioWordCount(value){return String(value||"").trim().split(/\s+/).filter(Boolean).length;}
function mainsStudioClock(){const el=$("mainsStudioClock");if(el)el.textContent=Math.floor(mainsStudioRemaining/60)+":"+String(mainsStudioRemaining%60).padStart(2,"0");}
function mainsStudioDrafts(){return typeof window.TAD_GET_MAINS_DRAFTS==="function"?window.TAD_GET_MAINS_DRAFTS():[];}
function mainsStudioDraftFor(id){return mainsStudioDrafts().find(x=>x.questionId===id);}
function renderMainsStudioHistory(){
 const host=$("mainsStudioHistory");if(!host)return;
 const rows=mainsStudioDrafts().slice(0,5);
 host.innerHTML=rows.length?'<h3>Recent saved drafts</h3>'+rows.map(x=>'<div class="mains-studio-history-row"><span>'+esc(x.paperTitle||"Mains paper")+' · Q'+esc(x.questionNo||"")+'</span><small>'+esc(x.updatedAt?new Date(x.updatedAt).toLocaleString():"Saved")+'</small></div>').join(""):'<p class="mock-save">Your saved answer drafts will appear here.</p>';
}
function mainsStudioRenderQuestion(){
 const q=mainsStudioQuestion,panel=$("mainsStudioQuestionPanel");if(!q||!panel)return;
 panel.hidden=false;
 $("mainsStudioMeta").textContent=practiceLabel(q.section_key)+" · "+q.marks+" marks · "+q.word_limit+" words";
 $("mainsStudioPrompt").textContent=q.prompt;
 const rubric=Array.isArray(q.rubric)?q.rubric:[];
 $("mainsStudioRubric").innerHTML=rubric.length?'<b>Question coverage checklist</b><ul>'+rubric.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul>':'<span>No rubric checklist was supplied for this question.</span>';
 const draft=mainsStudioDraftFor(q.id);$("mainsStudioAnswer").value=draft?.answer||"";
 $("mainsStudioLimit").textContent="Suggested limit: "+q.word_limit+" words";
 $("mainsStudioWordCount").textContent=mainsStudioWordCount($("mainsStudioAnswer").value)+" words";
 mainsStudioRemaining=Number(q.marks)===15?11*60:7*60;mainsStudioRunning=false;clearInterval(mainsStudioTimer);mainsStudioClock();
 $("mainsStudioTimer").textContent="Start timer";$("mainsStudioEvaluationStatus").textContent="";
 mainsStudioStatus(draft?"Restored your saved draft · "+new Date(draft.updatedAt).toLocaleString():"New answer · save is available while signed in.");
}
async function mainsStudioSaveDraft(){
 if(!mainsStudioQuestion)return;
 const answer=$("mainsStudioAnswer").value;
 if(!user||typeof window.TAD_SAVE_MAINS_DRAFT!=="function"){mainsStudioStatus("Sign in to save this answer to your private account.");return false;}
 const saved=await window.TAD_SAVE_MAINS_DRAFT({questionId:mainsStudioQuestion.id,paperId:mainsStudioQuestion.paper_id,paperTitle:$("mainsStudioPaper").selectedOptions[0]?.textContent||"",questionNo:mainsStudioQuestion.question_no,section:mainsStudioQuestion.section_key,answer,wordCount:mainsStudioWordCount(answer)});
 mainsStudioDirty=!saved;
 mainsStudioStatus(saved?"Draft saved to your account · "+new Date().toLocaleTimeString():"Cloud save failed. Your text remains in this session; retry saving.");
 renderMainsStudioHistory();return saved;
}
function mainsStudioQueueSave(){
 mainsStudioDirty=true;mainsStudioStatus("Unsaved changes · saving shortly…");
 clearTimeout(mainsStudioSaveTimer);mainsStudioSaveTimer=setTimeout(()=>mainsStudioSaveDraft(),1100);
}
async function loadMainsStudioQuestions(){
 const paperId=$("mainsStudioPaper")?.value,sel=$("mainsStudioQuestion");if(!sel)return;
 sel.disabled=true;sel.innerHTML='<option value="">Loading questions…</option>';
 if(!paperId){sel.innerHTML='<option value="">Choose a question</option>';return;}
 try{
  const {data,error}=await sb.from("mock_exam_questions").select("id,paper_id,section_key,question_no,question_type,prompt,marks,word_limit,rubric,sort_order").eq("paper_id",paperId).eq("is_active",true).eq("question_type","written").order("sort_order");
  if(error)throw error;mainsStudioQuestions=data||[];
  sel.innerHTML='<option value="">Choose a question</option>'+mainsStudioQuestions.map(q=>'<option value="'+esc(q.id)+'">'+esc("Q"+q.question_no+" · "+practiceLabel(q.section_key)+" · "+q.marks+" marks")+'</option>').join("");
  sel.disabled=!mainsStudioQuestions.length;
  if(!mainsStudioQuestions.length)mainsStudioStatus("No published written questions are available in this paper.");
  else{const saved=mainsStudioDrafts().find(x=>mainsStudioQuestions.some(q=>q.id===x.questionId));if(saved){sel.value=saved.questionId;mainsStudioQuestion=mainsStudioQuestions.find(q=>q.id===saved.questionId)||null;if(mainsStudioQuestion)mainsStudioRenderQuestion();}}
 }catch(e){sel.innerHTML='<option value="">Could not load questions</option>';mainsStudioStatus("Question loading failed: "+e.message);}
}
function initMainsTopicStudio(){
 const paperSel=$("mainsStudioPaper"),questionSel=$("mainsStudioQuestion");if(!paperSel||!questionSel)return;
 const refresh=$("mainsImprovementRefresh");if(refresh&&!refresh.dataset.bound){refresh.dataset.bound="1";refresh.addEventListener("click",loadMainsImprovementDashboard);}
 const available=papers.filter(p=>p.is_published&&p.exam_stage==="mains"&&(!p.optional_subject||!optionalSubject||p.optional_subject.toLowerCase()===optionalSubject.toLowerCase()));
 const previous=paperSel.value;
 paperSel.innerHTML='<option value="">Choose a published Mains paper</option>'+available.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title)+'</option>').join("");
 paperSel.value=available.some(p=>p.id===previous)?previous:"";
 if(!paperSel.dataset.bound){
  paperSel.dataset.bound="1";paperSel.addEventListener("change",loadMainsStudioQuestions);
  questionSel.addEventListener("change",async()=>{if(mainsStudioDirty){clearTimeout(mainsStudioSaveTimer);await mainsStudioSaveDraft();}mainsStudioQuestion=mainsStudioQuestions.find(q=>q.id===questionSel.value)||null;if(mainsStudioQuestion)mainsStudioRenderQuestion();else $("mainsStudioQuestionPanel").hidden=true;});
  $("mainsStudioAnswer").addEventListener("input",()=>{$("mainsStudioWordCount").textContent=mainsStudioWordCount($("mainsStudioAnswer").value)+" words";mainsStudioQueueSave();});
  $("mainsStudioSave").addEventListener("click",()=>{clearTimeout(mainsStudioSaveTimer);mainsStudioSaveDraft();});
  $("mainsStudioClear").addEventListener("click",async()=>{if(!mainsStudioQuestion)return;if(!confirm("Delete this saved draft?"))return;clearTimeout(mainsStudioSaveTimer);$("mainsStudioAnswer").value="";if(typeof window.TAD_DELETE_MAINS_DRAFT==="function")await window.TAD_DELETE_MAINS_DRAFT(mainsStudioQuestion.id);$("mainsStudioWordCount").textContent="0 words";mainsStudioStatus("Draft cleared.");renderMainsStudioHistory();});
  $("mainsStudioTimer").addEventListener("click",()=>{if(mainsStudioRunning){clearInterval(mainsStudioTimer);mainsStudioRunning=false;$("mainsStudioTimer").textContent="Resume timer";return;}if(mainsStudioRemaining<=0)mainsStudioRemaining=Number(mainsStudioQuestion?.marks)===15?11*60:7*60;mainsStudioRunning=true;$("mainsStudioTimer").textContent="Pause timer";mainsStudioTimer=setInterval(()=>{mainsStudioRemaining=Math.max(0,mainsStudioRemaining-1);mainsStudioClock();if(mainsStudioRemaining===0){clearInterval(mainsStudioTimer);mainsStudioRunning=false;$("mainsStudioTimer").textContent="Restart timer";clearTimeout(mainsStudioSaveTimer);mainsStudioSaveDraft();mainsStudioStatus("Time is up. Saving your latest answer…");}},1000);});
  $("mainsStudioEvaluate").addEventListener("click",async()=>{if(!mainsStudioQuestion)return;const answer=$("mainsStudioAnswer").value.trim();if(answer.length<40){$("mainsStudioEvaluationStatus").textContent="Write at least 40 characters before evaluation.";return;}await mainsStudioSaveDraft();answers[mainsStudioQuestion.id]=answer;const paper=papers.find(p=>p.id===$("mainsStudioPaper").value);const button=$("mainsStudioEvaluate");button.disabled=true;const old=button.textContent;button.textContent="Evaluating…";$("mainsStudioEvaluationStatus").textContent="Anbuu is preparing formative feedback…";await evaluateMockWrittenAnswer(mainsStudioQuestion,paper,button);if(button.disabled&&button.textContent==="Evaluation saved")$("mainsStudioEvaluationStatus").textContent="Evaluation saved to your answer history. See its result in your saved Mains evaluations.";else{$("mainsStudioEvaluationStatus").textContent="Evaluation did not complete. Check provider configuration and try again.";button.disabled=false;button.textContent=old;}});
 }
 if(paperSel.value)loadMainsStudioQuestions();
 renderMainsStudioHistory();
}


function improvementAdvice(tag){
 const t=String(tag||"").toLowerCase();
 if(/structure|organisation|organization|coherence/.test(t))return "Use a direct introduction, 3–4 logically ordered headings, connected analysis and a concise conclusion.";
 if(/example|case|evidence|data|illustration/.test(t))return "Add one relevant Indian example, case study, scholar, committee or verified data point where it strengthens the argument.";
 if(/analysis|critical|evaluation|depth/.test(t))return "Move beyond description: explain causes, implications, limitations and a balanced judgement.";
 if(/concept|definition|theory|thinker|scholar/.test(t))return "Begin with a precise definition, then use the relevant concept, thinker or theoretical lens accurately.";
 if(/demand|directive|question|relevance/.test(t))return "Underline the directive and split the question into every demand; give each demand explicit coverage.";
 if(/conclusion|way forward|solution/.test(t))return "End with a question-linked conclusion or feasible way forward instead of repeating the introduction.";
 if(/fact|accuracy|factual|current/.test(t))return "Verify factual claims and dates; avoid unsupported generalisations and qualify uncertain claims.";
 return "Turn this weakness into a visible checklist item and deliberately address it in your next answer.";
}
async function loadMainsImprovementDashboard(){
 const host=$("mainsImprovementContent");if(!host)return;
 if(!host.dataset.bound){host.dataset.bound="1";host.addEventListener("click",async event=>{
  const button=event.target.closest("[data-save-rewrite]");if(!button)return;
  const id=button.dataset.saveRewrite,field=host.querySelector('[data-rewrite-answer="'+CSS.escape(id)+'"]');
  if(!field)return;
  const answer=field.value.trim();if(answer.length<20){button.textContent="Write a little more first";return;}
  if(typeof window.TAD_SAVE_MAINS_DRAFT!=="function"){button.textContent="Sign in to save";return;}
  button.disabled=true;button.textContent="Saving…";
  const saved=await window.TAD_SAVE_MAINS_DRAFT({questionId:"rewrite-"+id,paperTitle:button.dataset.subject||"Mains rewrite",questionNo:"Rewrite",answer,wordCount:mainsStudioWordCount(answer),rewriteOf:id});
  button.textContent=saved?"Rewrite saved privately":"Save failed · retry";button.disabled=false;
 });}
 host.innerHTML='<p class="mock-save">Loading your private answer-writing evidence…</p>';
 try{
  const {data,error}=await sb.from("user_data").select("payload").eq("user_id",user.id).maybeSingle();
  if(error)throw error;
  const payload=data?.payload&&typeof data.payload==="object"?data.payload:{};
  const evaluations=Array.isArray(payload.answerEvaluations)?payload.answerEvaluations.filter(x=>x&&typeof x==="object"):[];
  const drafts=Array.isArray(payload.mainsDrafts)?payload.mainsDrafts:[];
  const weaknesses=new Map(),strengths=new Map(),subjects=new Map(),rubric=new Map();
  const scoreOf=e=>{const m=String(e.feedback||"").match(/FORMATIVE AI ESTIMATE:\s*([0-9.]+)\s*\/\s*([0-9.]+)/i);return m?{mark:Number(m[1]),max:Number(m[2])}:null;};
  evaluations.forEach(e=>{
   (Array.isArray(e.priorityWeaknesses)?e.priorityWeaknesses:[]).forEach(x=>weaknesses.set(x,(weaknesses.get(x)||0)+1));
   (Array.isArray(e.keyStrengths)?e.keyStrengths:[]).forEach(x=>strengths.set(x,(strengths.get(x)||0)+1));
   const subject=String(e.subject||"Mains answer"),item=subjects.get(subject)||{count:0,words:[],latest:e.savedAt||"",scores:[]};
   item.count++;item.words.push(mainsStudioWordCount(e.answer||""));
   if(Date.parse(e.savedAt||"")>Date.parse(item.latest||""))item.latest=e.savedAt||"";
   const score=scoreOf(e);if(score)item.scores.push({...score,date:e.savedAt||""});
   subjects.set(subject,item);
   const feedback=String(e.feedback||"");
   const rx=/^([^:\n]+):\s*([0-9.]+)\/([0-9.]+)\s*[—-]/gm;let match;
   while((match=rx.exec(feedback))!==null){
    const name=match[1].trim();if(!["Relevance and demand","Conceptual accuracy","Depth and analysis","Structure and coherence","Examples and evidence"].includes(name))continue;
    const x=rubric.get(name)||{score:0,max:0,count:0};x.score+=Number(match[2]);x.max+=Number(match[3]);x.count++;rubric.set(name,x);
   }
  });
  const topWeak=[...weaknesses.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4),topStrong=[...strengths.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
  const kpi=(v,l)=>'<div class="mock-analytics-kpi"><b>'+v+'</b><span>'+l+'</span></div>';
  const subjectRows=[...subjects.entries()].sort((a,b)=>b[1].count-a[1].count).map(([name,x])=>{
   x.scores.sort((a,b)=>Date.parse(a.date||"")-Date.parse(b.date||""));const latest=x.scores.at(-1),previous=x.scores.at(-2);
   const trend=latest&&previous&&latest.max===previous.max?(latest.mark-previous.mark>=0?"+":"")+(latest.mark-previous.mark).toFixed(1)+" marks vs previous":latest?"Latest "+latest.mark+"/"+latest.max:"No saved estimate";
   return '<div class="mock-analytics-row"><div><b>'+esc(name)+'</b><div class="mock-save">'+x.count+' saved evaluation(s) · latest '+(x.latest?new Date(x.latest).toLocaleDateString():"date unavailable")+'</div></div><div class="mock-analytics-score">Avg. '+Math.round(x.words.reduce((a,b)=>a+b,0)/x.words.length)+' words<br><small>'+esc(trend)+'</small></div></div>';
  }).join("");
  const rubricRows=[...rubric.entries()].map(([name,x])=>({name,average:x.max?x.score/x.count:0,max:x.max/x.count,count:x.count})).sort((a,b)=>a.average-b.average);
  const rubricHtml=rubricRows.length?'<section class="mock-analytics-group"><h3>Rubric-wise performance</h3><p class="mock-save">Average criterion points per evaluation, based on saved AI feedback.</p>'+rubricRows.map(x=>'<div class="mains-rubric-row"><div><b>'+esc(x.name)+'</b><small>'+x.count+' evaluation(s)</small></div><div class="mains-rubric-track"><span style="width:'+Math.max(0,Math.min(100,x.average/x.max*100))+'%"></span></div><strong>'+x.average.toFixed(1)+' / '+x.max.toFixed(1)+'</strong></div>').join("")+'</section>':'';
  const weakHtml=topWeak.length?'<section class="mock-analytics-group"><h3>Recurring improvement priorities</h3>'+topWeak.map(([tag,count],i)=>'<div class="mains-improvement-focus"><div><b>'+(i+1)+'. '+esc(tag)+'</b><span class="mains-improvement-count">'+count+' occurrence(s)</span><p>'+esc(improvementAdvice(tag))+'</p></div></div>').join("")+'</section>':'<p class="mock-save">No priority weaknesses have been recorded yet. Complete an Anbuu evaluation to build your improvement profile.</p>';
  const strongHtml=topStrong.length?'<section class="mock-analytics-group"><h3>Strengths to retain</h3><div class="mains-improvement-tags">'+topStrong.map(([tag,count])=>'<span>'+esc(tag)+' · '+count+'</span>').join("")+'</div></section>':'';
  const recent=evaluations.slice().sort((a,b)=>Date.parse(b.savedAt||"")-Date.parse(a.savedAt||"")).slice(0,4);
  const recentHtml=recent.length?'<section class="mock-analytics-group"><h3>Recent evaluated answers · rewrite practice</h3>'+recent.map((e,i)=>{
   const id=String(e.id||("saved-"+i));return '<article class="mains-improvement-record"><div><b>'+esc(e.subject||"Mains answer")+'</b><p>'+esc(String(e.question||"").slice(0,260))+'</p><small>'+esc(e.savedAt?new Date(e.savedAt).toLocaleString():"Saved evaluation")+' · '+mainsStudioWordCount(e.answer||"")+' words</small></div><details><summary>Review feedback</summary><pre>'+esc(e.feedback||"No feedback text stored.")+'</pre></details><details class="mains-rewrite-exercise"><summary>Practise an improved rewrite</summary><p class="mock-save">Use the feedback above. Answer the same question again with clearer structure, stronger analysis and the missing points addressed.</p><textarea rows="6" maxlength="12000" data-rewrite-answer="'+esc(id)+'" placeholder="Write your improved answer…"></textarea><button type="button" class="btn" data-save-rewrite="'+esc(id)+'" data-subject="'+esc(e.subject||"Mains rewrite")+'">Save rewrite privately</button></details></article>';
  }).join("")+'</section>':'';
  host.innerHTML='<div class="mock-analytics-kpis">'+kpi(evaluations.length,"Saved evaluations")+kpi(drafts.length,"Saved drafts")+kpi(weaknesses.size,"Distinct improvement priorities")+kpi(strengths.size,"Recorded strengths")+'</div>'+weakHtml+strongHtml+rubricHtml+(subjectRows?'<section class="mock-analytics-group"><h3>Progress by paper or subject</h3>'+subjectRows+'</section>':'')+recentHtml+'<p class="mock-save">This dashboard summarises saved feedback only. Trends compare attempts within the same paper and mark scale. AI feedback is formative, not an official UPSC assessment.</p>';
 }catch(error){host.innerHTML='<p class="mock-warning">Your private answer-writing dashboard could not be loaded: '+esc(error.message||"Please retry.")+'</p>';}
}

async function loadAnalytics(){
 const host=$("mockAnalyticsContent");if(!host)return;
 host.innerHTML='<p class="mock-save">Loading your private performance history…</p>';
 const {data:rows,error}=await sb.from("mock_exam_attempts").select("id,paper_id,status,submitted_at,score,max_score,analytics").eq("user_id",user.id).in("status",["submitted","expired"]).order("submitted_at",{ascending:false}).limit(100);
 if(error){host.innerHTML='<p class="mock-warning">Performance history could not be loaded: '+esc(error.message)+'</p>';return;}
 const attempts=rows||[];
 const {data:personal,error:personalError}=await sb.from("user_data").select("payload").eq("user_id",user.id).maybeSingle();
 if(personalError){host.innerHTML='<p class="mock-warning">Your answer-evaluation history could not be loaded.</p>';return;}
 const savedEvaluations=Array.isArray(personal?.payload?.answerEvaluations)?personal.payload.answerEvaluations:[];

 if(!attempts.length){host.innerHTML='<p class="muted">No completed mock attempts yet. Your reports will appear here after you submit a mock examination.</p>';return;}
 const paperMap=new Map(papers.map(p=>[p.id,p]));
 const enriched=attempts.map(a=>({...a,paper:paperMap.get(a.paper_id)})).filter(a=>a.paper);
 const groups={prelims:[],mains:[],anthropology:[]};
 enriched.forEach(a=>{
  const isAnthro=String(a.paper.optional_subject||"").toLowerCase()==="anthropology";
  (isAnthro?groups.anthropology:a.paper.exam_stage==="prelims"?groups.prelims:groups.mains).push(a);
 });
 const scored=enriched.filter(a=>Number(a.max_score)>0&&(Number(a.analytics?.correct||0)+Number(a.analytics?.wrong||0)+Number(a.analytics?.skipped||0))>0);
 const avg=scored.length?scored.reduce((sum,a)=>{const x=a.analytics||{};const answered=Number(x.correct||0)+Number(x.wrong||0);return sum+(answered?Number(x.correct||0)/answered*100:0);},0)/scored.length:null;
 const totalWritten=enriched.reduce((s,a)=>s+Number(a.analytics?.written_questions||0),0);
 const paperTrends=[...new Map(enriched.map(a=>[a.paper_id,a.paper])).values()].map(p=>{
  const list=enriched.filter(a=>a.paper_id===p.id).sort((a,b)=>Date.parse(b.submitted_at||"")-Date.parse(a.submitted_at||""));
  const accuracy=a=>{const x=a?.analytics||{};const n=Number(x.correct||0)+Number(x.wrong||0);return n?Number(x.correct||0)/n*100:null;};
  const latest=list[0],previous=list[1],now=accuracy(latest),before=accuracy(previous);
  return {title:p.title,latest:now,previous:before,delta:now!==null&&before!==null?now-before:null,count:list.length};
 }).filter(x=>x.count>1&&x.latest!==null);
 const evaluationGroups=new Map();
 savedEvaluations.filter(x=>x&&typeof x==="object"&&typeof x.feedback==="string").forEach(x=>{
  const key=String(x.subject||"Practice"),m=x.feedback.match(/FORMATIVE AI ESTIMATE:\s*([0-9.]+)\s*\/\s*([0-9.]+)/i);
  if(!m)return;const list=evaluationGroups.get(key)||[];list.push({mark:Number(m[1]),max:Number(m[2]),date:x.savedAt||""});evaluationGroups.set(key,list);
 });
 const evaluationTrends=[...evaluationGroups.entries()].map(([subject,list])=>{
  list.sort((a,b)=>Date.parse(b.date||"")-Date.parse(a.date||""));const latest=list[0],previous=list[1];
  return {subject,latest,previous,delta:previous&&latest.max===previous.max?latest.mark-previous.mark:null,count:list.length};
 }).filter(x=>x.count>1);

 const kpi=(value,label)=>'<div class="mock-analytics-kpi"><b>'+value+'</b><span>'+label+'</span></div>';
 const groupCard=(name,list)=>{
  const byPaper=new Map();
  list.forEach(a=>{const key=a.paper.code;const x=byPaper.get(key)||{paper:a.paper,count:0,scored:[],latest:a.submitted_at};x.count++;if(Number(a.max_score)>0&&(Number(a.analytics?.correct||0)+Number(a.analytics?.wrong||0)+Number(a.analytics?.skipped||0))>0)x.scored.push(Number(a.score||0)/Number(a.max_score)*100);if(new Date(a.submitted_at||0)>new Date(x.latest||0))x.latest=a.submitted_at;byPaper.set(key,x);});
  const items=[...byPaper.values()].map(x=>'<div class="mock-analytics-row"><div><b>'+esc(x.paper.title)+'</b><div class="mock-save">'+x.count+' completed attempt(s) · latest '+(x.latest?new Date(x.latest).toLocaleDateString():"date unavailable")+'</div></div><div class="mock-analytics-score">'+(x.scored.length?(x.scored.reduce((s,n)=>s+n,0)/x.scored.length).toFixed(1)+'% average score after negative marking':'Written review required')+'</div></div>').join("");
  return '<section class="mock-analytics-group"><h3>'+name+'</h3>'+(items||'<p class="mock-save">No attempts yet.</p>')+'</section>';
 };
 const sectionTotals={};
 enriched.forEach(a=>{
  const breakdown=a.analytics?.section_breakdown;
  if(!breakdown||typeof breakdown!=="object")return;
  Object.entries(breakdown).forEach(([key,v])=>{
   const answered=Number(v.correct||0)+Number(v.wrong||0);
   if(!answered)return;
   const x=sectionTotals[key]||{correct:0,wrong:0,score:0,attempts:0};
   x.correct+=Number(v.correct||0);x.wrong+=Number(v.wrong||0);x.score+=Number(v.score||0);x.attempts++;sectionTotals[key]=x;
  });
 });
 const weak=Object.entries(sectionTotals).map(([key,v])=>({...v,key,answered:v.correct+v.wrong,accuracy:(v.correct+v.wrong)?v.correct/(v.correct+v.wrong)*100:0})).filter(x=>x.answered>=5).sort((a,b)=>a.accuracy-b.accuracy).slice(0,4);

 const trendRows=paperTrends.map(x=>'<div class="mock-analytics-row"><div><b>'+esc(x.title)+'</b><div class="mock-save">Latest objective accuracy '+x.latest.toFixed(1)+'% · previous '+(x.previous===null?'not available':x.previous.toFixed(1)+'%')+'</div></div><div class="mock-analytics-score">'+(x.delta===null?'—':(x.delta>0?'+':'')+x.delta.toFixed(1)+' percentage points')+'</div></div>').join("");
 const evaluationRows=evaluationTrends.map(x=>'<div class="mock-analytics-row"><div><b>'+esc(x.subject)+'</b><div class="mock-save">Latest '+x.latest.mark+'/'+x.latest.max+' · previous '+x.previous.mark+'/'+x.previous.max+'</div></div><div class="mock-analytics-score">'+(x.delta===null?'Different mark scales':(x.delta>0?'+':'')+x.delta.toFixed(1)+' marks')+'</div></div>').join("");
 const trendHtml='<section class="mock-analytics-group"><h3>Improvement tracker</h3><p class="mock-save">Compares your two most recent attempts for the same paper and saved AI evaluations for the same subject. Changes are descriptive, not proof of mastery.</p>'+(trendRows||'<p class="mock-save">Complete the same paper at least twice to compare objective accuracy.</p>')+(evaluationRows?'<h4>Written-answer evaluation progress</h4>'+evaluationRows:'<p class="mock-save">Save at least two AI evaluations for the same paper/section to compare formative marks.</p>')+'</section>';
 const focusHtml=weak.length?'<section class="mock-analytics-group"><h3>Suggested next revision actions</h3><p class="mock-save">Prioritised from your lowest recorded objective section accuracy, with at least five answered questions per section.</p>'+weak.slice(0,3).map((x,i)=>'<div class="mock-analytics-row"><div><b>'+(i+1)+'. '+esc(x.key)+'</b><div class="mock-save">Current recorded accuracy '+x.accuracy.toFixed(1)+'% · '+x.answered+' answered questions</div></div><div class="mock-analytics-score">Revise · practise 10 MCQs · review errors</div></div>').join("")+'</section>':'';
 const weakHtml=weak.length?'<section class="mock-analytics-group"><h3>Objective sections to revisit</h3><p class="mock-save">Based only on scored MCQ attempts; written answers are not automatically graded.</p>'+weak.map(x=>'<div class="mock-analytics-row"><div><b>'+esc(x.key)+'</b><div class="mock-save">'+x.correct+' correct · '+x.wrong+' incorrect</div></div><div class="mock-analytics-score">'+x.accuracy.toFixed(1)+'% accuracy</div></div>').join("")+'</section>':'<section class="mock-analytics-group"><h3>Section-level review</h3><p class="mock-save">No scored MCQ section data yet. Submit a Prelims mock to generate objective weak-area insights. Mains written responses need rubric-based evaluation.</p></section>';
 host.innerHTML='<div class="mock-analytics-kpis">'+kpi(enriched.length,"Completed attempts")+kpi(scored.length,"Objectively scored attempts")+kpi(avg===null?"—":avg.toFixed(1)+"%","Average objective accuracy")+kpi(totalWritten,"Written responses awaiting review")+'</div>'+groupCard("Prelims",groups.prelims)+groupCard("Mains · General Studies",groups.mains)+groupCard("Anthropology optional",groups.anthropology)+trendHtml+focusHtml+weakHtml+'<p class="mock-save">Reports are scoped to your signed-in account. Only your own attempts are queried.</p>';
}
async function loadRecent(){
 const {data}=await sb.from("mock_exam_attempts").select("id,paper_id,status,updated_at,expires_at").eq("user_id",user.id).eq("status","in_progress").order("updated_at",{ascending:false}).limit(5);
 window.__TAD_MOCK_RESUMABLE=data||[];
}
function expectedFor(code){return CATALOG.find(x=>x.code===code)?.expected||0;}
function renderCatalog(){
 const host=$("mockPaperList");if(!host)return;
 const visible=papers.filter(p=>p.is_published||admin()).filter(p=>!p.optional_subject||(optionalSubject&&p.optional_subject.toLowerCase()===optionalSubject.toLowerCase()));
 const cards=CATALOG.map(c=>{
  const p=visible.find(x=>x.code===c.code);
  const count=p?questionsCount(p):0;
  const ready=p&&count>0;
  return '<article class="mock-paper"><div class="mock-meta"><span>'+esc(c.stage.toUpperCase())+'</span><span>·</span><span>'+c.duration+' min</span><span>·</span><span>'+c.marks+' marks</span></div><h3>'+esc(c.title)+'</h3><p class="muted" style="margin:0;font-size:.84rem">'+(ready?count+' questions published':admin()?'Paper not published yet':'Awaiting owner publication')+'</p><div class="mock-actions">'+(ready?'<button class="btn primary" data-start="'+esc(p.id)+'">Start exam</button>':'<button class="btn" disabled>Not available yet</button>')+(admin()&&p?'<button class="btn" data-edit="'+esc(p.code)+'">Manage</button>':'')+'</div></article>';
 }).join("");
 const other=visible.filter(p=>!CATALOG.some(c=>c.code===p.code)).map(p=>'<article class="mock-paper"><div class="mock-meta">'+esc(p.paper_type)+' · '+p.duration_minutes+' min · '+p.total_marks+' marks</div><h3>'+esc(p.title)+'</h3><p class="muted">'+questionsCount(p)+' questions</p><button class="btn primary" data-start="'+esc(p.id)+'">Start exam</button></article>').join("");
 host.innerHTML=cards+other||'<p class="muted">No mock papers have been published yet.</p>';
 host.querySelectorAll("[data-start]").forEach(b=>b.addEventListener("click",()=>startExam(b.dataset.start)));
 host.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{$("mockImportCode").value=b.dataset.edit;$("mockAdminPanel").scrollIntoView({behavior:"smooth"});}));
 const resume=window.__TAD_MOCK_RESUMABLE||[];
 $("mockResumeBox").innerHTML=resume.length?'<div class="mock-warning"><b>Unfinished attempt found.</b> '+resume.length+' in-progress exam(s) can be resumed. '+resume.map(a=>'<button class="btn" data-resume="'+esc(a.id)+'">Resume</button>').join(" ")+'</div>':'';
 $("mockResumeBox").querySelectorAll("[data-resume]").forEach(b=>b.addEventListener("click",()=>resumeExam(b.dataset.resume)));
}
function questionsCount(p){return p.question_count??0;}
async function fetchPaperQuestions(paperId){
 const {data,error}=await sb.from("mock_exam_questions").select("id,section_key,question_no,question_type,prompt,options,marks,negative_marks,word_limit,rubric,sort_order").eq("paper_id",paperId).eq("is_active",true).order("sort_order");
 if(error)throw error;return data||[];
}
async function startExam(paperId){
 const paper=papers.find(p=>p.id===paperId);if(!paper)return;
 try{
  const qs=await fetchPaperQuestions(paperId);if(!qs.length){status("This paper has no questions yet.");return;}
  const start=new Date(),end=new Date(start.getTime()+paper.duration_minutes*60000);
  const {data,error}=await sb.from("mock_exam_attempts").insert({user_id:user.id,paper_id:paper.id,status:"in_progress",answers:{},marked_for_review:[],current_question:0,started_at:start.toISOString(),expires_at:end.toISOString()}).select().single();
  if(error)throw error;
  attempt=data;questions=qs;answers={};marked=new Set();index=0;startedAt=start.getTime();expiresAt=end.getTime();renderExam(paper);beginTimer();saveDraft();
 }catch(e){status("Unable to start exam: "+e.message);}
}
async function resumeExam(id){
 try{
  const {data,error}=await sb.from("mock_exam_attempts").select("*").eq("id",id).eq("user_id",user.id).single();if(error)throw error;
  if(data.status!=="in_progress")return;
  const paper=papers.find(p=>p.id===data.paper_id);if(!paper)throw new Error("Paper is no longer available.");
  const qs=await fetchPaperQuestions(paper.id);attempt=data;questions=qs;answers=data.answers||{};marked=new Set(data.marked_for_review||[]);index=Math.min(data.current_question||0,Math.max(0,qs.length-1));try{const local=JSON.parse(localStorage.getItem(DRAFT_PREFIX+id)||"null");if(local&&Number(local.updatedAt)>Date.parse(data.updated_at||data.started_at)){if(local.answers&&typeof local.answers==="object")answers={...answers,...local.answers};if(Array.isArray(local.marked))marked=new Set(local.marked);if(Number.isInteger(local.index))index=Math.min(Math.max(local.index,0),Math.max(0,qs.length-1));status("Recovered a newer local draft. Syncing it to your account…");}}catch(e){}startedAt=new Date(data.started_at).getTime();expiresAt=new Date(data.expires_at).getTime();
  if(timeLeft()<=0){await submitExam(true);return;}renderExam(paper);beginTimer();saveDraft();
 }catch(e){status("Unable to resume: "+e.message);}
}
function renderExam(paper){
 $("mockCatalogView").classList.add("mock-hidden");$("mockResultView").classList.add("mock-hidden");$("mockExamView").classList.remove("mock-hidden");
 $("mockExamTitle").textContent=paper.title;$("mockExamSub").textContent=paper.paper_type+" · "+questions.length+" questions · "+paper.total_marks+" marks";
 renderQuestion();renderQuestionGrid();
}
function renderQuestion(){
 const q=questions[index];if(!q)return;
 const host=$("mockQuestionBody"),value=answers[q.id]||"";
 let input="";
 if(q.question_type==="mcq"){
  let opts=Array.isArray(q.options)?q.options:[];
  input=opts.map((o,i)=>{const key=typeof o==="string"?String.fromCharCode(65+i):(o.key||String.fromCharCode(65+i));const label=typeof o==="string"?o:o.text;return '<label class="mock-option"><input type="radio" name="mockAnswer" value="'+esc(key)+'" '+(value===key?'checked':'')+'><span><b>'+esc(key)+'.</b> '+esc(label)+'</span></label>';}).join("");
 }else{
  input='<label for="mockWrittenAnswer">Your answer'+(q.word_limit?' · '+q.word_limit+' words':'')+'</label><textarea id="mockWrittenAnswer" rows="10" placeholder="Write your structured answer here...">'+esc(value)+'</textarea><div class="mock-save" id="mockWordCount"></div>';
 }
 host.innerHTML='<div class="mock-meta">Question '+(index+1)+' of '+questions.length+' · '+esc(sectionName(q))+' · '+q.marks+' marks'+(q.question_type==="mcq"&&q.negative_marks?' · −'+q.negative_marks:'')+'</div><h3 class="mock-section-title">Q'+q.question_no+'. '+esc(q.prompt)+'</h3>'+input;
 host.querySelectorAll('input[name="mockAnswer"]').forEach(el=>el.addEventListener("change",()=>setAnswer(q.id,el.value)));
 const ta=$("mockWrittenAnswer");if(ta){const count=()=>{const n=ta.value.trim()?ta.value.trim().split(/\s+/).length:0;$("mockWordCount").textContent=n+" words";};ta.addEventListener("input",()=>{setAnswer(q.id,ta.value);count();});count();}
 const answered=questions.filter(item=>String(answers[item.id]||"").trim()).length;
 const progress=$("mockProgressFill");
 $("mockQuestionPosition").textContent="Question "+(index+1)+" of "+questions.length+" · "+answered+" answered";
 if(progress){progress.style.width=((answered/questions.length)*100)+"%";const bar=progress.parentElement;if(bar){bar.setAttribute("role","progressbar");bar.setAttribute("aria-label","Exam questions answered");bar.setAttribute("aria-valuemin","0");bar.setAttribute("aria-valuemax",String(questions.length));bar.setAttribute("aria-valuenow",String(answered));}}
 $("mockMarkBtn").textContent=marked.has(q.id)?"Remove review mark":"Mark for review";
 $("mockMarkBtn").setAttribute("aria-pressed",String(marked.has(q.id)));
 $("mockPrevBtn").disabled=index===0;$("mockNextBtn").textContent=index===questions.length-1?"Review answers":"Next";
}
function setAnswer(id,value){answers[id]=value;storeLocalDraft();status("Saving…");clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveDraft(),350);renderQuestionGrid();}
function renderQuestionGrid(){
 const grid=$("mockQuestionGrid");if(!grid)return;
 grid.setAttribute("role","group");grid.setAttribute("aria-label","Question navigation palette");
 grid.innerHTML=questions.map((q,i)=>{
  const answered=String(answers[q.id]||"").trim().length>0,review=marked.has(q.id),current=i===index;
  const state=[answered?"answered":"unanswered",review?"marked for review":""].filter(Boolean).join(", ");
  return '<button type="button" class="mock-qnum '+(answered?'answered ':'')+(review?'review ':'')+(current?'current':'')+'" data-q="'+i+'" aria-label="Question '+(i+1)+', '+state+'" '+(current?'aria-current="step"':'')+' title="Question '+(i+1)+': '+state+'">'+(i+1)+'</button>';
 }).join("");
 grid.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>{index=Number(b.dataset.q);renderQuestion();renderQuestionGrid();}));
 const answered=questions.filter(q=>String(answers[q.id]||"").trim()).length;
 const review=questions.filter(q=>marked.has(q.id)).length;
 $("mockQuestionPosition").textContent="Question "+(index+1)+" of "+questions.length+" · "+answered+" answered";
 const progress=$("mockProgressFill"),bar=progress?.parentElement;
 if(progress){progress.style.width=((answered/questions.length)*100)+"%";if(bar){bar.setAttribute("role","progressbar");bar.setAttribute("aria-label","Exam questions answered");bar.setAttribute("aria-valuemin","0");bar.setAttribute("aria-valuemax",String(questions.length));bar.setAttribute("aria-valuenow",String(answered));}}
 $("mockAnsweredCount").textContent=answered+" answered · "+(questions.length-answered)+" unanswered · "+review+" for review";
}
function storeLocalDraft(){
 if(!attempt)return;
 const snapshot={answers:{...answers},marked:[...marked],index,updatedAt:Date.now()};
 try{localStorage.setItem(DRAFT_PREFIX+attempt.id,JSON.stringify(snapshot));}catch(e){}
}
function saveDraft(){
 if(!attempt||!sb)return Promise.resolve(false);
 const current=attempt,attemptId=current.id,userId=user.id;
 const snapshot={answers:{...answers},marked:[...marked],index};
 storeLocalDraft();
 saveQueue=saveQueue.catch(()=>false).then(async()=>{
  const {error}=await sb.from("mock_exam_attempts").update({answers:snapshot.answers,marked_for_review:snapshot.marked,current_question:snapshot.index,updated_at:new Date().toISOString()}).eq("id",attemptId).eq("user_id",userId).eq("status","in_progress");
  if(error)throw error;
  if(attempt?.id===attemptId&&!submitting)status("All answers saved");
  return true;
 }).catch(()=>{if(attempt?.id===attemptId)status("Cloud save failed; local draft retained");return false;});
 return saveQueue;
}
function beginTimer(){
 clearInterval(timer);updateTimer();timer=setInterval(()=>{updateTimer();if(timeLeft()<=0){clearInterval(timer);submitExam(true);}},1000);
}
function updateTimer(){const s=timeLeft(),el=$("mockClock");if(el){el.textContent=fmt(Math.floor(s/3600))+":"+fmt(Math.floor(s%3600/60))+":"+fmt(s%60);el.classList.toggle("urgent",s<300);}}
function reviewSummary(){
 const answered=questions.filter(q=>String(answers[q.id]||"").trim()).length;
 const mcq=questions.filter(q=>q.question_type==="mcq").length;
 return "You answered "+answered+" of "+questions.length+" questions. "+(questions.length-answered)+" are unanswered. "+marked.size+" are marked for review. Submit this examination?";
}
async function submitExam(auto){
 if(!attempt||submitting)return;
 if(!auto&&!confirm(reviewSummary()))return;
 submitting=true;clearInterval(timer);clearTimeout(saveTimer);
 const synced=await saveDraft();
 if(!synced){submitting=false;status("Your latest answers could not be synced. Your local draft is retained; check your connection and retry submission.");if(timeLeft()>0)beginTimer();return;}
 status(auto?"Time expired. Submitting examination…":"Submitting examination…");
 const {data,error}=await sb.rpc("submit_mock_exam",{p_attempt_id:attempt.id});
 if(error){submitting=false;status("Submission could not be confirmed: "+error.message+". Your saved answers remain available; retry submission.");return;}
 const result=data||{};const a=result.analytics||{};
 const paper=papers.find(p=>p.id===attempt.paper_id);
 const resultKey="UPSC Mock Attempt "+attempt.id;
 const {data:existingHistory,error:lookupError}=await sb.from("test_results").select("id").eq("user_id",user.id).eq("exam",resultKey).maybeSingle();
 if(lookupError)console.warn("Could not check mock history idempotency",lookupError);
 else if(!existingHistory){
  const {error:historyError}=await sb.from("test_results").insert({user_id:user.id,exam:resultKey,test_name:paper?.title||"Full-length mock",score:Number(result.score||0),max_score:Number(result.max_score||paper?.total_marks||0),correct_count:Number(a.correct??result.correct??0),wrong_count:Number(a.wrong??result.wrong??0),skipped_count:Number(a.skipped??result.skipped??0)});
  if(historyError)console.warn("Result history not written",historyError);
 }
 try{localStorage.removeItem(DRAFT_PREFIX+attempt.id);}catch(e){}
 renderResult(result,paper);submitting=false;
}
async function evaluateMockWrittenAnswer(q,paper,button){
 const answer=String(answers[q.id]||"").trim();
 if(answer.length<40){status("Write at least 40 characters before requesting an evaluation.");return;}
 if(![10,15].includes(Number(q.marks))||![150,250].includes(Number(q.word_limit))){status("This question's mark or word-limit format is not supported by the current evaluator.");return;}
 button.disabled=true;const old=button.textContent;button.textContent="Evaluating…";
 const host=$("mockEvalStatus-"+q.id);if(host)host.textContent="Anbuu is reviewing demand coverage, accuracy, structure and analysis…";
 try{
  const result=await sb.functions.invoke("ai-assistant",{body:{action:"evaluate_mains_answer",question:q.prompt,answer,subject:paper.title,unit:sectionName(q),maxMarks:Number(q.marks),wordLimit:Number(q.word_limit)}});
  if(result.error)throw result.error;
  if(!result.data?.evaluation)throw new Error(result.data?.error||"No evaluation was returned.");
  const ev=result.data.evaluation;
  const list=(items)=>Array.isArray(items)&&items.length?items.map(item=>"• "+String(item)).join("\\n"):"• None recorded";
  const feedback=[
   "FORMATIVE AI ESTIMATE: "+ev.estimated_mark+"/"+ev.max_marks,
   "Overall: "+String(ev.overall_feedback||""),
   "Word count: "+ev.word_count+" / "+ev.word_limit,
   "PRIORITY WEAKNESSES: "+[...(Array.isArray(ev.improvements)?ev.improvements:[]),...(Array.isArray(ev.missing_points)?ev.missing_points:[])].filter(Boolean).slice(0,6).join("; "),
   "KEY STRENGTHS: "+(Array.isArray(ev.strengths)?ev.strengths.filter(Boolean).slice(0,6).join("; "):""),
   "RUBRIC:",
   ...(Array.isArray(ev.criteria)?ev.criteria.map(row=>row.name+": "+row.score+"/"+row.max_score+" — "+row.feedback):[]),
   "STRENGTHS:",list(ev.strengths),
   "IMPROVEMENTS:",list(ev.improvements),
   "MISSING POINTS:",list(ev.missing_points),
   "FACTUAL CAUTIONS:",list(ev.factual_cautions),
   "NEXT PRACTICE:",list(ev.rewrite_plan),
   "AI-generated formative feedback; not an official UPSC score."
  ].join("\\n");
  const saved=await sb.functions.invoke("ai-assistant",{body:{action:"save_answer_evaluation",subject:paper.title+" · "+sectionName(q),question:q.prompt,answer,wordLimit:Number(q.word_limit),feedback}});
  if(saved.error||!saved.data?.saved)throw new Error(saved.data?.error||"Evaluation generated but could not be saved.");
  if(host)host.textContent="Saved to your private answer history · formative estimate "+ev.estimated_mark+"/"+ev.max_marks+" · "+ev.word_count+" words";
  button.textContent="Evaluation saved";button.disabled=true;
  loadAnalytics();loadMainsImprovementDashboard();
 }catch(error){
  let message=error?.message||"Evaluation could not be completed.";
  try{const payload=error?.context&&typeof error.context.clone==="function"?await error.context.clone().json():null;if(payload?.error)message=payload.error;}catch(_){}
  if(host)host.textContent=message;
  button.disabled=false;button.textContent=old;
 }
}
function renderMockWrittenEvaluations(paper){
 const written=questions.filter(q=>q.question_type==="written");
 if(!written.length)return "";
 const rows=written.map(q=>{
  const answer=String(answers[q.id]||"").trim();
  const id="mockEvalStatus-"+q.id;
  if(!answer)return '<article class="mock-written-review"><b>Q'+q.question_no+' · '+q.marks+' marks</b><p class="mock-save">No answer submitted for evaluation.</p></article>';
  return '<article class="mock-written-review"><div><b>Q'+q.question_no+' · '+q.marks+' marks · '+esc(sectionName(q))+'</b><p>'+esc(q.prompt)+'</p><div class="mock-save">'+answer.split(/\\s+/).filter(Boolean).length+' words · Suggested limit '+q.word_limit+'</div></div><button class="btn primary mock-evaluate-answer" type="button" data-evaluate="'+esc(q.id)+'">Evaluate with Anbuu</button><p class="mock-save" id="'+id+'" aria-live="polite">Not yet evaluated.</p></article>';
 }).join("");
 return '<section class="mock-written-evaluation"><h3>Written answer evaluation</h3><p class="mock-save">Evaluate each answer separately. Each AI evaluation uses your daily AI allowance. Feedback is formative, not an official UPSC mark.</p>'+rows+'</section>';
}
function renderResult(r,paper){
 $("mockExamView").classList.add("mock-hidden");$("mockCatalogView").classList.remove("mock-hidden");$("mockResultView").classList.remove("mock-hidden");
 const a=r.analytics||{},sections=a.section_breakdown||{};
 const writtenCount=Number(a.written_questions??questions.filter(q=>q.question_type==="written").length);
 const pct=Number(r.max_score)>0?(Number(r.score)/Number(r.max_score)*100):0;
 $("mockResultView").innerHTML='<div class="card gold-top"><div class="mock-meta">EXAM REPORT · '+esc(paper?.title||"UPSC mock")+'</div><h2>Examination submitted</h2><div class="mock-result-kpis"><div><b class="kpi-val">'+Number(r.score||0).toFixed(2)+'</b><div class="kpi-lbl">Objective score</div></div><div><b class="kpi-val">'+pct.toFixed(1)+'%</b><div class="kpi-lbl">Score percentage</div></div><div><b class="kpi-val">'+(a.correct||0)+'</b><div class="kpi-lbl">Correct</div></div><div><b class="kpi-val">'+(a.wrong||0)+'</b><div class="kpi-lbl">Incorrect</div></div><div><b class="kpi-val">'+(a.skipped||0)+'</b><div class="kpi-lbl">Unanswered</div></div></div><p class="mock-warning">Written answers: '+writtenCount+'. These require a separate rubric-based review; they are not automatically assigned marks.</p><h3>Section-wise performance</h3>'+Object.entries(sections).map(([k,v])=>'<div style="margin:.7rem 0"><b>'+esc(k)+'</b><div class="mock-meta">'+v.correct+' correct · '+v.wrong+' incorrect · '+v.skipped+' unanswered · '+Number(v.score||0).toFixed(2)+' marks</div></div>').join("")+'<div class="mock-actions"><button class="btn primary" id="mockBackCatalog">Back to examinations</button></div></div>';
 $("mockResultView").querySelector(".card").insertAdjacentHTML("beforeend",renderMockWrittenEvaluations(paper));
 $("mockResultView").querySelectorAll("[data-evaluate]").forEach(button=>{const q=questions.find(item=>item.id===button.dataset.evaluate);if(q)button.addEventListener("click",()=>evaluateMockWrittenAnswer(q,paper,button));});
 $("mockBackCatalog").addEventListener("click",()=>{$("mockResultView").classList.add("mock-hidden");});
 loadRecent();loadAnalytics();
}
function bindControls(){
 $("mockAnalyticsRefresh")?.addEventListener("click",loadAnalytics);
 $("mockPrevBtn").addEventListener("click",()=>{if(index>0){index--;saveDraft();renderQuestion();renderQuestionGrid();}});
 $("mockNextBtn").addEventListener("click",()=>{if(index<questions.length-1){index++;saveDraft();renderQuestion();renderQuestionGrid();}else alert(reviewSummary());});
 $("mockMarkBtn").addEventListener("click",()=>{const id=questions[index].id;marked.has(id)?marked.delete(id):marked.add(id);saveDraft();renderQuestion();renderQuestionGrid();});
 $("mockSubmitBtn").addEventListener("click",()=>submitExam(false));
 $("mockExitBtn").addEventListener("click",()=>{if(confirm("Exit this examination? Your saved attempt will remain available to resume.")){clearInterval(timer);saveDraft();attempt=null;$("mockExamView").classList.add("mock-hidden");$("mockCatalogView").classList.remove("mock-hidden");}});
 $("mockRefreshBtn").addEventListener("click",async()=>{await loadPapers();renderCatalog();await loadAnalytics();});
 $("mockImportBtn").addEventListener("click",importPaper);
}
function validateImport(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Paper JSON must be an object.");
 if(typeof raw.code!=="string"||!/^[A-Z0-9][A-Z0-9-]{2,79}$/.test(raw.code.trim()))throw new Error("Use a paper code containing 3–80 uppercase letters, numbers or hyphens.");
 if(typeof raw.title!=="string"||raw.title.trim().length<5||raw.title.trim().length>160)throw new Error("Paper title must contain 5–160 characters.");
 if(!["prelims","mains"].includes(raw.exam_stage))throw new Error("exam_stage must be prelims or mains.");
 if(typeof raw.paper_type!=="string"||!raw.paper_type.trim())throw new Error("paper_type is required.");
 if(!Number.isInteger(Number(raw.duration_minutes))||Number(raw.duration_minutes)<15||Number(raw.duration_minutes)>360)throw new Error("Duration must be between 15 and 360 minutes.");
 if(!Number.isFinite(Number(raw.total_marks))||Number(raw.total_marks)<=0||Number(raw.total_marks)>1000)throw new Error("total_marks must be greater than 0 and at most 1000.");
 if(!Array.isArray(raw.questions)||!raw.questions.length||raw.questions.length>200)throw new Error("Provide 1–200 questions.");
 const expected=expectedFor(raw.code.trim());
 if(expected&&raw.questions.length!==expected)throw new Error("This full-length paper requires exactly "+expected+" questions before import.");
 const numbers=new Set();
 raw.questions.forEach((q,i)=>{
  if(!q||typeof q!=="object"||typeof q.prompt!=="string"||q.prompt.trim().length<15||q.prompt.length>6000)throw new Error("Question "+(i+1)+": prompt must contain 15–6000 characters.");
  const no=Number(q.question_no??i+1);
  if(!Number.isInteger(no)||no<1||numbers.has(no))throw new Error("Question numbers must be unique positive integers (problem at item "+(i+1)+").");
  numbers.add(no);
  if(!["mcq","written"].includes(q.question_type))throw new Error("Question "+(i+1)+": question_type must be mcq or written.");
  if(!Number.isFinite(Number(q.marks))||Number(q.marks)<=0||Number(q.marks)>100)throw new Error("Question "+(i+1)+": marks must be greater than 0 and at most 100.");
  if(!Number.isFinite(Number(q.negative_marks??0))||Number(q.negative_marks??0)<0||Number(q.negative_marks??0)>Number(q.marks))throw new Error("Question "+(i+1)+": invalid negative_marks.");
  if(typeof q.source!=="string"||q.source.trim().length<5||q.source.trim().length>500)throw new Error("Question "+(i+1)+": add a source/provenance note (official source or Original practice question).");
  if(q.question_type==="mcq"){
   if(!Array.isArray(q.options)||q.options.length!==4)throw new Error("Question "+(i+1)+": MCQs need exactly four options.");
   const keys=q.options.map(o=>String(o?.key||"").toUpperCase()).sort();
   if(keys.join(",")!=="A,B,C,D"||q.options.some(o=>typeof o.text!=="string"||!o.text.trim()))throw new Error("Question "+(i+1)+": provide non-empty A, B, C and D options.");
   if(!["A","B","C","D"].includes(String(q.correct_answer||"").toUpperCase()))throw new Error("Question "+(i+1)+": add a valid correct_answer.");
   if(typeof q.explanation!=="string"||q.explanation.trim().length<20)throw new Error("Question "+(i+1)+": add an explanation of at least 20 characters.");
  }else{
   if(!Number.isInteger(Number(q.word_limit))||Number(q.word_limit)<50||Number(q.word_limit)>1000)throw new Error("Question "+(i+1)+": written questions need a 50–1000 word_limit.");
   if(!Array.isArray(q.rubric)||q.rubric.length<2||q.rubric.some(v=>typeof v!=="string"||!v.trim()))throw new Error("Question "+(i+1)+": written questions need at least two rubric points.");
  }
 });
}

async function importPaper(){
 if(!admin()){status("Only the owner/admin can publish papers.");return;}
 try{
  const raw=JSON.parse($("mockImportJson").value);
  validateImport(raw);
  const {data:p,error:pe}=await sb.from("mock_exam_papers").upsert({code:raw.code.trim(),title:raw.title.trim(),exam_stage:raw.exam_stage,paper_type:raw.paper_type.trim(),optional_subject:raw.optional_subject||null,duration_minutes:Number(raw.duration_minutes),total_marks:Number(raw.total_marks),is_published:false,sections:raw.sections||[],created_by:user.id},{onConflict:"code"}).select().single();
  if(pe)throw pe;
  const old=await sb.from("mock_exam_questions").select("id").eq("paper_id",p.id);
  if(old.data?.length){const ids=old.data.map(x=>x.id);await sb.from("mock_exam_answer_keys").delete().in("question_id",ids);await sb.from("mock_exam_questions").delete().eq("paper_id",p.id);}
  const rows=raw.questions.map((q,i)=>({paper_id:p.id,section_key:q.section_key||"main",question_no:Number(q.question_no||i+1),question_type:q.question_type||"mcq",prompt:q.prompt,options:q.options||[],marks:Number(q.marks??2),negative_marks:Number(q.negative_marks??0),word_limit:q.word_limit||null,rubric:q.rubric||[],sort_order:i,is_active:true}));
  if(rows.some(q=>!q.prompt))throw new Error("Every question needs a prompt.");
  const {data:inserted,error:qe}=await sb.from("mock_exam_questions").insert(rows).select("id,question_no");
  if(qe)throw qe;
  const keys=inserted.map((q,i)=>({question_id:q.id,correct_answer:raw.questions[i].correct_answer?String(raw.questions[i].correct_answer).toUpperCase():null,explanation:(raw.questions[i].explanation||"")+(raw.questions[i].source?"\nSource: "+raw.questions[i].source.trim():""),model_answer:raw.questions[i].model_answer||""})).filter((k,i)=>raw.questions[i].question_type==="mcq"||raw.questions[i].model_answer||raw.questions[i].explanation);
  if(keys.length){const {error:ke}=await sb.from("mock_exam_answer_keys").insert(keys);if(ke)throw ke;}
  status("Imported "+inserted.length+" questions. Review the paper, then publish it below.");
  $("mockPublishCode").value=p.code;await loadPapers();renderCatalog();
 }catch(e){status("Import failed: "+e.message);}
}
async function publishPaper(){
 if(!admin())return;
 const code=$("mockPublishCode").value.trim();if(!code)return;
 const paper=papers.find(p=>p.code===code);if(!paper){status("Import the paper first.");return;}
 const {data:items,error}=await sb.from("mock_exam_questions").select("id,question_no,question_type,prompt,options,marks,word_limit,rubric").eq("paper_id",paper.id).eq("is_active",true);
 if(error){status(error.message);return;}
 if(!items?.length){status("Cannot publish an empty paper.");return;}
 const expected=expectedFor(code);if(expected&&items.length!==expected){status("This is a full-length paper: "+expected+" questions are required, but "+items.length+" are imported.");return;}
 const invalidWritten=items.filter(q=>q.question_type==="written"&&(!Number.isInteger(Number(q.word_limit))||!Array.isArray(q.rubric)||q.rubric.length<2));
 const invalidTypes=items.filter(q=>!["mcq","written"].includes(q.question_type));
 if(invalidWritten.length||invalidTypes.length){status("Cannot publish: check written word limits, written rubrics and question types.");return;}
 const mcqIds=items.filter(q=>q.question_type==="mcq").map(q=>q.id);
 if(mcqIds.length){
  const {data:keys,error:keyError}=await sb.from("mock_exam_answer_keys").select("question_id,correct_answer,explanation").in("question_id",mcqIds);
  if(keyError){status(keyError.message);return;}
  const ready=new Map((keys||[]).filter(k=>typeof k.correct_answer==="string"&&k.correct_answer.trim()&&typeof k.explanation==="string"&&k.explanation.trim().length>=20).map(k=>[k.question_id,k]));
  if(mcqIds.some(id=>!ready.has(id))){status("Cannot publish: every MCQ needs an answer key and an explanation.");return;}
  if([...ready.values()].some(k=>!k.explanation.includes("Source:"))){status("Cannot publish: add a Source: provenance note to every MCQ explanation.");return;}
 }
 const {error:e}=await sb.from("mock_exam_papers").update({is_published:true,updated_at:new Date().toISOString()}).eq("id",paper.id);
 if(e){status("Publish failed: "+e.message);return;}
 await loadPapers();renderCatalog();status("Paper published for eligible learners.");
}
$("mockPublishBtn")?.addEventListener("click",publishPaper);
bindControls();
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&attempt)saveDraft();});
window.addEventListener("pagehide",()=>{if(attempt){storeLocalDraft();saveDraft();}});
window.addEventListener("tad:optionalPrepChanged",async()=>{try{const {data}=await sb.from("user_data").select("payload").eq("user_id",user.id).maybeSingle();optionalSubject=readOptional(data?.payload||{});renderCatalog();initTopicPractice();initMainsTopicStudio();}catch(e){}});
boot().catch(e=>status("Mock system error: "+e.message));
})();