// Additive, source-linked claim layer. It never rewrites the Atlas source records.
const relationTypes=new Set(['customs_trade','reported_trade','supply','ownership','financing','deal','modeled_counterflow','deal_value_view','headquarters_statement','material_observation','indicator','derived_share','risk_score']);
// Explicit classifications for IDs and HS headings present in the source files.
const materialForms={coal:'RAW',lignite:'RAW',crude_oil:'RAW',oil_products:'REFINED',natural_gas:'RAW',finished_steel:'PRODUCT','270900':'RAW','270112':'RAW','740311':'REFINED','260600':'RAW','760200':'WASTE','300490':'PRODUCT'};
const forms=new Set(['RAW','REFINED','PRODUCT','WASTE','SECONDARY','UNKNOWN','NOT_APPLICABLE']);
const units=new Set(['kg','%','million_tonnes','billion_m3','million_tonnes_per_year','INR/USD','INR/EUR','UNKNOWN']);
const provenance=new Set(['OBSERVED','CALCULATED','ESTIMATED','UNKNOWN']);
const physical=new Set(['customs_trade','reported_trade','material_observation']);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const materialForm=(id,area)=>id in materialForms?materialForms[id]:area==='waste'?'WASTE':'UNKNOWN';
const refs=(items=[])=>items.filter(Boolean).map(s=>({id:s.id||null,name:s.title||s.publisher||'UNKNOWN',url:s.url||null,source_date:s.published_on||s.publication_date||null,access_date:s.accessed_on||s.accessed_at?.slice(0,10)||null,locator:s.locator||null}));
const period=p=>p?{start:p.start||null,end:p.end||null,label:p.label||null}:null;
const issue=(code,message)=>({code,message});

export function validateClaim(claim){
 const errors=[],reviews=[];
 if(!claim?.id||!claim.subject||!claim.object)errors.push(issue('IDENTITY','Claim-ID und beide Endpunkte sind erforderlich.'));
 if(!relationTypes.has(claim.predicate))errors.push(issue('RELATION_TYPE','Nicht freigegebener Beziehungstyp.'));
 if(!provenance.has(claim.provenance))errors.push(issue('PROVENANCE','Unbekannte Herkunftsklasse.'));
 if(!forms.has(claim.material?.form))errors.push(issue('MATERIAL_FORM','Unbekannte Stoffform.'));
 if(claim.material?.form==='UNKNOWN'&&physical.has(claim.predicate))reviews.push(issue('MATERIAL_FORM_UNKNOWN','Stoffform nicht belegt.'));
 const {value,unit,kind}=claim.measure||{};
 if(value!==null&&value!==undefined){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)errors.push(issue('VALUE_RANGE','Wert muss eine endliche, nicht negative Zahl sein.'));
  if(unit==='UNKNOWN'||(!units.has(unit)&&!(/^[A-Z]{3}$/.test(unit||''))))errors.push(issue('UNIT','Numerischer Wert ohne zugelassene Einheit oder Währung.'));
  if(kind==='share'&&(unit!=='%'||value>100))errors.push(issue('SHARE_RANGE','Anteile benötigen Prozent und liegen zwischen 0 und 100.'));
  if(kind==='mass'&&unit!=='kg'&&unit!=='million_tonnes'&&unit!=='million_tonnes_per_year')errors.push(issue('MASS_UNIT','Massenwert mit falscher Einheit.'));
  if(kind==='money'&&!/^[A-Z]{3}$/.test(unit||''))errors.push(issue('CURRENCY','Geldwert ohne ISO-Währungscode.'));
  if(kind==='volume'&&unit!=='billion_m3')errors.push(issue('VOLUME_UNIT','Volumenwert mit falscher Einheit.'));
  if(claim.provenance==='UNKNOWN')reviews.push(issue('VALUE_UNVERIFIED','Numerischer Wert mit ungeklärter Herkunft.'));
 }else if(claim.provenance!=='UNKNOWN')errors.push(issue('MISSING_VALUE','OBSERVED/CALCULATED/ESTIMATED ohne Wert.'));
 if(claim.period){
  if(!validDate(claim.period.start)||!validDate(claim.period.end)||claim.period.start>claim.period.end)errors.push(issue('PERIOD','Ungültiger oder umgekehrter Bezugszeitraum.'));
 }else reviews.push(issue('PERIOD_UNKNOWN','Bezugszeitraum unbekannt; kein Zeitvergleich.'));
 if(!claim.sources?.some(s=>s.url&&/^https:\/\//.test(s.url)))reviews.push(issue('SOURCE_MISSING','Kein direkt öffnbarer Quellenlink.'));
 if(claim.provenance==='CALCULATED'&&(!claim.calculation?.formula||!claim.calculation?.input_claim_ids?.length))errors.push(issue('FORMULA_MISSING','Berechnung ohne Formel oder Eingangsdaten.'));
 if(claim.provenance==='ESTIMATED'&&!claim.calculation?.assumptions?.length)reviews.push(issue('ASSUMPTION_MISSING','Schätzung ohne Annahmendokumentation.'));
 return {status:errors.length?'INVALID':reviews.length?'REVIEW':'VALID',errors,reviews};
}

function enrich(claim){return {...claim,validation:validateClaim(claim),conflict:null};}
function baseClaim(d,layer,kind,value,unit,field){
 const id=`claim:${d.id}:${kind}`;
 const materialId=d.observation?.material_id||d.material_id||d.commodity_code||null;
 const material={id:materialId,form:materialId?materialForm(materialId,d.area):'NOT_APPLICABLE',classification:d.classification||null,code:d.commodity_code||null,label:d.subtype||null};
 const derived=Boolean(d.originalFlowId||d.dealValueView),calculation=derived?{formula:'IDENTITY_VIEW',input_claim_ids:[`claim:${d.originalFlowId||d.originalDeal?.id}:${kind}`],description:'Identischer Originalwert in einer gesonderten Kartenansicht; keine beobachtete Zahlung.'}:null;
 return enrich({id,source_record_id:d.id,source_collection:d.siteObservation?'india-materials':d.pointOnly?'wikidata-location-snapshot':d.observation?'india-materials':d.isAtlas?'atlas-connections':d.originalDeal?'market-deals':'derived-view',subject:d.buyerId,subject_name:layer.entities[d.buyerId]?.name||null,predicate:d.relationType||d.relation,object:d.targetId,object_name:layer.entities[d.targetId]?.name||null,country_codes:[...new Set([layer.entities[d.buyerId]?.countryCode,layer.entities[d.targetId]?.countryCode].filter(Boolean))],material,measure:{kind,value,unit,field},period:period(d.period),sources:refs(d.refs),provenance:value==null?'UNKNOWN':d.value_basis==='estimated_value'?'ESTIMATED':derived?'CALCULATED':'OBSERVED',evidence_status:d.evidenceStatus||'UNKNOWN',confidence:Number.isFinite(d.confidence)?d.confidence:null,audit_status:d.audit?.status||'NEEDS_RESEARCH',reporting:{scope:d.observation?.scope||null,metric:d.observation?.metric||null,reporter:d.reporter||null,reported_flow:d.reported_flow||null,valuation:d.valuation||null},calculation});
}

export function claimsFromLayer(layer){
 const out=[];
 for(const d of layer.deals){
  let measured=false;
  if(d.quantity_kg!=null){out.push(baseClaim(d,layer,'mass',d.quantity_kg,'kg','quantity_kg'));measured=true;}
  if(d.value!=null&&d.currency){out.push(baseClaim(d,layer,'money',d.value,d.currency,'value'));measured=true;}
  else if(d.originalDeal?.dealValue!=null&&d.originalDeal?.dealCurrency&&!d.dealValueView){out.push(baseClaim(d,layer,'money',d.originalDeal.dealValue,d.originalDeal.dealCurrency,'originalDeal.dealValue'));measured=true;}
  if(d.share_pct!=null){out.push(baseClaim(d,layer,'share',d.share_pct,'%','share_pct'));measured=true;}
  if(!measured)out.push(baseClaim(d,layer,'relation',null,'UNKNOWN',null));
 }
 return out;
}

export function claimsFromMaterials(materials){
 const byId=new Map(materials.sources.map(s=>[s.id,s]));
 return materials.observations.map(r=>{
  const subject=r.scope==='partner'&&r.metric==='import'?'country_'+r.partner_country?.toLowerCase():'country_in';
  const object=r.scope==='partner'&&r.metric==='export'?'country_'+r.partner_country?.toLowerCase():'material_'+r.material_id;
  return enrich({id:`claim:material:${r.id}`,source_record_id:r.id,source_collection:'india-materials',subject,subject_name:subject==='country_in'?'Indien':r.partner_name||null,predicate:'material_observation',object,object_name:materials.materials.find(m=>m.id===r.material_id)?.name||r.material_id,country_codes:[...new Set(['IN',r.partner_country].filter(Boolean))],material:{id:r.material_id,form:materialForm(r.material_id,r.material_id.startsWith('waste_')?'waste':'resources'),classification:null,code:null,label:materials.materials.find(m=>m.id===r.material_id)?.name||r.material_id},measure:{kind:r.unit==='billion_m3'?'volume':'mass',value:r.quantity,unit:r.unit,field:'quantity'},period:period(r.period),sources:refs(r.source_ids.map(id=>byId.get(id))),provenance:'OBSERVED',evidence_status:r.provisional?'UNKNOWN':'FACT',confidence:null,audit_status:'NEEDS_RESEARCH',reporting:{scope:r.scope,metric:r.metric,reporter:'IN',reported_flow:r.metric,valuation:null,breakdown_id:r.scope==='national'?null:[r.name,r.company_id,r.partner_country].filter(Boolean).join('|')||r.id},calculation:null});
 });
}

export function claimsFromIndicators(atlas){
 const byId=new Map(atlas.sources.map(s=>[s.id,s]));
 return atlas.indicators.map(i=>enrich({id:`claim:indicator:${i.id}`,source_record_id:i.id,source_collection:'atlas-indicators',subject:'country_'+i.country.toLowerCase(),subject_name:'Indien',predicate:'indicator',object:'indicator_'+i.id,object_name:i.name,country_codes:[i.country],material:{id:null,form:'NOT_APPLICABLE',classification:null,code:null,label:null},measure:{kind:i.unit==='%'?'share':'indicator',value:i.value,unit:i.unit,field:'value'},period:i.effective_on?{start:i.effective_on,end:i.effective_on,label:i.effective_on}:null,sources:refs(i.source_ids.map(id=>byId.get(id))),provenance:'OBSERVED',evidence_status:i.evidence||'UNKNOWN',confidence:i.confidence??null,audit_status:'NEEDS_RESEARCH',reporting:{scope:'national',metric:i.name,reporter:'IN',reported_flow:null,valuation:null},calculation:null}));
}

const conflictKey=c=>[c.subject,c.predicate,c.object,c.measure.kind,c.measure.unit,c.material.id,c.material.form,c.period?.start,c.period?.end,c.reporting?.metric,c.reporting?.scope,c.reporting?.breakdown_id,c.reporting?.reporter,c.reporting?.reported_flow,c.reporting?.valuation].join('|');
export function markConflicts(claims){
 const groups=new Map();
 for(const c of claims){if(c.measure.value==null||c.validation.status==='INVALID'||c.provenance!=='OBSERVED')continue;const key=conflictKey(c);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
 const conflicting=new Map();
 for(const group of groups.values())if(group.length>1&&new Set(group.map(c=>c.measure.value)).size>1){const ids=group.map(c=>c.id);for(const c of group)conflicting.set(c.id,ids.filter(id=>id!==c.id));}
 return claims.map(c=>conflicting.has(c.id)?{...c,conflict:{status:'CONFLICT',other_claim_ids:conflicting.get(c.id)},audit_status:'CONFLICT'}:c);
}

function numericInput(c){if(!c||c.validation.status!=='VALID'||c.conflict||c.provenance!=='OBSERVED'||!Number.isFinite(c.measure.value))throw new Error('Eingangsclaim nicht validiert, beobachtet und konfliktfrei');}
export function calculateShare(numerator,denominator,{id,label='Anteil am dokumentierten Nenner'}={}){
 numericInput(numerator);numericInput(denominator);
 if(!id||!numerator.period||!denominator.period||numerator.period.start!==denominator.period.start||numerator.period.end!==denominator.period.end)throw new Error('Bezugszeiträume unterscheiden sich oder fehlen');
 if(!numerator.material.id||numerator.material.id!==denominator.material.id||numerator.material.form!==denominator.material.form)throw new Error('Material oder Stoffform verschieden');
 if(numerator.measure.unit!==denominator.measure.unit||numerator.measure.kind!==denominator.measure.kind||denominator.measure.value<=0)throw new Error('Einheit, Messart oder Nenner ungültig');
 if(numerator.measure.value>denominator.measure.value)throw new Error('Zähler größer als Nenner; Vergleichsbasis prüfen');
 const numeratorSources=new Set(numerator.sources.map(s=>s.url).filter(Boolean)),denominatorSources=new Set(denominator.sources.map(s=>s.url).filter(Boolean));
 if(![...numeratorSources].some(url=>!denominatorSources.has(url))||![...denominatorSources].some(url=>!numeratorSources.has(url)))throw new Error('Zwei unabhängige Quellen für Zähler und Nenner erforderlich');
 const value=100*numerator.measure.value/denominator.measure.value;
 const sourceIds=[...new Set([...numerator.sources,...denominator.sources].map(s=>s.url).filter(Boolean))];
 return enrich({id,source_record_id:null,source_collection:'derived-calculation',subject:numerator.subject,subject_name:numerator.subject_name,predicate:'derived_share',object:numerator.material.id,object_name:label,country_codes:numerator.country_codes,material:numerator.material,measure:{kind:'share',value,unit:'%',field:'calculated'},period:numerator.period,sources:[...numerator.sources,...denominator.sources],provenance:'CALCULATED',evidence_status:'INFERENCE',confidence:null,audit_status:'NEEDS_RESEARCH',reporting:{scope:numerator.reporting.scope,metric:label,reporter:numerator.reporting.reporter,reported_flow:null,valuation:null},calculation:{formula:'100 × numerator / denominator',formula_id:'SHARE_V1',input_claim_ids:[numerator.id,denominator.id],input_values:[numerator.measure.value,denominator.measure.value],input_unit:numerator.measure.unit,independent_sources:sourceIds.length>1,assumptions:[],description:'Anteil nur innerhalb identischer Materialform, Einheit und Bezugsperiode; keine Aussage über Unternehmenszahlung oder Liefervertrag.'}});
}

export function calculateRiskScore(inputs,weights,{id,modelVersion='RISK_V1'}={}){
 if(!id||!Array.isArray(inputs)||inputs.length!==3||!Array.isArray(weights)||weights.length!==3||weights.some(w=>!Number.isFinite(w)||w<0)||Math.abs(weights.reduce((a,b)=>a+b,0)-1)>1e-9)throw new Error('Drei Eingaben und explizite Gewichte mit Summe 1 erforderlich');
 if(inputs.map(c=>c?.reporting?.metric).join('|')!=='import_dependency|supplier_concentration|processing_bottleneck'||new Set(inputs.map(c=>c?.id)).size!==3)throw new Error('Drei verschiedene, benannte Risikodimensionen erforderlich');
 inputs.forEach(c=>{if(!c||c.validation.status!=='VALID'||c.conflict||!Number.isFinite(c.measure.value)||c.measure.unit!=='%'||c.measure.value<0||c.measure.value>100)throw new Error('Risiko-Eingaben müssen validierte, konfliktfreie Prozentsätze sein');});
 if(inputs.some(c=>c.period?.start!==inputs[0].period?.start||c.period?.end!==inputs[0].period?.end||c.material.id!==inputs[0].material.id||c.material.form!==inputs[0].material.form))throw new Error('Risikodaten aus verschiedenen Perioden oder Stoffformen');
 const value=inputs.reduce((sum,c,i)=>sum+c.measure.value*weights[i],0),base=inputs[0];
 return enrich({...base,id,source_record_id:null,source_collection:'derived-calculation',predicate:'risk_score',object:'risk_model_'+modelVersion,object_name:'Modellierter Risiko-Score',measure:{kind:'share',value,unit:'%',field:'calculated'},sources:inputs.flatMap(c=>c.sources),provenance:'ESTIMATED',evidence_status:'ASSUMPTION',confidence:null,audit_status:'NEEDS_RESEARCH',calculation:{formula:'Σ (input_i × weight_i)',formula_id:modelVersion,input_claim_ids:inputs.map(c=>c.id),input_values:inputs.map(c=>c.measure.value),weights,assumptions:['Modellgewichte sind vorgegeben; sie sind kein beobachteter Wert.'],description:'Modellwert, keine amtliche Risikoklassifikation.'}});
}

export function buildClaimDataset(layer,materials,atlas){
 const observed=markConflicts([...claimsFromLayer(layer),...claimsFromMaterials(materials),...claimsFromIndicators(atlas)]);
 const derived=[];
 const national=observed.filter(c=>c.source_collection==='india-materials'&&c.reporting.scope==='national'&&c.validation.status==='VALID');
 for(const numerator of national.filter(c=>c.reporting.metric==='import')){
  const denominator=national.find(c=>c.reporting.metric==='availability'&&c.material.id===numerator.material.id&&c.period?.start===numerator.period?.start&&c.period?.end===numerator.period?.end&&c.measure.unit===numerator.measure.unit);
  if(!denominator)continue;
  try{derived.push(calculateShare(numerator,denominator,{id:`claim:share:imports_available:${numerator.material.id}:${numerator.period.start}`,label:'Importanteil an dokumentierter Verfügbarkeit'}));}catch{/* Preserve input claims without a misleading ratio. */}
 }
 return {meta:{schema_version:'1.0.0',claim_count:observed.length+derived.length,derived_count:derived.length,scope:'Additive claims from existing atlas layer, India observations and indicators; original records remain authoritative'},claims:[...observed,...derived]};
}
