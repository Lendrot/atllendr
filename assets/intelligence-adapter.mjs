import {regionCountries} from './market-logic.mjs';
const countryNames=new Intl.DisplayNames(['de'],{type:'region'});
const countryName=code=>code?countryNames.of(code):'Unbekannt';
const regionOf=country=>Object.entries(regionCountries).find(([,countries])=>countries.includes(country))?.[0]||null;
const sectorAliases={'Bau & Baustoffe':'Bau & Immobilien','Immobilien':'Bau & Immobilien','Chemie & Werkstoffe':'Chemie','Dienstleistungen':'Unternehmensdienstleistungen','Energie & Versorgung':'Energie & Versorger','Finanzen & Versicherungen':'Finanzdienstleistungen / Versicherungen','Gesundheit & Pharma':'Pharma & Gesundheit','Industrie & Elektronik':'Industrie & Elektronik (Altbestand)','Konsumgüter & Handel':'Konsum & Handel','Medien & Freizeit':'Medien & Freizeit (Altbestand)','Mobilität & Logistik':'Transport & Logistik','Nicht zugeordnet':'Unbekannt','Software & IT':'Technologie & Software','Telekommunikation':'Telekommunikation & Medien','Weitere Branchen':'Sonstige'};
const sectors=values=>[...new Set((values||['Unbekannt']).map(s=>sectorAliases[s]||s))];

/** Explicit ID migration, never fuzzy name matching or a fabricated point. */
export function mergeIntelligenceMarket(legacy,verified){
 const idFor=id=>verified.aliases.company_ids[id]||id;
 const sourceById=new Map(verified.sources.map(s=>[s.id,s]));
 const companies=new Map(legacy.companies.map(c=>[c.id,{...c,sectors:sectors(c.sectors)}]));
 const entities=Object.fromEntries(Object.entries(legacy.entities).map(([id,c])=>[id,{...c,sectors:sectors(c.sectors)}]));
 for(const c of verified.companies){
  const id=idFor(c.id),old=companies.get(id),extra=verified.display_locations.locations.find(l=>l.company_id===c.id);
  const located=Number.isFinite(c.latitude)&&Number.isFinite(c.longitude);
  const lat=located?c.latitude:extra?.latitude??null,lon=located?c.longitude:extra?.longitude??null;
  const country=countryName(c.country),city=located?(c.headquarters.city||old?.location?.name||null):extra?.city??null;
  const source=c.source_ids.map(id=>sourceById.get(id)).find(s=>s?.url);
  const coordinateUrl=located?c.coordinate_source_url:extra?.coordinate_source_url??null;
  const locationNote=located?(c.notes?.includes('Geokoordinaten aus dokumentiertem Altbestand')?'Standort aus dokumentiertem Altbestand; Hauptsitz nicht erneut geprüft. Genauigkeit: ':'Standort aus dem geprüften Bestand; Koordinatengenauigkeit: ')+c.coordinate_accuracy:extra?.location_note??'Kein eindeutiger Standort belegt.';
  const location=lat===null||lon===null?null:{name:city||'Belegter Standort',lat,lon,country,accuracy:located?c.coordinate_accuracy:'locality'};
  const row={...old,id,name:c.display_name,country,location,locations:location?[location]:[],listings:old?.listings||[],isins:old?.isins||[],listingStatus:old?.listingStatus||'not_recorded',recordType:'company',deIsin:old?.deIsin||false,sectors:[verified.industry_labels[c.industry]],industryLabels:[verified.industry_labels[c.industry]],industrySourceUrl:source?.url??null,industryBasis:'Redaktionelle Branche aus dem geprüften Bestand',sourceUrl:source?.url??null,locationSourceUrl:located?source?.url??coordinateUrl:extra?.location_source_url??null,coordinateSourceUrl:coordinateUrl,locationNote};
  companies.set(id,row);
  entities[id]={id,name:c.display_name,lat,lon,place:city||'Standort ungeklärt',country,region:regionOf(country),sectors:row.sectors,locationSourceUrl:row.locationSourceUrl,coordinateSourceUrl:coordinateUrl,locationNote,locationLabel:extra&&!located?'Standortbeleg':'Unternehmensquelle',accuracy:location?.accuracy??'unknown'};
 }
 const replaced=new Set(Object.keys(verified.aliases.replaced_deals));
 const deals=legacy.deals.filter(d=>!replaced.has(d.id)).map(d=>({...d,sectors:sectors(d.sectors),dateLabel:d.status==='completed'?'Vollzug':'Ankündigung',coverage:'legacy'}));
 for(const d of verified.deals){
  const target=entities[idFor(d.target_company_id)];
  if(!target)throw Error('Ziel fehlt: '+d.id);
  // Multiple buyers retain one transaction ID and separate arcs; unknown names stay unlocated.
  const buyers=d.buyers.length?d.buyers:[{company_id:null,name:'Kein Käufer benannt'}];
  const refs=d.source_ids.map(id=>sourceById.get(id)).filter(Boolean);
  const primary=refs.filter(s=>['company_primary','press_release','regulatory_filing'].includes(s.source_type)&&s.url&&!/unavailable|historical_context|conflicting_secondary/.test(s.verification_note||'')).sort((a,b)=>(b.publication_date||'').localeCompare(a.publication_date||''))[0]||refs.find(s=>s.url)||null;
  const claims=verified.claims.filter(c=>c.subject_id===d.id).map(c=>({...c,source:sourceById.get(c.source_id)||null}));
  const buyerIds=buyers.map((b,index)=>{
   if(b.company_id)return idFor(b.company_id);
   const id='unlocated-buyer:'+d.id+':'+index;
   entities[id]={id,name:b.name||'Kein Käufer benannt',lat:null,lon:null,place:'Standort ungeklärt',country:'Unbekannt',region:null,sectors:['Unbekannt'],locationSourceUrl:null,coordinateSourceUrl:null,locationNote:'Keine geografische Zuordnung.',accuracy:'unknown'};
   return id;
  });
  // Länder- und Branchenfilter umfassen auch belegte Verkäufer. So bleibt ein
  // Verkauf mit deutschem Verkäufer (z. B. Porsche/Rimac) unter Deutschland
  // auffindbar, obwohl Ziel und Käufer im Ausland sitzen.
  const sellerEntities=d.sellers.map(s=>s.company_id?entities[idFor(s.company_id)]:null).filter(Boolean);
  const sides=[target,...buyerIds.map(id=>entities[id]),...sellerEntities];
  deals.push({id:d.id,buyerId:buyerIds[0],buyerIds,targetId:target.id,status:d.status,statusLabel:verified.status_labels[d.status],date:d.completion_date||d.completion_reported_date||d.announcement_date,dateLabel:d.completion_date?'Vollzug':d.completion_reported_date?'Vollzug gemeldet':d.status==='rumored'?'Gerücht gemeldet':d.status==='sale_process'?'Prozess angekündigt':d.status==='intent'?'Absicht gemeldet':'Ankündigung',completedOn:d.completion_date,completionReportedOn:d.completion_reported_date,announcedOn:d.announcement_date,statusAsOf:primary?.publication_date??null,sourceUrl:primary?.url??null,sourceTitle:primary?.title??null,sources:refs,claims,note:d.notes,sellers:d.sellers.map(s=>s.company_id?entities[idFor(s.company_id)]?.name||'Unbekannt':s.name),kind:d.deal_type==='minority_stake'?'minority':d.deal_type==='joint_venture'?'joint_venture':d.deal_type==='majority_stake'?'majority':(d.deal_type==='carve_out'||d.transaction_structure==='asset_deal')?'business':'company',countries:[...new Set(sides.map(c=>c.country))],regions:[...new Set(sides.map(c=>c.region).filter(Boolean))],sectors:[...new Set(sides.flatMap(c=>c.sectors))],targetCountry:target.country,coverage:'verified',stakeBefore:d.stake_before_percentage,stakeAcquired:d.stake_acquired_percentage,stakeAfter:d.stake_after_percentage,dealValue:d.deal_value,dealCurrency:d.currency,evidenceStatus:d.evidence,confidence:d.confidence,sourceIds:d.source_ids});
 }
 deals.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.id.localeCompare(b.id));
 return {meta:{...legacy.meta,dataAsOf:verified.data_as_of,defaultYear:verified.data_as_of?.slice(0,4)||'2026',verifiedDealCount:deals.filter(d=>d.status==='completed').length,pendingCount:deals.filter(d=>['pending','announced','signed','regulatory_review'].includes(d.status)).length,interestCount:deals.filter(d=>['interest','intent','rumored','sale_process'].includes(d.status)).length},entities,deals,companies:[...companies.values()]};
}
