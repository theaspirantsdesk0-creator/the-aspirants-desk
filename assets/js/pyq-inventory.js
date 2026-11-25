(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const host = $("pyqTrackerRows");
  if (!host) return;
  const controls = {
    search: $("pyqTrackerSearch"), year: $("pyqTrackerYear"), stage: $("pyqTrackerStage"), subject: $("pyqTrackerSubject"),
    status: $("pyqTrackerStatus"), total: $("pyqExplorerTotal"), summary: $("pyqTrackerSummary"),
    pageInfo: $("pyqTrackerPageInfo"), prev: $("pyqTrackerPrev"), next: $("pyqTrackerNext")
  };
  const pageSize = 25;
  let page = 0, rows = [];
  const labels = { verified: "Verified", published: "Published", source_found: "Source found · not verified", not_checked: "Not checked" };
  function addOption(select, value, label) {
    const node = document.createElement("option"); node.value = value; node.textContent = label; select.append(node);
  }
  function addCell(row, value) {
    const node = document.createElement("td"); node.textContent = value || "—"; row.append(node);
  }
  function filteredRows() {
    const term = controls.search.value.trim().toLowerCase();
    return rows.filter(item => {
      const haystack = [item.year,item.stage,item.paper,item.optional_subject,item.optional_category].filter(Boolean).join(" ").toLowerCase();
      return (controls.year.value === "ALL" || String(item.year) === controls.year.value) &&
        (controls.stage.value === "ALL" || item.stage === controls.stage.value) &&
        (controls.subject.value === "ALL" || item.optional_subject === controls.subject.value) &&
        (controls.status.value === "ALL" || item.status === controls.status.value) &&
        (!term || haystack.includes(term));
    });
  }
  function render() {
    const filtered = filteredRows(), start = page * pageSize, shown = filtered.slice(start,start+pageSize);
    host.replaceChildren();
    if (!shown.length) {
      const tr=document.createElement("tr"),td=document.createElement("td"); td.colSpan=5;
      td.textContent="No paper records match these filters. Try a different year, stage, status or search term.";
      tr.append(td);host.append(tr);
    } else shown.forEach(item => {
      const tr=document.createElement("tr");
      addCell(tr,String(item.year)); addCell(tr,item.stage); addCell(tr,item.paper); addCell(tr,item.optional_subject || "—");
      const td=document.createElement("td"),badge=document.createElement("span");
      badge.className="pyq-status pyq-status-"+(labels[item.status]?item.status:"unknown");
      badge.textContent=labels[item.status]||"Unknown status";td.append(badge);tr.append(td);host.append(tr);
    });
    const verified=rows.filter(x=>["verified","published"].includes(x.status)).length;
    const published=rows.filter(x=>x.status==="published").length;
    const found=rows.filter(x=>x.status==="source_found").length;
    const unchecked=rows.filter(x=>x.status==="not_checked").length;
    controls.total.textContent=rows.length.toLocaleString()+" planned paper records";
    controls.summary.replaceChildren();
    [[verified,"Verified"],[published,"Published questions"],[found,"Source found · pending checks"],[unchecked,"Not checked"]].forEach(([count,label])=>{
      const card=document.createElement("span"),strong=document.createElement("b"),small=document.createElement("small");
      strong.textContent=Number(count).toLocaleString();small.textContent=label;card.append(strong,small);controls.summary.append(card);
    });
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
    controls.pageInfo.textContent=filtered.length?"Showing "+(start+1)+"–"+Math.min(start+pageSize,filtered.length)+" of "+filtered.length.toLocaleString()+" matching records · page "+(page+1)+" of "+pages:"0 matching records";
    controls.prev.disabled=page<=0;controls.next.disabled=page>=pages-1;
  }
  function resetPage(){page=0;render();}
  controls.search.addEventListener("input",resetPage);
  [controls.year,controls.stage,controls.subject,controls.status].forEach(node=>node.addEventListener("change",resetPage));
  controls.prev.addEventListener("click",()=>{page=Math.max(0,page-1);render();});
  controls.next.addEventListener("click",()=>{page+=1;render();});
  fetch("data/pyq/documents.json",{cache:"no-store"})
    .then(response=>{if(!response.ok)throw new Error("Inventory unavailable ("+response.status+")");return response.json();})
    .then(data=>{
      rows=Array.isArray(data.documents)?data.documents.filter(item=>item&&Number.isInteger(Number(item.year))&&item.stage&&item.paper):[];
      [...new Set(rows.map(item=>String(item.year)))].sort((a,b)=>Number(b)-Number(a)).forEach(value=>addOption(controls.year,value,value));
      [...new Set(rows.map(item=>item.stage))].sort().forEach(value=>addOption(controls.stage,value,value));
      [...new Set(rows.map(item=>item.optional_subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).forEach(value=>addOption(controls.subject,value,value));
      render();
    })
    .catch(error=>{
      host.replaceChildren();const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=5;
      td.textContent="The paper inventory could not load. Please refresh or use the official UPSC archive links.";
      tr.append(td);host.append(tr);controls.total.textContent="Tracker unavailable";
      controls.summary.textContent="Paper status totals are unavailable.";console.warn("PYQ coverage explorer:",error);
    });
})();