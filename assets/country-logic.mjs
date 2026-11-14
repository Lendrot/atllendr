/** Länderansicht (Eddie 2026-11-14): Länder aus world.json, Zuordnung der Standorte und Verbindungen zu einem Land,
 *  Ausfuhren/Einfuhren und Inlandsverbindungen aus den Daten des Globus (assets/globe-sites.json).
 *  Reine Logik ohne DOM, damit sie in Node geprüft werden kann (tests/webgl/specs/globe-country.spec.mjs, analysis/LAENDERANSICHT.md).
 *  Nichts wird geschätzt: Land einer Verbindung = gemeldetes Land des Standorts, nur wenn dort nichts Lesbares steht,
 *  das Land, in dessen Umriss die gemeldete Koordinate liegt. Fehlt beides, bleibt es unbekannt. */

// ISO 3166-1 numerisch -> Alpha-2 für die Länder von world.json (Debian iso-codes, iso_3166-1.json).
const NUM='004:AF,008:AL,010:AQ,012:DZ,016:AS,020:AD,024:AO,028:AG,031:AZ,032:AR,036:AU,040:AT,044:BS,048:BH,050:BD,051:AM,052:BB,056:BE,060:BM,064:BT,068:BO,070:BA,072:BW,076:BR,084:BZ,086:IO,090:SB,092:VG,096:BN,100:BG,104:MM,108:BI,112:BY,116:KH,120:CM,124:CA,132:CV,136:KY,140:CF,144:LK,148:TD,152:CL,156:CN,158:TW,170:CO,174:KM,178:CG,180:CD,184:CK,188:CR,191:HR,192:CU,196:CY,203:CZ,204:BJ,208:DK,212:DM,214:DO,218:EC,222:SV,226:GQ,231:ET,232:ER,233:EE,234:FO,238:FK,239:GS,242:FJ,246:FI,248:AX,250:FR,258:PF,260:TF,262:DJ,266:GA,268:GE,270:GM,275:PS,276:DE,288:GH,296:KI,300:GR,304:GL,308:GD,316:GU,320:GT,324:GN,328:GY,332:HT,334:HM,336:VA,340:HN,344:HK,348:HU,352:IS,356:IN,360:ID,364:IR,368:IQ,372:IE,376:IL,380:IT,384:CI,388:JM,392:JP,398:KZ,400:JO,404:KE,408:KP,410:KR,414:KW,417:KG,418:LA,422:LB,426:LS,428:LV,430:LR,434:LY,438:LI,440:LT,442:LU,446:MO,450:MG,454:MW,458:MY,462:MV,466:ML,470:MT,478:MR,480:MU,484:MX,492:MC,496:MN,498:MD,499:ME,500:MS,504:MA,508:MZ,512:OM,516:NA,520:NR,524:NP,528:NL,531:CW,533:AW,534:SX,540:NC,548:VU,554:NZ,558:NI,562:NE,566:NG,570:NU,574:NF,578:NO,580:MP,583:FM,584:MH,585:PW,586:PK,591:PA,598:PG,600:PY,604:PE,608:PH,612:PN,616:PL,620:PT,624:GW,626:TL,630:PR,634:QA,642:RO,643:RU,646:RW,652:BL,654:SH,659:KN,660:AI,662:LC,663:MF,666:PM,670:VC,674:SM,678:ST,682:SA,686:SN,688:RS,690:SC,694:SL,702:SG,703:SK,704:VN,705:SI,706:SO,710:ZA,716:ZW,724:ES,728:SS,729:SD,732:EH,740:SR,748:SZ,752:SE,756:CH,760:SY,762:TJ,764:TH,768:TG,776:TO,780:TT,784:AE,788:TN,792:TR,795:TM,796:TC,800:UG,804:UA,807:MK,818:EG,826:GB,831:GG,832:JE,833:IM,834:TZ,840:US,850:VI,854:BF,858:UY,860:UZ,862:VE,876:WF,882:WS,887:YE,894:ZM';
export const NUM_A2=Object.fromEntries(NUM.split(',').map(x=>x.split(':')));
// Ländernamen im Datensatz, die weder die englischen noch die deutschen Standardnamen sind (Stand globe-sites.json 2026-11-14).
// Historische Staaten (Deutsches Reich, DDR, Britisch-Hongkong ...) bleiben bewusst ohne Zuordnung: dann zählt die Koordinate.
const ALIAS={'volksrepublik china':'CN','demokratische republik kongo':'CD','dr kongo':'CD','republic of the congo':'CG','elfenbeinkuste':'CI',
 'moldau':'MD','konigreich danemark':'DK','palastina':'PS','kosovo':'XK','czech republic':'CZ','bosnia and herzegovina':'BA','usa':'US','uk':'GB',
 'vereinigte staaten von amerika':'US','turkey':'TR','turkei':'TR','swaziland':'SZ','burma':'MM','congo kinshasa':'CD','congo brazzaville':'CG'};
export const norm=x=>String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();

// Warenverbindungen (es wird etwas geliefert, transportiert oder abgenommen) und Eigentum/Betrieb (keine Ware).
export const WAREN_TYPEN=new Set(['Transport nach','TRANSPORTS_TO','OFFTAKE_AGREEMENT','SUPPLIES','MARKETS_VIA','PROCESSES_AT']);
export const EIGENTUM_TYPEN=new Set(['OWNS','PARTIALLY_OWNS','OPERATES','CONTROLS']);
const BETREIBER_TYPEN=new Set(['OPERATES','OWNS','CONTROLS','PARTIALLY_OWNS']);

/** Länder aus der Topologie: {key, a2, name, nameEn, rings:[[[lon,lat]...]], polys:[[ring...]], bbox:[w,s,e,n], fit:[w,s,e,n], center:[lon,lat]} */
export function countriesFrom(world,topojson,lang='de'){
  const fc=topojson.feature(world,world.objects.countries);
  let names=null;try{names=new Intl.DisplayNames([lang],{type:'region'});}catch{}
  return fc.features.map((f,i)=>{
    const en=f.properties?.name||'',a2=NUM_A2[f.id]||(en==='Kosovo'?'XK':null);
    let de=null;try{de=a2&&names?names.of(a2):null;}catch{}
    if(de===a2)de=null;
    const polys=f.geometry?(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[]):[];
    const c={key:a2||'n'+i,a2,name:de||en,nameEn:en,polys,rings:polys.flat()};
    c.bbox=box(c.rings);c.fit=fitBox(polys);c.center=[(c.fit[0]+c.fit[2])/2,(c.fit[1]+c.fit[3])/2];
    return c;
  }).filter(c=>c.rings.length).reduce((acc,c)=>{
    // Mehrere Flächen mit demselben ISO-Code (z. B. Australien und Ashmore-/Cartierinseln) zu einem Land zusammenführen.
    const prev=c.a2&&acc.find(x=>x.a2===c.a2);
    if(!prev){acc.push(c);return acc;}
    const main=ringArea(prev.polys[0]?.[0]||[])>=ringArea(c.polys[0]?.[0]||[])?prev:c;
    prev.polys=prev.polys.concat(c.polys);prev.rings=prev.polys.flat();prev.nameEn=main.nameEn;prev.bbox=box(prev.rings);prev.fit=fitBox(prev.polys);prev.center=[(prev.fit[0]+prev.fit[2])/2,(prev.fit[1]+prev.fit[3])/2];
    return acc;
  },[]);
}
function box(rings){let w=180,s=90,e=-180,n=-90;for(const r of rings)for(const [x,y] of r){if(x<w)w=x;if(x>e)e=x;if(y<s)s=y;if(y>n)n=y;}return [w,s,e,n];}
const ringArea=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]-r[i][0])*(r[j][1]+r[i][1]);return Math.abs(a/2);};
/** Ausschnitt für die Länderansicht: alle Teilflächen ab 20 % der größten (sonst zeigt Frankreich halb Südamerika),
 *  Längen um die Mitte der größten Fläche gewickelt (Russland, USA über die Datumsgrenze). Ergebnis kann über ±180 hinausgehen. */
export function fitBox(polys){
  if(!polys.length)return [-180,-90,180,90];
  const parts=polys.map(p=>({p,a:ringArea(p[0])*Math.cos(((box([p[0]])[1]+box([p[0]])[3])/2)*Math.PI/180)})).sort((a,b)=>b.a-a.a);
  // Mitte der größten Fläche als Kreismittel der Längen (Ringe an der Datumsgrenze enthalten -180 und 180).
  let sx=0,sy=0;for(const [x] of parts[0].p[0]){sx+=Math.cos(x*Math.PI/180);sy+=Math.sin(x*Math.PI/180);}
  const mid=Math.atan2(sy,sx)*180/Math.PI;
  let w=1e9,s=90,e=-1e9,n=-90;
  for(const {p,a} of parts){if(a<parts[0].a*.2)continue;for(const [x0,y] of p[0]){const x=mid+wrap(x0-mid);if(x<w)w=x;if(x>e)e=x;if(y<s)s=y;if(y>n)n=y;}}
  return [w,s,e,n];
}
export const wrap=d=>((d+540)%360+360)%360-180;
function inRing(x,y,r){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
/** Liegt (lon, lat) im Land? Gerade-ungerade-Regel je Polygon (Außenring minus Löcher). */
export function contains(c,lon,lat){
  const b=c.bbox;if(lat<b[1]||lat>b[3]||lon<b[0]||lon>b[2])return false;
  for(const p of c.polys){if(!inRing(lon,lat,p[0]))continue;let hole=false;for(let k=1;k<p.length;k++)if(inRing(lon,lat,p[k])){hole=true;break;}if(!hole)return true;}
  return false;
}
/** Land unter einem Punkt; last = zuletzt getroffenes Land (Mausbewegung bleibt meist im selben Land). */
export function countryAt(list,lon,lat,last=null){
  if(last&&contains(last,lon,lat))return last;
  for(const c of list)if(contains(c,lon,lat))return c;
  return null;
}
/** Namensauflösung "gemeldetes Land" -> Alpha-2 (englisch, deutsch, ISO-2/-3 und die Aliasliste). */
export function nameIndex(list,lang='de'){
  const idx=new Map(Object.entries(ALIAS));
  let de=null,en=null;try{de=new Intl.DisplayNames([lang],{type:'region'});en=new Intl.DisplayNames(['en'],{type:'region'});}catch{}
  for(const c of list){if(!c.a2)continue;for(const v of [c.a2,c.nameEn,c.name,de?.of(c.a2),en?.of(c.a2)])if(v&&!idx.has(norm(v)))idx.set(norm(v),c.a2);}
  return idx;
}
/** Land eines Standorts: gemeldetes Land, sonst Koordinate im Umriss, sonst null (unbekannt). */
export function makeLocator(list,idx){
  const byA2=new Map(list.filter(c=>c.a2).map(c=>[c.a2,c])),cache=new Map();let last=null;
  return r=>{
    if(!r)return null;
    const k=norm(r.country);let a2=cache.get(k);
    if(a2===undefined){a2=idx.get(k)||null;cache.set(k,a2);}
    if(a2&&byA2.has(a2))return a2;
    if(Number.isFinite(r.lat)&&Number.isFinite(r.lon)){const c=countryAt(list,r.lon,r.lat,last);if(c){last=c;return c.key;}}
    return a2||null;
  };
}

// Transportart nur, wenn der Quellentext sie nennt (Aussage, Notiz) oder ein Endpunkt ein Hafen ist; sonst unbekannt.
const ARTEN=[[/\b(rail|railway|train|bahn|schiene|zug)\b/i,'Schiene'],[/\b(ship|shipped|shipping|vessel|bulk carrier|schiff|verschifft|seeweg)\b/i,'Schiff'],
 [/\b(truck|trucks|road|lkw|straße|strasse)\b/i,'Lkw/Straße'],[/\b(pipeline|rohrleitung)\b/i,'Pipeline'],[/\b(conveyor|förderband|foerderband)\b/i,'Förderband'],[/\b(barge|binnenschiff|river)\b/i,'Binnenschiff']];
const HAFEN=/hafen|port|terminal/i;
export function transportArt(link,info){
  const text=[info?.a,info?.z].filter(Boolean).join(' '),arten=ARTEN.filter(([re])=>re.test(text)).map(a=>a[1]);
  const hafen=[link.from,link.to].filter(r=>r&&HAFEN.test(String(r.kind||''))).map(r=>r.name).filter(Boolean);
  return {arten:[...new Set(arten)],hafen,quelle:text||null};
}

/** Alles für ein Land. links: Verbindungen wie in globe-sites.mjs (from/to = Standorte), info(id) -> link_info,
 *  rows: alle Standorte (Zeilen), locate(r) -> Länderschlüssel, ware(link, info) -> Wort oder null,
 *  betreiber: Map Standort-ID -> [Firmenname] aus Eigentums-/Betriebsverbindungen. */
export function countryReport(key,{rows,links,info,locate,ware}){
  const here=r=>r&&locate(r)===key;
  const sites=rows.filter(here);
  const betreiber=new Map();
  for(const l of links)if(BETREIBER_TYPEN.has(l.type)&&l.from?.name&&l.to?.id){const a=betreiber.get(l.to.id)||[];if(!a.includes(l.from.name))a.push(l.from.name);betreiber.set(l.to.id,a);}
  const inland=[],aus=[],ein=[];
  for(const l of links){
    const f=here(l.from),t=here(l.to);if(!f&&!t)continue;
    const x=info(l.id)||{},waren=WAREN_TYPEN.has(l.type);
    const item={link:l,info:x,ware:waren?ware(l,x):null,tonnen:x.j&&x.j[1]===1?x.j[0]:null,weg:waren?transportArt(l,x):null};
    if(f&&t)inland.push(item);
    else if(!waren)continue;
    else if(f){item.partner=locate(l.to);item.ort=l.from;item.gegen=l.to;aus.push(item);}
    else{item.partner=locate(l.from);item.ort=l.to;item.gegen=l.from;ein.push(item);}
  }
  const firma=r=>{const b=betreiber.get(r.id);return b&&b.length?{name:b[0],weitere:b.slice(1),ueber:r.name,belegt:true}:{name:r.name||'Name unbekannt',standort:true};};
  const gruppen=list=>{
    const m=new Map();
    for(const it of list){const k=it.ware||'unbekannt';const g=m.get(k)||{ware:k,items:[],tonnen:0,mitMenge:0,partner:new Map(),firmen:new Map()};
      g.items.push(it);if(it.tonnen){g.tonnen+=it.tonnen;g.mitMenge++;}
      const p=it.partner||'unbekannt';g.partner.set(p,(g.partner.get(p)||0)+1);
      const fi=firma(it.ort),fk=fi.name;const e=g.firmen.get(fk)||{...fi,tonnen:0,anzahl:0,orte:new Map(),items:[]};
      e.anzahl++;if(it.tonnen)e.tonnen+=it.tonnen;e.orte.set(it.ort.id,it.ort);e.items.push(it);g.firmen.set(fk,e);m.set(k,g);}
    // Rangfolge: belegte Jahresmenge, dann Zahl der Verbindungen. "unbekannt" (Ware nicht genannt) immer zuletzt.
    const rang=(a,b)=>(b.tonnen-a.tonnen)||(b.items.length-a.items.length)||String(a.ware).localeCompare(String(b.ware),'de');
    return [...m.values()].map(g=>({...g,firmen:[...g.firmen.values()].sort((a,b)=>(b.tonnen-a.tonnen)||(b.anzahl-a.anzahl)||a.name.localeCompare(b.name,'de')),
      partner:[...g.partner.entries()].sort((a,b)=>b[1]-a[1])})).sort((a,b)=>(a.ware==='unbekannt')-(b.ware==='unbekannt')||rang(a,b));
  };
  return {key,sites,inland,aus,ein,ausfuhr:gruppen(aus),einfuhr:gruppen(ein)};
}
