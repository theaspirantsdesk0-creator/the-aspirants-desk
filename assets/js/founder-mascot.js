(function(){
"use strict";
const root=document.getElementById("tadFounderMascot");if(!root)return;
const role=root.querySelector("[data-mascot-role]");
let timer=null;
function blink(){root.classList.add("is-blinking");window.setTimeout(()=>root.classList.remove("is-blinking"),180);}
function start(){if(timer||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;timer=window.setInterval(blink,3600);}
function stop(){if(timer){window.clearInterval(timer);timer=null;}}
if(role)role.textContent="Anbu · Aspirant | IAS · IPS · IRS";
root.dataset.role="mascot-casual";
root.addEventListener("click",()=>root.classList.toggle("mascot-expanded"));
document.addEventListener("visibilitychange",()=>document.hidden?stop():start());
start();
})();