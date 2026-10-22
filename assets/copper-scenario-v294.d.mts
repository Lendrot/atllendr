export type AdmissionStatus='VERIFIED'|'HISTORICAL_ONLY'|'HYPOTHETICAL_ONLY'|'INSUFFICIENT_EVIDENCE'|'CONFLICT'|'NOT_APPLICABLE';
export const SCENARIO_SCHEMA:'atlas.copper-scenario-input/1';
export const SCENARIO_RESULT_SCHEMA:'atlas.copper-scenario-result/1';
export const ADMISSION_STATUSES:AdmissionStatus[];
export interface ScenarioInput {
 schema_version:'atlas.copper-scenario-input/1'; scenario_id:string; chain_id:string; root_entity_id:string;
 origin:'PREDEFINED_RESEARCH_CASE'|'USER_DEFINED';mode:'HISTORICAL'|'CURRENT'|'HYPOTHETICAL';
 objective:'STRUCTURAL_EXPOSURE'|'QUANTIFIED_DISRUPTION';evaluation_date:string;
 reference_period:{period_type:'CALENDAR_YEAR'|'FISCAL_YEAR'|'QUARTER'|'HALF_YEAR'|'MONTH'|'CUSTOM';period_start:string;period_end:string};
 material:{commodity:string;material_basis:string;product_channel:string}; failure_entity_ids:string[];
 assumptions:{assumption_id:string;kind:'NODE_INTERRUPTION'|'RELATIONSHIP_ACTIVE_IN_PERIOD';fact_status:'ASSUMPTION';record_ids:string[];description:string}[];
}
export interface ScenarioResult { schema_version:'atlas.copper-scenario-result/1';scenario_id:string;chain_id:string;input:ScenarioInput;admission_status:AdmissionStatus;execution_hash:string;calculation_eligibility:{structural_exposure:boolean;quantified_disruption:false;replacement_tonnage:false;status:'STRUCTURAL_ONLY'|'BLOCKED';reasons:string[]};uncertainty_ledger:unknown[];research_priorities:unknown[];provenance:unknown;lineage:unknown; }
export function validateScenarioInput(input:ScenarioInput):true;
export function prepareScenarioContext(graph:unknown,dependency:unknown,options?:{evaluationDate?:string;gapResolutionEvents?:unknown[]}):Promise<unknown>;
export function evaluateScenario(context:unknown,input:ScenarioInput):Promise<ScenarioResult>;
export function scenarioCsv(result:ScenarioResult):string;
