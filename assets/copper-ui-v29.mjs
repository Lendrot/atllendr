import {availabilityEnvelope,availabilityDetail,gapIds} from './copper-public-availability-v293.mjs';
import { validateCopperGraph, analyzeDisruption } from './copper-analysis-v29.mjs';

const $ = id => document.getElementById(id);
const array = value => Array.isArray(value) ? value : [];
const printable = value => value === null || value === undefined || value === '' ? 'UNKNOWN' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const labels = { PARTIALLY_OWNS: 'Beteiligung', OWNS: 'Eigentum', OPERATES: 'Betreibt', PROCESSES_AT: 'Verarbeitet bei', TRANSPORTS_TO: 'Transportiert zu', SUPPLIES: 'Liefert an', OFFTAKE_AGREEMENT: 'Offtake-Vertrag', MINE: 'Mine', COMPANY: 'Unternehmen', PROCESSOR: 'Verarbeitung', CONCENTRATOR: 'Konzentrator', PORT: 'Hafen', TERMINAL: 'Terminal', CONTAINED_METAL: 'Enthaltenes Metall', REFINED_METAL: 'Raffiniertes Metall', UNKNOWN_MATERIAL_BASIS: 'Materialbasis UNKNOWN' };
const label = value => labels[value] || printable(value);
const descriptions = {
SOURCE_DATE_ONLY: 'SOURCE_DATE_ONLY · nur Quellensnapshot; aktuelle oder jahresbezogene Gültigkeit UNKNOWN',
POTENTIAL_DISRUPTION_EXPOSURE: 'Möglicherweise von der angenommenen Störung betroffen; die Ausfallmenge ist unbekannt.',
EVIDENCED_PHYSICAL_REACHABILITY: 'Über belegte Verarbeitungs- oder Transportbeziehungen erreichbar.',
SOURCE_REPORTED_UPSTREAM_PATH_TO_SELECTED_ENTITY: 'Laut Quellensnapshot vorgelagerter Datenpfad zur ausgewählten Entity; keine bestätigte aktuelle Liefermenge.',
HISTORICAL_PRODUCTION_NOT_PREDICTED_LOSS: 'Historisch belegte Produktion; keine Prognose eines Ausfallverlustes.',
UNKNOWN_NOT_ASSIGNED_TO_SELECTED_ENTITY: 'UNKNOWN · historische Menge wurde dem ausgewählten Ausfall nicht zugeordnet.',
NOT_A_CONFIRMED_REPLACEMENT: 'Keine bestätigte Ersatzlieferung oder gesicherte Ersatzkapazität.',
KNOWN_PARALLEL_OUTLET_NOT_VERIFIED_SUBSTITUTE: 'Belegter weiterer Hafenbezug derselben Materialbasis; die tatsächliche Umleitung ist nicht verifiziert.',
FEASIBILITY_AT_SOURCED_PERIOD_ONLY: 'Machbarkeit gilt ausschließlich für den belegten Referenzzeitraum.',
ROUTE_ALLOCATION_UNKNOWN: 'Routenanteil unbekannt', SPARE_CAPACITY_UNKNOWN: 'Freie Kapazität unbekannt', CONTRACT_ACCESS_UNKNOWN: 'Vertragszugang unbekannt', REALLOCATION_FEASIBILITY_UNKNOWN: 'Machbarkeit der Umleitung unbekannt',
DIFFERENT_REFERENCE_YEAR: 'Anderes Referenzjahr', NON_FACT_CLAIM: 'Kein FACT-Claim', NON_NUMERIC_VALUE: 'Kein belastbarer Zahlenwert', UNKNOWN_MATERIAL_BASIS: 'Materialbasis unbekannt', UNKNOWN_OR_INVALID_PERIOD: 'Zeitraum unbekannt oder ungültig', INCOMPLETE_QUANTITATIVE_BASIS: 'Quantitative Basis unvollständig', NON_FACT_PHYSICAL_RELATIONSHIP: 'Physische Beziehung kein FACT',
PRODUCT_CHANNEL_OUTSIDE_SCENARIO:'Anderer Materialpfad; bleibt in den Foundation-Daten erhalten',
UNVERIFIED_SELECTED_PERIOD:'Gültigkeit im ausgewählten Geschäftsjahr nicht belegt',
UNKNOWN_PRODUCT_CHANNEL:'Produktpfad unbekannt; Verbindung aus der Analyse ausgeschlossen',
DISJOINT_PATH_PERIOD:'Beziehungen haben keinen gemeinsamen Gültigkeitszeitraum',
COPPER_CONCENTRATE:'Kupferkonzentrat', COPPER_CATHODE:'Kupferkathoden', COPPER_ORE:'Kupferhaltiges Erz', COPPER_ANODE:'Kupferanoden',
CONDITIONAL_SOURCE_REPORTED_PATH:'Quellenberichteter Zusammenhang; zeitliche Übereinstimmung UNKNOWN',
DATED_PATH_OVERLAP_NOT_FULL_YEAR_GUARANTEE:'Datierte Verbindungen mit gemeinsamem Zeitraum; keine Ganzjahresgarantie',
'Qualitative downstream reachability is conditional on the selected disruption assumption; it is not a forecast.': 'Die qualitative Folgeabhängigkeit gilt unter der gewählten Ausfallannahme und ist keine Prognose.',
'Historical production is displayed per claim, fiscal interval and material basis; no forecast or loss calculation is derived.': 'Historische Produktion bleibt nach Claim, Geschäftsjahr und Materialbasis getrennt. Daraus wird keine Verlustmenge berechnet.',
'Unknown route allocation, spare capacity, inventory and replacement feasibility prevent quantitative disruption loss.': 'Unbekannte Routenanteile, freie Kapazitäten, Bestände und Ersatzmöglichkeiten verhindern eine quantitative Verlustrechnung.',
'Ownership and operation describe corporate context and never imply physical supply.': 'Eigentum und Betrieb beschreiben den Unternehmenskontext und belegen keine physische Lieferung.',
'The bounded researched graph does not establish global copper coverage.': 'Der recherchierte Teilgraph belegt keine globale Kupferabdeckung.',
'Source-reported physical topology has incomplete validity intervals; current or selected-year route validity is not proven.': 'Die Routen sind im Quellensnapshot berichtet. Ihre aktuelle Gültigkeit oder Gültigkeit im gewählten Jahr ist nicht vollständig belegt.',
'No evidenced alternative with verified replacement feasibility is present in this graph.': 'Im Datenstrang liegt keine Alternative mit belegter Ersatzmachbarkeit vor.'
};
const describe = value => descriptions[value] || printable(value);
let graph, result, entities, sources, evidence, catalog, analysisRequest = 0, loadRequest = 0;
let networkReport=null, networkIndex=null, networkRequest=0;
const expandedNeighborhoods=new Map();

function el(tag, text, className) {
const element = document.createElement(tag);
if (text !== undefined) element.textContent = printable(text);
if (className) element.className = className;
return element;
}
function chip(status) { return el('span', status || 'UNKNOWN', `chip ${String(status || 'UNKNOWN').toLowerCase()}`); }
function paragraph(text, className) { return el('p', text, className); }
function entityName(id) { return entities.get(typeof id === 'object' ? id.entity_id : id)?.canonical_name || printable(typeof id === 'object' ? id.entity_id : id); }
function refs(record) { return array(record.evidence_refs); }
function sourceRefs(record) {
return refs(record).map(id => {
const item = evidence.get(id);
const source = sources.get(item?.source_id);
return `${id}${source ? ` · ${source.source_name || source.title || source.source_id}` : ''}${item?.source_locator ? ` · ${printable(item.source_locator)}` : ''}`;
});
}
function evidenceNote(record) { return paragraph(sourceRefs(record).join(' | ') || 'Evidence-Verweis UNKNOWN', 'small'); }
function renderRelationship(record, target) {
const item = el('div', undefined, `relationship ${['PROCESSES_AT', 'TRANSPORTS_TO', 'SUPPLIES'].includes(record.relationship_type) ? 'flow' : ''}`);
item.append(chip(record.fact_status), el('strong', label(record.relationship_type)), paragraph(`${entityName(record.source_entity_id)} → ${entityName(record.target_entity_id)}`));
const details = [record.channel_transition && `Prozesskontext: ${describe(record.channel_transition.input)} → ${describe(record.channel_transition.output)} · keine Mengenrechnung`, record.ownership_percentage != null && `Beteiligung: ${record.ownership_percentage} %`, record.transport_mode && `Transport: ${record.transport_mode}`, record.material_basis && `Basis: ${label(record.material_basis)}`, record.material_form && `Materialform: ${record.material_form}`, `Zeit: ${describe(record.temporal_status || 'UNKNOWN_PERIOD')}`].filter(Boolean);
item.append(paragraph(details.join(' · '), 'small'), evidenceNote(record));
if (array(record.usage_restrictions).length) item.append(paragraph(`Nutzung: ${record.usage_restrictions.join(' · ')}`, 'small'));
target.append(item);
}
function renderKnowledge() {
const entitySelect = $('entity-select');
const selectable = graph.entities.filter(e => /MINE|PROCESS|CONCENTRATOR|SMELTER|REFINERY|PORT|TERMINAL|DOWNSTREAM/.test(String(e.entity_type).toUpperCase()));
for (const entity of selectable) {
const option = el('option', `${entity.canonical_name} · ${label(entity.entity_type)}`);
option.value = entity.entity_id;
entitySelect.append(option);
}
for (const entity of graph.entities) {
const card = el('button', undefined, 'entity-card');
card.type = 'button';
card.dataset.entityId = entity.entity_id;
card.append(el('strong', entity.canonical_name), el('small', `${label(entity.entity_type)} · ${entity.identity_status || 'UNKNOWN'}`), el('small', `Land: ${printable(entity.country)} · Koordinaten: ${entity.coordinates ? printable(entity.coordinates) : 'UNKNOWN'}`), el('small', entity.entity_id));
if (selectable.some(item => item.entity_id === entity.entity_id)) card.addEventListener('click', () => { entitySelect.value = entity.entity_id; runAnalysis(); });
else { card.addEventListener('click', () => { $('gap-entity').value = entity.entity_id; renderGaps(); $('gaps-title').scrollIntoView({ behavior: 'smooth', block: 'start' }); }); card.title = 'Datenlücken dieser Entity anzeigen'; }
$('entity-network').append(card);
const gapOption = el('option', entity.canonical_name); gapOption.value = entity.entity_id; $('gap-entity').append(gapOption);
}
graph.relationships.forEach(item => renderRelationship(item, $('relationships')));
for (const [selector, field] of [['gap-type', 'gap_type'], ['gap-research', 'research_status'], ['gap-priority', 'priority']]) {
const values = [...new Set(graph.data_gaps.map(gap => printable(gap[field])))].sort();
for (const value of values) { const option = el('option', value); option.value = value; $(selector).append(option); }
}
const years = [...new Set(graph.claims.filter(c => c.field === 'production' && Number.isInteger(c.reference_year)).map(c => c.reference_year))].sort((a, b) => b - a);
for (const year of years) { const option = el('option', `${year}`); option.value = String(year); $('year-select').append(option); }
if (!years.length) { const option = el('option', 'Kein belegtes Referenzjahr'); option.value = ''; $('year-select').append(option); }
const production = graph.claims.filter(c => c.field === 'production').sort((a, b) => (b.reference_year || 0) - (a.reference_year || 0) || printable(a.material_basis).localeCompare(printable(b.material_basis)));
for (const claim of production) {
const row = el('tr');
const period = el('td', `${entityName(claim.entity_id)} · ${claim.fiscal_year_label || `${printable(claim.reference_year)}`}`);
period.append(el('small', `${claim.period_type || 'UNKNOWN_PERIOD'} · [${printable(claim.period_start)}, ${printable(claim.period_end)})`));
const value = el('td', `${printable(claim.value)} ${printable(claim.unit)}`); value.append(el('small', claim.measurement_basis));
const material = el('td', label(claim.material_basis)); material.append(el('small', claim.material_form || claim.material));
const status = el('td'); status.append(chip(claim.fact_status), el('small', claim.evidence_status), el('small', sourceRefs(claim).join(' | ')), el('small', claim.claim_id));
row.append(period, value, material, status); $('production').append(row);
}
if (!production.length) { const row = el('tr'); const cell = el('td', 'Keine belegten Produktionsclaims in diesem Scope.'); cell.colSpan = 4; row.append(cell); $('production').append(row); }
renderGaps(); renderSources(); renderP0();
const meta = graph.meta;
for (const [name, value] of [['Dataset-Version', meta.dataset_version], ['Dataset-Hash', meta.dataset_hash], ['Foundation-Baseline', meta.baseline_ledger_sha256], ['Analysescope', meta.analysis_scope]]) {
$('dataset-meta').append(el('dt', name), el('dd', printable(value)));
}
$('load-status').textContent = `${graph.entities.length} Entities · ${graph.relationships.length} Beziehungen · ${graph.claims.length} Claims · ${graph.sources.length} Quellen. Belegter Teilbestand; globale Abdeckung UNKNOWN.`;
entitySelect.disabled = false; $('year-select').disabled = false; $('analyze').disabled = !selectable.length;
}
function gapEntityIds(gap) { return array(gap.entity_ids).length ? gap.entity_ids : [gap.entity_id].filter(Boolean); }
function renderGaps() {
const selected = $('gap-entity').value;
const gaps = graph.data_gaps.filter(gap => (selected === 'all' || gapEntityIds(gap).includes(selected))
&& ($('gap-type').value === 'all' || printable(gap.gap_type) === $('gap-type').value)
&& ($('gap-research').value === 'all' || printable(gap.research_status) === $('gap-research').value)
&& ($('gap-priority').value === 'all' || printable(gap.priority) === $('gap-priority').value));
$('gaps').replaceChildren();
$('gap-summary').textContent = `${gaps.length} angezeigte Lücken / ${graph.data_gaps.length} registrierte Lücken in diesem Kupfer-Scope. Fehlende öffentliche Evidence ist keine Bestätigung der Nichtexistenz.`;
for (const gap of gaps) {
const item = el('article', undefined, 'gap');
item.append(chip(gap.fact_status || 'UNKNOWN'), el('strong', gap.gap_type || gap.field_path || 'Datenlücke'), paragraph(gapEntityIds(gap).map(entityName).join(' · ') || 'Entity-Zuordnung UNKNOWN'));
item.append(paragraph(`Fehlt: ${printable(gap.missing_evidence || gap.field_path || gap.field)}`));
item.append(paragraph(`Nutzung: ${printable(gap.usage_restrictions || gap.restrictions || 'Keine unbelegte FACT-Aussage oder Berechnung.')}`, 'small'));
item.append(paragraph(`Recherche: ${printable(gap.research_status)} · Nächster Schritt: ${printable(gap.next_action || gap.next_research_action)}`, 'small'));
item.append(el('code', `${gap.gap_id} · Original: ${printable(gap.original_record_locator)} · Hash: ${printable(gap.original_record_hash)}`));
item.append(availabilityDetail(gap,graph.public_availability_envelope)); $('gaps').append(item);
}
if (!gaps.length) $('gaps').append(paragraph('Keine registrierte Lücke für diesen Filter. Dies belegt keine vollständige Entity-Abdeckung.', 'empty'));
}
function safeUrl(value) {
try { const parsed = new URL(value); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : null; } catch { return null; }
}
function renderSources() {
for (const source of graph.sources) {
const item = el('article', undefined, 'source');
item.append(el('h3', source.source_name || source.title || source.source_id), chip(source.source_quality || 'UNKNOWN_SOURCE_QUALITY'));
const url = safeUrl(source.source_url || source.url);
if (url) { const link = el('a', url); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link); }
item.append(paragraph(`Veröffentlicht: ${printable(source.source_published_at || source.source_date)} · Zugriff: ${printable(source.access_date || source.accessed_at)}`, 'small'), el('code', source.source_id));
item.append(paragraph(`Gesichertes Artefakt (${source.artifact_type || 'Originalquelle'}) SHA-256: ${printable(source.raw_artifact_sha256)}`, 'small'));
const matching = graph.evidence.filter(e => e.source_id === source.source_id);
const details = el('details'); details.append(el('summary', `${matching.length} Evidence-Verweise`));
for (const record of matching) details.append(paragraph(`${record.evidence_id} · ${printable(record.source_locator || record.locator)} · ${printable(record.evidence_type)} · Originalquelle gesichert: ${record.original_pdf_pinned === true || record.original_artifact_pinned === true ? 'Ja' : 'UNKNOWN'} · Prüfung: ${printable(record.verification_status)} · unabhängiges Audit: ${printable(record.independent_audit_status)}`, 'small'));
item.append(details); $('sources').append(item);
}
for (const claim of graph.claims) {
const item = el('article', undefined, 'claim');
item.append(chip(claim.fact_status), el('strong', `${entityName(claim.entity_id)} · ${claim.field}`), paragraph(`${printable(claim.value)}${claim.unit ? ` ${claim.unit}` : ''}`), paragraph(`Zeit: ${claim.period_type || 'UNKNOWN_PERIOD'} · ${printable(claim.period_start)} bis ${printable(claim.period_end)} · Basis: ${printable(claim.material_basis)}`, 'small'), evidenceNote(claim), el('code', claim.claim_id));
for(const guard of array(graph.record_usage_guards).filter(g=>g.claim_id===claim.claim_id)) item.append(paragraph(`Zeitraum korrigiert: ${guard.reason} · ${printable(guard.usage_restrictions)}`,'error'));
if (array(claim.usage_restrictions).length) item.append(paragraph(`Nutzung: ${claim.usage_restrictions.join(' · ')}`, 'small'));
$('claims').append(item);
}
}
function renderP0() {
const records = array(graph.meta.open_p0);
$('open-p0').append(paragraph(`Offene Atlas-P0 im archivierten Basisstand: ${records.length || 'UNKNOWN'}. Aktueller globaler Bestand: UNKNOWN. Eine gesicherte Teilanalyse schließt diese Findings nicht.`, 'small'));
const list = el('ul');
for (const item of records) list.append(el('li', typeof item === 'string' ? item : `${item.P0_ID || item.p0_id || item.id || 'P0'} · ${item.status || item.STATUS || 'OPEN'} · ${item.root_cause || item.ROOT_CAUSE || item.description || 'Details im Auditregister'}`));
$('open-p0').append(list);
}
function listSection(title, records, display) {
const section = el('section'); section.append(el('h3', title));
if (!records.length) section.append(paragraph('Keine belegten Einträge in diesem Scope. UNKNOWN bleibt offen.', 'empty'));
else { const list = el('ul'); for (const record of records) { const item = el('li'); display(record, item); list.append(item); } section.append(list); }
return section;
}
async function runAnalysis(event) {
event?.preventDefault();
if (!graph || !$('entity-select').value) return;
const request = ++analysisRequest;
const entityId = $('entity-select').value;
const referenceYear = $('year-select').value ? Number($('year-select').value) : null;
result = null; $('export-result').disabled = true;
$('analyze').disabled = true; $('error').hidden = true;
try {
const computed = await analyzeDisruption(graph, { entityId, referenceYear, topologyMode:$('topology-mode').value });
if (request !== analysisRequest) return;
result = computed;
const target = $('analysis-result'); target.replaceChildren();
const selectedName = entityName(entityId);
$('analysis-title').textContent = `Angenommener Ausfall: ${selectedName}`;
const summary = el('div', undefined, 'result-summary');
summary.append(chip('ASSUMPTION'), paragraph(`Szenario: ${selectedName} nicht verfügbar. Die Analyse prüft belegte Verbindungen im gespeicherten Datenstrang.`), paragraph(`Ergebnisgrenze: ${printable(result.confidence?.status)} · Zeitgültigkeit: ${printable(result.confidence?.temporal_validity)} · Quantitativer Ausfall: ${printable(result.confidence?.quantitative_impact || 'NOT_ESTIMABLE')}. Historische Werte sind keine berechneten Verlustmengen.`, 'small'));
target.append(summary);
const admission = legacyScenarioAdmission();
const admissionNote=paragraph(`${admission.admission_status} · Ausfallannahme; Zeitraum/Mengen UNKNOWN. Prüfung offen.`, 'small');admissionNote.dataset.scenarioAdmission=admission.admission_status;target.append(admissionNote);
const grid = el('div', undefined, 'result-grid');
grid.append(listSection('Möglicherweise betroffene Entities', array(result.affected_entities), (record, item) => { item.append(chip(record.fact_status || 'INFERENCE'), el('strong', record.canonical_name || entityName(record.entity_id)), paragraph(describe(record.impact || record.basis || 'Qualitative Abhängigkeit im belegten Graphen.'), 'small')); }));
grid.append(listSection('Vorgelagerte Abhängigkeiten', array(result.upstream_dependencies), (record, item) => { item.append(chip(record.fact_status || 'INFERENCE'), el('strong', record.canonical_name || entityName(record.entity_id)), paragraph(describe(record.interpretation || 'Vorgelagerte Verbindung; keine berechnete Verlustmenge.'), 'small')); }));
grid.append(listSection('Eigentümerkontext · kein Materialfluss', array(result.ownership_context), (record, item) => { item.append(el('span', `${entityName(record.source_entity_id)} → ${entityName(record.target_entity_id)} · ${label(record.relationship_type)}${record.ownership_percentage != null ? ` · ${record.ownership_percentage} %` : ''}`), evidenceNote(record)); }));
grid.append(listSection('Mögliche Alternativen', array(result.alternatives), (record, item) => { item.append(chip(record.feasibility_status || record.status || record.alternative_status || 'UNKNOWN_FEASIBILITY'), paragraph(`${record.canonical_name || entityName(record.entity_id || record.candidate_entity_id)} · ${describe(record.usage_restriction || record.usage_restrictions || 'Keine gesicherte Ersatzlieferung.')}`, 'small')); if (record.interpretation) item.append(paragraph(describe(record.interpretation), 'small')); if (array(record.conditions).length) item.append(paragraph(`Voraussetzungen: ${record.conditions.map(describe).join(' · ')}`, 'small')); item.append(evidenceNote(record)); }));
const availability=el('details');availability.append(el('summary','Öffentliche Evidence · Ausschlussbericht'),el('pre',JSON.stringify(result.public_availability_envelope,null,2)));grid.append(availability);
grid.append(listSection('Ausgeschlossene Records', array(result.excluded_records), (record, item) => { item.append(el('code', record.record_id || record.claim_id || record.relationship_id), paragraph(array(record.reasons).map(describe).join(' · ') || describe(record.reason || 'UNKNOWN'), 'small')); }));
grid.append(listSection('Konkurrierende Quellenversionen', array(result.conflicts), (record,item)=>{item.append(chip('CONFLICT'),el('strong',`${entityName(record.entity_id)} · ${printable(record.value)} ${printable(record.unit)}`),paragraph(`${record.reference_year} · ${record.measurement_basis || record.field}`, 'small'),evidenceNote(record));}));
grid.append(listSection('Datenlücken in diesem Szenario', array(result.data_gaps), (record, item) => { item.append(chip(record.fact_status || 'UNKNOWN'), el('strong', record.gap_type || record.field_path), paragraph(`${gapEntityIds(record).map(entityName).join(' · ')} · ${printable(record.usage_restrictions)}`, 'small'), el('code', record.gap_id),availabilityDetail(record,result.public_availability_envelope)); }));
target.append(grid);
target.append(listSection('Nachvollziehbare Abhängigkeitspfade', [...array(result.downstream_paths),...array(result.upstream_paths)], (record,item)=>{
item.append(chip('INFERENCE'),el('strong',record.entity_ids.map(entityName).join(' → ')),paragraph(`${describe(record.product_channel)} · ${describe(record.interpretation)}`, 'small'));
for(const id of record.relationship_ids){const relationship=graph.relationships.find(r=>r.relationship_id===id);item.append(evidenceNote(relationship));}
}));
target.append(listSection('Angekündigte Verarbeitung · Lieferung nicht bestätigt', array(result.announcements), (record,item)=>{
item.append(chip('FACT'),paragraph('Die Quelle belegt die Ankündigung eines Demonstrationsprojekts mit Escondida-Konzentrat. Abschluss, Anlage und Einzelmengen bleiben UNKNOWN.'),paragraph(printable(record.value),'small'),evidenceNote(record));
}));
const exposure = array(result.historical_exposure);
target.append(listSection('Historische Exposition · keine Ausfallprognose', exposure, (record, item) => { item.append(el('strong', `${printable(record.value)} ${printable(record.unit)} · ${printable(record.reference_year)} · ${label(record.material_basis)}`), paragraph(`${entityName(record.entity_id)} · ${record.material_form || record.material || 'UNKNOWN'} · ${printable(record.measurement_basis)} · [${printable(record.period_start)}, ${printable(record.period_end)})`, 'small'), paragraph(describe(record.interpretation || 'Historisch belegter Produktionskontext, keine aktuell bestätigte Verlustmenge.'), 'small'), paragraph(`Zuordnung zum ausgewählten Ausfall: ${describe(record.scenario_allocation || 'Keine Verlustmenge berechnet')}`, 'small'), evidenceNote(record)); }));
const relSection = el('details'); relSection.append(el('summary', `${array(result.affected_relationships).length} betroffene Beziehungen`));
for (const record of array(result.affected_relationships)) renderRelationship(record, relSection);
target.append(relSection);
target.append(listSection('Grenzen & Confidence', array(result.limitations), (record, item) => {
item.append(el('span', describe(typeof record === 'string' ? record : record.description || printable(record))));
}));
$('lineage').textContent = JSON.stringify(result.lineage, null, 2);
$('analysis-section').hidden = false; $('export-result').disabled = false;
document.querySelectorAll('.entity-card').forEach(card => card.classList.toggle('selected', card.dataset.entityId === entityId));
} catch (error) { if (request === analysisRequest) { result = null; $('export-result').disabled = true; $('analysis-section').hidden = true; showError(error); } }
finally { if (request === analysisRequest) $('analyze').disabled = false; }
}
function showError(error) { $('error').textContent = `Analyse angehalten: ${error.message || printable(error)}. Unsichere oder unvollständige Inputs werden nicht durch Ersatzwerte ergänzt.`; $('error').hidden = false; }
function downloadResult() {
if (!graph || !result) return;
const payload = { scenario_admission:legacyScenarioAdmission(), network_analysis:networkReport, expanded_neighborhoods:[...expandedNeighborhoods.values()], network_export_scope:'Verified on-demand projections only; unfetched neighborhoods are not included', export_schema: 'atlas.copper-intelligence.export/1', export_status: 'DEV_ANALYSIS_NOT_RELEASE_CERTIFIED', exported_at: new Date().toISOString(), knowledge: graph, analysis: result, usage_restrictions: ['Scenario is ASSUMPTION', 'Qualitative dependencies are INFERENCE', 'Historical production is not current disruption loss', 'Unknown time validity, replacement feasibility and capacity cannot be assumed', 'Global open P0 and source gaps remain visible'] };
const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
const link = el('a'); link.href = url; link.download = `atlas-copper-v29-${result.scenario?.reference_year || 'unknown'}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('scenario-form').addEventListener('submit', runAnalysis);
function legacyScenarioAdmission(){return {schema_version:'atlas.copper-source-context-admission/1',admission_status:'HYPOTHETICAL_ONLY',scenario:result.scenario,source_analysis_execution_hash:result.lineage.execution_hash,input_hash:result.lineage.input_hash,calculation_eligibility:{source_context_inspection:true,period_verified_structural_exposure:false,quantified_disruption:false,replacement_tonnage:false},reasons:['ASSUMPTION; sourced context only','Period/material admission requires V29.4']};}
for (const id of ['entity-select', 'year-select', 'topology-mode']) $(id).addEventListener('change', () => {
analysisRequest++; result = null; $('analysis-section').hidden = true; $('export-result').disabled = true; $('analyze').disabled = false;
document.querySelectorAll('.entity-card').forEach(card => card.classList.remove('selected'));
});
for (const id of ['gap-entity', 'gap-type', 'gap-research', 'gap-priority']) $(id).addEventListener('change', renderGaps);
$('export-result').addEventListener('click', downloadResult);

async function loadChain(chain, query = null) {
const request = ++loadRequest;
analysisRequest++; graph = null; result = null; networkReport=null; networkIndex=null; networkRequest++; expandedNeighborhoods.clear();
if($('load-network')) {$('load-network').disabled=true; for(const id of ['network-summary','shared-network','network-paths','network-priorities','network-neighborhoods']) $(id).replaceChildren(); $('network-status').textContent='Weitere Beziehungen werden auf Anfrage geladen.';}
$('analysis-section').hidden = true; $('export-result').disabled = true; $('analyze').disabled = true;
$('entity-select').disabled = true; $('year-select').disabled = true; $('error').hidden = true;
$('load-status').textContent = `${chain.name}: Quellenbestand wird geladen …`;
for (const id of ['entity-select','year-select','entity-network','relationships','production','sources','claims','open-p0','dataset-meta','gaps','analysis-result','lineage']) $(id).replaceChildren();
for (const id of ['gap-entity','gap-type','gap-research','gap-priority']) {
while ($(id).options.length > 1) $(id).remove(1); $(id).value = 'all';
}
try {
const response = await fetch(chain.url, { cache: 'no-cache' });
if (!response.ok) throw new Error(`Foundation HTTP ${response.status}`);
const bytes = new TextEncoder().encode(await response.text());
const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)), n=>n.toString(16).padStart(2,'0')).join('');
if (sha !== chain.projection_sha256 || bytes.length !== chain.bytes) throw new Error('Projektionshash oder Größe stimmt nicht mit dem Katalog überein');
const loaded = JSON.parse(new TextDecoder().decode(bytes));
const validation = validateCopperGraph(loaded);
if (!validation.valid) throw new Error(`Integrity-Prüfung: ${printable(validation.errors)}`);
if (loaded.meta.chain_id !== chain.chain_id || loaded.meta.authority_dataset_hash !== catalog.authority_dataset_hash) throw new Error('Katalog/Knowledge-Version nicht konsistent');
if (request !== loadRequest) return;
loaded.public_availability_envelope=await availabilityEnvelope(loaded.data_gaps,catalog.authority_dataset_hash);
graph = loaded;
if($('load-network')) $('load-network').disabled=!catalog.network_index || !catalog.network_summary;
entities = new Map(graph.entities.map(e => [e.entity_id,e])); sources = new Map(graph.sources.map(s=>[s.source_id,s])); evidence = new Map(graph.evidence.map(e=>[e.evidence_id,e]));
renderKnowledge();
$('entity-select').value = chain.root_entity_id;
let validSelection = true;
for (const [param,id] of [['entity','entity-select'],['year','year-select']]) {
if (!query?.has(param)) continue;
const value = query.get(param);
if ([...$(id).options].some(option=>option.value===value)) $(id).value=value;
else { validSelection=false; showError(new Error(`Verlinkte Auswahl ${param} ist in dieser Kupferkette nicht verfügbar`)); }
}
if (validSelection) await runAnalysis();
} catch(error) {
if (request !== loadRequest) return;
graph=null; result=null; $('load-status').textContent='Foundation-Inputs nicht nutzbar. Analyse gesperrt.';
$('entity-select').disabled=true; $('year-select').disabled=true; $('analyze').disabled=true;
showError(error);
}
}
async function fetchPinnedProjection(entry) {
if(!entry || !/^\/foundation\/v29\/[a-z0-9/_-]+\.json$/.test(entry.url) || !Number.isInteger(entry.bytes) || entry.bytes>150000 || !/^[a-f0-9]{64}$/.test(entry.projection_sha256)) throw new Error('Ungültige Netzwerkprojektion');
const response=await fetch(entry.url,{cache:'no-cache'});
if(!response.ok) throw new Error(`Netzwerk HTTP ${response.status}`);
const text=await response.text(),bytes=new TextEncoder().encode(text);
const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
if(sha!==entry.projection_sha256 || bytes.length!==entry.bytes) throw new Error('Netzwerkhash oder Größe stimmt nicht');
const loaded=JSON.parse(text);
if((loaded.authority_dataset_hash || loaded.meta?.authority_dataset_hash)!==catalog.authority_dataset_hash) throw new Error('Netzwerk/Knowledge-Version nicht konsistent');
if(loaded.public_availability_ref||gapIds(loaded).length){const {hydrateAvailability}=await import('./copper-public-availability-ui-v293.mjs');await hydrateAvailability(loaded,catalog.authority_dataset_hash);}
return loaded;
}
async function expandNeighborhood(entityId,button) {
const request=networkRequest;
button.disabled=true;
try {
const entry=Array.isArray(networkIndex.neighborhoods)?networkIndex.neighborhoods.find(n=>n.entity_id===entityId):networkIndex.neighborhoods[entityId];
const neighborhood=await fetchPinnedProjection(entry);
const validation=validateCopperGraph(neighborhood);
if(!validation.valid || neighborhood.meta.focal_entity_id!==entityId) throw new Error('Nachbarschaft verletzt Knowledge-Integrität');
if(request!==networkRequest)return;
expandedNeighborhoods.set(entityId,neighborhood);
const block=el('details');block.open=true;
const names=new Map(neighborhood.entities.map(e=>[e.entity_id,e.canonical_name]));
block.append(el('summary',`${names.get(entityId)} · ${neighborhood.relationships.length} direkte Beziehungen`));
for(const r of neighborhood.relationships) {
const line=el('p');line.append(chip(r.fact_status),el('strong',`${names.get(r.source_entity_id)} → ${names.get(r.target_entity_id)}`),paragraph(`${label(r.relationship_type)} · ${r.material_form || 'Material UNKNOWN'} · Zeit: ${r.valid_from || 'UNKNOWN'} bis ${r.valid_to || 'UNKNOWN'}`, 'small'));
for(const eid of r.evidence_refs){const ev=neighborhood.evidence.find(e=>e.evidence_id===eid),source=neighborhood.sources.find(s=>s.source_id===ev?.source_id);const link=el('a',source?.source_name || eid);link.href=safeUrl(source?.source_url) || '#';link.target='_blank';link.rel='noopener noreferrer';line.append(link,paragraph(printable(ev?.source_locator),'small'));if(source?.artifact_type==='WEB_RETRIEVAL_EXTRACT')line.append(paragraph('Gesicherter Primärtextauszug; Originaldatei nicht gesichert.','small'));}
if(r.usage_restrictions?.length)line.append(paragraph(r.usage_restrictions.join(' · '),'small'));
block.append(line);
}
for(const guard of array(neighborhood.record_usage_guards))block.append(paragraph(`Nutzung gesperrt: ${guard.reason} · ${printable(guard.usage_restrictions)}`,'error'));
for(const c of neighborhood.claims) block.append(paragraph(`${c.field} · ${printable(c.value)} ${c.unit || ''} · ${c.material_basis || 'UNKNOWN_MATERIAL_BASIS'} · ${c.fact_status} · ${c.claim_id}`,'small'));
for(const g of neighborhood.data_gaps)block.append(paragraph(`Offene Lücke: ${g.gap_type} · ${g.missing_evidence || g.field_path}`,'small'),availabilityDetail(g,neighborhood.public_availability_envelope));
for(const node of neighborhood.entities) { if(node.entity_id===entityId || expandedNeighborhoods.has(node.entity_id))continue; const found=Array.isArray(networkIndex.neighborhoods)?networkIndex.neighborhoods.some(n=>n.entity_id===node.entity_id):Boolean(networkIndex.neighborhoods[node.entity_id]); if(!found)continue; const expand=el('button',`${node.canonical_name} · weiter erkunden`,'secondary');expand.type='button';expand.dataset.networkEntityId=node.entity_id;expand.addEventListener('click',()=>expandNeighborhood(node.entity_id,expand));block.append(expand); }
$('network-neighborhoods').append(block);
button.textContent='Nachbarschaft geladen';
} catch(error){if(request===networkRequest){result=null;networkReport=null;expandedNeighborhoods.clear();$('export-result').disabled=true;$('network-status').textContent=`Netzwerkerweiterung angehalten: ${error.message}`;button.disabled=false;}}
}
async function loadNetwork() {
const request=++networkRequest;
$('load-network').disabled=true;$('network-status').textContent='Netzwerk und Evidence werden geprüft …';
try {
const [index,report]=await Promise.all([fetchPinnedProjection(catalog.network_index),fetchPinnedProjection(catalog.network_summary)]);
if(index.schema_version!=='atlas.copper-network-index/1' || report.schema_version!=='atlas.copper-network-analysis/1') throw new Error('Unbekanntes Netzwerkformat');
if(request!==networkRequest)return;
networkIndex=index;networkReport=report;
const chain=report.chains.find(c=>c.chain_id===graph.meta.chain_id);
if(!chain)throw new Error('Kette fehlt im Netzwerkbericht');
for(const id of ['network-summary','shared-network','network-paths','network-priorities','network-neighborhoods'])$(id).replaceChildren();
$('network-summary').append(paragraph('Teilpfad-Bewertung: bewertet einzelne belegte Teilpfade. Der Dependency-Modus bewertet alle betrachteten Pfade gemeinsam.', 'small'),chip(chain.dependency_readiness),paragraph(`Stand ${report.as_of} · ${chain.known_temporal_paths} datierte relevante Pfade · Ausfallsimulation: ${chain.disruption_simulation_readiness}`),paragraph(chain.reasons.join(' · '),'small'));
const name=id=>entities.get(id)?.canonical_name || (Array.isArray(index.neighborhoods)?index.neighborhoods.find(n=>n.entity_id===id):index.neighborhoods?.[id])?.canonical_name || report.shared_nodes.find(s=>s.entity_id===id)?.canonical_name || id;
for(const shared of report.shared_nodes.filter(s=>s.chain_ids.includes(chain.chain_id))) {
const card=el('div',undefined,'relationship');card.append(chip(shared.type),el('strong',shared.canonical_name),paragraph(`Gemeinsame Ketten: ${shared.chain_ids.join(' · ')} · Mengen: ${shared.quantity_allocation} · Freie Kapazität: UNKNOWN`,'small'));
if(!shared.physical_dependency)card.append(paragraph('Unternehmens- oder Vertragskontext; kein physischer Lieferpfad.','small'));
$('shared-network').append(card);
}
for(const guard of report.record_usage_guards || []) if(graph.claims.some(c=>c.claim_id===guard.claim_id)) $('network-summary').append(paragraph(`Nutzung gesperrt: ${guard.reason} · ${printable(guard.usage_restrictions)}`,'error'));
const chainIds=new Set([chain.root_entity_id,...chain.paths.flatMap(p=>p.entity_ids)]);
for(const alternative of report.alternatives.filter(a=>chainIds.has(a.for_entity_id) || chainIds.has(a.source_entity_id) || chainIds.has(a.origin_entity_id))) { const card=el('div',undefined,'relationship');card.append(chip(alternative.feasibility_status),el('strong',name(alternative.entity_id)),paragraph('Mögliche Alternative · verfügbare Ersatzmenge: UNKNOWN · freie Kapazität: UNKNOWN','small'),paragraph(Object.entries(alternative.dimensions).map(([field,value])=>`${field}: ${value.status}`).join(' · '),'small'),paragraph(alternative.usage_restrictions.join(' · '),'small'));$('shared-network').append(card);}
for(const path of chain.paths) {const line=paragraph(`${path.path_status} · ${path.entity_ids.map(name).join(' → ')} · ${path.product_channel} · [${path.known_interval_intersection.start || 'UNKNOWN'}, ${path.known_interval_intersection.end || 'UNKNOWN'})`,'small');line.dataset.productChannel=path.product_channel;$('network-paths').append(line);}
filterNetworkMaterial();
const gapIds=new Set(chain.gap_ids);
for(const gap of report.prioritized_gaps.filter(g=>gapIds.has(g.gap_id)).slice(0,12))$('network-priorities').append(paragraph(`Informationswert ${gap.value_of_information.score} · ${gap.gap_type} · ${gap.research_status} · ${gap.next_action || gap.field_path} · Bewertung: ${JSON.stringify(gap.value_of_information.dimensions)} · ${gap.value_of_information.rule}`,'small'),availabilityDetail(gap,report.public_availability_envelope));
const chainNodes=index.chains?.find?.(c=>c.chain_id===chain.chain_id)?.entity_ids || index.chains?.[chain.chain_id]?.entity_ids || [...new Set([chain.root_entity_id,...chain.paths.flatMap(p=>p.entity_ids),...report.shared_nodes.filter(s=>s.chain_ids.includes(chain.chain_id)).map(s=>s.entity_id)])];
for(const id of chainNodes) {
if(!index.neighborhoods?.[id] && !Array.isArray(index.neighborhoods))continue;
const button=el('button',`${name(id)} · direkte Beziehungen laden`,'secondary');button.type='button';button.dataset.networkEntityId=id;button.addEventListener('click',()=>expandNeighborhood(id,button));$('network-neighborhoods').append(button);
}
$('network-status').textContent=`${report.gap_summary.open_total} offene Kupferlücken · ${report.gap_summary.resolved} geschlossen · ${report.gap_summary.researched_but_unresolved} recherchiert und noch offen. Weitere Knoten werden nur auf Anfrage geladen.`;
} catch(error){if(request===networkRequest){networkReport=null;networkIndex=null;$('network-status').textContent=`Netzwerk angehalten: ${error.message}`;$('load-network').disabled=false;}}
}
function filterNetworkMaterial(){ const selected=$('network-material')?.value || 'all'; for(const item of $('network-paths').children)item.hidden=selected!=='all' && item.dataset.productChannel!==selected;}
$('network-material')?.addEventListener('change',filterNetworkMaterial);
$('load-network')?.addEventListener('click',loadNetwork);
$('chain-select').addEventListener('change',()=>{
const chain=catalog.chains.find(c=>c.chain_id===$('chain-select').value);
if(chain) loadChain(chain);
});
try {
const response=await fetch('/foundation/v29/copper-catalog.json',{cache:'no-cache'});
if(!response.ok) throw new Error(`Katalog HTTP ${response.status}`);
catalog=await response.json();
if(catalog.schema_version!=='atlas.copper-catalog/1' || !Array.isArray(catalog.chains) || !catalog.chains.length) throw new Error('Ungültiger Kupferkatalog');
const ids=new Set();
for(const chain of catalog.chains){
if(ids.has(chain.chain_id)||!/^\/foundation\/v29\/chains\/[a-z]+\.json$/.test(chain.url)||!Number.isInteger(chain.bytes)||chain.bytes>150000||!/^[a-f0-9]{64}$/.test(chain.projection_sha256))throw new Error('Ungültiger Katalogeintrag');
ids.add(chain.chain_id); const option=el('option',chain.name);option.value=chain.chain_id;$('chain-select').append(option);
}
const query=new URLSearchParams(window.location.search);
const requested=query.get('chain');
const chain=requested?catalog.chains.find(c=>c.chain_id===requested):catalog.chains.find(c=>c.root_entity_id===query.get('entity'))||catalog.chains[0];
if(!chain) throw new Error('Verlinkte Kupferkette ist nicht im Quellenbestand');
$('chain-select').value=chain.chain_id;$('chain-select').disabled=false;
await loadChain(chain,query);
} catch(error){$('load-status').textContent='Kupferkatalog nicht nutzbar. Analyse gesperrt.';showError(error);}

let openDependencyMode;
if ($('dependency-load')) {
$('dependency-load').disabled = !catalog?.dependency_catalog;
$('dependency-load').addEventListener('click', async () => {
$('dependency-load').disabled = true;
try {
if (!openDependencyMode) {
const module = await import('./copper-dependency-ui-v292.mjs');
openDependencyMode = module.createDependencyUI({ $, array, printable, label, el, chip, paragraph, safeUrl, gapEntityIds, catalog });
}
await openDependencyMode();
} catch (error) {
$('dependency-error').textContent = `Dependency-Modus angehalten: ${error.message || printable(error)}`;
$('dependency-error').hidden = false; $('dependency-load').disabled = false;
}
});
}
