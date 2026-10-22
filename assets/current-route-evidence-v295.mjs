const forbiddenNumericUse=new Set(['NO_ORIGIN_SALES_TO_FEED_DMT_CONVERSION','NO_AGGREGATE_SMELTER_FEED_ALLOCATION','NO_SPARE_CAPACITY_FROM_NAMEPLATE_OR_TARGET','NO_QUANTIFIED_DISRUPTION']);
export function assertCurrentRoutePackage(pkg){
  if(pkg?.schema_version!=='atlas.current-route-evidence/29.5.0')throw Error('CURRENT_ROUTE_SCHEMA_MISMATCH');
  if(pkg.release_approved!==false)throw Error('DEV_RELEASE_FLAG_INVALID');
  if(!Array.isArray(pkg.routes)||pkg.routes.length<1||pkg.routes.length>2)throw Error('CURRENT_ROUTE_SELECTION_COUNT_INVALID');
  if(pkg.analysis_as_of!=='2026-10-09')throw Error('ANALYSIS_DATE_MISMATCH');
  for(const route of pkg.routes){
    if(route.reference_period?.start!=='2026-01-01'||route.reference_period?.end!=='2026-07-01')throw Error(`HISTORICAL_AS_CURRENT:${route.route_id}`);
    if(route.material?.commodity!=='COPPER'||route.material?.upstream_form!=='CONCENTRATE'||route.material?.downstream_observed_form!=='ANODE')throw Error(`MATERIAL_BASIS_MISMATCH:${route.route_id}`);
    if(route.source_refs?.length!==1||route.source_refs[0]!=='fqm-q2-2026-mda')throw Error(`BORROWED_SOURCE_SCOPE:${route.route_id}`);
    if(route.actual_delivery_or_feed_quantity!==null||route.genuinely_available_alternative_capacity!==null)throw Error(`UNSUPPORTED_ROUTE_QUANTITY:${route.route_id}`);
    if(route.calculation_eligibility.route_specific_quantity||route.calculation_eligibility.quantified_disruption||route.calculation_eligibility.substitution)throw Error(`UNSAFE_CALCULATION_ELIGIBILITY:${route.route_id}`);
    for(const rule of forbiddenNumericUse)if(!route.usage_restrictions.includes(rule))throw Error(`MISSING_USAGE_GUARD:${route.route_id}:${rule}`);
  }
  for(const update of pkg.public_availability_envelope?.records||[])if(update.research_status!=='RESEARCH_INCOMPLETE'||update.availability_status!=='RESEARCH_INCOMPLETE'||update.access_status!=='PUBLICLY_ACCESSIBLE')throw Error(`FALSE_PUBLIC_AVAILABILITY:${update.gap_id}`);
  return pkg;
}
export function routeEvidenceView(pkg){
  assertCurrentRoutePackage(pkg);
  return pkg.routes.map(route=>({
    route_id:route.route_id,
    status:route.physical_route_status,
    period:`${route.reference_period.start}..${route.reference_period.end}`,
    current_output_evidence:route.current_period_evidence_status,
    feed_quantity:'UNKNOWN',
    alternative_capacity:'UNKNOWN',
    uncertainty_visible:true,
    gap_ids:[...route.data_gap_refs],
    restrictions:[...route.usage_restrictions]
  }));
}
export function availabilityEvidenceView(pkg){
  assertCurrentRoutePackage(pkg);
  return (pkg.public_availability_envelope?.records||[]).map(record=>({
    gap_id:record.gap_id,
    field_path:record.field_path,
    fact_status:record.fact_status,
    research_status:record.research_status,
    availability_status:record.availability_status,
    access_status:record.access_status,
    checked_at:record.checked_at,
    source_ids:[...record.source_ids],
    methods:[...record.methods],
    query_scope:record.query_scope,
    evidence_refs:[...record.evidence_refs],
    locator:record.locator,
    result:record.result,
    recheck_condition:record.recheck_condition,
    usage_restrictions:[...record.usage_restrictions]
  }));
}
export function canQuantifyDisruption(route){return Boolean(route?.calculation_eligibility?.quantified_disruption)&&route.actual_delivery_or_feed_quantity!==null;}
