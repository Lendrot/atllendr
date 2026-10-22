import {availabilityEnvelope} from './copper-public-availability-v293.mjs';
import { canonicalStringify } from './copper-analysis-v29.mjs';
import { materialChannel, intersectTemporal } from './copper-dependency-v292.mjs';
import {quantitativeMetadataDecision} from './safe-unknown.mjs';

export const READINESS_SCHEMA = 'atlas.copper-simulation-input/1';
export const READINESS_DIMENSIONS = ['ENTITY_IDENTITY','PHYSICAL_RELATIONSHIP_CONTINUITY','TEMPORAL_CONTINUITY','MATERIAL_COMPATIBILITY','FLOW_QUANTITY_STATUS','CAPACITY_TYPE','ACTUAL_THROUGHPUT_STATUS','SPARE_CAPACITY_STATUS','ALTERNATIVE_FEASIBILITY_STATUS','EVIDENCE_COVERAGE','UNKNOWN_SHARE','CONFLICT_STATUS'];
export const DIMENSION_STATUSES = ['VERIFIED','PARTIAL','UNKNOWN','CONFLICT','NOT_APPLICABLE'];
const unique = values => [...new Set(values.filter(v => v != null))].sort();
const clone = value => JSON.parse(JSON.stringify(value));
// Versioned graph objects are immutable read inputs. Enforce that contract before
// identity caching so a caller cannot mutate an already-hashed graph and produce
// changed output with stale lineage. A changed clone receives a new key and hash.
const graphReadCache = new WeakMap();
const dependencyReadCache = new WeakMap();
const evaluationCache = new WeakMap();
function deepFreeze(value,seen=new WeakSet()) {
  if(value===null||typeof value!=='object'||seen.has(value))return value;
  seen.add(value);
  for(const child of Object.values(value))deepFreeze(child,seen);
  return Object.freeze(value);
}
async function cachedGraphReadState(graph) {
  let statePromise=graphReadCache.get(graph);
  if(!statePromise){
    statePromise=(async()=>{
      // canonicalStringify executes synchronously before deepFreeze. The freeze is
      // completed before the first await, closing the mutation window.
      const authorityCanonical=canonicalStringify(graph);
      deepFreeze(graph);
      const authorityInputHash=await readinessHashCanonical(authorityCanonical);
      const gapHashes=new Map(await Promise.all(graph.data_gaps.map(async g=>[g.gap_id,await readinessHash(g)])));
      const emptyResolutionKey=canonicalStringify([]);
      const emptyResolutionInputHash=await readinessHash({knowledge:graph,accepted_resolution_events:[]});
      return {
      entityIndex:new Map(graph.entities.map(e=>[e.entity_id,e])),
      relationshipIndex:new Map(graph.relationships.map(r=>[r.relationship_id,r])),
      claimIndex:new Map(graph.claims.map(c=>[c.claim_id,c])),
      evidenceIndex:new Map(graph.evidence.map(e=>[e.evidence_id,e])),
      gapHashes,
      inputHashes:new Map([[emptyResolutionKey,emptyResolutionInputHash]]),
      authorityInputHash
      };
    })();
    graphReadCache.set(graph,statePromise);
  }
  return statePromise;
}
async function cachedDependencyReadState(dependency) {
  let statePromise=dependencyReadCache.get(dependency);
  if(!statePromise){
    statePromise=(async()=>{
      // Dependency content influences names, paths, prioritized gaps and shared
      // nodes. Bind and freeze it before publishing any identity-keyed state.
      const authorityCanonical=canonicalStringify(dependency);
      deepFreeze(dependency);
      return {authorityInputHash:await readinessHashCanonical(authorityCanonical)};
    })();
    dependencyReadCache.set(dependency,statePromise);
  }
  return statePromise;
}
async function readinessHashCanonical(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v => v.toString(16).padStart(2,'0')).join(''); }
export async function readinessHash(value) { return readinessHashCanonical(canonicalStringify(value)); }
export async function prepareSimulationInput(graph,dependency=null) {
  const state=await cachedGraphReadState(graph),dependencyState=dependency?await cachedDependencyReadState(dependency):null;
  return Object.freeze({authority_input_hash:state.authorityInputHash,dependency_input_hash:dependencyState?.authorityInputHash??null,immutability_enforced:Object.isFrozen(graph)&&(dependency===null||Object.isFrozen(dependency)),cache_key:'CONTENT_BOUND_OBJECT_IDENTITY_AFTER_DEEP_FREEZE'});
}
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const knownPeriod = c => validDate(c.period_start)&&validDate(c.period_end)&&c.period_start<c.period_end&&['CALENDAR_YEAR','FISCAL_YEAR','QUARTER','HALF_YEAR','MONTH','CUSTOM','POINT_IN_TIME'].includes(c.period_type);
const quantitative = c => typeof c.value === 'number' && Number.isFinite(c.value) && c.value>=0&&['t','kt','Mt','t/year','kt/year','Mt/year','DMT','WMT'].includes(c.unit);
export function quantityType(c) {
  if (c.quantity_type) return c.quantity_type;
  if (/contract|contractual/.test(c.field)) return 'CONTRACT_QUANTITY';
  if (c.field === 'throughput' || c.field === 'processed_feed') return 'FACILITY_TOTAL_THROUGHPUT';
  if (/spare|available_capacity/.test(c.field)) return 'SPARE_CAPACITY';
  if (/capacity/.test(c.field)) return 'CAPACITY';
  if (c.field === 'production') return 'PRODUCTION';
  if (c.allocation_status === 'VERIFIED' && /allocation|allocated_flow/.test(c.field)) return 'MINE_SPECIFIC_ALLOCATION';
  if (c.field === 'actual_shipment_quantity') return 'ACTUAL_SHIPMENT_QUANTITY';
  return 'UNKNOWN_QUANTITY_TYPE';
}
export function capacityType(c) {
  if (['NAMEPLATE_CAPACITY','DESIGN_CAPACITY','REPORTED_CAPACITY','VERIFIED_AVAILABLE_CAPACITY'].includes(c.capacity_type)) return c.capacity_type;
  if (/spare|available_capacity/.test(c.field) && c.allocation_status === 'VERIFIED') return 'VERIFIED_AVAILABLE_CAPACITY';
  if (/capacity/.test(c.field)) return 'REPORTED_CAPACITY';
  if (c.field === 'throughput') return 'ACTUAL_THROUGHPUT';
  return 'UNKNOWN_AVAILABLE_CAPACITY';
}
async function lineage(kind,ids,output,graph,inputHash,parameters) {
  const clean=clone(output),outputHash=await readinessHash(clean);
  const base={derived_record_id:`readiness-v293:${kind}:${outputHash}`,input_record_ids:unique(ids),transformation_id:'atlas.copper-simulation-input',transformation_version:'2.93.1',formula_or_rule:'Deterministic source-bound twelve-dimension contract; no quantity imputation, no date extrapolation, no available capacity from nominal capacity; alternatives independently evaluated',parameters:clone(parameters),input_hash:inputHash,authority_dataset_hash:graph.meta.dataset_hash,output:clean,output_hash:outputHash};
  return {...base,execution_hash:await readinessHash(base)};
}
function refs(records,graph,entityIds=[],relationshipIds=[]) {
  const claimIds=unique(records.map(c=>c.claim_id));const evidenceIds=unique(records.flatMap(c=>c.evidence_refs||[]));
  return {entity_ids:unique([...entityIds,...records.map(c=>c.entity_id)]),relationship_ids:unique([...relationshipIds,...records.flatMap(c=>c.relationship_ids||[])]),claim_ids:claimIds,evidence_refs:evidenceIds,input_record_ids:unique([...entityIds,...relationshipIds,...claimIds,...evidenceIds])};
}
function dimension(status,reasons,records,graph,entityIds,relationshipIds,extra={}) { if(!DIMENSION_STATUSES.includes(status))throw new Error('INVALID_DIMENSION_STATUS'); return {status,reasons,...refs(records,graph,entityIds,relationshipIds),...extra}; }
function amountInput(c) { return {claim_id:c.claim_id,entity_id:c.entity_id,value:c.value,unit:c.unit,material:c.material??null,material_basis:c.material_basis??'UNKNOWN_MATERIAL_BASIS',material_form:c.material_form??null,moisture_basis:c.moisture_basis??null,measurement_basis:c.measurement_basis??null,quantity_type:quantityType(c),capacity_type:capacityType(c),allocation_status:c.allocation_status??c.route_allocation??'UNKNOWN',reference_period:{period_type:c.period_type??'UNKNOWN',period_start:c.period_start??null,period_end:c.period_end??null},fact_status:c.fact_status,evidence_refs:c.evidence_refs??[],usage_restrictions:c.usage_restrictions??[],equivalent_claim_id:c.equivalent_claim_id??null,aggregation_group:c.aggregation_group??null,aggregation_warning:c.aggregation_warning??null,quantity_semantics:c.quantity_semantics??null}; }

export function evaluateAlternative(a,graph,asOf) {
  const get=(...keys)=>keys.map(k=>a.dimensions?.[k]).find(Boolean);
  const map={commodity_compatibility:get('commodity_compatibility'),material_compatibility:get('material_compatibility'),processing_capability:get('processing_capability','processing_compatibility'),capacity:get('capacity'),spare_capacity:get('spare_capacity'),temporal_availability:get('temporal_availability'),transport_feasibility:get('transport_feasibility','transport_access'),geographic_feasibility:get('geographic_feasibility','geographic_access'),commercial_evidence:get('commercial_evidence'),physical_relationship_evidence:get('physical_relationship_evidence')};
  const dimensions={};
  for(const [key,raw] of Object.entries(map)) {
    const claims=graph.claims.filter(c=>(raw?.claim_ids||[]).includes(c.claim_id));const candidate=graph.entities.find(e=>e.entity_id===a.entity_id);const evidenceIds=new Set(graph.evidence.map(e=>e.evidence_id));
    const supported=raw?.status==='VERIFIED'&&claims.length&&claims.every(c=>c.fact_status==='FACT'&&(c.evidence_refs||[]).length&&(c.evidence_refs||[]).every(id=>evidenceIds.has(id)));
    let status=supported?'VERIFIED':claims.some(c=>c.fact_status==='CONFLICT')?'CONFLICT':raw?.status==='PARTIAL'?'PARTIAL':'UNKNOWN';
    if(!candidate||!candidate.identity_status||['UNKNOWN','POSSIBLE_MATCH','PROBABLE_SAME_ENTITY'].includes(candidate.identity_status))status='UNKNOWN';
    const basisMatch=c=>c.entity_id===a.entity_id&&c.material===a.material&&c.material_basis===a.material_basis&&materialChannel(c)===materialChannel(a)&&materialChannel(a)!==null;
    if(['material_compatibility','processing_capability','capacity','spare_capacity'].includes(key)&&!claims.some(basisMatch))status='UNKNOWN';
    if(key==='spare_capacity'&&!claims.some(c=>basisMatch(c)&&quantitativeMetadataDecision(c).allowed&&knownPeriod(c)&&c.period_start<=asOf&&asOf<c.period_end&&quantitative(c)&&c.value>0&&capacityType(c)==='VERIFIED_AVAILABLE_CAPACITY'&&/spare|available_capacity/.test(c.field)))status='UNKNOWN';
    if(key==='capacity'&&!claims.some(c=>basisMatch(c)&&quantitativeMetadataDecision(c).allowed&&quantitative(c)&&/capacity/.test(c.field)))status='UNKNOWN';
    if(key==='commodity_compatibility'&&!claims.some(c=>c.entity_id===a.entity_id&&c.material===a.material))status='UNKNOWN';
    if(key==='processing_capability'&&!claims.some(c=>basisMatch(c)&&/process|capability/.test(c.field)))status='UNKNOWN';
    if(key==='geographic_feasibility'&&!claims.some(c=>c.entity_id===a.entity_id&&/transport_access|geographic_feasibility/.test(c.field)))status='UNKNOWN';
    if(key==='temporal_availability'&&!claims.some(c=>c.entity_id===a.entity_id&&/available|availability/.test(c.field)&&knownPeriod(c)&&c.period_start<=asOf&&asOf<c.period_end))status='UNKNOWN';
    const origin=a.for_entity_id??a.source_entity_id??a.origin_entity_id;
    const connecting=types=>graph.relationships.some(r=>types.includes(r.relationship_type)&&r.fact_status==='FACT'&&[r.source_entity_id,r.target_entity_id].includes(a.entity_id)&&[r.source_entity_id,r.target_entity_id].includes(origin)&&(r.claim_ids||[]).some(id=>claims.some(c=>c.claim_id===id))&&r.temporal_status==='KNOWN_INTERVAL'&&r.valid_from&&r.valid_from<=asOf&&(!r.valid_to||asOf<r.valid_to));
    if(key==='commercial_evidence'&&!connecting(['OFFTAKE_AGREEMENT']))status='UNKNOWN';
    if(key==='transport_feasibility'&&!connecting(['TRANSPORTS_TO']))status='UNKNOWN';
    if(key==='physical_relationship_evidence'&&!connecting(['PROCESSES_AT','SUPPLIES','TRANSPORTS_TO','EXPORTS_TO','RECYCLES_AT']))status='UNKNOWN';
    dimensions[key]={status,claim_ids:claims.map(c=>c.claim_id),evidence_refs:unique(claims.flatMap(c=>c.evidence_refs||[])),scope:raw?.scope??null};
  }
  // Generic concentrate capability does not verify chemistry/assay compatibility for diversion.
  const generic=Object.values(dimensions).some(d=>d.scope&&/GENERIC_PRODUCT_CLASS/.test(d.scope));
  let classification=['THEORETICAL_CANDIDATE','FEASIBLE_CANDIDATE'].includes(a.classification)?'THEORETICAL_CANDIDATE':'UNKNOWN_FEASIBILITY';
  if(Object.values(dimensions).every(d=>d.status==='VERIFIED')&&!generic)classification='VERIFIED_ALTERNATIVE';
  else if(dimensions.material_compatibility.status==='VERIFIED'&&dimensions.processing_capability.status==='VERIFIED')classification=(a.classification==='FEASIBLE_CANDIDATE'&&!generic)?'FEASIBLE_CANDIDATE':'THEORETICAL_CANDIDATE';
  return {alternative_id:a.alternative_id,candidate_entity_id:a.entity_id,for_entity_id:a.for_entity_id??a.source_entity_id??null,classification,source_classification:a.classification??a.status??'UNKNOWN_FEASIBILITY',dimensions,available_replacement_quantity:null,usage_restrictions:['No replacement quantity from generic capability, historical capacity, geography or ownership'],claim_ids:a.claim_ids??[],evidence_refs:a.evidence_refs??[]};
}

async function evaluateSimulationInputUncached(graph,dependency,chainId,{asOf='2026-10-08',gapResolutionEvents=[]}={}) {
  const chain=dependency.chains.find(c=>c.chain_id===chainId);if(!chain)throw new Error('UNKNOWN_CHAIN');
  const cached=await cachedGraphReadState(graph),{entityIndex,relationshipIndex,claimIndex,evidenceIndex}=cached;
  const scopedPaths=chain.paths.map(p=>{const q=clone(p);const interval=intersectTemporal(p.RELATIONSHIP_IDS.map(id=>relationshipIndex.get(id)),asOf);q.temporal_status=interval.status;q.TEMPORAL_OVERLAP=interval;if(['HISTORICAL_PATH','VERIFIED_PATH'].includes(q.PATH_STATUS))q.PATH_STATUS=interval.status==='HISTORICAL_VERIFIED_PATH'?'HISTORICAL_PATH':interval.status==='CURRENT_VERIFIED_PATH'?'VERIFIED_PATH':'PARTIAL_PATH';return q;});const validPaths=scopedPaths.filter(p=>p.PATH_STATUS!=='INVALID_PATH');const entityIds=unique([chain.root_entity_id,...validPaths.flatMap(p=>p.ENTITY_IDS)]);const relationshipIds=unique(validPaths.flatMap(p=>p.RELATIONSHIP_IDS));
  const entities=entityIds.map(id=>entityIndex.get(id));const edges=relationshipIds.map(id=>relationshipIndex.get(id));if(entities.some(e=>!e)||edges.some(e=>!e))throw new Error('BROKEN_IDENTITY_OR_RELATIONSHIP_LINEAGE');
  const claims=graph.claims.filter(c=>entityIds.includes(c.entity_id)||edges.some(e=>(e.claim_ids||[]).includes(c.claim_id)));
  const guarded=new Set((graph.record_usage_guards||[]).map(g=>g.claim_id));const eligible=claims.filter(c=>c.fact_status==='FACT'&&!guarded.has(c.claim_id)&&(c.evidence_refs||[]).length&&(c.evidence_refs||[]).every(id=>evidenceIndex.has(id)));
  const edgeClaims=unique(edges.flatMap(e=>e.claim_ids||[])).map(id=>claimIndex.get(id));if(edgeClaims.some(c=>!c))throw new Error('BROKEN_CLAIM_LINEAGE');
  const periods=validPaths.filter(p=>['HISTORICAL_PATH','VERIFIED_PATH'].includes(p.PATH_STATUS));const current=validPaths.filter(p=>p.PATH_STATUS==='VERIFIED_PATH'&&p.temporal_status==='CURRENT_VERIFIED_PATH');
  const materialPaths=validPaths.filter(p=>!(p.UNKNOWN_COMPONENTS||[]).some(c=>c.component_type==='MATERIAL'));
  const amounts=eligible.filter(quantitative);const allocations=amounts.filter(c=>quantityType(c)==='MINE_SPECIFIC_ALLOCATION'&&c.allocation_status==='VERIFIED'&&quantitativeMetadataDecision(c).allowed);
  const allocatedEdges=edges.filter(e=>allocations.some(c=>(c.relationship_ids||[]).includes(e.relationship_id)&&materialChannel(c)===materialChannel(e)&&c.material_basis===e.material_basis));
  const throughput=amounts.filter(c=>quantityType(c)==='FACILITY_TOTAL_THROUGHPUT');const validThroughput=throughput.filter(c=>quantitativeMetadataDecision(c).allowed);
  const capacity=amounts.filter(c=>quantityType(c)==='CAPACITY'||quantityType(c)==='SPARE_CAPACITY');const typedCapacity=capacity.filter(c=>c.capacity_type&&capacityType(c)!=='UNKNOWN_AVAILABLE_CAPACITY');
  const spare=capacity.filter(c=>capacityType(c)==='VERIFIED_AVAILABLE_CAPACITY'&&quantitativeMetadataDecision(c).allowed&&knownPeriod(c)&&c.period_start<=asOf&&asOf<c.period_end&&c.value>0);
  const processingNodes=entities.filter(e=>/SMELTER|REFINERY|CONCENTRATOR|PROCESSOR|PROCESSING|LEACH|SXEW|PORT|TRANSPORT/.test(e.entity_type));
  const availableNodeCoverage=processingNodes.filter(n=>spare.some(c=>c.entity_id===n.entity_id));
  const alternatives=(graph.alternative_candidates||[]).filter(a=>[a.for_entity_id,a.source_entity_id,a.origin_entity_id].some(id=>entityIds.includes(id))).map(a=>evaluateAlternative(a,graph,asOf));
  const conflicts=claims.filter(c=>c.fact_status==='CONFLICT');const unknown=claims.filter(c=>c.fact_status==='UNKNOWN');
  const gapHashes=cached.gapHashes;
  const gaps=graph.data_gaps.filter(g=>(g.entity_ids||[]).some(id=>entityIds.includes(id))|| (g.claim_ids||[]).some(id=>claims.some(c=>c.claim_id===id))).map(g=>{
    const event=gapResolutionEvents.find(e=>e.gap_id===g.gap_id&&e.authority_dataset_hash===graph.meta.dataset_hash&&e.original_gap_hash===gapHashes.get(g.gap_id)&&e.field_path===g.field_path&&g.gap_type==='MATERIAL_BASIS_UNKNOWN'&&g.field_path==='capacity_headline.material_basis'&&e.integration_test_id==='V293-CANONICAL-STAGED-EVIDENCE-INTEGRATION'&&e.integration_test_status==='PASS'&&e.integration_result_sha256&&e.integration_status==='PASS'&&e.effective_status==='RESOLVED_BY_EVIDENCE'&&(e.evidence_refs||[]).length&&(e.supporting_claim_ids||[]).length&&(e.evidence_refs||[]).every(id=>evidenceIndex.has(id))&&(e.supporting_claim_ids||[]).every(id=>eligible.some(c=>c.claim_id===id&&g.entity_ids.includes(c.entity_id)&&c.field==='capacity'&&c.material==='COPPER'&&c.material_basis==='CONCENTRATE'&&c.value===1.6&&c.unit==='Mt/year'&&e.evidence_refs.every(ref=>c.evidence_refs.includes(ref)))));
    return event?{...clone(g),original_status:g.status??'OPEN',effective_status:'RESOLVED_BY_EVIDENCE',verified_resolution_event:clone(event)}:{...clone(g),effective_status:g.status??'OPEN'};
  });const openGaps=gaps.filter(g=>g.effective_status!=='RESOLVED_BY_EVIDENCE');
  const dim=(status,reasons,c=claims,ids=entityIds,rids=relationshipIds,extra={})=>dimension(status,reasons,c,graph,ids,rids,extra);
  const physical=edges.length&&edges.every(e=>['PROCESSES_AT','SUPPLIES','TRANSPORTS_TO','EXPORTS_TO','RECYCLES_AT'].includes(e.relationship_type)&&e.fact_status==='FACT'&&(e.claim_ids||[]).length&&(e.claim_ids||[]).every(id=>eligible.some(c=>c.claim_id===id)));
  const identities=entities.every(e=>e.identity_status&&!['UNKNOWN','POSSIBLE_MATCH','PROBABLE_SAME_ENTITY'].includes(e.identity_status));
  const dims={ENTITY_IDENTITY:dim(identities?'VERIFIED':'UNKNOWN',['Persisted source-scoped identities; no automatic merge'],edgeClaims),PHYSICAL_RELATIONSHIP_CONTINUITY:dim(physical?'VERIFIED':'UNKNOWN',['Only evidenced physical edges; owner/operation/commercial relations cannot bridge paths'],edgeClaims),TEMPORAL_CONTINUITY:dim(periods.length===validPaths.length&&validPaths.length?'VERIFIED':periods.length?'PARTIAL':'UNKNOWN',['Publication and restart events are not validity; historical intervals do not prove current use'],edgeClaims,entityIds,relationshipIds,{current_verified_path_ids:current.map(p=>p.PATH_ID),historical_verified_path_ids:periods.filter(p=>p.PATH_STATUS==='HISTORICAL_PATH').map(p=>p.PATH_ID)}),MATERIAL_COMPATIBILITY:dim(materialPaths.length===validPaths.length&&validPaths.length?'VERIFIED':materialPaths.length?'PARTIAL':'UNKNOWN',['Qualitative product-channel continuity only; concentrate mass, contained copper, anode and cathode are distinct'],edgeClaims),FLOW_QUANTITY_STATUS:dim(allocatedEdges.length===edges.length&&edges.length?'VERIFIED':allocatedEdges.length?'PARTIAL':'UNKNOWN',['Mine production, contracts, sales and facility throughput do not establish per-edge mine allocation'],allocations),CAPACITY_TYPE:dim(typedCapacity.length===capacity.length&&capacity.length?'VERIFIED':capacity.length?'PARTIAL':'UNKNOWN',['Capacity type is separate from its unknown validity and available/spare quantity'],capacity,entityIds,relationshipIds,{types:unique(capacity.map(capacityType)),capacity_period_status:capacity.length&&capacity.every(knownPeriod)?'VERIFIED':'UNKNOWN'}),ACTUAL_THROUGHPUT_STATUS:dim(validThroughput.length?'VERIFIED':throughput.length?'PARTIAL':'UNKNOWN',['Verified totals are facility-scoped historical records; they do not verify feed origin or current throughput'],throughput,entityIds,relationshipIds,{scope:'REPORTED_FACILITY_TOTAL_PERIODS_ONLY',mine_allocation_status:'UNKNOWN'}),SPARE_CAPACITY_STATUS:dim(processingNodes.length&&availableNodeCoverage.length===processingNodes.length?'VERIFIED':spare.length?'PARTIAL':'UNKNOWN',['Required receiving/processing nodes need compatible, dated available-capacity evidence; nominal minus throughput is prohibited'],spare),ALTERNATIVE_FEASIBILITY_STATUS:dim(alternatives.some(a=>a.classification==='VERIFIED_ALTERNATIVE')?'PARTIAL':alternatives.length?'PARTIAL':'UNKNOWN',['Ten feasibility dimensions; no theoretical candidate supplies replacement capacity'],graph.claims.filter(c=>alternatives.some(a=>a.claim_ids.includes(c.claim_id)))),EVIDENCE_COVERAGE:dim(edges.length&&edges.every(e=>(e.evidence_refs||[]).length&&(e.evidence_refs||[]).every(id=>evidenceIndex.has(id)))?'VERIFIED':'UNKNOWN',['Physical edge field evidence verified; missing quantitative fields remain data gaps'],edgeClaims),UNKNOWN_SHARE:dim(unknown.length||openGaps.length?'PARTIAL':'UNKNOWN',['Knowledge-row unknown fraction is explicit; mass-weighted unknown share is UNKNOWN until route allocations exist'],claims,entityIds,relationshipIds,{unknown_claim_count:unknown.length,scoped_claim_count:claims.length,claim_unknown_share:claims.length?unknown.length/claims.length:null,mass_weighted_unknown_share:null,scope:'Selected candidate entity/edge claims, not global data completeness'}),CONFLICT_STATUS:dim(conflicts.length?'CONFLICT':'NOT_APPLICABLE',[conflicts.length?'Conflicting claims retained separately; no averaging':'No CONFLICT claim found in this bounded candidate scope; not a global absence claim'],conflicts)};
  const qualitative=['ENTITY_IDENTITY','PHYSICAL_RELATIONSHIP_CONTINUITY','TEMPORAL_CONTINUITY','MATERIAL_COMPATIBILITY','EVIDENCE_COVERAGE'];
  let status=validPaths.length?'PARTIAL':'NOT_READY';if(qualitative.every(k=>dims[k].status==='VERIFIED')&&!conflicts.length)status='DEPENDENCY_READY';
  // No broad readiness promotion from a partial collection of contextual quantities.
  const required=['ENTITY_IDENTITY','PHYSICAL_RELATIONSHIP_CONTINUITY','TEMPORAL_CONTINUITY','MATERIAL_COMPATIBILITY','FLOW_QUANTITY_STATUS','CAPACITY_TYPE','ACTUAL_THROUGHPUT_STATUS','SPARE_CAPACITY_STATUS','EVIDENCE_COVERAGE'];
  const quantitativeReady=required.every(k=>dims[k].status==='VERIFIED')&&!conflicts.length&&current.length===validPaths.length&&capacity.length&&capacity.every(knownPeriod)&&allocations.every(c=>c.period_start<=asOf&&asOf<c.period_end)&&edges.every(e=>{const q=allocations.find(c=>(c.relationship_ids||[]).includes(e.relationship_id));return q&&spare.some(c=>c.entity_id===e.target_entity_id&&c.unit===q.unit&&c.material_basis===q.material_basis&&materialChannel(c)===materialChannel(q)&&c.period_start===q.period_start&&c.period_end===q.period_end)&&(!e.channel_transition||e.channel_transition.input===e.channel_transition.output);});
  if(quantitativeReady)status='BOUNDED_RESILIENCE_INPUT_READY';
  // Deliberately unsupported in V29.3 until a specifically defined disruption simulation contract exists.
  const referencePeriod=periods.length&&periods.every(p=>p.TEMPORAL_OVERLAP.start===periods[0].TEMPORAL_OVERLAP.start&&p.TEMPORAL_OVERLAP.end===periods[0].TEMPORAL_OVERLAP.end)?{period_type:'CUSTOM',period_start:periods[0].TEMPORAL_OVERLAP.start,period_end:periods[0].TEMPORAL_OVERLAP.end,scope:'VERIFIED_PHYSICAL_PATHS_ONLY'}:{period_type:'UNKNOWN',period_start:null,period_end:null,scope:'NO_CHAIN_WIDE_VERIFIED_PERIOD; individual input periods remain separate'};
  const acceptedResolutions=gaps.filter(g=>g.verified_resolution_event).map(g=>g.verified_resolution_event);
  const resolutionInputs=await Promise.all(acceptedResolutions.map(async event=>({resolution_id:event.resolution_id,event_sha256:await readinessHash(event),original_gap_hash:event.original_gap_hash,integration_result_path:event.integration_result_path,integration_result_sha256:event.integration_result_sha256})));
  const ids=unique([...acceptedResolutions.map(e=>e.resolution_id),...entityIds,...relationshipIds,...claims.map(c=>c.claim_id),...claims.flatMap(c=>c.evidence_refs||[]),...gaps.map(g=>g.gap_id),...alternatives.map(a=>a.alternative_id),...validPaths.map(p=>p.PATH_ID)]);
  const packageOutput={scenario_input_id:`scenario-input:v293:${chainId}`,root_entity_id:chain.root_entity_id,chain_id:chainId,name:chain.name,physical_path_ids:validPaths.map(p=>p.PATH_ID),material:{commodity:'COPPER',basis:'MULTIPLE_SEPARATE_REPORTED_BASES',aggregation_status:'PROHIBITED_WITHOUT_SOURCE_BOUND_CONVERSION'},reference_period:referencePeriod,production_inputs:amounts.filter(c=>quantityType(c)==='PRODUCTION').map(amountInput),throughput_inputs:throughput.map(amountInput),capacity_inputs:capacity.map(amountInput),known_quantities:amounts.map(amountInput),unallocated_quantities:throughput.map(c=>({...amountInput(c),allocation_status:'UNALLOCATED_SHARED_QUANTITY'})),bottleneck_nodes:dependency.shared_nodes.filter(n=>entityIds.includes(n.entity_id)&&n.physical_dependency!==false).map(n=>({entity_id:n.entity_id,node_type:n.node_type??n.type??null,structural_concentration_only:true,known_loss_quantity:null})),alternative_candidates:alternatives,critical_unknowns:[...Object.entries(dims).filter(([,d])=>['UNKNOWN','PARTIAL','CONFLICT'].includes(d.status)).map(([dimension,d])=>({dimension,status:d.status,reasons:d.reasons,input_record_ids:d.input_record_ids})),...openGaps.map(g=>({gap_id:g.gap_id,gap_type:g.gap_type,research_status:g.research_status??'UNKNOWN',status:g.status??g.resolution_status??'OPEN'}))],conflicts:conflicts.map(c=>({claim_id:c.claim_id,entity_id:c.entity_id,fact_status:c.fact_status,evidence_refs:c.evidence_refs})),evidence_refs:unique(claims.flatMap(c=>c.evidence_refs||[])),input_record_ids:ids,allowed_calculations:['INSPECT_EXACT_REPORTED_RECORDS_WITH_THEIR_OWN_PERIOD_AND_BASIS','REPRODUCE_QUALITATIVE_BOUNDED_PATHS','COUNT_KNOWLEDGE_UNKNOWNS_WITH_EXPLICIT_DENOMINATOR'],prohibited_calculations:['CURRENT_DISRUPTION_VOLUME','GLOBAL_SUPPLY_LOSS','ALLOCATE_FACILITY_TOTAL_TO_MINE','CAPACITY_MINUS_THROUGHPUT_AS_SPARE','QUARTERLY_THROUGHPUT_MINUS_ANNUAL_CAPACITY','CONTRACT_OR_SALES_AS_ACTUAL_DELIVERY','ANODE_AS_CATHODE_OR_REFINED_COPPER','CONCENTRATE_MASS_AS_CONTAINED_COPPER_WITHOUT_ASSAY','THEORETICAL_ALTERNATIVE_AS_AVAILABLE_REPLACEMENT','PRODUCTION_TOTAL_PLUS_ITS_COMPONENTS_OR_DOWNSTREAM_OUTPUT'],readiness_status:status,disruption_simulation_readiness:'NOT_READY',readiness_dimensions:dims,as_of:asOf,scope:'BOUNDED_PREPARATION_INPUT; NOT_A_DISRUPTION_SIMULATION_RESULT'};
  const dependencyState=await cachedDependencyReadState(dependency),inputKey=`${dependencyState.authorityInputHash}:${canonicalStringify(acceptedResolutions)}`;let inputHash=cached.inputHashes.get(inputKey);if(!inputHash){inputHash=await readinessHash({knowledge:graph,dependency,accepted_resolution_events:acceptedResolutions});cached.inputHashes.set(inputKey,inputHash);}
  const output={schema_version:READINESS_SCHEMA,authority_dataset_hash:graph.meta.dataset_hash,chain_id:chainId,name:chain.name,root_entity_id:chain.root_entity_id,as_of:asOf,readiness_status:status,dimensions:dims,physical_paths:clone(scopedPaths),resilience_input_package:packageOutput,critical_data_gaps:clone(gaps),prioritized_gaps:clone(dependency.prioritized_gaps.filter(g=>openGaps.some(original=>original.gap_id===g.gap_id))),record_usage_guards:clone((graph.record_usage_guards||[]).filter(g=>claims.some(c=>c.claim_id===g.claim_id))),provenance:{entities:clone(entities),relationships:clone(edges),claims:clone(claims),evidence:clone(graph.evidence.filter(e=>packageOutput.evidence_refs.includes(e.evidence_id))),sources:clone(graph.sources.filter(s=>graph.evidence.some(e=>packageOutput.evidence_refs.includes(e.evidence_id)&&e.source_id===s.source_id))),research_history:clone(graph.research_history.filter(h=>gaps.some(g=>h.gap_id===g.gap_id||h.original_gap_accession_key===(g.accession_key??g.key))))}};
  output.resilience_input_package.lineage=await lineage('package',ids,packageOutput,graph,inputHash,{chain_id:chainId,as_of:asOf,scope:packageOutput.scope,gap_resolution_inputs:resolutionInputs});
  output.lineage=await lineage('candidate',ids,output,graph,inputHash,{chain_id:chainId,as_of:asOf,gap_resolution_inputs:resolutionInputs});output.public_availability_envelope=await availabilityEnvelope(graph.data_gaps.filter(g=>gaps.some(scoped=>scoped.gap_id===g.gap_id)),graph.meta.dataset_hash);return output;
}

export async function evaluateSimulationInput(graph,dependency,chainId,{asOf='2026-10-08',gapResolutionEvents=[]}={}) {
  await Promise.all([cachedGraphReadState(graph),cachedDependencyReadState(dependency)]);
  let dependencyCache=evaluationCache.get(graph);
  if(!dependencyCache){dependencyCache=new WeakMap();evaluationCache.set(graph,dependencyCache);}
  let requestCache=dependencyCache.get(dependency);
  if(!requestCache){requestCache=new Map();dependencyCache.set(dependency,requestCache);}
  // The request key is content based so mutable option objects cannot produce a
  // stale cache hit. Graph and dependency identities are safe only after their
  // complete canonical content has been captured and deep-frozen above.
  const requestKey=canonicalStringify({chain_id:chainId,as_of:asOf,gap_resolution_events:gapResolutionEvents});
  let outputPromise=requestCache.get(requestKey);
  if(!outputPromise){
    outputPromise=evaluateSimulationInputUncached(graph,dependency,chainId,{asOf,gapResolutionEvents}).then(output=>deepFreeze(output));
    requestCache.set(requestKey,outputPromise);
  }
  // Preserve the public API's mutable-result behavior without exposing cached
  // state: callers receive an isolated copy while the frozen canonical result
  // remains the only identity-cached value.
  return clone(await outputPromise);
}
