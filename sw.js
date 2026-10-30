// Leitet Root-Pfad-Anfragen der Atlas-Seiten auf /atllendr/ um (Daten bleiben byte-identisch).
// Version = Quell-Commit; jede Aenderung hier loest im Browser ein Service-Worker-Update aus.
const V='9c17da5e1c6199c6f5b7b49c94edf9c205366a48';
const P='/atllendr';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
 if(u.origin!==location.origin||u.pathname.startsWith(P+'/')||u.pathname===P)return;
 const t=new URL(P+u.pathname+u.search,u.origin);
 if(e.request.mode==='navigate'){e.respondWith(Response.redirect(t.href,302));return}
 e.respondWith(fetch(new Request(t.href,{method:e.request.method,headers:e.request.headers,credentials:e.request.credentials,cache:e.request.cache,redirect:'follow'})));
});
