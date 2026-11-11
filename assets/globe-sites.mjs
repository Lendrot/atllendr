/** Sites and connections of every Fachatlas on the main globe (assets/globe-sites.json, analysis/FACHATLANTEN.md, Eddie 2026-10-28).
 *  Coordinates and statuses are shown as reported; the panel never approves or completes a record. */
import {escapeHtml as esc} from './map-logic.mjs';
import {currentFach} from './fachatlas.mjs';
import {verbindungHtml,nameKurz} from './verbindung-klartext.mjs';

const num=n=>new Intl.NumberFormat('de-DE').format(n);
const coord=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:5}).format(n);
const LIMIT=60;

export async function attachSites(engine,host){
 const data=await fetch('/assets/globe-sites.json').then(r=>{if(!r.ok)throw Error('Standortindex '+r.status);return r.json();});
 if(data.schema!=='atlas.globe-sites/1')throw Error('Standortindex: unbekanntes Schema');
 // Fachatlas mode: only that Fachatlas' sites and connections, no switches for the others.
 // Without fach, subset datasets (generated commodities, their sites are Rohstoffwelt rows) are skipped: no double points.
 const fach=currentFach(),datasets=fach?data.datasets.filter(d=>d.id===fach.sites):data.datasets.filter(d=>!d.subset_of),params=new URLSearchParams(location.search);
 const chosen=!fach&&params.has('sites')?new Set(params.get('sites').split(',')):null;
 const state=Object.fromEntries(datasets.map(d=>[d.id,chosen?chosen.has(d.id):true]));
 const byIndex=data.datasets.map(d=>datasets.includes(d)?d:null);
 const records=data.rows.map(r=>{const dataset=byIndex[r[0]];if(!dataset)return null;const own=r.length>8?data.sources[r[8]]:null;return {dataset,kind:data.kinds[r[1]],lat:r[2],lon:r[3],name:r[4],id:r[5],country:r[6],status:data.statuses[r[7]],source:own?{label:own[0],url:own[1]}:null,color:Number.parseInt(dataset.color.slice(1),16),group:dataset.id};});
 const links=(data.links||[]).filter(l=>byIndex[l[0]]).map(l=>{const from=records[l[2]],to=records[l[3]];return {dataset:byIndex[l[0]],type:data.link_types[l[1]],from,to,id:l[4],evidence:data.evidences[l[5]],audit:data.audits[l[6]],source:l.length>7?{label:data.sources[l[7]][0],url:data.sources[l[7]][1]}:null,color:from.color};});
 // Gesamtvernetzung (gesamtvernetzung.mjs): alle Verbindungen aller Fachatlanten, auch der Teilmengen (Lithium, Uran …),
 // deren Punkte hier nicht doppelt gezeichnet werden; Endpunkte dafür aus den Zeilen gebaut.
 const rowRecord=i=>{const r=data.rows[i],dataset=data.datasets[r[0]];return records[i]||{dataset,kind:data.kinds[r[1]],lat:r[2],lon:r[3],name:r[4],id:r[5],country:r[6],status:data.statuses[r[7]],source:r.length>8?{label:data.sources[r[8]][0],url:data.sources[r[8]][1]}:null,color:Number.parseInt(dataset.color.slice(1),16),group:dataset.id};};
 const allLinks=fach?links:(data.links||[]).map(l=>{const dataset=data.datasets[l[0]],from=rowRecord(l[2]),to=rowRecord(l[3]);return {dataset,type:data.link_types[l[1]],from,to,id:l[4],evidence:data.evidences[l[5]],audit:data.audits[l[6]],source:l.length>7?{label:data.sources[l[7]][0],url:data.sources[l[7]][1]}:null,color:from.color};});
 let linkFilter=null;
 const notDrawn=id=>Object.values(data.counts.links_not_placed?.[id]||{}).reduce((a,b)=>a+b,0);
 const panel=document.createElement('div');panel.className='sites-toggle';panel.setAttribute('role','group');panel.setAttribute('aria-label','Standorte der Fachatlanten');
 // Zwei Ebenen (Eddie 2026-11-08): Standorte (Punkte) und Verbindungen (Bänder), jede einzeln schaltbar.
 panel.innerHTML=`<div class="layer-switch" role="group" aria-label="Ebenen"><button type="button" data-layer="points" aria-pressed="true"><i class="layer-dot"></i>Standorte</button><button type="button" data-layer="lines" aria-pressed="true"><i class="layer-line"></i>Verbindungen</button></div>`+`<strong>${fach?'Standorte im Fachatlas '+esc(fach.label):'Standorte der Fachatlanten'}</strong>`+datasets.map(d=>{const placed=data.counts.placed[d.id],missing=Object.values(data.counts.not_placed[d.id]).reduce((a,b)=>a+b,0);
  const drawn=data.counts.links_placed?.[d.id]||0,open=notDrawn(d.id);
  return `<label title="${esc(d.source)} · ${esc(d.evidence)}${missing?` · ${num(missing)} ohne Koordinate (nur im Fachatlas)`:''}${drawn||open?` · ${num(drawn)} Verbindungen gezeichnet${open?`, ${num(open)} ohne Koordinate eines Endpunkts (nur im Fachatlas)`:''}`:''}"><input type="checkbox" data-site-dataset="${esc(d.id)}"${state[d.id]?' checked':''}><span class="checkbox-ui"></span><i style="background:${esc(d.color)}"></i><span class="site-long">${esc(d.label)}</span><span class="site-short">${esc(d.short||d.label)}</span> <b>${num(placed)}</b></label>`;}).join('');
 host.append(panel);
 const dialog=document.createElement('dialog');dialog.id='sites-dialog';dialog.setAttribute('aria-labelledby','sites-dialog-title');
 dialog.innerHTML='<div class="dialog-top"><h2 id="sites-dialog-title"></h2><button class="icon-button" id="sites-dialog-close" aria-label="Schließen">×</button></div><div id="sites-dialog-body"></div>';
 document.body.append(dialog);dialog.querySelector('#sites-dialog-close').onclick=()=>dialog.close();
 function apply(){
  engine.setSites(records.filter(r=>r&&state[r.dataset.id]));
  engine.setSiteLinks?.(linkFilter?allLinks.flatMap(l=>{const c=linkFilter(l);return c==null?[]:[{...l,color:c}];}):links.filter(l=>state[l.dataset.id]));
  const url=new URL(location.href),on=datasets.filter(d=>state[d.id]).map(d=>d.id);
  if(on.length===datasets.length)url.searchParams.delete('sites');else url.searchParams.set('sites',on.join(','));
  if(url.href!==location.href)history.replaceState(history.state,'',url);
 }
 panel.querySelectorAll('[data-layer]').forEach(button=>button.onclick=()=>{const on=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(on));engine.setLayers?.({[button.dataset.layer]:on});});
 panel.querySelectorAll('[data-site-dataset]').forEach(input=>input.onchange=()=>{state[input.dataset.siteDataset]=input.checked;apply();});
 function row(r){
  const link=r.dataset.detail?`<a href="${esc(r.dataset.detail+encodeURIComponent(r.id))}">Im Fachatlas öffnen</a>`:`<a href="${esc(r.dataset.fachatlas)}">Fachatlas ${esc(r.dataset.label)}</a>`;
  const an='https://lendrot.github.io/atlaslendrot/schnittstelle/'+(/^(gem-|entity:|legacy-row-|[a-z-]+-(site|node|owner)-)/.test(r.id)?'?id='+encodeURIComponent(r.id):'?suche='+encodeURIComponent(r.name||''));
  const ann=r.name||/^(gem-|entity:|legacy-row-|[a-z-]+-(site|node|owner)-)/.test(r.id)?` · <a href="${esc(an)}" target="_blank" rel="noopener">Im Annahmen-Atlas nachsehen ↗</a> (Annahmen, nicht belegt)`:'';
  return `<div><dt>${esc(r.name||'Name UNKNOWN')}</dt><dd>${esc(r.kind)} · ${esc(r.country)} · Status ${esc(r.status)}<br>Koordinate wie gemeldet: ${coord(r.lat)}, ${coord(r.lon)} · Datensatz ${esc(r.id)}<br>Quelle: ${r.source?source(r.source):esc(r.dataset.source)+' · '+esc(r.dataset.evidence)} · ${link}${ann}</dd></div>`;
 }
 function source(s){return s.url&&/^https:\/\//.test(s.url)?`<a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.label)}</a>`:esc(s.label);}
 // Gleiche Angaben an jeder Verbindung (Eddie 2026-11-10): Menge und Stand stehen immer da, ohne Beleg als „unbekannt“.
 // Menge entfällt nur bei Eigentum, Betrieb und Kontrolle (dort zählt der Anteil, es wird keine Ware bewegt).
 const OHNE_MENGE=new Set(['OWNS','PARTIALLY_OWNS','OPERATES','CONTROLS','HEADQUARTERS','betreibt']);
 function gleicheAngaben(l,x){return[...(OHNE_MENGE.has(l.type)?[]:[['Menge',x.q||'unbekannt']]),['Stand',x.t||'unbekannt']];}
 function openLinks(list){
  // Klartext oben (Eddie 2026-11-10): welche Verbindung, warum, wichtigste Angaben; Kennungen, Koordinaten und Rohquellen eingeklappt.
  const l=list[0],x=data.link_info?.[l.id]||{};
  dialog.querySelector('#sites-dialog-title').textContent=`${nameKurz(l.from.name)} → ${nameKurz(l.to.name)}`;
  const fach=l.dataset.fachatlas?`<a href="${esc(l.dataset.fachatlas)}">Im Fachatlas ${esc(l.dataset.short||l.dataset.label)} ansehen</a>`:'';
  const technik=`<p>Der Bogen ist schematisch zwischen den beiden gemeldeten Koordinaten gezeichnet, kein belegter Transportweg. Evidenz ${esc(l.evidence)}, Prüfstatus ${esc(l.audit)}. Datensatz: ${esc(l.dataset.label)}.</p><dl>${row(l.from)}${row(l.to)}</dl><p class="empty-note">Beziehung ${esc(l.id)}${l.source?` · Beleg der Beziehung: ${source(l.source)}`:''}</p>`;
  dialog.querySelector('#sites-dialog-body').innerHTML=verbindungHtml({typ:l.type,von:{name:l.from.name,art:l.from.kind,land:l.from.country},nach:{name:l.to.name,art:l.to.kind,land:l.to.country},
   rohstoff:['standorte','rohstoffwelt'].includes(l.dataset.id)?null:(l.dataset.short||l.dataset.label),material:x.m,entsteht:x.n,anteil:x.p,evidenz:l.evidence,pruef:l.audit,aussage:x.a,zitat:x.z,beleg:l.source,extra:gleicheAngaben(l,x),
   verwendung:x.v?{zweck:x.v[0],wie:'belegt',zitat:x.v[1],beleg:{label:x.v[3],url:x.v[2]}}:null},{technik,aktionen:fach});
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('#sites-dialog-body').scrollTop=0;
 }
 function open(list){
  dialog.querySelector('#sites-dialog-title').textContent=list.length===1?list[0].name||'Standort':`${num(list.length)} Standorte an dieser Stelle`;
  dialog.querySelector('#sites-dialog-body').innerHTML=`<p class="dialog-lead">Anzeige-Gruppe: alle Einträge liegen in derselben Bildschirmzelle; der Punkt sitzt auf der gemeldeten Koordinate des ersten Eintrags. Nichts ist freigegeben (${esc(data.approval_status)}).</p><dl>${list.slice(0,LIMIT).map(row).join('')}</dl>${list.length>LIMIT?`<p class="empty-note">${num(list.length-LIMIT)} weitere Einträge: näher heranzoomen oder im Fachatlas filtern.</p>`:''}`;
  if(!dialog.open)dialog.showModal();
 }
 apply();
 // Firmensuche (Eddie 2026-11-10): Standorte, deren Name nach Normalisierung gleich dem gesuchten Namen ist; Konzernsitze zuerst.
 const finde=(t,nrm)=>records.filter(r=>r&&r.name&&nrm(r.name)===t).sort((a,b)=>(b.dataset.id==='standorte')-(a.dataset.id==='standorte'));
 return {open,openLinks,finde,counts:data.counts,allLinks,setLinkFilter:fn=>{linkFilter=fn;apply();}};
}
