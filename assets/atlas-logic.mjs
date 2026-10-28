import {countryAnchor,numeric,buildTradeLayer} from './material-logic.mjs';
import {statuses} from './market-logic.mjs';
export const areas={companies:{label:'Unternehmen',color:'#69b5ff',shape:'● →'},waste:{label:'Abfall & Sekundärstoffe',color:'#6bddb0',shape:'◆ ⋯'},resources:{label:'Rohstoffe',color:'#ffb964',shape:'◆ ⋯'},goods:{label:'Waren & Produkte',color:'#e89cab',shape:'◆ ⋯'},money:{label:'Geld & Handelswerte',color:'#c4a1ff',shape:'◇ ⇢'}};
const palette=['#73dce5','#f2c464','#d9a0f4','#ef9a8a','#91d779','#83adff','#e6a8ca','#cecf81','#ffc9a6','#aa9cff','#58ccb2','#ee8aa2','#bfd2ff','#e0d1a2','#82bbdc','#c1ebaf'];
export const africa=new Set(['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CD','CG','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW']);
export function connectionColor(row,area='all'){
 if(area==='all')return areas[row.area]?.color||'#69b5ff';
 if(row.subtypeColor)return row.subtypeColor;
 const hash=[...(row.subtype||'')].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);return palette[hash%palette.length];
}
const hex=s=>Number.parseInt(s.slice(1),16);
const names=new Intl.DisplayNames(['de'],{type:'region'});
export function buildAtlasLayer(market,materials,atlas,features,locationData={relations:[]}){
 const entities={...market.entities},deals=[];
 const nation=code=>{const id='country_'+code.toLowerCase();if(!entities[id]){const f=features.find(x=>String(x.id).padStart(3,'0')===numeric[code]),p=countryAnchor(f);entities[id]={id,name:names.of(code),country:names.of(code),countryCode:code,lat:p?.lat??null,lon:p?.lon??null,place:names.of(code)+' gesamt (Landeswert) · kein Standort',schematic:true};}return id;};
 // A company node takes the sourced location of its canonical company record; otherwise it stays on the schematic country anchor.
 for(const n of atlas.nodes){const id=n.country?nation(n.country):null,site=n.canonical_company_id?market.entities[n.canonical_company_id]:null;
  if(Number.isFinite(site?.lat)&&Number.isFinite(site?.lon)){entities[n.id]={...n,country:n.country?names.of(n.country):'Nicht genauer bekannt',countryCode:n.country,place:site.place,schematic:false,lat:site.lat,lon:site.lon,accuracy:site.accuracy,locationSourceUrl:site.locationSourceUrl,coordinateSourceUrl:site.coordinateSourceUrl,locationNote:site.locationNote};continue;}
  entities[n.id]={...(id?entities[id]:{}),...n,country:n.country?names.of(n.country):'Nicht genauer bekannt',countryCode:n.country,place:n.kind==='country'&&n.country?names.of(n.country)+' gesamt (Landeswert) · kein Standort':'Länderbezug; genauer Standort offen',schematic:true,lat:id&&n.location_status!=='UNKNOWN'?entities[id].lat:null,lon:id&&n.location_status!=='UNKNOWN'?entities[id].lon:null};}
 for(const d of market.deals){deals.push({...d,area:'companies',subtype:statuses[d.status]?.label||d.status,originalDeal:d,title:`${entities[d.buyerId]?.name||'Käufer offen'} → ${entities[d.targetId]?.name||'Ziel offen'}`,relation:'deal',relationType:'deal',relationBasis:'transaction_record',evidenceStatus:d.evidenceStatus||'UNKNOWN',confidence:d.confidence??null,period:d.date?{start:d.date,end:d.date,label:d.date.slice(0,4)}:null,quantity_kg:null,value:null,currency:null,value_basis:null,refs:d.sources||[{url:d.sourceUrl,title:d.sourceTitle||'Transaktionsquelle'}],note:d.note||'',chain_id:null});}
 for(const e of atlas.edges){deals.push({...e,buyerId:e.from,targetId:e.to,flowKind:e.area==='companies'?null:e.relation,status:e.area==='companies'?'completed':undefined,relationType:e.relation,relationBasis:e.relation,evidenceStatus:e.evidence,refs:e.source_ids.map(id=>atlas.sources.find(s=>s.id===id)),isAtlas:true});}
 for(const r of materials.observations.filter(r=>r.scope==='partner'&&r.quantity>0)){
  const from=r.metric==='import'?r.partner_country:'IN',to=r.metric==='import'?'IN':r.partner_country;
  const material=materials.materials.find(m=>m.id===r.material_id),area=r.material_id.startsWith('waste_')?'waste':'resources';
  deals.push({id:r.id,buyerId:nation(from),targetId:nation(to),flowKind:r.metric,area,subtype:material?.name||r.material_id,title:`${material?.name||r.material_id}: ${names.of(from)} → ${names.of(to)}`,relation:r.relation_basis||'reported_trade',relationType:r.relation_basis||'reported_trade',relationBasis:r.relation_basis||'legacy_material_record',evidenceStatus:r.provisional?'UNKNOWN':'FACT',confidence:null,period:r.period,observation:r,quantity_kg:r.unit==='million_tonnes'?r.quantity*1e9:null,value:r.trade_value_eur??null,currency:r.trade_value_eur!=null?'EUR':null,value_basis:r.trade_value_eur!=null?'trade_value':null,valuation:'not_specified',reported_flow:r.relation_basis==='customs_trade'?'export':null,refs:r.source_ids.map(id=>materials.sources.find(s=>s.id===id)),locator:r.locator,note:r.note||'',chain_id:null,isAtlas:true});
 }
 // Ports and refineries with their own reported quantity: points at the sourced site (Wikidata P625), no invented partner split.
 for(const r of materials.observations.filter(r=>r.location&&['port','facility'].includes(r.scope))){
  const material=materials.materials.find(m=>m.id===r.material_id),site='site_'+r.id,kind=r.scope==='port'?'Hafen':'Raffinerie';
  entities[site]={id:site,name:`${r.name} · ${kind}`,type:kind,country:'Indien',countryCode:'IN',lat:r.location.latitude,lon:r.location.longitude,place:r.location.place,location_precision:'APPROXIMATE',evidence:r.provisional?'UNKNOWN':'FACT',locationSourceUrl:r.location.source_url,coordinateSourceUrl:r.location.source_url};
  deals.push({id:site,buyerId:site,targetId:nation('IN'),area:r.material_id.startsWith('waste_')?'waste':'resources',subtype:material?.name||r.material_id,title:`${material?.name||r.material_id}: ${r.name} (${kind}, Teil des Landeswerts)`,relation:'material_observation',relationType:'material_observation',relationBasis:'site_observation',pointOnly:true,siteObservation:true,evidenceStatus:r.provisional?'UNKNOWN':'FACT',confidence:null,period:r.period,observation:r,quantity_kg:null,value:null,currency:null,value_basis:null,refs:[...r.source_ids.map(id=>materials.sources.find(s=>s.id===id)),{url:r.location.source_url,title:'Wikidata · '+r.location.place,publisher:'Wikidata',accessed_on:'2026-10-28',quality:'secondary',locator:r.location.precision==='facility'?'Koordinate der Anlage (P625)':'Koordinate des Ortes (P625); Anlage ohne eigene Koordinate'}],locator:r.locator,note:`${kind} mit eigener amtlicher Menge. Die Partnerländer dieser Menge sind nicht nach ${kind} aufgeschlüsselt; Länderlinien enden deshalb am Landeswert.${r.note?' '+r.note:''}`,chain_id:null,isAtlas:true,location:{latitude:r.location.latitude,longitude:r.location.longitude,locality_name:r.location.place,country_name:'Indien'}});
 }
 for(const d of [...deals].filter(d=>d.value_basis==='trade_value'&&d.value!==null))deals.push({...d,id:'value_'+d.id,buyerId:d.targetId,targetId:d.buyerId,area:'money',subtype:'Handelsgegenwert · '+d.subtype,flowKind:'value',relation:'modeled_counterflow',relationType:'modeled_counterflow',relationBasis:'derived_from_trade_value',evidenceStatus:'INFERENCE',confidence:null,audit:null,originalFlowId:d.id,title:'Modellierter Gegenwert: '+d.title,quantity_kg:null,note:'INFERENCE: Abgeleitete Gegenwertrichtung zum Warenstrom, keine beobachtete Zahlung. Keine belegten Konten, Zahlungsdaten oder Verteilung auf Firmen/Staat. '+d.note});
 for(const d of [...deals].filter(d=>d.originalDeal&&d.originalDeal.dealValue!=null&&d.originalDeal.dealCurrency))deals.push({...d,id:'dealvalue_'+d.id,area:'money',subtype:'Dealwert · '+d.subtype,dealValueView:true,value:d.originalDeal.dealValue,currency:d.originalDeal.dealCurrency,value_basis:'deal_value',refs:d.originalDeal.sources||[],flowKind:'deal_value',relation:'deal_value_view',relationType:'deal_value_view',relationBasis:'published_transaction_value',title:'Dealwert: '+d.title,note:'Käufer → Kaufobjekt. Der Pfeil zeigt die bewertete Transaktion, nicht den Zahlungsempfänger. Keine Auszahlung daraus abgeleitet. '+d.note});
 const countryCode=new Map(Array.from({length:26*26},(_,i)=>String.fromCharCode(65+Math.floor(i/26),65+i%26)).map(code=>[names.of(code),code]));
 for(const r of locationData.relations||[]){
  const code=countryCode.get(r.country_name)||null,companyId='wd_company_'+r.company_id,localityId='wd_locality_'+r.locality_id;
  if(!entities[localityId])entities[localityId]={id:localityId,name:r.locality_name,type:'Ort',country:r.country_name,countryCode:code,lat:r.latitude,lon:r.longitude,location_precision:'APPROXIMATE',evidence:'UNKNOWN',audit:{status:'NEEDS_RESEARCH'}};
  entities[companyId]={id:companyId,name:r.company_name,type:'Unternehmen',country:r.country_name,countryCode:code,lat:r.latitude,lon:r.longitude,location_precision:'APPROXIMATE',evidence:'UNKNOWN',audit:{status:'NEEDS_RESEARCH'}};
  deals.push({id:r.id,buyerId:companyId,targetId:localityId,area:'companies',subtype:'Sitzangabe · ungeprüft',title:`${r.company_name} → ${r.locality_name} (Sitzangabe)`,relation:'headquarters_statement',relationType:'headquarters_statement',relationBasis:'wikidata_locality_statement',pointOnly:true,evidenceStatus:'UNKNOWN',confidence:null,audit:{status:'NEEDS_RESEARCH'},current_validity:'UNKNOWN',period:null,quantity_kg:null,value:null,currency:null,refs:[{url:r.source_url,title:'Wikidata · Unternehmensobjekt',publisher:'Wikidata',accessed_on:r.access_date,published_on:r.source_date,quality:'secondary',locator:'Sitzangabe auf Ortsebene; manuelle Prüfung ausstehend'},{url:r.location_url,title:'Wikidata · Ort',publisher:'Wikidata',accessed_on:r.access_date,quality:'secondary'}],note:'Sitzangabe im Wikidata-Snapshot. Punkt entspricht den Koordinaten des Ortes, nicht einem verifizierten Unternehmensgebäude. Aktuelle Gültigkeit und Börsenstatus ungeprüft. Keine Transportbeziehung.',location:r});
 }
 for(const area of Object.keys(areas)){
  const subtypes=[...new Set(deals.filter(d=>d.area===area).map(d=>d.subtype))].sort();
  for(const d of deals.filter(d=>d.area===area))d.subtypeColor=palette[subtypes.indexOf(d.subtype)%palette.length];
 }
 return {entities,deals};
}
export function filterAtlas(layer,{area='all',subtype='all',region='all',year='all',query=''}={}){
 const codes=d=>[...new Set([layer.entities[d.buyerId]?.countryCode,layer.entities[d.targetId]?.countryCode,...Object.keys(numeric).filter(code=>(d.originalDeal?.countries||[]).includes(names.of(code)))])];
 return layer.deals.filter(d=>{
  if(area!=='all'&&d.area!==area)return false;
  if(subtype!=='all'&&d.subtype!==subtype)return false;
  if(year!=='all'&&!d.period?.end?.startsWith(year))return false;
  const c=codes(d);
  if(region==='india-africa'&&!(c.includes('IN')&&c.some(x=>africa.has(x))))return false;
  if(region==='africa'&&!c.some(x=>africa.has(x)))return false;
  if(region==='IN'&&!c.includes('IN'))return false;
  if(region==='DE'&&!c.includes('DE'))return false;
  const search=[d.title,d.subtype,d.note,layer.entities[d.buyerId]?.name,layer.entities[d.targetId]?.name].join(' ').toLowerCase();return !query||search.includes(query.toLowerCase());
 }).map(d=>({...d,flowColor:hex(connectionColor(d,area))}));
}
export function rankedTradeGroups(rows,layer,by='route'){
 const groups=new Map(),seen=new Set();
 for(const row of rows){
  if(row.value_basis!=='trade_value'||row.value==null||!row.period)continue;
  const original=row.originalFlowId||row.id;if(seen.has(original))continue;seen.add(original);
  const r=layer.deals.find(d=>d.id===original)||row;
  const key=[r.period.start,r.period.end,r.currency,r.reported_flow||'unknown',r.valuation||'not_specified'].join('|');
  if(!groups.has(key))groups.set(key,{key,period:r.period,currency:r.currency,reported_flow:r.reported_flow,valuation:r.valuation,entries:new Map()});
  const g=groups.get(key),item=by==='material'?r.subtype:by==='recipient'?layer.entities[r.targetId]?.name:by==='sender'?layer.entities[r.buyerId]?.name:r.title;
  if(!g.entries.has(item))g.entries.set(item,{label:item,value:0,ids:[]});const e=g.entries.get(item);e.value+=r.value;e.ids.push(row.id);
 }
 return [...groups.values()].map(g=>({...g,entries:[...g.entries.values()].sort((a,b)=>b.value-a.value)})).sort((a,b)=>b.period.end.localeCompare(a.period.end)||a.key.localeCompare(b.key));
}
export function rankedQuantityGroups(rows){
 const groups=new Map();
 for(const r of rows){
  if(r.area==='money'||r.quantity_kg==null||!r.period)continue;
  const key=[r.period.start,r.period.end,r.subtype,r.reported_flow||'reported_trade'].join('|');
  if(!groups.has(key))groups.set(key,{key,period:r.period,subtype:r.subtype,reported_flow:r.reported_flow,entries:[]});
  groups.get(key).entries.push(r);
 }
 return [...groups.values()].map(g=>({...g,entries:g.entries.sort((a,b)=>b.quantity_kg-a.quantity_kg)})).sort((a,b)=>b.period.end.localeCompare(a.period.end)||a.subtype.localeCompare(b.subtype));
}
export function formatMoney(value,currency){return value==null?'Wert unbekannt':new Intl.NumberFormat('de-DE',{maximumFractionDigits:2}).format(value>=1e9?value/1e9:value>=1e6?value/1e6:value)+(value>=1e9?' Mrd. ':value>=1e6?' Mio. ':' ')+(currency||'');}
export function styleMaterialLayer(rows){return rows.map(d=>({...d,flowColor:hex(connectionColor({area:'waste',subtype:d.observation?.material_id||'Stoffstrom'},'waste'))}));}
export {buildTradeLayer};
