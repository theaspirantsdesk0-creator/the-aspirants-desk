(function(){
"use strict";
const host=document.getElementById("questionReviewAdmin");
if(!host)return;
const $=id=>document.getElementById(id);
const sb=window.TAD_SUPABASE;
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CHECKS=["answer","distractors","explanation","metadata","duplicates"];
const CHECK_LABELS={answer:"Correct answer checked against source",distractors:"All three distractors checked",explanation:"Explanation checked against source",metadata:"Subject, topic and difficulty checked",duplicates:"Duplicate and near-duplicate search completed"};
let user=null,rows=[],activeId=null,loading=false;
const status=(message,kind)=>{const el=$("qReviewStatus");if(el){el.textContent=message;el.className="mock-save"+(kind?" "+kind:"");}};
const readForm=()=>({
 subject:$("qReviewSubject").value.trim(),
 topic:$("qReviewTopic").value.trim(),
 question_text:$("qReviewQuestion").value.trim(),
 correct_answer:$("qReviewAnswer").value.trim(),
 wrong_options:$("qReviewWrong").value.split("\n").map(x=>x.trim()).filter(Boolean),
 explanation:$("qReviewExplanation").value.trim(),
 difficulty:$("qReviewDifficulty").value,
 source_title:$("qReviewSourceTitle").value.trim(),
 source_url:$("qReviewSourceUrl").value.trim(),
 review_checks:Object.fromEntries(CHECKS.map(k=>[k,$("qReviewCheck_"+k).checked]))
});
function validate(d,stage){
 const issues=[];
 if(d.subject.length<2)issues.push("Enter a subject.");
 if(d.question_text.length<10)issues.push("Question must contain at least 10 characters.");
 if(!d.correct_answer)issues.push("Enter the correct answer.");
 if(d.wrong_options.length!==3)issues.push("Enter exactly three wrong options, one per line.");
 if(new Set([d.correct_answer,...d.wrong_options].map(x=>x.toLocaleLowerCase())).size!==4)issues.push("The correct answer and three wrong options must be different.");
 if(d.explanation.length<5)issues.push("Add an explanation.");
 if(!["easy","medium","hard"].includes(d.difficulty))issues.push("Choose a difficulty.");
 if(stage!=="draft"){
  if(!/^https:\/\/[^\s]+$/i.test(d.source_url))issues.push("Add a valid HTTPS source URL.");
  if(!d.source_title)issues.push("Add the source title.");
  CHECKS.forEach(k=>{if(!d.review_checks[k])issues.push("Confirm: "+CHECK_LABELS[k]+".");});
 }
 return issues;
}
function duplicateWarning(d){
 const q=d.question_text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
 if(!q)return "";
 const match=rows.find(r=>r.id!==activeId&&String(r.subject).toLocaleLowerCase()===d.subject.toLocaleLowerCase()&&String(r.question_text).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim()===q);
 return match?"Possible exact duplicate in "+match.subject+" · "+match.status+" (record "+match.id.slice(0,8)+"). Check before approval.":"";
}
function resetEditor(){
 activeId=null;
 $("qReviewEditorTitle").textContent="Create practice question";
 $("qReviewForm").reset();
 CHECKS.forEach(k=>$("qReviewCheck_"+k).checked=false);
 $("qReviewRecordMeta").textContent="New question · saved as draft until reviewed";
}
function fillEditor(row){
 activeId=row.id;
 $("qReviewEditorTitle").textContent="Edit question";
 $("qReviewSubject").value=row.subject||"";
 $("qReviewTopic").value=row.topic||"";
 $("qReviewQuestion").value=row.question_text||"";
 $("qReviewAnswer").value=row.correct_answer||"";
 $("qReviewWrong").value=Array.isArray(row.wrong_options)?row.wrong_options.join("\n"):"";
 $("qReviewExplanation").value=row.explanation||"";
 $("qReviewDifficulty").value=row.difficulty||"medium";
 $("qReviewSourceTitle").value=row.source_title||"";
 $("qReviewSourceUrl").value=row.source_url||"";
 CHECKS.forEach(k=>$("qReviewCheck_"+k).checked===Boolean(row.review_checks?.[k])?null:$("qReviewCheck_"+k).click());
 $("qReviewRecordMeta").textContent="Status: "+row.status+" · Updated "+new Date(row.updated_at||row.created_at).toLocaleString();
 $("qReviewEditor").scrollIntoView({behavior:"smooth",block:"start"});
}
function paint(){
 const statusFilter=$("qReviewFilter").value;
 const query=$("qReviewSearch").value.trim().toLocaleLowerCase();
 const filtered=rows.filter(r=>(statusFilter==="all"||r.status===statusFilter)&&(!query||[r.subject,r.topic,r.question_text,r.source_title].join(" ").toLocaleLowerCase().includes(query)));
 const stats={draft:0,review:0,published:0,archived:0};
 rows.forEach(r=>stats[r.status]=(stats[r.status]||0)+1);
 $("qReviewStats").innerHTML=Object.entries(stats).map(([k,v])=>'<div class="qreview-stat"><strong>'+v+'</strong><span>'+esc(k)+'</span></div>').join("");
 $("qReviewCount").textContent=filtered.length+" question"+(filtered.length===1?"":"s");
 $("qReviewList").innerHTML=filtered.length?filtered.map(r=>'<article class="qreview-row"><div class="qreview-row-main"><div class="qreview-meta"><span class="qreview-status qreview-'+esc(r.status)+'">'+esc(r.status)+'</span><span>'+esc(r.subject)+'</span><span>'+esc(r.difficulty)+'</span></div><h4>'+esc(r.question_text)+'</h4><p>'+esc(r.topic||"No topic")+' · '+esc(r.source_title||"Source not added")+'</p></div><button class="btn" type="button" data-qreview-edit="'+esc(r.id)+'">Open</button></article>').join(""):'<p class="mock-save">No questions match this filter. Create a new question or change the filter.</p>';
 $("qReviewList").querySelectorAll("[data-qreview-edit]").forEach(btn=>btn.addEventListener("click",()=>{const row=rows.find(x=>x.id===btn.dataset.qreviewEdit);if(row)fillEditor(row);}));
}
async function load(){
 if(loading)return;loading=true;
 $("qReviewList").innerHTML='<p class="mock-save">Loading question review records…</p>';
 const {data,error}=await sb.from("practice_question_bank").select("id,subject,topic,question_text,correct_answer,wrong_options,explanation,difficulty,status,source_url,source_title,review_checks,reviewed_by,reviewed_at,created_by,created_at,updated_at").order("updated_at",{ascending:false}).limit(500);
 loading=false;
 if(error){status("Could not load the question bank: "+error.message,"mock-warning");return;}
 rows=data||[];paint();status("Connected. Changes are protected by database owner permissions.");
}
async function boot(){
 if(!sb){host.innerHTML='<p class="mock-save">Supabase is not connected. Sign in again and reload.</p>';return;}
 const {data:{session}}=await sb.auth.getSession();user=session?.user||null;
 if(!user){host.innerHTML='<p class="mock-save">Sign in with the owner account to access question review.</p>';return;}
 const {data:profile,error}=await sb.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(error||profile?.role!=="admin"){host.innerHTML='<p class="mock-save">Owner access only. This dashboard is unavailable to learner accounts.</p>';return;}
 host.hidden=false;
 $("qReviewFilter").addEventListener("change",paint);
 $("qReviewSearch").addEventListener("input",paint);
 $("qReviewNew").addEventListener("click",resetEditor);
 $("qReviewReload").addEventListener("click",load);
 $("qReviewSaveDraft").addEventListener("click",()=>save("draft"));
 $("qReviewSendReview").addEventListener("click",()=>save("review"));
 $("qReviewPublish").addEventListener("click",publish);
 $("qReviewArchive").addEventListener("click",archive);
 $("qReviewForm").addEventListener("submit",e=>e.preventDefault());
 $("qReviewQuestion").addEventListener("input",()=>{const d=readForm();const warning=duplicateWarning(d);$("qReviewDuplicate").textContent=warning||"Exact duplicate check will run against saved records.";});
 await load();
}
async function save(stage){
 const d=readForm(),issues=validate(d,stage);
 if(issues.length){status(issues.join(" "),"mock-warning");return;}
 const warning=duplicateWarning(d);
 if(warning&&!d.review_checks.duplicates){status(warning+" Complete the duplicate check before review.","mock-warning");return;}
 const payload={...d,status:stage,reviewed_by:stage==="review"?user.id:null,reviewed_at:stage==="review"?new Date().toISOString():null};
 if(stage==="draft")payload.review_checks=Object.fromEntries(CHECKS.map(k=>[k,false]));
 let result;
 if(activeId)result=await sb.from("practice_question_bank").update(payload).eq("id",activeId).select("id").single();
 else result=await sb.from("practice_question_bank").insert({...payload,created_by:user.id}).select("id").single();
 if(result.error){status("Save failed: "+result.error.message,"mock-warning");return;}
 activeId=result.data.id;status(stage==="review"?"Saved to review. A separate approval is required to publish.":"Draft saved. It is not visible to learners.");
 await load();
 const row=rows.find(x=>x.id===activeId);if(row)fillEditor(row);
}
async function publish(){
 if(!activeId){status("Open a question in Review before publishing.","mock-warning");return;}
 const row=rows.find(x=>x.id===activeId);
 if(!row||row.status!=="review"){status("Only a question already in Review can be published. Save it to Review first.","mock-warning");return;}
 if(!confirm("Publish this question to the learner practice bank? Confirm that the source and all five review checks have been inspected."))return;
 const {error}=await sb.from("practice_question_bank").update({status:"published"}).eq("id",activeId);
 if(error){status("Publication blocked: "+error.message,"mock-warning");return;}
 status("Question published. It is now eligible for the learner practice bank.");
 await load();const published=rows.find(x=>x.id===activeId);if(published)fillEditor(published);
}
async function archive(){
 if(!activeId){status("Open a question before archiving.","mock-warning");return;}
 const {error}=await sb.from("practice_question_bank").update({status:"archived"}).eq("id",activeId);
 if(error){status("Archive failed: "+error.message,"mock-warning");return;}
 status("Question archived and excluded from learner practice.");await load();resetEditor();
}
boot().catch(error=>{status("Question review could not start: "+(error.message||"Unknown error"),"mock-warning");});
})();