/** The overview embeds two isolated apps. Each retains its own sidebar and state. */
export function installEmbedControls(){
 if(new URLSearchParams(location.search).get('embed')!=='1')return;
 document.documentElement.classList.add('embedded');
 const notify=()=>parent.postMessage({type:'atlas-embed-state',url:location.href},location.origin);
 for(const method of ['replaceState','pushState']){
  const original=history[method].bind(history);
  history[method]=function(...args){const result=original(...args);notify();return result};
 }
 addEventListener('popstate',notify);
 addEventListener('pageshow',notify);
 const sidebar=document.querySelector('.sidebar');if(!sidebar)return;
 sidebar.id='embedded-filters';
 const button=document.createElement('button');button.type='button';button.className='embed-filter-toggle';
 button.setAttribute('aria-controls',sidebar.id);button.setAttribute('aria-expanded','false');
 function update(){const open=document.documentElement.classList.contains('filters-open');button.textContent=open?'Karte zeigen':'Filter & Liste';button.setAttribute('aria-expanded',String(open))}
 button.addEventListener('click',()=>{document.documentElement.classList.toggle('filters-open');update()});
 document.body.append(button);update();
}
