(function(){
"use strict";
const url=window.DESK_SUPABASE_URL||"",key=window.DESK_SUPABASE_ANON_KEY||"";
if(!window.supabase||!url||!key)return;
const db=window.supabase.createClient(url,key),empty=()=>({active_study_plan:null,doubt_log:[],pending_tasks:[]});
let role="guest",history=[],state=empty(),busy=false,opened=false;
const launch=document.createElement("button");launch.id="tadAiLauncher";launch.type="button";launch.textContent="✦ Anbuu";
const panel=document.createElement("section");panel.id="tadAiPanel";panel.setAttribute("aria-label","Anbuu personal mentor");
panel.innerHTML='<header id="tadAiHead"><div><strong>Anbuu · Personal Mentor</strong><small id="tadAiRole">Checking account…</small></div><button id="tadAiClose" type="button" aria-label="Close">×</button></header><div id="tadAiWorkspace"><section class="tad-ai-chat"><div id="tadAiMessages" aria-live="polite"></div><div id="tadAiStatus">Sign in to start.</div><div class="tad-ai-quick"><button type="button" data-prompt="plan">Make Me a Study Plan</button><button type="button" data-prompt="doubts">Summarize My Doubts</button><button type="button" data-prompt="tasks">Give Me Today’s Tasks</button></div><form id="tadAiForm"><textarea id="tadAiInput" rows="2" maxlength="6000" placeholder="Ask Anbuu a study question…"></textarea><button id="tadAiSend" type="submit">Send</button></form></section><aside id="tadAiSidebar"><strong>My Tasks &amp; Plan</strong><section><h3>Active study plan</h3><div id="tadAiPlan">No active plan yet.</div></section><section><h3>Pending tasks</h3><div id="tadAiTasks">No tasks yet.</div></section><section><h3>Recurring doubts</h3><div id="tadAiDoubts">No recurring doubts yet.</div></section><section><h3>My progress · 7 days</h3><div id="tadAiWeekly">Loading progress…</div></section><section><h3>Learning history</h3><div id="tadAiHistory">Your recent mock tests will appear here.</div></section><section><h3>Topics to revisit</h3><div id="tadAiWeak">Not enough recorded mistakes yet.</div></section></aside></div>';
document.body.append(launch,panel);
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
if(!topics.length)weak.textContent="No topic-level mistakes have been recorded yet. Complete practice tests and save mistakes to identify revision priorities.";
else{const list=document.createElement("ul");topics.forEach(t=>{const li=document.createElement("li");li.textContent=t.topic+" · "+t.mistakes+" recorded mistake(s)";list.append(li);});weak.append(list);}
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
launch.onclick=()=>{panel.classList.toggle("open");if(panel.classList.contains("open"))refresh();};
$("#tadAiClose").onclick=()=>panel.classList.remove("open");
$("#tadAiForm").onsubmit=e=>{e.preventDefault();sendMessage(input.value.trim());};
db.auth.onAuthStateChange(()=>{role="guest";history=[];state=empty();opened=false;messages.replaceChildren();queueMicrotask(()=>refresh().catch(()=>{}));});
refresh().catch(()=>{status.textContent="Could not check your account. Reload and sign in again.";});
})();