(function(){
"use strict";
const host=document.getElementById("pressContainer");
if(!host)return;
const rules=[
{key:"gs2",label:"GS II · Polity & Governance",re:/constitution|parliament|court|judicial|election|governance|scheme|welfare|rights|policy|federal|panchayat|municipal|ministry|cabinet|public service|health|education|women|child|minority|social justice|administration|diplomacy|bilateral|treaty|foreign affairs/i},
{key:"gs3",label:"GS III · Economy, Environment & Security",re:/econom|budget|tax|trade|manufactur|industry|agri|farmer|crop|bank|inflation|employment|infrastructure|energy|climate|forest|wildlife|pollution|water|disaster|technology|cyber|space|defence|security|startup|investment/i},
{key:"gs1",label:"GS I · Society, History & Geography",re:/society|social|caste|tribe|tribal|migration|urban|rural|culture|heritage|history|historical|geography|population|demograph|language|religion|festival|tourism|monument/i},
{key:"gs4",label:"GS IV · Ethics & Integrity",re:/ethic|integrity|corruption|transparen|accountab|probity|conflict of interest|civil servant|public trust|human values/i}
];
const anthropology=/tribe|tribal|community|kinship|marriage|family|custom|culture|caste|indigenous|ethn|livelihood|displacement|migration|heritage|language|religion|population|health|nutrition|social change/i;
const $=id=>document.getElementById(id);
let active="all",query="",enhanced=false;
function classify(text){
const found=rules.filter(r=>r.re.test(text));
return {papers:found.map(x=>x.key),labels:found.map(x=>x.label),anthro:anthropology.test(text)};
}
function node(tag,cls,txt){const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el;}
function makeToolbar(cards){
const bar=node("div","press-intel-toolbar");
const top=node("div","press-intel-topline");
const heading=node("div");
heading.append(node("span","eyebrow","DAILY CURRENT AFFAIRS · STUDY MODE"),node("h3","press-intel-heading","Turn headlines into syllabus-linked learning"));
const count=node("span","press-intel-count",cards.length+" feed items");
top.append(heading,count);bar.append(top);
const filters=node("div","press-intel-filters");filters.setAttribute("role","group");filters.setAttribute("aria-label","Filter current affairs");
[["all","All items"],["gs1","GS I"],["gs2","GS II"],["gs3","GS III"],["gs4","GS IV"],["anthro","Anthropology"],["unmapped","Needs review"]].forEach(([key,label])=>{const b=node("button","press-intel-filter"+(key==="all"?" active":""),label);b.type="button";b.dataset.pressFilter=key;b.setAttribute("aria-pressed",String(key==="all"));filters.append(b);});
const searchWrap=node("label","press-intel-search");searchWrap.append(node("span","","Search headlines or topics"));const search=node("input");search.type="search";search.id="pressIntelSearch";search.placeholder="e.g. agriculture, federalism, tribal development";search.autocomplete="off";searchWrap.append(search);
bar.append(filters,searchWrap);
const note=node("p","press-intel-disclaimer","Syllabus links below are suggested study classifications based on headline and feed text, not official UPSC topic tags. Verify facts, figures and policy details in the linked original source.");
bar.append(note);return bar;
}
function addStudyLens(card,item){
const text=item.textContent||"",meta=classify(text);
card.dataset.pressPapers=meta.papers.join(",");
card.dataset.pressAnthro=String(meta.anthro);
card.dataset.pressSearch=text.toLowerCase();
const sourceLine=card.querySelector("p.muted");
const lens=node("div","press-intel-lens");
const label=node("span","press-intel-lens-label","SUGGESTED SYLLABUS LENS");
const chips=node("div","press-intel-chips");
if(meta.labels.length){meta.labels.forEach(x=>chips.append(node("span","press-intel-chip",x)));}
else chips.append(node("span","press-intel-chip neutral","Not classified yet · review manually"));
if(meta.anthro)chips.append(node("span","press-intel-chip anthro","Anthropology connection"));
lens.append(label,chips);
const details=node("details","press-intel-study");
const summary=node("summary","","Open study prompts");
const body=node("div","press-intel-study-body");
const source=node("p","", "Fact check: open the original source and note the issuing institution, date, legal or policy basis, affected groups and any figures. Do not rely on the headline alone.");
const prelim=node("p");const pb=node("b","","Prelims check: ");prelim.append(pb,document.createTextNode("Identify the relevant constitutional provision, institution, scheme, report, location or technical term. Verify it from an official document."));
const mains=node("p");mains.append(node("b","","Mains practice: "),document.createTextNode("What is the underlying issue? Explain its causes, effects, implementation challenges and a balanced way forward."));
body.append(source,prelim,mains);
if(meta.anthro){const a=node("p");a.append(node("b","","Anthropology lens: "),document.createTextNode("Consider culture, social organisation, community perspectives, identity, adaptation and the ethical implications for affected populations. Use only where the source genuinely relates to these themes."));body.append(a);}
details.append(summary,body);lens.append(details);
if(sourceLine)sourceLine.insertAdjacentElement("afterend",lens);else card.append(lens);
}
function apply(){
const cards=[...host.querySelectorAll(".grid-2 > article")];
let shown=0;
cards.forEach(card=>{
const text=card.dataset.pressSearch||"",papers=(card.dataset.pressPapers||"").split(",");
const passFilter=active==="all"||(active==="anthro"&&card.dataset.pressAnthro==="true")||(active==="unmapped"&&!papers.filter(Boolean).length)||(papers.includes(active));
const passSearch=!query||text.includes(query);
card.hidden=!(passFilter&&passSearch);if(!card.hidden)shown++;
});
const status=$("pressIntelResultCount");if(status)status.textContent="Showing "+shown+" of "+cards.length+" items";
}
function enhance(){
if(enhanced)return;
const grid=host.querySelector(".grid-2");
if(!grid)return;
const cards=[...grid.querySelectorAll(":scope > article")];
if(!cards.length)return;
cards.forEach(card=>{if(!card.dataset.pressEnhanced){card.dataset.pressEnhanced="1";addStudyLens(card,card);}});
const bar=makeToolbar(cards);
host.insertBefore(bar,grid);
const status=node("p","press-intel-result-count");status.id="pressIntelResultCount";grid.insertAdjacentElement("beforebegin",status);
host.querySelectorAll("[data-press-filter]").forEach(button=>button.addEventListener("click",()=>{
active=button.dataset.pressFilter;
host.querySelectorAll("[data-press-filter]").forEach(b=>{const on=b===button;b.classList.toggle("active",on);b.setAttribute("aria-pressed",String(on));});
apply();
}));
const input=$("pressIntelSearch");if(input)input.addEventListener("input",()=>{query=input.value.trim().toLowerCase();apply();});
enhanced=true;apply();
}
const observer=new MutationObserver(()=>{if(!enhanced)enhance();});
observer.observe(host,{childList:true,subtree:true});
enhance();
})();