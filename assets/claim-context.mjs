// Bounded, deterministic context for Atlas research agents and UI. No broad dump.
export function retrieveClaimContext(claims,{entityIds=[],relationIds=[],materialIds=[],countryCodes=[],regionCountryCodes=[],maxClaims=25,includeInvalid=false}={}){
 if(!Number.isInteger(maxClaims)||maxClaims<1||maxClaims>100)throw new Error('maxClaims muss zwischen 1 und 100 liegen');
 const entity=new Set(entityIds),relation=new Set(relationIds),material=new Set(materialIds),country=new Set([...countryCodes,...regionCountryCodes]);
 const ranked=[];
 for(const c of claims){
  if(!includeInvalid&&c.validation?.status==='INVALID')continue;
  let tier=null;
  if(relation.has(c.source_record_id)||relation.has(c.id)||entity.has(c.subject)||entity.has(c.object))tier=1;
  else if(material.has(c.material?.id))tier=2;
  else if((c.country_codes||[]).some(code=>country.has(code)))tier=3;
  if(tier!==null)ranked.push({tier,claim:c});
 }
 ranked.sort((a,b)=>a.tier-b.tier||a.claim.id.localeCompare(b.claim.id));
 const selected=ranked.slice(0,maxClaims);
 return {claims:selected.map(x=>x.claim),tiers:selected.map(x=>({claim_id:x.claim.id,tier:x.tier})),total_matches:ranked.length,omitted:Math.max(0,ranked.length-selected.length),priority:['direct entity/relation','asset/material','country/region']};
}
