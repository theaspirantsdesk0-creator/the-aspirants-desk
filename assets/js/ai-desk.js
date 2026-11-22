(function(){
  "use strict";
  const url=window.DESK_SUPABASE_URL||"";
  const key=window.DESK_SUPABASE_ANON_KEY||"";
  if(!window.supabase||!url||!key)return;
  const client=window.supabase.createClient(url,key);
  const launcher=document.createElement("button");
  launcher.id="tadAiLauncher";launcher.type="button";launcher.textContent="✦ AI Desk";
  launcher.setAttribute("aria-label","Open AI Desk");
  const panel=document.createElement("section");panel.id="tadAiPanel";panel.setAttribute("aria-label","AI Desk assistant");
  panel.innerHTML='<header id="tadAiHead"><div><strong>The Aspirant’s Desk · AI</strong><small id="tadAiRole">Checking your account…</small></div><button id="tadAiClose" type="button" aria-label="Close">×</button></header><div id="tadAiMessages" aria-live="polite"></div><div id="tadAiStatus">Sign in to start. Daily limit: 20 messages.</div><form id="tadAiForm"><textarea id="tadAiInput" rows="2" maxlength="6000" placeholder="Ask a study question…" aria-label="Your message"></textarea><button id="tadAiSend" type="submit">Send</button></form>';
  document.body.append(launcher,panel);
  const messages=panel.querySelector("#tadAiMessages"),status=panel.querySelector("#tadAiStatus"),roleLabel=panel.querySelector("#tadAiRole"),input=panel.querySelector("#tadAiInput"),send=panel.querySelector("#tadAiSend");
  let role="guest",history=[],busy=false;
  function addMessage(text,who){const el=document.createElement("div");el.className="tad-ai-msg "+(who==="user"?"tad-ai-user":"tad-ai-assistant");el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;}
  async function refresh(){
    const {data:{session}}=await client.auth.getSession();
    if(!session){role="guest";roleLabel.textContent="Sign in required";status.textContent="Please sign in to use AI Desk.";return;}
    const {data:profile,error}=await client.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
    role=!error&&profile&&["learner","mentor","admin"].includes(profile.role)?profile.role:"guest";
    roleLabel.textContent=role==="guest"?"Role unavailable":role.charAt(0).toUpperCase()+role.slice(1)+" assistant";
    status.textContent=role==="guest"?"Your account role could not be verified.": "Daily limit: 20 messages. Avoid sharing personal or confidential information.";
    if(role!=="guest"&&messages.childElementCount===0)addMessage(role==="admin"?"Admin Desk ready. I can draft MCQs, notes and source-based current-affairs angles. Drafts require human verification.":role==="mentor"?"Mentor Desk ready. Share de-identified progress summaries for study plans and feedback.":"Study Desk ready. Ask a doubt, request an explanation, or practise a topic.","assistant");
  }
  launcher.addEventListener("click",()=>{panel.classList.toggle("open");if(panel.classList.contains("open"))refresh();});
  panel.querySelector("#tadAiClose").addEventListener("click",()=>panel.classList.remove("open"));
  panel.querySelector("#tadAiForm").addEventListener("submit",async e=>{
    e.preventDefault();const message=input.value.trim();if(!message||busy)return;
    if(role==="guest"){status.textContent="Sign in with an account that has an assigned learner, mentor or admin role.";return;}
    busy=true;send.disabled=true;input.value="";addMessage(message,"user");
    try{
      const {data,error}=await client.functions.invoke("ai-assistant",{body:{message,history}});
      if(error)throw error;
      if(!data||!data.answer)throw new Error(data&&data.error||"No response received.");
      addMessage(data.answer,"assistant");history.push({role:"user",content:message},{role:"assistant",content:data.answer});history=history.slice(-8);
      status.textContent=(data.provider||"AI")+" · "+(data.remaining??"—")+" messages remaining today.";
    }catch(err){const text=err&&err.message?err.message:"AI Desk request failed.";addMessage(text,"assistant");status.textContent="Request could not be completed. Check your connection or try later.";}
    finally{busy=false;send.disabled=false;input.focus();}
  });
  client.auth.onAuthStateChange(()=>{role="guest";history=[];messages.replaceChildren();queueMicrotask(()=>refresh().catch(()=>{status.textContent="Could not refresh your account. Reload and sign in again."; }));});
  refresh();
})();