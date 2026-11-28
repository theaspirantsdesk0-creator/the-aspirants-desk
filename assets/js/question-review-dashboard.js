(function(){
"use strict";
const host=document.getElementById("questionReviewAdmin");
if(!host)return;
const $=id=>document.getElementById(id);
const sb=window.TAD_SUPABASE;
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CHECKS=["answer","distractors","explanation","metadata","duplicates"];
const CHECK_LABELS={answer:"Correct answer checked against source",distractors:"All three distractors checked",explanation:"Explanation checked against source",metadata:"Subject, topic and difficulty checked",duplicates:"Duplicate and near-duplicate search completed"};
let user=null,rows=[],activeId=null,loading=false,bulkPreview=[];
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
function normaliseQuestionKey(value){return String(value||"").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");}
function isHttpsSource(value){const u=String(value||"").trim();return u.startsWith("https://")&&!/\s/.test(u)?u:null;}
async function loadHistory(){
 const panel=$("qReviewHistory");if(!panel)return;
 if(!activeId){panel.innerHTML='<p class="mock-save">Open a saved question to see its version history and activity.</p>';return;}
 panel.innerHTML='<p class="mock-save">Loading version snapshots and reviewer activity…</p>';
 const [vResult,aResult]=await Promise.all([
  sb.from("practice_question_versions").select("question_key,version_no,event_type,snapshot,actor_id,created_at").eq("question_key",activeId).order("version_no",{ascending:false}).limit(30),
  sb.from("practice_question_activity").select("question_key,event_type,actor_id,details,created_at").eq("question_key",activeId).order("created_at",{ascending:false}).limit(40)
 ]);
 if(vResult.error||aResult.error){panel.innerHTML='<p class="mock-warning">History could not be loaded: '+esc((vResult.error||aResult.error).message)+'</p>';return;}
 const actors=[...new Set([...(vResult.data||[]),...(aResult.data||[])].map(x=>x.actor_id).filter(Boolean))];
 const names={};
 if(actors.length){const p=await sb.from("profiles").select("id,display_name").in("id",actors);(p.data||[]).forEach(x=>names[x.id]=x.display_name||"Owner");}
 const when=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?"Date unavailable":d.toLocaleString();};
 const who=id=>id?(names[id]||"Account "+id.slice(0,8)):"System";
 const versions=vResult.data||[],events=aResult.data||[];
 panel.innerHTML='<div class="qreview-history-grid"><section><h4>Version snapshots ('+versions.length+')</h4>'+
  (versions.length?versions.map(v=>'<article class="qreview-history-card"><div class="qreview-history-top"><strong>Version '+v.version_no+' · '+esc(v.event_type.replace(/_/g," "))+'</strong><small>'+esc(when(v.created_at))+'</small></div><p>'+esc(v.snapshot.subject||"")+' · '+esc(v.snapshot.status||"")+' · '+esc(v.snapshot.difficulty||"")+'</p><p>'+esc(v.snapshot.question_text||"")+'</p><small>Changed by '+esc(who(v.actor_id))+'</small><details><summary>View saved answer and source</summary><p><b>Answer:</b> '+esc(v.snapshot.correct_answer||"")+'</p><p><b>Explanation:</b> '+esc(v.snapshot.explanation||"")+'</p><p><b>Source:</b> '+esc(v.snapshot.source_title||"Not recorded")+(v.snapshot.source_url?' · <a href="'+esc(v.snapshot.source_url)+'" target="_blank" rel="noopener">Open source</a>':'')+'</p></details></article>').join(""):'<p class="mock-save">No saved versions yet.</p>')+
  '</section><section><h4>Reviewer activity ('+events.length+')</h4>'+
  (events.length?events.map(e=>'<article class="qreview-history-card"><div class="qreview-history-top"><strong>'+esc(e.event_type.replace(/_/g," "))+'</strong><small>'+esc(when(e.created_at))+'</small></div><p>'+esc(e.details.subject||"")+' · '+esc(e.details.from_status||"new")+' → '+esc(e.details.to_status||"")+'</p><p>'+esc(e.details.question_preview||"")+'</p><small>Actor: '+esc(who(e.actor_id))+' · Version '+esc(e.details.version_no||"—")+'</small></article>').join(""):'<p class="mock-save">No activity recorded yet.</p>')+
  '</section></div>';
}
function parseBulkRecords(raw){
 const parsed=JSON.parse(raw);
 if(Array.isArray(parsed))return parsed;
 if(parsed&&Array.isArray(parsed.questions))return parsed.questions;
 if(parsed&&Array.isArray(parsed.records))return parsed.records;
 throw new Error("JSON must be an array or an object containing a questions or records array.");
}
function similarScore(a,b){
 const aa=new Set(normaliseQuestionKey(a).split(" ").filter(Boolean));
 const bb=new Set(normaliseQuestionKey(b).split(" ").filter(Boolean));
 if(!aa.size||!bb.size)return 0;
 let shared=0;aa.forEach(token=>{if(bb.has(token))shared++;});
 return shared/(aa.size+bb.size-shared);
}
function resetBulkPreview(message){
 bulkPreview=[];
 $("qReviewBulkPreview").innerHTML="";
 $("qReviewBulkSummary").textContent=message||"Choose a JSON file or paste questions, then preview before importing.";
 $("qReviewBulkImport").disabled=true;
 $("qReviewBulkExport").disabled=true;
}
function paintBulkPreview(){
 const ready=bulkPreview.filter(x=>x.state==="ready"||x.state==="similar").length;
 const duplicates=bulkPreview.filter(x=>x.state==="duplicate").length;
 const invalid=bulkPreview.filter(x=>x.state==="invalid").length;
 const similar=bulkPreview.filter(x=>x.state==="similar").length;
 $("qReviewBulkSummary").textContent=bulkPreview.length+" rows · "+ready+" eligible draft(s) · "+duplicates+" duplicate(s) · "+invalid+" invalid · "+similar+" similar-question warning(s)";
 $("qReviewBulkImport").disabled=ready===0;
 $("qReviewBulkExport").disabled=bulkPreview.length===0;
 $("qReviewBulkPreview").innerHTML=bulkPreview.length?'<div class="qreview-preview-table-wrap"><table class="qreview-preview-table"><thead><tr><th>Row</th><th>Result</th><th>Subject</th><th>Question</th><th>Validation details</th></tr></thead><tbody>'+
  bulkPreview.map(x=>'<tr><td>'+x.row+'</td><td><span class="qreview-preview-status qreview-preview-'+esc(x.state)+'">'+esc(x.state==="ready"?"Ready":x.state==="similar"?"Similar":x.state==="duplicate"?"Duplicate":x.state==="imported"?"Imported":x.state==="failed"?"Failed":"Invalid")+'</span></td><td>'+esc(x.item?.subject||"—")+'</td><td>'+esc(x.item?.question_text||x.rawQuestion||"")+'</td><td>'+esc([...(x.issues||[]),...(x.warnings||[]),x.duplicateOf||""].filter(Boolean).join(" · ")||"Passed checks")+'</td></tr>').join("")+
  '</tbody></table></div>':'';
}
async function previewBulk(){
 resetBulkPreview("Checking records and comparing them with the saved question bank…");
 const raw=$("qReviewBulkJson").value.trim();
 if(!raw){status("Choose a JSON file or paste a question array first.","mock-warning");return;}
 let incoming;
 try{incoming=parseBulkRecords(raw);}catch(error){resetBulkPreview("The JSON could not be read.");status("Import JSON error: "+error.message,"mock-warning");return;}
 if(!incoming.length){status("The import file has no question records.","mock-warning");return;}
 if(incoming.length>100){status("Import is limited to 100 questions per batch. Split the file into smaller batches.","mock-warning");return;}
 const existing=[];
 for(let offset=0;;offset+=1000){
  const response=await sb.from("practice_question_bank").select("id,subject,question_text,status").range(offset,offset+999);
  if(response.error){resetBulkPreview("Could not load existing records for duplicate checking.");status("Duplicate check failed: "+response.error.message,"mock-warning");return;}
  existing.push(...(response.data||[]));
  if(!response.data||response.data.length<1000)break;
 }
 const known=new Map();
 existing.forEach(row=>{
  const key=normaliseQuestionKey(row.subject)+"|"+normaliseQuestionKey(row.question_text);
  if(!known.has(key))known.set(key,row);
 });
 const seen=new Set(),preview=[];
 incoming.forEach((rawRow,index)=>{
  const entry={row:index+1,rawQuestion:"",item:null,state:"invalid",issues:[],warnings:[],duplicateOf:null};
  if(!rawRow||typeof rawRow!=="object"||Array.isArray(rawRow)){
   entry.issues.push("Each record must be a JSON object.");
   preview.push(entry);return;
  }
  const wrong=Array.isArray(rawRow.wrong_options)?rawRow.wrong_options:rawRow.w;
  const rawDifficulty=String(rawRow.difficulty||"medium").toLowerCase();
  entry.rawQuestion=String(rawRow.question_text||rawRow.q||"");
  const item={
   subject:String(rawRow.subject||"").trim(),
   topic:String(rawRow.topic||"").trim(),
   question_text:entry.rawQuestion.trim(),
   correct_answer:String(rawRow.correct_answer||rawRow.a||"").trim(),
   wrong_options:Array.isArray(wrong)?wrong.map(x=>String(x).trim()):[],
   explanation:String(rawRow.explanation||rawRow.e||"").trim(),
   difficulty:["easy","medium","hard"].includes(rawDifficulty)?rawDifficulty:"medium",
   source_url:isHttpsSource(rawRow.source_url),
   source_title:String(rawRow.source_title||"").trim()||null,
   status:"draft",
   review_checks:{answer:false,distractors:false,explanation:false,metadata:false,duplicates:false},
   reviewed_by:null,reviewed_at:null,created_by:user.id
  };
  entry.item=item;
  entry.issues=validate(item,"draft");
  if(rawRow.difficulty&&!["easy","medium","hard"].includes(rawDifficulty))entry.issues.push("Difficulty must be easy, medium or hard.");
  if(rawRow.source_url&&!item.source_url)entry.issues.push("Optional source URL must use HTTPS.");
  if(item.wrong_options.length!==3||item.wrong_options.some(x=>!x))entry.issues.push("Provide exactly three non-empty wrong options.");
  if(new Set([item.correct_answer,...item.wrong_options].map(x=>x.toLocaleLowerCase())).size!==4)entry.issues.push("The correct answer and three wrong options must be distinct.");
  if(entry.issues.length){entry.state="invalid";preview.push(entry);return;}
  const key=normaliseQuestionKey(item.subject)+"|"+normaliseQuestionKey(item.question_text);
  if(known.has(key)){
   const match=known.get(key);
   entry.state="duplicate";
   entry.duplicateOf=(match.subject||"")+(match.status?" · "+match.status:"");
   entry.warnings.push("Exact match already exists in the question bank.");
   preview.push(entry);return;
  }
  if(seen.has(key)){
   entry.state="duplicate";
   entry.duplicateOf="Earlier row in this import";
   entry.warnings.push("Same subject and question already appears earlier in this file.");
   preview.push(entry);return;
  }
  seen.add(key);
  const subjectKey=normaliseQuestionKey(item.subject);
  const nearExisting=existing.find(row=>normaliseQuestionKey(row.subject)===subjectKey&&similarScore(row.question_text,item.question_text)>=0.86);
  const nearEarlier=preview.find(row=>row.item&&normaliseQuestionKey(row.item.subject)===subjectKey&&similarScore(row.item.question_text,item.question_text)>=0.86);
  if(nearExisting){
   entry.state="similar";
   entry.duplicateOf="Similar saved question: "+String(nearExisting.question_text||"").slice(0,110);
   entry.warnings.push("Similar wording detected. Confirm it is not a duplicate before formal review.");
  }else if(nearEarlier){
   entry.state="similar";
   entry.duplicateOf="Similar to row "+nearEarlier.row+" in this import";
   entry.warnings.push("Similar wording detected in this file. Check both records before formal review.");
  }else entry.state="ready";
  preview.push(entry);
 });
 bulkPreview=preview;
 paintBulkPreview();
 status("Preview ready. Only eligible rows can be imported, and every imported record will be saved as a draft.");
}
function csvCell(value){
 const textValue=String(value??"");
 return '"'+textValue.replace(/"/g,'""')+'"';
}
function exportBulkReport(){
 if(!bulkPreview.length)return;
 const header=["row","result","subject","topic","question","correct_answer","wrong_options","explanation","difficulty","source_title","source_url","duplicate_or_similar_to","validation_issues","warnings"];
 const lines=[header.map(csvCell).join(",")];
 bulkPreview.forEach(x=>{
  const d=x.item||{};
  lines.push([x.row,x.state,d.subject,d.topic,d.question_text,d.correct_answer,(d.wrong_options||[]).join(" | "),d.explanation,d.difficulty,d.source_title,d.source_url,x.duplicateOf,(x.issues||[]).join(" | "),(x.warnings||[]).join(" | ")].map(csvCell).join(","));
 });
 const blob=new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download="aspirants-desk-question-import-review.csv";
 document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
}
async function importBulk(){
 const result=$("qReviewBulkResult");
 const prepared=bulkPreview.filter(x=>x.state==="ready"||x.state==="similar");
 if(!bulkPreview.length){status("Preview the JSON file before importing.","mock-warning");return;}
 if(!prepared.length){status("No eligible questions are available. Correct invalid rows or remove duplicates.","mock-warning");return;}
 $("qReviewBulkImport").disabled=true;
 let inserted=0,failed=0;
 for(let i=0;i<prepared.length;i+=20){
  const batch=prepared.slice(i,i+20);
  const response=await sb.from("practice_question_bank").insert(batch.map(x=>x.item));
  if(!response.error){
   inserted+=batch.length;
   batch.forEach(x=>x.state="imported");
   continue;
  }
  for(const entry of batch){
   const one=await sb.from("practice_question_bank").insert(entry.item);
   if(one.error){failed++;entry.state="failed";entry.issues.push(one.error.code==="23505"?"Duplicate appeared after preview; database rejected it.":one.error.message);}
   else{inserted++;entry.state="imported";}
  }
 }
 paintBulkPreview();
 result.textContent="Imported "+inserted+" draft(s) · duplicates skipped "+bulkPreview.filter(x=>x.state==="duplicate").length+" · invalid skipped "+bulkPreview.filter(x=>x.state==="invalid").length+" · failed "+failed+". Export the report to retain these results.";
 status("Bulk import completed. Imported questions remain drafts and are not visible to learners.");
 await load();
}
function resetEditor(){
 activeId=null;
 $("qReviewEditorTitle").textContent="Create practice question";
 $("qReviewForm").reset();
 CHECKS.forEach(k=>$("qReviewCheck_"+k).checked=false);
 $("qReviewRecordMeta").textContent="New question · saved as draft until reviewed";
 $("qReviewHistory").innerHTML='<p class="mock-save">Open a saved question to see its version history and activity.</p>';
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
 CHECKS.forEach(k=>{$("qReviewCheck_"+k).checked=Boolean(row.review_checks?.[k]);});
 $("qReviewRecordMeta").textContent="Status: "+row.status+" · Updated "+new Date(row.updated_at||row.created_at).toLocaleString();
 $("qReviewEditor").scrollIntoView({behavior:"smooth",block:"start"});
 loadHistory();
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
 $("qReviewBulkPreviewBtn").addEventListener("click",previewBulk);
 $("qReviewBulkImport").addEventListener("click",importBulk);
 $("qReviewBulkExport").addEventListener("click",exportBulkReport);
 $("qReviewBulkJson").addEventListener("input",()=>resetBulkPreview("Input changed. Preview again before importing."));
 $("qReviewBulkFile").addEventListener("change",async event=>{const file=event.target.files&&event.target.files[0];if(!file)return;try{$("qReviewBulkJson").value=await file.text();resetBulkPreview("File loaded. Choose Preview import to validate every row.");status("Loaded "+file.name+". Preview it before importing.");}catch(error){status("Could not read that file: "+error.message,"mock-warning");}});
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