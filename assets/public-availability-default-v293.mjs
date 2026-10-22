/** Conservative fallback shared by initial Atlas views and the strict overlay. */
export const PUBLIC_AVAILABILITY_SCHEMA = 'ATLAS_PUBLIC_AVAILABILITY_1';
export const PUBLIC_AVAILABILITY_STATUSES = Object.freeze([
  'NOT_RESEARCHED', 'RESEARCH_INCOMPLETE', 'RESEARCHED_NO_PUBLIC_EVIDENCE',
  'PUBLICLY_UNAVAILABLE_CONFIRMED', 'ACCESS_RESTRICTED_OR_PAYWALLED',
  'SOURCE_TEMPORARILY_UNAVAILABLE', 'UNKNOWN_AVAILABILITY',
]);
export const AVAILABILITY_FIELDS = Object.freeze(['gap_id','field_path','source_scope','checked_sources','last_checked','access_status','availability_status','evidence_refs','source_locator','reason','recheck_condition','prohibited_uses']);
const DEFAULT_PROHIBITIONS = Object.freeze(['DO_NOT_INFER_MISSING_VALUE','DO_NOT_TREAT_AS_SOLVED_FACTUAL_GAP','DO_NOT_DOWNGRADE_P0_FOR_SOURCE_ACCESS']);
export const GAP_TYPE_PROHIBITIONS=Object.freeze({UNKNOWN_ROLE:Object.freeze(['NO_CONFIRMED_OWNERSHIP_FACT','NO_OWNERSHIP_AGGREGATION','NO_CONTROL_INFERENCE']),UNKNOWN_PERIOD:Object.freeze(['NO_CAPACITY_CURRENT_TOTAL','NO_CAPACITY_TIME_SERIES','NO_CAPACITY_PRODUCTION_COMPARISON']),UNKNOWN_MATERIAL_BASIS:Object.freeze(['NO_CAPACITY_MATERIAL_AGGREGATION','NO_CAPACITY_CONVERSION','NO_CAPACITY_PRODUCTION_COMPARISON'])});
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const strings=x=>Array.isArray(x)?[...new Set(x.filter(v=>typeof v==='string'&&v.length))].sort():[];
function field(gap){return typeof gap?.field_path==='string'?gap.field_path:typeof gap?.field==='string'?gap.field:null;}
export function conservativeAvailability(gap){
  if(!isObject(gap)||typeof gap.gap_id!=='string'||!gap.gap_id.length)throw new TypeError('Public availability requires an existing stable gap_id');
  const researched=typeof gap.research_status==='string' && !['UNKNOWN','NOT_RESEARCHED'].includes(gap.research_status);
  const status=gap.research_status==='NOT_RESEARCHED'?'NOT_RESEARCHED':researched?'RESEARCH_INCOMPLETE':'UNKNOWN_AVAILABILITY';
  return {
    gap_id:gap.gap_id,field_path:field(gap),source_scope:'RECORDED_SCOPE_UNVERIFIED',
    checked_sources:strings(gap.sources_checked),last_checked:null,access_status:'UNKNOWN',availability_status:status,evidence_refs:[],
    source_locator:gap.original_record_locator??null,
    reason:status==='NOT_RESEARCHED'?'Recorded NOT_RESEARCHED; no field access check evidenced.':status==='UNKNOWN_AVAILABILITY'?'No reconstructable field availability check.':'Research recorded; field scope and access check not independently reconstructable.',
    recheck_condition:gap.next_action??gap.next_research_action??'Obtain reproducible field-bound source/access evidence.',
    prohibited_uses:strings([...DEFAULT_PROHIBITIONS,...(GAP_TYPE_PROHIBITIONS[gap.gap_type]??[]),...(gap.usage_restrictions??[]),...(gap.prohibited_uses??[])]),
  };
}
