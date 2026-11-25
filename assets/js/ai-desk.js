(function(){
"use strict";
const url=window.DESK_SUPABASE_URL||"",key=window.DESK_SUPABASE_ANON_KEY||"";
if(!window.supabase||!url||!key)return;
const db=window.supabase.createClient(url,key),empty=()=>({active_study_plan:null,doubt_log:[],pending_tasks:[]});
let role="guest",history=[],state=empty(),busy=false,opened=false;
const panel=document.createElement("section");panel.id="tadAiPanel";panel.className="view-sec";panel.setAttribute("aria-label","Anbuu AI study mentor");
panel.innerHTML="<div class=\"tad-anbuu-page-hero\"><div class=\"tad-anbuu-hero-copy\"><span class=\"tad-anbuu-eyebrow\">YOUR PERSONAL AI LEARNING COMPANION</span><h1>Meet Anbuu.</h1><p>Your study mentor for planning, understanding concepts, practising questions, tracking progress and building consistent revision habits.</p><div class=\"tad-anbuu-hero-pills\"><span>✦ Personal study guidance</span><span>▤ Progress-aware support</span><span>↻ Smart revision</span></div></div><div class=\"tad-anbuu-orb\" aria-hidden=\"true\"><span>✦</span><b>ANBUU</b><small>LEARN · PRACTISE · IMPROVE</small></div><nav class=\"tad-anbuu-shortcuts\" aria-label=\"Main study sections\"><button type=\"button\" data-nav=\"home\">Dashboard</button><button type=\"button\" data-nav=\"today\">Today's Desk</button><button type=\"button\" data-nav=\"notes\">Notes</button><button type=\"button\" data-nav=\"pyq\">PYQ Bank</button><button type=\"button\" data-nav=\"planner\">Planner</button><button type=\"button\" data-nav=\"tracker\">Progress</button></nav></div><div class=\"tad-anbuu-feature-strip\"><div><b>01</b><strong>Ask &amp; understand</strong><span>Clear explanations and guided learning</span></div><div><b>02</b><strong>Plan &amp; act</strong><span>Small tasks linked to your study goals</span></div><div><b>03</b><strong>Review &amp; grow</strong><span>Progress insights and revision priorities</span></div></div><section class=\"tad-ai-studio\" aria-labelledby=\"tadAiStudioTitle\"><div class=\"tad-ai-studio-head\"><div><span class=\"tad-ai-studio-kicker\">AI STUDY STUDIO</span><h2 id=\"tadAiStudioTitle\">Choose what you want to work on.</h2><p>Focused AI workflows for learning, answer writing and exam practice. Responses stay in your Anbuu conversation.</p></div><span class=\"tad-ai-studio-mark\" aria-hidden=\"true\">✦</span></div><div class=\"tad-ai-studio-grid\"><button type=\"button\" class=\"tad-ai-tool\" data-ai-workflow=\"tutor\"><span class=\"tad-ai-tool-icon\">01</span><strong>Concept tutor</strong><small>Learn a difficult topic from the basics, with examples and checks for understanding.</small><span class=\"tad-ai-tool-cta\">Start learning ↗</span></button><button type=\"button\" class=\"tad-ai-tool\" data-ai-workflow=\"answer\"><span class=\"tad-ai-tool-icon\">02</span><strong>Mains answer lab</strong><small>Review structure, relevance, analysis, examples and a practical improvement plan.</small><span class=\"tad-ai-tool-cta\">Review an answer ↗</span></button><button type=\"button\" class=\"tad-ai-tool\" data-ai-workflow=\"anthro\"><span class=\"tad-ai-tool-icon\">03</span><strong>Anthropology mentor</strong><small>Build optional-subject foundations, thinkers, theories and answer frameworks.</small><span class=\"tad-ai-tool-cta\">Study Anthropology ↗</span></button><button type=\"button\" class=\"tad-ai-tool\" data-ai-workflow=\"quiz\"><span class=\"tad-ai-tool-icon\">04</span><strong>Active-recall quiz</strong><small>Practise one question at a time, then receive explanations and topic gaps.</small><span class=\"tad-ai-tool-cta\">Begin practice ↗</span></button><button type=\"button\" class=\"tad-ai-tool\" data-ai-workflow=\"current\"><span class=\"tad-ai-tool-icon\">05</span><strong>Current affairs analyst</strong><small>Connect an issue to syllabus, stakeholders, challenges and balanced way forward.</small><span class=\"tad-ai-tool-cta\">Analyse an issue ↗</span></button><button type=\"button\" class=\"tad-ai-tool\" data-ai-workflow=\"revision\"><span class=\"tad-ai-tool-icon\">06</span><strong>Revision strategist</strong><small>Turn weak areas and pending tasks into a realistic revision sequence.</small><span class=\"tad-ai-tool-cta\">Build revision ↗</span></button></div></section><header id=\"tadAiHead\"><div><strong>✦ Anbuu · Personal Mentor</strong><small id=\"tadAiRole\">Checking account…</small></div><span class=\"tad-anbuu-online\"><i></i> Your learning space</span></header><div id=\"tadAiWorkspace\"><section class=\"tad-ai-chat\"><div id=\"tadAiMessages\" aria-live=\"polite\"></div><div id=\"tadAiStatus\">Sign in to start.</div><div class=\"tad-ai-quick\"><button type=\"button\" data-prompt=\"plan\">▤ Build my study plan</button><button type=\"button\" data-prompt=\"doubts\">◎ Review my doubts</button><button type=\"button\" data-prompt=\"tasks\">✦ Today’s tasks</button></div><form id=\"tadAiForm\"><textarea id=\"tadAiInput\" rows=\"2\" maxlength=\"6000\" placeholder=\"Ask Anbuu anything about your learning…\"></textarea><button id=\"tadAiSend\" type=\"submit\">Send ↗</button></form></section><aside id=\"tadAiSidebar\"><div class=\"tad-ai-side-heading\"><strong>My Learning Space</strong><span>YOUR PERSONAL DASHBOARD</span></div><nav class=\"tad-ai-tabs\" role=\"tablist\" aria-label=\"Anbuu dashboard tabs\"><button type=\"button\" class=\"tad-ai-tab is-active\" id=\"tadAiOverviewTab\" role=\"tab\" aria-selected=\"true\" aria-controls=\"tadAiOverview\">Overview</button><button type=\"button\" class=\"tad-ai-tab\" id=\"tadAiRevisionTab\" role=\"tab\" aria-selected=\"false\" aria-controls=\"tadAiRevision\">✦ Revision Planner</button></nav><div id=\"tadAiOverview\" class=\"tad-ai-tabpanel\" role=\"tabpanel\" aria-labelledby=\"tadAiOverviewTab\"><section><h3>Active study plan</h3><div id=\"tadAiPlan\">No active plan yet.</div></section><section><h3>Pending tasks</h3><div id=\"tadAiTasks\">No tasks yet.</div></section><section><h3>Recurring doubts</h3><div id=\"tadAiDoubts\">No recurring doubts yet.</div></section><section class=\"tad-ai-study-snapshot\"><div class=\"tad-ai-snapshot-heading\"><div><span>PERSONAL STUDY SIGNALS</span><h3>Your study snapshot</h3></div><small>Based on saved activity only</small></div><div id=\"tadAiSnapshot\" aria-live=\"polite\">Loading your study signals…</div><button type=\"button\" id=\"tadAiPlanSession\">Plan my next study session →</button></section><section><h3>My progress · 7 days</h3><div id=\"tadAiWeekly\">Loading progress…</div></section><section><h3>Learning history</h3><div id=\"tadAiHistory\">Your recent mock tests will appear here.</div></section><section><h3>Mock examination analysis</h3><div id=\"tadAiMockInsights\">Your submitted mock results and section insights will appear here.</div></section><section><h3>Guided lessons</h3><div id=\"tadAiLessons\">Your saved lesson progress will appear here.</div></section><section class=\"tad-ai-next-steps\"><h3>Anbuu's suggested next steps</h3><div id=\"tadAiNextSteps\">Your next steps will appear here after progress loads.</div></section><section><h3>Topics to revisit</h3><div id=\"tadAiWeak\">Not enough recorded mistakes yet.</div></section></div><div id=\"tadAiRevision\" class=\"tad-ai-tabpanel\" role=\"tabpanel\" aria-labelledby=\"tadAiRevisionTab\" hidden><div class=\"tad-revision-hero\"><span class=\"tad-revision-kicker\">SMART REVISION</span><h2>Your next review, made simple.</h2><p>A practical revision queue built from the topics you have actually missed in saved practice.</p><div class=\"tad-revision-meta\"><span>↻ Spaced review</span><span>◷ 20 min / topic</span></div></div><div class=\"tad-revision-summary\" id=\"tadAiRevisionSummary\">Waiting for your saved practice data…</div><div class=\"tad-revision-list\" id=\"tadAiRevisionList\"></div><section class=\"tad-revision-lessons\" aria-labelledby=\"tadAiLessonRevisionTitle\"><h3 id=\"tadAiLessonRevisionTitle\">My revision task queue</h3><p>Track due dates, completed reviews and postponed tasks. Changes sync to your learner account.</p><div id=\"tadAiLessonRevisionTasks\">Complete a guided lesson to add its review task here.</div></section><button type=\"button\" id=\"tadAiBuildRevision\" class=\"tad-revision-build\">Create my revision tasks <span>→</span></button><p class=\"tad-revision-footnote\">Your revision tasks are saved to Anbuu when created. Review intervals are suggestions, not a prediction of exam performance.</p></div></aside></div>"
document.querySelector("#mainContent").append(panel);
const answerLab=document.createElement("section");
answerLab.className="tad-answer-lab";
answerLab.setAttribute("aria-labelledby","tadAnswerLabTitle");
answerLab.innerHTML="<div class='tad-answer-lab-head'><span>MAINS ANSWER PRACTICE</span><h2 id='tadAnswerLabTitle'>Write, review and improve.</h2><p>Submit one practice answer. Anbuu will review it against a consistent UPSC-style rubric and save the feedback in your private learner history.</p></div><form id='tadAnswerLabForm' class='tad-answer-lab-form'><label>Paper / subject<input id='tadAnswerSubject' maxlength='120' required value='General Studies'></label><label>Question<textarea id='tadAnswerQuestion' rows='3' maxlength='2500' required placeholder='Paste the question and its directive words…'></textarea></label><label>Your answer<textarea id='tadAnswerText' rows='8' maxlength='8000' required placeholder='Write your answer here…'></textarea></label><div class='tad-answer-lab-row'><label>Word limit<input id='tadAnswerWordLimit' type='number' min='1' max='1000' value='150' required></label><button id='tadAnswerSubmit' type='submit'>Evaluate my answer →</button></div><p id='tadAnswerStatus' aria-live='polite'>Practice feedback is an AI learning aid, not an official UPSC assessment.</p></form><section class='tad-answer-history'><h3>My saved answer evaluations</h3><div id='tadAnswerHistory' aria-live='polite'>Sign in as a learner to view your saved evaluations.</div></section>";
panel.insertBefore(answerLab,panel.querySelector("#tadAiHead"));
const lessonStudio=document.createElement("section");
lessonStudio.className="tad-anbuu-lesson-studio";
lessonStudio.setAttribute("aria-labelledby","tadLessonTitle");
lessonStudio.innerHTML="<div class='tad-lesson-heading'><span>GUIDED LEARNING</span><h2 id='tadLessonTitle'>Build a lesson with Anbuu</h2><p>Choose General Studies or any UPSC optional subject. Anbuu will teach the topic in stages, check understanding and suggest practice.</p></div><div class='tad-lesson-controls'><label>Learning track<select id='tadLessonTrack'><option value='gs'>General Studies &amp; GS foundations</option><option value='optional'>UPSC optional subject</option><option value='literature'>Literature optional</option></select></label><label>Subject<select id='tadLessonSubject'><option value='Polity'>Polity</option></select></label><label>Topic (optional)<input id='tadLessonTopic' maxlength='160' placeholder='e.g. Fundamental Rights'></label><label>Teaching language<select id='tadLessonLanguage'><option value='English'>English</option><option value='Tamil'>Tamil</option><option value='Tamil and English' selected>Tamil + English</option></select></label><label>Level<select id='tadLessonLevel'><option value='beginner'>Beginner</option><option value='intermediate'>Intermediate</option><option value='advanced'>Advanced</option></select></label><button id='tadStartLesson' type='button'>Start guided lesson <span>→</span></button></div><p class='tad-lesson-note' id='tadLessonNote' aria-live='polite'>Optional subjects and literature choices load from the site's UPSC coverage catalogue.</p><section class='tad-lesson-history' aria-labelledby='tadLessonHistoryTitle'><div class='tad-lesson-history-head'><div><h3 id='tadLessonHistoryTitle'>My lesson history</h3><p>Saved to your learner account across devices. Lesson details and status are stored, not chat transcripts.</p></div><button type='button' id='tadRefreshLessons'>Refresh</button></div><div id='tadLessonHistoryList' aria-live='polite'>Sign in as a learner to view your lessons.</div></section>";
panel.insertBefore(lessonStudio,panel.querySelector("#tadAiHead"));
const lessonTrack=lessonStudio.querySelector("#tadLessonTrack"),lessonSubject=lessonStudio.querySelector("#tadLessonSubject");
const gsSubjects=["Polity","History","Geography","Indian Economy","Environment & Ecology","Science & Technology","Ethics","International Relations","Indian Society","Internal Security","Disaster Management","CSAT"];
let optionalCatalogue={optional:[],literature:[]};
function fillLessonSubjects(){
 const track=lessonTrack.value,items=track==="gs"?gsSubjects:optionalCatalogue[track]||[];
 lessonSubject.replaceChildren();
 items.forEach(item=>{const option=document.createElement("option");option.value=typeof item==="string"?item:item.name;option.textContent=typeof item==="string"?item:item.name;lessonSubject.append(option);});
 if(!items.length){const option=document.createElement("option");option.value="";option.textContent="Catalogue unavailable — reload to retry";lessonSubject.append(option);}
}
lessonTrack.addEventListener("change",fillLessonSubjects);
fetch("data/pyq/coverage.json").then(r=>{if(!r.ok)throw new Error("catalogue unavailable");return r.json();}).then(data=>{
 const list=Array.isArray(data.optional_subjects)?data.optional_subjects:[];
 optionalCatalogue.optional=list.filter(x=>x.category==="optional");
 optionalCatalogue.literature=list.filter(x=>x.category==="literature");
 fillLessonSubjects();
}).catch(()=>{lessonStudio.querySelector("#tadLessonNote").textContent="The optional catalogue could not load. General Studies remains available; refresh to retry the full subject list.";});
lessonStudio.querySelector("#tadStartLesson").addEventListener("click",async()=>{
 const track=lessonTrack.value,subject=lessonSubject.value,topic=lessonStudio.querySelector("#tadLessonTopic").value.trim(),level=lessonStudio.querySelector("#tadLessonLevel").value;
 const note=lessonStudio.querySelector("#tadLessonNote");
 if(role!=="learner"){note.textContent="Sign in with a learner account to save and track guided lessons.";return;}
 if(!subject){note.textContent="Please choose a subject.";return;}
 const label=track==="gs"?"General Studies":track==="literature"?"Literature optional":"UPSC optional";
 const language=lessonStudio.querySelector("#tadLessonLanguage").value;
 const saved=await db.functions.invoke("ai-assistant",{body:{action:"start_lesson",track,subject,topic,level}});
 if(saved.error||!saved.data?.lesson){note.textContent=saved.data?.error||"Could not save this lesson. Please try again.";return;}
 note.textContent="Lesson saved to your account. You can pause it or mark it complete in My lesson history.";
 await loadLessons();
 const prompt="Start an interactive, step-by-step UPSC "+label+" lesson. Teaching language: "+language+". Use this language consistently for explanations, examples, questions and feedback. Subject: "+subject+". Topic: "+(topic||"Choose one appropriate foundational topic and state the official syllabus reference only if you can verify it; otherwise clearly say the reference is unverified.")+". Learner level: "+level+". Act as a patient teacher. First give a short lesson roadmap, 2–3 learning objectives and any prerequisites. Then teach ONLY the first small concept in simple language with one example. Ask exactly one short understanding-check question and STOP; wait for the learner's reply before teaching the next stage. After each reply, briefly correct or confirm understanding and teach only the next stage. When the topic is complete, give 3 practice questions with explanations and 1–3 manageable revision tasks. Distinguish verified syllabus facts from examples, never invent official PYQs or citations, and never claim to save lesson completion unless a real save operation confirms it. Use Tamil and English if requested.";
 sendMessage(prompt);
});

const $=s=>panel.querySelector(s),messages=$("#tadAiMessages"),status=$("#tadAiStatus"),input=$("#tadAiInput"),send=$("#tadAiSend");
function say(text,who){const el=document.createElement("div");el.className="tad-ai-msg "+(who==="user"?"tad-ai-user":"tad-ai-assistant");el.textContent=text;messages.append(el);messages.scrollTop=messages.scrollHeight;}
function renderRevisionTasks(tasks){
 const host=$("#tadAiLessonRevisionTasks");if(!host)return;host.replaceChildren();
 const rows=(Array.isArray(tasks)?tasks:[]).filter(item=>item&&typeof item.id==="string");
 if(!rows.length){host.textContent="No saved revision tasks yet. Complete a guided lesson or ask Anbuu to create a revision plan.";return;}
 const today=new Date();today.setHours(0,0,0,0);
 rows.slice().sort((a,b)=>{
  if(a.status!==b.status)return a.status==="pending"?-1:1;
  return String(a.due_date||"9999-12-31").localeCompare(String(b.due_date||"9999-12-31"));
 }).forEach(item=>{
  const card=document.createElement("article");card.className="tad-revision-lesson-task"+(item.status==="completed"?" is-done":"");
  const details=document.createElement("div");details.className="tad-revision-lesson-details";
  const title=document.createElement("strong");title.textContent=item.title||"Revision task";
  const meta=document.createElement("small");
  const due=item.due_date?new Date(item.due_date+"T00:00:00"):null;
  const overdue=item.status!=="completed"&&due&&!Number.isNaN(due.getTime())&&due<today;
  const dueLabel=item.status==="completed"?"Completed":overdue?"Overdue":due&&!Number.isNaN(due.getTime())?(due.getTime()===today.getTime()?"Due today":"Due "+due.toLocaleDateString(undefined,{day:"numeric",month:"short"})):"No due date";
  const history=[];
  if(Number(item.review_count)>0)history.push(String(item.review_count)+" review"+(Number(item.review_count)===1?"":"s")+(item.last_reviewed_at?" · last "+new Date(item.last_reviewed_at).toLocaleDateString():""));
  if(Number(item.snooze_count)>0)history.push("postponed "+item.snooze_count+" time"+(Number(item.snooze_count)===1?"":"s"));
  if(item.last_review_result)history.push("last result: "+({again:"Again",hard:"Hard",good:"Good",easy:"Easy"}[item.last_review_result]||"Recorded"));
  meta.textContent=[dueLabel,...history].join(" · ");
  details.append(title,meta);
  const actions=document.createElement("div");actions.className="tad-revision-task-actions";
  const done=document.createElement("button");done.type="button";done.textContent=item.status==="completed"?"Undo":"Mark done";
  done.addEventListener("click",()=>task(item.id,item.status==="completed"?"pending":"completed"));actions.append(done);
  if(item.status!=="completed"){
   const ratingGroup=document.createElement("div");ratingGroup.className="tad-revision-rating-actions";
   [{value:"again",label:"Again · 1d"},{value:"hard",label:"Hard · 2d"},{value:"good",label:"Good · 4d"},{value:"easy",label:"Easy · 7d"}].forEach(rating=>{
    const review=document.createElement("button");review.type="button";review.className="tad-revision-rating";review.textContent=rating.label;review.title="Record this review result and schedule the next review";
    review.addEventListener("click",()=>task(item.id,"pending",null,rating.value));ratingGroup.append(review);
   });actions.append(ratingGroup);
   [1,3].forEach(days=>{
    const postpone=document.createElement("button");postpone.type="button";postpone.textContent="+"+days+" day"+(days===1?"":"s");
    postpone.addEventListener("click",()=>{
     const target=new Date();target.setHours(12,0,0,0);target.setDate(target.getDate()+days);
     const dueDate=[target.getFullYear(),String(target.getMonth()+1).padStart(2,"0"),String(target.getDate()).padStart(2,"0")].join("-");
     task(item.id,"pending",dueDate);
    });actions.append(postpone);
   });
  }
  card.append(details,actions);host.append(card);
 });
}
function render(){
const p=state.active_study_plan,plan=$("#tadAiPlan");plan.replaceChildren();
if(p){const h=document.createElement("b");h.textContent=String(p.title||p.goal||p.exam||"Current plan");plan.append(h);const d=document.createElement("p");d.textContent=String(p.summary||p.duration||p.timeline||"Your learning roadmap");plan.append(d);if(Array.isArray(p.schedule)){const ul=document.createElement("ul");p.schedule.slice(0,8).forEach(x=>{const li=document.createElement("li");li.textContent=typeof x==="string"?x:String(x.title||x.day||"Study session");ul.append(li);});plan.append(ul);}}else plan.textContent="No plan yet. Choose “Make Me a Study Plan”.";
const host=$("#tadAiTasks");host.replaceChildren();const ts=state.pending_tasks||[];if(!ts.length)host.textContent="Anbuu will add small tasks after your lesson.";
ts.filter(t=>t.status!=="completed").concat(ts.filter(t=>t.status==="completed").slice(-2)).forEach(t=>{const box=document.createElement("div");box.className="tad-ai-task"+(t.status==="completed"?" is-done":"");const b=document.createElement("b");b.textContent=t.title;box.append(b);if(t.description){const p=document.createElement("p");p.textContent=t.description;box.append(p);}const btn=document.createElement("button");btn.textContent=t.status==="completed"?"Undo":"Mark done";btn.onclick=()=>task(t.id,t.status==="completed"?"pending":"completed");box.append(btn);host.append(box);});
renderRevisionTasks(ts);
const dh=$("#tadAiDoubts");dh.replaceChildren();const ds=state.doubt_log||[];if(!ds.length)dh.textContent="No recurring doubts recorded yet.";else{const ul=document.createElement("ul");ds.slice(-8).forEach(x=>{const li=document.createElement("li");li.textContent=x;ul.append(li);});dh.append(ul);}
}
let lessonRows=[];
function renderLessonHistory(){
 const host=$("#tadLessonHistoryList");if(!host)return;host.replaceChildren();
 if(role!=="learner"){host.textContent="Sign in with a learner account to save and view your lessons.";return;}
 if(!lessonRows.length){host.textContent="No saved lessons yet. Start your first guided lesson above.";return;}
 lessonRows.forEach(lesson=>{
  const card=document.createElement("article");card.className="tad-lesson-history-card";
  const head=document.createElement("div");head.className="tad-lesson-history-title";
  const title=document.createElement("strong");title.textContent=lesson.subject+(lesson.topic?" · "+lesson.topic:"");
  const stateTag=document.createElement("span");stateTag.className="tad-lesson-state tad-lesson-state-"+lesson.status;stateTag.textContent=lesson.status==="in_progress"?"In progress":lesson.status==="paused"?"Paused":"Completed";
  head.append(title,stateTag);
  const meta=document.createElement("small");meta.textContent=(lesson.track==="gs"?"General Studies":lesson.track==="literature"?"Literature optional":"UPSC optional")+" · "+lesson.level+" · Started "+(lesson.created_at?new Date(lesson.created_at).toLocaleDateString():"date unavailable");
  const checkpoints=["concept","practice","recap"],labels={concept:"Understand the concept",practice:"Attempt practice",recap:"Complete a recap"};
  const completed=Array.isArray(lesson.checkpoint_completed)?lesson.checkpoint_completed:[];
  const progress=document.createElement("div");progress.className="tad-lesson-checkpoint-progress";
  const progressLabel=document.createElement("span");progressLabel.textContent=completed.length+" of 3 learning checkpoints";
  const progressTrack=document.createElement("span");progressTrack.className="tad-lesson-progress-track";progressTrack.setAttribute("role","progressbar");progressTrack.setAttribute("aria-valuemin","0");progressTrack.setAttribute("aria-valuemax","3");progressTrack.setAttribute("aria-valuenow",String(completed.length));progressTrack.setAttribute("aria-label","Lesson checkpoint progress");
  const progressFill=document.createElement("i");progressFill.style.width=(completed.length/3*100)+"%";progressTrack.append(progressFill);progress.append(progressLabel,progressTrack);
  const checkpointList=document.createElement("div");checkpointList.className="tad-lesson-checkpoints";
  checkpoints.forEach(key=>{
   const done=completed.includes(key),button=document.createElement("button");button.type="button";button.className="tad-lesson-checkpoint"+(done?" is-complete":"");button.textContent=(done?"✓ ":"○ ")+labels[key];button.setAttribute("aria-pressed",String(done));button.disabled=lesson.status==="completed";
   button.addEventListener("click",()=>updateLessonCheckpoint(lesson.id,key,!done));checkpointList.append(button);
  });
  const recommendation=document.createElement("p");recommendation.className="tad-lesson-recommendation";
  recommendation.textContent=completed.length===3?"Next: return to this topic in your revision queue for spaced recall.":!completed.includes("concept")?"Next priority: revisit the core explanation and make sure the main idea is clear.":!completed.includes("practice")?"Next priority: attempt a short set of practice questions without looking at the notes.":"Next priority: write a brief recap from memory and list any remaining doubts.";
  const actions=document.createElement("div");actions.className="tad-lesson-history-actions";
  const resume=document.createElement("button");resume.type="button";resume.textContent="Continue with recap";resume.addEventListener("click",()=>sendMessage("Continue this saved lesson with a short, honest recap. My recorded checkpoints: "+completed.join(", ")+". Recommend the next unfinished learning checkpoint, teach only one small step, ask one understanding-check question and wait for my reply.",lesson.id));
  actions.append(resume);
  const toggle=document.createElement("button");toggle.type="button";
  if(lesson.status==="completed"){toggle.textContent="Reopen";toggle.addEventListener("click",()=>updateLesson(lesson.id,"in_progress"));}
  else if(lesson.status==="paused"){toggle.textContent="Resume";toggle.addEventListener("click",()=>updateLesson(lesson.id,"in_progress"));}
  else{toggle.textContent="Pause";toggle.addEventListener("click",()=>updateLesson(lesson.id,"paused"));}
  actions.append(toggle);
  if(lesson.status!=="completed"){const done=document.createElement("button");done.type="button";done.textContent="Complete + add revision task";done.addEventListener("click",()=>updateLesson(lesson.id,"completed"));actions.append(done);}
  card.append(head,meta,progress,checkpointList,recommendation,actions);host.append(card);
 });
}
async function loadLessons(){
 if(role!=="learner"){lessonRows=[];renderLessonHistory();return;}
 const r=await db.functions.invoke("ai-assistant",{body:{action:"get_lessons"}});
 if(r.error)throw r.error;
 lessonRows=Array.isArray(r.data?.lessons)?r.data.lessons:[];
 renderLessonHistory();
}
async function updateLesson(id,nextStatus){
 try{
  const r=await db.functions.invoke("ai-assistant",{body:{action:"update_lesson",lessonId:id,status:nextStatus}});
  if(r.error)throw r.error;
  if(r.data?.mentorState){state=r.data.mentorState;render();}
  await Promise.all([loadLessons(),loadState(),loadProgress()]);
  if(nextStatus==="completed")status.textContent="Lesson completed. A revision task is now in your Pending tasks list.";
 }catch(e){status.textContent=e.message||"Lesson progress could not be updated. Try again.";}
}
async function updateLessonCheckpoint(lessonId,checkpoint,completed){
 try{
  const r=await db.functions.invoke("ai-assistant",{body:{action:"update_lesson_checkpoint",lessonId,checkpoint,completed}});
  if(r.error)throw r.error;
  const updated=r.data?.lesson;
  if(!updated)throw new Error("No saved checkpoint update was returned.");
  lessonRows=lessonRows.map(item=>item.id===lessonId?{...item,...updated}:item);
  renderLessonHistory();
  status.textContent=completed?"Learning checkpoint saved and synced.":"Learning checkpoint reopened.";
 }catch(e){status.textContent=e.message||"Checkpoint could not be saved. Please try again.";}
}
$("#tadRefreshLessons").addEventListener("click",()=>loadLessons().catch(()=>{status.textContent="Could not refresh lesson history."; }));
async function loadState(){const r=await db.functions.invoke("ai-assistant",{body:{action:"get_state"}});if(r.error)throw r.error;state=r.data?.mentorState||empty();render();}
function setDashboardTab(name){const overview=name==="overview";$("#tadAiOverview").hidden=!overview;$("#tadAiRevision").hidden=overview;$("#tadAiOverviewTab").classList.toggle("is-active",overview);$("#tadAiRevisionTab").classList.toggle("is-active",!overview);$("#tadAiOverviewTab").setAttribute("aria-selected",String(overview));$("#tadAiRevisionTab").setAttribute("aria-selected",String(!overview));}
$("#tadAiOverviewTab").addEventListener("click",()=>setDashboardTab("overview"));
$("#tadAiRevisionTab").addEventListener("click",()=>setDashboardTab("revision"));
let revisionTopics=[];
function revisionIntervalDays(topic){
 const misses=Math.max(0,Number(topic?.mistakes)||0);
 if(misses>=4)return 0;
 if(misses===3)return 1;
 if(misses===2)return 3;
 return 7;
}
function revisionDueDate(topic){
 const date=new Date();
 date.setHours(12,0,0,0);
 date.setDate(date.getDate()+revisionIntervalDays(topic));
 return date;
}
function renderRevisionPlan(topics){revisionTopics=Array.isArray(topics)?topics:[];const summary=$("#tadAiRevisionSummary"),list=$("#tadAiRevisionList"),build=$("#tadAiBuildRevision");summary.replaceChildren();list.replaceChildren();build.disabled=!revisionTopics.length;
if(!revisionTopics.length){const p=document.createElement("p");p.className="tad-revision-empty";p.textContent="Your revision queue will appear here after topic-level mistakes are saved from practice. Complete a test and add the topics you missed.";summary.append(p);return;}
const count=document.createElement("strong");count.textContent=revisionTopics.length+" focus topic"+(revisionTopics.length===1?"":"s");const detail=document.createElement("span");detail.textContent=" prioritised by recorded mistake frequency";summary.append(count,detail);
revisionTopics.forEach((topic,index)=>{const card=document.createElement("article");card.className="tad-revision-card";const top=document.createElement("div");top.className="tad-revision-card-top";const rank=document.createElement("span");rank.className="tad-revision-rank";rank.textContent=String(index+1).padStart(2,"0");const name=document.createElement("strong");name.textContent=topic.topic;top.append(rank,name);const count=document.createElement("span");count.className="tad-revision-count";count.textContent=topic.mistakes+" miss"+(topic.mistakes===1?"":"es");const timeline=document.createElement("div");timeline.className="tad-revision-timeline";const label=document.createElement("span");label.textContent="Next review · based on miss count";const interval=document.createElement("b");const days=revisionIntervalDays(topic);interval.textContent=days===0?"Today":days===1?"Tomorrow":"In "+days+" days";const due=document.createElement("small");due.textContent=revisionDueDate(topic).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});timeline.append(label,interval,due);card.append(top,count,timeline);list.append(card);});
}
$("#tadAiBuildRevision").addEventListener("click",()=>{if(!revisionTopics.length)return;const topics=revisionTopics.map(t=>{const days=revisionIntervalDays(t);const due=days===0?"today":days===1?"tomorrow":"in "+days+" days";return t.topic+" ("+t.mistakes+" recorded mistakes; next review "+due+")";}).join("; ");sendMessage("Create a manageable revision plan and save 1–3 revision tasks for these recorded weak topics: "+topics+". Prioritise topics with more repeated mistakes first. Use active recall, a short concept review, and practice questions. Schedule the next review using the supplied intervals, then suggest later spaced reviews at 3, 7 and 14 days where appropriate. Do not invent syllabus details or claim that a topic is mastered.");});
function renderNextSteps(data){
const host=$("#tadAiNextSteps");if(!host)return;host.replaceChildren();
const cards=[];
const pending=(state.pending_tasks||[]).filter(item=>item&&item.status!=="completed");
if(pending.length){const item=pending[0];cards.push({title:"Finish a pending task",detail:item.title||"Your next saved task",prompt:"Help me work through this saved task step by step: "+String(item.title||"Pending task")+" — "+String(item.description||"").slice(0,300)});}
const lessons=Array.isArray(data?.lessons?.recent)?data.lessons.recent:[];
const active=lessons.find(item=>item.status==="in_progress");
const paused=lessons.find(item=>item.status==="paused");
const completed=lessons.find(item=>item.status==="completed");
const selected=active||paused;
if(selected){const resume=selected.status==="paused";cards.push({title:resume?"Resume a paused lesson":"Continue your current lesson",detail:selected.subject+(selected.topic?" · "+selected.topic:""),prompt:(resume?"Help me resume":"Continue teaching me in")+" my saved Anbuu lesson: "+selected.subject+(selected.topic?" — "+selected.topic:"")+". Track: "+selected.track+". Level: "+selected.level+". Continue from the next logical concept, briefly recap first, then ask one understanding-check question."});}
else if(completed){cards.push({title:"Check what you remember",detail:completed.subject+(completed.topic?" · "+completed.topic:""),prompt:"Give me a short active-recall check on my recently completed Anbuu lesson: "+completed.subject+(completed.topic?" — "+completed.topic:"")+". Ask one question at a time and correct my understanding. Do not assume I have mastered it."});}
const weak=(Array.isArray(data?.weakTopics)?data.weakTopics:[])[0];
if(weak){cards.push({title:"Revisit a recorded weak topic",detail:weak.topic+" · "+weak.mistakes+" saved mistake(s)",prompt:"Teach and help me revise this topic where my saved practice shows repeated mistakes: "+weak.topic+". Start with the underlying concept, then give me a short practice check."});}
if(!cards.length){cards.push({title:"Start a guided lesson",detail:"Choose a GS topic, optional subject or literature optional.",prompt:"Help me choose and begin a suitable beginner guided lesson. Ask which track and subject I want to study, then teach one concept at a time."});}
cards.slice(0,3).forEach(item=>{const card=document.createElement("article");card.className="tad-ai-next-step";const title=document.createElement("strong");title.textContent=item.title;const detail=document.createElement("p");detail.textContent=item.detail;const button=document.createElement("button");button.type="button";button.textContent="Ask Anbuu";button.addEventListener("click",()=>sendMessage(item.prompt));card.append(title,detail,button);host.append(card);});
}
function renderStudySnapshot(data){
 const host=$("#tadAiSnapshot");if(!host)return;host.replaceChildren();
 const weekly=data?.weekly||{},topics=Array.isArray(data?.weakTopics)?data.weakTopics:[],pending=(state.pending_tasks||[]).filter(t=>t&&t.status!=="completed");
 const metrics=[
  ["Tests · 7 days",Number(weekly.tests||0)],
  ["Pending tasks",pending.length],
  ["Recorded focus topics",topics.length]
 ];
 const grid=document.createElement("div");grid.className="tad-ai-snapshot-grid";
 metrics.forEach(([label,value])=>{const item=document.createElement("div");item.className="tad-ai-snapshot-metric";const strong=document.createElement("strong");strong.textContent=String(value);const caption=document.createElement("span");caption.textContent=label;item.append(strong,caption);grid.append(item);});
 host.append(grid);
 const insight=document.createElement("p");insight.className="tad-ai-snapshot-insight";
 let focus="";
 if(topics.length){const first=topics[0];focus="Suggested focus: revisit "+String(first.topic||"your highest-priority topic")+" ("+Number(first.mistakes||0)+" recorded mistake(s)).";}
 else if(pending.length){focus="Suggested focus: complete one pending task — "+String(pending[0].title||"your next task")+". ";}
 else if(Number(weekly.tests||0)===0){focus="No test activity is recorded for the last 7 days. Try one short topic test to create a useful baseline.";}
 else{focus="Keep the routine steady: review one topic and use a short recall check before moving on.";}
 insight.textContent=focus+" These are study signals, not a prediction of your exam result.";host.append(insight);
 const button=$("#tadAiPlanSession");if(button)button.onclick=()=>sendMessage("Use my saved study plan, pending tasks and recorded weak topics to create my next study session. Keep it realistic and time-bounded. If my available study time is not saved, ask me for it before setting durations. Start with one priority and explain why it comes first.");
}
function renderMockExamInsights(data){
 const host=$("#tadAiMockInsights");if(!host)return;host.replaceChildren();
 const exams=Array.isArray(data?.mockExams)?data.mockExams:[];
 if(!exams.length){host.textContent="No submitted mock examinations are recorded yet. Your section analysis will appear here after your first submission.";return;}
 const grouped=new Map();
 exams.forEach(exam=>{
  const sections=exam.sectionBreakdown&&typeof exam.sectionBreakdown==="object"?exam.sectionBreakdown:{};
  Object.entries(sections).forEach(([key,value])=>{
   const name=String(exam.paperType||"Mock paper")+" · "+String(key||"Main");
   const prior=grouped.get(name)||{correct:0,wrong:0,skipped:0,attempts:0};
   prior.correct+=Number(value?.correct||0);prior.wrong+=Number(value?.wrong||0);
   prior.skipped+=Number(value?.skipped||0);prior.attempts+=1;grouped.set(name,prior);
  });
 });
 const latest=document.createElement("div");latest.className="tad-ai-mock-latest";
 exams.slice(0,5).forEach(exam=>{
  const card=document.createElement("article");card.className="tad-ai-mock-result";
  const heading=document.createElement("strong");heading.textContent=String(exam.name||"UPSC mock examination");
  const meta=document.createElement("small");meta.textContent=(exam.date?new Date(exam.date).toLocaleDateString():"Date unavailable")+" · "+(exam.percentage===null?"Objective percentage unavailable":Number(exam.percentage).toFixed(1)+"% objective score")+" · "+Number(exam.correct||0)+" correct, "+Number(exam.wrong||0)+" incorrect";
  card.append(heading,meta);
  if(exam.optionalSubject){const optional=document.createElement("small");optional.textContent="Optional: "+String(exam.optionalSubject);card.append(optional);}
  latest.append(card);
 });
 host.append(latest);
 if(grouped.size){
  const heading=document.createElement("h4");heading.textContent="Section-level totals across recorded attempts";host.append(heading);
  const list=document.createElement("ul");list.className="tad-ai-mock-section-list";
  [...grouped.entries()].sort((a,b)=>((b[1].wrong+b[1].skipped)-(a[1].wrong+a[1].skipped))).slice(0,10).forEach(([name,v])=>{
   const item=document.createElement("li");const label=document.createElement("strong");label.textContent=name;
   const detail=document.createElement("span");detail.textContent=v.correct+" correct · "+v.wrong+" incorrect · "+v.skipped+" unanswered · "+v.attempts+" attempt(s)";
   item.append(label,detail);list.append(item);
  });
  host.append(list);
 }else{
  const note=document.createElement("p");note.textContent="Section breakdown is not available for the submitted attempts yet.";host.append(note);
 }
}
function renderAnswerEvaluationHistory(items){
 const host=$("#tadAnswerHistory");if(!host)return;host.replaceChildren();
 const rows=Array.isArray(items)?items:[];
 if(!rows.length){host.textContent="No saved answer evaluations yet. Submit your first practice answer above.";return;}
 rows.slice(0,10).forEach(item=>{
  const row=document.createElement("article");row.className="tad-answer-history-item";
  const title=document.createElement("strong");title.textContent=(item.subject||"Practice answer")+" · "+(item.wordLimit||"—")+" words";
  const date=document.createElement("small");date.textContent=item.savedAt?new Date(item.savedAt).toLocaleString():"Saved evaluation";
  const question=document.createElement("p");question.textContent=String(item.question||"").slice(0,220);
  const feedback=document.createElement("details");const summary=document.createElement("summary");summary.textContent="View saved feedback";const body=document.createElement("div");body.className="tad-answer-history-feedback";body.textContent=String(item.feedback||"");
  feedback.append(summary,body);row.append(title,date,question,feedback);host.append(row);
 });
}
function renderProgress(data){
renderStudySnapshot(data);
renderAnswerEvaluationHistory(data?.answerEvaluations);
renderMockExamInsights(data);
const weekly=$("#tadAiWeekly"),historyHost=$("#tadAiHistory"),lessonsHost=$("#tadAiLessons"),weak=$("#tadAiWeak");
weekly.replaceChildren();historyHost.replaceChildren();lessonsHost.replaceChildren();weak.replaceChildren();
const w=data?.weekly||{},summary=document.createElement("p");
summary.textContent=w.tests?String(w.tests)+" test(s) · "+(w.average===null?"—":w.average+"% average")+" · "+w.correct+" correct, "+w.wrong+" incorrect, "+w.skipped+" skipped":"No mock tests recorded in the last 7 days.";
weekly.append(summary);
if(w.average!==null&&w.previousAverage!==null){const delta=document.createElement("p"),change=w.average-w.previousAverage;delta.textContent=(change>0?"Up ":change<0?"Down ":"No change ")+Math.abs(change)+" percentage points versus the previous 7 days.";weekly.append(delta);}
const tests=Array.isArray(data?.tests)?data.tests:[];
if(!tests.length)historyHost.textContent="Your saved mock-test results will appear here.";
else tests.slice(0,8).forEach(t=>{const row=document.createElement("div");row.className="tad-ai-history-row";const strong=document.createElement("strong");strong.textContent=t.name||t.exam||"Practice test";const meta=document.createElement("small");meta.textContent=(t.date?new Date(t.date).toLocaleDateString():"Date unavailable")+" · "+(t.percentage===null?"Score unavailable":t.percentage+"%")+" · "+t.correct+" correct";row.append(strong,meta);historyHost.append(row);});
const lessonData=data?.lessons||{},lessonStats=[
 ["Total lessons",Number(lessonData.total||0)],
 ["Completed",Number(lessonData.completed||0)],
 ["In progress",Number(lessonData.inProgress||0)],
 ["Paused",Number(lessonData.paused||0)]
];
const statGrid=document.createElement("div");statGrid.className="tad-ai-lesson-stats";
lessonStats.forEach(([label,value])=>{const item=document.createElement("div");item.className="tad-ai-lesson-stat";const strong=document.createElement("strong");strong.textContent=String(value);const caption=document.createElement("span");caption.textContent=label;item.append(strong,caption);statGrid.append(item);});
lessonsHost.append(statGrid);
const recentLessons=Array.isArray(lessonData.recent)?lessonData.recent:[];
if(!recentLessons.length){const empty=document.createElement("p");empty.className="tad-ai-lesson-empty";empty.textContent="No guided lessons have been saved yet. Start a lesson above to see your progress here.";lessonsHost.append(empty);}
else{const list=document.createElement("div");list.className="tad-ai-lesson-recent";recentLessons.slice(0,5).forEach(lesson=>{const row=document.createElement("div");row.className="tad-ai-history-row";const title=document.createElement("strong");title.textContent=lesson.subject+(lesson.topic?" · "+lesson.topic:"");const meta=document.createElement("small");const stateLabel=lesson.status==="in_progress"?"In progress":lesson.status==="paused"?"Paused":"Completed";meta.textContent=stateLabel+" · Updated "+(lesson.updated_at?new Date(lesson.updated_at).toLocaleDateString():"date unavailable");row.append(title,meta);list.append(row);});lessonsHost.append(list);}
const topics=Array.isArray(data?.weakTopics)?data.weakTopics:[];
renderRevisionPlan(topics);
renderNextSteps({lessons:lessonData,weakTopics:topics});
const unclassified=Number(data?.unclassifiedMistakes||0);
if(!topics.length){
weak.textContent=unclassified
?"You have "+unclassified+" older saved mistake(s), but they do not contain subject or topic tags. New tagged mistakes will appear here; if you miss the same question again, Anbuu will enrich its existing record."
:"No topic-level mistakes have been recorded yet. Complete a practice test to start building revision priorities.";
}else{
const list=document.createElement("ul");topics.forEach(t=>{const li=document.createElement("li");li.textContent=t.topic+" · "+t.mistakes+" recorded mistake(s)";list.append(li);});weak.append(list);
if(unclassified){const note=document.createElement("p");note.textContent=unclassified+" older mistake(s) are not topic-tagged and are excluded from this ranking.";weak.append(note);}
}
}
async function loadProgress(){const r=await db.functions.invoke("ai-assistant",{body:{action:"get_progress"}});if(r.error)throw r.error;renderProgress(r.data?.progress||{});}
async function refresh(){
const {data:{session}}=await db.auth.getSession();
if(!session){role="guest";$("#tadAiRole").textContent="Sign in required";status.textContent="Please sign in to use Anbuu.";$("#tadAiSidebar").hidden=true;return;}
const {data:p,error}=await db.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
role=!error&&p&&["learner","mentor","admin"].includes(p.role)?p.role:"guest";
$("#tadAiRole").textContent=role==="learner"?"Your personal study mentor":role==="guest"?"Role unavailable":role+" assistant";
$("#tadAiSidebar").hidden=role!=="learner";
if(role==="guest"){status.textContent="Your account role could not be verified.";return;}
if(role==="learner"){try{await loadState();await loadProgress();await loadLessons();}catch(e){status.textContent="Could not load saved progress or lesson history. Try again.";}
if(!opened&&!messages.childElementCount){const n=state.pending_tasks.filter(t=>t.status!=="completed").length;say(n?"Welcome back! You have "+n+" pending tasks. How did you get on?":"Welcome back! I’m Anbuu, your study mentor. What shall we work on today?","assistant");}}
else if(!messages.childElementCount)say(role==="admin"?"Admin Desk ready. Drafts require human verification.":"Mentor Desk ready. Share de-identified progress for feedback.","assistant");
opened=true;
}
async function task(id,next,dueDate=null,reviewResult=null){try{const r=await db.functions.invoke("ai-assistant",{body:{action:"update_task",taskId:id,status:next,...(dueDate?{dueDate}:{}),...(reviewResult?{reviewResult}:{})}});if(r.error)throw r.error;state=r.data.mentorState;render();status.textContent=reviewResult?"Review saved. Next review scheduled from your confidence rating.":dueDate?"Revision postponed and saved.":next==="completed"?"Revision marked complete.":"Task restored to pending."; }catch(e){status.textContent="Task could not be saved. Please try again.";}}
async function sendMessage(message,lessonId=null,evaluation=null){
if(!message||busy)return;if(role==="guest"){status.textContent="Sign in with a learner, mentor or admin account.";return;}
busy=true;send.disabled=true;input.value="";if(lessonId){history=[];messages.replaceChildren();}say(message,"user");
try{const r=await db.functions.invoke("ai-assistant",{body:{message,history:lessonId?[]:history,...(lessonId?{lessonId}:{})}});if(r.error)throw r.error;if(!r.data?.answer)throw new Error(r.data?.error||"No response received.");
say(r.data.answer,"assistant");history.push({role:"user",content:message},{role:"assistant",content:r.data.answer});history=history.slice(-8);
if(evaluation&&role==="learner"){
 const saved=await db.functions.invoke("ai-assistant",{body:{action:"save_answer_evaluation",...evaluation,feedback:r.data.answer}});
 if(saved.error||!saved.data?.saved){$("#tadAnswerStatus").textContent=saved.data?.error||"Feedback was generated, but saving failed. Please retry while connected.";}
 else{$("#tadAnswerStatus").textContent="Evaluation saved to your private learner history.";await loadProgress();}
}
if(role==="learner"&&r.data.mentorState){state=r.data.mentorState;render();}
status.textContent=(r.data.provider||"AI")+" · "+(r.data.remaining??"—")+" messages remaining today.";
}catch(e){say(e.message||"Anbuu could not respond right now.","assistant");status.textContent="Request failed. Check your connection and try again.";}
finally{busy=false;send.disabled=false;input.focus();}
}
const prompts={plan:"Help me create a realistic study plan. Ask for my exam goal, syllabus, timeline and daily available study time only if missing. Save the agreed plan.",doubts:"Summarise my recurring doubts from this conversation and saved learning context in 2–3 bullets. Update my doubt log if useful.",tasks:"Give me 1–3 concrete tasks for today based on my active study plan, pending tasks and today's lesson. Save the updated task list."};
const aiWorkflows={tutor:"Act as my patient UPSC teacher. Ask me which concept I want to learn if I have not supplied one. Start from first principles, define terms in simple English, add a grounded example, explain common misconceptions, then ask one short check-for-understanding question. Do not invent citations or official syllabus wording.",answer:"Act as a strict but constructive UPSC Mains evaluator. Ask me to paste the question, my answer and word limit if missing. Evaluate demand coverage, relevance, structure, depth, examples/evidence, balance and conclusion. Give a criterion-wise score only when marks are supplied; otherwise use qualitative feedback. Show specific edits and a stronger outline, not a fabricated topper answer.",anthro:"Be my beginner-friendly UPSC Anthropology optional teacher. First ask which topic I want to study if missing. Explain from zero in simple English, add Tamil equivalents for difficult terms when useful, connect thinkers and theories accurately, distinguish established facts from debates, and finish with a short recall check and one Mains-style question.",quiz:"Start an interactive UPSC active-recall session. Ask my subject and difficulty if missing. Ask only one question at a time, wait for my answer, then explain the correct reasoning and why alternatives are weaker. Track topics I struggle with in this conversation and finish with a short gap analysis. Do not present invented questions as official PYQs.",current:"Act as a UPSC current-affairs analyst. Ask me for the news item, issue or article if missing. Analyse it under: what happened, background, constitutional/legal or policy context where relevant, stakeholders, significance, concerns, way forward and syllabus connections. Separate verified facts from analysis and do not invent dates, figures, reports or sources.",revision:"Use my saved study plan, pending tasks, weak-topic history and available study time to propose a realistic revision sequence. Prioritise high-impact gaps, include active recall and spaced review, and limit the plan to manageable tasks. Ask for missing essential information instead of assuming."};
panel.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>sendMessage(prompts[b.dataset.prompt])));
panel.querySelectorAll("[data-ai-workflow]").forEach(b=>b.addEventListener("click",()=>{sendMessage(aiWorkflows[b.dataset.aiWorkflow]);input.focus();}));

$("#tadAnswerLabForm").addEventListener("submit",e=>{
 e.preventDefault();
 if(role!=="learner"){$("#tadAnswerStatus").textContent="Sign in with a learner account to save answer evaluations.";return;}
 const evaluation={subject:$("#tadAnswerSubject").value.trim(),question:$("#tadAnswerQuestion").value.trim(),answer:$("#tadAnswerText").value.trim(),wordLimit:Number($("#tadAnswerWordLimit").value)};
 if(!evaluation.subject||!evaluation.question||!evaluation.answer||!Number.isInteger(evaluation.wordLimit)||evaluation.wordLimit<1||evaluation.wordLimit>1000){$("#tadAnswerStatus").textContent="Complete every field and check the word limit.";return;}
 const prompt="Evaluate the following UPSC Mains practice answer. This is educational feedback, not an official UPSC score. Paper/subject: "+evaluation.subject+". Word limit: "+evaluation.wordLimit+". Question: "+evaluation.question+". Candidate answer: "+evaluation.answer+". Use these headings: 1. Question demand and directive analysis 2. Demand coverage and relevance 3. Structure and flow 4. Analysis and depth 5. Examples, evidence and constitutional/legal accuracy 6. Balance and conclusion 7. Specific strengths 8. Priority corrections 9. Improved answer outline 10. A short next-practice task. Count approximate words and compare with the stated limit. Do not invent facts, data, judgments, reports, scholars or citations. Flag anything that needs verification. Give a numeric mark only if the question explicitly supplies the maximum marks; otherwise use qualitative feedback. Do not fabricate a complete topper answer.";
 $("#tadAnswerStatus").textContent="Anbuu is reviewing your answer…";
 sendMessage(prompt,null,evaluation);
});
$("#tadAiForm").onsubmit=e=>{e.preventDefault();sendMessage(input.value.trim());};
db.auth.onAuthStateChange(()=>{role="guest";history=[];state=empty();lessonRows=[];renderLessonHistory();opened=false;messages.replaceChildren();queueMicrotask(()=>refresh().catch(()=>{}));});
refresh().catch(()=>{status.textContent="Could not check your account. Reload and sign in again.";});
if(location.hash==="#anbuu"){const nav=document.querySelector('.nav-link[data-nav="anbuu"]');if(nav)nav.click();}
})();