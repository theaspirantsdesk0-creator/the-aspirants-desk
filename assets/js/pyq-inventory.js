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
  let page = 0, rows = [], verifiedDocuments = [];
  const labels = { verified: "Verified", published: "Published", source_found: "Source found · not verified", not_checked: "Not checked" };

  function addOption(select, value, label) {
    const node = document.createElement("option"); node.value = value; node.textContent = label; select.append(node);
  }
  function addCell(row, value) {
    const node = document.createElement("td"); node.textContent = value || "—"; row.append(node);
  }
  function ensureSourceColumn() {
    const table = host.closest("table");
    const header = table && table.querySelector("thead tr");
    if (header && !header.querySelector("[data-pyq-source-heading]")) {
      const th = document.createElement("th");
      th.scope = "col";
      th.dataset.pyqSourceHeading = "true";
      th.textContent = "Official paper";
      header.append(th);
    }
  }
  function paperNumber(value) {
    const match = String(value || "").match(/paper\s*(i{1,3}|iv|v|1|2|3|4|5)/i);
    return match ? match[1].toUpperCase() : (String(value || "").toLowerCase().includes("essay") ? "ESSAY" : "");
  }
  function officialDocumentFor(item) {
    return verifiedDocuments.find(doc => {
      if (!doc || doc.status !== "verified" || !doc.document_url || Number(doc.year) !== Number(item.year)) return false;
      if (String(doc.stage || "").toLowerCase() !== String(item.stage || "").toLowerCase()) return false;
      const itemOptional = String(item.optional_subject || "").trim().toLowerCase();
      const docOptional = String(doc.subject || doc.optional_subject || "").trim().toLowerCase();
      if (itemOptional && itemOptional !== docOptional) return false;
      const itemPaper = paperNumber(item.paper);
      const docPaper = paperNumber(doc.paper);
      if (itemPaper && docPaper && itemPaper !== docPaper) return false;
      if (!itemPaper && !docPaper && String(item.paper || "").toLowerCase() !== String(doc.paper || "").toLowerCase()) return false;
      try {
        const url = new URL(doc.document_url);
        return url.protocol === "https:" && (url.hostname === "upsc.gov.in" || url.hostname === "www.upsc.gov.in");
      } catch (_) { return false; }
    }) || null;
  }
  function addSourceCell(row, item) {
    const td = document.createElement("td");
    const doc = officialDocumentFor(item);
    if (doc) {
      const link = document.createElement("a");
      link.href = doc.document_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open official PDF";
      link.setAttribute("aria-label", "Open official UPSC paper: " + (doc.title || item.paper));
      td.append(link);
    } else {
      const note = document.createElement("span");
      note.textContent = "Not yet verified";
      note.className = "pyq-source-pending";
      td.append(note);
    }
    row.append(td);
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
      const tr=document.createElement("tr"),td=document.createElement("td"); td.colSpan=6;
      td.textContent="No paper records match these filters. Try a different year, stage, status or search term.";
      tr.append(td);host.append(tr);
    } else shown.forEach(item => {
      const tr=document.createElement("tr");
      addCell(tr,String(item.year)); addCell(tr,item.stage); addCell(tr,item.paper); addCell(tr,item.optional_subject || "—");
      const td=document.createElement("td"),badge=document.createElement("span");
      badge.className="pyq-status pyq-status-"+(labels[item.status]?item.status:"unknown");
      badge.textContent=labels[item.status]||"Unknown status";td.append(badge);tr.append(td);
      addSourceCell(tr,item);host.append(tr);
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

  ensureSourceColumn();
  Promise.all([
    fetch("data/pyq/documents.json",{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error("Inventory unavailable ("+response.status+")");return response.json();}),
    fetch("data/pyq/verified-documents.json",{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error("Verified document index unavailable ("+response.status+")");return response.json();})
  ]).then(([data,verified])=>{
    rows=Array.isArray(data.documents)?data.documents.filter(item=>item&&Number.isInteger(Number(item.year))&&item.stage&&item.paper):[];
    verifiedDocuments=Array.isArray(verified.documents)?verified.documents:[];
    ensureSourceColumn();
    [...new Set(rows.map(item=>String(item.year)))].sort((a,b)=>Number(b)-Number(a)).forEach(value=>addOption(controls.year,value,value));
    [...new Set(rows.map(item=>item.stage))].sort().forEach(value=>addOption(controls.stage,value,value));
    [...new Set(rows.map(item=>item.optional_subject).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).forEach(value=>addOption(controls.subject,value,value));
    render();
  }).catch(error=>{
    host.replaceChildren();const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=6;
    td.textContent="The paper inventory could not load. Please refresh or use the official UPSC archive links.";
    tr.append(td);host.append(tr);controls.total.textContent="Tracker unavailable";
    controls.summary.textContent="Paper status totals are unavailable.";console.warn("PYQ coverage explorer:",error);
  });
})();