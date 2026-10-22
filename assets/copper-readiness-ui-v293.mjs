import {gapIds} from './copper-public-availability-v293.mjs';
import {hydrateAvailability} from './copper-public-availability-ui-v293.mjs';
// Lazy inspection of pinned V29.3 Analysis projections; no calculations or Knowledge writes.
const $=id=>document.getElementById(id);
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function fetchPinned(ref,schema,authority){
 const url=new URL(ref.url,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/foundation/v29/'))throw new Error('UNSAFE_READINESS_REFERENCE');
 const response=await fetch(url.pathname,{cache:'no-store'});if(!response.ok)throw new Error(`READINESS_HTTP_${response.status}`);
 const bytes=await response.arrayBuffer();if(bytes.byteLength!==ref.bytes||await digest(bytes)!==ref.projection_sha256)throw new Error('READINESS_PROJECTION_HASH_MISMATCH');
 const value=JSON.parse(new TextDecoder().decode(bytes));if(value.schema_version!==schema||value.authority_dataset_hash!==authority)throw new Error('READINESS_SCHEMA_AUTHORITY_MISMATCH');if(value.public_availability_ref||gapIds(value).length)await hydrateAvailability(value,authority);return value;
}
export async function openReadinessInspection(){
 const response=await fetch('/foundation/v29/copper-catalog.json',{cache:'no-store'});if(!response.ok)throw new Error('COPPER_CATALOG_UNAVAILABLE');
 const copper=await response.json();if(!copper.readiness_catalog)throw new Error('READINESS_NOT_BUILT');
 const catalog=await fetchPinned(copper.readiness_catalog,'atlas.copper-readiness-catalog/1',copper.authority_dataset_hash);
 $('readiness-candidate').replaceChildren();for(const entry of catalog.candidates){const option=node('option',entry.name);option.value=entry.chain_id;$('readiness-candidate').append(option);}
 $('readiness-controls').hidden=false;$('readiness-load').disabled=true;
 $('readiness-status').textContent=`${catalog.counts.scenario_candidates_evaluated} Kandidaten · ${catalog.counts.bounded_resilience_input_ready} begrenzte quantitative Inputs bereit · ${catalog.counts.disruption_simulation_ready} Ausfallsimulationen bereit · Stand ${catalog.as_of}`;
 let loaded=null,request=0;
 async function load(){const sequence=++request;loaded=null;$('readiness-export').disabled=true;$('readiness-results').replaceChildren();
  try{const entry=catalog.candidates.find(c=>c.chain_id===$('readiness-candidate').value);const candidate=await fetchPinned(entry,'atlas.copper-simulation-input/1',catalog.authority_dataset_hash);const source=await fetchPinned(candidate.provenance_ref,'atlas.copper-readiness-provenance/1',catalog.authority_dataset_hash);if(source.chain_id!==entry.chain_id)throw new Error('READINESS_PROVENANCE_SCOPE_MISMATCH');candidate.provenance=source.provenance;if(sequence!==request)return;
   if(candidate.chain_id!==entry.chain_id||candidate.root_entity_id!==entry.root_entity_id||candidate.as_of!==catalog.as_of||candidate.lineage?.input_hash!==entry.input_hash||!candidate.lineage?.input_record_ids?.includes(entry.root_entity_id)||!candidate.resilience_input_package?.lineage?.execution_hash||candidate.resilience_input_package.root_entity_id!==entry.root_entity_id||candidate.resilience_input_package.chain_id!==entry.chain_id||candidate.resilience_input_package.scenario_input_id!==`scenario-input:v293:${entry.chain_id}`||candidate.resilience_input_package.as_of!==catalog.as_of)throw new Error('READINESS_LINEAGE_SCOPE_MISMATCH');
   const dimensions=['ENTITY_IDENTITY','PHYSICAL_RELATIONSHIP_CONTINUITY','TEMPORAL_CONTINUITY','MATERIAL_COMPATIBILITY','FLOW_QUANTITY_STATUS','CAPACITY_TYPE','ACTUAL_THROUGHPUT_STATUS','SPARE_CAPACITY_STATUS','ALTERNATIVE_FEASIBILITY_STATUS','EVIDENCE_COVERAGE','UNKNOWN_SHARE','CONFLICT_STATUS'];
   if(Object.keys(candidate.dimensions??{}).length!==dimensions.length||dimensions.some(key=>!['VERIFIED','PARTIAL','UNKNOWN','CONFLICT','NOT_APPLICABLE'].includes(candidate.dimensions[key]?.status)))throw new Error('READINESS_DIMENSIONS_INVALID');
   loaded=candidate;const target=$('readiness-results');const pkg=candidate.resilience_input_package;
   target.append(node('h3',`${candidate.name} · ${candidate.readiness_status}`),node('p',entry.reason),node('p','Inputpaket zur Prüfung. Unbekannte aktuelle Mengen, freie Kapazität und Ersatzversorgung bleiben UNKNOWN. Historische Zeiträume gelten nur für die jeweils belegten Records.'));
   const table=node('table');const caption=node('caption','12 getrennte Readiness-Dimensionen');table.append(caption);const head=node('tr');for(const label of ['Dimension','Status','Begründung / Evidence'])head.append(node('th',label));table.append(head);
   for(const [key,value] of Object.entries(candidate.dimensions)){const row=node('tr');row.dataset.readinessDimension=key;row.append(node('td',key),node('td',value.status),node('td',`${value.reasons.join(' · ')} · Claims ${value.claim_ids.join(', ')} · Evidence ${value.evidence_refs.join(', ')}`));table.append(row);}
   const scroll=node('div');scroll.className='table-scroll';scroll.append(table);target.append(scroll);
   const sections=[['Physische Pfade',candidate.physical_paths.map(p=>({path_id:p.PATH_ID,status:p.PATH_STATUS,entity_ids:p.ENTITY_IDS,relationship_ids:p.RELATIONSHIP_IDS,temporal:p.TEMPORAL_OVERLAP,material:p.MATERIAL}))],['Zeitraum und Material', {reference_period:pkg.reference_period,material:pkg.material}],['Mengen und Durchsatz',{production_inputs:pkg.production_inputs,throughput_inputs:pkg.throughput_inputs,unallocated_quantities:pkg.unallocated_quantities}],['Kapazitätstyp und Verfügbarkeit',pkg.capacity_inputs],['Alternativen: 10 separate Machbarkeitsdimensionen',pkg.alternative_candidates],['Kritische Datenlücken / Informationswert',{critical_unknowns:pkg.critical_unknowns,registered_gaps:candidate.critical_data_gaps,priorities:candidate.prioritized_gaps}],['Erlaubte Berechnungen',pkg.allowed_calculations],['Öffentliche Evidence je Datenlücke',candidate.public_availability_envelope],['Gesperrte Berechnungen',pkg.prohibited_calculations],['Evidence, Claims, Research History und Nutzungssperren',{provenance:candidate.provenance,record_usage_guards:candidate.record_usage_guards}],['Reproduzierbare Input-Lineage',{lineage:candidate.lineage,package_lineage:pkg.lineage}]];
   for(const [label,value] of sections){const detail=node('details');detail.append(node('summary',label),node('pre',JSON.stringify(value,null,2)));target.append(detail);}
   $('readiness-export').disabled=false;
  }catch(error){if(sequence!==request)return;$('readiness-status').textContent=`Readiness-Prüfung angehalten: ${error.message}`;}
 }
 $('readiness-candidate').addEventListener('change',load);
 $('readiness-export').addEventListener('click',()=>{if(!loaded)return;const url=URL.createObjectURL(new Blob([JSON.stringify(loaded,null,2)],{type:'application/json'}));const link=node('a');link.href=url;link.download=`atlas-v29-3-${loaded.chain_id}-resilience-input.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 await load();
}
