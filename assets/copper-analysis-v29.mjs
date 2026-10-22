import {availabilityEnvelope} from './copper-public-availability-v293.mjs';
/** Bounded, evidence-aware analysis of the additive Foundation copper graph. */
const STATUSES = new Set(['FACT', 'INFERENCE', 'ASSUMPTION', 'UNKNOWN', 'CONFLICT']);
const PHYSICAL = new Set(['PROCESSES_AT', 'TRANSPORTS_TO', 'SUPPLIES']);
const OWNERSHIP = new Set(['OWNS', 'PARTIALLY_OWNS', 'OPERATES', 'ULTIMATE_PARENT']);
const UNKNOWN_MATERIAL = new Set([null, undefined, '', 'UNKNOWN', 'UNKNOWN_MATERIAL_BASIS']);
const UNKNOWN_PERIOD = new Set([null, undefined, '', 'UNKNOWN', 'UNKNOWN_PERIOD', 'SOURCE_DATE_ONLY']);
const arrays = ['entities', 'relationships', 'claims', 'sources', 'evidence', 'data_gaps', 'alternative_candidates'];

export function canonicalStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalStringify).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

async function digest(value) {
  const bytes = new TextEncoder().encode(canonicalStringify(value));
  if (!globalThis.crypto?.subtle) throw new Error('SHA256_UNAVAILABLE: Web Crypto required for analysis lineage');
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}

function validInterval(record) {
  return validDate(record.period_start) && validDate(record.period_end) && record.period_start < record.period_end;
}

// Product channel is not a mass/unit conversion. Payable contained copper in
// concentrate is historical context for that product, not concentrate tonnage.
function productChannel(record) {
  const form = String(record.material_form ?? '').toLowerCase();
  if (UNKNOWN_MATERIAL.has(record.material_basis)) return null;
  if (record.material_basis === 'CONCENTRATE' && form === 'copper concentrate') return 'COPPER_CONCENTRATE';
  // Explicitly reported shared copper/zinc concentrate route: copper context
  // only, never total route mass or a zinc/copper quantity allocation.
  if (record.material === 'COPPER_AND_ZINC' && record.material_basis === 'CONCENTRATE' && form === 'copper_and_zinc_concentrates') return 'COPPER_CONCENTRATE';
  if (record.material_basis === 'CONTAINED_METAL' && form === 'payable copper in concentrate') return 'COPPER_CONCENTRATE';
  if (record.material_basis === 'CONTAINED_METAL' && form === 'contained copper in concentrate') return 'COPPER_CONCENTRATE';
  if (record.material_basis === 'REFINED_METAL' && form === 'copper cathode') return 'COPPER_CATHODE';
  if (record.material_basis === 'CONTAINED_METAL' && form === 'copper cathode') return 'COPPER_CATHODE';
  if (record.material_basis === 'INTERMEDIATE_PRODUCT' && form === 'anode') return 'COPPER_ANODE';
  return null;
}
function relationChannels(record,reverse=false) {
  const transition=record.channel_transition;
  if (transition) return reverse ? [transition.output,transition.input] : [transition.input,transition.output];
  const channel=productChannel(record);return [channel,channel];
}

export function validateCopperGraph(graph) {
  const errors = [], warnings = [];
  const err = (code, recordId, detail = '') => errors.push({ code, record_id: recordId ?? null, detail });
  if (!graph || typeof graph !== 'object') return { valid: false, errors: [{ code: 'GRAPH_REQUIRED' }], warnings };
  if (graph.meta?.schema_version !== 'atlas.copper-intelligence/1') err('UNSUPPORTED_GRAPH_SCHEMA', 'meta');
  for (const key of arrays) if (!Array.isArray(graph[key])) err('ARRAY_REQUIRED', key);
  if (errors.length) return { valid: false, errors, warnings };
  const indexes = {};
  for (const [key, idKey] of [['entities', 'entity_id'], ['relationships', 'relationship_id'], ['claims', 'claim_id'], ['sources', 'source_id'], ['evidence', 'evidence_id'], ['data_gaps', 'gap_id']]) {
    const index = indexes[key] = new Map();
    for (const row of graph[key]) {
      if (!row || typeof row[idKey] !== 'string' || !row[idKey]) err('ID_REQUIRED', key);
      else if (index.has(row[idKey])) err('DUPLICATE_ID', row[idKey], key);
      else index.set(row[idKey], row);
    }
  }
  function refs(row, id) {
    if (!Array.isArray(row.evidence_refs)) { err('EVIDENCE_REFS_REQUIRED', id); return; }
    for (const ref of row.evidence_refs) if (!indexes.evidence.has(ref)) err('ORPHAN_EVIDENCE', id, ref);
    if (row.fact_status === 'FACT' && row.evidence_refs.length === 0) err('UNEVIDENCED_FACT', id);
    if (!STATUSES.has(row.fact_status)) err('INVALID_FACT_STATUS', id, row.fact_status);
    if (row.fact_status === 'FACT' && ['INSUFFICIENT', 'LEGACY_EVIDENCE_INCOMPLETE', 'UNKNOWN', 'SOURCE_LOCATED_RAW_PDF_REVIEW_REQUIRED'].includes(row.evidence_status)) err('INCOMPLETE_EVIDENCE_FACT', id);
  }
  for (const row of graph.evidence) if (!indexes.sources.has(row.source_id)) err('ORPHAN_SOURCE', row.evidence_id, row.source_id);
  for (const row of graph.claims) {
    if (!indexes.entities.has(row.entity_id)) err('ORPHAN_CLAIM_ENTITY', row.claim_id, row.entity_id);
    refs(row, row.claim_id);
    if (row.fact_status === 'UNKNOWN' && row.value != null && row.value !== 'UNKNOWN') warnings.push({code:'UNKNOWN_RAW_VALUE_PRESERVED',record_id:row.claim_id});
    if (!UNKNOWN_PERIOD.has(row.period_type) && ['CALENDAR_YEAR', 'FISCAL_YEAR', 'QUARTER', 'HALF_YEAR', 'MONTH', 'CUSTOM'].includes(row.period_type) && !validInterval(row)) err('INVALID_TEMPORAL_INTERVAL', row.claim_id);
    if (typeof row.value === 'number' && !Number.isFinite(row.value)) err('NONFINITE_VALUE', row.claim_id);
    if (row.fact_status === 'FACT' && (row.value === 'UNKNOWN' || row.value === null)) err('UNKNOWN_AS_FACT', row.claim_id);
  }
  for (const row of graph.relationships) {
    const id = row.relationship_id;
    if (!indexes.entities.has(row.source_entity_id)) err('ORPHAN_RELATIONSHIP_SOURCE', id, row.source_entity_id);
    if (!indexes.entities.has(row.target_entity_id)) err('ORPHAN_RELATIONSHIP_TARGET', id, row.target_entity_id);
    refs(row, id);
    for (const bound of ['valid_from','valid_to']) if (row[bound] != null && !validDate(row[bound])) err('INVALID_RELATIONSHIP_DATE', id, bound);
    if (row.valid_from != null && row.valid_to != null && row.valid_from >= row.valid_to) err('INVALID_RELATIONSHIP_INTERVAL', id);
    if (row.temporal_status === 'SOURCE_DATE_ONLY' && (row.valid_from != null || row.valid_to != null)) err('SOURCE_SNAPSHOT_HAS_VALIDITY_BOUNDS', id);
    if (!Array.isArray(row.claim_ids) || !row.claim_ids.length) err('RELATIONSHIP_CLAIMS_REQUIRED', id);
    else for (const claimId of row.claim_ids) {
      const claim = indexes.claims.get(claimId);
      if (!claim) err('ORPHAN_RELATIONSHIP_CLAIM', id, claimId);
      else if (row.fact_status === 'FACT' && claim.fact_status !== 'FACT') err('UNSAFE_CLAIM_PROMOTION', id, claimId);
      if (claim) {
        if (row.semantic_contract === 'atlas.reported-relationship/1') {
          const fields=['source_entity_id','target_entity_id','relationship_type','material','material_basis','material_form','transport_mode','ownership_percentage','channel_transition'];
          const expected=Object.fromEntries(fields.map(f=>[f,row[f]??null]));
          if (canonicalStringify(claim.relationship_bindings?.[id]) !== canonicalStringify(expected)) err('REPORTED_RELATIONSHIP_BINDING_MISMATCH',id,claimId);
          const covered=row.claim_ids.flatMap(cid=>indexes.claims.get(cid)?.evidence_refs??[]);
          if (!row.evidence_refs.every(ref=>covered.includes(ref))) err('UNBOUND_REPORTED_RELATIONSHIP_EVIDENCE',id);
          continue;
        }
        const expected = {OPERATES:'operator',PARTIALLY_OWNS:'ownership_percentage',PROCESSES_AT:'processing_count',TRANSPORTS_TO:'transport',SUPPLIES:'supply'}[row.relationship_type];
        if (expected && claim.field !== expected) err('RELATIONSHIP_CLAIM_SEMANTICS', id, claimId);
        if (row.relationship_type === 'TRANSPORTS_TO' && (claim.entity_id !== row.source_entity_id || claim.value?.destination_entity_id !== row.target_entity_id || claim.value?.mode !== row.transport_mode || claim.material_basis !== row.material_basis || claim.material_form !== row.material_form || claim.material !== 'COPPER' || (row.material != null && row.material !== claim.material))) err('TRANSPORT_CLAIM_MISMATCH', id, claimId);
        if (row.relationship_type === 'OPERATES' && (claim.entity_id !== row.target_entity_id || claim.value !== row.source_entity_id)) err('OPERATOR_CLAIM_MISMATCH', id, claimId);
        if (row.relationship_type === 'PARTIALLY_OWNS' && (claim.entity_id !== row.target_entity_id || claim.value?.owner_entity_id !== row.source_entity_id || claim.value?.percentage !== row.ownership_percentage)) err('OWNERSHIP_CLAIM_MISMATCH', id, claimId);
        if (row.relationship_type === 'PROCESSES_AT' && (claim.entity_id !== row.target_entity_id || claim.material_basis !== row.material_basis)) err('PROCESSING_CLAIM_MISMATCH', id, claimId);
        if (row.relationship_type === 'SUPPLIES' && (claim.entity_id !== row.source_entity_id || claim.value?.supplier_entity_id !== row.source_entity_id || claim.value?.recipient_entity_id !== row.target_entity_id || claim.material !== 'COPPER' || (row.material != null && row.material !== claim.material) || claim.material_basis !== row.material_basis || claim.material_form !== row.material_form || !row.evidence_refs.every(ref => claim.evidence_refs.includes(ref)))) err('SUPPLY_CLAIM_MISMATCH', id, claimId);
      }
    }
    if (row.derived_from === 'GEOGRAPHIC_PROXIMITY' || row.basis === 'GEOGRAPHIC_PROXIMITY') err('PROXIMITY_AS_RELATIONSHIP', id);
    // V29.2 additive qualitative conversions require the same exact claim
    // binding as every reported process edge. They carry no mass conversion.
    const allowedTransitions = new Set(['COPPER_ORE:COPPER_CONCENTRATE','COPPER_ORE:COPPER_CATHODE','COPPER_CONCENTRATE:COPPER_ANODE','COPPER_ANODE:COPPER_CATHODE']);
    if (row.channel_transition && (row.semantic_contract !== 'atlas.reported-relationship/1' || row.relationship_type !== 'PROCESSES_AT' || !allowedTransitions.has(`${row.channel_transition.input}:${row.channel_transition.output}`))) err('UNSUPPORTED_PROCESS_TRANSITION',id);
  }
  for (const gap of graph.data_gaps) {
    const entityIds = gap.entity_ids ?? (gap.entity_id ? [gap.entity_id] : []);
    const claimIds = gap.claim_ids ?? (gap.claim_id ? [gap.claim_id] : []);
    for (const id of entityIds) if (!indexes.entities.has(id)) err('ORPHAN_GAP_ENTITY', gap.gap_id, id);
    for (const id of claimIds) if (!indexes.claims.has(id)) err('ORPHAN_GAP_CLAIM', gap.gap_id, id);
    if (!Array.isArray(gap.usage_restrictions) || !gap.usage_restrictions.length) err('GAP_RESTRICTIONS_REQUIRED', gap.gap_id);
  }
  for (const candidate of graph.alternative_candidates) {
    if (!indexes.entities.has(candidate.entity_id)) err('ORPHAN_ALTERNATIVE_ENTITY', candidate.entity_id);
    if (candidate.status === 'VERIFIED_ALTERNATIVE' && (!candidate.evidence_refs?.length || candidate.fact_status !== 'FACT')) err('UNVERIFIED_ALTERNATIVE', candidate.entity_id);
    for (const ref of candidate.evidence_refs ?? []) if (!indexes.evidence.has(ref)) err('ORPHAN_ALTERNATIVE_EVIDENCE', candidate.entity_id, ref);
  }
  return { valid: errors.length === 0, errors, warnings };
}

/** Scenario reachability is conditional exposure, never a forecast of tonnage lost. */
export async function analyzeDisruption(graph, { entityId, referenceYear = null, topologyMode = 'REPORTED_CONTEXT' } = {}) {
  const validation = validateCopperGraph(graph);
  if (!validation.valid) { const error = new Error('INVALID_COPPER_GRAPH'); error.validation = validation; throw error; }
  const entities = new Map(graph.entities.map(e => [e.entity_id, e]));
  if (!entities.has(entityId)) throw new Error('UNKNOWN_SCENARIO_ENTITY');
  if (referenceYear !== null && (!Number.isInteger(referenceYear) || referenceYear < 1900 || referenceYear > 9999)) throw new Error('INVALID_REFERENCE_YEAR');
  if (!['REPORTED_CONTEXT','VERIFIED_PERIOD'].includes(topologyMode)) throw new Error('INVALID_TOPOLOGY_MODE');
  if (topologyMode === 'VERIFIED_PERIOD' && referenceYear === null) throw new Error('REFERENCE_YEAR_REQUIRED');
  const annualPeriods=referenceYear===null?[]:graph.claims.filter(c=>c.field==='production' && c.reference_year===referenceYear && ['CALENDAR_YEAR','FISCAL_YEAR'].includes(c.period_type) && validInterval(c));
  const periodKeys=[...new Set(annualPeriods.map(c=>JSON.stringify([c.period_start,c.period_end])))];
  if (referenceYear!==null && periodKeys.length!==1) throw new Error('UNKNOWN_OR_AMBIGUOUS_REFERENCE_PERIOD');
  const selectedPeriod=periodKeys.length?JSON.parse(periodKeys[0]):[null,null];
  const claims = new Map(graph.claims.map(c => [c.claim_id, c]));
  const guards = new Map((graph.record_usage_guards??[]).map(g=>[g.claim_id,g]));
  const relationExclusions = [];
  const eligible = graph.relationships.filter(r => {
    if (!PHYSICAL.has(r.relationship_type) || r.fact_status !== 'FACT') return false;
    const guarded=r.claim_ids?.find(id=>guards.has(id));
    if(guarded){relationExclusions.push({record_id:r.relationship_id,reasons:['GUARDED_SOURCE_ASSERTION',...guards.get(guarded).usage_restrictions]});return false;}
    if (!relationChannels(r)[0]) {
      relationExclusions.push({ record_id:r.relationship_id, reasons:['UNKNOWN_PRODUCT_CHANNEL'] }); return false;
    }
    if (topologyMode === 'VERIFIED_PERIOD' && (r.temporal_status !== 'KNOWN_INTERVAL' || (!r.valid_from && !r.valid_to))) {
      relationExclusions.push({ record_id:r.relationship_id, reasons:['UNVERIFIED_SELECTED_PERIOD'] }); return false;
    }
    // Bounds reported by a source may exclude a route; its publication date never creates bounds.
    const [periodStart,periodEnd] = selectedPeriod;
    if (periodStart && ((r.valid_to && r.valid_to <= periodStart) || (r.valid_from && r.valid_from >= periodEnd))) {
      relationExclusions.push({ record_id: r.relationship_id, reasons: ['OUTSIDE_SELECTED_FISCAL_PERIOD'] }); return false;
    }
    return true;
  });
  const adjacency = new Map();
  const reverseAdjacency = new Map();
  for (const relation of eligible) {
    if (!adjacency.has(relation.source_entity_id)) adjacency.set(relation.source_entity_id, []);
    adjacency.get(relation.source_entity_id).push(relation);
    if (!reverseAdjacency.has(relation.target_entity_id)) reverseAdjacency.set(relation.target_entity_id, []);
    reverseAdjacency.get(relation.target_entity_id).push(relation);
  }
  const incident = eligible.filter(r => r.source_entity_id === entityId || r.target_entity_id === entityId);
  const seedChannels = [...new Set(incident.map(r=>relationChannels(r)[r.source_entity_id===entityId?0:1]))];
  const initialStart = selectedPeriod[0]??'0001-01-01';
  const initialEnd = selectedPeriod[1]??'9999-12-31';
  function walk(index, reverse = false) {
    const found = new Set([entityId]), relations = new Map(), channels = new Map(), paths = [], signatures = new Set();
    const queue = (seedChannels.length ? seedChannels : [null]).map(channel => ({id:entityId,channel,start:initialStart,end:initialEnd,unknown:false,entityIds:[entityId],relationshipIds:[]}));
    while (queue.length) {
      const state = queue.shift();
      const signature = JSON.stringify([state.id,state.channel,state.start,state.end,state.unknown]);
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      if (!channels.has(state.id)) channels.set(state.id,new Set());
      if (state.channel) channels.get(state.id).add(state.channel);
      for (const relation of index.get(state.id) ?? []) {
        const [inputChannel,channel] = relationChannels(relation,reverse), nextId = reverse ? relation.source_entity_id : relation.target_entity_id;
        if (state.channel && state.channel !== inputChannel) continue;
        if (state.entityIds.includes(nextId)) continue;
        const start = [state.start,relation.valid_from ?? '0001-01-01'].sort().at(-1);
        const end = [state.end,relation.valid_to ?? '9999-12-31'].sort()[0];
        if (start >= end) {
          relationExclusions.push({record_id:relation.relationship_id,reasons:['DISJOINT_PATH_PERIOD'],path_relationship_ids:state.relationshipIds}); continue;
        }
        const unknown = state.unknown || relation.temporal_status !== 'KNOWN_INTERVAL' || (!relation.valid_from && !relation.valid_to);
        const next = {id:nextId,channel,start,end,unknown,entityIds:[...state.entityIds,nextId],relationshipIds:[...state.relationshipIds,relation.relationship_id]};
        found.add(nextId); relations.set(relation.relationship_id,relation); queue.push(next);
        paths.push({entity_id:nextId,entity_ids:next.entityIds,relationship_ids:next.relationshipIds,product_channel:channel,
          temporal_validity:unknown?'UNKNOWN_PERIOD':'KNOWN_INTERVAL',known_interval_intersection:{start,end},
          interpretation:unknown?'CONDITIONAL_SOURCE_REPORTED_PATH':'DATED_PATH_OVERLAP_NOT_FULL_YEAR_GUARANTEE'});
      }
    }
    return {found,relations,channels,paths};
  }
  const downstream = walk(adjacency), upstream = walk(reverseAdjacency,true);
  const visited = downstream.found, affectedRelations = downstream.relations;
  const upstreamIds = upstream.found, upstreamRelations = upstream.relations;
  const relevantIds = new Set([...visited, ...upstreamIds]);
  const excluded = relationExclusions, exposure = [];
  for (const claim of graph.claims.filter(c => c.field === 'production' && relevantIds.has(c.entity_id))) {
    const reasons = guards.has(claim.claim_id)?['GUARDED_SOURCE_ASSERTION',...guards.get(claim.claim_id).usage_restrictions]:[];
    if (referenceYear !== null && claim.reference_year !== referenceYear) reasons.push('DIFFERENT_REFERENCE_YEAR');
    if (claim.fact_status !== 'FACT') reasons.push('NON_FACT_CLAIM');
    if (typeof claim.value !== 'number' || !Number.isFinite(claim.value)) reasons.push('NON_NUMERIC_VALUE');
    if (UNKNOWN_MATERIAL.has(claim.material_basis)) reasons.push('UNKNOWN_MATERIAL_BASIS');
    if (UNKNOWN_PERIOD.has(claim.period_type) || !validInterval(claim)) reasons.push('UNKNOWN_OR_INVALID_PERIOD');
    if (!claim.unit || !claim.material || !claim.measurement_basis) reasons.push('INCOMPLETE_QUANTITATIVE_BASIS');
    const allowedChannels = new Set([...(downstream.channels.get(claim.entity_id) ?? []),...(upstream.channels.get(claim.entity_id) ?? [])]);
    if (claim.entity_id !== entityId && (!productChannel(claim) || !allowedChannels.has(productChannel(claim)))) reasons.push('PRODUCT_CHANNEL_OUTSIDE_SCENARIO');
    if (reasons.length) excluded.push({ record_id: claim.claim_id, reasons });
    else exposure.push({ claim_id: claim.claim_id, entity_id: claim.entity_id, value: claim.value, unit: claim.unit,
      material: claim.material, material_basis: claim.material_basis, material_form: claim.material_form ?? null,
      measurement_basis: claim.measurement_basis, reference_year: claim.reference_year,
      period_type: claim.period_type, period_start: claim.period_start, period_end: claim.period_end,
      fact_status: 'FACT', evidence_refs: [...claim.evidence_refs], interpretation: 'HISTORICAL_PRODUCTION_NOT_PREDICTED_LOSS',
      scenario_allocation: 'UNKNOWN_NOT_ASSIGNED_TO_SELECTED_ENTITY' });
  }
  for (const relation of graph.relationships.filter(r => PHYSICAL.has(r.relationship_type) && visited.has(r.source_entity_id) && r.fact_status !== 'FACT')) excluded.push({ record_id: relation.relationship_id, reasons: ['NON_FACT_PHYSICAL_RELATIONSHIP'] });
  const affected_entities = [...visited].filter(id => id !== entityId).sort().map(id => ({ entity_id: id,
    canonical_name: entities.get(id).canonical_name, fact_status: 'INFERENCE', basis: 'EVIDENCED_PHYSICAL_REACHABILITY',
    impact: 'POTENTIAL_DISRUPTION_EXPOSURE', quantitative_loss: null }));
  const affected_relationships = [...affectedRelations.values()].sort((a,b) => a.relationship_id.localeCompare(b.relationship_id));
  const upstream_dependencies = [...upstreamIds].filter(id => id !== entityId).sort().map(id => ({entity_id:id,
    canonical_name:entities.get(id).canonical_name, fact_status:'INFERENCE',
    interpretation:'SOURCE_REPORTED_UPSTREAM_PATH_TO_SELECTED_ENTITY', quantitative_loss:null}));
  const ownership_context = graph.relationships.filter(r => OWNERSHIP.has(r.relationship_type) && (relevantIds.has(r.source_entity_id) || relevantIds.has(r.target_entity_id)));
  const data_gaps = graph.data_gaps.filter(g => (g.entity_ids ?? [g.entity_id]).some(id => relevantIds.has(id)));
  const alternatives = graph.alternative_candidates.filter(c => !c.for_entity_id || relevantIds.has(c.for_entity_id)).map(c => ({...c,
    usage_restriction: c.status === 'VERIFIED_ALTERNATIVE' ? 'FEASIBILITY_AT_SOURCED_PERIOD_ONLY' : 'NOT_A_CONFIRMED_REPLACEMENT'}));
  for (const incoming of eligible.filter(r => r.relationship_type === 'TRANSPORTS_TO' && r.target_entity_id === entityId)) {
    for (const parallel of eligible.filter(r => r.relationship_type === 'TRANSPORTS_TO' && r.source_entity_id === incoming.source_entity_id
      && r.target_entity_id !== entityId && r.material_basis === incoming.material_basis && !UNKNOWN_MATERIAL.has(r.material_basis)
      && typeof r.material_form === 'string' && r.material_form.length > 0 && r.material_form === incoming.material_form
      && r.claim_ids.every(id => claims.get(id).material === claims.get(incoming.claim_ids[0]).material))) {
      if (alternatives.some(c => c.entity_id === parallel.target_entity_id)) continue;
      alternatives.push({entity_id:parallel.target_entity_id,canonical_name:entities.get(parallel.target_entity_id).canonical_name,
        for_entity_id:entityId,status:'UNKNOWN_FEASIBILITY',fact_status:'INFERENCE',
        interpretation:'KNOWN_PARALLEL_OUTLET_NOT_VERIFIED_SUBSTITUTE',
        relationship_ids:[incoming.relationship_id,parallel.relationship_id],
        evidence_refs:[...new Set([...incoming.evidence_refs,...parallel.evidence_refs])],
        conditions:['ROUTE_ALLOCATION_UNKNOWN','SPARE_CAPACITY_UNKNOWN','CONTRACT_ACCESS_UNKNOWN','REALLOCATION_FEASIBILITY_UNKNOWN'],
        usage_restriction:'NOT_A_CONFIRMED_REPLACEMENT'});
    }
  }
  const temporalUncertainty = [...downstream.paths,...upstream.paths].some(p => p.temporal_validity === 'UNKNOWN_PERIOD');
  const limitations = [
    'Qualitative downstream reachability is conditional on the selected disruption assumption; it is not a forecast.',
    'Historical production is displayed per claim, fiscal interval and material basis; no forecast or loss calculation is derived.',
    'Unknown route allocation, spare capacity, inventory and replacement feasibility prevent quantitative disruption loss.',
    'Ownership and operation describe corporate context and never imply physical supply.',
    'The bounded researched graph does not establish global copper coverage.'
  ];
  if (temporalUncertainty) limitations.push('Source-reported physical topology has incomplete validity intervals; current or selected-year route validity is not proven.');
  if (!alternatives.length) limitations.push('No evidenced alternative with verified replacement feasibility is present in this graph.');
  const result = {
    schema_version: 'atlas.copper-analysis/1',
    scenario: { entity_id: entityId, type: 'ENTITY_UNAVAILABLE', fact_status: 'ASSUMPTION', reference_year: referenceYear,
      topology_mode:topologyMode,
      assumption: 'Selected entity becomes unavailable; duration, intensity and mitigation are unspecified.' },
    record_usage_guards:structuredClone(graph.record_usage_guards??[]),
    affected_entities, affected_relationships, upstream_dependencies,
    downstream_paths:downstream.paths, upstream_paths:upstream.paths,
    announcements:graph.claims.filter(c=>c.field==='announced_processing_demonstration'&&relevantIds.has(c.entity_id)),
    upstream_relationships:[...upstreamRelations.values()].sort((a,b) => a.relationship_id.localeCompare(b.relationship_id)),
    historical_exposure: exposure.sort((a,b) => a.claim_id.localeCompare(b.claim_id)),
    quantitative_loss: null, ownership_context, alternatives, excluded_records: excluded, data_gaps,
    conflicts:graph.claims.filter(c=>c.fact_status==='CONFLICT'&&relevantIds.has(c.entity_id)), limitations,
    confidence: { status: 'PARTIAL', fact_status: 'INFERENCE', method: 'EVIDENCED_TOPOLOGY_ONLY',
      temporal_validity: temporalUncertainty ? 'UNKNOWN_PERIOD' : [...downstream.paths,...upstream.paths].length ? 'CHECK_SOURCE_INTERVALS' : 'NO_ELIGIBLE_PHYSICAL_PATHS', quantitative_impact: 'NOT_ESTIMABLE',
      reason: 'Missing temporal validity, allocations and substitution evidence bound the analysis.' },
    open_p0: graph.meta?.open_p0 ?? []
  };
  const input_record_ids = [...new Set([...graph.entities.map(r=>r.entity_id),...graph.relationships.map(r=>r.relationship_id),
    ...graph.claims.map(r=>r.claim_id),...graph.sources.map(r=>r.source_id),...graph.evidence.map(r=>r.evidence_id),
    ...graph.data_gaps.map(r=>r.gap_id)])].sort();
  // Full graph hash covers exclusions, conflicts and all source/evidence records too.
  const input_hash = await digest(graph), output_hash = await digest(result);
  const lineage = { derived_record_id: 'copper-disruption:' + await digest({ input_hash, entityId, referenceYear, topologyMode }),
    input_record_ids, transformation_id: 'copper-physical-reachability', transformation_version: '1.1.0',
    formula_or_rule: 'Product-channel and path-interval reachability over evidenced FACT PROCESSES_AT, TRANSPORTS_TO and SUPPLIES; no product conversion, no announcement as completed supply, historical context only, no loss estimation.',
    parameters: { entity_id: entityId, reference_year: referenceYear, topology_mode:topologyMode, traversable_relationship_types: [...PHYSICAL] },
    output:{affected_entity_ids:affected_entities.map(e=>e.entity_id),upstream_entity_ids:upstream_dependencies.map(e=>e.entity_id),
      historical_claim_ids:exposure.map(c=>c.claim_id),quantitative_loss:null},
    input_hash, output_hash, dataset_version: graph.meta?.dataset_version ?? null };
  lineage.execution_hash = await digest(lineage);
  // Analysis exports must not give Visualization mutable references into Knowledge.
  return structuredClone({ ...result, lineage, public_availability_envelope:await availabilityEnvelope(data_gaps,graph.meta.authority_dataset_hash??graph.meta.dataset_hash) });
}
