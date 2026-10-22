import {canonicalStringify, validateCopperGraph} from './copper-analysis-v29.mjs';
import {analyzeDependencyNetwork} from './copper-dependency-v292.mjs';
import {evaluateSimulationInput, readinessHash} from './copper-readiness-v293.mjs';
import {availabilityEnvelope} from './copper-public-availability-v293.mjs';

export const SCENARIO_SCHEMA='atlas.copper-scenario-input/1';
export const SCENARIO_RESULT_SCHEMA='atlas.copper-scenario-result/1';
export const ADMISSION_STATUSES=['VERIFIED','HISTORICAL_ONLY','HYPOTHETICAL_ONLY','INSUFFICIENT_EVIDENCE','CONFLICT','NOT_APPLICABLE'];
const PHYSICAL=new Set(['PROCESSES_AT','SUPPLIES','TRANSPORTS_TO','EXPORTS_TO','RECYCLES_AT']);
const unique=x=>[...new Set(x.filter(v=>v!=null))].sort();
const clone=x=>JSON.parse(JSON.stringify(x));
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
const hash=readinessHash;
export function validateScenarioInput(input){
 if(!input||input.schema_version!==SCENARIO_SCHEMA)throw Error('SCENARIO_SCHEMA_INVALID');
 for(const key of ['scenario_id','chain_id','root_entity_id'])if(typeof input[key]!=='string'||!input[key])throw Error('SCENARIO_ID_REQUIRED:'+key);
 if(!['HISTORICAL','CURRENT','HYPOTHETICAL'].includes(input.mode)||!['STRUCTURAL_EXPOSURE','QUANTIFIED_DISRUPTION'].includes(input.objective))throw Error('SCENARIO_MODE_OBJECTIVE_INVALID');
 if(!['PREDEFINED_RESEARCH_CASE','USER_DEFINED'].includes(input.origin)||input.origin==='USER_DEFINED'&&input.mode!=='HYPOTHETICAL')throw Error('USER_SCENARIO_MUST_BE_HYPOTHETICAL');
 const p=input.reference_period;
 if(!date(input.evaluation_date)||!p||!date(p.period_start)||!date(p.period_end)||p.period_start>=p.period_end||!['CALENDAR_YEAR','FISCAL_YEAR','QUARTER','HALF_YEAR','MONTH','CUSTOM'].includes(p.period_type))throw Error('SCENARIO_REFERENCE_PERIOD_INVALID');
 if(p.period_type==='CALENDAR_YEAR'&&(p.period_start.slice(5)!=='01-01'||p.period_end!==`${Number(p.period_start.slice(0,4))+1}-01-01`))throw Error('SCENARIO_CALENDAR_YEAR_INVALID');
 if(input.mode==='HISTORICAL'&&p.period_end>input.evaluation_date)throw Error('HISTORICAL_PERIOD_NOT_ENDED');
 if(input.mode==='CURRENT'&&!(p.period_start<=input.evaluation_date&&input.evaluation_date<p.period_end))throw Error('CURRENT_PERIOD_EXCLUDES_EVALUATION_DATE');
 if(!input.material||typeof input.material.commodity!=='string'||typeof input.material.material_basis!=='string'||typeof input.material.product_channel!=='string')throw Error('SCENARIO_MATERIAL_REQUIRED');
 if(!Array.isArray(input.failure_entity_ids)||!input.failure_entity_ids.length||new Set(input.failure_entity_ids).size!==input.failure_entity_ids.length||input.failure_entity_ids.some(x=>typeof x!=='string'||!x))throw Error('SCENARIO_FAILURE_IDS_INVALID');
 if(!Array.isArray(input.assumptions)||new Set(input.assumptions.map(a=>a.assumption_id)).size!==input.assumptions.length)throw Error('SCENARIO_ASSUMPTIONS_INVALID');
 for(const a of input.assumptions){if(!a.assumption_id||a.fact_status!=='ASSUMPTION'||!a.description||!['NODE_INTERRUPTION','RELATIONSHIP_ACTIVE_IN_PERIOD'].includes(a.kind)||!Array.isArray(a.record_ids)||!a.record_ids.length)throw Error('SCENARIO_ASSUMPTION_INVALID');}
 if(input.assumptions.length&&input.mode!=='HYPOTHETICAL')throw Error('ASSUMPTION_IN_OBSERVED_SCENARIO');
 return true;
}

// Reuse the existing dependency engine against actual canonical inputs. Persisted
// PATH_STATUS flags are not accepted as an independent truth or admission oracle.
export async function prepareScenarioContext(graph,dependency,{evaluationDate='2026-10-09',gapResolutionEvents=[]}={}){
 const valid=validateCopperGraph(graph);if(!valid.valid)throw Error('INVALID_SCENARIO_AUTHORITY');
 if(dependency.authority_dataset_hash!==graph.meta.dataset_hash)throw Error('SCENARIO_DEPENDENCY_AUTHORITY_MISMATCH');
 if(!date(evaluationDate))throw Error('SCENARIO_EVALUATION_DATE_INVALID');
 const rebuilt=await analyzeDependencyNetwork(graph,{roots:dependency.roots,asOf:evaluationDate});
 return {graph,original_dependency:dependency,dependency:rebuilt,evaluationDate,gapResolutionEvents,gap_resolution_events_hash:await hash(gapResolutionEvents),input_hash:await hash(graph),dependency_hash:await hash(rebuilt),original_dependency_hash:await hash(dependency),entities:new Map(graph.entities.map(x=>[x.entity_id,x])),relationships:new Map(graph.relationships.map(x=>[x.relationship_id,x])),claims:new Map(graph.claims.map(x=>[x.claim_id,x])),evidence:new Map(graph.evidence.map(x=>[x.evidence_id,x])),sources:new Map(graph.sources.map(x=>[x.source_id,x]))};
}
function assessPath(ctx,path,input){
 const reasons=[],p=input.reference_period,edges=path.RELATIONSHIP_IDS.map(id=>ctx.relationships.get(id));
 const sourceIds=unique(path.evidence_refs.map(id=>ctx.evidence.get(id)?.source_id));
 if(path.ENTITY_IDS.some(id=>!ctx.entities.has(id))||edges.some(e=>!e))reasons.push('UNRESOLVED_IDENTITY');
 if(!edges.length||edges.some((e,i)=>!PHYSICAL.has(e?.relationship_type)||e.source_entity_id!==path.ENTITY_IDS[i]||e.target_entity_id!==path.ENTITY_IDS[i+1]))reasons.push('NON_PHYSICAL_OR_DISCONNECTED_RELATIONSHIP');
 if(path.PATH_STATUS==='INVALID_PATH')reasons.push('INVALID_MATERIAL_OR_TIME_PATH');
 if(path.UNKNOWN_COMPONENTS.some(x=>['IDENTITY','MATERIAL','EVIDENCE'].includes(x.component_type)))reasons.push('UNKNOWN_IDENTITY_MATERIAL_OR_EVIDENCE');
 if(edges.some(e=>e.fact_status!=='FACT'||!e.claim_ids?.length||e.claim_ids.some(id=>ctx.claims.get(id)?.fact_status!=='FACT')))reasons.push('NON_FACT_RELATIONSHIP_SUPPORT');
 if(!path.evidence_refs.length||path.evidence_refs.some(id=>!ctx.evidence.has(id)||!ctx.sources.has(ctx.evidence.get(id).source_id)))reasons.push('UNLINKED_SOURCE_EVIDENCE');
 for(const edge of edges)for(const id of edge.claim_ids??[]){const claim=ctx.claims.get(id);if(!claim?.source_id||!ctx.sources.has(claim.source_id)||!claim.evidence_refs?.length||claim.evidence_refs.some(ref=>ctx.evidence.get(ref)?.source_id!==claim.source_id)||!claim.evidence_refs.some(ref=>edge.evidence_refs?.includes(ref)))reasons.push('CLAIM_EVIDENCE_SOURCE_BINDING_MISMATCH');}
 if(path.CONFLICT_COMPONENTS.some(x=>x.component_type!=='QUANTITY_CONTEXT'))reasons.push('CONFLICTING_PHYSICAL_PATH');
 if(path.MATERIAL.commodity!==input.material.commodity||path.MATERIAL.product_channel!==input.material.product_channel||edges.at(-1)?.material_basis!==input.material.material_basis)reasons.push('REQUESTED_MATERIAL_MISMATCH');
 const assumed=[];
 for(const e of edges){
  const temporalClaims=(e.claim_ids??[]).map(id=>ctx.claims.get(id)).filter(c=>c?.fact_status==='FACT'&&date(c.period_start)&&date(c.period_end)&&c.period_start<c.period_end&&c.relationship_bindings?.[e.relationship_id]);
  const boundPeriod=temporalClaims.some(c=>c.period_start<=e.valid_from&&e.valid_to!=null&&e.valid_to<=c.period_end&&c.period_start<=p.period_start&&p.period_end<=c.period_end);
  const covers=e.temporal_status==='KNOWN_INTERVAL'&&date(e.valid_from)&&(e.valid_to==null||date(e.valid_to))&&e.valid_from<=p.period_start&&(e.valid_to==null||p.period_end<=e.valid_to)&&boundPeriod;
  if(!covers){const a=input.mode==='HYPOTHETICAL'&&input.assumptions.find(a=>a.kind==='RELATIONSHIP_ACTIVE_IN_PERIOD'&&a.record_ids.includes(e.relationship_id));if(a)assumed.push(a.assumption_id);else reasons.push(e.temporal_status==='KNOWN_INTERVAL'?'OUTSIDE_SOURCED_ACTIVITY_PERIOD':'UNKNOWN_PHYSICAL_ACTIVITY_PERIOD');}
 }
 const accepted=!reasons.length;
 return {path_id:path.PATH_ID,entity_ids:path.ENTITY_IDS,relationship_ids:path.RELATIONSHIP_IDS,claim_ids:path.claim_ids,evidence_refs:path.evidence_refs,source_ids:sourceIds,material:path.MATERIAL,source_activity_period:path.TEMPORAL_OVERLAP,requested_period:clone(p),assumption_ids:unique(assumed),fact_status:assumed.length?'ASSUMPTION':'FACT',admitted:accepted,exclusion_reasons:unique(reasons),quantitative_conversion:null,usage_restrictions:['ANNUAL_ACTIVITY_ENVELOPE_DOES_NOT_PROVE_UNINTERRUPTED_DAILY_SERVICE','STRUCTURAL_REACHABILITY_IS_NOT_MEASURED_LOSS']};
}
function exposure(paths,failures){
 const adjacent=new Map();for(const p of paths)for(let i=0;i<p.entity_ids.length-1;i++){const id=p.entity_ids[i];if(!adjacent.has(id))adjacent.set(id,new Set());adjacent.get(id).add(p.entity_ids[i+1]);}
 const reached=new Set(),queue=[...failures];while(queue.length){const n=queue.shift();for(const next of adjacent.get(n)??[]){if(reached.has(next)||failures.includes(next))continue;reached.add(next);queue.push(next);}}
 return {failure_entity_ids:failures,reachable_entity_ids:[...reached].sort(),affected_path_ids:paths.filter(p=>p.entity_ids.some(id=>failures.includes(id))).map(p=>p.path_id).sort(),relationship_ids:unique(paths.filter(p=>p.entity_ids.some(id=>failures.includes(id))).flatMap(p=>p.relationship_ids)),quantified_production_loss:null,available_replacement_tonnage:null};
}
const gapWeight=g=>/temporal|period|valid/.test(`${g.gap_type} ${g.field_path}`.toLowerCase())?5:/allocation|quantity|assay/.test(`${g.gap_type} ${g.field_path}`.toLowerCase())?4:/spare|inventory|recovery/.test(`${g.gap_type} ${g.field_path}`.toLowerCase())?3:/alternative/.test(`${g.gap_type} ${g.field_path}`.toLowerCase())?2:1;

export async function evaluateScenario(ctx,input){
 validateScenarioInput(input);if(input.evaluation_date!==ctx.evaluationDate)throw Error('SCENARIO_CONTEXT_DATE_MISMATCH');
 const {graph}=ctx,chain=ctx.dependency.chains.find(c=>c.chain_id===input.chain_id);
 if(!chain||chain.root_entity_id!==input.root_entity_id)throw Error('SCENARIO_CHAIN_ROOT_MISMATCH');
 if(input.failure_entity_ids.some(id=>!chain.entity_ids.includes(id)))throw Error('SCENARIO_FAILURE_OUTSIDE_CHAIN_SCOPE');
 for(const a of input.assumptions)for(const id of a.record_ids){if(a.kind==='RELATIONSHIP_ACTIVE_IN_PERIOD'&&!chain.paths.some(p=>p.RELATIONSHIP_IDS.includes(id))||a.kind==='NODE_INTERRUPTION'&&!input.failure_entity_ids.includes(id))throw Error('SCENARIO_ASSUMPTION_OUTSIDE_SCOPE');}
 const paths=chain.paths.map(p=>assessPath(ctx,p,input)),accepted=paths.filter(p=>p.admitted);
 const readiness=await evaluateSimulationInput(graph,ctx.dependency,input.chain_id,{asOf:input.evaluation_date,gapResolutionEvents:ctx.gapResolutionEvents});
 const originalChain=ctx.original_dependency.chains.find(c=>c.chain_id===chain.chain_id);
 const entityIds=unique([chain.root_entity_id,...chain.entity_ids,...(originalChain?.entity_ids??[])]),relationshipIds=unique([...chain.paths.flatMap(p=>p.RELATIONSHIP_IDS),...(originalChain?.paths??[]).flatMap(p=>p.RELATIONSHIP_IDS)]);
 const excludedRelationships=ctx.dependency.excluded_relationships.filter(r=>relationshipIds.includes(r.relationship_id));
 const overlaps=(start,end)=>date(start)&&date(end)&&start<input.reference_period.period_end&&input.reference_period.period_start<end;
 const materialScopedRelationshipIds=new Set((originalChain?.paths??[]).filter(p=>p.MATERIAL.commodity===input.material.commodity&&p.MATERIAL.product_channel===input.material.product_channel&&ctx.relationships.get(p.RELATIONSHIP_IDS.at(-1))?.material_basis===input.material.material_basis).flatMap(p=>p.RELATIONSHIP_IDS));
 const conflictingPhysicalRelationships=graph.relationships.filter(r=>materialScopedRelationshipIds.has(r.relationship_id)&&PHYSICAL.has(r.relationship_type)&&(r.fact_status==='CONFLICT'||r.claim_ids.some(id=>ctx.claims.get(id)?.fact_status==='CONFLICT'))&&(overlaps(r.valid_from,r.valid_to)||r.claim_ids.some(id=>{const c=ctx.claims.get(id);return c?.fact_status==='CONFLICT'&&overlaps(c.period_start,c.period_end);})));
 const claims=graph.claims.filter(c=>entityIds.includes(c.entity_id)||relationshipIds.some(id=>c.relationship_ids?.includes(id)));
 const evidenceIds=unique([...paths.flatMap(p=>p.evidence_refs),...claims.flatMap(c=>c.evidence_refs??[])]),sourceIds=unique(evidenceIds.map(id=>ctx.evidence.get(id)?.source_id));
 const rawGaps=graph.data_gaps.filter(g=>g.entity_ids?.some(id=>entityIds.includes(id))||g.claim_ids?.some(id=>claims.some(c=>c.claim_id===id)));
 const availability=await availabilityEnvelope(rawGaps,graph.meta.dataset_hash);
 const metadata=new Map(availability.records.map(r=>[r.gap_id,r]));
 const gaps=rawGaps.map(g=>({gap_id:g.gap_id,field_path:g.field_path,gap_type:g.gap_type,entity_ids:g.entity_ids,claim_ids:g.claim_ids,original_record_locator:g.original_record_locator,original_record_hash:g.original_record_hash,original_gap_sha256:metadata.get(g.gap_id).original_gap_sha256,effective_status:readiness.critical_data_gaps.find(x=>x.gap_id===g.gap_id)?.effective_status??g.status??'OPEN',fact_status:'UNKNOWN',research_status:g.research_status??'UNKNOWN',public_availability:metadata.get(g.gap_id).public_availability}));
 const contextConflicts=claims.filter(c=>c.fact_status==='CONFLICT').map(c=>c.claim_id);
 const structuralConflicts=paths.filter(p=>p.exclusion_reasons.includes('CONFLICTING_PHYSICAL_PATH'));
 let status=!['COPPER','COPPER_AND_ZINC'].includes(input.material.commodity)?'NOT_APPLICABLE':structuralConflicts.length||conflictingPhysicalRelationships.length||input.objective==='QUANTIFIED_DISRUPTION'&&contextConflicts.length?'CONFLICT':accepted.length?input.mode==='HYPOTHETICAL'?'HYPOTHETICAL_ONLY':input.mode==='HISTORICAL'?'HISTORICAL_ONLY':'VERIFIED':'INSUFFICIENT_EVIDENCE';
 // V29.4 provides structural evaluation and an admission contract, not a numeric
 // disruption simulator. Readiness dimensions and capability are both required.
 const quantitativeDimensions=['FLOW_QUANTITY_STATUS','CAPACITY_TYPE','ACTUAL_THROUGHPUT_STATUS','SPARE_CAPACITY_STATUS','ALTERNATIVE_FEASIBILITY_STATUS'];
 const missing=unique([...(conflictingPhysicalRelationships.length?['CONFLICTING_PHYSICAL_RELATIONSHIP']:[]),...excludedRelationships.map(r=>r.reason),...paths.flatMap(p=>p.exclusion_reasons),...quantitativeDimensions.filter(k=>readiness.dimensions[k].status!=='VERIFIED')]);
 if(input.objective==='QUANTIFIED_DISRUPTION'){missing.push('QUANTITATIVE_ENGINE_NOT_IMPLEMENTED_IN_V29_4');if(!['CONFLICT','NOT_APPLICABLE'].includes(status))status='INSUFFICIENT_EVIDENCE';}
 const structuralAllowed=input.objective==='STRUCTURAL_EXPOSURE'&&['VERIFIED','HISTORICAL_ONLY','HYPOTHETICAL_ONLY'].includes(status);
 const shared=[];
 if(structuralAllowed){for(const id of unique(accepted.flatMap(p=>p.entity_ids))){const supported=[];for(const other of ctx.dependency.chains){const matches=other.paths.filter(p=>p.ENTITY_IDS.includes(id)).map(p=>assessPath(ctx,p,input)).filter(p=>p.admitted&&(!p.assumption_ids.length||other.chain_id===chain.chain_id));if(matches.length)supported.push({chain_id:other.chain_id,path_ids:matches.map(p=>p.path_id).sort()});}if(supported.length>1)shared.push({entity_id:id,chain_count:supported.length,chains:supported,reference_period:clone(input.reference_period),scope:'PERIOD_AND_MATERIAL_ADMITTED_SELECTED_CHAIN_PATHS_ONLY'});}}
 const ledger=[...gaps,...claims.filter(c=>['UNKNOWN','CONFLICT','ASSUMPTION','INFERENCE'].includes(c.fact_status)).map(c=>({claim_id:c.claim_id,entity_id:c.entity_id,field_path:c.field,fact_status:c.fact_status,evidence_refs:c.evidence_refs,reason:'ORIGINAL_NON_FACT_CLAIM_PRESERVED'})),...paths.filter(p=>!p.admitted).map(p=>({path_id:p.path_id,relationship_ids:p.relationship_ids,fact_status:p.exclusion_reasons.includes('CONFLICTING_PHYSICAL_PATH')?'CONFLICT':'UNKNOWN',reasons:p.exclusion_reasons})),...input.assumptions.map(a=>clone(a))];
 const priorities=gaps.filter(g=>g.effective_status!=='RESOLVED_BY_EVIDENCE').sort((a,b)=>gapWeight(b)-gapWeight(a)||a.gap_id.localeCompare(b.gap_id)).slice(0,5).map(g=>({...g,priority_reason:gapWeight(g)===5?'Unlocks period-specific physical eligibility':gapWeight(g)===4?'Required route-specific flow and compatible material allocation':gapWeight(g)===3?'Required dated available capacity/recovery evidence':gapWeight(g)===2?'Required independently evidenced replacement feasibility':'Selected-scope missing input; inspect original record',ordinal_priority:gapWeight(g),priority_method:'Deterministic qualitative prerequisite order; not probability or quantified monetary value'}));
 const provenance={entities:graph.entities.filter(e=>entityIds.includes(e.entity_id)),relationships:graph.relationships.filter(r=>relationshipIds.includes(r.relationship_id)),claims,evidence:graph.evidence.filter(e=>evidenceIds.includes(e.evidence_id)),sources:graph.sources.filter(s=>sourceIds.includes(s.source_id)),research_history:graph.research_history.filter(r=>r.entity_ids?.some(id=>entityIds.includes(id))||entityIds.includes(r.entity_id)||rawGaps.some(g=>r.gap_id===g.gap_id||r.original_gap_id===g.gap_id||r.gap_ids?.includes(g.gap_id)||(typeof r.original_gap_accession_key==='string'&&r.original_gap_accession_key.length>0&&r.original_gap_accession_key===(g.accession_key??g.key)))||r.claim_ids?.some(id=>claims.some(c=>c.claim_id===id))),record_usage_guards:graph.record_usage_guards.filter(g=>claims.some(c=>c.claim_id===g.claim_id))};
 const result={schema_version:SCENARIO_RESULT_SCHEMA,authority_dataset_hash:graph.meta.dataset_hash,scenario_id:input.scenario_id,chain_id:chain.chain_id,name:chain.name,input:clone(input),admission_status:status,calculation_eligibility:{structural_exposure:structuralAllowed,quantified_disruption:false,replacement_tonnage:false,status:structuralAllowed?'STRUCTURAL_ONLY':'BLOCKED',reasons:structuralAllowed?['Only directed structure within sourced activity period; no numeric loss or reserve inference']:missing},dimensions:clone(readiness.dimensions),paths,excluded_relationships:excludedRelationships,structural_exposure:structuralAllowed?exposure(accepted,input.failure_entity_ids):null,shared_nodes:shared,coverage:{admitted_paths:accepted.length,selected_candidate_paths:paths.length,excluded_path_ids:paths.filter(p=>!p.admitted).map(p=>p.path_id),scope:'Existing selected chain paths, maximum 3 hops; not complete global supply coverage'},missing_inputs:missing,uncertainty_ledger:ledger,research_priorities:priorities,public_availability_envelope:availability,evidence_categories:evidenceIds.map(id=>{const e=ctx.evidence.get(id),s=ctx.sources.get(e?.source_id);return {evidence_id:id,source_id:e?.source_id??null,source_published_at:s?.source_published_at??null,source_locator:e?.source_locator??null,source_quality:s?.source_quality??'UNKNOWN_SOURCE_QUALITY',claim_fact_statuses:unique(claims.filter(c=>c.evidence_refs?.includes(id)).map(c=>c.fact_status)),category:paths.some(p=>p.evidence_refs.includes(id)&&p.admitted&&p.fact_status==='FACT')?(paths.some(p=>p.evidence_refs.includes(id)&&p.admitted&&p.source_activity_period.end&&p.source_activity_period.end<=input.evaluation_date)?'HISTORICAL_RELATIONSHIP_EVIDENCE':'PERIOD_BOUND_RELATIONSHIP_EVIDENCE'):'CONTEXT_EVIDENCE_NO_CURRENT_FLOW_PROOF'};}),provenance,limitations:['DEV_NOT_APPROVED_RELEASE','No measured production loss or available replacement quantity','Publication date is separate from physical activity period','Historical annual activity envelope does not prove continuous daily service','Unknowns, conflicts, availability and research status remain separate','Shared-node counts cover only period/material-admitted paths in selected graph']};
 const outputHash=await hash(result),parameters={scenario_input_hash:await hash(input),input_hash:ctx.input_hash,dependency_hash:ctx.dependency_hash,original_dependency_hash:ctx.original_dependency_hash,gap_resolution_events_hash:ctx.gap_resolution_events_hash};
 result.lineage={derived_record_id:'scenario-v294:'+input.scenario_id,input_record_ids:unique([input.scenario_id,...input.assumptions.map(a=>a.assumption_id),...entityIds,...relationshipIds,...claims.map(c=>c.claim_id),...evidenceIds,...sourceIds,...rawGaps.map(g=>g.gap_id),...provenance.research_history.map(r=>r.research_history_id),...provenance.record_usage_guards.map(g=>g.guard_id),...ctx.gapResolutionEvents.filter(e=>rawGaps.some(g=>g.gap_id===e.gap_id)).map(e=>e.resolution_id)]),transformation_id:'atlas.copper-scenario-admission',transformation_version:'2.94.4',formula_or_rule:'Canonical evidenced physical graph; requested [start,end) covered by every edge and source-bound Claim; compatible product channels; directed reachability; explicit assumptions cannot become FACT',parameters,authority_dataset_hash:graph.meta.dataset_hash,output_hash:outputHash,output_reference:{schema_version:SCENARIO_RESULT_SCHEMA,scenario_id:input.scenario_id,exclude_fields:['lineage','execution_hash']}};
 result.lineage.execution_hash=await hash(result.lineage);result.execution_hash=await hash(result);
 return result;
}
export function scenarioCsv(result){
 const headers=['scenario_id','chain_id','admission_status','mode','objective','period_start','period_end','material_basis','product_channel','structural_exposure_allowed','quantified_disruption_allowed','quantified_production_loss','available_replacement_tonnage','entity_ids','relationship_ids','claim_ids','evidence_refs','missing_inputs','uncertainty_ledger','research_priorities','public_availability','execution_hash'];
 const values=[result.scenario_id,result.chain_id,result.admission_status,result.input.mode,result.input.objective,result.input.reference_period.period_start,result.input.reference_period.period_end,result.input.material.material_basis,result.input.material.product_channel,result.calculation_eligibility.structural_exposure,false,null,null,result.provenance.entities.map(e=>e.entity_id),result.provenance.relationships.map(r=>r.relationship_id),result.provenance.claims.map(c=>c.claim_id),result.provenance.evidence.map(e=>e.evidence_id),result.missing_inputs,result.uncertainty_ledger,result.research_priorities,result.public_availability_envelope,result.execution_hash];
 const cell=v=>{let s=v==null?'UNKNOWN':typeof v==='object'?canonicalStringify(v):String(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return headers.map(cell).join(',')+'\r\n'+values.map(cell).join(',')+'\r\n';
}
