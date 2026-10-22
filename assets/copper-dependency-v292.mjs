import {availabilityEnvelope} from './copper-public-availability-v293.mjs';
import { canonicalStringify, validateCopperGraph } from './copper-analysis-v29.mjs';
import { classifyAlternative } from './copper-network-v291.mjs';

export const DEPENDENCY_SCHEMA = 'atlas.copper-dependency-analysis/1';
const PHYSICAL = new Set(['PROCESSES_AT','TRANSPORTS_TO','SUPPLIES','EXPORTS_TO','RECYCLES_AT']);
const OWNER = new Set(['OWNS','PARTIALLY_OWNS','ULTIMATE_PARENT']);
const OPERATOR = new Set(['OPERATES']);
const COMMERCIAL = new Set(['OFFTAKE_AGREEMENT']);
const unique = a => [...new Set(a.filter(v=>v!=null))].sort();
const validDate = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
function jsonCompatible(value){
  if(Array.isArray(value))return value.map(v=>{if(v===undefined)throw new Error('UNDEFINED_ARRAY_VALUE');return jsonCompatible(v);});
  if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,jsonCompatible(v)]));
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error('NONFINITE_DERIVED_VALUE');
  return value;
}
async function hash(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalStringify(jsonCompatible(v)))))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function layer(r){return PHYSICAL.has(r.relationship_type)?'PHYSICAL':OWNER.has(r.relationship_type)?'OWNERSHIP':OPERATOR.has(r.relationship_type)?'OPERATION':COMMERCIAL.has(r.relationship_type)?'COMMERCIAL':'CONTEXT';}
function nodeKind(e){const t=e.entity_type;return /SMELTER/.test(t)?'SMELTER':/REFINERY/.test(t)?'REFINERY':/CONCENTRATOR|PROCESSOR|PROCESSING|LEACH|SXEW/.test(t)?'PROCESSOR':/(^|_)PORT(_|$)/.test(t)?'PORT':/TRANSPORT|LOGISTICS|TERMINAL|VESSEL/.test(t)?'TRANSPORT_NODE':/MINE|DEPOSIT/.test(t)?'MINE':/COMPANY|CORPORATE|GROUP|TRADER/.test(t)?'COMPANY':t;}
export function materialChannel(r){
  if(!r.material_basis || ['UNKNOWN','UNKNOWN_MATERIAL_BASIS'].includes(r.material_basis)) return null;
  if(r.material && !['COPPER','COPPER_AND_ZINC'].includes(r.material))return null;
  const f=String(r.material_form??'').toLowerCase().replaceAll('_',' ');
  if(r.material==='COPPER_AND_ZINC' && r.material_basis==='CONCENTRATE' && f==='copper and zinc concentrates')return 'COPPER_CONCENTRATE';
  if(['CONCENTRATE','CONTAINED_METAL'].includes(r.material_basis) && /copper.*concentrate/.test(f))return 'COPPER_CONCENTRATE';
  if(['REFINED_METAL','CONTAINED_METAL'].includes(r.material_basis) && /copper cathode/.test(f))return 'COPPER_CATHODE';
  if(r.material_basis==='INTERMEDIATE_PRODUCT' && /^(copper )?anodes?$/.test(f))return 'COPPER_ANODE';
  if(['ORE','ROM_ORE'].includes(r.material_basis) && /copper|ore/.test(f))return 'COPPER_ORE';
  return null;
}
export function intersectTemporal(edges,asOf='2026-10-07'){
  if(!validDate(asOf))throw new Error('INVALID_AS_OF_DATE');
  const bad=edges.filter(r=>['valid_from','valid_to'].some(k=>r[k]!=null&&!validDate(r[k])) || r.valid_from&&r.valid_to&&r.valid_from>=r.valid_to || r.temporal_status==='SOURCE_DATE_ONLY'&&(r.valid_from||r.valid_to));
  if(bad.length)return {status:'INVALID_INTERVAL',start:null,end:null,known_relationship_ids:[],unknown_relationship_ids:[],invalid_relationship_ids:bad.map(r=>r.relationship_id),reasons:['Invalid or unsourced validity bounds']};
  const known=edges.filter(r=>r.temporal_status==='KNOWN_INTERVAL' && r.valid_from);
  // End-only bounds constrain overlap but cannot establish an interval's start.
  const bounded=edges.filter(r=>r.temporal_status==='KNOWN_INTERVAL' && (r.valid_from||r.valid_to));
  const start=bounded.map(r=>r.valid_from).filter(Boolean).sort().at(-1)??null;
  const end=bounded.map(r=>r.valid_to).filter(Boolean).sort()[0]??null;
  const unknown=edges.filter(r=>!known.includes(r));
  const reasons=[];
  if(start&&end&&start>=end)return {status:'DISJOINT_INTERVALS',start,end,known_relationship_ids:known.map(r=>r.relationship_id),unknown_relationship_ids:unknown.map(r=>r.relationship_id),invalid_relationship_ids:[],reasons:['Validity intervals are disjoint; no continuous path']};
  let status;
  if(unknown.length || !edges.length){status='UNKNOWN_PERIOD';reasons.push('Publication/snapshot dates do not establish validity; missing relationship validity interval');}
  else if(end&&end<=asOf)status='HISTORICAL_VERIFIED_PATH';
  else if(start>asOf){status='FUTURE_PATH';reasons.push('Sourced interval starts after analysis date');}
  else status='CURRENT_VERIFIED_PATH';
  return {status,start,end,known_relationship_ids:known.map(r=>r.relationship_id),unknown_relationship_ids:unknown.map(r=>r.relationship_id),invalid_relationship_ids:[],reasons};
}
async function lineage(ctx,kind,ids,output,rule,parameters={}){
  const stableOutput=jsonCompatible(output);
  const output_hash=await hash(stableOutput);
  const base={derived_record_id:`dependency:${kind}:${output_hash}`,input_record_ids:unique(ids),transformation_id:'atlas.copper-dependency',transformation_version:'2.92.2',formula_or_rule:rule,parameters:jsonCompatible({as_of:ctx.as_of,...parameters}),input_hash:ctx.input_hash,authority_dataset_hash:ctx.authority_dataset_hash,output:stableOutput,output_hash};
  return {...base,execution_hash:await hash(base)};
}
function edgeInputIds(edges){return unique(edges.flatMap(r=>[r.relationship_id,r.source_entity_id,r.target_entity_id,...r.claim_ids,...r.evidence_refs,...r.source_ids,...r.guard_ids]));}
function pathData(ctx,entityIds,edgeIds){
  const index=new Map(ctx.edges.map(r=>[r.relationship_id,r]));const edges=edgeIds.map(id=>index.get(id));
  const temporal=intersectTemporal(edges,ctx.as_of);const unknown=[],conflicts=[];const reasons=[...temporal.reasons];
  for(const node of ctx.nodes.filter(n=>entityIds.includes(n.entity_id)))if(!node.identity_status||['UNKNOWN','POSSIBLE_MATCH','PROBABLE_SAME_ENTITY'].includes(node.identity_status))unknown.push({component_type:'IDENTITY',entity_id:node.entity_id,status:'UNKNOWN_ENTITY_IDENTITY'});
  const transitions=[];let channel=null;let mismatch=false;
  for(const r of edges){
    const [input,output]=r.channels;
    if(!input||!output){unknown.push({component_type:'MATERIAL',relationship_id:r.relationship_id,status:'UNKNOWN_MATERIAL_BASIS'});reasons.push(`Unknown copper product channel at ${r.relationship_id}`);}
    if(channel&&input&&channel!==input){mismatch=true;reasons.push(`Material changes from ${channel} to ${input} without an evidenced conversion`);}
    channel=output;
    transitions.push({relationship_id:r.relationship_id,input,output,conversion:r.channel_transition??null,quantitative_conversion:null});
    if(r.evidence_coverage.status!=='COMPLETE'){unknown.push({component_type:'EVIDENCE',relationship_id:r.relationship_id,status:r.evidence_coverage.status});reasons.push('Incomplete field-level FACT evidence');}
    if(r.material==='COPPER_AND_ZINC')unknown.push({component_type:'QUANTITY',relationship_id:r.relationship_id,status:'UNALLOCATED_SHARED_QUANTITY'});
    for(const c of r.conflict_claim_ids??[])conflicts.push({component_type:'CLAIM',claim_id:c,relationship_id:r.relationship_id});
  }
  for(const id of temporal.unknown_relationship_ids)unknown.push({component_type:'TIME',relationship_id:id,status:'UNKNOWN_PERIOD'});
  let status;
  if(mismatch || ['INVALID_INTERVAL','DISJOINT_INTERVALS'].includes(temporal.status))status='INVALID_PATH';
  else if(unknown.some(v=>['MATERIAL','EVIDENCE','IDENTITY'].includes(v.component_type)) || conflicts.length || temporal.status==='FUTURE_PATH')status='PARTIAL_PATH';
  else if(temporal.status==='UNKNOWN_PERIOD')status=temporal.known_relationship_ids.length?'PARTIAL_PATH':'UNKNOWN_CONTINUITY';
  else if(temporal.status==='HISTORICAL_VERIFIED_PATH')status='HISTORICAL_PATH';
  else status='VERIFIED_PATH';
  for(const node of ctx.nodes.filter(n=>entityIds.includes(n.entity_id)))for(const id of node.conflict_claim_ids??[])conflicts.push({component_type:'QUANTITY_CONTEXT',entity_id:node.entity_id,claim_id:id,status:'CONFLICT',usage:'EXCLUDED_FROM_QUANTITATIVE_SIMULATION_NOT_A_QUALITATIVE_FLOW_CONTRADICTION'});
  const evidence=unique(edges.flatMap(r=>r.evidence_refs));
  return {ENTITY_IDS:entityIds,RELATIONSHIP_IDS:edgeIds,MATERIAL:{commodity:'COPPER',product_channel:channel,transitions,quantitative_conversion:null},TEMPORAL_OVERLAP:temporal,EVIDENCE_COVERAGE:{covered_relationships:edges.filter(r=>r.evidence_coverage.status==='COMPLETE').length,total_relationships:edges.length,evidence_refs:evidence,status:edges.every(r=>r.evidence_coverage.status==='COMPLETE')?'COMPLETE':'PARTIAL'},UNKNOWN_COMPONENTS:unknown,CONFLICT_COMPONENTS:conflicts,PATH_STATUS:status,entity_ids:entityIds,relationship_ids:edgeIds,entity_id:entityIds.at(-1),product_channel:channel,path_status:status,temporal_status:temporal.status,evidence_refs:evidence,claim_ids:unique(edges.flatMap(r=>r.claim_ids)),reasons:unique(reasons),physical_dependency:status!=='INVALID_PATH',quantitative_loss:null};
}
async function makePath(ctx,entityIds,edgeIds){const p=pathData(ctx,entityIds,edgeIds);p.PATH_ID=`path:${await hash({entityIds,edgeIds})}`;p.path_id=p.PATH_ID;p.lineage=await lineage(ctx,'path',unique([...edgeInputIds(ctx.edges.filter(r=>edgeIds.includes(r.relationship_id))),...p.CONFLICT_COMPONENTS.map(c=>c.claim_id)]),{PATH_ID:p.PATH_ID,ENTITY_IDS:p.ENTITY_IDS,RELATIONSHIP_IDS:p.RELATIONSHIP_IDS,MATERIAL:p.MATERIAL,TEMPORAL_OVERLAP:p.TEMPORAL_OVERLAP,EVIDENCE_COVERAGE:p.EVIDENCE_COVERAGE,UNKNOWN_COMPONENTS:p.UNKNOWN_COMPONENTS,CONFLICT_COMPONENTS:p.CONFLICT_COMPONENTS,PATH_STATUS:p.PATH_STATUS},'FACT physical relationships only; exact product channels or source-bound conversion; intersect [start,end) validity without publication dates; no quantitative conversion');return p;}

export async function buildDependencyGraph(graph,{roots=[],asOf='2026-10-07'}={}){
  if(!validDate(asOf))throw new Error('INVALID_AS_OF_DATE');
  const validation=validateCopperGraph(graph);if(!validation.valid){const e=new Error('INVALID_COPPER_GRAPH');e.validation=validation;throw e;}
  const claims=new Map(graph.claims.map(c=>[c.claim_id,c]));const evidence=new Map(graph.evidence.map(e=>[e.evidence_id,e]));
  const guarded=new Map();for(const g of graph.record_usage_guards??[])if(g.claim_id){if(!guarded.has(g.claim_id))guarded.set(g.claim_id,[]);guarded.get(g.claim_id).push(g);}
  const ctx={schema_version:DEPENDENCY_SCHEMA,as_of:asOf,input_hash:await hash(graph),authority_dataset_hash:graph.meta.authority_dataset_hash??graph.meta.dataset_hash,roots:structuredClone(roots),nodes:graph.entities.map(e=>({...structuredClone(e),node_kind:nodeKind(e),conflict_claim_ids:graph.claims.filter(c=>c.entity_id===e.entity_id&&c.fact_status==='CONFLICT').map(c=>c.claim_id),unknown_claim_ids:graph.claims.filter(c=>c.entity_id===e.entity_id&&c.fact_status==='UNKNOWN').map(c=>c.claim_id)})),edges:[],excluded_relationships:[],record_usage_guards:structuredClone(graph.record_usage_guards??[])};
  for(const root of roots)if(!ctx.nodes.some(n=>n.entity_id===root.root_entity_id))throw new Error('UNKNOWN_CHAIN_ROOT');
  if(new Set(roots.map(r=>r.chain_id)).size!==roots.length||new Set(roots.map(r=>r.root_entity_id)).size!==roots.length)throw new Error('DUPLICATE_CHAIN_ROOT');
  for(const r of graph.relationships){
    const guards=r.claim_ids.flatMap(id=>guarded.get(id)??[]);let reason=null;
    if(r.fact_status!=='FACT')reason=`${r.fact_status}_IS_NOT_FACT`;
    else if(r.claim_ids.some(id=>claims.get(id)?.fact_status!=='FACT'))reason='NON_FACT_SUPPORTING_CLAIM';
    else if(guards.length)reason='RECORD_USAGE_GUARD';
    else if(r.derived_from==='GEOGRAPHIC_PROXIMITY'||r.basis==='GEOGRAPHIC_PROXIMITY')reason='GEOGRAPHIC_PROXIMITY_IS_NOT_DEPENDENCY';
    if(reason){ctx.excluded_relationships.push({relationship_id:r.relationship_id,source_entity_id:r.source_entity_id,target_entity_id:r.target_entity_id,origin_entity_id:r.origin_entity_id??null,semantic_layer:layer(r),fact_status:r.fact_status,reason,claim_ids:r.claim_ids,evidence_refs:r.evidence_refs,guard_ids:guards.map(g=>g.guard_id)});continue;}
    const c=materialChannel(r);const channels=r.channel_transition?[r.channel_transition.input,r.channel_transition.output]:[c,c];
    const evRefs=unique([...r.evidence_refs,...r.claim_ids.flatMap(id=>claims.get(id).evidence_refs)]);
    const edge={...structuredClone(r),semantic_layer:layer(r),channels,evidence_refs:evRefs,source_ids:unique(evRefs.map(id=>evidence.get(id)?.source_id)),guard_ids:[],conflict_claim_ids:r.claim_ids.filter(id=>claims.get(id).fact_status==='CONFLICT'),evidence_coverage:{status:r.evidence_refs.length && r.claim_ids.every(id=>claims.get(id).evidence_refs.length)?'COMPLETE':'PARTIAL'},temporal_context:intersectTemporal([r],asOf),usage_restrictions:unique([...(r.usage_restrictions??[]),...(r.claim_ids.flatMap(id=>claims.get(id).usage_restrictions??[]))]),physical_dependency:layer(r)==='PHYSICAL',copper_scope:r.material&&!['COPPER','COPPER_AND_ZINC'].includes(r.material)?'NON_COPPER':'COPPER_OR_UNKNOWN'};
    ctx.edges.push(edge);
  }
  ctx.edges.sort((a,b)=>a.relationship_id.localeCompare(b.relationship_id));
  await Promise.all(ctx.nodes.map(async n=>{n.lineage=await lineage(ctx,'node',[n.entity_id,...n.conflict_claim_ids,...n.unknown_claim_ids],{entity_id:n.entity_id,node_kind:n.node_kind,conflict_claim_ids:n.conflict_claim_ids,unknown_claim_ids:n.unknown_claim_ids},'Source entity identity unchanged; semantic node kind projection; conflict and unknown references preserved');}));
  await Promise.all(ctx.edges.map(async e=>{e.lineage=await lineage(ctx,'edge',edgeInputIds([e]),{relationship_id:e.relationship_id,semantic_layer:e.semantic_layer,channels:e.channels,temporal_context:e.temporal_context},'Project unchanged FACT relationship and bound claims; separate ownership, operation, commercial and physical semantics');}));
  ctx.lineage=await lineage(ctx,'graph',unique([...ctx.nodes.map(n=>n.entity_id),...graph.relationships.map(r=>r.relationship_id),...graph.claims.map(c=>c.claim_id),...graph.evidence.map(e=>e.evidence_id),...graph.sources.map(s=>s.source_id),...(graph.record_usage_guards??[]).map(g=>g.guard_id)]),{node_ids:ctx.nodes.map(n=>n.entity_id),edge_ids:ctx.edges.map(e=>e.relationship_id),excluded_relationships:ctx.excluded_relationships},'Analysis projection; Knowledge unchanged; guarded/non-FACT excluded, semantic layers separated',{roots});
  ctx.data_gaps=structuredClone(graph.data_gaps);
  ctx.public_availability_envelope=await availabilityEnvelope(graph.data_gaps,graph.meta.dataset_hash);
  return ctx;
}

/** Selection expansion is deliberately bounded; invalid continuities are visible diagnostics, never traversable links. */
export async function traverseDependency(graph,{entityId,hops=1,direction='DOWNSTREAM',asOf=graph.as_of??'2026-10-07',temporalFilter='ALL'}={}){
  const ctx=graph.schema_version===DEPENDENCY_SCHEMA?graph:await buildDependencyGraph(graph,{asOf});
  if(!validDate(asOf))throw new Error('INVALID_AS_OF_DATE');
  if(asOf!==ctx.as_of)throw new Error('AS_OF_MISMATCH_REBUILD_REQUIRED');
  if(![1,2,3].includes(hops))throw new Error('HOPS_MUST_BE_1_2_3');
  if(!['UPSTREAM','DOWNSTREAM'].includes(direction))throw new Error('INVALID_DIRECTION');
  if(!ctx.nodes.some(n=>n.entity_id===entityId))throw new Error('UNKNOWN_ENTITY');
  const reverse=direction==='UPSTREAM';const adjacency=new Map();
  for(const e of ctx.edges.filter(r=>r.semantic_layer==='PHYSICAL'&&r.copper_scope!=='NON_COPPER')){const id=reverse?e.target_entity_id:e.source_entity_id;if(!adjacency.has(id))adjacency.set(id,[]);adjacency.get(id).push(e);}
  const queue=[{entityIds:[entityId],edgeIds:[]}],raw=[],cycles=[];
  while(queue.length){const s=queue.shift();if(s.edgeIds.length>=hops)continue;
    for(const e of adjacency.get(s.entityIds.at(-1))??[]){const next=reverse?e.source_entity_id:e.target_entity_id;
      if(s.entityIds.includes(next)){cycles.push({relationship_id:e.relationship_id,entity_ids:[...s.entityIds,next],reason:'CYCLE_NOT_EXPANDED'});continue;}
      const displayEntities=reverse?[next,...s.entityIds.slice().reverse()]:[...s.entityIds,next];
      const edgeIds=reverse?[e.relationship_id,...s.edgeIds.slice().reverse()]:[...s.edgeIds,e.relationship_id];
      const p=pathData(ctx,displayEntities,edgeIds);raw.push({entityIds:displayEntities,edgeIds});
      if(p.path_status!=='INVALID_PATH'&&!p.UNKNOWN_COMPONENTS.some(c=>c.component_type==='MATERIAL'))queue.push({entityIds:[...s.entityIds,next],edgeIds:[...s.edgeIds,e.relationship_id]});
    }
  }
  let paths=await Promise.all(raw.map(s=>makePath(ctx,s.entityIds,s.edgeIds)));
  if(temporalFilter!=='ALL')paths=paths.filter(p=>temporalFilter==='CURRENT'?p.temporal_status==='CURRENT_VERIFIED_PATH'&&p.path_status==='VERIFIED_PATH':temporalFilter==='HISTORICAL'?p.path_status==='HISTORICAL_PATH':temporalFilter==='UNKNOWN'?p.temporal_status==='UNKNOWN_PERIOD':false);
  const ids=new Set([entityId,...paths.filter(p=>p.path_status!=='INVALID_PATH').flatMap(p=>p.entity_ids)]);
  const context=ctx.edges.filter(e=>e.semantic_layer!=='PHYSICAL'&&(e.source_entity_id===entityId||e.target_entity_id===entityId||e.origin_entity_id===entityId));
  const diagnosticIds=new Set(paths.filter(p=>p.path_status==='INVALID_PATH').flatMap(p=>p.entity_ids));
  const relationshipIds=new Set(paths.flatMap(p=>p.relationship_ids));
  const out={schema_version:'atlas.copper-dependency-selection/1',as_of:asOf,authority_dataset_hash:ctx.authority_dataset_hash,selection:{entity_id:entityId,hops,direction,temporal_filter:temporalFilter},nodes:ctx.nodes.filter(n=>ids.has(n.entity_id)||diagnosticIds.has(n.entity_id)).map(n=>({...n,diagnostic_only:!ids.has(n.entity_id)})),edges:ctx.edges.filter(e=>relationshipIds.has(e.relationship_id)),paths,context_edges:context,cycles,excluded_relationships:ctx.excluded_relationships.filter(e=>ids.has(e.source_entity_id)||ids.has(e.target_entity_id)||ids.has(e.origin_entity_id)),quantitative_loss:null};
  out.lineage=await lineage(ctx,'selection',unique([entityId,...edgeInputIds([...out.edges,...context]),...out.excluded_relationships.flatMap(e=>[e.relationship_id,...e.claim_ids,...e.evidence_refs,...e.guard_ids])]),{selection:out.selection,path_ids:paths.map(p=>p.PATH_ID),cycles},'On-demand bounded simple-path traversal; cycles diagnosed; upstream reverses traversal, never relationship meaning; context cannot bridge material flow',out.selection);
  out.data_gaps=(ctx.data_gaps??[]).filter(g=>g.entity_ids.some(id=>ids.has(id)||diagnosticIds.has(id)));
  out.public_availability_envelope=await availabilityEnvelope(out.data_gaps,ctx.authority_dataset_hash);
  return out;
}

function dimension(status,reasons,ids=[]){return {status,reasons,input_record_ids:unique(ids)};}
function currentClaim(c,asOf){return c.fact_status==='FACT'&&typeof c.value==='number'&&Number.isFinite(c.value)&&c.unit&&materialChannel(c)&&validDate(c.period_start)&&validDate(c.period_end)&&c.period_start<=asOf&&asOf<c.period_end&&c.evidence_refs.length>0;}
async function readiness(ctx,knowledge,entityIds,paths,alternatives,scope){
  const ids=new Set(entityIds);const entities=ctx.nodes.filter(n=>ids.has(n.entity_id));const edges=ctx.edges.filter(e=>paths.some(p=>p.relationship_ids.includes(e.relationship_id)));
  const claims=knowledge.claims.filter(c=>ids.has(c.entity_id));const guards=new Set((knowledge.record_usage_guards??[]).map(g=>g.claim_id));const eligible=claims.filter(c=>!guards.has(c.claim_id));
  const identity=entities.every(e=>e.identity_status&&!['UNKNOWN','POSSIBLE_MATCH','PROBABLE_SAME_ENTITY'].includes(e.identity_status));
  const valid=paths.filter(p=>p.path_status!=='INVALID_PATH');const verified=valid.filter(p=>['VERIFIED_PATH','HISTORICAL_PATH'].includes(p.path_status));const current=valid.filter(p=>p.path_status==='VERIFIED_PATH'&&p.temporal_status==='CURRENT_VERIFIED_PATH');
  const quantities=eligible.filter(c=>currentClaim(c,ctx.as_of)&&/allocated_flow|route_quantity|shipment_allocation/.test(c.field));
  const capacities=eligible.filter(c=>currentClaim(c,ctx.as_of)&&/available_spare_capacity|available_capacity/.test(c.field));
  const relevantAlternatives=alternatives.filter(a=>ids.has(a.for_entity_id??a.source_entity_id??a.origin_entity_id??a.entity_id));const provenAlternatives=relevantAlternatives.filter(a=>a.feasibility_status==='VERIFIED_ALTERNATIVE');
  const dims={IDENTITY:dimension(identity?'VERIFIED':'UNKNOWN',identity?['Source-scoped identities; no automatic candidate merge']:['One or more node identities are unresolved'],entities.map(e=>e.entity_id)),RELATIONSHIPS:dimension(valid.length?'VERIFIED':'UNKNOWN',valid.length?['Evidenced physical relationships; ownership/commercial excluded']:['No eligible evidenced copper physical relationship'],edgeInputIds(edges)),TIME:dimension(valid.length&&verified.length===valid.length?'VERIFIED':verified.length?'PARTIAL':'UNKNOWN',verified.length?[current.length?'At least one current continuous path':'Historical continuous path only; current validity not established']:['No fully evidenced compatible validity interval'],edges.map(e=>e.relationship_id)),MATERIAL:dimension(valid.length&&valid.every(p=>!p.UNKNOWN_COMPONENTS.some(c=>c.component_type==='MATERIAL'))?'VERIFIED':valid.some(p=>!p.UNKNOWN_COMPONENTS.some(c=>c.component_type==='MATERIAL'))?'PARTIAL':'UNKNOWN',['Copper product channels checked; unknown channels cannot bridge; no mass conversion'],edges.map(e=>e.relationship_id)),QUANTITY:dimension(quantities.length&&quantities.every(c=>c.allocation_status==='VERIFIED')?'VERIFIED':'UNKNOWN',['Current route-specific allocated quantities required; historical production is not disruption volume'],quantities.map(c=>c.claim_id)),CAPACITY:dimension(capacities.length?'VERIFIED':'UNKNOWN',['Current available processing/transport capacity required; nameplate is not spare capacity'],capacities.map(c=>c.claim_id)),ALTERNATIVES:dimension(provenAlternatives.length?'VERIFIED':'UNKNOWN',['Only sourced current VERIFIED_ALTERNATIVE may support substitution; theoretical candidates excluded'],relevantAlternatives.map(a=>a.alternative_id)),EVIDENCE:dimension(valid.length&&edges.every(e=>e.evidence_coverage.status==='COMPLETE')?'VERIFIED':'UNKNOWN',['Every physical edge requires bound FACT claims and evidence'],edgeInputIds(edges))};
  let status='NOT_READY';if(valid.length)status='PARTIAL';if(['IDENTITY','RELATIONSHIPS','TIME','MATERIAL','EVIDENCE'].every(k=>dims[k].status==='VERIFIED'))status='DEPENDENCY_READY';
  // Complete per-edge capacity and quantity coverage is mandatory, not one known record on a large chain.
  const matchingQuantity=(c,e)=>c.relationship_ids?.includes(e.relationship_id)&&c.allocation_status==='VERIFIED'&&materialChannel(c)===e.channels[0]&&c.material_basis===e.material_basis&&c.value>=0;
  const flowAllocated=edges.length>0&&edges.every(e=>quantities.some(c=>matchingQuantity(c,e)));
  const conversionsQuantified=edges.every(e=>{if(!e.channel_transition||e.channel_transition.input===e.channel_transition.output)return true;const v=e.quantitative_conversion;if(v?.fact_status!=='FACT'||!Number.isFinite(v.conversion_factor)||v.conversion_factor<=0||!v.evidence_refs?.length||!v.claim_ids?.length)return false;return v.claim_ids.every(id=>{const c=knowledge.claims.find(c=>c.claim_id===id);return c?.fact_status==='FACT'&&c.field==='quantitative_conversion'&&c.relationship_ids?.includes(e.relationship_id)&&c.value?.input_channel===e.channel_transition.input&&c.value?.output_channel===e.channel_transition.output&&c.value?.conversion_factor===v.conversion_factor&&v.evidence_refs.every(ref=>c.evidence_refs.includes(ref));});});
  const capacityCovered=entities.filter(n=>['PROCESSOR','SMELTER','REFINERY','PORT','TRANSPORT_NODE'].includes(n.node_kind)).every(n=>{const relevant=edges.filter(e=>e.target_entity_id===n.entity_id||e.source_entity_id===n.entity_id);return relevant.length>0&&relevant.every(e=>quantities.some(q=>matchingQuantity(q,e)&&capacities.some(c=>c.entity_id===n.entity_id&&materialChannel(c)===materialChannel(q)&&c.material_basis===q.material_basis&&c.unit===q.unit&&c.period_start===q.period_start&&c.period_end===q.period_end&&c.value>=0)));});
  dims.QUANTITY.status=flowAllocated?'VERIFIED':quantities.length?'PARTIAL':'UNKNOWN';
  dims.CAPACITY.status=capacityCovered&&capacities.length?'VERIFIED':capacities.length?'PARTIAL':'UNKNOWN';
  if(status==='DEPENDENCY_READY'&&current.length===valid.length&&Object.values(dims).every(d=>d.status==='VERIFIED')&&flowAllocated&&capacityCovered&&conversionsQuantified)status='DISRUPTION_SIMULATION_READY';
  const conflicts=eligible.filter(c=>c.fact_status==='CONFLICT');
  for(const p of valid.filter(p=>!['VERIFIED_PATH','HISTORICAL_PATH'].includes(p.path_status)))for(const component of p.UNKNOWN_COMPONENTS) { const key=component.component_type==='IDENTITY'?'IDENTITY':component.component_type==='TIME'?'TIME':component.component_type==='MATERIAL'?'MATERIAL':component.component_type==='QUANTITY'?'QUANTITY':'EVIDENCE'; dims[key].reasons.push(`Path ${p.PATH_ID}: ${component.status} on ${component.relationship_id}`); }
  const blocking=Object.entries(dims).filter(([,d])=>d.status!=='VERIFIED').flatMap(([k,d])=>d.reasons.map(reason=>({dimension:k,reason})));
  for(const p of valid.filter(p=>!['VERIFIED_PATH','HISTORICAL_PATH'].includes(p.path_status)))for(const component of p.UNKNOWN_COMPONENTS)blocking.push({dimension:component.component_type,relationship_id:component.relationship_id,path_id:p.PATH_ID,reason:component.status});
  if(!current.length)blocking.push({dimension:'TIME',reason:'Current path validity unknown; historical dependency readiness does not permit current simulation'});
  if(!flowAllocated)blocking.push({dimension:'QUANTITY',reason:'Missing per-relationship current allocated flow coverage'});
  if(!conversionsQuantified)blocking.push({dimension:'MATERIAL',reason:'Qualitative source-bound process transitions have no evidenced numerical conversion; quantitative simulation blocked'});
  if(!capacityCovered)blocking.push({dimension:'CAPACITY',reason:'Missing current available capacity for one or more processing/transport nodes'});
  const out={scope,verified_path_ids:verified.map(p=>p.PATH_ID),current_verified_path_ids:current.map(p=>p.PATH_ID),readiness_scope:'ALL_RELEVANT_SELECTED_PATHS_MAX_3_HOPS; dependency readiness may be historical only if all selected paths have sourced compatible intervals',entity_ids:unique(entityIds),status,dependency_readiness:status,disruption_simulation_readiness:status==='DISRUPTION_SIMULATION_READY'?status:'NOT_READY',dimensions:dims,temporal_scope:current.length?'CURRENT_AND_REPORTED_CONTEXT':verified.length?'HISTORICAL_ONLY':'UNKNOWN_PERIOD',reasons:blocking,conflict_claim_ids:conflicts.map(c=>c.claim_id),quantitative_loss:null};
  out.lineage=await lineage(ctx,'readiness',unique([...entityIds,...edgeInputIds(edges),...claims.map(c=>c.claim_id),...relevantAlternatives.flatMap(a=>[a.alternative_id,...(a.claim_ids??[]),...(a.evidence_refs??[])])]),out,'Eight separate dimensions. Dependency readiness requires every selected valid path to have sourced compatible qualitative continuity; historical-only scope remains explicit. Current simulation additionally requires every physical edge allocated, every processing/transport node available capacity, and sourced current alternative feasibility; unknown values never zero',{scope});return out;
}

export async function analyzeDependencyNetwork(knowledge,{roots=[],asOf='2026-10-07'}={}){
  const ctx=await buildDependencyGraph(knowledge,{roots,asOf});const selections=await Promise.all(roots.map(root=>traverseDependency(ctx,{entityId:root.root_entity_id,hops:3,direction:'DOWNSTREAM',asOf})));
  const alternatives=await Promise.all((knowledge.alternative_candidates??[]).map(async a=>{const out=classifyAlternative(a,knowledge,asOf);if(out.feasibility_status==='VERIFIED_ALTERNATIVE'){const spare=a.dimensions?.spare_capacity;const spareClaims=knowledge.claims.filter(c=>(spare?.claim_ids??[]).includes(c.claim_id)&&c.entity_id===a.entity_id&&materialChannel(a)&&materialChannel(c)===materialChannel(a)&&c.material_basis===a.material_basis&&c.fact_status==='FACT'&&currentClaim(c,asOf)&&typeof c.value==='number'&&c.value>0&&/available_spare_capacity|spare_capacity/.test(c.field));if(!spareClaims.length){out.feasibility_status='FEASIBLE_CANDIDATE';out.usage_restrictions=unique([...out.usage_restrictions,'No FACT current available spare-capacity amount; verified dimension flag alone is insufficient']);}}out.lineage=await lineage(ctx,'alternative',unique([a.alternative_id,a.entity_id,...(a.claim_ids??[]),...(a.evidence_refs??[]),...Object.values(a.dimensions??{}).flatMap(d=>[...(d.claim_ids??[]),...(d.evidence_refs??[])])]),out,'Six evidenced feasibility dimensions; no replacement volume from nameplate or theoretical candidates');return out;}));
  const chains=[];const memberships=new Map();
  for(let i=0;i<roots.length;i++){
    const root=roots[i],selection=selections[i],paths=selection.paths;
    const physicalIds=unique([root.root_entity_id,...paths.filter(p=>p.path_status!=='INVALID_PATH'&&!p.UNKNOWN_COMPONENTS.some(c=>c.component_type==='MATERIAL')).flatMap(p=>p.entity_ids)]);
    const context=ctx.edges.filter(e=>e.semantic_layer!=='PHYSICAL'&&(physicalIds.includes(e.source_entity_id)||physicalIds.includes(e.target_entity_id)||e.origin_entity_id&&physicalIds.includes(e.origin_entity_id)));
    memberships.set(root.chain_id,{ids:new Set(physicalIds),paths,context});
    const ready=await readiness(ctx,knowledge,physicalIds,paths,alternatives,{type:'CHAIN',chain_id:root.chain_id});
    const out={...root,paths,context_relationship_ids:context.map(e=>e.relationship_id),entity_ids:physicalIds,readiness:ready,dependency_readiness:ready.status,disruption_simulation_readiness:ready.disruption_simulation_readiness,gap_ids:knowledge.data_gaps.filter(g=>g.entity_ids.some(id=>physicalIds.includes(id))).map(g=>g.gap_id),quantitative_loss:null};
    out.lineage=await lineage(ctx,'chain',unique([...physicalIds,...paths.flatMap(p=>p.lineage.input_record_ids),...edgeInputIds(context),...out.gap_ids]),{chain_id:root.chain_id,path_ids:paths.map(p=>p.PATH_ID),readiness:ready.status,gap_ids:out.gap_ids},'Root-scoped compatible copper paths up to 3 hops; contextual owner/operator/contracts remain distinct');chains.push(out);
  }
  const shared=[];
  for(const node of ctx.nodes){
    const types=new Map();
    const add=(type,chainId,edges,paths=[])=>{if(!types.has(type))types.set(type,{chainIds:new Set(),edgeIds:new Set(),paths:[]});const row=types.get(type);row.chainIds.add(chainId);edges.forEach(e=>row.edgeIds.add(e.relationship_id));row.paths.push(...paths);};
    for(const root of roots){const m=memberships.get(root.chain_id);const paths=m.paths.filter(p=>p.path_status!=='INVALID_PATH'&&!p.UNKNOWN_COMPONENTS.some(c=>c.component_type==='MATERIAL')&&p.entity_ids.slice(1).includes(node.entity_id));
      if(paths.length && ['PROCESSOR','SMELTER','REFINERY','PORT','TRANSPORT_NODE'].includes(node.node_kind))add(`SHARED_${node.node_kind}`,root.chain_id,ctx.edges.filter(e=>paths.some(p=>p.relationship_ids.includes(e.relationship_id))),paths);
      const ownership=m.context.filter(e=>e.semantic_layer==='OWNERSHIP'&&e.source_entity_id===node.entity_id&&m.ids.has(e.target_entity_id));if(ownership.length)add('SHARED_OWNER',root.chain_id,ownership);
      const commercial=m.context.filter(e=>e.semantic_layer==='COMMERCIAL'&&e.target_entity_id===node.entity_id&&(m.ids.has(e.source_entity_id)||e.origin_entity_id&&m.ids.has(e.origin_entity_id)));if(commercial.length)add('SHARED_OFFTAKER',root.chain_id,commercial);
    }
    for(const [type,row] of types)if(row.chainIds.size>1){const edges=ctx.edges.filter(e=>row.edgeIds.has(e.relationship_id));const p=unique(row.paths.filter(p=>['VERIFIED_PATH','HISTORICAL_PATH'].includes(p.path_status)).map(p=>p.PATH_ID));const out={entity_id:node.entity_id,canonical_name:node.canonical_name,entity_type:node.entity_type,identity_scope:node.identity_scope??null,aggregation_scope:/GROUP/.test(node.entity_type)?'REPORTED_FACILITY_GROUP_UNALLOCATED_MEMBERS':'SOURCE_SCOPED_NODE',type,chain_ids:[...row.chainIds].sort(),relationship_ids:[...row.edgeIds].sort(),DIRECT_CHAIN_COUNT:row.chainIds.size,VERIFIED_PATH_COUNT:p.length,COMMODITY_CONTEXT:'COPPER_QUALITATIVE_CONTEXT_NO_ALLOCATED_FLOW',TEMPORAL_CONTEXT:{as_of:asOf,statuses:unique([...row.paths.map(p=>p.temporal_status),...edges.map(e=>e.temporal_context.status)]),current_flow_guarantee:false},direct_chain_count:row.chainIds.size,verified_path_count:p.length,physical_dependency:!['SHARED_OWNER','SHARED_OFFTAKER'].includes(type),spare_capacity:null,quantity_allocation:'UNALLOCATED_SHARED_QUANTITY',evidence_refs:unique(edges.flatMap(e=>e.evidence_refs))};out.lineage=await lineage(ctx,'shared',unique([...edgeInputIds(edges),...roots.filter(r=>row.chainIds.has(r.chain_id)).map(r=>r.root_entity_id)]),out,'Deduplicate chain roots and evidenced path IDs; contextual ownership/offtake counted separately; shared use is not economic criticality');shared.push(out);}
  }
  const metrics=[];const nodeReadiness=[];
  for(const node of ctx.nodes){
    const incoming=ctx.edges.filter(e=>e.semantic_layer==='PHYSICAL'&&e.copper_scope!=='NON_COPPER'&&e.target_entity_id===node.entity_id&&e.channels[0]);const outgoing=ctx.edges.filter(e=>e.semantic_layer==='PHYSICAL'&&e.copper_scope!=='NON_COPPER'&&e.source_entity_id===node.entity_id&&e.channels[0]);
    const dependentRoots=roots.filter(r=>memberships.get(r.chain_id).ids.has(node.entity_id)&&r.root_entity_id!==node.entity_id);
    const nodePaths=selections.flatMap(s=>s.paths.filter(p=>p.path_status!=='INVALID_PATH'&&p.entity_ids.includes(node.entity_id)));
    const verifiedPaths=unique(nodePaths.filter(p=>['VERIFIED_PATH','HISTORICAL_PATH'].includes(p.path_status)).map(p=>p.PATH_ID));
    const values={degree:unique([...incoming,...outgoing].map(e=>e.relationship_id)).length,in_degree:incoming.length,out_degree:outgoing.length,number_of_verified_paths:verifiedPaths.length,number_of_dependent_mines:unique(dependentRoots.map(r=>r.root_entity_id)).length,number_of_shared_chains:unique(dependentRoots.map(r=>r.chain_id)).length,known_dependency_concentration:{value:roots.length?unique(dependentRoots.map(r=>r.root_entity_id)).length/unique(roots.map(r=>r.root_entity_id)).length:null,numerator:unique(dependentRoots.map(r=>r.root_entity_id)).length,denominator:unique(roots.map(r=>r.root_entity_id)).length,scope:'Share of selected mine roots reaching this node in evidenced qualitative topology; not economic, global, volume or current supply concentration'}};
    const metricLineage={};for(const [key,value] of Object.entries(values))metricLineage[key]=await lineage(ctx,'metric',unique([node.entity_id,...edgeInputIds([...incoming,...outgoing]),...nodePaths.flatMap(p=>p.lineage.input_record_ids),...roots.map(r=>r.root_entity_id)]),{entity_id:node.entity_id,metric:key,value},'Unique physical copper edge degree and selected-root simple-path reachability; verified includes historical; no economic criticality',{scope:'SELECTED_ROOTS_MAX_3_HOPS'});
    metrics.push({entity_id:node.entity_id,...values,metric_lineage:metricLineage});
    nodeReadiness.push({...await readiness(ctx,knowledge,[node.entity_id],nodePaths,alternatives,{type:'NODE',entity_id:node.entity_id}),entity_id:node.entity_id});
  }
  const prioritized=[];
  for(const gap of knowledge.data_gaps.filter(g=>!['CLOSED','RESOLVED_BY_EVIDENCE'].includes(g.status))){
    const history=(knowledge.research_history??[]).filter(h=>h.gap_id===gap.gap_id||h.original_gap_accession_key&&(h.original_gap_accession_key===(gap.accession_key??gap.key))).sort((a,b)=>String(a.last_checked??'').localeCompare(String(b.last_checked??'')));
    const researchStatus=history.at(-1)?.research_status??gap.research_status??'UNKNOWN';
    const text=`${gap.gap_type} ${gap.field_path} ${gap.missing_evidence}`.toLowerCase();
    const admin=/coordinate|headquarter|geolocation/.test(text);const flowCritical=/quantity|allocation|spare|capacity|valid|temporal|time|material|period|route|smelt|refin|offtake|downstream|process/.test(text);
    const simulationImpact=admin?0:flowCritical?3:1;
    const affected=roots.filter(r=>[...memberships.get(r.chain_id).ids].some(id=>gap.entity_ids.includes(id)));
    const dependencyImpact=admin?0:Math.min(3,affected.length||1);
    const uncertaintyReduction=admin?0:/valid|temporal|time|period|material|allocation|spare|capacity/.test(text)?3:flowCritical?2:1;
    const sourcesChecked=unique([...(gap.sources_checked??[]),...history.flatMap(h=>h.sources_checked??[])]);
    const sourceAvailability=researchStatus==='RESEARCHED_FOUND'?3:researchStatus==='RESEARCHED_NO_PUBLIC_EVIDENCE'?0:researchStatus==='NOT_RESEARCHED'?1:2;
    const researchCost=researchStatus==='RESEARCHED_NO_PUBLIC_EVIDENCE'?3:history.length||['RESEARCHED_CONFLICT','RESEARCH_INCOMPLETE'].includes(researchStatus)?2:1;
    const score=5*simulationImpact+4*dependencyImpact+3*uncertaintyReduction+2*sourceAvailability-researchCost;
    const retry=history.length>0||!['NOT_RESEARCHED','UNKNOWN'].includes(researchStatus);
    const out={gap_id:gap.gap_id,entity_ids:gap.entity_ids,field_path:gap.field_path,gap_type:gap.gap_type,missing_evidence:gap.missing_evidence??gap.research_result??null,research_status:researchStatus,research_history_ids:history.map(h=>h.research_history_id),sources_checked:sourcesChecked,simulation_impact:simulationImpact,dependency_impact:dependencyImpact,uncertainty_reduction:uncertaintyReduction,source_availability:sourceAvailability,research_cost:researchCost,priority_score:score,reason:`${simulationImpact}/3 simulation input impact; ${affected.length} selected chains affected; ${uncertaintyReduction}/3 potential uncertainty reduction; ${researchStatus}; estimated source/cost categories, no measured probability or financial criticality`,formula:'5*simulation_impact + 4*dependency_impact + 3*uncertainty_reduction + 2*source_availability - research_cost; deterministic heuristic dimensions 0..3; source availability and cost are estimates from recorded research status',score_status:'HEURISTIC_NOT_FACT',retry_policy:retry?'NEW_SOURCE_OR_METHOD_OR_CHANGED_CONTEXT_REQUIRED':'INITIAL_RESEARCH_PERMITTED',next_action:gap.next_action??gap.next_research_action??null,affected_chain_ids:affected.map(r=>r.chain_id)};
    out.lineage=await lineage(ctx,'voi',unique([gap.gap_id,...gap.entity_ids,...(gap.claim_ids??[]),...history.map(h=>h.research_history_id),...affected.flatMap(r=>memberships.get(r.chain_id).paths.flatMap(p=>p.lineage.input_record_ids))]),out,out.formula,{research_failure_memory:true});prioritized.push(out);
  }
  prioritized.sort((a,b)=>b.priority_score-a.priority_score||a.gap_id.localeCompare(b.gap_id));
  const allPaths=[...new Map(chains.flatMap(c=>c.paths).map(p=>[p.PATH_ID,p])).values()];
  const physical=ctx.edges.filter(e=>e.semantic_layer==='PHYSICAL'&&e.copper_scope!=='NON_COPPER');const coverage={};
  for(const [field,predicate] of Object.entries({temporal:e=>['CURRENT_VERIFIED_PATH','HISTORICAL_VERIFIED_PATH'].includes(e.temporal_context.status),material:e=>e.channels.every(Boolean),evidence:e=>e.evidence_coverage.status==='COMPLETE'})){
    const out={known:physical.filter(predicate).length,total:physical.length,denominator:'Eligible FACT physical copper-context relationship records, including unknown material records; selected expansion ledger only',excluded_non_fact_relationships:ctx.excluded_relationships.length};out.lineage=await lineage(ctx,'coverage',edgeInputIds(physical),out,`Count physical FACT relationships with known ${field}, independent denominator; excludes non-FACT/guarded relationships`);coverage[field]=out;
  }
  const counts={entities:knowledge.entities.length,relationships:knowledge.relationships.length,claims:knowledge.claims.length,sources:knowledge.sources.length,chains_total:chains.length,verified_paths:allPaths.filter(p=>['VERIFIED_PATH','HISTORICAL_PATH'].includes(p.path_status)).length,current_verified_paths:allPaths.filter(p=>p.path_status==='VERIFIED_PATH').length,historical_paths:allPaths.filter(p=>p.path_status==='HISTORICAL_PATH').length,partial_paths:allPaths.filter(p=>['PARTIAL_PATH','UNKNOWN_CONTINUITY'].includes(p.path_status)).length,invalid_paths:allPaths.filter(p=>p.path_status==='INVALID_PATH').length,dependency_ready_chains:chains.filter(c=>['DEPENDENCY_READY','DISRUPTION_SIMULATION_READY'].includes(c.readiness.status)).length,simulation_ready_chains:chains.filter(c=>c.readiness.status==='DISRUPTION_SIMULATION_READY').length,shared_processors:shared.filter(s=>s.type==='SHARED_PROCESSOR').length,shared_smelters:shared.filter(s=>s.type==='SHARED_SMELTER').length,shared_refineries:shared.filter(s=>s.type==='SHARED_REFINERY').length,shared_ports:shared.filter(s=>s.type==='SHARED_PORT').length,shared_offtakers:shared.filter(s=>s.type==='SHARED_OFFTAKER').length,data_gaps_open:prioritized.length};
  const out={...ctx,chains,shared_nodes:shared,metrics,node_readiness:nodeReadiness,alternatives,prioritized_gaps:prioritized,top_10_value_of_information_gaps:prioritized.slice(0,10),coverage,counts,path_scope:'All simple physical prefix paths from selected mine roots to at most 3 hops; VERIFIED_PATHS includes historical sourced paths, current count separately',limitations:['Graph centrality is not economic criticality','Shared nodes imply no allocated flow or available spare capacity','Historical readiness does not establish current disruption simulation readiness','Current quantity, available capacity and proven alternative data remain required','Ownership, operator, marketing and contract context cannot bridge physical material paths','Publication dates never supply validity bounds'],analysis_contract:{schema:DEPENDENCY_SCHEMA,version:'2.92.2',knowledge_mutation:false,llm_used:false,as_of:asOf,maximum_hops:3}};
  out.lineage=await lineage(ctx,'network',unique([...ctx.lineage.input_record_ids,...knowledge.data_gaps.map(g=>g.gap_id),...(knowledge.research_history??[]).map(h=>h.research_history_id)]),{counts,chain_readiness:chains.map(c=>({chain_id:c.chain_id,status:c.readiness.status})),shared_nodes:shared.map(s=>({entity_id:s.entity_id,type:s.type})),top_10_gap_ids:prioritized.slice(0,10).map(g=>g.gap_id)},'Versioned deterministic dependency graph, bounded channel/time paths, shared-root topology, eight-dimensional readiness, research-memory-aware VOI',{roots,maximum_hops:3});
  out.public_availability_envelope=await availabilityEnvelope(knowledge.data_gaps,knowledge.meta.dataset_hash);
  return out;
}
