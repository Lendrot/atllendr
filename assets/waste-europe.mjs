// Abfallwirtschaft Europa (/abfall/): Anlagen der EEA-Industriedatenbank v16 auf der Karte, Länderübersicht mit Eurostat 2022,
// Kupfer-Bezug über Namenskandidaten. Reine Anzeige von /assets/waste-europe-view.json (scripts/analysis/build_waste_europe.py);
// hier wird nichts neu berechnet außer Filtern und Zählen der sichtbaren Zeilen. UNKNOWN wird nie als 0 gezeigt.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=url=>/^https?:\/\//.test(url||'')?esc(url):'#';
const int=v=>v==null?'UNKNOWN':Number(v).toLocaleString('de-DE',{maximumFractionDigits:0});
const mt=v=>v==null?'UNKNOWN':(v/1e6).toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})+' Mio. t';
const pct=v=>v==null?'UNKNOWN':v.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})+' %';
export const NOT_ZERO='UNKNOWN · nicht gemeldet, nicht 0';
// Farbe folgt der Kategorie (auf heller Kartenfläche #e4f3fa geprüft).
export const CATEGORY_COLOR={DEPONIE:'#8a5a2b',VERBRENNUNG:'#d6452f',MITVERBRENNUNG:'#e08a1e',VERBRENNUNG_UNKLAR:'#b07f6d',SONDERABFALL:'#8e3fae',
 VERWERTUNG:'#178a55',BEHANDLUNG:'#2f74c0',NE_METALL:'#b8860b'};
const STATUS={functional:'in Betrieb',disused:'außer Betrieb',decommissioned:'stillgelegt',notRegulated:'nicht mehr IED-reguliert'};
export const statusLabel=s=>STATUS[s]||'Status UNKNOWN';

export function rows(v){const c=v.facility_columns;return v.facilities.map(r=>Object.fromEntries(c.map((k,i)=>[k,r[i]])))}

export function validateView(v){
 const bad=[];
 if(v?.schema!=='atlas.waste-europe/1')bad.push('schema');
 if(v?.approval_status!=='NEEDS_REVIEW')bad.push('approval_status');
 if(!Array.isArray(v?.facilities)||v.facilities.length!==v?.kpi?.installations)bad.push('Anlagenzahl');
 const cats=new Set((v?.categories||[]).map(c=>c.id)),col=(v?.facility_columns||[]).indexOf('category');
 if(col<0)bad.push('Spalten');
 const per={};for(const r of v?.facilities||[]){if(!cats.has(r[col]))bad.push('Kategorie '+r[col]);per[r[col]]=(per[r[col]]||0)+1}
 for(const c of v?.categories||[])if((per[c.id]||0)!==c.installations)bad.push('Kategoriesumme '+c.id);
 if(v?.kpi?.operator_known!==0&&!(v?.sources?.eea?.operator_note))bad.push('Betreiber ohne Quelle');
 for(const c of v?.copper?.candidates||[])if(c.approval_status!=='NEEDS_REVIEW'||c.fact_status!=='INFERENCE')bad.push('Kupferkandidat freigegeben');
 // Eine gemeldete 0 ist ein Quellenwert; nicht gemeldet ist null (UNKNOWN). Andere Werte sind ungültig.
 for(const t of Object.values(v?.transfers||{}))if(t.length!==6||t.slice(2).some(x=>x!==null&&!(typeof x==='number'&&x>=0)))bad.push('Verbringung ungültig');
 return [...new Set(bad)];
}
const guard=v=>{const b=validateView(v);if(b.length)throw Error('Abfalldaten inkonsistent: '+b.join('; '))};

export function filterRows(all,{category='all',status='all',country='all',query=''}={}){
 const q=query.trim().toLocaleLowerCase('de');
 return all.filter(r=>(category==='all'||r.category===category)&&(country==='all'||r.country===country)
  &&(status==='all'||(status==='unknown'?r.status==null:r.status===status))
  &&(!q||[r.name,r.city,r.country].some(s=>s&&s.toLocaleLowerCase('de').includes(q))));
}

export function renderKpis(v){
 const k=v.kpi;
 const tile=(n,l,t)=>`<div class="we-kpi"${t?` data-kpi="${t}"`:''}><strong>${n}</strong><span>${l}</span></div>`;
 return `<div class="we-kpis">${tile(int(k.installations),'Anlagen (IED-Tätigkeiten)','installations')}${tile(int(k.countries),'Länder','countries')}`
  +`${tile(int(k.functional),'gemeldet in Betrieb','functional')}${tile(int(k.stale),'letzte Meldung vor '+k.latest_year,'stale')}`
  +`${tile('UNKNOWN','Betreiber ('+int(k.operator_unknown)+' Anlagen)','operator')}</div>`;
}

export function renderLegend(v){
 return `<ul class="we-legend">${v.categories.map(c=>`<li data-category="${c.id}"><span class="we-dot" style="background:${CATEGORY_COLOR[c.id]}"></span>${esc(c.label)} <small>${int(c.installations)} · ${esc(c.basis)}</small></li>`).join('')}</ul>`;
}

export function transferText(v,facilityId){
 const t=v.transfers[facilityId];
 if(!t)return `Abfallverbringung: ${NOT_ZERO} (keine Meldung über den E-PRTR-Schwellen)`;
 const [year,conf,hd,hr,nd,nr]=t,cell=x=>x==null?NOT_ZERO:int(x)+' t';
 return `Abfallverbringung ${year} (ganze Betriebseinrichtung): gefährlich Beseitigung ${cell(hd)}, gefährlich Verwertung ${cell(hr)}, nicht gefährlich Beseitigung ${cell(nd)}, nicht gefährlich Verwertung ${cell(nr)}`
  +(conf?` · ${conf} vertrauliche Zeile(n)`:'');
}

export function popupHtml(v,r){
 const cat=v.categories.find(c=>c.id===r.category);
 const act=r.ied_activity?`IED ${esc(r.ied_activity)}: ${esc((v.activity_labels[r.ied_activity]||'').slice(0,160))}`:'Haupttätigkeit UNKNOWN';
 return `<strong>${esc(r.name)}</strong><br>${esc([r.city,r.country].filter(Boolean).join(', '))}<div>${esc(cat?.label)}</div><div class="we-small">${act}</div>`
  +`<div>${esc(statusLabel(r.status))} · gemeldet ${r.reporting_year}${r.reporting_year<v.kpi.latest_year?' (veraltet)':''}</div>`
  +`<div class="we-small">${esc(transferText(v,r.facility_id))}</div><div class="we-small">Betreiber UNKNOWN · Prüfstatus NEEDS_REVIEW · Quelle EEA v16 (${esc(r.source_table)})</div>`;
}

export function renderCountries(v){
 const head=`<tr><th>Land</th><th>Anlagen</th><th>in Betrieb</th><th>Deponien</th><th>Verbrennung</th><th>Verwertung</th><th>NE-Metall</th><th>Meldung ${v.kpi.latest_year}</th><th>Abfall 2022 (Eurostat)</th><th>Deponieanteil</th><th>Recyclinganteil</th></tr>`;
 const op=(c,id)=>c.eurostat.treatment.find(o=>o.operation===id);
 const note=c=>c.reporting_note==='UK_REPORTING_ENDS_2019'?' <small>Meldung Großbritannien endet 2019, danach nur Nordirland</small>':c.reporting_note==='REPORTING_INCOMPLETE'?' <small>Meldung laut EEA unvollständig</small>':'';
 const flag=x=>x?.flag?` <small title="${esc(x.flag_label)}">(${esc(x.flag)})</small>`:'';
 const body=v.countries.map(c=>`<tr data-country="${esc(c.country)}"><td>${esc(c.label)}${note(c)}</td><td>${int(c.installations)}</td><td>${int(c.functional)}</td><td>${int(c.by_category.DEPONIE)}</td>`
  +`<td>${int(c.by_category.VERBRENNUNG+c.by_category.MITVERBRENNUNG+c.by_category.VERBRENNUNG_UNKLAR)}</td><td>${int(c.by_category.VERWERTUNG)}</td><td>${int(c.by_category.NE_METALL)}</td><td>${int(c.installations_reporting_current)}</td>`
  +`<td>${mt(c.eurostat.generation.value_t)}${flag(c.eurostat.generation)}</td><td>${pct(op(c,'DSP_L').share_of_treatment_pct)}</td><td>${pct(op(c,'RCV_R').share_of_treatment_pct)}</td></tr>`).join('');
 const eu=v.eu27;
 return `<p class="we-small">EU-27 2022: ${mt(eu.generation.value_t)} Abfallaufkommen, davon behandelt ${mt(eu.treatment_total.value_t)}; Deponie ${pct(eu.treatment.find(o=>o.operation==='DSP_L').share_of_treatment_pct)}, Recycling ${pct(eu.treatment.find(o=>o.operation==='RCV_R').share_of_treatment_pct)} der Behandlung. Anlagenzahlen und Eurostat-Mengen stammen aus getrennten Quellen und werden nicht gegeneinander verrechnet.</p>`
  +`<div class="we-table"><table>${head}${body}</table></div>`;
}

export function renderCopper(v){
 const c=v.copper;
 const list=c.candidates.map(x=>`<li data-installation="${esc(x.installation_id)}"><strong>${esc(x.installation_name)}</strong> · ${esc([x.city,x.country].filter(Boolean).join(', '))} · IED ${esc(x.ied_activity)}<br><small>Namenskandidat für „${esc(x.ledger_name)}“ im Kupfer-Ledger · INFERENCE · NEEDS_REVIEW, keine Eigentumsangabe</small></li>`).join('');
 return `<p>${int(c.ne_metal_installations)} NE-Metallhütten und -Schmelzen (IED 2.5) in Europa. ${esc(c.note)}</p>`
  +(list?`<ol class="we-list">${list}</ol>`:`<p>Keine Namensübereinstimmung mit Unternehmen des Kupfer-Ledgers.</p>`);
}

export function renderGaps(v){
 return `<ul>${v.gaps.map(g=>`<li data-gap="${g.id}">${esc(g.text)}${g.count!=null?` (${int(g.count)} Anlagen)`:''}</li>`).join('')}</ul>`
  +`<p class="we-small">Quellen: <a href="${safe(v.sources.eea.doi)}" target="_blank" rel="noopener noreferrer">${esc(v.sources.eea.publisher)}, Industrial Reporting v16</a> (${esc(v.sources.eea.licence)}), Stand ${esc(v.sources.eea.status_date)}; `
  +`${Object.entries(v.sources.eurostat.datasets).map(([k,d])=>`<a href="${safe(d.query_url)}" target="_blank" rel="noopener noreferrer">Eurostat ${esc(k)}</a>`).join(', ')} (${esc(v.sources.eurostat.licence)}). ${esc(v.sources.eea.coverage_note)}</p>`;
}

export function exportCsv(v,list){
 const cols=['Anlage','Land','Ort','Längengrad','Breitengrad','Kategorie','IED-Tätigkeit','Status','Meldejahr','Betreiber','Prüfstatus','Quelle','EEA-ID'];
 const q=x=>{const s=String(x??'');return /[",;\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const lab=Object.fromEntries(v.categories.map(c=>[c.id,c.label]));
 const lines=list.map(r=>[r.name,r.country,r.city??'UNKNOWN',r.lon??'UNKNOWN',r.lat??'UNKNOWN',lab[r.category],r.ied_activity??'UNKNOWN',r.status??'UNKNOWN',r.reporting_year,'UNKNOWN','NEEDS_REVIEW','EEA Industrial Reporting v16 (CC BY 4.0)',r.id].map(q).join(';'));
 return [cols.join(';'),...lines].join('\n')+'\n';
}

export async function mount(){
 const $=id=>document.getElementById(id);
 let v;
 try{const res=await fetch('/assets/waste-europe-view.json');if(!res.ok)throw Error('HTTP '+res.status);v=await res.json();guard(v)}
 catch(e){$('we-status').textContent='Abfalldaten konnten nicht geladen werden: '+e.message;return}
 const all=rows(v);
 $('we-kpis').innerHTML=renderKpis(v);$('we-legend').innerHTML=renderLegend(v);$('we-countries').innerHTML=renderCountries(v);
 $('we-copper').innerHTML=renderCopper(v);$('we-gaps').innerHTML=renderGaps(v);
 const catSel=$('we-category');for(const c of v.categories)catSel.add(new Option(c.label+' ('+int(c.installations)+')',c.id));
 const cSel=$('we-country');for(const c of [...v.countries].sort((a,b)=>a.label.localeCompare(b.label,'de')))cSel.add(new Option(c.label,c.country));
 const map=L.map('we-map',{minZoom:3,maxZoom:13}).setView([51,10],4);
 fetch('/assets/world.json').then(r=>r.json()).then(w=>L.geoJSON(topojson.feature(w,w.objects.countries),{style:{fillColor:'#f7fbfd',fillOpacity:1,color:'#98bfd1',weight:.6},interactive:false}).addTo(map)).catch(()=>{});
 const clusters=L.markerClusterGroup({chunkedLoading:true,showCoverageOnHover:false,disableClusteringAtZoom:10,maxClusterRadius:50});map.addLayer(clusters);
 const icon={};for(const [k,c] of Object.entries(CATEGORY_COLOR))icon[k]=L.divIcon({className:'',html:`<span class="we-pin" style="background:${c}"></span>`,iconSize:[10,10],iconAnchor:[5,5]});
 let shown=[],visible=40;
 const marker=r=>{const m=L.marker([r.lat,r.lon],{icon:icon[r.category]});m.bindPopup(()=>popupHtml(v,r));return m};
 const drawList=()=>{const ol=$('we-list');ol.innerHTML=shown.slice(0,visible).map((r,i)=>`<li><button type="button" data-i="${i}">${esc(r.name)}</button><small>${esc([r.city,r.country].filter(Boolean).join(', '))} · ${esc(statusLabel(r.status))}${r.lon==null?' · Lage UNKNOWN':''}</small></li>`).join('');$('we-more').hidden=visible>=shown.length};
 const render=()=>{shown=filterRows(all,{category:catSel.value,status:$('we-status-filter').value,country:cSel.value,query:$('we-query').value});visible=40;
  $('we-status').textContent=int(shown.length)+' von '+int(all.length)+' Anlagen';drawList();clusters.clearLayers();
  const ms=shown.filter(r=>r.lon!=null).map(r=>(r._m||=marker(r)));clusters.addLayers(ms)};
 $('we-list').addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b)return;const r=shown[+b.dataset.i];if(r.lon==null)return;const m=r._m||=marker(r);clusters.zoomToShowLayer(m,()=>m.openPopup())});
 $('we-more').addEventListener('click',()=>{visible+=40;drawList()});
 for(const id of ['we-category','we-status-filter','we-country'])$(id).addEventListener('change',render);
 let t;$('we-query').addEventListener('input',()=>{clearTimeout(t);t=setTimeout(render,200)});
 $('we-csv').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+exportCsv(v,shown)],{type:'text/csv'}));a.download='abfallanlagen-europa.csv';a.click()});
 $('we-csv').disabled=false;render();
}
