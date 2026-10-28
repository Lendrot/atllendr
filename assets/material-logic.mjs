import {materialUseDecision} from './safe-unknown.mjs';
export const metricLabels={production:'Produktion',import:'Import',export:'Export',availability:'Verfügbarkeit',consumption:'Verbrauch / Bedarf',refinery_input:'Raffinerieeinsatz',capacity:'Quellenrohkapazität · UNKNOWN_MATERIAL_BASIS'};
export const unitLabels={million_tonnes:'Mio. t',billion_m3:'Mrd. m³',million_tonnes_per_year:'Mio. t/Jahr'};
export const periodKey=p=>p.start+'/'+p.end;
export const formatQuantity=row=>{
 if(row.quantity===null)return 'Unbekannt';
 if(row.unit==='million_tonnes'&&row.quantity<.01)return new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(row.quantity*1e6)+' t';
 return new Intl.NumberFormat('de-DE',{maximumFractionDigits:3}).format(row.quantity)+' '+unitLabels[row.unit];
};
export const rowsFor=(data,material,period)=>data.observations.filter(r=>r.material_id===material&&periodKey(r.period)===period);
export function nationalMetrics(rows){return rows.filter(r=>r.scope==='national'&&r.metric!=='capacity');}
export function partnerShareTrace(row,rows){
 if(!row?.material_basis||/UNKNOWN|CONFLICT/.test(row.material_basis)||!row.measurement_basis||row.fact_status!=='FACT')return null;
 if(!row?.period?.start||!row.period.end||!unitLabels[row.unit])return null;
 const total=nationalMetrics(rows).find(r=>r.metric===row.metric&&r.material_id===row.material_id&&r.unit===row.unit&&r.period?.start===row.period?.start&&r.period?.end===row.period?.end);
 if(!total||total.fact_status!=='FACT'||total.material_basis!==row.material_basis||total.measurement_basis!==row.measurement_basis)return null;
 const metadata=r=>({...r,material:r.material_id,period_start:r.period?.start,period_end:r.period?.end});
 if(!materialUseDecision(metadata(row),'trade_quantity_share',{comparison:metadata(total),requirePeriod:true}).allowed)return null;
 if(row.scope!=='partner'||!total||!Number.isFinite(row.quantity)||!Number.isFinite(total.quantity)||row.quantity<0||total.quantity<=0||row.quantity>total.quantity)return null;
 const numeratorSources=new Set(row.source_ids),denominatorSources=new Set(total.source_ids);
 return {value:100*row.quantity/total.quantity,formula:'100 × Partnermenge / nationale '+row.metric+'menge',input_ids:[row.id,total.id],input_values:[row.quantity,total.quantity],unit:row.unit,period:row.period,source_ids:[...new Set([...row.source_ids,...total.source_ids])],independent_sources:[...numeratorSources].some(id=>!denominatorSources.has(id))&&[...denominatorSources].some(id=>!numeratorSources.has(id))};
}
export function partnerShare(row,rows){return partnerShareTrace(row,rows)?.value??null;}
export function periodsFor(data,material){return [...new Map(data.observations.filter(r=>r.material_id===material).map(r=>[periodKey(r.period),r.period])).values()].sort((a,b)=>b.end.localeCompare(a.end)||a.start.localeCompare(b.start));}
// ISO numeric IDs used by the existing Natural Earth country topology.
export const numeric={IN:'356',AU:'036',AT:'040',BE:'056',BG:'100',CA:'124',CN:'156',CO:'170',CY:'196',CZ:'203',DE:'276',DK:'208',EE:'233',ES:'724',FI:'246',FR:'250',GR:'300',HK:'344',HR:'191',HU:'348',ID:'360',IE:'372',IT:'380',KZ:'398',LT:'440',LU:'442',LV:'428',MA:'504',MT:'470',MZ:'508',NL:'528',NZ:'554',OM:'512',PL:'616',PT:'620',RO:'642',RU:'643',SA:'682',SE:'752',SG:'702',SI:'705',SK:'703',ZA:'710',CH:'756',TZ:'834',TR:'792',AE:'784',GB:'826',US:'840',BH:'048',BD:'050',BT:'064',KE:'404',KR:'410',MY:'458',NP:'524',TH:'764',NG:'566',GH:'288',SN:'686',GN:'324',CI:'384',SL:'694',ZM:'894',CD:'180',UG:'800',JP:'392',PK:'586',VN:'704',BR:'076',TG:'768'};
const insideRing=(points,x,y)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
// Middle of the widest interior stretch on the centroid's latitude; used when a
// concave outline (e.g. Vietnam) puts the centroid outside the country.
const interiorOnLatitude=(points,y)=>{
 const xs=[];for(let i=0;i<points.length-1;i++){const [ax,ay]=points[i],[bx,by]=points[i+1];if((ay>y)!==(by>y))xs.push(ax+(y-ay)*(bx-ax)/(by-ay));}
 xs.sort((a,b)=>a-b);let best=null;for(let i=0;i+1<xs.length;i+=2)if(!best||xs[i+1]-xs[i]>best[1]-best[0])best=[xs[i],xs[i+1]];
 return best?(best[0]+best[1])/2:null;
};
/** Schematic country anchors, derived from the largest polygon and kept inside it; never a port, mine or company coordinate. */
export function countryAnchor(feature){
 const polygons=feature?.geometry?.type==='Polygon'?[feature.geometry.coordinates]:feature?.geometry?.type==='MultiPolygon'?feature.geometry.coordinates:[];
 const candidates=polygons.map(p=>{
  const ring=p[0];if(!ring?.length)return null;
  const origin=ring[0][0];const points=ring.map(([lon,lat])=>[origin+(((lon-origin+540)%360)-180),lat]);
  let area=0,x=0,y=0;
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],cross=a[0]*b[1]-b[0]*a[1];area+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}
  if(Math.abs(area)<1e-10)return null;
  let cx=x/(3*area);const cy=y/(3*area);
  if(!insideRing(points,cx,cy))cx=interiorOnLatitude(points,cy)??cx;
  return {area:Math.abs(area),lon:((cx+540)%360)-180,lat:cy};
 }).filter(Boolean).sort((a,b)=>b.area-a.area);
 return candidates[0]??null;
}
export function buildTradeLayer(rows,features,direction='all'){
 const entities={},deals=[];
 const names=new Intl.DisplayNames(['de'],{type:'region'});
 function entity(code){
  if(entities[code])return entities[code];
  const feature=features.find(f=>String(f.id).padStart(3,'0')===numeric[code]);const point=countryAnchor(feature);
  const row={id:code,name:names.of(code),country:names.of(code),place:'Schematischer Länderanker',lat:point?.lat??null,lon:point?.lon??null};entities[code]=row;return row;
 }
 for(const row of rows.filter(r=>r.scope==='partner'&&r.quantity>0&&(direction==='all'||r.metric===direction))){
  const from=row.metric==='import'?row.partner_country:'IN',to=row.metric==='import'?'IN':row.partner_country;
  entity(from);entity(to);
  deals.push({id:row.id,buyerId:from,targetId:to,flowKind:row.metric,flowColor:row.metric==='import'?0x71d8ff:0xffb65c,observation:row});
 }
 return {entities,deals};
}
