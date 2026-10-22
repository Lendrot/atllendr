import {scopeAvailability,gapIds as availabilityGapIds} from './copper-public-availability-v293.mjs';
import {hydrateAvailability,availabilityDetail} from './copper-public-availability-ui-v293.mjs';
// Loaded only after the user opens Dependency mode. This module reads pinned analysis projections.
export function createDependencyUI({ $, array, printable, label, el, chip, paragraph, safeUrl, gapEntityIds, catalog }) {
// Visualization-only dependency reader. Knowledge and derived results are immutable inputs.
let globalAvailability=null;
let dependencyCatalog = null, dependencyQuery = null, dependencyRequest = 0;
let dependencyEntry = null, dependencySummaryRequest = 0;
const dependencyNodeId = node => node.entity_id || node.node_id;
const dependencyEdgeId = edge => edge.relationship_id || edge.edge_id;
const dependencyIds = path => array(path.entity_ids || path.ENTITY_IDS);
const dependencyRelationships = path => array(path.relationship_ids || path.RELATIONSHIP_IDS);
const dependencyPathId = path => path.path_id || path.PATH_ID;
const dependencyPathStatus = path => path.path_status || path.PATH_STATUS || 'UNKNOWN_CONTINUITY';
function dependencyTemporal(path) {
  const status = path.temporal_status || path.temporal_context?.status || path.temporal_overlap?.status || path.TEMPORAL_OVERLAP?.status;
  if (status === 'CURRENT_VERIFIED_PATH' && dependencyPathStatus(path) === 'VERIFIED_PATH') return 'CURRENT';
  if (dependencyPathStatus(path) === 'HISTORICAL_PATH') return 'HISTORICAL';
  if (status === 'UNKNOWN_PERIOD') return 'UNKNOWN';
  if (status === 'CURRENT_VERIFIED_PATH') return 'CURRENT_PARTIAL';
  if (status === 'HISTORICAL_VERIFIED_PATH') return 'HISTORICAL_PARTIAL';
  if (status === 'FUTURE_PATH') return 'FUTURE';
  if (['DISJOINT_INTERVALS', 'INVALID_INTERVAL'].includes(status) || dependencyPathStatus(path) === 'INVALID_PATH') return 'INVALID';
  return 'UNKNOWN';
}
function dependencyName(id) { return dependencyCatalog?.entities.find(n => n.entity_id === id)?.canonical_name || id || 'UNKNOWN'; }
function dependencyVisiblePaths() {
  const temporal = $('dependency-temporal').value;
  return array(dependencyQuery?.paths).filter(path => temporal === 'ALL' || dependencyTemporal(path) === temporal);
}
function dependencySharedInScope(node, scope) {
  return scope.nodeIds.has(node.entity_id) || dependencyQuery.context_edges.some(edge => (edge.source_entity_id === node.entity_id && scope.nodeIds.has(edge.target_entity_id)) || (edge.target_entity_id === node.entity_id && scope.nodeIds.has(edge.source_entity_id)));
}
function dependencyAlternativesInScope(scope) {
  return array(dependencyQuery.alternatives).filter(record => [record.for_entity_id, record.source_entity_id, record.origin_entity_id].filter(Boolean).some(id => scope.nodeIds.has(id)));
}
function dependencyReadinessInScope(scope) {
  const readiness = dependencyQuery.readiness;
  if (Array.isArray(readiness)) return readiness.filter(record => scope.nodeIds.has(record.entity_id || record.root_entity_id));
  return { ...readiness, nodes: array(readiness.nodes).filter(record => scope.nodeIds.has(record.entity_id)), chains: array(readiness.chains).filter(record => scope.nodeIds.has(record.root_entity_id)) };
}
function dependencyScope(paths) {
  const physicalPaths = paths.filter(path => dependencyPathStatus(path) !== 'INVALID_PATH');
  const diagnosticPaths = paths.filter(path => dependencyPathStatus(path) === 'INVALID_PATH');
  const nodeIds = new Set([dependencyQuery.query.entity_id, ...physicalPaths.flatMap(dependencyIds)]);
  const relationshipIds = new Set(physicalPaths.flatMap(dependencyRelationships));
  const diagnosticNodeIds = new Set(diagnosticPaths.flatMap(dependencyIds).filter(id => !nodeIds.has(id)));
  const diagnosticRelationshipIds = new Set(diagnosticPaths.flatMap(dependencyRelationships).filter(id => !relationshipIds.has(id)));
  return { nodeIds, relationshipIds, nodes: array(dependencyQuery.nodes).filter(n => nodeIds.has(dependencyNodeId(n))), edges: array(dependencyQuery.edges).filter(e => relationshipIds.has(dependencyEdgeId(e))), diagnostics: { paths: diagnosticPaths, nodes: array(dependencyQuery.nodes).filter(n => diagnosticNodeIds.has(dependencyNodeId(n))), edges: array(dependencyQuery.edges).filter(e => diagnosticRelationshipIds.has(dependencyEdgeId(e))) } };
}
async function dependencyDigest(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, '0')).join(''); }
async function dependencyFetch(entry, schema) {
  if (!entry || !/^\/foundation\/v29\/[a-z0-9/_-]+\.json$/.test(entry.url) || !Number.isInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > 250000 || !/^[a-f0-9]{64}$/.test(entry.projection_sha256)) throw new Error('Ungültiger Dependency-Projektionsverweis');
  const response = await fetch(entry.url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Dependency HTTP ${response.status}`);
  const text = await response.text();
  if (new TextEncoder().encode(text).length !== entry.bytes || await dependencyDigest(text) !== entry.projection_sha256) throw new Error('Dependency-Hash oder Größe stimmt nicht');
  const data = JSON.parse(text);
  if (data.schema_version !== schema || data.authority_dataset_hash !== catalog.authority_dataset_hash) throw new Error('Dependency-Schema oder Knowledge-Version stimmt nicht');
  if(data.public_availability_ref||availabilityGapIds(data).length)await hydrateAvailability(data,catalog.authority_dataset_hash);
  return data;
}
function dependencyInvalidate(message = 'Auswahl geändert. Lade den gewünschten Ausschnitt.') {
  dependencyRequest++; dependencyQuery = null; dependencyEntry = null;
  $('dependency-export').disabled = true; $('dependency-results').hidden = true;
  $('dependency-error').hidden = true; $('dependency-status').textContent = message;
  $('dependency-run').disabled = !dependencyCatalog;
}
function dependencyFailure(error) {
  dependencyQuery = null; dependencyEntry = null; $('dependency-export').disabled = true; $('dependency-results').hidden = true;
  $('dependency-error').textContent = `Dependency-Analyse angehalten: ${error.message || printable(error)}. UNKNOWN und CONFLICT werden nicht durch Ersatzwerte ergänzt.`;
  $('dependency-error').hidden = false;
}
async function loadDependencyCatalog() {
  const request = ++dependencyRequest;
  $('dependency-load').disabled = true; $('dependency-error').hidden = true;
  $('dependency-status').textContent = 'Dependency-Katalog wird geprüft …';
  try {
    const data = await dependencyFetch(catalog.dependency_catalog, 'atlas.copper-dependency-catalog/1');
    if (!Array.isArray(data.entities) || !data.entities.length || new Set(data.entities.map(n => n.entity_id)).size !== data.entities.length) throw new Error('Ungültige Dependency-Entity-Auswahl');
    for (const node of data.entities) {
      if (!node.entity_id || !node.queries || ['DOWNSTREAM', 'UPSTREAM'].some(direction => [1, 2, 3].some(hops => !node.queries[`${direction}:${hops}`]))) throw new Error('Dependency-Abfragen fehlen im Katalog');
    }
    if (request !== dependencyRequest) return;
    dependencyCatalog = data; $('dependency-entity').replaceChildren();
    for (const node of data.entities) { const option = el('option', `${node.canonical_name} · ${label(node.entity_type)}`); option.value = node.entity_id; $('dependency-entity').append(option); }
    const selected = $('entity-select').value;
    if (data.entities.some(n => n.entity_id === selected)) $('dependency-entity').value = selected;
    $('dependency-global-priorities').hidden = !data.summary;
    $('dependency-entity').disabled = false; $('dependency-run').disabled = false; $('dependency-form').hidden = false;
    $('dependency-status').textContent = `${data.entities.length} Entities auswählbar · Stand ${data.as_of}. Der erste Ausschnitt wird auf Anfrage geladen.`;
    $('dependency-load').textContent = 'Dependency-Modus geöffnet';
  } catch (error) { if (request === dependencyRequest) { dependencyCatalog = null; dependencyFailure(error); $('dependency-load').disabled = false; } }
}
function validateDependencyLineage(record) {
  const lineage = record?.lineage;
  const reference = lineage?.output_reference;
  const hasOutput = Boolean(lineage?.output) || Boolean(reference?.artifact && /^[a-f0-9]{64}$/.test(reference.artifact_sha256 || '') && typeof reference.json_pointer === 'string' && reference.json_pointer.startsWith('/') && /^[a-f0-9]{64}$/.test(reference.output_hash || ''));
  if (!lineage?.derived_record_id || !Array.isArray(lineage.input_record_ids) || !lineage.transformation_id || !lineage.transformation_version || !lineage.formula_or_rule || !lineage.parameters || !hasOutput || !/^[a-f0-9]{64}$/.test(lineage.execution_hash || '')) throw new Error('Dependency-Ableitung hat keine vollständige Input-Lineage');
}
function validateDependencyQuery(data, query) {
  if (data.query?.entity_id !== query.entity_id || data.query.direction !== query.direction || data.query.hops !== query.hops) throw new Error('Dependency-Ausschnitt passt nicht zur Auswahl');
  for (const field of ['nodes', 'edges', 'paths', 'context_edges', 'shared_nodes', 'prioritized_gaps']) if (!Array.isArray(data[field])) throw new Error(`Dependency-Feld ${field} fehlt`);
  if (!data.lineage || !data.readiness) throw new Error('Dependency-Lineage oder Readiness fehlt');
  validateDependencyLineage(data);
  for (const lineage of Object.values(data.selected_metrics?.metric_lineage || {})) validateDependencyLineage({ lineage });
  for (const record of [...data.paths, ...data.shared_nodes, ...data.prioritized_gaps, ...array(data.readiness.nodes), ...array(data.readiness.chains)]) validateDependencyLineage(record);
  const nodes = new Set(data.nodes.map(dependencyNodeId));
  if (!nodes.has(query.entity_id) || nodes.size !== data.nodes.length) throw new Error('Dependency-Entity-Integrität verletzt');
  const edges = new Map(data.edges.map(edge => [dependencyEdgeId(edge), edge]));
  if (edges.size !== data.edges.length) throw new Error('Doppelte Dependency-Beziehung');
  for (const edge of data.edges) if (!nodes.has(edge.source_entity_id) || !nodes.has(edge.target_entity_id) || edge.fact_status !== 'FACT' || !array(edge.claim_ids).length || !array(edge.evidence_refs).length || !['PROCESSES_AT', 'TRANSPORTS_TO', 'SUPPLIES', 'EXPORTS_TO', 'IMPORTS_FROM', 'RECYCLES_AT'].includes(edge.relationship_type)) throw new Error('Ungültige physische Dependency-Kante');
  const pathIds = new Set();
  for (const path of data.paths) {
    const ids = dependencyIds(path), rels = dependencyRelationships(path), id = dependencyPathId(path);
    if (!id || pathIds.has(id) || rels.length > query.hops || ids.length !== rels.length + 1 || ids.some(node => !nodes.has(node)) || rels.some(rel => !edges.has(rel))) throw new Error('Dependency-Pfad ist nicht vollständig rückführbar');
    if (query.direction === 'DOWNSTREAM' ? ids[0] !== query.entity_id : ids.at(-1) !== query.entity_id) throw new Error('Dependency-Pfad hat eine falsche Richtung');
    for (let index = 0; index < rels.length; index++) { const edge = edges.get(rels[index]); if (edge.source_entity_id !== ids[index] || edge.target_entity_id !== ids[index + 1]) throw new Error('Dependency-Pfad verbindet falsche Endpunkte'); }
    if (!['VERIFIED_PATH', 'PARTIAL_PATH', 'HISTORICAL_PATH', 'UNKNOWN_CONTINUITY', 'INVALID_PATH'].includes(dependencyPathStatus(path))) throw new Error('Unbekannter Dependency-Pfadstatus');
    pathIds.add(id);
  }
}
async function loadDependencyQuery(event) {
  event?.preventDefault();
  if (!dependencyCatalog) return;
  const request = ++dependencyRequest;
  const query = { entity_id: $('dependency-entity').value, direction: $('dependency-direction').value, hops: Number($('dependency-hops').value) };
  dependencyQuery = null; dependencyEntry = null; $('dependency-export').disabled = true; $('dependency-results').hidden = true; $('dependency-error').hidden = true; $('dependency-run').disabled = true;
  $('dependency-status').textContent = `${dependencyName(query.entity_id)} · ${query.hops} Hops werden geprüft …`;
  try {
    const entry = dependencyCatalog.entities.find(n => n.entity_id === query.entity_id)?.queries[`${query.direction}:${query.hops}`];
    const data = await dependencyFetch(entry, 'atlas.copper-dependency-query/1');
    validateDependencyQuery(data, query);
    if (request !== dependencyRequest) return;
    if (data.provenance_ref) {
      const provenance = await dependencyFetch(data.provenance_ref, 'atlas.copper-dependency-provenance/1');
      if (request !== dependencyRequest) return;
      if (provenance.query?.entity_id !== query.entity_id || provenance.query.direction !== query.direction || provenance.query.hops !== query.hops) throw new Error('Dependency-Evidence passt nicht zur Auswahl');
      for (const field of ['entities', 'relationships', 'claims', 'evidence', 'sources', 'data_gaps', 'record_usage_guards']) if (!Array.isArray(provenance.provenance?.[field])) throw new Error(`Dependency-Evidence ${field} fehlt`);
      data.provenance = provenance.provenance;
    }
    if (!data.provenance) throw new Error('Dependency-Evidence im ausgewählten Scope fehlt');
    await hydrateAvailability(data,catalog.authority_dataset_hash);
    if (request !== dependencyRequest) return;
    dependencyQuery = data; dependencyEntry = entry; renderDependencyQuery();
  } catch (error) { if (request === dependencyRequest) dependencyFailure(error); }
  finally { if (request === dependencyRequest) $('dependency-run').disabled = false; }
}
function dependencyRecordRefs(record, target, availability=dependencyQuery?.public_availability_envelope) {
  const details = el('details'); details.append(el('summary', 'Input-Lineage & Constraints'));
  details.append(el('pre', JSON.stringify({ entity_ids: dependencyIds(record), relationship_ids: dependencyRelationships(record), claim_ids: record.claim_ids || record.lineage?.input_claim_ids, evidence_refs: record.evidence_refs || record.evidence_ids, temporal_constraints: record.temporal_overlap || record.TEMPORAL_OVERLAP, material_constraints: record.material_constraints || record.material || record.MATERIAL, research_history_ids: record.research_history_ids, sources_checked: record.sources_checked, retry_policy: record.retry_policy, lineage: record.lineage }, null, 2)));
  if(record.gap_id)details.append(availabilityDetail(record,availability??globalAvailability));
  target.append(details);
}
function renderDependencyGraph(scope, paths) {
  const target = $('dependency-graph'); target.replaceChildren(); $('dependency-node-actions').replaceChildren();
  const nodes = scope.nodes.slice(0, 32), allowed = new Set(nodes.map(dependencyNodeId));
  const edges = scope.edges.filter(edge => allowed.has(edge.source_entity_id) && allowed.has(edge.target_entity_id)).slice(0, 64);
  const verifiedEdges = new Set(paths.filter(path => ['VERIFIED_PATH', 'HISTORICAL_PATH'].includes(dependencyPathStatus(path))).flatMap(dependencyRelationships));
  target.append(paragraph('Pfeile folgen der belegten Beziehungsrichtung. Durchgezogen: verifizierte Kontinuität; gestrichelt: Zeit- oder Materialkontinuität teilweise UNKNOWN. Historische Verbindungen sind keine aktuelle Versorgung.', 'small'));
  if (scope.nodes.length > nodes.length || scope.edges.length > edges.length) target.append(paragraph(`Diagramm begrenzt auf ${nodes.length} Knoten / ${edges.length} Kanten. Sämtliche gefilterten Pfade stehen in der Liste und im Export.`, 'small'));
  const root = dependencyQuery.query.entity_id, depth = new Map([[root, 0]]);
  for (const path of paths) { const ids = dependencyIds(path); ids.forEach((id, index) => { const distance = dependencyQuery.query.direction === 'DOWNSTREAM' ? index : ids.length - 1 - index; depth.set(id, Math.min(depth.get(id) ?? Infinity, distance)); }); }
  const columns = [0, 1, 2, 3].map(level => nodes.filter(node => (depth.get(dependencyNodeId(node)) ?? 0) === level));
  const height = Math.max(150, ...columns.map(col => col.length * 90 + 40));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', `0 0 1000 ${height}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${dependencyName(root)}: ${nodes.length} Knoten und ${edges.length} physische Beziehungen. Bediene die Knoten mit den Schaltflächen unter dem Diagramm.`);
  const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = 'Begrenzter Dependency-Ausschnitt'; svg.append(title);
  const defs = document.createElementNS(svg.namespaceURI, 'defs'), marker = document.createElementNS(svg.namespaceURI, 'marker'), arrow = document.createElementNS(svg.namespaceURI, 'path'); marker.setAttribute('id', 'dependency-arrow'); marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '6'); marker.setAttribute('markerHeight', '6'); marker.setAttribute('orient', 'auto'); arrow.setAttribute('d', 'M0,0 L10,5 L0,10 Z'); arrow.setAttribute('fill', '#658894'); marker.append(arrow); defs.append(marker); svg.append(defs);
  const positions = new Map();
  columns.forEach((column, level) => column.forEach((node, row) => { const x = dependencyQuery.query.direction === 'DOWNSTREAM' ? 20 + level * 250 : 770 - level * 250; positions.set(dependencyNodeId(node), { x, y: 25 + row * 90 }); }));
  for (const edge of edges) { const from = positions.get(edge.source_entity_id), to = positions.get(edge.target_entity_id); if (!from || !to) continue; const line = document.createElementNS(svg.namespaceURI, 'path'); line.setAttribute('d', `M${from.x + 210},${from.y + 33} L${to.x},${to.y + 33}`); line.setAttribute('class', verifiedEdges.has(dependencyEdgeId(edge)) ? 'dependency-edge' : 'dependency-edge conditional'); line.setAttribute('marker-end', 'url(#dependency-arrow)'); svg.append(line); }
  for (const node of nodes) { const id = dependencyNodeId(node), position = positions.get(id); if (!position) continue; const group = document.createElementNS(svg.namespaceURI, 'g'); group.setAttribute('transform', `translate(${position.x},${position.y})`); const rect = document.createElementNS(svg.namespaceURI, 'rect'); rect.setAttribute('width', '210'); rect.setAttribute('height', '65'); rect.setAttribute('rx', '8'); rect.setAttribute('class', id === root ? 'dependency-node selected' : 'dependency-node'); group.append(rect); const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = `${dependencyName(id)} · ${node.entity_type} · ${id}`; group.append(title); for (const [text, y] of [[dependencyName(id).slice(0, 27), 26], [label(node.entity_type).slice(0, 29), 46]]) { const caption = document.createElementNS(svg.namespaceURI, 'text'); caption.setAttribute('x', '10'); caption.setAttribute('y', String(y)); caption.textContent = text; group.append(caption); } svg.append(group); const button = el('button', `${dependencyName(id)} · erkunden`, 'secondary'); button.type = 'button'; button.dataset.dependencyEntityId = id; button.addEventListener('click', () => { $('dependency-entity').value = id; dependencyInvalidate(); loadDependencyQuery(); }); $('dependency-node-actions').append(button); }
  target.append(svg);
}
function renderDependencyReadiness(scope) {
  const target = $('dependency-readiness'); target.replaceChildren(); target.append(paragraph('Readiness bewertet den geladenen Entity-Scope. Der Zeitfilter blendet Pfade aus; registrierte Lücken bleiben für die Bewertung maßgeblich.', 'small'));
  const readiness = dependencyQuery.readiness;
  const records = Array.isArray(readiness) ? readiness : [...array(readiness.nodes || readiness.node_readiness), ...array(readiness.chains || readiness.chain_readiness)];
  if (!records.length && readiness.dimensions) records.push(readiness);
  const selected = records.filter(record => record.entity_id === dependencyQuery.query.entity_id || record.root_entity_id === dependencyQuery.query.entity_id);
  for (const record of selected.length ? selected : records.filter(record => scope.nodeIds.has(record.entity_id)).slice(0, 4)) {
    const card = el('article', undefined, 'result-card'); card.append(el('strong', record.chain_name || record.canonical_name || dependencyName(record.entity_id || record.root_entity_id)), chip(record.status || record.readiness_status || record.dependency_readiness));
    const dimensions = record.dimensions || {};
    for (const dimension of ['IDENTITY', 'RELATIONSHIPS', 'TIME', 'MATERIAL', 'QUANTITY', 'CAPACITY', 'ALTERNATIVES', 'EVIDENCE']) { const value = dimensions[dimension] || dimensions[dimension.toLowerCase()] || { status: 'UNKNOWN', reasons: ['Bewertung fehlt'] }; const line = paragraph(`${dimension}: ${value.status || printable(value)} · ${array(value.reasons || value.blockers).map(printable).join(' · ') || printable(value.reason || 'Details in Lineage')}`, 'small'); line.dataset.readinessDimension = dimension; card.append(line); }
    if (array(record.blockers || record.reasons).length) card.append(paragraph(`Blocker: ${array(record.blockers || record.reasons).map(printable).join(' · ')}`, 'small'));
    dependencyRecordRefs(record, card); target.append(card);
  }
  if (target.children.length === 1) target.append(paragraph('Readiness UNKNOWN: keine passende Bewertung im Ausschnitt.', 'empty'));
  for (const alternative of dependencyAlternativesInScope(scope)) { const card = el('article', undefined, 'result-card'); card.append(el('strong', `Alternative: ${dependencyName(alternative.entity_id || alternative.candidate_entity_id)}`), chip(alternative.feasibility_status || alternative.alternative_status || 'UNKNOWN_FEASIBILITY'), paragraph('Verfügbare Ersatzmenge: UNKNOWN. Eine theoretische Alternative ist keine gesicherte Ersatzversorgung.', 'small'), paragraph(printable(alternative.dimensions), 'small'), paragraph(printable(alternative.usage_restrictions), 'small')); dependencyRecordRefs(alternative, card); target.append(card); }
}
function renderDependencyQuery() {
  if (!dependencyQuery) return;
  const paths = dependencyVisiblePaths(), scope = dependencyScope(paths);
  for (const id of ['dependency-overview', 'dependency-paths', 'dependency-shared', 'dependency-gaps', 'dependency-context', 'dependency-evidence']) $(id).replaceChildren();
  $('dependency-results').hidden = false;
  $('dependency-status').textContent = `${dependencyName(dependencyQuery.query.entity_id)} · ${dependencyQuery.query.direction} · ${dependencyQuery.query.hops} Hops · ${paths.length}/${dependencyQuery.paths.length} Pfade im Zeitfilter · Stand ${dependencyQuery.as_of}`;
  $('dependency-overview').append(paragraph('Physische Beziehungen sind quellenbelegt. Ihre Verkettung ist eine abgeleitete Analyse; UNKNOWN_PERIOD bestätigt keine aktuelle Versorgung. Ein gemeinsamer Knoten belegt weder freien Durchsatz noch wirtschaftliche Kritikalität.', 'scope-note'));
  if (dependencyQuery.selected_metrics) {
    const metric = dependencyQuery.selected_metrics, card = el('details'); card.append(el('summary', 'Strukturmetriken des ausgewählten Knotens'));
    for (const field of ['degree', 'in_degree', 'out_degree', 'number_of_verified_paths', 'number_of_dependent_mines', 'number_of_shared_chains', 'known_dependency_concentration']) { card.append(paragraph(`${field}: ${printable(metric[field])}`, 'small')); const reference = el('details'); reference.append(el('summary', `${field} · Input-Lineage`), el('pre', JSON.stringify(metric.metric_lineage?.[field], null, 2))); card.append(reference); }
    card.append(paragraph('Diese reproduzierbaren Graphmetriken beziehen sich auf recherchierte Ketten und maximal 3 Hops. Sie belegen keine wirtschaftliche, globale oder mengenbezogene Kritikalität.', 'small')); $('dependency-overview').append(card);
  }
  renderDependencyGraph(scope, paths.filter(path => dependencyPathStatus(path) !== 'INVALID_PATH')); renderDependencyReadiness(scope);
  for (const path of paths) {
    const item = el('article', undefined, 'result-card'); item.dataset.dependencyPathId = dependencyPathId(path); item.dataset.temporalStatus = dependencyTemporal(path);
    item.append(chip(dependencyPathStatus(path)), chip(path.temporal_status || dependencyTemporal(path)), el('strong', dependencyIds(path).map(dependencyName).join(' → ')), paragraph(`Material: ${printable(path.material || path.MATERIAL || path.product_channel)} · Zeitüberlappung: ${printable(path.temporal_overlap || path.TEMPORAL_OVERLAP)} · Evidence-Abdeckung: ${printable(path.evidence_coverage || path.EVIDENCE_COVERAGE)}`, 'small'));
    item.append(paragraph(`UNKNOWN: ${printable(path.unknown_components || path.UNKNOWN_COMPONENTS || [])} · CONFLICT: ${printable(path.conflict_components || path.CONFLICT_COMPONENTS || [])}`, 'small'));
    if (array(path.reasons).length) item.append(paragraph(`Grund: ${path.reasons.join(' · ')}`, 'small'));
    const edges = el('details'); edges.append(el('summary', `${dependencyRelationships(path).length} Beziehungen mit Evidence`));
    for (const id of dependencyRelationships(path)) { const edge = dependencyQuery.edges.find(record => dependencyEdgeId(record) === id); if (!edge) continue; edges.append(paragraph(`${id} · ${label(edge.relationship_type)} · ${dependencyName(edge.source_entity_id)} → ${dependencyName(edge.target_entity_id)} · ${edge.material_form || edge.material || 'Material UNKNOWN'} · [${edge.valid_from || 'UNKNOWN'}, ${edge.valid_to || 'UNKNOWN'}) · Evidence: ${printable(edge.evidence_refs)} · Claims: ${printable(edge.claim_ids)} · ${printable(edge.usage_restrictions)}`, 'small')); }
    item.append(edges, el('code', dependencyPathId(path))); dependencyRecordRefs(path, item); $('dependency-paths').append(item);
  }
  if (!paths.length) $('dependency-paths').append(paragraph('Keine belegten Pfade für diese Auswahl. Fehlende Pfade bestätigen keine Unabhängigkeit.', 'empty'));
  for (const node of dependencyQuery.shared_nodes.filter(node => dependencySharedInScope(node, scope))) {
    const card = el('article', undefined, 'result-card'); card.append(chip(node.node_type || node.type || node.entity_type), el('strong', node.canonical_name || dependencyName(node.entity_id)), paragraph(`DIRECT_CHAIN_COUNT: ${printable(node.direct_chain_count ?? node.DIRECT_CHAIN_COUNT)} · VERIFIED_PATH_COUNT: ${printable(node.verified_path_count ?? node.VERIFIED_PATH_COUNT)}`, 'small'), paragraph(`Commodity: ${printable(node.commodity_context || node.COMMODITY_CONTEXT)} · Zeit: ${printable(node.temporal_context || node.TEMPORAL_CONTEXT)}`, 'small'));
    if (node.physical_dependency === false || node.layer === 'OWNERSHIP_CONTEXT' || /OWNER/.test(node.type || node.node_type || '')) card.append(paragraph('Gemeinsamer Eigentümerkontext; keine physische Materialabhängigkeit.', 'small'));
    dependencyRecordRefs(node, card); $('dependency-shared').append(card);
  }
  if (!$('dependency-shared').children.length) $('dependency-shared').append(paragraph('Keine gemeinsam genutzten Knoten im gefilterten physischen Ausschnitt belegt.', 'empty'));
  for (const gap of dependencyQuery.prioritized_gaps.filter(gap => !gap.entity_ids?.length || gap.entity_ids.some(id => scope.nodeIds.has(id))).slice(0, 10)) {
    const card = el('article', undefined, 'gap'); card.append(chip('UNKNOWN'), el('strong', gap.gap_type || gap.field_path || gap.gap_id), paragraph(`Priorität: ${printable(gap.priority_score ?? gap.value_of_information?.score)} · ${printable(gap.reason || gap.value_of_information?.reason)}`, 'small'), paragraph(`Simulation: ${printable(gap.simulation_impact)} · Dependency: ${printable(gap.dependency_impact)} · Unsicherheitsreduktion: ${printable(gap.uncertainty_reduction)} · Quellenzugang: ${printable(gap.source_availability)} · Aufwand: ${printable(gap.research_cost)}`, 'small'), paragraph(`Recherche: ${printable(gap.research_status)} · Retry: ${printable(gap.retry_policy)} · ${printable(gap.next_action || gap.missing_evidence)}`, 'small'), el('code', gap.gap_id)); dependencyRecordRefs(gap, card); $('dependency-gaps').append(card);
  }
  if (!$('dependency-gaps').children.length) $('dependency-gaps').append(paragraph('Keine registrierte Lücke in diesem Filter; Vollständigkeit bleibt UNKNOWN.', 'empty'));
  for (const edge of dependencyQuery.context_edges.filter(edge => scope.nodeIds.has(edge.source_entity_id) || scope.nodeIds.has(edge.target_entity_id))) { const card = el('article', undefined, 'relationship'); card.append(chip(edge.fact_status || 'UNKNOWN'), el('strong', label(edge.relationship_type)), paragraph(`${dependencyName(edge.source_entity_id)} → ${dependencyName(edge.target_entity_id)}`), paragraph('Semantisch getrennter Kontext. Diese Kante verbindet keine Materialpfade.', 'small')); dependencyRecordRefs(edge, card); $('dependency-context').append(card); }
  const provenance = dependencyQuery.provenance || dependencyQuery;
  for (const source of array(provenance.sources)) { const block = el('article', undefined, 'source'), url = safeUrl(source.source_url || source.url); block.append(el('strong', source.source_name || source.title || source.source_id), el('code', source.source_id)); if (url) { const link = el('a', url); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; block.append(link); } block.append(paragraph(`Artefakt: ${source.artifact_type || 'UNKNOWN'} · SHA-256: ${printable(source.raw_artifact_sha256)} · veröffentlicht ${printable(source.source_published_at || source.source_date)}`, 'small')); $('dependency-evidence').append(block); }
  for (const guard of array(provenance.record_usage_guards || dependencyQuery.record_usage_guards)) $('dependency-evidence').append(paragraph(`Nutzung gesperrt: ${guard.claim_id} · ${guard.reason} · ${printable(guard.usage_restrictions)} · Evidence: ${printable(guard.evidence_refs)}`, 'error'));
  for (const record of [...array(provenance.claims), ...array(provenance.evidence)]) { const item = el('details'); item.append(el('summary', `${record.claim_id || record.evidence_id} · ${record.fact_status || record.verification_status || 'UNKNOWN'} · ${printable(record.field || record.evidence_type)}`), paragraph(`${printable(record.value ?? record.source_id)} · Zeit: ${record.period_type || 'UNKNOWN_PERIOD'} · [${printable(record.period_start)}, ${printable(record.period_end)}) · Materialbasis: ${printable(record.material_basis)} · Evidence: ${printable(record.evidence_refs)} · Locator: ${printable(record.source_locator)} · Restriktionen: ${printable(record.usage_restrictions)}`, 'small')); $('dependency-evidence').append(item); }
  $('dependency-lineage').textContent = JSON.stringify({ filter: { temporal: $('dependency-temporal').value }, query: dependencyQuery.query, coverage: dependencyQuery.coverage, lineage: dependencyQuery.lineage }, null, 2);
  $('dependency-export').disabled = false;
}
async function downloadDependency() {
  if (!dependencyQuery || !dependencyEntry) return;
  const request = dependencyRequest, paths = dependencyVisiblePaths(), scope = dependencyScope(paths), query = { ...dependencyQuery.query, temporal_filter: $('dependency-temporal').value };
  const provenance = dependencyQuery.provenance || dependencyQuery;
  const contextEdges = dependencyQuery.context_edges.filter(edge => scope.nodeIds.has(edge.source_entity_id) || scope.nodeIds.has(edge.target_entity_id));
  const allEdges = [...scope.edges, ...scope.diagnostics.edges, ...contextEdges];
  const allRelationshipIds = new Set(allEdges.map(dependencyEdgeId));
  const contextEntityIds = new Set(contextEdges.flatMap(edge => [edge.source_entity_id, edge.target_entity_id]).filter(id => !scope.nodeIds.has(id)));
  const relationships = array(provenance.relationships).filter(record => allRelationshipIds.has(record.relationship_id));
  const allNodeIds = new Set([...scope.nodeIds, ...scope.diagnostics.nodes.map(dependencyNodeId), ...contextEntityIds]);
  const gaps = array(provenance.data_gaps).filter(gap => gapEntityIds(gap).some(id => allNodeIds.has(id)));
  const alternatives = dependencyAlternativesInScope(scope);
  const gapIds = new Set(gaps.map(gap => gap.gap_id)), gapKeys = new Set(gaps.map(gap => gap.accession_key || gap.key));
  const researchHistory = array(provenance.research_history).filter(record => gapIds.has(record.gap_id) || record.original_gap_accession_key && gapKeys.has(record.original_gap_accession_key));
  const claimIds = new Set([...allEdges, ...relationships, ...gaps, ...alternatives].flatMap(record => array(record.claim_ids || record.supporting_claim_ids)));
  for (const path of paths) for (const id of array(path.claim_ids || path.lineage?.input_claim_ids)) claimIds.add(id);
  for (const node of [...scope.nodes, ...scope.diagnostics.nodes]) for (const id of [...array(node.conflict_claim_ids), ...array(node.unknown_claim_ids)]) claimIds.add(id);
  const claimIndex = new Map(array(provenance.claims).map(claim => [claim.claim_id, claim]));
  const guards = array(provenance.record_usage_guards || dependencyQuery.record_usage_guards).filter(guard => claimIds.has(guard.claim_id) || allNodeIds.has(claimIndex.get(guard.claim_id)?.entity_id));
  for (const guard of guards) for (const id of [guard.claim_id, ...array(guard.supporting_claim_ids)]) claimIds.add(id);
  const claims = array(provenance.claims).filter(record => claimIds.has(record.claim_id));
  const evidenceIds = new Set([...allEdges, ...relationships, ...claims, ...paths, ...guards, ...alternatives].flatMap(record => array(record.evidence_refs || record.evidence_ids)));
  const evidenceRecords = array(provenance.evidence).filter(record => evidenceIds.has(record.evidence_id));
  const sourceIds = new Set([...evidenceRecords.map(record => record.source_id), ...allEdges.flatMap(record => array(record.source_ids))]);
  const sources = array(provenance.sources).filter(record => sourceIds.has(record.source_id));
  const missingReferences = { claim_ids: [...claimIds].filter(id => !claims.some(record => record.claim_id === id)), evidence_ids: [...evidenceIds].filter(id => !evidenceRecords.some(record => record.evidence_id === id)), source_ids: [...sourceIds].filter(id => !sources.some(record => record.source_id === id)) };
  const output = { public_availability_envelope:dependencyQuery.public_availability_envelope, query, paths, selected_metrics: dependencyQuery.selected_metrics || null, nodes: scope.nodes, edges: scope.edges, diagnostics: scope.diagnostics, context_nodes: array(provenance.entities).filter(node => contextEntityIds.has(node.entity_id)), relationships, claims, evidence: evidenceRecords, sources, data_gaps: gaps, research_history: researchHistory, record_usage_guards: guards, external_reference_scope: { authority_dataset_hash: catalog.authority_dataset_hash, input_projection_sha256: dependencyEntry.projection_sha256, missing_in_scoped_projection: missingReferences }, prioritized_gaps: dependencyQuery.prioritized_gaps.filter(gap => !gap.entity_ids?.length || gap.entity_ids.some(id => scope.nodeIds.has(id))), shared_nodes: dependencyQuery.shared_nodes.filter(node => dependencySharedInScope(node, scope)), readiness: dependencyReadinessInScope(scope), context_edges: contextEdges, alternatives, usage_restrictions: ['DEV_ANALYSIS_NOT_RELEASE_CERTIFIED', 'UNKNOWN_PERIOD does not prove current dependency', 'Graph centrality does not prove economic criticality', 'Theoretical alternatives and unknown spare capacity are not replacement supply', 'Filtered export includes only the selected fetched dependency query; no global network', 'Invalid paths are retained as diagnostics and excluded from physical dependencies', 'Record usage guards are preserved; guarded periods are not valid continuity inputs'] };
  output.public_availability_envelope=await scopeAvailability(dependencyQuery.public_availability_envelope,availabilityGapIds(output));
  const outputHash = await dependencyDigest(JSON.stringify(output));
  const lineage = { derived_record_id: `ui-query:${outputHash}`, input_record_ids: [...new Set([dependencyEntry.projection_sha256, ...[dependencyQuery.provenance_ref?.projection_sha256].filter(Boolean), ...scope.nodeIds, ...scope.diagnostics.nodes.map(dependencyNodeId), ...contextEntityIds, ...allRelationshipIds, ...claimIds, ...evidenceIds, ...sourceIds, ...gaps.map(gap => gap.gap_id), ...researchHistory.map(record => record.research_history_id), ...guards.map(guard => guard.guard_id)])], transformation_id: 'atlas.copper-dependency-scoped-export', transformation_version: '1', formula_or_rule: 'Retain selected query paths matching explicit temporal filter; include referenced knowledge records without quantity imputation', parameters: query, input_projection_sha256: dependencyEntry.projection_sha256, input_provenance_sha256: dependencyQuery.provenance_ref?.projection_sha256 || null, authority_dataset_hash: catalog.authority_dataset_hash, output_hash: outputHash, output: { query, counts: { paths: paths.length, nodes: scope.nodes.length, edges: scope.edges.length, claims: claims.length, evidence: evidenceRecords.length, sources: sources.length, data_gaps: gaps.length, record_usage_guards: guards.length }, sha256: outputHash }, source_query_lineage: dependencyQuery.lineage };
  lineage.execution_hash = await dependencyDigest(JSON.stringify(lineage));
  if (request !== dependencyRequest || !dependencyQuery) return;
  const payload = { export_schema: 'atlas.copper-dependency.export/1', export_status: 'DEV_ANALYSIS_NOT_RELEASE_CERTIFIED', exported_at: new Date().toISOString(), authority_dataset_hash: catalog.authority_dataset_hash, as_of: dependencyQuery.as_of, ...output, lineage };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = el('a'); link.href = url; link.download = `atlas-copper-v29-2-dependency-${query.direction.toLowerCase()}-${query.hops}hops.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadGlobalDependencyPriorities() {
  if (!dependencyCatalog?.summary) return;
  const request = ++dependencySummaryRequest;
  $('dependency-global-priorities').disabled = true;
  try {
    const report = await dependencyFetch(dependencyCatalog.summary, 'atlas.copper-dependency-summary/1');
    if (!Array.isArray(report.top_10_value_of_information_gaps) || !report.lineage) throw new Error('Globale Informationswert-Lineage fehlt');
    validateDependencyLineage(report);
    for (const gap of report.top_10_value_of_information_gaps) validateDependencyLineage(gap);
    if (request !== dependencySummaryRequest) return;
    globalAvailability=report.public_availability_envelope;
    $('dependency-global-gaps').replaceChildren();
    $('dependency-global-gaps').append(el('h3', 'Netzwerkweite Critical Missing Inputs · Top 10'), paragraph(`Stand ${report.as_of} · transparente Priorisierung des recherchierten Kupfernetzwerks. Fehlende globale Abdeckung bleibt offen.`, 'small'));
    for (const gap of report.top_10_value_of_information_gaps) { const item = el('article', undefined, 'gap'); item.append(el('strong', gap.gap_type || gap.field_path || gap.gap_id), chip('UNKNOWN'), paragraph(`Priority ${printable(gap.priority_score)} · ${printable(gap.reason)}`, 'small'), paragraph(`Simulation ${printable(gap.simulation_impact)} · Dependency ${printable(gap.dependency_impact)} · Unsicherheitsreduktion ${printable(gap.uncertainty_reduction)} · Quellenzugang ${printable(gap.source_availability)} · Aufwand ${printable(gap.research_cost)}`, 'small'), paragraph(`Recherche ${printable(gap.research_status)} · Retry: ${printable(gap.retry_policy)} · ${printable(gap.next_action)}`, 'small'), el('code', gap.gap_id)); dependencyRecordRefs(gap, item,globalAvailability); $('dependency-global-gaps').append(item); }
    const details = el('details'); details.append(el('summary', 'Netzwerkweite Priorisierungs-Lineage'), el('pre', JSON.stringify(report.lineage, null, 2))); $('dependency-global-gaps').append(details);
    $('dependency-global-priorities').textContent = 'Netzwerkweite Top 10 geladen';
  } catch (error) { if (request === dependencySummaryRequest) { $('dependency-error').textContent = `Netzwerkweite Priorisierung angehalten: ${error.message}`; $('dependency-error').hidden = false; $('dependency-global-priorities').disabled = false; } }
}
$('dependency-global-priorities')?.addEventListener('click', loadGlobalDependencyPriorities);
$('dependency-form')?.addEventListener('submit', loadDependencyQuery);
for (const id of ['dependency-entity', 'dependency-direction', 'dependency-hops']) $(id)?.addEventListener('change', () => dependencyInvalidate());
$('dependency-temporal')?.addEventListener('change', () => { if (dependencyQuery) dependencyRequest++; renderDependencyQuery(); });
$('dependency-export')?.addEventListener('click', () => downloadDependency().catch(dependencyFailure));

return loadDependencyCatalog;
}
