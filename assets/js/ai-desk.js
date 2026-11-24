(function(){
"use strict";
const url=window.DESK_SUPABASE_URL||"",key=window.DESK_SUPABASE_ANON_KEY||"";
if(!window.supabase||!url||!key)return;
const db=window.supabase.createClient(url,key),empty=()=>({active_study_plan:null,doubt_log:[],pending_tasks:[]});
let role="guest",history=[],state=empty(),busy=false,opened=false;
const panel=document.createElement("section");panel.id="tadAiPanel";panel.className="view-sec";panel.setAttribute("aria-label","Anbuu AI study mentor");
panel.innerHTML="<div class=\"tad-anbuu-page-hero\"><div class=\"tad-anbuu-hero-copy\"><span class=\"tad-anbuu-eyebrow\">YOUR PERSONAL AI LEARNING COMPANION</span><h1>Meet Anbuu.</h1><p>Your study mentor for planning, understanding concepts, practising questions, tracking progress and building consistent revision habits.</p><div class=\"tad-anbuu-hero-pills\"><span>✦ Personal study guidance</span><span>▤ Progress-aware support</span><span>↻ Smart revision</span></div></div><div class=\"tad-anbuu-orb\" aria-hidden=\"true\"><span>✦</span><b>ANBUU</b><small>LEARN · PRACTISE · IMPROVE</small></div></div><div class=\"tad-anbuu-feature-strip\"><div><b>01</b><strong>Ask &amp; understand</strong><span>Clear explanations and guided learning</span></div><div><b>02</b><strong>Plan &amp; act</strong><span>Small tasks linked to your study goals</span></div><div><b>03</b><strong>Review &amp; grow</strong><span>Progress insights and revision priorities</span></div></div><header id=\"tadAiHead\"><div><strong>✦ Anbuu · Personal Mentor</strong><small id=\"tadAiRole\">Checking account…</small></div><span class=\"tad-anbuu-online\"><i></i> Your learning space</span></header><div id=\"tadAiWorkspace\"><section class=\"tad-ai-chat\"><div id=\"tadAiMessages\" aria-live=\"polite\"></div><div id=\"tadAiStatus\">Sign in to start.</div><div class=\"tad-ai-quick\"><button type=\"button\" data-prompt=\"plan\">▤ Build my study plan</button><button type=\"button\" data-prompt=\"doubts\">◎ Review my doubts</button><button type=\"button\" data-prompt=\"tasks\">✦ Today’s tasks</button></div><form id=\"tadAiForm\"><textarea id=\"tadAiInput\" rows=\"2\" maxlength=\"6000\" placeholder=\"Ask Anbuu anything about your learning…\"></textarea><button id=\"tadAiSend\" type=\"submit\">Send ↗</button></form></section><aside id=\"tadAiSidebar\"><div class=\"tad-ai-side-heading\"><strong>My Learning Space</strong><span>YOUR PERSONAL DASHBOARD</span></div><nav class=\"tad-ai-tabs\" role=\"tablist\" aria-label=\"Anbuu dashboard tabs\"><button type=\"button\" class=\"tad-ai-tab is-active\" id=\"tadAiOverviewTab\" role=\"tab\" aria-selected=\"true\" aria-controls=\"tadAiOverview\">Overview</button><button type=\"button\" class=\"tad-ai-tab\" id=\"tadAiRevisionTab\" role=\"tab\" aria-selected=\"false\" aria-controls=\"tadAiRevision\">✦ Revision Planner</button></nav><div id=\"tadAiOverview\" class=\"tad-ai-tabpanel\" role=\"tabpanel\" aria-labelledby=\"tadAiOverviewTab\"><section><h3>Active study plan</h3><div id=\"tadAiPlan\">No active plan yet.</div></section><section><h3>Pending tasks</h3><div id=\"tadAiTasks\">No tasks yet.</div></section><section><h3>Recurring doubts</h3><div id=\"tadAiDoubts\">No recurring doubts yet.</div></section><section><h3>My progress · 7 days</h3><div id=\"tadAiWeekly\">Loading progress…</div></section><section><h3>Learning history</h3><div id=\"tadAiHistory\">Your recent mock tests will appear here.</div></section><section><h3>Topics to revisit</h3><div id=\"tadAiWeak\">Not enough recorded mistakes yet.</div></section></div><div id=\"tadAiRevision\" class=\"tad-ai-tabpanel\" role=\"tabpanel\" aria-labelledby=\"tadAiRevisionTab\" hidden><div class=\"tad-revision-hero\"><span class=\"tad-revision-kicker\">SMART REVISION</span><h2>Your next review, made simple.</h2><p>A practical revision queue built from the topics you have actually missed in saved practice.</p><div class=\"tad-revision-meta\"><span>↻ Spaced review</span><span>◷ 20 min / topic</span></div></div><div class=\"tad-revision-summary\" id=\"tadAiRevisionSummary\">Waiting for your saved practice data…</div><div class=\"tad-revision-list\" id=\"tadAiRevisionList\"></div><button type=\"button\" id=\"tadAiBuildRevision\" class=\"tad-revision-build\">Create my revision tasks <span>→</span></button><p class=\"tad-revision-footnote\">Your revision tasks are saved to Anbuu when created. Review intervals are suggestions, not a prediction of exam performance.</p></div></aside></div>"
document.querySelector("#mainContent").append(panel);
const lessonStudio=document.createElement("section");
lessonStudio.className="tad-anbuu-lesson-studio";
lessonStudio.setAttribute("aria-labelledby","tadLessonTitle");
lessonStudio.innerHTML="<div class='tad-lesson-heading'><span>GUIDED LEARNING</span><h2 id='tadLessonTitle'>Build a lesson with Anbuu</h2><p>Choose General Studies or any UPSC optional subject. Anbuu will teach the topic in stages, check understanding and suggest practice.</p></div><div class='tad-lesson-controls'><label>Learning track<select id='tadLessonTrack'><option value='gs'>General Studies &amp; GS foundations</option><option value='optional'>UPSC optional subject</option><option value='literature'>Literature optional</option></select></label><label>Subject<select id='tadLessonSubject'><option value='Polity'>Polity</option></select></label><label>Topic (optional)<input id='tadLessonTopic' maxlength='160' placeholder='e.g. Fundamental Rights'></label><label>Level<select id='tadLessonLevel'><option value='beginner'>Beginner</option><option value='intermediate'>Intermediate</option><option value='advanced'>Advanced</option></select></label><button id='tadStartLesson' type='button'>Start guided lesson <span>→</span></button></div><p class='tad-lesson-note' id='tadLessonNote' aria-live='polite'>Optional subjects and literature choices load from the site's UPSC coverage catalogue.</p>";
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
lessonStudio.querySelector("#tadStartLesson").addEventListener("click",()=>{
 const track=lessonTrack.value,subject=lessonSubject.value,topic=lessonStudio.querySelector("#tadLessonTopic").value.trim(),level=lessonStudio.querySelector("#tadLessonLevel").value;
 if(!subject){lessonStudio.querySelector("#tadLessonNote").textContent="Please choose a subject.";return;}
 const label=track==="gs"?"General Studies":track==="literature"?"Literature optional":"UPSC optional";
 const prompt="Start an interactive, step-by-step UPSC "+label+" lesson. Subject: "+subject+". Topic: "+(topic||"Choose one appropriate foundational topic and state the official syllabus reference only if you can verify it; otherwise clearly say the reference is unverified.")+". Learner level: "+level+". Act as a patient teacher. First give a short lesson roadmap, 2–3 learning objectives and any prerequisites. Then teach ONLY the first small concept in simple language with one example. Ask exactly one short understanding-check question and STOP; wait for the learner's reply before teaching the next stage. After each reply, briefly correct or confirm understanding and teach only the next stage. When the topic is complete, give 3 practice questions with explanations and 1–3 manageable revision tasks. Distinguish verified syllabus facts from examples, never invent official PYQs or citations, and never claim to save lesson completion unless a real save operation confirms it. Use Tamil and English if requested.";
 sendMessage(prompt);
});

const $=s=>panel.querySelector(s),messages=$("#tadAiMessages"),status=$("#tadAiStatus"),input=$("#tadAiInput"),send=$("#tadAiSend");
function say(text,who){const el=document.createElement("div");el.className="tad-ai-msg "+(who==="user"?"tad-ai-user":"tad-ai-assistant");el.textContent=text;messages.append(el);messages.scrollTop=messages.scrollHeight;}
function render(){
const p=state.active_study_plan,plan=$("#tadAiPlan");plan.replaceChildren();
if(p){const h=document.createElement("b");h.textContent=String(p.title||p.goal||p.exam||"Current plan");plan.append(h);const d=document.createElement("p");d.textContent=String(p.summary||p.duration||p.timeline||"Your learning roadmap");plan.append(d);if(Array.isArray(p.schedule)){const ul=document.createElement("ul");p.schedule.slice(0,8).forEach(x=>{const li=document.createElement("li");li.textContent=typeof x==="string"?x:String(x.title||x.day||"Study session");ul.append(li);});plan.append(ul);}}else plan.textContent="No plan yet. Choose “Make Me a Study Plan”.";
const host=$("#tadAiTasks");host.replaceChildren();const ts=state.pending_tasks||[];if(!ts.length)host.textContent="Anbuu will add small tasks after your lesson.";
ts.filter(t=>t.status!=="completed").concat(ts.filter(t=>t.status==="completed").slice(-2)).forEach(t=>{const box=document.createElement("div");box.className="tad-ai-task"+(t.status==="completed"?" is-done":"");const b=document.createElement("b");b.textContent=t.title;box.append(b);if(t.description){const p=document.createElement("p");p.textContent=t.description;box.append(p);}const btn=document.createElement("button");btn.textContent=t.status==="completed"?"Undo":"Mark done";btn.onclick=()=>task(t.id,t.status==="completed"?"pending":"completed");box.append(btn);host.append(box);});
const dh=$("#tadAiDoubts");dh.replaceChildren();const ds=state.doubt_log||[];if(!ds.length)dh.textContent="No recurring doubts recorded yet.";else{const ul=document.createElement("ul");ds.slice(-8).forEach(x=>{const li=document.createElement("li");li.textContent=x;ul.append(li);});dh.append(ul);}
}
async function loadState(){const r=await db.functions.invoke("ai-assistant",{body:{action:"get_state"}});if(r.error)throw r.error;state=r.data?.mentorState||empty();render();}
function setDashboardTab(name){const overview=name==="overview";$("#tadAiOverview").hidden=!overview;$("#tadAiRevision").hidden=overview;$("#tadAiOverviewTab").classList.toggle("is-active",overview);$("#tadAiRevisionTab").classList.toggle("is-active",!overview);$("#tadAiOverviewTab").setAttribute("aria-selected",String(overview));$("#tadAiRevisionTab").setAttribute("aria-selected",String(!overview));}
$("#tadAiOverviewTab").addEventListener("click",()=>setDashboardTab("overview"));
$("#tadAiRevisionTab").addEventListener("click",()=>setDashboardTab("revision"));
let revisionTopics=[];
function renderRevisionPlan(topics){revisionTopics=Array.isArray(topics)?topics:[];const summary=$("#tadAiRevisionSummary"),list=$("#tadAiRevisionList"),build=$("#tadAiBuildRevision");summary.replaceChildren();list.replaceChildren();build.disabled=!revisionTopics.length;
if(!revisionTopics.length){const p=document.createElement("p");p.className="tad-revision-empty";p.textContent="Your revision queue will appear here after topic-level mistakes are saved from practice. Complete a test and add the topics you missed.";summary.append(p);return;}
const count=document.createElement("strong");count.textContent=revisionTopics.length+" focus topic"+(revisionTopics.length===1?"":"s");const detail=document.createElement("span");detail.textContent=" ranked by recorded mistake frequency";summary.append(count,detail);
const intervals=["Today","Tomorrow","In 3 days","In 7 days","In 14 days"];
revisionTopics.forEach((topic,index)=>{const card=document.createElement("article");card.className="tad-revision-card";const top=document.createElement("div");top.className="tad-revision-card-top";const rank=document.createElement("span");rank.className="tad-revision-rank";rank.textContent=String(index+1).padStart(2,"0");const name=document.createElement("strong");name.textContent=topic.topic;top.append(rank,name);const count=document.createElement("span");count.className="tad-revision-count";count.textContent=topic.mistakes+" miss"+(topic.mistakes===1?"":"es");const timeline=document.createElement("div");timeline.className="tad-revision-timeline";const label=document.createElement("span");label.textContent="Suggested review";const interval=document.createElement("b");interval.textContent=intervals[Math.min(index,intervals.length-1)];timeline.append(label,interval);card.append(top,count,timeline);list.append(card);});
}
$("#tadAiBuildRevision").addEventListener("click",()=>{if(!revisionTopics.length)return;const topics=revisionTopics.map(t=>t.topic+" ("+t.mistakes+" recorded mistakes)").join("; ");sendMessage("Create a manageable revision plan and save 1–3 revision tasks for these recorded weak topics: "+topics+". Use active recall, a short concept review, and practice questions. Include spaced reviews over the next 1, 3, 7 and 14 days where realistic. Do not invent syllabus details.");});
function renderProgress(data){
const weekly=$("#tadAiWeekly"),historyHost=$("#tadAiHistory"),weak=$("#tadAiWeak");
weekly.replaceChildren();historyHost.replaceChildren();weak.replaceChildren();
const w=data?.weekly||{},summary=document.createElement("p");
summary.textContent=w.tests?String(w.tests)+" test(s) · "+(w.average===null?"—":w.average+"% average")+" · "+w.correct+" correct, "+w.wrong+" incorrect, "+w.skipped+" skipped":"No mock tests recorded in the last 7 days.";
weekly.append(summary);
if(w.average!==null&&w.previousAverage!==null){const delta=document.createElement("p"),change=w.average-w.previousAverage;delta.textContent=(change>0?"Up ":change<0?"Down ":"No change ")+Math.abs(change)+" percentage points versus the previous 7 days.";weekly.append(delta);}
const tests=Array.isArray(data?.tests)?data.tests:[];
if(!tests.length)historyHost.textContent="Your saved mock-test results will appear here.";
else tests.slice(0,8).forEach(t=>{const row=document.createElement("div");row.className="tad-ai-history-row";const strong=document.createElement("strong");strong.textContent=t.name||t.exam||"Practice test";const meta=document.createElement("small");meta.textContent=(t.date?new Date(t.date).toLocaleDateString():"Date unavailable")+" · "+(t.percentage===null?"Score unavailable":t.percentage+"%")+" · "+t.correct+" correct";row.append(strong,meta);historyHost.append(row);});
const topics=Array.isArray(data?.weakTopics)?data.weakTopics:[];
renderRevisionPlan(topics);
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
if(role==="learner"){try{await loadState();await loadProgress();}catch(e){status.textContent="Could not load saved progress. Try again.";}
if(!opened&&!messages.childElementCount){const n=state.pending_tasks.filter(t=>t.status!=="completed").length;say(n?"Welcome back! You have "+n+" pending tasks. How did you get on?":"Welcome back! I’m Anbuu, your study mentor. What shall we work on today?","assistant");}}
else if(!messages.childElementCount)say(role==="admin"?"Admin Desk ready. Drafts require human verification.":"Mentor Desk ready. Share de-identified progress for feedback.","assistant");
opened=true;
}
async function task(id,next){try{const r=await db.functions.invoke("ai-assistant",{body:{action:"update_task",taskId:id,status:next}});if(r.error)throw r.error;state=r.data.mentorState;render();}catch(e){status.textContent="Task could not be saved. Please try again.";}}
async function sendMessage(message){
if(!message||busy)return;if(role==="guest"){status.textContent="Sign in with a learner, mentor or admin account.";return;}
busy=true;send.disabled=true;input.value="";say(message,"user");
try{const r=await db.functions.invoke("ai-assistant",{body:{message,history}});if(r.error)throw r.error;if(!r.data?.answer)throw new Error(r.data?.error||"No response received.");
say(r.data.answer,"assistant");history.push({role:"user",content:message},{role:"assistant",content:r.data.answer});history=history.slice(-8);
if(role==="learner"&&r.data.mentorState){state=r.data.mentorState;render();}
status.textContent=(r.data.provider||"AI")+" · "+(r.data.remaining??"—")+" messages remaining today.";
}catch(e){say(e.message||"Anbuu could not respond right now.","assistant");status.textContent="Request failed. Check your connection and try again.";}
finally{busy=false;send.disabled=false;input.focus();}
}
const prompts={plan:"Help me create a realistic study plan. Ask for my exam goal, syllabus, timeline and daily available study time only if missing. Save the agreed plan.",doubts:"Summarise my recurring doubts from this conversation and saved learning context in 2–3 bullets. Update my doubt log if useful.",tasks:"Give me 1–3 concrete tasks for today based on my active study plan, pending tasks and today's lesson. Save the updated task list."};
panel.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>sendMessage(prompts[b.dataset.prompt])));

$("#tadAiForm").onsubmit=e=>{e.preventDefault();sendMessage(input.value.trim());};
db.auth.onAuthStateChange(()=>{role="guest";history=[];state=empty();opened=false;messages.replaceChildren();queueMicrotask(()=>refresh().catch(()=>{}));});
refresh().catch(()=>{status.textContent="Could not check your account. Reload and sign in again.";});
if(location.hash==="#anbuu"){const nav=document.querySelector('.nav-link[data-nav="anbuu"]');if(nav)nav.click();}
})();