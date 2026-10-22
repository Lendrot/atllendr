// Lossless audit view: source methods and original record remain distinct from evidence status.
export function auditRecord(edge,sources){
 if(edge.originalFlowId)throw new Error('Auditexport nur für Basisbeziehung; abgeleitete Ansicht ist INFERENCE');
 const refs=edge.source_ids.map(id=>sources.find(s=>s.id===id)).filter(Boolean);
 const data_date=edge.data_date??edge.period?.end??null;
 const source_dates=[...new Set(refs.map(s=>s.published_on).filter(Boolean))];
 return {relation_id:edge.id,subject:edge.from,predicate:edge.relation,object:edge.to,
  evidence_type:edge.evidence,evidence_method:refs.map(s=>({source_id:s.id,method:s.quality})),
  confidence:edge.confidence,source_date:refs.length&&refs.every(s=>s.published_on)&&source_dates.length===1?source_dates[0]:null,data_date,
  unknown_reason:{source_date:refs.some(s=>!s.published_on)?'Veröffentlichungsdatum mindestens einer Quelle UNKNOWN':source_dates.length>1?'Verschiedene Veröffentlichungsdaten; siehe sources':null,data_date:data_date?null:'Datenstichtag nicht belegt; Abrufdatum ist kein Datenstichtag'},
  sources:refs.map(s=>({source_url:s.url,source_name:s.title,source_date:s.published_on,access_date:s.accessed_on,evidence_method:s.quality})),
  audit:edge.audit??null,original:edge};
}
