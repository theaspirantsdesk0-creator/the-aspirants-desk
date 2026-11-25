(function(){
  "use strict";
  const $ = id => document.getElementById(id);
  const pairs = [["kpiHours","homeStudyHours"],["kpiSyllabus","homeSyllabusProgress"],["kpiLastScore","homeLatestScore"],["learningHubProgress","homeLearningProgress"]];
  function syncMetrics(){pairs.forEach(([source,target])=>{const from=$(source),to=$(target);if(from&&to)to.textContent=(from.textContent||"").trim()||"—";});}
  async function loadVerifiedCoverage(){
    const host=$("homeVerifiedDocsStatus");if(!host)return;
    try{
      const response=await fetch("data/pyq/verified-documents.json",{cache:"no-store"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const payload=await response.json();
      const docs=Array.isArray(payload.documents)?payload.documents.filter(doc=>doc.status==="verified"&&/^https:\/\/(?:www\.)?upsc\.gov\.in\//.test(doc.document_url||"")):[];
      host.textContent=docs.length+" official UPSC PDFs currently verified. Open the archive to view the paper list.";
    }catch(_){host.textContent="Verified paper totals are temporarily unavailable.";}
  }
  function init(){
    syncMetrics();
    pairs.forEach(([source])=>{const node=$(source);if(node&&"MutationObserver"in window)new MutationObserver(syncMetrics).observe(node,{childList:true,subtree:true,characterData:true});});
    window.addEventListener("tad:learningHubChange",syncMetrics);
    window.addEventListener("tad:learningHubLoaded",syncMetrics);
    loadVerifiedCoverage();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();