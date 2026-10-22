/** Preserve source rows and phases; never collapse competing ownership percentages. */
const VERIFIED_SEMANTICS=new Set(['OWNS','OPERATES','CONTROLS']);
const SEMANTIC_DERIVATION_RULES=new Map([
 ['EXACT_OWNER_CLAIM_TO_OWNS_V1',{raw_claim_type:'owner',relationship_type:'OWNS'}],
 ['EXACT_OPERATOR_CLAIM_TO_OPERATES_V1',{raw_claim_type:'operator',relationship_type:'OPERATES'}],
 ['EXACT_CONTROL_CLAIM_TO_CONTROLS_V1',{raw_claim_type:'control',relationship_type:'CONTROLS'}],
]);

function ownershipRawId(row){
 const raw=row?.raw_relationship_id??row?.legacy_assertion_id??row?.id;
 if(!raw||!row?.legacy_assertion_id)throw Error('OWNERSHIP_RAW_ID_REQUIRED');
 if(row.raw_relationship_id!=null&&row.raw_relationship_id!==row.legacy_assertion_id)throw Error('CONFLICTING_OWNERSHIP_RAW_IDS');
 if(row.id!=null&&row.id!==raw&&row.id!==row.assertion_id)throw Error('CONFLICTING_OWNERSHIP_PRIMARY_ID');
 if(row.legacy_assertion_id!==raw)throw Error('OWNERSHIP_LEGACY_RAW_ID_MISMATCH');
 return raw;
}

function validateVerifiedEdge(row,edge){
 if(row.semantic_fact_status!=='FACT'||edge.fact_status!=='FACT')throw Error('UNVERIFIED_OWNERSHIP_SEMANTIC_PROMOTION');
 if(edge.source_assertion_id!==row.assertion_id||!edge.evidence_refs?.length||edge.evidence_refs.some(ref=>!row.evidence_refs.includes(ref)))throw Error('BORROWED_OWNERSHIP_EVIDENCE');
 if(!edge.valid_from||!edge.valid_to)throw Error('OWNERSHIP_INTERVAL_REQUIRED');
 if(edge.source_entity_id!==row.from_id||edge.target_entity_id!==row.to_id)throw Error('OWNERSHIP_ASSERTION_ENDPOINT_MISMATCH');
 if(edge.valid_from!==row.valid_from||edge.valid_to!==row.valid_to)throw Error('OWNERSHIP_INTERVAL_MISMATCH');
 if(edge.relationship_type!==row.derived_relationship_type)throw Error('OWNERSHIP_SEMANTIC_TYPE_MISMATCH');
 const rule=SEMANTIC_DERIVATION_RULES.get(edge.derivation_rule_id);
 if(!rule||rule.raw_claim_type!==row.raw_claim_type||rule.relationship_type!==edge.relationship_type)throw Error('UNSUPPORTED_OWNERSHIP_SEMANTIC_PROMOTION');
 if(row.raw_claim_type==='owner_or_operator'&&['OWNS','OPERATES'].includes(edge.relationship_type))throw Error('AMBIGUOUS_OWNER_OPERATOR_PROMOTION');
 if(row.raw_claim_type==='ultimate_parent'&&edge.relationship_type==='CONTROLS')throw Error('ULTIMATE_PARENT_CONTROL_PROMOTION');
 return edge;
}

export function normalizeOwnershipAssertion(row){
 if(!row?.assertion_id||!row?.legacy_assertion_id)throw Error('OWNERSHIP_ASSERTION_ID_REQUIRED');
 const rawRelationshipId=ownershipRawId(row);
 if(!row.source_id||!Number.isInteger(row.source_row)||!row.source_field||!Number.isInteger(row.source_statement_index))throw Error('OWNERSHIP_SOURCE_LOCATOR_REQUIRED');
 if(!Array.isArray(row.derived_relationships)||!Array.isArray(row.evidence_refs))throw Error('OWNERSHIP_LINEAGE_REQUIRED');
 for(const edge of row.derived_relationships.filter(x=>VERIFIED_SEMANTICS.has(x?.relationship_type||x))){
  validateVerifiedEdge(row,edge);
 }
 return {...row,id:row.assertion_id,legacy_assertion_id:rawRelationshipId,raw_relationship_id:rawRelationshipId,raw_claim_type:row.raw_claim_type||row.type};
}

export function buildOwnershipIndex(data){
 const companies=new Map(data.companies.map(c=>[c.id,c]));
 const sources=new Map(data.sources.map(s=>[s.id,s]));
 const byAsset=new Map(),byCompany=new Map(),sameRow=new Map(),byAssertionId=new Map();
 const claims=data.relationships.map(r=>{
  const safe=normalizeOwnershipAssertion(r);
  if(byAssertionId.has(safe.assertion_id))throw Error('DUPLICATE_OWNERSHIP_ASSERTION_ID:'+safe.assertion_id);
  byAssertionId.set(safe.assertion_id,safe);
  const value=safe.share_percent;
  const invalid=safe.share_issue||Number.isFinite(value)&&(value<0||value>100);
  const claim={...safe,share_status:invalid?'INVALID':Number.isFinite(value)?'OBSERVED':'UNKNOWN',conflict:safe.semantic_fact_status==='CONFLICT'};
  const rowKey=[safe.from_id,safe.to_id,safe.raw_claim_type,safe.source_id,safe.source_row,safe.status_at_source].join('|');
  if(!sameRow.has(rowKey))sameRow.set(rowKey,[]);sameRow.get(rowKey).push(claim);
  if(!byAsset.has(safe.to_id))byAsset.set(safe.to_id,[]);byAsset.get(safe.to_id).push(claim);
  if(!byCompany.has(safe.from_id))byCompany.set(safe.from_id,new Set());byCompany.get(safe.from_id).add(safe.to_id);
  return claim;
 });
 let conflictGroups=0;
 for(const group of sameRow.values()){
  const values=new Set(group.filter(c=>c.share_status==='OBSERVED').map(c=>c.share_percent));
  if(values.size>1){conflictGroups++;for(const claim of group)if(claim.share_status==='OBSERVED'){claim.conflict=true;claim.share_status='CONFLICT'}}
 }
 if(data.company_asset_ids)for(const [id,assetIds] of Object.entries(data.company_asset_ids))byCompany.set(id,new Set(assetIds));
 return {companies,sources,byAsset,byCompany,byAssertionId,claims,conflictGroups};
}

export function ownershipContext(index,assetId){
 const claims=index.byAsset.get(assetId)||[];
 const groups=new Map();
 for(const claim of claims){const key=claim.from_id+'|'+claim.type;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(claim)}
 return [...groups].map(([key,rows])=>({key,company:index.companies.get(rows[0].from_id),assetIds:[...(index.byCompany.get(rows[0].from_id)||[])],claims:rows}));
}

export function verifiedOwnershipEdges(index){
 return index.claims.flatMap(input=>{
  const claim=normalizeOwnershipAssertion(input);
  return claim.derived_relationships.filter(edge=>VERIFIED_SEMANTICS.has(edge.relationship_type)).map(edge=>({...validateVerifiedEdge(claim,edge),input_assertion_id:claim.assertion_id}));
 });
}

export function ownershipExportJson(groups){
 const assertions=groups.flatMap(group=>group.claims);
 return JSON.stringify({schema:'atlas.ownership-safe-export.v296-r7/1',assertions,verified_relationships:verifiedOwnershipEdges({claims:assertions})},null,2)+'\n';
}

const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
export function ownershipExportCsv(groups){
 const fields=['assertion_id','legacy_assertion_id','raw_relationship_id','from_id','to_id','raw_claim_type','derived_relationship_type','semantic_fact_status','share_percent','valid_from','valid_to','source_id','source_row','source_field','source_statement_index'];
 return fields.join(',')+'\n'+groups.flatMap(group=>group.claims).map(row=>fields.map(field=>csvCell(row[field])).join(',')).join('\n')+'\n';
}

export function ownershipCacheKey(manifest,chunk){
 if(!manifest?.projection_set_sha256)throw Error('OWNERSHIP_CACHE_LINEAGE_REQUIRED');
 return `${chunk}?v=${manifest.projection_set_sha256}`;
}
