// Kupfer-Marktübersicht (/kupfer/markt/): Angebot, Konzentration je Kettenstufe, Kapazität vs. Ausstoß, Angebot vs. Nachfrage,
// Abnehmer-Rückwärtsansicht. Reine Anzeige von /assets/copper-market-view.json (Kopie von analysis/copper-market.json aus
// scripts/analysis/build_copper_market.py); hier wird nichts neu berechnet außer Diagrammgeometrie.
// Anteile in Abschnitt 1 bis 3 beziehen sich auf den erfassten Bestand; Weltanteile nur gegen die freigegebene USGS-Referenz. UNKNOWN wird nie als 0 gezeichnet.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=url=>/^https?:\/\//.test(url||'')?esc(url):'#';
const fmt=(v,d=1)=>v==null?'UNKNOWN':Number(v).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});
// Farbe folgt dem Land, nie dem Rang (validiert gegen die dunkle Panelfläche #10232f).
export const COUNTRY_COLOR={'Chile':'#3987e5','Peru':'#d95926','Sambia':'#199e70','DR Kongo':'#c98500','Australien':'#d55181','Indonesien':'#008300','USA':'#9085e9','China':'#e66767'};
const OTHER='#6f8792';
const color=c=>COUNTRY_COLOR[c]||OTHER;
export const NOT_ZERO='UNKNOWN · kein Wert, nicht 0';
const REASON={NO_CLAIM_FOR_YEAR:'keine Produktionsangabe für das Jahr im Ledger',CONFLICTING_CLAIMS:'widersprüchliche Quellenwerte, nicht gemittelt',
 EQUITY_SHARE_ONLY:'nur Beteiligungsanteil berichtet (kein 100-%-Wert)',NO_ADMISSIBLE_CLAIM:'keine zulässige Angabe',AMBIGUOUS_TOTAL:'mehrere Gesamtwerte',
 AMBIGUOUS_PRODUCT_CLAIMS:'mehrere Werte für dasselbe Produkt',PERIOD_MISMATCH:'Teilwerte mit verschiedenen Zeiträumen',UNIT_UNKNOWN:'Einheit unbekannt',
 MATERIAL_BASIS_MISMATCH:'Kapazität in Konzentrat, Ausstoß in Metall: nicht vergleichbar',NO_OUTPUT_FOR_YEAR:'kein zuordenbarer Ausstoß im Jahr',
 REFERENCE_SOURCE_NOT_APPROVED:'Referenzquelle für Weltzahlen noch nicht freigegeben',NOT_IN_REFERENCE:'in der Referenzquelle nicht enthalten'};
export const reasonLabel=r=>REASON[r]||r||'Grund UNKNOWN';
const STATUS_ORDER=['APPROVED','VERIFIED','REVIEW_READY','BLOCKED','REJECTED','NOT_IN_REVIEW_QUEUE'];
const STATUS_LABEL={APPROVED:'freigegeben',VERIFIED:'bestätigt',REVIEW_READY:'prüfbereit',BLOCKED:'blockiert',REJECTED:'abgelehnt',NOT_IN_REVIEW_QUEUE:'nicht in der Prüfliste'};
const short=n=>String(n).replace(/ — berichtete Unternehmensgruppe| — berichteter [^·]*$| division mine complex| minerals district \/ PTFI integrated mine| \/ Bingham Canyon mine/g,'').replace(/ copper /g,' ');

export function validateView(v){
 const bad=[];
 if(v?.schema!=='atlas.copper-market/1')bad.push('schema');
 if(v?.fact_status!=='INFERENCE')bad.push('fact_status');
 for(const r of v?.supply?.rows||[]){
  if(r.value_kt==null&&r.status!=='UNKNOWN')bad.push(r.chain_id+': Wert fehlt ohne UNKNOWN');
  if(r.value_kt!=null&&(!(r.value_kt>0)||!r.input_claims?.length))bad.push(r.chain_id+': Wert ohne Eingabe-Claim');
  if(r.value_kt==null&&!r.unknown_reason)bad.push(r.chain_id+': UNKNOWN ohne Grund');
 }
 const known=(v?.supply?.rows||[]).filter(r=>r.value_kt!=null);
 const tot=Math.round(known.reduce((m,r)=>m+r.value_kt,0)*10)/10;
 if(Math.abs(tot-(v?.kpi?.recorded_mine_supply_kt??-1))>0.05)bad.push('KPI Minenangebot');
 if(known.length!==v?.kpi?.mines_with_value)bad.push('KPI Minenzahl');
 if(v?.world_reference?.status!=='UNKNOWN'&&!(v?.world_reference?.sources||[]).length)bad.push('Weltreferenz ohne Quelle');
 if(v?.world_reference?.status!=='UNKNOWN'&&v?.world_reference?.consumption?.status!=='UNKNOWN'&&!v?.world_reference?.consumption?.sources?.length)bad.push('Weltnachfrage ohne Quelle');
 for(const r of v?.supply?.rows||[])if(r.candidate&&(r.value_kt!=null||!r.candidate.source?.source_url||!r.candidate.quote_fragments?.length))bad.push(r.chain_id+': Kandidat ohne Quelle oder im Ledgerwert');
 for(const b of v?.balance||[])if(b.difference!=='NOT_COMPUTED')bad.push('Bilanzdifferenz berechnet');
 for(const u of v?.utilisation||[])if(u.status==='INFERENCE'&&(u.capacity?.material_basis==='CONCENTRATE'))bad.push('Auslastung über verschiedene Materialbasen');
 return bad;
}
const guard=v=>{const b=validateView(v);if(b.length)throw Error('Marktdaten inkonsistent: '+b.join('; '))};

const statusChips=counts=>STATUS_ORDER.filter(s=>counts?.[s]).map(s=>`<span class="mk-st mk-st-${s.toLowerCase()}" data-review="${s}">${counts[s]} ${STATUS_LABEL[s]}</span>`).join(' ')||'<span class="mk-st">keine Beziehungen</span>';
const unknownTag=r=>`<span class="mk-unknown" data-status="UNKNOWN">${NOT_ZERO}: ${esc(reasonLabel(r))}</span>`;
const claimSrc=c=>(c?.sources||[]).map(s=>`<a href="${safe(s.source_url)}" target="_blank" rel="noopener noreferrer">${esc(s.publisher||s.source_id)}</a>`).join(', ')||'Quelle UNKNOWN';
const period=p=>!p?'':p.period_type==='FISCAL_YEAR'?`GJ ${esc((p.period_start||'').slice(0,7))} bis ${esc((p.period_end||'').slice(0,7))}`:p.period_type==='CALENDAR_YEAR'?`KJ ${esc((p.period_start||'').slice(0,4))}`:esc(p.period_type);

export function renderKpis(v){
 guard(v);const k=v.kpi,c=v.supply.by_country;
 return `<div class="mk-kpis">
 <p><span>Erfasstes Minenangebot ${k.year}</span><strong>${fmt(k.recorded_mine_supply_kt)} kt</strong><small>Kupferinhalt, ${k.mines_with_value} von ${k.chains} Minen mit Wert; ${k.mines_unknown} UNKNOWN${k.candidate_mines?` · mit belegten Kandidaten ${fmt(k.recorded_incl_fact_candidates_kt)} kt`:''}</small></p>
 <p><span>Länderkonzentration (HHI)</span><strong>${fmt(k.supply_hhi_country,0)}</strong><small>${esc(c.groups[0]?.group||'UNKNOWN')} ${fmt(c.top1_share_pct)} % des erfassten Werts · nur erfasster Bestand</small></p>
 <p><span>Belegstand der Beziehungen</span><strong>${fmt(k.approved_share_pct)} %</strong><small>${k.review_status_counts.APPROVED||0} von ${k.relationships} freigegeben (APPROVED)</small></p>
 <p><span>Anteil an der Weltminenproduktion</span><strong>${fmt(k.world_coverage_pct)} %</strong><small>von ${fmt(k.world_mine_kt,0)} kt Welt ${k.year} (USGS-Schätzung) · Weltnachfrage UNKNOWN</small></p></div>`;
}

// Horizontales Balkendiagramm Minenangebot, Farbe = Land, UNKNOWN als gestrichelte Leerzeile mit Grund.
export function renderSupplyChart(v){
 guard(v);const rows=[...v.supply.rows].sort((a,b)=>(b.value_kt??-1)-(a.value_kt??-1)||a.name.localeCompare(b.name));
 const max=Math.max(...rows.map(r=>r.value_kt||0)),W=640,L=150,R=70,H=26,top=8,h=top+rows.length*H+24,sx=x=>(W-L-R)*x/max;
 const ticks=[0,250,500,750,1000,1250].filter(t=>t<=max*1.05);
 const bars=rows.map((r,i)=>{const y=top+i*H;const label=`<text x="${L-8}" y="${y+H/2+4}" text-anchor="end" class="mk-lbl">${esc(short(r.name))}</text>`;
  if(r.value_kt==null&&r.candidate){const c=r.candidate,w=Math.max(2,sx(c.value_kt)),inf=c.fact_status==='INFERENCE';
   return `<g data-chain="${esc(r.chain_id)}" data-status="UNKNOWN" data-candidate="${esc(c.fact_status)}">${label}<rect x="${L}" y="${y+5}" width="${w}" height="${H-10}" rx="4" class="mk-cand-bar${inf?' mk-cand-inf':''}"><title>${esc(r.name)}: Ledger ${NOT_ZERO} (${esc(reasonLabel(r.unknown_reason))}). Kandidat ${inf?'INFERENCE':'FACT'} ${fmt(c.value_kt)} kt (${esc(c.source.publisher)}), nicht im Ledger</title></rect><text x="${L+w+6}" y="${y+H/2+4}" class="mk-cand-txt">${inf?'≈':''}${fmt(c.value_kt)} · Kandidat${inf?' (INFERENCE)':''}, nicht im Ledger</text></g>`}
  if(r.value_kt==null)return `<g data-chain="${esc(r.chain_id)}" data-status="UNKNOWN">${label}<rect x="${L}" y="${y+5}" width="${W-L-R}" height="${H-10}" rx="4" class="mk-unk-bar"><title>${esc(r.name)}: ${NOT_ZERO} (${esc(reasonLabel(r.unknown_reason))})</title></rect><text x="${L+8}" y="${y+H/2+4}" class="mk-unk-txt">UNKNOWN · ${esc(reasonLabel(r.unknown_reason))}</text></g>`;
  const w=Math.max(2,sx(r.value_kt));
  return `<g data-chain="${esc(r.chain_id)}" data-status="INFERENCE">${label}<rect x="${L}" y="${y+5}" width="${w}" height="${H-10}" rx="4" fill="${color(r.country)}"><title>${esc(r.name)} (${esc(r.country)}): ${fmt(r.value_kt)} kt, ${period(r.period).replace(/<[^>]+>/g,'')}</title></rect><text x="${L+w+6}" y="${y+H/2+4}" class="mk-val">${fmt(r.value_kt)}</text></g>`}).join('');
 const grid=ticks.map(t=>`<line x1="${L+sx(t)}" x2="${L+sx(t)}" y1="${top}" y2="${h-22}" class="mk-grid"/><text x="${L+sx(t)}" y="${h-6}" text-anchor="middle" class="mk-axis">${fmt(t,0)}</text>`).join('');
 return `<figure class="mk-fig"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="Minenangebot ${v.kpi.year} je Mine in Kilotonnen Kupferinhalt">${grid}${bars}</svg><figcaption>kt Kupferinhalt, 100 % Betrieb, volles Berichtsjahr ${v.kpi.year} (BHP-Minen: Geschäftsjahr Juli bis Juni). Gestrichelt = Kandidat aus einer neuen Quelle, noch nicht im Ledger und nicht in der Summe; „≈“ = hochgerechnet (INFERENCE). ${legend(rows.map(r=>r.country))}</figcaption></figure>`;
}
function legend(countries){
 const seen=[...new Set(countries)].filter(c=>c!=='UNKNOWN');
 return `<span class="mk-legend">${seen.map(c=>`<span><i style="background:${color(c)}"></i>${esc(c)}</span>`).join('')}</span>`;
}

// 100-%-Balken (Anteile am bekannten Teil) plus Tabelle; UNKNOWN-Mitglieder werden daneben genannt, nie eingerechnet.
export function renderShareBar(s,title,key){
 const segs=s.groups.map(g=>`<span class="mk-seg" style="width:${g.share_pct}%;background:${key==='country'?color(g.group):g.group==='UNKNOWN'?'transparent':OTHER}" data-group="${esc(g.group)}" ${g.group==='UNKNOWN'?'data-status="UNKNOWN"':''} title="${esc(g.group)}: ${fmt(g.share_pct)} %"></span>`).join('');
 const rows=s.groups.map(g=>`<tr><td>${key==='country'?`<i class="mk-dot" style="background:${color(g.group)}"></i>`:''}${esc(short(g.group))}${g.group==='UNKNOWN'?' <small>Betreiber im Ledger nicht belegt</small>':''}</td><td>${fmt(g.value_kt)} kt</td><td>${fmt(g.share_pct)} %</td><td><small>${g.members.map(m=>esc(short(m))).join(', ')}</small></td></tr>`).join('');
 return `<section class="mk-share"><h3>${esc(title)}</h3><div class="mk-bar${key==='operator'?' mk-bar-op':''}">${segs}</div>
 <p class="small">HHI ${fmt(s.hhi_known,0)} · größter Anteil ${fmt(s.top1_share_pct)} % · Top 3 ${fmt(s.top3_share_pct)} % · Basis ${fmt(s.known_total_kt)} kt. Ohne Wert (nicht eingerechnet): ${s.unknown_members.map(m=>esc(short(m))).join(', ')||'keine'}.</p>
 <div class="table-scroll"><table><thead><tr><th>${key==='country'?'Land':'Betreiber'}</th><th>Menge</th><th>Anteil</th><th>Minen</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

// Liniendiagramm Angebotsentwicklung; Jahre mit UNKNOWN unterbrechen die Linie und tragen eine Markierung.
export function renderHistory(v){
 guard(v);const S=v.supply_history;if(!S.length)return '<p class="empty">Keine Mine mit mindestens drei Jahreswerten.</p>';
 const years=[...new Set(S.flatMap(s=>s.points.map(p=>p.year)))].sort(),W=640,L=48,R=110,T=10,B=26,H=240;
 const max=Math.max(...S.flatMap(s=>s.points.map(p=>p.value_kt||0)))*1.08,x=y=>L+(W-L-R)*(years.indexOf(y))/(years.length-1),y=val=>T+(H-T-B)*(1-val/max);
 const cols=['#3987e5','#d95926','#199e70','#c98500','#d55181','#9085e9','#e66767'];
 const lines=S.map((s,i)=>{const c=cols[i%cols.length];let d='',pen=false;const marks=[];
  for(const p of s.points){if(p.value_kt==null){pen=false;marks.push(`<g data-status="UNKNOWN"><text x="${x(p.year)}" y="${H-B-6}" text-anchor="middle" class="mk-unk-txt">?</text><title>${esc(s.name)} ${p.year}: ${NOT_ZERO} (${esc(reasonLabel(p.unknown_reason))})</title></g>`);continue}
   d+=(pen?'L':'M')+x(p.year).toFixed(1)+' '+y(p.value_kt).toFixed(1)+' ';pen=true;
   marks.push(`<circle cx="${x(p.year)}" cy="${y(p.value_kt)}" r="4" fill="${c}" class="mk-pt"><title>${esc(s.name)} ${p.year} (${p.period_type==='FISCAL_YEAR'?'Geschäftsjahr':'Kalenderjahr'}): ${fmt(p.value_kt)} kt</title></circle>`)}
  return `<g data-series="${esc(s.chain_id)}"><path d="${d}" fill="none" stroke="${c}" stroke-width="2"/>${marks.join('')}</g>`}).join('');
 // Endbeschriftungen rechts, vertikal entzerrt (mindestens 13 px Abstand), damit sich nahe Linien nicht überdecken.
 const ends=S.map((s,i)=>{const last=[...s.points].reverse().find(p=>p.value_kt!=null);return {s,c:cols[i%cols.length],x:x(last.year),y:y(last.value_kt)+4}}).sort((a,b)=>a.y-b.y);
 for(let i=1;i<ends.length;i++)if(ends[i].y-ends[i-1].y<13)ends[i].y=ends[i-1].y+13;
 const labels=ends.map(e=>`<text x="${W-R+8}" y="${e.y.toFixed(1)}" class="mk-lbl" style="fill:${e.c}">${esc(short(e.s.name))}</text>`).join('');
 const grid=[0,250,500,750,1000,1250].filter(t=>t<max).map(t=>`<line x1="${L}" x2="${W-R}" y1="${y(t)}" y2="${y(t)}" class="mk-grid"/><text x="${L-6}" y="${y(t)+4}" text-anchor="end" class="mk-axis">${fmt(t,0)}</text>`).join('');
 const xa=years.map(t=>`<text x="${x(t)}" y="${H-6}" text-anchor="middle" class="mk-axis">${t}</text>`).join('');
 return `<figure class="mk-fig"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minenangebot je Jahr, Minen mit mindestens drei Jahreswerten">${grid}${xa}${lines}${labels}</svg><figcaption>kt Kupferinhalt je Berichtsjahr. Escondida und Spence berichten Geschäftsjahre (Juli bis Juni), die übrigen Kalenderjahre; Jahre sind deshalb nur innerhalb einer Linie vergleichbar. „?“ = UNKNOWN (z. B. Kamoa-Kakula 2024/2025: zwei abweichende Quellenwerte).</figcaption></figure>`;
}

// Konzentration je Kettenstufe: Kennzahlen, Länderanteil nach Ketten, Kapazität je Land (nur gleiche Materialbasis).
export function renderStages(v){
 guard(v);
 return `<div class="mk-stages">${v.stages.map(s=>{
  const seg=s.country_share_by_chains.map(c=>`<span class="mk-seg" style="width:${100*c.chains/s.country_share_by_chains.reduce((m,x)=>m+x.chains,0)}%;background:${color(c.country)}" title="${esc(c.country)}: ${c.chains} Ketten"></span>`).join('');
  const caps=(s.capacity_by_country||[]).map(b=>`<p class="small">Kapazität (${esc(b.material_basis==='CONCENTRATE'?'t Konzentrat/Jahr':b.material_basis==='REFINED_METAL'?'t Metall/Jahr':b.material_basis)}): ${b.groups.map(g=>`${esc(g.country)} ${fmt(g.kt_per_year,0)} kt (${fmt(g.share_pct,0)} %)`).join(' · ')} · ${b.facilities_with_capacity} Anlagen mit Wert, ${b.facilities_without_capacity} UNKNOWN</p>`).join('');
  return `<article class="mk-stage" data-stage="${esc(s.stage)}"><h3>${esc(s.label)}</h3>
  <p class="mk-stage-n"><strong>${s.facilities}</strong> Anlagen · <strong>${s.countries}</strong> Länder · ${s.chains_covered} von ${s.chains_covered+s.chains_without_stage} Ketten belegt</p>
  <div class="mk-bar">${seg}</div>
  <p class="small">${s.country_share_by_chains.slice(0,3).map(c=>`${esc(c.country)} ${fmt(c.share_pct,0)} %`).join(' · ')} der Ketten mit belegter Stufe · HHI ${fmt(s.hhi_country_by_facility_count,0)} (<span class="mk-hhi mk-hhi-${esc(s.hhi_level.toLowerCase())}">${esc(s.hhi_level)}</span>)${s.max_chains_one_facility>1?` · eine Anlage bedient bis zu ${s.max_chains_one_facility} Ketten`:''}</p>
  ${caps}${s.chains_without_stage?`<p class="small">${s.chains_without_stage} Ketten ohne belegte ${esc(s.label)}-Stufe: UNKNOWN, nicht „keine Anlage“.</p>`:''}
  ${s.stage==='MINE'?'':`<p class="small">Prüfstand der Beziehungen: ${statusChips(s.review_status_counts)}</p>`}
  <details><summary>Anlagen (${s.rows.length})</summary><ul class="mk-list">${s.rows.map(f=>`<li><i class="mk-dot" style="background:${color(f.country)}"></i>${esc(short(f.name))} · ${esc(f.country)} · ${f.chains.length} Kette(n)${f.capacity?.status==='FACT'?` · Kapazität ${fmt(f.capacity.value,f.capacity.value%1?1:0)} ${esc(f.capacity.unit)}`:f.capacity?' · Kapazität UNKNOWN ('+esc(reasonLabel(f.capacity.unknown_reason))+')':''}</li>`).join('')}</ul></details></article>`}).join('')}</div>`;
}

// Kapazität vs. Ausstoß: Kapazität als Rahmen, Ausstoß als Füllung, nur bei gleicher Materialbasis.
export function renderUtilisation(v){
 guard(v);const ok=v.utilisation.filter(u=>u.status==='INFERENCE'),unk=v.utilisation.filter(u=>u.status!=='INFERENCE');
 const bars=ok.map(u=>`<div class="mk-util" data-entity="${esc(u.entity_id)}"><p><strong>${esc(short(u.name))}</strong> · ${esc(u.country)} <span class="mk-inf">INFERENCE</span></p>
  <div class="mk-cap" title="Kapazität ${fmt(u.capacity.value_kt_per_year)} kt/Jahr"><span style="width:${Math.min(100,u.utilisation_pct)}%;background:${color(u.country)}" title="Ausstoß ${fmt(u.output_kt)} kt"></span></div>
  <p class="small">${fmt(u.output_kt)} kt Ausstoß ${period(u.output_claim)} von ${fmt(u.capacity.value_kt_per_year)} kt/Jahr Kapazität = <strong>${fmt(u.utilisation_pct)} %</strong>${u.output_via==='MINE_CATHODE_OF_ONLY_SXEW'?' · Ausstoß = Kathodenproduktion der Mine (einzige SX-EW-Anlage)':''}${u.restrictions?.includes('CAPACITY_WITHOUT_PERIOD')?' · Kapazität ohne Jahresbezug in der Quelle':''}<br>Quellen: ${claimSrc(u.capacity.claim)} · ${claimSrc(u.output_claim)}</p></div>`).join('');
 const rest=unk.map(u=>`<li>${esc(short(u.name))} (${esc(u.country)}): Kapazität ${fmt(u.capacity.value,u.capacity.value%1?1:0)} ${esc(u.capacity.unit)} · ${unknownTag(u.unknown_reason)}</li>`).join('');
 return bars+(rest?`<details><summary>Nicht vergleichbar (${unk.length})</summary><ul class="mk-list">${rest}</ul></details>`:'');
}

// Anlagenbilanz: Angebot der angebundenen Kettenminen neben dem Ausstoß der Anlage; keine Differenz.
export function renderBalance(v){
 guard(v);
 return v.balance.map(b=>{const max=Math.max(b.output_kt,b.linked_mine_supply_known_kt||0)||1;
  return `<div class="mk-bal" data-entity="${esc(b.entity_id)}"><p><strong>${esc(short(b.name))}</strong> · ${esc(b.country)}</p>
  <div class="mk-pair"><span>Minenangebot der angebundenen Ketten</span><div class="mk-cap">${b.linked_mine_supply_known_kt==null?'':`<span style="width:${100*b.linked_mine_supply_known_kt/max}%;background:${color(b.country)}"></span>`}</div><b>${b.linked_mine_supply_known_kt==null?'UNKNOWN':fmt(b.linked_mine_supply_known_kt)+' kt Cu-Inhalt'}</b></div>
  <div class="mk-pair"><span>Ausstoß ${b.stage==='SMELTER'?'Anoden':'Kathoden'} ${esc(v.kpi.year)}</span><div class="mk-cap"><span style="width:${100*b.output_kt/max}%;background:${color(b.country)};opacity:.6"></span></div><b>${fmt(b.output_kt)} kt</b></div>
  <p class="small">${b.linked_mines.map(m=>`${esc(short(m.name))} ${m.value_kt==null?'UNKNOWN':fmt(m.value_kt)+' kt'}`).join(' · ')}. Keine Differenz berechnet: verschiedene Materialbasis, Fremdeinsatz und Konzentratverkäufe sind im Ledger nicht belegt.</p></div>`}).join('')||'<p class="empty">Keine Anlage mit Ausstoß und angebundener Mine.</p>';
}

const srcLink=w=>w.sources.map(s=>`<a href="${safe(s.source_url)}" target="_blank" rel="noopener noreferrer">${esc(s.publisher)}: ${esc(s.title)}</a>`).join(', ');
function worldShare(st,label){
 const segs=st.groups.map(g=>`<span class="mk-seg" style="width:${g.share_pct}%;background:${color(g.country)}" title="${esc(g.country)}: ${fmt(g.share_pct)} %"></span>`).join('')+`<span class="mk-seg" style="width:${100*st.other_countries_kt/st.total_kt}%;background:#3a4f59" title="Übrige Länder (nicht aufgeschlüsselt)"></span>`;
 return `<div class="mk-wshare"><p><strong>${esc(label)}</strong> · ${fmt(st.world_total_rounded_kt,0)} kt · HHI ${fmt(st.hhi_named_countries,0)} (<span class="mk-hhi mk-hhi-${esc(st.hhi_level.toLowerCase())}">${esc(st.hhi_level)}</span>, Untergrenze)</p><div class="mk-bar">${segs}</div>
 <p class="small">${st.groups.slice(0,4).map(g=>`<i class="mk-dot" style="background:${color(g.country)}"></i>${esc(g.country)} ${fmt(g.share_pct)} %`).join(' · ')} · übrige Länder ${fmt(100*st.other_countries_kt/st.total_kt)} % (nicht aufgeschlüsselt)</p></div>`;
}
// Mine gegen Raffinerie je Land: zwei Balken je Land, sortiert nach Überhang; gleiche Einheit (kt Kupferinhalt) und Quelle.
function mineVsRefinery(w){
 const rows=w.mine_vs_refinery,max=Math.max(...rows.flatMap(r=>[r.mine_kt,r.refinery_kt])),W=420,L=84,R=52,H=24,h=rows.length*H+26,sx=x=>(W-L-R)*x/max;
 const g=rows.map((r,i)=>{const y=4+i*H;return `<g data-country="${esc(r.country)}"><text x="${L-8}" y="${y+14}" text-anchor="end" class="mk-lbl">${esc(r.country)}</text>
  <rect x="${L}" y="${y+3}" width="${Math.max(r.mine_kt?2:0,sx(r.mine_kt))}" height="8" rx="3" fill="#3987e5"><title>${esc(r.country)} Mine: ${fmt(r.mine_kt,0)} kt</title></rect>
  <rect x="${L}" y="${y+13}" width="${Math.max(2,sx(r.refinery_kt))}" height="8" rx="3" fill="#d95926"><title>${esc(r.country)} Raffinerie: ${fmt(r.refinery_kt,0)} kt</title></rect>
  <text x="${L+sx(Math.max(r.mine_kt,r.refinery_kt))+6}" y="${y+16}" class="mk-val">${r.mine_minus_refinery_kt>0?'+':''}${fmt(r.mine_minus_refinery_kt,0)}</text></g>`}).join('');
 return `<figure class="mk-fig"><svg viewBox="0 0 ${W} ${h}" role="img" aria-label="Minen- und Raffinadeproduktion je Land ${w.year}">${g}</svg><figcaption><span class="mk-legend"><span><i style="background:#3987e5"></i>Minenproduktion</span><span><i style="background:#d95926"></i>Raffinadeproduktion</span></span>Zahl = Mine minus Raffinerie in kt: positiv heißt, das Land fördert mehr Kupfer, als es raffiniert (Konzentratquelle), negativ heißt Nettoverarbeiter. Raffinerie enthält Sekundärkupfer aus Schrott; das ist kein Handelsstrom.</figcaption></figure>`;
}
export function renderCandidates(v){
 guard(v);const c=v.candidates;if(!c?.rows?.length)return '';
 const rows=c.rows.map(x=>`<li data-candidate-id="${esc(x.candidate_id)}"><strong>${esc(x.chain_id)} ${esc(x.reference_year)}</strong>: ${x.fact_status==='INFERENCE'?'≈ ':''}${fmt(x.value_kt)} kt <span class="${x.fact_status==='INFERENCE'?'mk-inf':'mk-st'}">${esc(x.fact_status)}</span> · ${esc(x.measurement_basis)}<br><small>Quelle: <a href="${safe(x.source.source_url)}" target="_blank" rel="noopener noreferrer">${esc(x.source.publisher)}: ${esc(x.source.source_name)}</a>, ${esc(x.locator)} · Zitat: „${esc(x.quote_fragments.join(' … '))}“${x.derivation?' · Herleitung: '+esc(x.derivation.formula):''}</small></li>`).join('');
 const nc=Object.entries(c.not_covered).map(([k,r])=>`<li>${esc(k)}: ${esc(r)}</li>`).join('');
 return `<details class="mk-cands"><summary>Produktions-Kandidaten aus neuen Quellen (${c.rows.length}), noch nicht im Ledger</summary><ul class="mk-list">${rows}</ul><p class="small">Noch ohne Quelle:</p><ul class="mk-list">${nc}</ul></details>`;
}
export function renderWorld(v){
 guard(v);const w=v.world_reference;
 if(w.status==='UNKNOWN')return `<div class="mk-world" data-status="UNKNOWN"><p><strong>Weltbilanz: UNKNOWN</strong> · ${esc(reasonLabel(w.unknown_reason))}.</p></div>`;
 const cov=w.coverage.by_country.map(c=>`<div class="mk-pair"><span>${esc(c.country)}</span><div class="mk-cap"><span style="width:${c.share_pct??0}%;background:${color(c.country)}"></span></div><b>${fmt(c.recorded_kt,0)} von ${c.world_kt==null?'UNKNOWN':fmt(c.world_kt,0)} kt = ${fmt(c.share_pct)} %</b></div>`).join('');
 return `<div class="mk-worldref"><p class="small">Weltreferenz: ${srcLink(w)} (gemeinfrei), ${esc(w.locator)}. Werte ${w.year} sind Schätzungen der USGS (e). Freigegeben von ${esc(w.approval.decided_by)} am ${esc(w.approval.decided_on)}.</p>
 <div class="mk-grid2"><section>${worldShare(w.mine,'Weltminenproduktion '+w.year)}${worldShare(w.refinery,'Weltraffinadeproduktion '+w.year)}
 <h3>Abdeckung durch den Atlas</h3><p class="small">Erfasstes Minenangebot ${fmt(w.coverage.recorded_kt)} kt = <strong>${fmt(w.coverage.share_of_world_mine_pct)} %</strong> der Weltminenproduktion${w.coverage.share_incl_fact_candidates_pct!=null?`, mit belegten Kandidaten ${fmt(w.coverage.share_incl_fact_candidates_pct)} %`:''} (INFERENCE; Ledger mischt Kalender- und Geschäftsjahre, USGS-Werte sind Schätzungen).</p>${cov}
 <div class="mk-world" data-status="UNKNOWN"><p><strong>Weltnachfrage: UNKNOWN</strong></p><p class="small">Die USGS-Ausgabe 2026 nennt keinen Weltverbrauch, nur den der USA (Raffinadekupfer ${fmt(w.consumption.united_states_refined_kt,0)} kt, Schätzung). Ein Vergleich Weltangebot gegen Weltnachfrage braucht eine zweite Quelle.</p></div></section>
 <section><h3>Wer fördert, wer raffiniert</h3>${mineVsRefinery(w)}</section></div></div>`;
}

// Rückwärts-Ansicht vom Abnehmer: welche Minen und Länder stehen über belegte Beziehungen hinter einem Käufer?
export function renderBuyer(v,id){
 guard(v);const b=v.buyers.find(x=>x.entity_id===id)||v.buyers[0];if(!b)return '<p class="empty">Keine Abnehmer im Ledger.</p>';
 const direct=b.direct.map(d=>`<li>${esc(d.type==='OFFTAKE_AGREEMENT'?'Abnahmevertrag':d.type==='MARKETS_VIA'?'Vermarktung über':d.type==='SUPPLIES'?'Lieferung':d.type==='PROCESSES_AT'?'Verarbeitung bei':'Transport')} von <strong>${esc(short(d.from))}</strong>${d.material_form?' · '+esc(d.material_form):''}${d.seller_side_share_pct!=null?` · ${fmt(d.seller_side_share_pct,0)} % des Verkäufer-Outputs (kein Anteil am Bedarf des Abnehmers)`:''}${d.scope?' · '+esc(d.scope):''}<br><small>${esc(d.fact_status)} · Zeit ${esc(d.temporal_status||'UNKNOWN')} · Prüfstand ${esc(STATUS_LABEL[d.review_status]||d.review_status)}</small></li>`).join('');
 const mines=b.upstream_mines.length?b.upstream_mines.map(m=>`<span class="mk-chip"><i class="mk-dot" style="background:${color(m.country)}"></i>${esc(short(m.mine))} · ${esc(m.country)}</span>`).join(' '):'<span class="mk-unknown" data-status="UNKNOWN">Herkunftsmine UNKNOWN: im Ledger kein Materialfluss bis zu einer Kettenmine belegt</span>';
 return `<article class="mk-buyer" data-entity="${esc(b.entity_id)}"><h3>${esc(short(b.name))} <small>${esc(b.country)}</small></h3>
 <p><strong>Herkunft über belegte Pfade:</strong> ${mines}</p><ul class="mk-list">${direct}</ul>
 <p class="small">Pfad aus ${b.relationship_ids.length} Beziehungen · ${statusChips(b.path_review_status)} · ${Object.entries(b.path_fact_status).map(([k,n])=>`${n} ${esc(k)}`).join(', ')}</p></article>`;
}

export function marketExport(v,now=new Date()){
 guard(v);
 return {schema:'atlas.copper-market-export/1',exported_at:now.toISOString(),source_output_sha256:v.output_sha256,fact_status:'INFERENCE',
  usage_restrictions:v.usage_restrictions,scope:v.scope,kpi:v.kpi,supply:v.supply,stages:v.stages.map(({rows,...s})=>s),utilisation:v.utilisation,balance:v.balance,
  world_reference:v.world_reference,buyers:v.buyers};
}

export async function mount(doc=document){
 const st=doc.getElementById('mk-status');
 try{
  const v=await (await fetch('/assets/copper-market-view.json')).json();guard(v);
  doc.getElementById('mk-kpis').innerHTML=renderKpis(v);
  doc.getElementById('mk-supply').innerHTML=renderSupplyChart(v)+renderCandidates(v);
  doc.getElementById('mk-shares').innerHTML=renderShareBar(v.supply.by_country,'Nach Land','country')+renderShareBar(v.supply.by_operator,'Nach Betreiber (laut Ledger)','operator');
  doc.getElementById('mk-history').innerHTML=renderHistory(v);
  doc.getElementById('mk-stages').innerHTML=renderStages(v);
  doc.getElementById('mk-world').innerHTML=renderWorld(v);
  doc.getElementById('mk-util').innerHTML=renderUtilisation(v);
  doc.getElementById('mk-balance').innerHTML=renderBalance(v);
  const sel=doc.getElementById('mk-buyer-select');
  sel.innerHTML=v.buyers.map(b=>`<option value="${esc(b.entity_id)}">${esc(short(b.name))}${b.upstream_mines.length?' ← '+esc(b.upstream_countries.join(', ')):''}</option>`).join('');
  const show=()=>{doc.getElementById('mk-buyer').innerHTML=renderBuyer(v,sel.value)};sel.disabled=false;sel.onchange=show;show();
  const ex=doc.getElementById('mk-export');ex.disabled=false;ex.onclick=()=>{const a=doc.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(marketExport(v),null,1)],{type:'application/json'}));a.download='atlas-kupfer-markt.json';a.click()};
  st.textContent=`Stand der Daten: ${v.kpi.relationships} Beziehungen, ${v.kpi.review_status_counts.APPROVED||0} freigegeben · Quelle analysis/copper-market.json (${v.output_sha256.slice(0,12)}…)`;
 }catch(e){st.textContent='Marktdaten nicht anzeigbar: '+e.message;st.classList.add('error')}
}
