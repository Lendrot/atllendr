import {capacityComparable,resourceRestrictions,resourceAnalysisExclusions,resourceAvailability} from './safe-unknown.mjs';
export const statusLabel={operating:'In Betrieb',proposed:'Vorgeschlagen',construction:'Im Bau',announced:'Angekündigt',mothballed:'Stillgelegt / ruhend',retired:'Geschlossen',cancelled:'Abgesagt',shelved:'Zurückgestellt',unknown:'UNKNOWN',unverified:'Ungeprüfter Altbestand'};
export function filterAssets(assets,{query='',kind='all',status='all',country='all',commodity='all',quality='all',ids=null}={}){
 const q=query.trim().toLocaleLowerCase();
 return assets.filter(a=>(kind==='all'||(kind==='mine'&&(a.kind==='mine'||a.kind==='operation_group'))||a.kind===kind)&&(status==='all'||(a.statuses||[a.status]).includes(status))&&(country==='all'||a.country===country)&&(commodity==='all'||a.commodity===commodity)&&(quality==='all'||quality==='gps'&&a.coordinates||quality==='nogps'&&!a.coordinates||quality==='production'&&(a.observations||[]).some(o=>o.basis==='100% operation'||o.basis==='BHP equity share'))&&(!ids||ids.has(a.id))&&(!q||[a.name,a.other_name,a.country,a.owner?.name,a.owner?.parent,a.commodity,a.source_project_id].join(' ').toLocaleLowerCase().includes(q)));
}
export function annualCoverage(observations,start=2021,end=2026){
 return Array.from({length:end-start+1},(_,i)=>{const year=start+i;return {year,observations:observations.filter(o=>o.year===year)}});
}
export function utilization(production,capacity){
 if(!production||!capacity||!Number.isFinite(production.value)||!Number.isFinite(capacity.value)||capacity.value<=0)return null;
 if(!capacityComparable(production,capacity))return null;
 if(!production.material_form||production.material_form==='UNKNOWN'||production.material_form!==capacity.material_form||production.unit!==capacity.unit||production.period_start!==capacity.period_start||production.period_end!==capacity.period_end||!production.period_start||!production.period_end||production.basis!==capacity.basis||!production.basis)return null;
 if(production.audit!=='APPROVED'||capacity.audit!=='APPROVED')return null;
 return production.value/capacity.value*100;
}
export function csv(assets,gapsByAsset=null){
 const cell=v=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@-]/,"'$&")+'"';
 const rows=[['id','name','country','commodity','status','lat','lon','precision','company_source_text_role_UNKNOWN','source','audit','usage_restrictions','gap_lookup','public_availability','analysis_exclusions'],...assets.map(a=>{
  const gaps=gapsByAsset instanceof Map?gapsByAsset.get(a.id):gapsByAsset?.[a.id];
  // A synchronous caller without hydrated gaps must identify incomplete export,
  // rather than emit an empty array that suggests a fully checked record.
  const availability=gaps===undefined?null:gaps.map(resourceAvailability),exclusions=gaps===undefined?null:resourceAnalysisExclusions(a,gaps);
  return [a.id,a.name,a.country,a.commodity,(a.statuses||[a.status]).join(';'),a.coordinates?.lat,a.coordinates?.lon,a.coordinates?.precision,a.owner?.name,a.source_url,a.audit,resourceRestrictions(a,gaps||[]).join(';'),'/datenluecken/?entity='+encodeURIComponent(a.id),gaps===undefined?'NOT_LOADED':JSON.stringify(availability),gaps===undefined?'NOT_LOADED':JSON.stringify(exclusions)];
 })];
 return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function mergeAssets(global,legacy,observations){
 // Preserve candidates independently: name similarity is not identity evidence.
 const result=[...global,...legacy.map(a=>({...a,kind:'mine',source_id:'legacy',statuses:[a.status],observations:[]}))];
 const byId=new Map(result.map(a=>[a.id,a]));
 for(const item of observations){const a=byId.get(item.asset_id);if(a)a.observations=[...(a.observations||[]),item];}
 return result;
}
