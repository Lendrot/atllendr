// Risikosignale (Roadmap Ziel 5) im Atlas: Panel auf /kupfer/, Detailbox und Übersicht in der Rohstoffwelt, JSON-Export.
// Reine Anzeige von /assets/risk-signals-view.json (Projektion von analysis/risk-signals.json); hier wird keine Regel ausgewertet.
// APPROVED (belegt) und CANDIDATE (vorläufig) bleiben getrennt. UNKNOWN wird nie als "kein Risiko" dargestellt.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=url=>/^https?:\/\//.test(url||'')?esc(url):'#';
export const BASES=['APPROVED','CANDIDATE'];
export const BASIS_LABEL={APPROVED:'Belegt (APPROVED)',CANDIDATE:'Vorläufig (CANDIDATE)'};
const STATUSES=['SIGNAL','NO_SIGNAL','UNKNOWN'];
export const NOT_CLEARED='keine Entwarnung';
export function statusLabel(basis,status){
 if(status==='SIGNAL')return basis==='APPROVED'?'Belegtes Signal':'Vorläufiger Kandidat · nicht belegt';
 if(status==='NO_SIGNAL')return basis==='APPROVED'?'Regel nicht erfüllt (belegte Grundlage) · '+NOT_CLEARED:'Regel nicht erfüllt (vorläufige Grundlage) · '+NOT_CLEARED;
 return 'UNKNOWN · nicht bewertbar, '+NOT_CLEARED;
}
const RULE_LABEL={BOTTLENECK_FACILITY:'Engpass-Anlage',SINGLE_SUPPLIER:'Einzellieferant',COUNTRY_CONCENTRATION:'Länderkonzentration'};
const REASON={NOT_APPROVED:'Beziehung noch nicht freigegeben',PERIOD_UNKNOWN:'Zeitraum der Beziehung unbekannt (UNKNOWN_PERIOD)',BUYER_SHARE_MISSING:'Anteil am Einsatz des Abnehmers fehlt',
 FACT_STATUS_NOT_FACT:'Beziehung ist kein FACT',HARD_BLOCKER:'Beziehung hat einen harten Prüfblocker',REJECTED:'Beziehung abgelehnt',REFERENCE_TOTAL_MISSING:'Referenzgesamtmenge (z. B. Weltproduktion) fehlt',
 CONFLICTING_CLAIMS:'widersprüchliche Mengenangaben'};
export const reasonLabel=r=>REASON[r]||r||'Grund UNKNOWN';
const chip=(basis,status)=>`<span class="risk-chip risk-${esc(status.toLowerCase())} risk-${esc(basis.toLowerCase())}" data-basis="${esc(basis)}" data-status="${esc(status)}">${basis==='APPROVED'?'Belegt':'Vorläufig'}: ${esc(statusLabel(basis,status))}</span>`;
const count=(xs,f)=>xs.reduce((m,x)=>{const k=f(x);m[k]=(m[k]||0)+1;return m},{});

export function validateView(v){
 const bad=[];
 if(v?.schema!=='atlas.risk-signals-view/1')bad.push('schema');
 const check=(where,basis,status)=>{if(!BASES.includes(basis)||!STATUSES.includes(status))bad.push(where+': '+basis+'/'+status)};
 for(const c of v?.chains||[])for(const b of BASES){check(c.chain_id,b,c.bases?.[b]?.status);for(const [r,s] of Object.entries(c.bases?.[b]?.rules||{}))check(c.chain_id+'/'+r,b,s)}
 for(const key of ['bottleneck_facility','single_supplier','country_concentration'])for(const x of v?.[key]||[])for(const b of BASES)check(key,b,x.bases?.[b]?.status);
 // An evidence-complete signal needs approved relationships; a view claiming one without any approval is inconsistent.
 const n=b=>(v?.bottleneck_facility||[]).filter(x=>x.bases[b].status==='SIGNAL').length+(v?.single_supplier||[]).filter(x=>x.bases[b].status==='SIGNAL').length+(v?.country_concentration||[]).reduce((m,x)=>m+(x.bases[b].signals||[]).length,0);
 if(n('APPROVED')&&!(v.approved_relationships>0))bad.push('APPROVED signal without approved relationships');
 if(n('APPROVED')!==v?.kpi?.signals_evidence_complete||n('CANDIDATE')!==v?.kpi?.signals_candidate)bad.push('KPI counts');
 return bad;
}

function relLine(v,rid){
 const r=v.relationships[rid]||{review_status:'UNKNOWN'};
 const src=(r.sources||[]).map(s=>`<a href="${safe(s.source_url)}" target="_blank" rel="noopener noreferrer">${esc(s.publisher||s.source_id)}</a> (${esc(s.source_quality||'Qualität UNKNOWN')}, abgerufen ${esc(s.accessed_at||'UNKNOWN')})`).join(' · ')||'Quelle UNKNOWN';
 const ev=(r.evidence||[]).map(e=>`${esc(e.verification_status||'UNKNOWN')} · ${e.independent_audit_status==='NOT_AUDITED'?'nicht unabhängig auditiert':esc(e.independent_audit_status||'Audit UNKNOWN')}`).join(' · ')||'Evidenz UNKNOWN';
 return `<li data-relationship="${esc(rid)}"><strong>${r.rank?'Queue-Rang '+esc(r.rank):'ohne Queue-Rang'}</strong> · ${esc(r.from||'?')} → ${esc(r.to||'?')} (${esc(r.relationship_type||'Typ UNKNOWN')}, ${esc(r.material_form||'Material UNKNOWN')})<br><small>Prüfstand ${esc(r.review_status)} · ${esc(r.fact_status||'UNKNOWN')} · Zeit ${esc(r.temporal_status||'UNKNOWN')} · Evidenz ${ev}<br>Quelle: ${src}</small></li>`;
}
const chainName=(v,id)=>v.chains.find(c=>c.chain_id===id)?.name||id;
function reasonsHtml(v,list){
 const by=count(list,e=>e.reason);
 return Object.entries(by).map(([r,n])=>`${esc(reasonLabel(r))} (${n})`).join(' · ')||'—';
}
function otherSignals(v,basis,only){
 const ss=v.single_supplier.filter(x=>x.bases[basis].status==='SIGNAL'&&(!only||x.bases.APPROVED.status!=='SIGNAL')).map(x=>`<article class="risk-card" data-entity="${esc(x.subject.entity_id)}" data-basis="${esc(basis)}"><h4>${esc(RULE_LABEL.SINGLE_SUPPLIER)}: ${esc(x.subject.name)}</h4><p>${chip(basis,'SIGNAL')}</p><p class="small">Belegte Abnehmeranteile: ${(x.bases[basis].known_shares||[]).map(k=>esc(JSON.stringify(k))).join(' · ')||'UNKNOWN'}</p><p class="small mono">${esc(x.bases[basis].derived_record_id)}</p></article>`);
 const cc=v.country_concentration.flatMap(c=>(c.bases[basis].signals||[]).map(sig=>`<article class="risk-card" data-basis="${esc(basis)}"><h4>${esc(RULE_LABEL.COUNTRY_CONCENTRATION)}: ${esc(sig.country)} · ${esc(c.stage)}</h4><p>${chip(basis,'SIGNAL')}</p><p class="small">${esc(JSON.stringify(sig))}</p></article>`));
 return ss.concat(cc).join('');
}
function bottleneckCard(v,x,basis){
 const b=x.bases[basis],other=basis==='APPROVED'?'CANDIDATE':'APPROVED';
 const chains=(b.chains.length?b.chains.map(c=>c.chain_id):x.structural_chains).map(id=>esc(chainName(v,id))).join(', ');
 return `<article class="risk-card" data-entity="${esc(x.subject.entity_id)}" data-basis="${esc(basis)}"><h4>${esc(x.subject.name)}</h4><p>${chip(basis,b.status)} ${chip(other,x.bases[other].status)}</p>
 <p class="small">${esc(x.subject.entity_type)} · ${esc(x.subject.country||'Land UNKNOWN')} · Ketten: ${chains}<br>Kartenpunkt: ${x.subject.map_point==='UNKNOWN'?'UNKNOWN · keine belegte Koordinate, daher kein Punkt auf dem Globus':'Quellenkoordinate vorhanden'} · Belegte Alternative: ${x.documented_alternatives?esc(x.documented_alternatives):'keine (Ersatzkapazität UNKNOWN)'}</p>
 ${basis==='CANDIDATE'&&x.unlock_relationship_ids.length?`<p class="small">Belegt erst nach Freigabe von ${x.unlock_relationship_ids.length} Beziehungen:</p><ul class="risk-rels">${x.unlock_relationship_ids.map(r=>relLine(v,r)).join('')}</ul>`:''}
 ${b.excluded_inputs?.length?`<p class="small">Nicht verwendete Eingaben: ${reasonsHtml(v,b.excluded_inputs)}</p>`:''}
 <p class="small mono">${esc(b.derived_record_id)}</p></article>`;
}

export function renderRiskOverview(v){
 const bad=validateView(v);if(bad.length)throw Error('Risikosignale inkonsistent: '+bad.join(', '));
 const bn=v.bottleneck_facility;
 const approved=bn.filter(x=>x.bases.APPROVED.status==='SIGNAL'),candidate=bn.filter(x=>x.bases.CANDIDATE.status==='SIGNAL'&&x.bases.APPROVED.status!=='SIGNAL');
 const unknownBn=bn.filter(x=>x.bases.APPROVED.status==='UNKNOWN'&&x.bases.CANDIDATE.status==='UNKNOWN');
 const ss=v.single_supplier,ssBy=b=>count(ss,x=>x.bases[b].status),ssReasons=b=>reasonsHtml(v,ss.flatMap(x=>x.bases[b].missing_inputs||[]));
 const rows=v.chains.map(c=>`<tr data-chain="${esc(c.chain_id)}"><th>${esc(c.name)}</th>${BASES.map(b=>`<td>${chip(b,c.bases[b].status)}<br><small>${Object.entries(c.bases[b].rules).map(([r,s])=>`${esc(RULE_LABEL[r]||r)}: ${s==='UNKNOWN'?'UNKNOWN':s==='SIGNAL'?'Signal':'nicht erfüllt'}`).join(' · ')}</small></td>`).join('')}</tr>`).join('');
 return `<div class="risk-kpis"><p><strong>${v.kpi.signals_evidence_complete}</strong> belegte Signale (APPROVED)</p><p><strong>${v.kpi.signals_candidate}</strong> vorläufige Kandidaten (CANDIDATE)</p><p><strong>${v.approved_relationships}</strong> freigegebene Kupferbeziehungen</p><p><strong>${v.kpi.chains}</strong> Ketten im Scope</p></div>
 <p class="small">Regeln und Schwellen: ${esc(v.rules_status)} (noch nicht vom Nutzer abgenommen). Jedes Signal ist eine INFERENCE mit Lineage, kein FACT. ${esc(v.scope)}</p>
 <section class="risk-basis risk-basis-approved" data-basis="APPROVED"><h3>Belegt (APPROVED)</h3>${v.kpi.signals_evidence_complete?approved.map(x=>bottleneckCard(v,x,'APPROVED')).join('')+otherSignals(v,'APPROVED'):`<p class="risk-empty">0 belegte Signale. Grund: ${v.approved_relationships?'keine Regel auf freigegebener Grundlage erfüllt':'noch keine Kupferbeziehung freigegeben'}. Das ist ${NOT_CLEARED}: belegte Bewertungen stehen aus.</p>`}</section>
 <section class="risk-basis risk-basis-candidate" data-basis="CANDIDATE"><h3>Vorläufig (CANDIDATE)</h3><p class="small">Grundlage sind prüfbare, noch nicht freigegebene Beziehungen. Nicht für Beratung oder Entscheidungen verwenden, bevor sie belegt sind.</p>${(candidate.map(x=>bottleneckCard(v,x,'CANDIDATE')).join('')+otherSignals(v,'CANDIDATE',true))||'<p class="risk-empty">Keine vorläufigen Kandidaten außerhalb der belegten Signale.</p>'}</section>
 <section class="risk-basis risk-basis-unknown" data-basis="UNKNOWN"><h3>Nicht bewertbar (UNKNOWN)</h3><p class="small">UNKNOWN heißt: Eingaben fehlen oder sind unzulässig. Es ist ${NOT_CLEARED} und kein Nachweis, dass kein Risiko besteht.</p>
 <details><summary>Engpass-Anlagen ohne bewertbare Eingaben (${unknownBn.length})</summary>${unknownBn.map(x=>`<p class="small" data-entity="${esc(x.subject.entity_id)}">${chip('APPROVED','UNKNOWN')}${chip('CANDIDATE','UNKNOWN')} <strong>${esc(x.subject.name)}</strong> · ${esc(x.subject.country||'')} · strukturell in ${x.structural_chains.map(id=>esc(chainName(v,id))).join(', ')} · ${reasonsHtml(v,x.bases.CANDIDATE.excluded_inputs)}</p>`).join('')}</details>
 <details><summary>Einzellieferant: ${ss.length} Anlagen</summary>${BASES.map(b=>`<p class="small">${esc(BASIS_LABEL[b])}: ${Object.entries(ssBy(b)).map(([s,n])=>`${n} × ${esc(statusLabel(b,s))}`).join(' · ')}<br>Gründe: ${ssReasons(b)}</p>`).join('')}</details>
 <details><summary>Länderkonzentration: ${v.country_concentration.length} Stufen</summary>${v.country_concentration.map(c=>`<p class="small">${esc(c.stage)} · ${BASES.map(b=>chip(b,c.bases[b].status)+' '+esc(reasonLabel(c.bases[b].reason))).join(' · ')}</p>`).join('')}</details></section>
 <details><summary>Alle ${v.chains.length} Ketten nach Grundlage</summary><div class="table-scroll"><table class="risk-table"><thead><tr><th>Kette</th><th>Belegt (APPROVED)</th><th>Vorläufig (CANDIDATE)</th></tr></thead><tbody>${rows}</tbody></table></div></details>
 <p class="small">Nutzungseinschränkungen: ${v.usage_restrictions.map(esc).join(' · ')}</p>`;
}

// Short box for one chain, used in the Rohstoffwelt detail panel.
export function renderChainRisk(v,chainId){
 const c=v.chains.find(x=>x.chain_id===chainId);if(!c)return '';
 const hits=v.bottleneck_facility.filter(x=>x.structural_chains.includes(chainId));
 return `<section class="risk-box" data-chain="${esc(chainId)}"><h3>Risikosignale · ${esc(c.name)}</h3><p>${BASES.map(b=>chip(b,c.bases[b].status)).join(' ')}</p>${hits.map(x=>`<p class="small"><strong>${esc(RULE_LABEL.BOTTLENECK_FACILITY)}: ${esc(x.subject.name)}</strong><br>${BASES.map(b=>esc(BASIS_LABEL[b])+': '+esc(statusLabel(b,x.bases[b].status))).join('<br>')}${x.subject.map_point==='UNKNOWN'?'<br>Standort der Anlage UNKNOWN, kein Kartenpunkt.':''}</p>`).join('')}<p class="small">Einzellieferant und Länderkonzentration: ${esc(statusLabel('APPROVED',c.bases.APPROVED.rules.SINGLE_SUPPLIER))}. <a href="/kupfer/#risikosignale">Alle Risikosignale mit Quellen →</a></p></section>`;
}

export function riskExport(v,now=new Date()){
 const bad=validateView(v);if(bad.length)throw Error('Export gesperrt: '+bad.join(', '));
 const bn=x=>({rule:'BOTTLENECK_FACILITY',subject:x.subject,chains:x.structural_chains});
 const section=b=>({basis:b,meaning:b==='APPROVED'?'Nur freigegebene Beziehungen. Kennzahl des Meilensteins.':'Prüfbare, nicht freigegebene Beziehungen. Vorläufig, nicht belegt.',
  signals:v.bottleneck_facility.filter(x=>x.bases[b].status==='SIGNAL').map(x=>({...bn(x),status:'SIGNAL',derived_record_id:x.bases[b].derived_record_id,
   path_relationships:x.bases[b].chains.flatMap(c=>c.path_relationship_ids).map(id=>({relationship_id:id,...v.relationships[id]})),
   unlock_relationships:b==='CANDIDATE'?x.unlock_relationship_ids.map(id=>({relationship_id:id,...v.relationships[id]})):[]})),
  chains:v.chains.map(c=>({chain_id:c.chain_id,name:c.name,status:c.bases[b].status,rules:c.bases[b].rules}))});
 const unknown=[...v.bottleneck_facility.flatMap(x=>BASES.filter(b=>x.bases[b].status==='UNKNOWN').map(b=>({...bn(x),basis:b,status:'UNKNOWN',reasons:x.bases[b].excluded_inputs}))),
  ...v.single_supplier.flatMap(x=>BASES.filter(b=>x.bases[b].status==='UNKNOWN').map(b=>({rule:'SINGLE_SUPPLIER',subject:x.subject,chains:x.chains,basis:b,status:'UNKNOWN',reasons:x.bases[b].missing_inputs}))),
  ...v.country_concentration.flatMap(x=>BASES.filter(b=>x.bases[b].status==='UNKNOWN').map(b=>({rule:'COUNTRY_CONCENTRATION',stage:x.stage,basis:b,status:'UNKNOWN',reasons:[{reason:x.bases[b].reason}]})))];
 return {schema:'atlas.risk-signals-export/1',exported_at:now.toISOString(),source:v.source,source_output_sha256:v.source_output_sha256,fact_status:v.fact_status,
  rules_status:v.rules_status,scope:v.scope,usage_restrictions:[...v.usage_restrictions,'UNKNOWN_IS_NOT_NO_RISK','CANDIDATE_IS_NOT_EVIDENCE'],
  unknown_semantics:'UNKNOWN bedeutet fehlende oder unzulässige Eingaben. Es ist keine Entwarnung und kein Nachweis, dass kein Risiko besteht.',
  kpi:v.kpi,approved:section('APPROVED'),candidate:section('CANDIDATE'),unknown};
}

let cached=null;
export function loadRiskView(){if(!cached)cached=fetch('/assets/risk-signals-view.json').then(r=>{if(!r.ok)throw Error('Risikosignale '+r.status);return r.json()}).catch(e=>{cached=null;throw e});return cached}
function download(content,name){const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function bindRiskExport(button,v,status){button.disabled=false;button.onclick=()=>{try{download(JSON.stringify(riskExport(v),null,2),'atlas-risikosignale-kupfer.json')}catch(e){if(status)status.textContent=e.message;console.error(e)}}}

export async function mountRiskPanel(root){
 const out=root.querySelector('#risk-result'),status=root.querySelector('#risk-status');
 try{const v=await loadRiskView();out.innerHTML=renderRiskOverview(v);status.textContent=`Stand der Auswertung: ${v.source_output_sha256.slice(0,12)} · ${v.kpi.signals_evidence_complete} belegt, ${v.kpi.signals_candidate} vorläufig.`;bindRiskExport(root.querySelector('#risk-export'),v,status)}
 catch(e){status.textContent='Risikosignale nicht geladen: '+e.message+'. Ohne Daten gilt nichts als risikofrei.';console.error(e)}
}
if(typeof document!=='undefined'&&document.getElementById('risikosignale'))mountRiskPanel(document.getElementById('risikosignale'));
