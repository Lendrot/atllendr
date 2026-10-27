import {installWorldSwitch} from './world-switch.mjs';
import {filterAssets,annualCoverage,csv,mergeAssets,statusLabel} from './intelligence-model.mjs';
import {buildResourceGraph,visibleNodes,visibleEdges} from './resource-graph.mjs';
import {filterParams,readResourceFilters,writeResourceFilters} from './resource-url.mjs';
import {buildOwnershipIndex,ownershipContext,ownershipExportJson,ownershipExportCsv,ownershipCacheKey} from './ownership-index.mjs';
import {resourceRestrictions,resourceGapRefs,safeResourceExport,renderResourceAvailability,resourceAnalysisExclusions} from './safe-unknown.mjs';
import {installEmbedControls} from './embed-controls.mjs';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null?'UNKNOWN':new Intl.NumberFormat('de-DE',{maximumFractionDigits:6}).format(v);
const safe=url=>/^https?:\/\//.test(url||'')?esc(url):'#';
const link=(url,label)=>url?`<a href="${safe(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:'UNKNOWN';
const world='mines',kindLabel={mine:'Mine',operation_group:'Minenverbund',processor:'Verarbeitung',terminal:'Logistik'};
installWorldSwitch({host:'world-switch',active:world});
installEmbedControls();
const cache=new Map();function json(url){if(!cache.has(url))cache.set(url,fetch(url).then(r=>{if(!r.ok)throw Error('Datenabruf '+r.status);return r.json()}).catch(e=>{cache.delete(url);throw e}));return cache.get(url)}
let assets=[],catalogAssets=[],graph={nodes:[],edges:[]},engine=null,selected=null,clusterIds=null,limit=100,network={assets:[],relationships:[]},observations=[],manifest=null,ownershipManifest=null,nextPage=1,loadedPages=new Set([0]),legacy={mines:[]},hydration=null,selectionRevision=0,filterRevision=0;
const byId=id=>assets.find(a=>a.id===id)||network.assets.find(a=>a.id===id)||network.labels?.[id];
async function resolveAsset(a){
 if(a?.foundation_chunk===undefined)return a;
 const chunk=String(a.foundation_chunk).padStart(3,'0');
 const records=await json('/foundation/v28.2/catalog-chunk-'+chunk+'.json');
 const full=records.find(x=>x.foundation_entity_id===a.foundation_entity_id);
 if(!full)throw Error('Foundation entity missing from verified chunk: '+a.foundation_entity_id);
 full.observations=a.observations||full.observations;
 return full;
}
function notice(s){$('notice').textContent=s;$('notice').hidden=false;setTimeout(()=>$('notice').hidden=true,7000)}
function state(){return {query:$('search').value,kind:$('kind').value,status:$('status').value,country:$('country').value,commodity:$('commodity').value,quality:$('quality').value,ids:clusterIds}}
function restoreFilters(){const values=readResourceFilters(location.href);for(const id of Object.keys(filterParams)){$(id).value=values[id];if(id!=='search'&&$(id).value!==values[id])$(id).value='all'}}
function persistFilters(){const values=Object.fromEntries(Object.keys(filterParams).map(id=>[id,$(id).value]));history.replaceState(null,'',writeResourceFilters(location.href,values))}
function visible(){return filterAssets(assets,state())}
function closeDetail(){selected=null;selectionRevision++;$('detail').hidden=true;engine?.setDeals([],{});const url=new URL(location.href);url.searchParams.delete('id');history.replaceState(null,'',url);$('list').querySelectorAll('[aria-current=true]').forEach(e=>e.setAttribute('aria-current','false'))}
function render(){
 const filtered=visible();if(selected&&!filtered.some(a=>a.id===selected))closeDetail();
  $('coverage').textContent=`${fmt(filtered.length)} von ${fmt(assets.length)} geladenen Einträgen · Foundation ${fmt(manifest?.entity_count||assets.length)} Standorte · ${fmt(filtered.filter(a=>a.coordinates).length)} Kartenpunkte. Weltübersicht lädt schrittweise.`;
  const summary=$('mine-summary');if(summary)summary.textContent=`${fmt(filtered.filter(a=>['mine','operation_group'].includes(a.kind)).length)} Minen · ${fmt(filtered.filter(a=>a.kind==='processor').length)} Anlagen · ${fmt(filtered.filter(a=>a.kind==='terminal').length)} Terminals`;
 $('list').innerHTML=filtered.slice(0,limit).map(a=>`<button class="mine-row" data-id="${esc(a.id)}" aria-current="${a.id===selected}"><strong>${esc(a.name)}</strong><small>${esc(kindLabel[a.kind]||'Standort')} · ${esc(a.country)} · ${esc(a.commodity)} · ${a.coordinates?(a.coordinates.precision==='EXACT'?'Quellenpunkt exakt':'GPS-Genauigkeit offen'):'ohne GPS'}</small><small>${esc((a.statuses||[a.status]).map(s=>statusLabel[s]||s).join(' / '))}</small></button>`).join('')||'<p>Keine Einträge. Filter zurücksetzen oder Suchbegriff ändern.</p>';
 if(filtered.length>limit)$('list').insertAdjacentHTML('beforeend',`<button id="more" class="mine-row">Weitere 100 anzeigen (${fmt(filtered.length-limit)} verbleiben)</button>`);
 if(nextPage<manifest?.pages.length)$('list').insertAdjacentHTML('beforeend',`<button id="next-page" class="mine-row">Weitere Standorte aus der Foundation laden (${fmt(manifest.entity_count-catalogAssets.length)} verbleiben)</button>`);
 $('list').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>select(byId(b.dataset.id)));
 if($('more'))$('more').onclick=()=>{const y=$('list').scrollTop;limit+=100;render();$('list').scrollTop=y};
 if($('next-page'))$('next-page').onclick=()=>ensureFilterPages().catch(e=>{notice('Nächste Filterseite nicht geladen.');console.error(e)});
 engine?.setCompanies(visibleNodes(graph,filtered).map(n=>({id:n.id,mineId:n.id,name:n.name,location:{lat:n.coordinates.lat,lon:n.coordinates.lon},markerCategory:n.type==='MineNode'&&n.coordinates.precision!=='EXACT'?'mine-approx':n.type,pointColor:n.type==='ProcessingNode'?0x7454cf:n.type==='LogisticsNode'?0xda7028:n.coordinates.precision==='EXACT'?0x06aed4:0xe8ad37})));
}
function observationTable(a){
 const obs=a.observations||[];
 return annualCoverage(obs).map(({year,observations:rows})=>`<tr><th>${year}</th><td>${rows.length?rows.map(o=>`<div class="observation"><strong>${fmt(o.value)} ${esc(o.unit)}</strong> · ${esc(o.material_form)}<br>${esc(o.period_basis==='FY_JUNE'?`FY ${o.period_start} – ${o.period_end}`:'Zeitraumbasis UNKNOWN')} · ${esc(o.basis)}<br>${link(o.source_url||a.source_url,o.source_id||'Quelle')} · ${esc(o.audit)}${o.note?`<details><summary>Einordnung</summary>${esc(o.note)}</details>`:''}</div>`).join(''):'<span class="unknown">UNKNOWN · nicht belegt</span>'}</td></tr>`).join('');
}
function capacityTable(a){
 const cs=a.capacities||[a.capacity].filter(Boolean);
 return cs.length?`<table><thead><tr><th>Kapazität</th><th>Materialbasis / Prozess / Zeit</th></tr></thead><tbody>${cs.map(c=>{const s=c.foundation_semantics;return `<tr><td>${fmt(c.value)} ${esc(c.unit)}</td><td>${esc(s?.material_basis||'UNKNOWN_MATERIAL_BASIS')}${s?.process_type?' · Prozesstechnologie '+esc(s.process_type):''}<br>${esc(s?.capacity_type||'UNKNOWN_CAPACITY_TYPE')} · ${esc(s?.period_type||'UNKNOWN_PERIOD')} · ${link(c.source_url||a.source_url,c.source_id||'Quelle')}<br><small>Unklassifiziertes Quellenfeld: ${esc(c.material_form||'UNKNOWN')} · Phase laut Quelle: ${esc(statusLabel[c.status]||c.status||'Status UNKNOWN')}; Gültigkeit dieser Phase UNKNOWN</small></td></tr>`}).join('')}</tbody></table>`:'<p>UNKNOWN · keine belastbare Kapazität.</p>';
}
const relLabel={owner_or_operator:'Unternehmensreferenz laut Quelle · Rolle UNKNOWN',ultimate_parent:'Mutterreferenz laut Quelle · Kontrolle UNKNOWN',processed_at:'Verarbeitung',transport_to:'Transportverbindung',operator:'Betreiberangabe laut Quelle · Richtung UNKNOWN',customer:'Abnehmer laut Quelle'};
function showDetail(a){
 const rels=network.relationships.filter(r=>r.from_id===a.id||r.to_id===a.id);
 $('detail').innerHTML=`<button class="close" id="detail-close">Schließen</button><p class="eyebrow">${esc(kindLabel[a.kind]||'Standort')} · ${esc(a.country)} · ${esc(a.commodity)}</p><h2>${esc(a.name)}</h2><p class="source-badge">${esc(a.source_id||'Altbestand')} · ${esc(a.audit)}<br>${esc(a.data_period)}</p><dl><dt>Quellenstatus (Zeitpunkt ungeklärt)</dt><dd>${esc((a.statuses||[a.status]).map(s=>statusLabel[s]||s).join(' / '))} · Gültigkeitszeitpunkt UNKNOWN</dd><dt>GPS</dt><dd>${a.coordinates?`${a.coordinates.lat}, ${a.coordinates.lon}<br>Genauigkeit: ${esc(a.coordinates.precision)} laut Quelle`:'UNKNOWN · kein Standort erfunden'}${a.location_text?'<br>'+esc(a.location_text):''}</dd><dt>Unternehmensreferenz laut Quelle · Rolle UNKNOWN</dt><dd>${esc(a.owner.name||'UNKNOWN')}</dd><dt>Mutterreferenz laut Quelle · Kontrolle UNKNOWN</dt><dd>${esc(a.owner.parent||'UNKNOWN')}</dd><dt>Sitz</dt><dd>${esc(a.owner.location||'UNKNOWN')}</dd><dt>Prüfung</dt><dd>Quellenangabe · ${esc(a.audit)}. Confidence UNKNOWN. Weder Eigentum noch Betrieb aus einer gemeinsamen Quellenzelle abgeleitet.</dd></dl><button class="action" id="company-network">Unternehmensreferenzen & verbundene Standorte</button><section id="company-results"></section>${a.data_issues?.length?'<p class="data-warning">Quellenfehler: Beteiligungswerte außerhalb 0–100 %. Diese Werte werden nicht als bestätigte Anteile verwendet.</p>':''}<h3>Kapazitäten nach Form und Phase</h3>${capacityTable(a)}<p class="muted">Kapazitätszeitraum: UNKNOWN_PERIOD, sofern kein eigener Beleg angezeigt wird. Keine Aussage über die aktuelle Kapazität. Kapazität und Förderung bleiben getrennt. Keine Summe über Eisen-/Stahlstufen, Ausbauphasen oder inkompatible Einheiten.</p><h3>${a.kind==='terminal'?'Jahresumschlag':'Jahresproduktion'} 2021–2026</h3><table><thead><tr><th>Jahr</th><th>Menge · Berichtsgrundlage</th></tr></thead><tbody>${observationTable(a)}</tbody></table><p class="muted">2026 ist kein abgeschlossenes Kalenderjahr. FY-Werte enden am angegebenen Stichtag. UNKNOWN bedeutet nicht null Förderung.</p><h3>Verarbeitung, Abnehmer & Transport</h3>${rels.length?rels.map(r=>{const id=r.from_id===a.id?r.to_id:r.from_id;return `<div class="relation"><strong>${esc(relLabel[r.type]||r.type)}</strong> · ${esc(byId(id)?.name||id)}<p>${esc(r.note)}${r.transport_mode?' · '+esc(r.transport_mode):''}</p>${link(r.source_url,'Primärquelle')} · Menge UNKNOWN</div>`}).join(''):'<p>Keine separat belegte Lieferbeziehung im Datensatz.</p>'}${a.processors?.length?'<p>'+esc(a.processors.join(' · '))+'</p>':''}${a.transport?.length?'<p>'+esc(a.transport.join(' · '))+'</p>':''}${a.transport_source_url?link(a.transport_source_url,'Ergänzende Transportquelle'):''}<p class="muted">Linien zeigen Beziehungen zwischen Endpunkten. Sie sind keine vermessenen Bahntrassen oder Schifffahrtsrouten.</p><h3>Herkunft</h3><p>${link(a.source_url,'Originalquelle')} ${a.secondary_source_url?' · '+link(a.secondary_source_url,'Weitere Altquelle'):''}<br>Abgerufen: ${esc(a.access_date)} · Quellen-ID: ${esc(a.source_project_id||a.id)}${a.source_rows?'<br>Quellenzeilen: '+esc(a.source_rows.join(', ')):''}</p><p class="data-warning">Nutzungseinschränkungen: ${esc(resourceRestrictions(a).join(' · ')||'Weitere Prüfungen offen')} · <a href="/datenluecken/?entity=${encodeURIComponent(a.id)}">Datenlücken für diesen Standort filtern</a></p><p><a href="/daten/">Abdeckung, Quellen und Prüflücken</a> · <a href="/produktion/">Produktionsreihen vergleichen</a></p><button class="action" id="record-export">Eintrag als JSON</button>`;
 const copperRoutes={
  'legacy-row-2':['escondida','entity:25855cbf-e719-4bd1-8c15-6be2bffc267b'],
  'legacy-row-35':['spence','entity:72c038ce-652a-41ad-822b-8dcf9daf7299'],
  'legacy-row-8':['antamina','entity:ffbab916-f696-4b76-9d2e-ad4c843ff434'],
  'legacy-row-19':['kansanshi','entity:2c1aa724-2bc5-4753-9f32-e7b4a8713fa5'],
  'legacy-row-22':['kamoa','entity:4e1ccbb5-a6dd-4fce-9970-bba2d6c8f5e7']
 };
 const copperRoute=copperRoutes[a.id]||Object.values(copperRoutes).find(r=>r[1]===a.foundation_entity_id);
 if(copperRoute){
  const intelligence=document.createElement('a');intelligence.className='related-link';
  intelligence.href='/kupfer/?chain='+copperRoute[0]+'&entity='+encodeURIComponent(copperRoute[1]);
  intelligence.textContent=a.name+': belegte Kupferkette und Ausfallanalyse →';$('detail').append(intelligence);
  const risk=document.createElement('div');risk.textContent='Risikosignale werden geladen …';$('detail').append(risk);const riskSelection=selectionRevision;
  import('./risk-signals.mjs').then(async m=>{const v=await m.loadRiskView();if(riskSelection===selectionRevision)risk.innerHTML=m.renderChainRisk(v,copperRoute[0])}).catch(e=>{risk.textContent='Risikosignale nicht geladen. Ohne Daten gilt kein Standort als unkritisch.';console.error(e)});
 }
 const availability=document.createElement('section');availability.id='public-availability';availability.setAttribute('aria-live','polite');availability.textContent='Öffentliche Quellenverfügbarkeit wird geladen …';$('detail').append(availability);
 const gapSelection=selectionRevision;resourceGapRefs(a.id).then(gaps=>{if(gapSelection!==selectionRevision||selected!==a.id)return;renderResourceAvailability(availability,gaps);const excluded=document.createElement('details'),summary=document.createElement('summary'),payload=document.createElement('pre');summary.textContent='Analyse-Ausschlüsse für diesen Standort';payload.textContent=JSON.stringify(resourceAnalysisExclusions(a,gaps),null,2);payload.dataset.analysisExclusions=a.id;excluded.append(summary,payload);availability.append(excluded)}).catch(error=>{if(gapSelection===selectionRevision)availability.textContent='Quellenverfügbarkeit nicht geladen. Fachliche Lücken und Nutzungssperren bleiben erhalten.';console.error(error)});
 $('detail').hidden=false;$('detail').scrollTop=0;$('detail-close').onclick=closeDetail;
 $('record-export').onclick=async()=>{try{const gaps=await resourceGapRefs(a.id);download(JSON.stringify(safeResourceExport(a,gaps),null,2),a.id+'.json','application/json')}catch(e){notice('Export gesperrt: Datenlücken-Verknüpfung nicht verfügbar.');console.error(e)}};
 $('company-network').onclick=()=>companyNetwork(a);
}
async function loadPage(page){
 if(loadedPages.has(page))return;
 loadedPages.add(page);
 let rows;try{rows=await json('/foundation/v28.3/'+manifest.pages[page].path)}catch(e){loadedPages.delete(page);throw e}
 if(rows.length>manifest.page_size){loadedPages.delete(page);throw Error('Page exceeds Foundation bound')}
 catalogAssets.push(...rows);
 assets=mergeAssets([...catalogAssets,...network.assets],legacy.mines,observations);
 graph=buildResourceGraph(assets,network.relationships);
 bindFilterOptions();render();
}
async function ensureFilterPages(){
 const rev=++filterRevision,filter=state();
 if(!manifest)return;
 let matching=manifest.pages.map((entry,i)=>({entry,i})).filter(({entry})=>
   (filter.country==='all'||entry.facets.country.includes(filter.country))&&
   (filter.commodity==='all'||entry.facets.commodity.includes(filter.commodity))&&
   (filter.status==='all'||entry.facets.status.includes(filter.status))&&
   (filter.kind==='all'||entry.facets.kind.includes(filter.kind)||filter.kind==='mine'&&entry.facets.kind.includes('operation_group')));
 const q=filter.query.trim().toLocaleLowerCase();
 if(q.length>=2&&/^[\x00-\x7f]+$/.test(q)){
  const grams=await json('/foundation/v28.3/'+manifest.search_index);
  const ids=new Set(grams[q.slice(0,2)]||[]);matching=matching.filter(({i})=>ids.has(i));
 }
 const next=matching.find(({i})=>!loadedPages.has(i));
 if(next&&rev===filterRevision)await loadPage(next.i);
 if(next&&matching.some(({i})=>i!==next.i&&!loadedPages.has(i)))notice('Weitere passende Standorte sind noch nicht geladen. Seitenweise laden oder Suche verfeinern.');
 if(rev===filterRevision)render();
}
async function findAsset(id){
 const found=byId(id)||assets.find(a=>a.legacy_id===id);
 if(found)return found;
 // Candidate IDs have no progressive catalog lookup entry. Resolve their
 // existing hydration before lookup so direct links cannot race that fetch.
 if(/^legacy-row-\d+$/.test(id)){
  await hydrateLegacy();
  const candidate=byId(id);if(candidate)return candidate;
 }
 let bucket=0;for(const c of id)bucket=(bucket*31+c.charCodeAt(0))%64;
 const lookup=await json('/foundation/v28.3/lookup-'+String(bucket).padStart(2,'0')+'.json');
 if(lookup[id]!==undefined){await loadPage(lookup[id]);return byId(id)||assets.find(a=>a.legacy_id===id)}
 return null;
}
function hydrateLegacy(){
 if(!hydration)hydration=Promise.all([json('/assets/mines-candidates.json'),json('/assets/production-observations.json')]).then(([rows,prod])=>{
  legacy=rows;observations=prod.observations;
  assets=mergeAssets([...catalogAssets,...network.assets],legacy.mines,observations);
  graph=buildResourceGraph(assets,network.relationships);bindFilterOptions();render();
 });
 return hydration;
}
async function companyNetwork(a){
 const rev=selectionRevision;$('company-results').textContent='Unternehmensbeziehungen werden geladen …';
 try{
  const ownershipPath=a.foundation_chunk===undefined?'/foundation/v29.6/ownership/ownership-primary.json':'/foundation/v29.6/ownership/ownership-chunk-'+String(a.foundation_chunk).padStart(3,'0')+'.json';
  const ownershipUrl=ownershipCacheKey(ownershipManifest,ownershipPath);
  const g=await json(ownershipUrl),all=assets;if(rev!==selectionRevision)return;
  const index=buildOwnershipIndex(g);
  const groups=ownershipContext(index,a.id),byAsset=new Map(all.map(x=>[x.id,x]));
  $('company-results').innerHTML=groups.length?`<p class="muted">${fmt(groups.reduce((n,x)=>n+x.claims.length,0))} einzelne Quellenaussagen. Unterschiedliche Phasen und Anteile werden getrennt gezeigt; keine Angabe ist damit freigegeben.</p><p><button class="action" id="ownership-json-export">Sichere Assertions als JSON</button> <button class="action" id="ownership-csv-export">Sichere Assertions als CSV</button></p>`+groups.map(group=>{
   const c=group.company,other=group.assetIds.filter(id=>id!==a.id);
   return `<details class="relation" ${group.claims.some(x=>x.conflict)?'open':''}><summary>${esc(c?.name||group.claims[0].from_id)} · ${esc(relLabel[group.claims[0].raw_claim_type]||group.claims[0].raw_claim_type)} · ${fmt(group.claims.length)} Aussagen</summary><p>${esc(c?.identity_status||'UNKNOWN')}${c?.identity_status==='SOURCE_NAME_ONLY'?' · bloße Namensreferenz, juristische Identität offen':''}<br>Sitz-GPS: UNKNOWN. Prozentwerte sind Quellenangaben und belegen bei ungeklärter Rolle keine Eigentumsquote.</p>${group.claims.map(claim=>{const source=index.sources.get(claim.source_id);return `<div class="ownership-claim ${claim.conflict?'conflict':''}"><strong>${esc(claim.share_status)} · ${claim.share_status==='INVALID'?'Quellenanteil ungültig':Number.isFinite(claim.share_percent)?fmt(claim.share_percent)+' % laut Quelle':'Anteil UNKNOWN'}</strong><br>Semantik: ${esc(claim.derived_relationship_type)} · ${esc(claim.semantic_fact_status)} · OWNS/OPERATES/CONTROLS nicht abgeleitet<br>Assertion: ${esc(claim.assertion_id)} · Legacy-Alias: ${esc(claim.legacy_assertion_id)} · Raw-ID: ${esc(claim.raw_relationship_id)}<br>Quellenphase (Gültigkeit UNKNOWN): ${esc(statusLabel[claim.status_at_source]||claim.status_at_source||'UNKNOWN')} · ${esc(claim.source_field)} · Zeile ${esc(claim.source_row??'UNKNOWN')} · Aussage ${esc(claim.source_statement_index)}<br>${link(source?.url||a.source_url,source?.title||claim.source_id)} · Snapshot ${esc(source?.snapshot||'UNKNOWN')} · abgerufen ${esc(source?.accessed_at||'UNKNOWN')} · Audit ${esc(claim.audit)}</div>`}).join('')}${other.length?`<details><summary>${fmt(other.length)} weitere Standorte mit derselben Unternehmensreferenz</summary>${other.slice(0,80).map(id=>{const x=byAsset.get(id);return x?`<a class="related-link" href="/minen/?id=${encodeURIComponent(x.id)}">${esc(x.name)} · ${esc(x.country)}</a>`:''}).join('')}${other.length>80?'<p>Weitere Standorte stehen im Quelldatensatz.</p>':''}</details>`:''}</details>`;
  }).join(''):'<p>Keine zugeordnete Unternehmensreferenz in diesem Quellenbestand. Eigentum bleibt UNKNOWN.</p>';
  if(groups.length){$('ownership-json-export').onclick=()=>download(ownershipExportJson(groups),'ownership-assertions-'+a.id+'.json','application/json');$('ownership-csv-export').onclick=()=>download(ownershipExportCsv(groups),'ownership-assertions-'+a.id+'.csv','text/csv;charset=utf-8')}
 }catch(e){if(rev===selectionRevision)$('company-results').textContent='Beziehungen konnten nicht geladen werden. Erneut versuchen.';console.error(e)}
}
async function select(a){
 if(!a)return;
 try{await hydrateLegacy()}catch(e){notice('Zusatzdaten nicht geladen.');console.error(e)}
 a=byId(a.id)||a;
 try{a=await resolveAsset(a)}catch(e){notice('Detail aus Foundation nicht geladen.');console.error(e);return}
 selected=a.id;selectionRevision++;const rev=selectionRevision;
 $('list').querySelectorAll('[data-id]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===a.id)));
 const u=new URL(location.href);u.searchParams.set('id',a.id);history.replaceState(null,'',u);
 if(a.coordinates)engine?.focusLocation(a.coordinates.lat,a.coordinates.lon,175);showDetail(a);engine?.setDeals([],{});
 const entities={},edges=[];
 // A company location and a legacy owner_or_operator label do not prove an ownership edge.
 const rs=visibleEdges(graph,visibleNodes(graph,visible())).filter(r=>(r.source===a.id||r.target===a.id)&&['transport_to','processed_at','customer'].includes(r.type));
 // Only rendered endpoints are used. Selecting one site never downloads the global catalog.
 if(rev!==selectionRevision)return;
 for(const r of rs){const from=byId(r.from_id),to=byId(r.to_id);if(!from?.coordinates||!to?.coordinates)continue;for(const x of [from,to])entities[x.id]={id:x.id,name:x.name,lat:x.coordinates.lat,lon:x.coordinates.lon};edges.push({id:r.id,buyerId:from.id,targetId:to.id,flowKind:r.type,flowColor:r.type==='transport_to'?0xda7028:0x7454cf,staticRelation:true})}
 engine?.setDeals(edges,entities);
}
async function openRiskOverview(){
 closeDetail();const d=$('detail');d.innerHTML='<button class="close" id="detail-close">Schließen</button><p class="eyebrow">Kupfer · Risikosignale</p><h2>Engpässe und Abhängigkeiten</h2><p id="risk-status" role="status">Risikosignale werden geladen …</p><div id="risk-result"></div><button class="action" id="risk-export" disabled>Risikosignale als JSON</button>';d.hidden=false;d.scrollTop=0;$('detail-close').onclick=closeDetail;
 try{const m=await import('./risk-signals.mjs'),v=await m.loadRiskView();$('risk-result').innerHTML='<p class="muted">Die betroffenen Anlagen haben keine belegte Koordinate. Sie werden deshalb nicht als Punkt auf dem Globus gezeigt. <a href="/minen/?id=legacy-row-19">Kansanshi in der Rohstoffwelt öffnen</a></p>'+m.renderRiskOverview(v);$('risk-status').textContent=v.kpi.signals_evidence_complete+' belegt, '+v.kpi.signals_candidate+' vorläufig.';m.bindRiskExport($('risk-export'),v,$('risk-status'))}
 catch(e){$('risk-status').textContent='Risikosignale nicht geladen. Ohne Daten gilt kein Standort als unkritisch.';console.error(e)}
}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function bindFilterOptions(){
 for(const id of ['country','commodity','status']){const previous=$(id).value;const vals=[...new Set([...(manifest?.facets[id]||[]),...assets.flatMap(a=>id==='status'?(a.statuses||[a.status]):[a[id]])])].sort();$(id).innerHTML='<option value="all">Alle</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(id==='status'?(statusLabel[v]||v):v)}</option>`).join('');if(vals.includes(previous))$(id).value=previous}
}
function bindFilters(){
 bindFilterOptions();
 let debounce;for(const id of ['search','kind','country','commodity','status','quality'])$(id).addEventListener(id==='search'?'input':'change',()=>{clusterIds=null;limit=100;$('cluster').hidden=true;persistFilters();render();clearTimeout(debounce);debounce=setTimeout(()=>ensureFilterPages().catch(e=>{notice('Filterseiten konnten nicht geladen werden.');console.error(e)}),id==='search'?240:0)});
 $('reset').onclick=()=>{for(const id of ['kind','country','commodity','status','quality'])$(id).value='all';$('search').value='';clusterIds=null;limit=100;$('cluster').hidden=true;persistFilters();render()};
 $('export').onclick=async()=>{const button=$('export'),snapshot=visible();button.disabled=true;try{const gapsByAsset=new Map();for(const asset of snapshot)gapsByAsset.set(asset.id,await resourceGapRefs(asset.id));download(csv(snapshot,gapsByAsset),'atlas-'+world+'-loaded-only.csv','text/csv;charset=utf-8')}catch(error){notice('Export gesperrt: Quellenverfügbarkeit konnte nicht vollständig geladen werden.');console.error(error)}finally{button.disabled=false}};
}
async function start(){
 try{
  const [index,primary,ownership]=await Promise.all([
   json('/foundation/v28.3/catalog-manifest.json'),json('/foundation/v28.2/primary-network.json'),json('/foundation/v29.6/ownership/manifest.json')]);
  manifest=index;network=primary;ownershipManifest=ownership;
  const overview=await json('/foundation/v28.3/'+index.pages[0].path);
  catalogAssets=overview;assets=mergeAssets([...catalogAssets,...primary.assets],legacy.mines,observations);graph=buildResourceGraph(assets,primary.relationships);bindFilters();restoreFilters();
  render();
  try{const {createGlobe}=await import('./globe-scene.js');engine=createGlobe($('globe'),{markerScale:world==='mines'?1.7:1.3,onCompanyClick:records=>{if(records.length===1)select(byId(records[0].mineId));else{clusterIds=new Set(records.map(r=>r.mineId));limit=100;$('cluster').innerHTML=`<strong>${records.length} Standorte im Cluster</strong><button id="cluster-clear">Cluster auflösen</button>`;$('cluster').hidden=false;$('cluster-clear').onclick=()=>{clusterIds=null;$('cluster').hidden=true;render()};render()}},onNotice:notice,onError:notice,onRotation:active=>$('rotation').setAttribute('aria-pressed',String(active))});render();$('loading').hidden=true;}
  catch(e){$('loading').innerHTML='3D nicht verfügbar. Liste und Datendetails bleiben nutzbar.';console.error(e);for(const id of ['zoom-in','zoom-out','home','rotation'])$(id).disabled=true}
  hydrateLegacy().catch(e=>{notice('Zusatzdaten konnten nicht geladen werden.');console.error(e)});
  $('risk-open').onclick=()=>openRiskOverview();
  $('zoom-in').onclick=()=>engine?.zoom(.84);$('zoom-out').onclick=()=>engine?.zoom(1.19);$('home').onclick=()=>engine?.home();$('rotation').onclick=()=>engine?.toggleRotation();
  const target=new URLSearchParams(location.search).get('id');if(target){const a=await findAsset(target);if(a){if(!visible().some(x=>x.id===a.id)){for(const id of ['status','country','commodity','quality'])$(id).value='all';$('kind').value=a.kind==='operation_group'?'mine':a.kind}$('search').value=a.name;persistFilters();render();select(a)}}
 }catch(e){$('coverage').textContent='Daten nicht geladen';$('loading').innerHTML='Daten konnten nicht geladen werden. <button id="retry">Erneut versuchen</button>';$('retry').onclick=start;console.error(e)}
}
start();
addEventListener('popstate',()=>{if(!assets.length)return;restoreFilters();clusterIds=null;limit=100;render()});
