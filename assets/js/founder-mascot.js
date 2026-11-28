(function(){
"use strict";
const root=document.getElementById("tadFounderMascot");if(!root)return;
const role=root.querySelector("[data-mascot-role]");
let timer=null,blinkTimeout=null;
function blink(){root.classList.add("is-blinking");if(blinkTimeout)window.clearTimeout(blinkTimeout);blinkTimeout=window.setTimeout(()=>{root.classList.remove("is-blinking");blinkTimeout=null;},180);}
function start(){if(timer||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;timer=window.setInterval(blink,3600);}
function stop(){if(timer){window.clearInterval(timer);timer=null;}if(blinkTimeout){window.clearTimeout(blinkTimeout);blinkTimeout=null;root.classList.remove("is-blinking");}}
if(role)role.textContent="Anbu · Aspirant | IAS · IPS · IRS";
root.dataset.role="mascot-casual";
root.addEventListener("click",()=>{const expanded=root.classList.toggle("mascot-expanded");root.setAttribute("aria-expanded",String(expanded));root.setAttribute("aria-label",expanded?"Anbu founder mascot. Tap to collapse":"Anbu founder mascot. Tap to expand");});
document.addEventListener("visibilitychange",()=>document.hidden?stop():start());
start();
})();