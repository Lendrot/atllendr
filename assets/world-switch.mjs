/** Shared atlas navigation. Swipe the tabs or explicit edge handles; globe drag stays rotation. */
export const worlds=[{id:'atlas',url:'/atlas/',label:'Gesamtatlas'},{id:'mines',url:'/minen/',label:'Rohstoffwelt'}];
export function swipeDirection(dx,dy){return Math.abs(dx)>=65&&Math.abs(dy)<=Math.abs(dx)*.55?(dx<0?1:-1):0;}
export function installWorldSwitch({host,active}){
 const root=document.getElementById(host);if(!root)return;
 const index=Math.max(0,worlds.findIndex(w=>w.id===active));
 root.innerHTML=`<nav class="world-switch" aria-label="Globuswelten">${worlds.map(w=>`<a href="${w.url}" ${active===w.id?'aria-current="page"':''}>${w.label}</a>`).join('')}<a href="/kupfer/">Kupfer · Intelligence</a></nav>`;
 const space=root.closest('.space');if(!space)return;
 for(const dir of [-1,1]){
  const w=worlds[(index+dir+worlds.length)%worlds.length],edge=document.createElement('a');
  edge.className='world-swipe-edge '+(dir<0?'left':'right');edge.href=w.url;edge.setAttribute('aria-label',w.label+' öffnen');edge.textContent=dir<0?'‹':'›';space.append(edge);
 }
 let start=null;
 space.addEventListener('touchstart',e=>{start=e.touches.length===1&&e.target.closest('.world-switch,.world-swipe-edge')?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});
 space.addEventListener('touchend',e=>{if(!start||!e.changedTouches.length)return;const t=e.changedTouches[0],dir=swipeDirection(t.clientX-start.x,t.clientY-start.y);start=null;if(dir)location.assign(worlds[(index+dir+worlds.length)%worlds.length].url)},{passive:true});
 space.addEventListener('touchcancel',()=>{start=null},{passive:true});
}
