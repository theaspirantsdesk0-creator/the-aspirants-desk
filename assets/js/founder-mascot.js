(function(){
"use strict";
const root=document.getElementById("tadFounderMascot");if(!root)return;
const roles=[{name:"Anbu · Aspirant",className:"mascot-casual"},{name:"IAS Officer",className:"mascot-ias"},{name:"IPS Officer",className:"mascot-ips"},{name:"IRS Officer",className:"mascot-irs"}];
let index=0,timer=null;
const role=root.querySelector("[data-mascot-role]");
function show(next){index=(next+roles.length)%roles.length;root.dataset.role=roles[index].className;role.textContent=roles[index].name;}
function blink(){root.classList.add("is-blinking");window.setTimeout(()=>{root.classList.remove("is-blinking");show(index+1)},180)}
function start(){if(timer||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;timer=window.setInterval(blink,3600)}
function stop(){if(timer){window.clearInterval(timer);timer=null}}
root.addEventListener("click",()=>{stop();show(index+1);root.classList.toggle("mascot-expanded");if(!root.classList.contains("mascot-expanded"))start()});
root.addEventListener("keydown",e=>{if(e.key==="Escape"){root.classList.remove("mascot-expanded");start()}});
document.addEventListener("visibilitychange",()=>document.hidden?stop():start());
show(0);start();
})();