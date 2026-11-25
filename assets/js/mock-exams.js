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
let user=null,profile=null,optionalSubject="",papers=[],attempt=null,questions=[],answers={},marked=new Set(),index=0,timer=null,saveTimer=null,expiresAt=0,startedAt=0,submitting=false,saveQueue=Promise.resolve();
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
 if(p.error||!p.data){root.innerHTML='<div class="card"><h2>Account role could not be verified</h2><p>Reload after signing in. Mock examination access is paused until your account permissions can be checked.</p></div>';return;}profile=p.data;optionalSubject=readOptional(u.data?.payload||{});
 await loadPapers();await loadRecent();renderCatalog();
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
  if(timeLeft()<=0){await submitExam(true);return;}renderExam(paper);beginTimer();
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
 $("mockQuestionPosition").textContent=(index+1)+" / "+questions.length;
 $("mockProgressFill").style.width=((Object.keys(answers).filter(k=>String(answers[k]||"").trim()).length/questions.length)*100)+"%";
 $("mockMarkBtn").textContent=marked.has(q.id)?"Remove review mark":"Mark for review";
 $("mockPrevBtn").disabled=index===0;$("mockNextBtn").textContent=index===questions.length-1?"Review answers":"Next";
}
function setAnswer(id,value){answers[id]=value;storeLocalDraft();status("Saving…");clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveDraft(),350);renderQuestionGrid();}
function renderQuestionGrid(){
 const grid=$("mockQuestionGrid");grid.innerHTML=questions.map((q,i)=>'<button class="mock-qnum '+(String(answers[q.id]||"").trim()?'answered ':'')+(marked.has(q.id)?'review ':'')+(i===index?'current':'')+'" data-q="'+i+'" aria-label="Question '+(i+1)+'">'+(i+1)+'</button>').join("");
 grid.querySelectorAll("[data-q]").forEach(b=>b.addEventListener("click",()=>{index=Number(b.dataset.q);renderQuestion();renderQuestionGrid();}));
 const answered=questions.filter(q=>String(answers[q.id]||"").trim()).length;
 $("mockAnsweredCount").textContent=answered+" answered · "+(questions.length-answered)+" unanswered";
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
function renderResult(r,paper){
 $("mockExamView").classList.add("mock-hidden");$("mockCatalogView").classList.remove("mock-hidden");$("mockResultView").classList.remove("mock-hidden");
 const a=r.analytics||{},sections=a.section_breakdown||{};
 const pct=Number(r.max_score)>0?(Number(r.score)/Number(r.max_score)*100):0;
 $("mockResultView").innerHTML='<div class="card gold-top"><div class="mock-meta">EXAM REPORT · '+esc(paper?.title||"UPSC mock")+'</div><h2>Examination submitted</h2><div class="mock-result-kpis"><div><b class="kpi-val">'+Number(r.score||0).toFixed(2)+'</b><div class="kpi-lbl">Objective score</div></div><div><b class="kpi-val">'+pct.toFixed(1)+'%</b><div class="kpi-lbl">Score percentage</div></div><div><b class="kpi-val">'+(a.correct||0)+'</b><div class="kpi-lbl">Correct</div></div><div><b class="kpi-val">'+(a.wrong||0)+'</b><div class="kpi-lbl">Incorrect</div></div><div><b class="kpi-val">'+(a.skipped||0)+'</b><div class="kpi-lbl">Unanswered</div></div></div><p class="mock-warning">Written answers: '+(a.written_questions||0)+'. These require a separate rubric-based review; they are not automatically assigned marks.</p><h3>Section-wise performance</h3>'+Object.entries(sections).map(([k,v])=>'<div style="margin:.7rem 0"><b>'+esc(k)+'</b><div class="mock-meta">'+v.correct+' correct · '+v.wrong+' incorrect · '+v.skipped+' unanswered · '+Number(v.score||0).toFixed(2)+' marks</div></div>').join("")+'<div class="mock-actions"><button class="btn primary" id="mockBackCatalog">Back to examinations</button></div></div>';
 $("mockBackCatalog").addEventListener("click",()=>{$("mockResultView").classList.add("mock-hidden");});
 loadRecent();
}
function bindControls(){
 $("mockPrevBtn").addEventListener("click",()=>{if(index>0){index--;saveDraft();renderQuestion();renderQuestionGrid();}});
 $("mockNextBtn").addEventListener("click",()=>{if(index<questions.length-1){index++;saveDraft();renderQuestion();renderQuestionGrid();}else alert(reviewSummary());});
 $("mockMarkBtn").addEventListener("click",()=>{const id=questions[index].id;marked.has(id)?marked.delete(id):marked.add(id);saveDraft();renderQuestion();renderQuestionGrid();});
 $("mockSubmitBtn").addEventListener("click",()=>submitExam(false));
 $("mockExitBtn").addEventListener("click",()=>{if(confirm("Exit this examination? Your saved attempt will remain available to resume.")){clearInterval(timer);saveDraft();attempt=null;$("mockExamView").classList.add("mock-hidden");$("mockCatalogView").classList.remove("mock-hidden");}});
 $("mockRefreshBtn").addEventListener("click",async()=>{await loadPapers();renderCatalog();});
 $("mockImportBtn").addEventListener("click",importPaper);
}
async function importPaper(){
 if(!admin()){status("Only the owner/admin can publish papers.");return;}
 try{
  const raw=JSON.parse($("mockImportJson").value);
  if(!raw.code||!raw.title||!Array.isArray(raw.questions)||!raw.questions.length)throw new Error("JSON needs code, title and a non-empty questions array.");
  const {data:p,error:pe}=await sb.from("mock_exam_papers").upsert({code:raw.code,title:raw.title,exam_stage:raw.exam_stage||"mains",paper_type:raw.paper_type||raw.code,optional_subject:raw.optional_subject||null,duration_minutes:Number(raw.duration_minutes||180),total_marks:Number(raw.total_marks||250),is_published:false,sections:raw.sections||[],created_by:user.id},{onConflict:"code"}).select().single();
  if(pe)throw pe;
  const old=await sb.from("mock_exam_questions").select("id").eq("paper_id",p.id);
  if(old.data?.length){const ids=old.data.map(x=>x.id);await sb.from("mock_exam_answer_keys").delete().in("question_id",ids);await sb.from("mock_exam_questions").delete().eq("paper_id",p.id);}
  const rows=raw.questions.map((q,i)=>({paper_id:p.id,section_key:q.section_key||"main",question_no:Number(q.question_no||i+1),question_type:q.question_type||"mcq",prompt:q.prompt,options:q.options||[],marks:Number(q.marks??2),negative_marks:Number(q.negative_marks??0),word_limit:q.word_limit||null,rubric:q.rubric||[],sort_order:i,is_active:true}));
  if(rows.some(q=>!q.prompt))throw new Error("Every question needs a prompt.");
  const {data:inserted,error:qe}=await sb.from("mock_exam_questions").insert(rows).select("id,question_no");
  if(qe)throw qe;
  const keys=inserted.map((q,i)=>({question_id:q.id,correct_answer:raw.questions[i].correct_answer??null,explanation:raw.questions[i].explanation||"",model_answer:raw.questions[i].model_answer||""})).filter((k,i)=>raw.questions[i].correct_answer!==undefined||raw.questions[i].explanation||raw.questions[i].model_answer);
  if(keys.length){const {error:ke}=await sb.from("mock_exam_answer_keys").insert(keys);if(ke)throw ke;}
  status("Imported "+inserted.length+" questions. Review the paper, then publish it below.");
  $("mockPublishCode").value=p.code;await loadPapers();renderCatalog();
 }catch(e){status("Import failed: "+e.message);}
}
async function publishPaper(){
 if(!admin())return;
 const code=$("mockPublishCode").value.trim();if(!code)return;
 const paper=papers.find(p=>p.code===code);if(!paper){status("Import the paper first.");return;}
 const {data:items,error}=await sb.from("mock_exam_questions").select("id,question_type").eq("paper_id",paper.id).eq("is_active",true);
 if(error){status(error.message);return;}
 if(!items?.length){status("Cannot publish an empty paper.");return;}
 const expected=expectedFor(code);if(expected&&items.length!==expected){status("This is a full-length paper: "+expected+" questions are required, but "+items.length+" are imported.");return;}
 const mcqIds=items.filter(q=>q.question_type==="mcq").map(q=>q.id);
 if(mcqIds.length){const {data:keys,error:keyError}=await sb.from("mock_exam_answer_keys").select("question_id,correct_answer").in("question_id",mcqIds);if(keyError){status(keyError.message);return;}const ready=new Set((keys||[]).filter(k=>typeof k.correct_answer==="string"&&k.correct_answer.trim()).map(k=>k.question_id));if(mcqIds.some(id=>!ready.has(id))){status("Cannot publish: every MCQ must have a verified answer key.");return;}}
 const {error:e}=await sb.from("mock_exam_papers").update({is_published:true,updated_at:new Date().toISOString()}).eq("id",paper.id);
 if(e){status("Publish failed: "+e.message);return;}
 await loadPapers();renderCatalog();status("Paper published for eligible learners.");
}
$("mockPublishBtn")?.addEventListener("click",publishPaper);
bindControls();
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&attempt)saveDraft();});
window.addEventListener("pagehide",()=>{if(attempt){storeLocalDraft();saveDraft();}});
window.addEventListener("tad:optionalPrepChanged",async()=>{try{const {data}=await sb.from("user_data").select("payload").eq("user_id",user.id).maybeSingle();optionalSubject=readOptional(data?.payload||{});renderCatalog();}catch(e){}});
boot().catch(e=>status("Mock system error: "+e.message));
})();