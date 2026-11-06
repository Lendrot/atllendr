// Leitet Root-Pfad-Anfragen der Atlas-Seiten auf /atllendr/ um (Daten bleiben byte-identisch).
// Version = Quell-Commit; jede Aenderung hier loest im Browser ein Service-Worker-Update aus.
const V='bbe79440a5e14e69ecf6a83956a8a2fabce98497';
const P='/atllendr';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
// Grosse statische Binaerdateien (Erdmodell, Texturen, Bilder, Schriften, three.js) kommen sofort aus dem Cache und
// werden im Hintergrund mit dem Server abgeglichen (stale-while-revalidate). GitHub Pages erlaubt nur max-age=600;
// so laedt ein Wiederbesuch das Erdmodell nicht neu. Daten (JSON) und Seiten (HTML, eigenes JS) gehen nie ueber diesen
// Cache, damit nach jeder Veroeffentlichung sofort der neue Stand gilt.
const C='atlas-statisch-1';
const STATIC=/\.(glb|jpe?g|png|webp|woff2)$|\/assets\/three\/[^/]+\.js$/;
function cached(req){return caches.open(C).then(c=>c.match(req).then(hit=>{
 const net=fetch(req).then(r=>{if(r.ok&&r.status===200)c.put(req,r.clone());return r});
 if(hit){net.catch(()=>{});return hit}return net;}))}
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
 if(u.origin!==location.origin)return;
 const own=u.pathname.startsWith(P+'/')||u.pathname===P;
 const t=own?u:new URL(P+u.pathname+u.search,u.origin);
 if(!own&&e.request.mode==='navigate'){e.respondWith(Response.redirect(t.href,302));return}
 if(e.request.method==='GET'&&!e.request.headers.has('range')&&STATIC.test(t.pathname)){e.respondWith(cached(new Request(t.href,{credentials:'same-origin'})));return}
 if(own)return;
 e.respondWith(fetch(new Request(t.href,{method:e.request.method,headers:e.request.headers,credentials:e.request.credentials,cache:e.request.cache,redirect:'follow'})));
});
