/** Keep the two embedded apps independent while making their filters reloadable. */
const paths={left:'/atlas/',right:'/minen/'};
const frames=Object.fromEntries(Object.keys(paths).map(key=>[key,document.querySelector(`[data-world="${key}"]`)]));
const params=new URLSearchParams(location.search);
for(const [key,path] of Object.entries(paths)){
 const query=new URLSearchParams(params.get(key)||'');
 query.set('embed','1');
 frames[key].src=path+'?'+query;
}
addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.type!=='atlas-embed-state')return;
 const key=Object.keys(frames).find(name=>frames[name].contentWindow===event.source);
 if(!key)return;
 let child;
 try{child=new URL(event.data.url)}catch{return}
 if(child.origin!==location.origin||child.pathname!==paths[key])return;
 const query=new URLSearchParams(child.search);
 query.delete('embed');
 const url=new URL(location.href);
 if(query.size)url.searchParams.set(key,query.toString());else url.searchParams.delete(key);
 if(url.href!==location.href)history.replaceState(null,'',url);
});
