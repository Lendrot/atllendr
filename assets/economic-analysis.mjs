export const economicKinds={
 trade_value:{label:'HANDELSWERT',description:'Zollstatistischer Warenwert; keine beobachtete Zahlung.'},
 deal_value:{label:'TRANSAKTIONSWERT',description:'Veröffentlichter Wert eines M&A-Vorgangs; Zahlungsempfänger und Zahlungszeitpunkt können unbekannt sein.'},
 investment:{label:'INVESTITION',description:'Eigenkapital oder belegte Projektinvestition.'},
 company_revenue:{label:'UNTERNEHMENSUMSATZ',description:'Umsatz eines Unternehmens oder Segments; weder Gewinn noch Länderzufluss.'},
 profit:{label:'GEWINN',description:'Ergebnis eines Unternehmens oder Projekts.'},
 state_payment:{label:'STAATLICHE ZAHLUNG',description:'Belegte Steuer, Abgabe, Royalty, Förderung oder staatliche Finanzierung.'},
 estimated_value:{label:'GESCHÄTZTER WERT',description:'Modellwert mit Methode, Bandbreite und Unsicherheit.'},
 loan_commitment:{label:'FINANZIERUNGSZUSAGE',description:'Zugesagter Kredit; keine bestätigte Auszahlung und keine Investition.'},
};

export function economicKind(row){return economicKinds[row?.value_basis]||null;}

function originalRow(row,layer){
 if(!row?.originalFlowId)return row;
 return layer.deals.find(item=>item.id===row.originalFlowId)||row;
}

function entityName(layer,id){return layer.entities[id]?.name||'UNKNOWN';}

export function economicRecord(row,layer){
 const original=originalRow(row,layer),basis=economicKind(original)||economicKind(row);
 if(!basis||original.value==null||!original.currency)return null;
 const isTrade=original.value_basis==='trade_value';
 if(isTrade){
  return {
   id:original.id,
   open_id:row.originalFlowId?row.id:original.id,
   value_type:basis.label,
   value:original.value,
   currency:original.currency,
   period:original.period,
   physical_from:entityName(layer,original.buyerId),
   physical_to:entityName(layer,original.targetId),
   economic_from:entityName(layer,original.targetId),
   economic_to:entityName(layer,original.buyerId),
   direction_status:'SCHEMATIC_COUNTERVALUE',
   source_evidence:original.evidenceStatus||'UNKNOWN',
   direction_evidence:'INFERENCE',
   payment_observed:false,
   controlling_companies:'UNKNOWN',
   beneficiaries:'UNKNOWN',
   extraction:'UNKNOWN',
   processing:'UNKNOWN',
   end_product:'UNKNOWN',
   source_count:(original.refs||[]).filter(Boolean).length,
   relation:original.relation,
   valuation:original.valuation||'not_specified',
   reporter:original.reporter||null,
   reported_flow:original.reported_flow||null,
   commodity_code:original.commodity_code||null,
   title:original.title,
   original,
  };
 }
 const isFinancing=original.value_basis==='loan_commitment';
 return {
  id:original.id,
  open_id:row.id,
  value_type:basis.label,
  value:original.value,
  currency:original.currency,
  period:original.period,
  physical_from:null,
  physical_to:null,
  economic_from:entityName(layer,original.buyerId),
  economic_to:entityName(layer,original.targetId),
  direction_status:isFinancing?'COMMITMENT_NOT_DISBURSEMENT':'TRANSACTION_VALUE_NOT_PAYMENT_ROUTE',
  source_evidence:original.evidenceStatus||'UNKNOWN',
  direction_evidence:'UNKNOWN',
  payment_observed:false,
  controlling_companies:'UNKNOWN',
  control_applicability:original.relation==='financing'?'NOT_APPLICABLE':'UNKNOWN',
  beneficiaries:'UNKNOWN',
  extraction:'UNKNOWN',
  processing:'UNKNOWN',
  end_product:'UNKNOWN',
  source_count:(original.refs||[]).filter(Boolean).length,
  relation:original.relation,
  valuation:original.valuation||'not_specified',
  reporter:null,
  reported_flow:null,
  commodity_code:null,
  title:original.title,
  original,
 };
}

export function economicInventory(rows,layer){
 const found=new Map();
 for(const row of rows){
  const record=economicRecord(row,layer);
  if(!record)continue;
  const key=record.value_type+'|'+record.id;
  if(!found.has(key)||row.area==='money')found.set(key,record);
 }
 return [...found.values()];
}

export function economicScore(record){
 const data_quality=Math.min(100,(record.source_count?55:0)+(record.value!=null&&record.currency?25:0)+(record.original.locator?20:0));
 const known=value=>value!==null&&value!==undefined&&value!==''&&value!=='UNKNOWN';
 const baseFields=[record.value!=null,Boolean(record.currency),Boolean(record.period),Boolean(record.value_type),record.source_count>0,Boolean(record.original.locator)];
 const economicFields=[known(record.controlling_companies),known(record.beneficiaries),known(record.extraction),known(record.processing),known(record.end_product)];
 const completeness=Math.round(100*[...baseFields,...economicFields].filter(Boolean).length/(baseFields.length+economicFields.length));
 const temporal_comparability=record.period?90:record.original.observed_on?55:0;
 // Country trade and chain membership do not establish a physical route.
 const customs_relation_score=record.relation==='customs_trade' ? Math.round(100*[known(record.physical_from),known(record.physical_to),Boolean(record.period),record.source_count>0,Boolean(record.commodity_code)].filter(Boolean).length/5) : null;
 const physical_route_score=null;
 const physical_route_evidence='UNKNOWN';
 const party_assignment=record.economic_from!=='UNKNOWN'&&record.economic_to!=='UNKNOWN'?85:30;
 const company_assignment=record.original.relation==='customs_trade'?0:known(record.controlling_companies)?85:25;
 const economic_significance=record.payment_observed?95:record.value_type==='HANDELSWERT'?70:record.value_type==='TRANSAKTIONSWERT'?65:record.value_type==='FINANZIERUNGSZUSAGE'?60:40;
 const total=Math.round(data_quality*.25+completeness*.10+temporal_comparability*.15+(physical_route_score??0)*.25+company_assignment*.20+economic_significance*.05);
 return {data_quality,completeness,temporal_comparability,customs_relation_score,physical_route_score,physical_route_evidence,party_assignment,company_assignment,economic_significance,total};
}

export function economicSummary(rows,layer){
 const records=economicInventory(rows,layer);
 const present=new Set(records.map(r=>r.value_type));
 const categories=Object.values(economicKinds).map(kind=>({...kind,present:present.has(kind.label),count:records.filter(r=>r.value_type===kind.label).length}));
 const rankings=new Map();
 for(const record of records){
  const key=[record.value_type,record.currency,record.period?.start||'UNKNOWN',record.period?.end||'UNKNOWN',record.reported_flow||'UNKNOWN'].join('|');
  if(!rankings.has(key))rankings.set(key,{key,value_type:record.value_type,currency:record.currency,period:record.period,reported_flow:record.reported_flow,records:[]});
  rankings.get(key).records.push(record);
 }
 for(const group of rankings.values())group.records.sort((a,b)=>b.value-a.value);
 return {records,categories,rankings:[...rankings.values()].sort((a,b)=>(b.period?.end||'').localeCompare(a.period?.end||'')||a.value_type.localeCompare(b.value_type)),gaps:[
  'Keine Bankzahlungen oder Zahlungskonten im Bestand.',
  'Zollwerte belegen keine einzelnen Unternehmen, Verträge oder Endabnehmer.',
  'Unternehmensumsatz und Gewinn sind im Wirtschaftsmodul nicht erfasst.',
  'Staatliche Zahlungen, Steuern und Royalties sind nicht erfasst.',
  'Gewinnerländer und lokale Wertschöpfung sind ohne getrennte Unternehmens-, Steuer-, Lohn- und Produktionsdaten UNKNOWN.',
 ]};
}
