(function () {
  "use strict";
  const KEY = "tad.learningHub.v1";
  const tracks = [
    { id:"foundations", title:"Foundational learning", tag:"Build strong basics", items:["Choose one subject and write what you already know","Study one NCERT chapter and make a one-page summary","Explain the topic in your own words","Attempt a short recall quiz without looking at notes"] },
    { id:"exams", title:"Competitive examinations", tag:"UPSC · TNPSC · SSC · Banking", items:["Read the official syllabus for your chosen examination","Map the syllabus into small topics","Solve a short practice set and review every error","Check the official notification and previous papers"] },
    { id:"communication", title:"Communication & writing", tag:"Think clearly. Write clearly.", items:["Read one reliable article and identify its main argument","Write a 150-word summary in simple language","Practise one structured answer with an introduction and conclusion","Review clarity, evidence and grammar"] },
    { id:"research", title:"Research & critical thinking", tag:"Evidence before conclusions", items:["Turn a broad topic into one focused research question","Find two primary or authoritative sources","Separate verified facts, interpretation and opinion","Record source links and unresolved questions"] },
    { id:"digital", title:"Digital & technology skills", tag:"Practical digital literacy", items:["Organise files with clear names and folders","Learn spreadsheet basics: sort, filter and simple formulas","Understand passwords, phishing and privacy settings","Build a small project and document how it works"] },
    { id:"ai", title:"AI literacy & responsible use", tag:"Use AI with judgement", items:["Learn what AI systems can and cannot reliably do","Check an AI-generated factual claim against a trusted source","Avoid entering passwords or private personal data into prompts","Use AI to practise, explain and critique—not to replace your own thinking"] }
  ];
  const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function readState() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (_) { return {}; } }
  function saveState(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function render() {
    const host = document.getElementById("learningHubTracks");
    if (!host) return;
    const state = readState();
    let total = 0, done = 0;
    host.innerHTML = tracks.map(track => {
      const completed = state[track.id] || [];
      total += track.items.length; done += track.items.filter((_, i) => completed.includes(i)).length;
      return '<article class="card" style="padding:1rem"><span class="pill">'+escapeHTML(track.tag)+'</span><h3>'+escapeHTML(track.title)+'</h3><div class="learning-hub-tasks">'+track.items.map((item, i) => {
        const checked = completed.includes(i);
        return '<label style="display:flex;gap:.6rem;align-items:flex-start;margin:.65rem 0;color:var(--ink);font-weight:500"><input type="checkbox" data-track="'+track.id+'" data-task="'+i+'" '+(checked?'checked':'')+' style="margin-top:.2rem;flex:none"><span>'+escapeHTML(item)+'</span></label>';
      }).join("")+'</div></article>';
    }).join("");
    const percent = total ? Math.round(done / total * 100) : 0;
    const value = document.getElementById("learningHubProgress");
    const bar = document.getElementById("learningHubProgressBar");
    if (value) value.textContent = percent + "%";
    if (bar) bar.style.width = percent + "%";
  }
  document.addEventListener("change", event => {
    const input = event.target.closest('#learningHubTracks input[data-track][data-task]');
    if (!input) return;
    const state = readState(), id = input.dataset.track, task = Number(input.dataset.task);
    state[id] = Array.isArray(state[id]) ? state[id] : [];
    state[id] = input.checked ? [...new Set([...state[id], task])] : state[id].filter(x => x !== task);
    saveState(state); render();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, {once:true});
  else render();
})();
