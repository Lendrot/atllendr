/** Public-availability metadata is a separate, conservative Knowledge overlay.
 * No availability outcome resolves a factual gap or authorizes missing values.
 * Existing last_checked/source lists are retained on the original research record;
 * without field-bound reproducible observations they are not new access evidence.
 */
import {conservativeAvailability,PUBLIC_AVAILABILITY_SCHEMA,PUBLIC_AVAILABILITY_STATUSES,AVAILABILITY_FIELDS,GAP_TYPE_PROHIBITIONS} from './public-availability-default-v293.mjs';
export {PUBLIC_AVAILABILITY_SCHEMA,PUBLIC_AVAILABILITY_STATUSES,AVAILABILITY_FIELDS,GAP_TYPE_PROHIBITIONS};
const outcomes = Object.freeze({SEARCH_NO_EVIDENCE:'RESEARCHED_NO_PUBLIC_EVIDENCE',PARTIAL_RESEARCH:'RESEARCH_INCOMPLETE',EXPLICIT_NON_PUBLICATION:'PUBLICLY_UNAVAILABLE_CONFIRMED',CONTROLLED_DISCLOSURE:'PUBLICLY_UNAVAILABLE_CONFIRMED',ACCESS_RESTRICTED:'ACCESS_RESTRICTED_OR_PAYWALLED',TEMPORARY_OUTAGE:'SOURCE_TEMPORARILY_UNAVAILABLE'});
const isObject=x=>x!==null && typeof x==='object' && !Array.isArray(x);
const strings=x=>Array.isArray(x)?[...new Set(x.filter(v=>typeof v==='string'&&v.length))].sort():[];
const stable=x=>Array.isArray(x)?`[${x.map(stable).join(',')}]`:isObject(x)?`{${Object.keys(x).sort().map(k=>`${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`:JSON.stringify(x);
const date=x=>{
  if(typeof x!=='string')return false;
  const m=x.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2}))?$/);
  if(!m)return false;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  const calendar=new Date(Date.UTC(y,mo-1,d));
  if(calendar.getUTCFullYear()!==y||calendar.getUTCMonth()!==mo-1||calendar.getUTCDate()!==d)return false;
  if(m[4]!==undefined&&(Number(m[4])>23||Number(m[5])>59||Number(m[6])>59))return false;
  if(m[7]&&m[7]!=='Z'&&(Number(m[7].slice(1,3))>23||Number(m[7].slice(4,6))>59))return false;
  return Number.isFinite(Date.parse(x));
};
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
// Browser-safe synchronous SHA-256. It checks text evidence against pinned bytes,
// not an untrusted `verified:true` flag. The builder additionally checks the file pin.
export function availabilityTextSha256(text) {return availabilityBytesSha256(new TextEncoder().encode(text));}
export function availabilityBytesSha256(bytes) {
  if(!(bytes instanceof Uint8Array))throw new TypeError('SHA input must be bytes');
  const words=[], bits=bytes.length*8;
  for(let i=0;i<bytes.length;i++)words[i>>2]=(words[i>>2]||0)|(bytes[i]<<(24-(i%4)*8));
  words[bits>>5]=(words[bits>>5]||0)|(0x80<<(24-(bits%32)));
  words[((bits+64>>9)<<4)+15]=bits;
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotr=(v,n)=>(v>>>n)|(v<<(32-n));
  for(let offset=0;offset<words.length;offset+=16){
    const w=new Array(64);for(let t=0;t<64;t++){if(t<16)w[t]=words[offset+t]|0;else {const a=w[t-15],b=w[t-2];w[t]=((rotr(a,7)^rotr(a,18)^(a>>>3))+w[t-16]+(rotr(b,17)^rotr(b,19)^(b>>>10))+w[t-7])|0;}}
    let[a,b,c,d,e,f,g,h]=H;
    for(let t=0;t<64;t++){const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+K[t]+w[t])|0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))|0;h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}
    for(const[i,v]of[a,b,c,d,e,f,g,h].entries())H[i]=(H[i]+v)|0;
  }
  return H.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}
function artifactPinValid(s){
  if(typeof s?.artifact_text==='string')return availabilityTextSha256(s.artifact_text)===s.artifact_sha256;
  if(s?.artifact_bytes instanceof Uint8Array)return availabilityBytesSha256(s.artifact_bytes)===s.artifact_sha256;
  if(Array.isArray(s?.artifact_bytes)&&s.artifact_bytes.every(x=>Number.isInteger(x)&&x>=0&&x<=255))return availabilityBytesSha256(Uint8Array.from(s.artifact_bytes))===s.artifact_sha256;
  return false;
}
function field(gap){return typeof gap?.field_path==='string'?gap.field_path:typeof gap?.field==='string'?gap.field:null;}

function verifiedObservations(gap,context){
  if(context===null||context===undefined)return [];
  if(!isObject(context)||!Array.isArray(context.research_observations)||!Array.isArray(context.sources))throw new TypeError('Availability context requires sources and research_observations arrays');
  if(context.research_observations.length&&!date(context.as_of))throw new TypeError('Availability evidence requires a valid immutable actual context.as_of');
  const results=[];
  for(const o of context.research_observations){
    // Unrelated field/entity observations are never borrowed.
    if(o.gap_id!==gap.gap_id||o.field_path!==field(gap))continue;
    const errors=[];
    if(!outcomes[o.outcome])errors.push('unsupported observation outcome');
    if(!date(o.checked_at))errors.push('missing/invalid actual checked_at');
    else if(Date.parse(o.checked_at)>Date.parse(context.as_of))errors.push('checked_at is later than immutable actual as_of');
    if(typeof o.evidence_ref!=='string'||!o.evidence_ref)errors.push('missing evidence_ref');
    if(typeof o.source_locator!=='string'||!o.source_locator.includes('#'))errors.push('missing reproducible source locator');
    if(typeof o.direct_statement!=='string'||!o.direct_statement.trim())errors.push('missing direct source statement');
    const s=context.sources.find(s=>s.source_id===o.source_id);
    if(!s)errors.push('source not in pinned context');
    else {
      if(!hash(s.content_sha256)||typeof s.content!=='string'||availabilityTextSha256(s.content)!==s.content_sha256)errors.push('pinned text hash mismatch');
      if(!hash(s.artifact_sha256)||typeof s.artifact_path!=='string'||!s.artifact_path)errors.push('missing original artifact pin');
      if(!artifactPinValid(s))errors.push('original artifact bytes are absent or fail their pin');
      if(s.artifact_path?.startsWith('/')||s.artifact_path?.split('/').includes('..'))errors.push('unsafe artifact path');
      if(!s.content?.includes(o.direct_statement))errors.push('direct statement absent from pinned text');
      if(o.source_sha256!==s.artifact_sha256)errors.push('original artifact hash mismatch');
      if(!o.source_locator?.startsWith(s.artifact_path+'#'))errors.push('locator does not address pinned artifact');
      if(!Array.isArray(s.field_bindings)||!s.field_bindings.some(b=>b.gap_id===gap.gap_id&&b.field_path===field(gap)))errors.push('source lacks explicit field binding');
    }
    if(['EXPLICIT_NON_PUBLICATION','CONTROLLED_DISCLOSURE'].includes(o.outcome)){
      if(!['PRIMARY_OFFICIAL','REGULATORY','COMPANY_PRIMARY','GOVERNMENT'].includes(s?.source_quality))errors.push('non-public confirmation requires a primary authority');
      if(!/^https:\/\//.test(s?.source_url??''))errors.push('non-public confirmation requires official source URL');
      const statement=o.direct_statement??'';
      const explicitNonPublication=/not\s+publicly\s+(?:published|disclosed|available)|nicht\s+öffentlich\s+(?:veröffentlicht|verfügbar)/i.test(statement);
      // A noun phrase mentioning controlled disclosure cannot establish that it applies.
      // Require an affirmative predicate, then separately reject contrary propositions.
      const affirmativeControlledDisclosure=/\b(?:is|are|remains?)\s+(?:only\s+)?(?:subject\s+to|governed\s+by|under)\s+controlled\s+disclosure\b/i.test(statement);
      if(o.outcome==='CONTROLLED_DISCLOSURE'&&!affirmativeControlledDisclosure)errors.push('controlled disclosure lacks an affirmative applicable predicate');
      if(o.outcome==='EXPLICIT_NON_PUBLICATION'&&!explicitNonPublication)errors.push('statement does not establish explicit non-publication');
      if(/\b(?:not|never)\s+(?:(?:currently|now|actually)\s+)?(?:subject\s+to|governed\s+by|under)\s+controlled\s+disclosure|\b(?:no|without)\s+controlled\s+disclosure|controlled\s+disclosure\s+(?:does\s+not\s+apply|is\s+(?:not\s+applicable|inapplicable))/i.test(statement))errors.push('controlled disclosure is explicitly negated');
      if(/not\s+confidential|\b(?:is|are|was|were|has\s+been|have\s+been)\s+(?:(?:now|currently|fully|already)\s+)*(?:(?:publicly|openly|freely)\s+(?:available|published|disclosed|accessible)|published\b)|current.{0,40}(?:are|is)\s+published/i.test(statement))errors.push('statement contradicts non-publication');
      const scope=o.disclosure_scope;
      if(!isObject(scope)||scope.gap_id!==gap.gap_id||scope.field_path!==field(gap)||scope.period_type!=='POINT_IN_TIME'||scope.observed_at!==o.checked_at)errors.push('non-public assertion lacks exact field/date disclosure scope');
      if(/historical|formerly|previously|in\s+(?:19|20)\d{2}/i.test(o.direct_statement??''))errors.push('historical-only statement cannot establish current field availability');
    }
    if(o.outcome==='ACCESS_RESTRICTED'&& !['AUTHENTICATION_REQUIRED','PAYWALLED','PERMISSION_DENIED'].includes(o.access_status))errors.push('missing observed restriction');
    if(o.outcome==='TEMPORARY_OUTAGE'&&(![408,429,500,502,503,504].includes(o.http_status)||o.access_status!=='TEMPORARILY_UNAVAILABLE'))errors.push('temporary outage requires a reproducible transient HTTP receipt');
    if(o.outcome==='SEARCH_NO_EVIDENCE'){
      if(!Array.isArray(o.checked_sources)||!o.checked_sources.length)errors.push('no-evidence research requires bounded checked source scope');
      else for(const id of o.checked_sources){
        const checked=context.sources.find(s=>s.source_id===id);
        if(!checked||!Array.isArray(checked.field_bindings)||!checked.field_bindings.some(b=>b.gap_id===gap.gap_id&&b.field_path===field(gap)))errors.push('checked source outside pinned field-bound scope');
        else if(typeof checked.content!=='string'||availabilityTextSha256(checked.content)!==checked.content_sha256||!hash(checked.artifact_sha256)||!artifactPinValid(checked))errors.push('checked source lacks valid pinned evidence');
      }
    }
    if(errors.length)throw new Error(`Invalid availability evidence for ${gap.gap_id}: ${errors.join('; ')}`);
    results.push(o);
  }
  return results.sort((a,b)=>Date.parse(a.checked_at)-Date.parse(b.checked_at)||a.evidence_ref.localeCompare(b.evidence_ref));
}
function derive(gap,context){
  const result=conservativeAvailability(gap),observations=verifiedObservations(gap,context);
  if(!observations.length)return result;
  const o=observations.at(-1);
  return {...result,source_scope:'FIELD_BOUND_REPRODUCIBLE_EVIDENCE',checked_sources:strings(observations.flatMap(x=>x.checked_sources??[x.source_id])),last_checked:o.checked_at,
    access_status:o.access_status??(o.outcome==='SEARCH_NO_EVIDENCE'||o.outcome==='PARTIAL_RESEARCH'?'ACCESSIBLE':'UNKNOWN'),availability_status:outcomes[o.outcome],
    evidence_refs:strings(observations.map(x=>x.evidence_ref)),source_locator:o.source_locator,reason:o.direct_statement,
    recheck_condition:o.recheck_condition??'Recheck when source publication, access policy or the target field changes.',
  };
}
/** Returns errors, never mutates the gap or treats availability as factual resolution. */
export function validateAvailability(metadata,gap,context=null){
  const errors=[];
  if(!isObject(metadata))return {valid:false,errors:['missing public availability metadata']};
  for(const k of AVAILABILITY_FIELDS)if(!Object.hasOwn(metadata,k))errors.push(`missing ${k}`);
  if(!PUBLIC_AVAILABILITY_STATUSES.includes(metadata.availability_status))errors.push('invalid availability_status');
  for(const k of ['checked_sources','evidence_refs','prohibited_uses'])if(!Array.isArray(metadata[k]))errors.push(`invalid ${k}`);
  if(metadata.last_checked!==null&&!date(metadata.last_checked))errors.push('invalid last_checked');
  try {const expected=derive(gap,context);if(stable(metadata)!==stable(expected))errors.push('metadata differs from field-bound authority derivation');}catch(e){errors.push(e.message);}
  return {valid:errors.length===0,errors};
}
/** Raw records are accepted for derivation; served metadata, when present, is validated. */
export function availabilityForGap(gap,context=null){
  const expected=derive(gap,context);
  if(Object.hasOwn(gap,'public_availability')){
    const validation=validateAvailability(gap.public_availability,gap,context);
    if(!validation.valid)throw new Error(`Invalid public_availability for ${gap.gap_id}: ${validation.errors.join('; ')}`);
  }
  return expected;
}
export function withPublicAvailability(gap,context=null){return {...gap,public_availability:availabilityForGap(gap,context)};}
