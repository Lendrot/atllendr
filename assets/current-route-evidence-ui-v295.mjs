import {availabilityEvidenceView,routeEvidenceView} from './current-route-evidence-v295.mjs';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function fetchCurrentRouteEvidence(fetcher=fetch){
  const response=await fetcher('/foundation/v29/current-route-evidence/route-evidence-package.json');
  if(!response.ok)throw Error(`CURRENT_ROUTE_FETCH_${response.status}`);
  return response.json();
}
export function renderCurrentRouteEvidence(pkg){
  const routes=routeEvidenceView(pkg).map(r=>`<article data-route-id="${esc(r.route_id)}"><h3>${esc(r.route_id)}</h3><p data-field="status">${esc(r.status)}</p><dl><dt>Current-period evidence</dt><dd>${esc(r.current_output_evidence)}</dd><dt>Reference period</dt><dd>${esc(r.period)}</dd><dt>Route feed quantity</dt><dd data-unknown="true">UNKNOWN</dd><dt>Available alternative capacity</dt><dd data-unknown="true">UNKNOWN</dd></dl><p data-field="restrictions">${r.restrictions.map(esc).join(' · ')}</p></article>`).join('');
  const gaps=availabilityEvidenceView(pkg).map(g=>`<article data-gap-id="${esc(g.gap_id)}"><h3>${esc(g.gap_id)}</h3><dl><dt>Field</dt><dd>${esc(g.field_path)}</dd><dt>Fact status</dt><dd>${esc(g.fact_status)}</dd><dt>Research status</dt><dd>${esc(g.research_status)}</dd><dt>Public availability</dt><dd>${esc(g.availability_status)}</dd><dt>Access</dt><dd>${esc(g.access_status)}</dd><dt>Checked</dt><dd>${esc(g.checked_at)}</dd><dt>Sources</dt><dd>${g.source_ids.map(esc).join(', ')}</dd><dt>Methods</dt><dd>${g.methods.map(esc).join(' · ')}</dd><dt>Scope</dt><dd>${esc(g.query_scope)}</dd><dt>Evidence</dt><dd>${g.evidence_refs.map(esc).join(', ')||'NONE'}</dd><dt>Locator</dt><dd>${esc(g.locator)}</dd><dt>Result</dt><dd>${esc(g.result)}</dd><dt>Recheck</dt><dd>${esc(g.recheck_condition)}</dd><dt>Usage limits</dt><dd>${g.usage_restrictions.map(esc).join(' · ')}</dd></dl></article>`).join('');
  return `${routes}<section id="data-gap-evidence" aria-labelledby="data-gap-evidence-title"><h2 id="data-gap-evidence-title">Data-gap evidence and public availability</h2>${gaps}</section>`;
}
