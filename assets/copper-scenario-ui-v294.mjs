import {readinessHash} from './copper-readiness-v293.mjs';
import {scenarioCsv,validateScenarioInput,ADMISSION_STATUSES,SCENARIO_RESULT_SCHEMA} from './copper-scenario-v294.mjs';
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function pinned(ref,schema,authority){
 if(!ref||!/^\/foundation\/v29\/(scenario-catalog\.json|scenarios\/[a-z]+-[a-z]+(-evidence)?\.json)$/.test(ref.url)||!Number.isInteger(ref.bytes)||ref.bytes>250000)throw Error('UNSAFE_SCENARIO_REFERENCE');
 const response=await fetch(ref.url,{cache:'no-store'});if(!response.ok)throw Error('SCENARIO_HTTP');const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==ref.bytes||await digest(bytes)!==ref.projection_sha256)throw Error('SCENARIO_HASH_MISMATCH');
 const data=JSON.parse(new TextDecoder().decode(bytes));if(data.schema_version!==schema||data.authority_dataset_hash!==authority)throw Error('SCENARIO_SCHEMA_AUTHORITY_MISMATCH');return data;
}
const variants={historical:'Historische Struktur · 2025',current:'Aktuelle Struktur',hypothetical:'Hypothetische Unterbrechung · 2025',quantitative:'Quantitativer Ausfall · gesperrt'};
export async function openScenarioInspection(){
 const response=await fetch('/foundation/v29/copper-catalog.json',{cache:'no-store'});if(!response.ok)throw Error('COPPER_CATALOG_UNAVAILABLE');const copper=await response.json();
 const catalog=await pinned(copper.scenario_catalog,'atlas.copper-scenario-catalog/1',copper.authority_dataset_hash);
 if(catalog.phase!=='DEV'||catalog.release_status!=='NOT_APPROVED_RELEASE')throw Error('SCENARIO_RELEASE_SCOPE_INVALID');
 const controls=$('scenario-controls');if(!controls.children.length){const label=node('label','Szenario'),select=node('select');select.id='scenario-case';label.append(select);controls.append(label);for(const format of ['json','csv']){const button=node('button','Szenario als '+format.toUpperCase());button.id='scenario-'+format;button.type='button';button.className='secondary';button.disabled=true;controls.append(button);}}
 $('scenario-case').replaceChildren();for(const entry of catalog.candidates){const option=node('option',`${entry.name} · ${variants[entry.variant]}`);option.value=entry.scenario_id;$('scenario-case').append(option);}
 $('scenario-case').value='scenario:v294:chuquicamata:historical';$('scenario-controls').hidden=false;$('scenario-load').disabled=true;
 let current=null,sequence=0;
 function disabled(value){$('scenario-json').disabled=value;$('scenario-csv').disabled=value;}
 async function load(){const request=++sequence;current=null;disabled(true);$('scenario-results').replaceChildren();$('scenario-status').textContent='Szenario wird geprüft …';
  try{
   const entry=catalog.candidates.find(e=>e.scenario_id===$('scenario-case').value);if(!entry)throw Error('UNKNOWN_SCENARIO');
   const result=await pinned(entry,SCENARIO_RESULT_SCHEMA,catalog.authority_dataset_hash),source=await pinned(result.provenance_ref,'atlas.copper-scenario-provenance/1',catalog.authority_dataset_hash);
   if(source.scenario_id!==entry.scenario_id)throw Error('SCENARIO_PROVENANCE_SCOPE_MISMATCH');
   delete result.provenance_ref;result.provenance=source.provenance;validateScenarioInput(result.input);
   if(result.scenario_id!==entry.scenario_id||result.chain_id!==entry.chain_id||result.input.root_entity_id!==entry.root_entity_id||result.input.evaluation_date!==catalog.evaluation_date||result.execution_hash!==entry.execution_hash||result.lineage?.parameters?.input_hash!==catalog.input_hash||result.lineage?.parameters?.dependency_hash!==catalog.dependency_hash||!ADMISSION_STATUSES.includes(result.admission_status))throw Error('SCENARIO_SCOPE_MISMATCH');
   const execution=result.execution_hash;delete result.execution_hash;if(await readinessHash(result)!==execution)throw Error('SCENARIO_EXECUTION_HASH_MISMATCH');result.execution_hash=execution;
   if(result.calculation_eligibility.quantified_disruption!==false||result.calculation_eligibility.replacement_tonnage!==false||result.structural_exposure?.quantified_production_loss!=null||result.structural_exposure?.available_replacement_tonnage!=null)throw Error('UNSUPPORTED_SCENARIO_QUANTIFICATION');
   if(request!==sequence)return;current=result;const target=$('scenario-results');
   $('scenario-status').textContent=`${result.admission_status} · ${result.calculation_eligibility.status} · ${result.coverage.admitted_paths}/${result.coverage.selected_candidate_paths} Pfade zugelassen`;
   target.append(node('h3',`${result.name} · ${result.admission_status}`),node('p',`${result.input.reference_period.period_start} bis ${result.input.reference_period.period_end} (Ende ausgeschlossen) · ${result.input.material.material_basis}`),node('p',result.input.mode==='HYPOTHETICAL'?'Hypothetisches Szenario: Annahmen gelten ausschließlich für diese Analyse. Sie bestätigen keine Lieferverbindung oder Menge.':'Belegte historische Jahresaktivität beweist keinen ununterbrochenen täglichen Betrieb. Aktuelle Gültigkeit wird separat geprüft.'),node('p','Strukturelle Erreichbarkeit ist kein Produktionsverlust. Freie Kapazität und Ersatztonnage bleiben UNKNOWN.'));
   const table=node('table'),header=node('tr');for(const label of ['Pfad','Zulassung','Aktivitätszeitraum','Ausschlussgrund'])header.append(node('th',label));table.append(header);
   for(const p of result.paths){const row=node('tr');row.dataset.scenarioPath=p.path_id;row.append(node('td',p.relationship_ids.join(', ')),node('td',p.admitted?(p.fact_status==='ASSUMPTION'?'HYPOTHETICAL_ONLY':result.admission_status):'BLOCKED'),node('td',`${p.source_activity_period.start??'UNKNOWN'} bis ${p.source_activity_period.end??'UNKNOWN'}`),node('td',p.exclusion_reasons.join(' · ')||'Keine für diese strukturelle Analyse'));table.append(row);}
   const scroll=node('div');scroll.className='table-scroll';scroll.append(table);target.append(scroll);
   const priorities=node('ol');for(const p of result.research_priorities){const item=node('li',`${p.field_path} · ${p.priority_reason} · ${p.public_availability.availability_status} · ${p.gap_id}`);item.dataset.scenarioGap=p.gap_id;priorities.append(item);}target.append(node('h4','Nächste Evidence mit dem höchsten Nutzwert'),priorities);
   for(const[label,value]of [['Zulassung und fehlende Eingaben',result.calculation_eligibility],['Strukturelle Exposition',result.structural_exposure],['Gemeinsame Knoten im gewählten Zeitraum',result.shared_nodes],['Annahmen',result.input.assumptions],['Unsicherheiten und Datenlücken',result.uncertainty_ledger],['Evidence-Kategorien und Quellendaten',result.evidence_categories],['Originalrecords und Research History',result.provenance],['Öffentliche Evidence je Datenlücke',result.public_availability_envelope],['Reproduzierbare Ausführung',{execution_hash:result.execution_hash,lineage:result.lineage}]]){const detail=node('details');detail.append(node('summary',label),node('pre',JSON.stringify(value,null,2)));target.append(detail);}
   disabled(false);
  }catch(error){if(request!==sequence)return;current=null;disabled(true);$('scenario-results').replaceChildren();$('scenario-status').textContent=`Szenarioprüfung angehalten: ${error.message}`;}
 }
 $('scenario-case').addEventListener('change',load);
 function download(format){if(!current)return;const csv=format==='csv',content=csv?scenarioCsv(current):JSON.stringify(current,null,2),url=URL.createObjectURL(new Blob([content],{type:csv?'text/csv;charset=utf-8':'application/json'})),link=node('a');link.href=url;link.download=`atlas-v29-4-${current.chain_id}-${current.input.mode.toLowerCase()}.${format}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 $('scenario-json').addEventListener('click',()=>download('json'));$('scenario-csv').addEventListener('click',()=>download('csv'));await load();
}
