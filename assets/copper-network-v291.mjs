import {availabilityEnvelope} from './copper-public-availability-v293.mjs';
import { validateCopperGraph, analyzeDisruption, canonicalStringify } from './copper-analysis-v29.mjs';

const physical = new Set(['PROCESSES_AT','TRANSPORTS_TO','SUPPLIES']);
const owners = new Set(['OWNS','PARTIALLY_OWNS','OPERATES','ULTIMATE_PARENT']);
const commercial = new Set(['OFFTAKE_AGREEMENT','MARKETS_VIA']);
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
async function hash(value) {
  const bytes = new TextEncoder().encode(canonicalStringify(value));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
}

/** A publication date is never a relationship validity bound. */
export function classifyPathTemporal(path, relationships, asOf) {
  if (!dateValid(asOf)) throw new Error('INVALID_AS_OF_DATE');
  const edges = path.relationship_ids.map(id=>relationships.find(r=>r.relationship_id===id));
  if (!edges.length || edges.some(r=>!r)) return 'UNKNOWN_TEMPORAL_CONTINUITY';
  if (edges.some(r=>['valid_from','valid_to'].some(k=>r[k]!=null && !dateValid(r[k])) || r.valid_from && r.valid_to && r.valid_from>=r.valid_to)) return 'UNKNOWN_TEMPORAL_CONTINUITY';
  const known = edges.filter(r=>r.temporal_status==='KNOWN_INTERVAL' && (r.valid_from || r.valid_to));
  if (!known.length) return 'UNKNOWN_TEMPORAL_CONTINUITY';
  const start = known.map(r=>r.valid_from).filter(Boolean).sort().at(-1) ?? null;
  const end = known.map(r=>r.valid_to).filter(Boolean).sort()[0] ?? null;
  if (start && end && start>=end) return 'UNKNOWN_TEMPORAL_CONTINUITY';
  if (known.length!==edges.length || known.some(r=>!r.valid_from)) return 'PARTIAL_TEMPORAL_PATH';
  if (end && end<=asOf) return 'HISTORICAL_VERIFIED_PATH';
  if (start && start>asOf) return 'PARTIAL_TEMPORAL_PATH';
  return 'CURRENT_VERIFIED_PATH';
}

/** Replacement feasibility requires separate evidenced dimensions. */
export function classifyAlternative(candidate, graph, asOf) {
  const keys = ['material_compatibility','processing_compatibility','transport_access','geographic_access','temporal_availability','spare_capacity'];
  const evidence = new Set(graph.evidence.map(e=>e.evidence_id));
  const dimensions = Object.fromEntries(keys.map(k=>[k,candidate.dimensions?.[k] ?? {status:'UNKNOWN',evidence_refs:[]} ]));
  const proven = k => dimensions[k].status==='VERIFIED' && dimensions[k].evidence_refs?.length>0 && dimensions[k].evidence_refs.every(ref=>evidence.has(ref));
  const bounded = candidate.valid_from && dateValid(candidate.valid_from) && candidate.valid_from<=asOf && (!candidate.valid_to || dateValid(candidate.valid_to) && candidate.valid_to>asOf);
  let status = 'UNKNOWN_FEASIBILITY';
  if (candidate.fact_status==='FACT' && keys.every(proven) && bounded) status='VERIFIED_ALTERNATIVE';
  else if (['material_compatibility','processing_compatibility','transport_access','geographic_access'].every(proven)) status='FEASIBLE_CANDIDATE';
  else if (proven('material_compatibility') && proven('processing_compatibility')) status='THEORETICAL_CANDIDATE';
  return {...candidate,dimensions,feasibility_status:status,available_replacement_quantity:null,
    usage_restrictions:[...new Set([...(candidate.usage_restrictions??[]),'No replacement volume without allocation and capacity evidence','Nameplate capacity is not spare capacity','Feasibility is bounded by its evidenced validity period'])]};
}

function membership(graph, root, paths) {
  const ids = new Set([root,...paths.flatMap(p=>p.entity_ids)]);
  const relationshipIds = new Set(paths.flatMap(p=>p.relationship_ids));
  const edges = new Map(graph.relationships.filter(r=>relationshipIds.has(r.relationship_id)).map(r=>[r.relationship_id,r]));
  // Commercial membership is context only, never a physical path.
  for(const r of graph.relationships) if(r.fact_status==='FACT' && commercial.has(r.relationship_type) && (ids.has(r.source_entity_id) || r.origin_entity_id && ids.has(r.origin_entity_id))) edges.set(r.relationship_id,r);
  for(const r of graph.relationships) if(r.fact_status==='FACT' && owners.has(r.relationship_type) && ids.has(r.target_entity_id)) edges.set(r.relationship_id,r);
  return {ids,edges};
}

function gapPriority(gap,shared) {
  const text = `${gap.gap_type} ${gap.field_path} ${gap.missing_evidence} ${gap.next_action}`.toLowerCase();
  const administrative = /coordinate|headquarter|geolocation/.test(text);
  const criticality = administrative?0:/smelt|refin|processor|transport|route|offtake|valid|temporal|allocation|capacity|supply/.test(text)?3:1;
  const completion = /smelt|refin|processor|customer|offtake|recipient|downstream/.test(text)?3:/time|valid|temporal|quantity|allocation|route/.test(text)?2:0;
  const sharedness = Math.min(3,Math.max(0,...(gap.entity_ids??[]).map(id=>(shared.find(s=>s.entity_id===id)?.chain_ids.length??1)-1)));
  const tractability = gap.research_status==='NOT_RESEARCHED'?2:gap.research_status==='RESEARCHED_FOUND'?3:gap.research_status==='RESEARCHED_NO_PUBLIC_EVIDENCE'?0:1;
  return {score:3*criticality+2*sharedness+2*completion+tractability,
    dimensions:{simulation_criticality:criticality,shared_dependency:sharedness,downstream_completion:completion,evidence_tractability:tractability},
    rule:'3*simulation_criticality + 2*shared_dependency + 2*downstream_completion + evidence_tractability; heuristic 0..3 dimensions, not a probability',
    interpretation:'Value-of-information research priority; unresolved evidence remains UNKNOWN'};
}

// Ephemeral read projection for topology only. The original authority and
// global source/record hash still cover the complete network report lineage.
// This avoids hashing unrelated mine histories once for every root.
function topologyProjection(graph,root) {
  const ids=new Set([root]);let changed=true;
  while(changed){changed=false;for(const r of graph.relationships)if(physical.has(r.relationship_type)&&ids.has(r.source_entity_id)&&!ids.has(r.target_entity_id)){ids.add(r.target_entity_id);changed=true;}}
  const relationships=graph.relationships.filter(r=>physical.has(r.relationship_type)&&ids.has(r.source_entity_id)&&ids.has(r.target_entity_id));
  const claimIds=new Set(relationships.flatMap(r=>r.claim_ids));
  const claims=graph.claims.filter(c=>claimIds.has(c.claim_id));
  for(const c of claims)ids.add(c.entity_id);
  const evidenceIds=new Set([...relationships.flatMap(r=>r.evidence_refs),...claims.flatMap(c=>c.evidence_refs)]);
  const evidence=graph.evidence.filter(e=>evidenceIds.has(e.evidence_id)),sourceIds=new Set(evidence.map(e=>e.source_id));
  return {meta:{...graph.meta,projection_scope:'EPHEMERAL_TOPOLOGY_READ_NOT_AUTHORITY'},entities:graph.entities.filter(e=>ids.has(e.entity_id)),relationships,claims,evidence,
    sources:graph.sources.filter(s=>sourceIds.has(s.source_id)),data_gaps:[],alternative_candidates:[],
    record_usage_guards:(graph.record_usage_guards??[]).filter(g=>claimIds.has(g.claim_id))};
}

export async function analyzeCopperNetwork(graph,{asOf='2026-10-07',roots=[]}={}) {
  if(!dateValid(asOf)) throw new Error('INVALID_AS_OF_DATE');
  const validation=validateCopperGraph(graph);
  if(!validation.valid){const error=new Error('INVALID_COPPER_GRAPH');error.validation=validation;throw error;}
  const entities=new Map(graph.entities.map(e=>[e.entity_id,e]));
  if(!roots.length) roots=graph.meta.root_entity_id?[{chain_id:graph.meta.chain_id,name:graph.meta.projection_scope,root_entity_id:graph.meta.root_entity_id}]:[];
  for(const root of roots) if(!entities.has(root.root_entity_id)) throw new Error('UNKNOWN_CHAIN_ROOT');
  const analyses = new Map();
  for(const root of roots) analyses.set(root.chain_id,await analyzeDisruption(topologyProjection(graph,root.root_entity_id),{entityId:root.root_entity_id}));
  const memberships=new Map(roots.map(root=>[root.chain_id,membership(graph,root.root_entity_id,analyses.get(root.chain_id).downstream_paths)]));
  const shared=[];
  for(const entity of graph.entities) {
    const types=new Map();
    for(const root of roots) for(const r of memberships.get(root.chain_id).edges.values()) {
      let type=null;
      if(owners.has(r.relationship_type) && r.source_entity_id===entity.entity_id) type='SHARED_OWNER';
      else if(r.target_entity_id===entity.entity_id) {
        if(r.relationship_type==='OFFTAKE_AGREEMENT') type='SHARED_OFFTAKER';
        else if(physical.has(r.relationship_type) && /SMELTER|REFINERY|PROCESSOR|CONCENTRATOR/.test(entity.entity_type)) type='SHARED_PROCESSOR';
        else if(physical.has(r.relationship_type) && /PORT/.test(entity.entity_type)) type='SHARED_PORT';
        else if(physical.has(r.relationship_type) && /TERMINAL|TRANSPORT|LOGISTICS/.test(entity.entity_type)) type='SHARED_TRANSPORT_NODE';
      }
      if(type) {if(!types.has(type)) types.set(type,{chains:new Set(),relations:new Set(),evidence:new Set()});const t=types.get(type);t.chains.add(root.chain_id);t.relations.add(r.relationship_id);for(const id of r.evidence_refs)t.evidence.add(id);}
    }
    for(const [type,records] of types) if(records.chains.size>1) shared.push({entity_id:entity.entity_id,canonical_name:entity.canonical_name,type,
      chain_ids:[...records.chains].sort(),relationship_ids:[...records.relations].sort(),evidence_refs:[...records.evidence].sort(),
      temporal_status:'SHARED_REPORTED_NETWORK_CONTEXT_NOT_CURRENT_FLOW_GUARANTEE',quantity_allocation:'UNALLOCATED_SHARED_QUANTITY',
      spare_capacity:null,physical_dependency:!['SHARED_OWNER','SHARED_OFFTAKER'].includes(type)});
  }
  const chains=[];
  for(const root of roots) {
    const analysis=analyses.get(root.chain_id);
    const paths=analysis.downstream_paths.map(p=>({...p,path_status:classifyPathTemporal(p,graph.relationships,asOf),
      evidence_refs:[...new Set(p.relationship_ids.flatMap(id=>graph.relationships.find(r=>r.relationship_id===id).evidence_refs))]}));
    const relevant=paths.filter(p=>/SMELTER|REFINERY|PORT|TERMINAL|PROCESSOR/.test(entities.get(p.entity_id)?.entity_type??''));
    const verified=relevant.filter(p=>['CURRENT_VERIFIED_PATH','HISTORICAL_VERIFIED_PATH'].includes(p.path_status) && p.entity_ids.every(id=>!['UNKNOWN',null,undefined].includes(entities.get(id)?.identity_status)));
    const identitySufficient = !['UNKNOWN',null,undefined].includes(entities.get(root.root_entity_id).identity_status);
    const readiness=identitySufficient && verified.length?'DEPENDENCY_READY':paths.length?'PARTIAL':'NOT_READY';
    const related=memberships.get(root.chain_id);
    chains.push({...root,dependency_readiness:readiness,disruption_simulation_readiness:'NOT_READY',
      readiness_scope:'Evidenced compatible physical path to a relevant processing or transport node with intersecting known dates; historical readiness does not imply current readiness',
      identity_sufficient:identitySufficient,
      known_temporal_paths:verified.length,unknown_temporal_paths:paths.filter(p=>p.path_status==='UNKNOWN_TEMPORAL_CONTINUITY').length,
      paths,contract_relationship_ids:[...related.edges.values()].filter(r=>commercial.has(r.relationship_type)).map(r=>r.relationship_id),
      gap_ids:graph.data_gaps.filter(g=>(g.entity_ids??[]).some(id=>related.ids.has(id))).map(g=>g.gap_id),
      reasons:readiness==='DEPENDENCY_READY'?['Dated qualitative dependency only; quantity, replacement and current continuity may remain unknown']:['Missing or incomplete dated physical continuity; source snapshots cannot establish a current chain'],
      quantitative_loss:null});
  }
  const alternatives=graph.alternative_candidates.map(c=>classifyAlternative(c,graph,asOf));
  const effectiveGaps = graph.data_gaps.map(g=>{ const history=(graph.research_history??[]).filter(h=>h.gap_id===g.gap_id || h.original_gap_accession_key && h.original_gap_accession_key===(g.accession_key || g.key)); const latest=history.at(-1); return latest?{...g,original_research_status:g.research_status,research_status:latest.research_status || g.research_status,research_history_ids:history.map(h=>h.research_history_id)}:g; });
  const open=effectiveGaps.filter(g=>g.status!=='RESOLVED_BY_EVIDENCE' && g.status!=='CLOSED');
  const byType={};for(const g of open)byType[g.gap_type]=(byType[g.gap_type]??0)+1;
  const coverage={};
  const fields={relationship_time:r=>r.temporal_status==='KNOWN_INTERVAL' && Boolean(r.valid_from||r.valid_to),relationship_material:r=>Boolean(r.material_basis)&&r.material_basis!=='UNKNOWN_MATERIAL_BASIS',relationship_evidence:r=>r.fact_status==='FACT' && r.evidence_refs.length>0};
  const flow=graph.relationships.filter(r=>physical.has(r.relationship_type));
  for(const [field,predicate] of Object.entries(fields))coverage[field]={known:flow.filter(predicate).length,total:flow.length,denominator:'Physical relationship records; not global field completeness'};
  const output={record_usage_guards:structuredClone(graph.record_usage_guards??[]),schema_version:'atlas.copper-network-analysis/1',as_of:asOf,authority_dataset_hash:graph.meta.authority_dataset_hash??graph.meta.dataset_hash,
    chains,shared_nodes:shared,alternatives,gap_summary:{open_total:open.length,total_by_type:byType,resolved:graph.data_gaps.length-open.length,
      researched_but_unresolved:open.filter(g=>g.research_status && !['NOT_RESEARCHED','UNKNOWN'].includes(g.research_status)).length,coverage_by_field:coverage},
    prioritized_gaps:open.map(g=>({...g,value_of_information:gapPriority(g,shared)})).sort((a,b)=>b.value_of_information.score-a.value_of_information.score||a.gap_id.localeCompare(b.gap_id)),
    counts:{entities:graph.entities.length,relationships:graph.relationships.length,claims:graph.claims.length,sources:graph.sources.length,chains_total:chains.length,
      dependency_ready:chains.filter(c=>c.dependency_readiness==='DEPENDENCY_READY').length,partial:chains.filter(c=>c.dependency_readiness==='PARTIAL').length,
      shared_processors:shared.filter(s=>s.type==='SHARED_PROCESSOR').length,shared_ports:shared.filter(s=>s.type==='SHARED_PORT').length,shared_offtakers:shared.filter(s=>s.type==='SHARED_OFFTAKER').length},
    limitations:['Network membership is not a verified physical multi-hop path','Shared totals remain UNALLOCATED_SHARED_QUANTITY','Dependency readiness is not disruption simulation readiness','Offtake and ownership are context, not physical flow','Unknown spare capacity remains unavailable for substitution calculations']};
  output.lineage={derived_record_id:'copper-network:'+await hash({input:graph.meta.dataset_hash,asOf,roots}),output:{counts:output.counts,chain_readiness:chains.map(c=>({chain_id:c.chain_id,status:c.dependency_readiness})),shared_entity_ids:shared.map(s=>s.entity_id)},transformation_id:'atlas.copper-network',transformation_version:'1',input_record_ids:[...graph.entities.map(e=>e.entity_id),...graph.relationships.map(r=>r.relationship_id),...graph.claims.map(c=>c.claim_id),...graph.data_gaps.map(g=>g.gap_id)],
    input_hash:await hash(graph),parameters:{asOf,roots},formula_or_rule:'Evidenced chain membership, product-channel reachability with intersected intervals; readiness limited to dated relevant qualitative dependency; no quantitative loss or shared allocation',output_hash:await hash(output)};
  output.lineage.execution_hash=await hash(output.lineage);
  output.public_availability_envelope=await availabilityEnvelope(graph.data_gaps,graph.meta.dataset_hash);
  return output;
}
