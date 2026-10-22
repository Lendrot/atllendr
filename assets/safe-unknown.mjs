/** Conservative read policy for unverified legacy source assertions. */
import {validateAvailability} from './public-availability-v293.mjs';
import {SOURCE_INTEGRITY_SHA256} from './safe-unknown-pin.mjs';

export const MATERIAL_CONTAINMENT_POLICY_VERSION='atlas.safe-unknown-material/29.6.0';
export const MATERIAL_BLOCKED_OPERATIONS=Object.freeze([
 'capacity_material_aggregation','capacity_conversion','capacity_production_comparison',
 'mine_feed_allocation','route_quantity_allocation','available_alternative_capacity',
 'replacement_tonnage','quantified_disruption'
]);
const recognizedMaterialBases=new Set(['ORE','ROM_ORE','CONCENTRATE','DRY_MASS','WET_MASS','CONTAINED_METAL','INTERMEDIATE_PRODUCT','FINAL_PRODUCT','METAL_EQUIVALENT','ANODE','CATHODE','REFINED_METAL']);
const recognizedUnits=new Set(['t','tonnes','kt','Mt','t/year','tonnes/year','kt/year','Mt/year','DMT','WMT','million_tonnes','million_tonnes_per_year']);
const recognizedPeriods=new Set(['VERIFIED_PERIOD','CALENDAR_YEAR','FISCAL_YEAR','QUARTER','HALF_YEAR','MONTH','CUSTOM']);
const recognizedMeasurements=new Set(['100% operation','BHP equity share','100% basis','DRY_MASS','WET_MASS','CONTAINED_METAL','ACTUAL_PRODUCTION','REPORTED_CAPACITY','FACILITY_TOTAL_THROUGHPUT',
 'Dry metric tonnes of concentrate processed;100%smelter basis;includes Kansanshi,Trident and third-party feed',
 'Facility actual concentrate treated, dry metric tonnes; facility total is not mine-specific feed.',
 'Facility actual concentrate treated, dry metric tonnes; 100% shared facility including Trident and third-party concentrates.',
 'Facility 100% total, inclusive of Trident and third-party concentrate; reported actual throughput/output, not mine-specific feed allocation.'
]);
const known=value=>typeof value==='string'&&value.trim()!==''&&!/UNKNOWN|CONFLICT/i.test(value);
const basisOf=r=>r?.material_basis??r?.foundation_semantics?.material_basis;
const measurementOf=r=>r?.measurement_basis??r?.basis;
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const validPeriod=r=>{
 const type=r?.period_type??r?.foundation_semantics?.period_type;
 if(!recognizedPeriods.has(type)||!validDate(r?.period_start)||!validDate(r?.period_end)||r.period_start>=r.period_end)return false;
 if(r.period_type&&r.foundation_semantics?.period_type&&r.period_type!==r.foundation_semantics.period_type)return false;
 const start=new Date(r.period_start),end=new Date(r.period_end);
 if(type==='CALENDAR_YEAR')return r.period_start.endsWith('-01-01')&&r.period_end===`${start.getUTCFullYear()+1}-01-01`;
 if(['MONTH','QUARTER','HALF_YEAR'].includes(type)){
  const months={MONTH:1,QUARTER:3,HALF_YEAR:6}[type];
  return start.getUTCDate()===1&&end.getUTCDate()===1&&start.getUTCMonth()%months===0&&(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()===months;
 }
 return true;
};
const gapOperations=Object.freeze({
 UNKNOWN_ROLE:['ownership_aggregation','control_inference','ownership_as_supply'],
 UNKNOWN_PERIOD:['capacity_current_total','capacity_time_series','capacity_production_comparison','available_alternative_capacity','replacement_tonnage','quantified_disruption'],
 UNKNOWN_MATERIAL_BASIS:MATERIAL_BLOCKED_OPERATIONS,
 CONFLICT:[...MATERIAL_BLOCKED_OPERATIONS,'ownership_aggregation','control_inference','ownership_as_supply','capacity_current_total','capacity_time_series']
});

function basisStatus(value){
 if(value==='CONFLICT'||value==='CONFLICTING_MATERIAL_BASIS')return 'CONFLICT';
 if(typeof value!=='string'||!recognizedMaterialBases.has(value))return 'UNKNOWN';
 return 'VERIFIED';
}
export function materialUseDecision(record,operation,{comparison=null,requirePeriod=false}={}){
 const basis=basisOf(record);
 const reasons=[];
 const needsPeriod=requirePeriod||['capacity_material_aggregation','capacity_production_comparison','available_alternative_capacity','replacement_tonnage','quantified_disruption'].includes(operation);
 if(![...MATERIAL_BLOCKED_OPERATIONS,'verify_quantitative_metadata','trade_quantity_share'].includes(operation))reasons.push('UNSUPPORTED_OPERATION');
 if(!['capacity_material_aggregation','capacity_production_comparison','verify_quantitative_metadata','trade_quantity_share'].includes(operation))reasons.push('REQUIRES_SEPARATE_VERIFIED_ALLOCATION_OR_CONVERSION');
 const status=basisStatus(basis);
 if(status!=='VERIFIED')reasons.push(status==='CONFLICT'?'CONFLICT_MATERIAL_BASIS':'UNKNOWN_OR_INVALID_MATERIAL_BASIS');
 if(record?.material_basis&&record?.foundation_semantics?.material_basis&&record.material_basis!==record.foundation_semantics.material_basis)reasons.push('CONFLICT_MATERIAL_BASIS');
 if(record?.fact_status==='CONFLICT')reasons.push('CONFLICT');
 if(record?.fact_status!=='FACT')reasons.push('UNVERIFIED_QUANTITATIVE_CLAIM');
 if(!Number.isFinite(record?.value??record?.quantity)||(record?.value??record?.quantity)<0)reasons.push('UNKNOWN_OR_INVALID_VALUE');
 if(!recognizedUnits.has(record?.unit))reasons.push('UNKNOWN_OR_INVALID_UNIT');
 if(!known(record?.material??record?.commodity))reasons.push('UNKNOWN_OR_CONFLICTING_MATERIAL');
 if(!recognizedMeasurements.has(measurementOf(record)))reasons.push('UNKNOWN_OR_CONFLICTING_MEASUREMENT_BASIS');
 if(needsPeriod&&!validPeriod(record))reasons.push('UNKNOWN_OR_CONFLICTING_PERIOD');
 if(operation==='capacity_production_comparison'&&!comparison)reasons.push('MISSING_COMPARISON');
 if(comparison){
  const otherBasis=basisOf(comparison);
  if(basisStatus(otherBasis)!=='VERIFIED'||otherBasis!==basis)reasons.push('INCOMPATIBLE_MATERIAL_BASIS');
  if(comparison.fact_status==='CONFLICT')reasons.push('CONFLICT');
  if(comparison.fact_status!=='FACT')reasons.push('UNVERIFIED_QUANTITATIVE_CLAIM');
  if(!Number.isFinite(comparison.value??comparison.quantity)||(comparison.value??comparison.quantity)<0)reasons.push('UNKNOWN_OR_INVALID_VALUE');
  if(comparison.material_basis&&comparison.foundation_semantics?.material_basis&&comparison.material_basis!==comparison.foundation_semantics.material_basis)reasons.push('CONFLICT_MATERIAL_BASIS');
  if(!recognizedUnits.has(comparison.unit)||comparison.unit!==record?.unit)reasons.push('INCOMPATIBLE_UNIT');
  if(!known(comparison.material??comparison.commodity)||(comparison.material??comparison.commodity)!==(record?.material??record?.commodity))reasons.push('INCOMPATIBLE_MATERIAL');
  if(!recognizedMeasurements.has(measurementOf(comparison))||measurementOf(comparison)!==measurementOf(record))reasons.push('INCOMPATIBLE_MEASUREMENT_BASIS');
  if(needsPeriod&&(!validPeriod(comparison)||comparison.period_start!==record.period_start||comparison.period_end!==record.period_end))reasons.push('INCOMPATIBLE_PERIOD');
 }
 return {policy_version:MATERIAL_CONTAINMENT_POLICY_VERSION,operation,allowed:reasons.length===0,reasons:[...new Set(reasons)],material_basis:basis??'UNKNOWN_MATERIAL_BASIS',unit:record?.unit??null,raw_value:record?.value??record?.quantity??null};
}
export const quantitativeMetadataDecision=record=>materialUseDecision(record,'verify_quantitative_metadata',{requirePeriod:true});

// The gap page is the machine-readable projection. Never substitute a lookup
// entry or a failed HTTP request for field-level research evidence.
export function resourceAvailability(gap){
 const metadata=gap?.public_availability;
 const validation=validateAvailability(metadata,gap);
 if(!metadata||!validation.valid)throw Error('Öffentliche Quellenverfügbarkeit fehlt oder ist ungültig: '+(gap?.gap_id||'UNKNOWN'));
 return structuredClone(metadata);
}
export function renderResourceAvailability(container,gaps){
 container.replaceChildren();
 if(!gaps.length){container.textContent='Keine registrierte Datenlücke in diesem Register-Scope. Weitere fachliche UNKNOWN bleiben ungeklärt.';return}
 for(const gap of gaps){
  const metadata=resourceAvailability(gap),entry=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p'),payload=document.createElement('pre');
  entry.dataset.gapId=gap.gap_id;entry.dataset.availabilityStatus=metadata.availability_status;
  summary.textContent=gap.field_path+' · Quellenverfügbarkeit: '+metadata.availability_status;
  text.textContent='Fachstatus: '+(gap.fact_status||'UNKNOWN')+' · Recherche: '+(gap.research_status||'UNKNOWN')+' · Evidence-Vollständigkeit: '+(gap.evidence_completeness||'UNKNOWN')+' · Geprüft: '+(metadata.last_checked??'UNKNOWN')+' · Zugang: '+metadata.access_status+'. '+metadata.reason;
  payload.textContent=JSON.stringify(metadata,null,2);payload.dataset.availabilityMetadata=gap.gap_id;
  entry.append(summary,text,payload);container.append(entry);
 }
}
export function resourceRestrictions(asset,gaps=[]){
 const capacities=asset.capacities||[asset.capacity].filter(Boolean);
 const reasons=gaps.map(g=>g?.gap_type).filter(type=>type in gapOperations);
 if(asset.owner?.name&&asset.owner.name!=='UNKNOWN')reasons.push('UNKNOWN_ROLE');
 if(capacities.some(c=>c.foundation_semantics?.period_type!=='VERIFIED_PERIOD'||!c.period_start||!c.period_end))reasons.push('UNKNOWN_PERIOD');
 if(capacities.some(c=>basisStatus(basisOf(c))!=='VERIFIED'))reasons.push('UNKNOWN_MATERIAL_BASIS');
 if(asset.fact_status==='CONFLICT'||gaps.some(g=>g.fact_status==='CONFLICT')||capacities.some(c=>c.fact_status==='CONFLICT'||basisStatus(basisOf(c))==='CONFLICT'||c.material_basis&&c.foundation_semantics?.material_basis&&c.material_basis!==c.foundation_semantics.material_basis))reasons.push('CONFLICT');
 return [...new Set(reasons)];
}
export function safeResourceExport(asset,gaps=[]){
 const restrictions=resourceRestrictions(asset,gaps);
 const signature=gapPayloadSignature;
 const gap_hydration_status=verifiedHydration.has(asset.id)&&verifiedHydration.get(asset.id)===signature(gaps)?'LOADED_VERIFIED_SNAPSHOT':gaps.length?'UNVERIFIED_PARTIAL':'NOT_LOADED';
 const gapRefs=gaps.map(g=>({...g,public_availability:resourceAvailability(g)}));
 const blocked=new Set(restrictions.flatMap(reason=>gapOperations[reason]||[]));
 const operation_status=Object.fromEntries([...new Set(Object.values(gapOperations).flat())].sort().map(operation=>[operation,blocked.has(operation)?'BLOCKED':'NOT_VERIFIED']));
 return {schema_version:'atlas.safe-resource-export/29.6.0',policy_version:MATERIAL_CONTAINMENT_POLICY_VERSION,gap_hydration_status,gap_register_complete:gap_hydration_status==='LOADED_VERIFIED_SNAPSHOT',raw_record:asset,fact_status:restrictions.includes('CONFLICT')?'CONFLICT':'UNKNOWN',usage_restrictions:{...operation_status,reasons:restrictions,prohibited_uses:[...blocked].sort()},gap_refs:gapRefs,public_availability:gapRefs.map(g=>g.public_availability),analysis_exclusions:resourceAnalysisExclusions(asset,gapRefs),raw_record_notice:'Quellenrohwert; keine bestätigte Eigentümerrolle, aktuelle Kapazität oder Materialbasis ableiten'};
}
export function resourceAnalysisExclusions(asset,gaps=[]){
 return gaps.map(g=>{
  if(g.legacy_asset_id!==asset.id&&!(g.entity_ids||[]).some(id=>id===asset.id||id===asset.foundation_entity_id))throw Error('Datenlücke gehört nicht zum exportierten Standort');
  return {policy_version:MATERIAL_CONTAINMENT_POLICY_VERSION,original_record_id:g.original_record_id,original_record_hash:g.original_record_hash,original_record_locator:g.original_record_locator,entity_ids:[...(g.entity_ids||[])],claim_ids:[...(g.claim_ids||[])],asset_id:asset.id,gap_id:g.gap_id,field_path:g.field_path,reason:g.gap_type,excluded_from:gapOperations[g.gap_type]||['UNVERIFIED_FIELD_USE'],fact_status:g.fact_status||'UNKNOWN',research_status:g.research_status||'UNKNOWN',gap_status:g.status,public_availability:resourceAvailability(g)};
 });
}
export function capacityComparable(production,capacity){
 return materialUseDecision(capacity,'capacity_production_comparison',{comparison:production,requirePeriod:true}).allowed;
}
export async function resourceGapRefs(id){
 const integrity=await resourceSourceIntegrity();
 let bucket=0;for(const c of id)bucket=(bucket*31+c.charCodeAt(0))%64;
 const key=String(bucket).padStart(2,'0');
 if(!lookupCache.has(key))lookupCache.set(key,verifiedJson('/foundation/v28.4/gap-lookup-'+key+'.json',integrity.lookups['gap-lookup-'+key+'.json']).catch(error=>{lookupCache.delete(key);throw error}));
 const data=await lookupCache.get(key),refs=data[id]||[];
 const pages=new Map();
 for(const ref of refs){
  if(!/^gaps-\d{4}\.json$/.test(ref.page))throw Error('Ungültige Datenlücken-Registerseite');
  if(!pages.has(ref.page))pages.set(ref.page,await resourceGapPage(ref.page));
 }
 const hydrated=refs.map(ref=>{
  const gap=pages.get(ref.page).find(g=>g.gap_id===ref.gap_id);
  if(!gap||gap.original_record_id!==ref.original_record_id||gap.legacy_asset_id!==id&&!(gap.entity_ids||[]).includes(id))throw Error('Datenlücken-Verknüpfung stimmt nicht überein');
  const public_availability=resourceAvailability(gap);
  return {...structuredClone(gap),page:ref.page,public_availability};
 });
 verifiedHydration.set(id,gapPayloadSignature(hydrated));
 return hydrated;
}
const pageCache=new Map(),lookupCache=new Map();
const verifiedHydration=new Map();
const gapPayloadSignature=rows=>rows.map(g=>JSON.stringify(g)).sort().join('\n');
let sourceIntegrityCache=null;
async function verifiedJson(url,expected){
 if(!expected?.sha256||!globalThis.crypto?.subtle)throw Error('Datenlücken-Integritätsprüfung nicht verfügbar');
 const response=await fetch(url);if(!response.ok)throw Error('Datenlücken-Snapshot nicht verfügbar');
 const text=await response.text(),bytes=new TextEncoder().encode(text);
 if(expected.bytes!==undefined&&bytes.length!==expected.bytes)throw Error('Veralteter oder beschädigter Datenlücken-Snapshot');
 const hash=Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==expected.sha256)throw Error('Veralteter oder beschädigter Datenlücken-Snapshot');
 return JSON.parse(text);
}
async function resourceSourceIntegrity(){
 if(!sourceIntegrityCache)sourceIntegrityCache=verifiedJson('/foundation/v29/safe-unknown/source-integrity.json',{sha256:SOURCE_INTEGRITY_SHA256}).catch(error=>{sourceIntegrityCache=null;throw error});
 return sourceIntegrityCache;
}
export async function resourceGapSnapshot(url){
 const prefix='/foundation/v28.4/';
 if(!url.startsWith(prefix))throw Error('Nicht unterstützter Registerpfad');
 const name=url.slice(prefix.length),integrity=await resourceSourceIntegrity();
 const expected=name==='manifest.json'?{sha256:integrity.source_manifest_sha256}:integrity.pages[name]??integrity.lookups[name];
 return verifiedJson(url,expected);
}
async function resourceGapPage(page){
 if(!pageCache.has(page))pageCache.set(page,(async()=>{
  const integrity=await resourceSourceIntegrity();
  const rows=await verifiedJson('/foundation/v28.4/'+page,integrity.pages[page]);if(!Array.isArray(rows)||rows.length>100)throw Error('Ungültige Datenlücken-Seitengröße');
  // Cache only validated snapshots; a missing sidecar cannot be silently lost.
  for(const gap of rows)resourceAvailability(gap);
  return rows;
 })().catch(error=>{pageCache.delete(page);throw error}));
 return pageCache.get(page);
}
