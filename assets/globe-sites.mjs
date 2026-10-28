/** Sites of every Fachatlas on the main globe (assets/globe-sites.json, analysis/FACHATLANTEN.md, Eddie 2026-10-28).
 *  Coordinates and statuses are shown as reported; the panel never approves or completes a record. */
import {escapeHtml as esc} from './map-logic.mjs';

const num=n=>new Intl.NumberFormat('de-DE').format(n);
const coord=n=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:5}).format(n);
const LIMIT=60;

export async function attachSites(engine,host){
 const data=await fetch('/assets/globe-sites.json').then(r=>{if(!r.ok)throw Error('Standortindex '+r.status);return r.json();});
 if(data.schema!=='atlas.globe-sites/1')throw Error('Standortindex: unbekanntes Schema');
 const datasets=data.datasets,params=new URLSearchParams(location.search);
 const chosen=params.has('sites')?new Set(params.get('sites').split(',')):null;
 const state=Object.fromEntries(datasets.map(d=>[d.id,chosen?chosen.has(d.id):true]));
 const records=data.rows.map(r=>{const dataset=datasets[r[0]];return {dataset,kind:data.kinds[r[1]],lat:r[2],lon:r[3],name:r[4],id:r[5],country:r[6],status:data.statuses[r[7]],color:Number.parseInt(dataset.color.slice(1),16),group:dataset.id};});
 const panel=document.createElement('div');panel.className='sites-toggle';panel.setAttribute('role','group');panel.setAttribute('aria-label','Standorte der Fachatlanten');
 panel.innerHTML='<strong>Standorte der Fachatlanten</strong>'+datasets.map(d=>{const placed=data.counts.placed[d.id],missing=Object.values(data.counts.not_placed[d.id]).reduce((a,b)=>a+b,0);
  return `<label title="${esc(d.source)} · ${esc(d.evidence)}${missing?` · ${num(missing)} ohne Koordinate (nur im Fachatlas)`:''}"><input type="checkbox" data-site-dataset="${esc(d.id)}"${state[d.id]?' checked':''}><span class="checkbox-ui"></span><i style="background:${esc(d.color)}"></i><span class="site-long">${esc(d.label)}</span><span class="site-short">${esc(d.short||d.label)}</span> <b>${num(placed)}</b></label>`;}).join('');
 host.append(panel);
 const dialog=document.createElement('dialog');dialog.id='sites-dialog';dialog.setAttribute('aria-labelledby','sites-dialog-title');
 dialog.innerHTML='<div class="dialog-top"><h2 id="sites-dialog-title"></h2><button class="icon-button" id="sites-dialog-close" aria-label="Schließen">×</button></div><div id="sites-dialog-body"></div>';
 document.body.append(dialog);dialog.querySelector('#sites-dialog-close').onclick=()=>dialog.close();
 function apply(){
  engine.setSites(records.filter(r=>state[r.dataset.id]));
  const url=new URL(location.href),on=datasets.filter(d=>state[d.id]).map(d=>d.id);
  if(on.length===datasets.length)url.searchParams.delete('sites');else url.searchParams.set('sites',on.join(','));
  if(url.href!==location.href)history.replaceState(history.state,'',url);
 }
 panel.querySelectorAll('[data-site-dataset]').forEach(input=>input.onchange=()=>{state[input.dataset.siteDataset]=input.checked;apply();});
 function row(r){
  const link=r.dataset.detail?`<a href="${esc(r.dataset.detail+encodeURIComponent(r.id))}">Im Fachatlas öffnen</a>`:`<a href="${esc(r.dataset.fachatlas)}">Fachatlas ${esc(r.dataset.label)}</a>`;
  return `<div><dt>${esc(r.name||'Name UNKNOWN')}</dt><dd>${esc(r.kind)} · ${esc(r.country)} · Status ${esc(r.status)}<br>Koordinate wie gemeldet: ${coord(r.lat)}, ${coord(r.lon)} · Datensatz ${esc(r.id)}<br>Quelle: ${esc(r.dataset.source)} · ${esc(r.dataset.evidence)} · ${link}</dd></div>`;
 }
 function open(list){
  dialog.querySelector('#sites-dialog-title').textContent=list.length===1?list[0].name||'Standort':`${num(list.length)} Standorte an dieser Stelle`;
  dialog.querySelector('#sites-dialog-body').innerHTML=`<p class="dialog-lead">Anzeige-Gruppe: alle Einträge liegen in derselben Bildschirmzelle; der Punkt sitzt auf der gemeldeten Koordinate des ersten Eintrags. Nichts ist freigegeben (${esc(data.approval_status)}).</p><dl>${list.slice(0,LIMIT).map(row).join('')}</dl>${list.length>LIMIT?`<p class="empty-note">${num(list.length-LIMIT)} weitere Einträge: näher heranzoomen oder im Fachatlas filtern.</p>`:''}`;
  if(!dialog.open)dialog.showModal();
 }
 apply();
 return {open,counts:data.counts};
}
