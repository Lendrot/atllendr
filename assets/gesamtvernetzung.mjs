/** Gesamtvernetzung (Eddie 2026-11-09): alle Verbindungen auf dem Globus des Hauptatlas zusammen, in Fraktionen zerlegt
 *  (Rohstoff, Kettenstufe, Evidenz, Region) und jede Fraktion einzeln schaltbar, wie im Annahmen-Atlas (/globus/#gesamt).
 *  Nur was der Hauptatlas schon zeichnet: Atlas-Beziehungen (atlas-ui) und Fachatlas-Verbindungen (globe-sites.json).
 *  Keine Annahme kommt hinzu; Evidenz und Prüfstatus stehen so da, wie die Quelle sie führt. Doku analysis/GESAMTVERNETZUNG.md. */
import {vfLegende} from './vf-legende.mjs';

export const STUFEN=['Förderung','Verarbeitung','Handel','Abnehmer','Eigentum & Kapital'];
export const REGIONEN=['Europa','Asien','Afrika','Nordamerika','Südamerika','Ozeanien','ohne Land'];
// Farben wie im Annahmen-Atlas, wo derselbe Rohstoff vorkommt.
export const ROHSTOFFE=[['Kupfer',0xe07a3f],['Kohle',0x9aa5b1],['Erdöl',0x8d6e63],['Bauxit/Aluminium',0x5dade2],['Gold',0xf2c14e],['Lithium',0x2ecc71],
 ['Uran',0xd4e157],['Seltene Erden',0xc79bff],['Graphit',0x6c8ebf],['Schrott',0xff6fa8],['Altpapier',0xa3c46c],['Kunststoffabfälle',0xff9f43],
 ['Sekundärblei/Batterien',0xb07ad8],['Arzneimittel',0xe89cab],['Unternehmen (kein Stoff)',0x69b5ff],['Geld (kein Stoff)',0xc4a1ff],
 // Standort-Vernetzung (Eddie 2026-11-09): Datensatz "standorte" in globe-sites.json (Konzern -> eigene Standorte, OWNS/OPERATES/Tochter) ist eine eigene VF.
 ['Standort-Vernetzung',0x00c2a8],['anderer Stoff',0xd9e5ed]];
const ROH=new Map(ROHSTOFFE.map(([n,c],i)=>[n,{i,c}]));

const K={Europa:'Albanien Belgien Bulgarien Deutschland Dänemark Estland Finnland Frankreich Griechenland Irland Island Italien Kosovo Kroatien Lettland Liechtenstein Litauen Luxemburg Malta Moldau Montenegro Niederlande Nordmazedonien Norwegen Polen Portugal Rumänien Russland Schweden Schweiz Serbien Slowakei Slowenien Spanien Tschechien Ukraine Ungarn Vereinigtes_Königreich Zypern Österreich Germany Belgium France Netherlands Poland Spain Sweden Finland Norway Italy United_Kingdom Austria Switzerland Russia DE BE FR NL PL ES SE FI NO IT GB AT CH RU BG RO',
 Asien:'Afghanistan Bahrain Bangladesch China Volksrepublik_China Georgien Hongkong Sonderverwaltungsregion_Hongkong Indien Indonesien Iran Israel Japan Kambodscha Kasachstan Katar Kirgisistan Laos Malaysia Mongolei Myanmar Nepal Oman Pakistan Philippinen Saudi-Arabien Singapur Südkorea Taiwan Thailand Türkei Usbekistan Vereinigte_Arabische_Emirate Vietnam Indonesia India Japan Kazakhstan Mongolia South_Korea Philippines Hong_Kong CN HK IN ID JP KR SG MY PH KZ MN SA AE TR OM QA',
 Afrika:'Algerien Angola Botswana Burkina_Faso Côte_d’Ivoire Elfenbeinküste DR_Kongo Demokratische_Republik_Kongo Gabun Ghana Guinea Kenia Liberia Libyen Madagaskar Malawi Mali Marokko Mauretanien Mosambik Namibia Niger Nigeria Sambia Senegal Sierra_Leone Simbabwe Sudan Südafrika Tansania Togo Tunesien Uganda Ägypten Äthiopien Zambia Zimbabwe South_Africa Mozambique Tanzania Democratic_Republic_of_the_Congo CD AO ZA MZ NA TZ ZM ZW BW GH GN ML NE NG MA',
 Nordamerika:'Vereinigte_Staaten USA United_States Kanada Canada Mexiko Mexico Guatemala Kuba Jamaika Dominikanische_Republik US CA MX',
 Südamerika:'Argentinien Bolivien Brasilien Chile Ecuador Kolumbien Peru Venezuela Argentina Bolivia Brazil Colombia AR BO BR CL EC CO PE',
 Ozeanien:'Australien Australia Neuseeland New_Zealand Papua-Neuguinea AU NZ PG'};
const KONTINENT=new Map(Object.entries(K).flatMap(([k,ws])=>ws.split(' ').map(w=>[w.replace(/_/g,' '),k])));
// Kanonischer Ländername nur für den Vergleich "gleiches Land?" (ISO-Code, englisch, deutsch -> ein Schlüssel).
const GLEICH=[['Deutschland','Germany','DE'],['Australien','Australia','AU'],['China','Volksrepublik China','CN'],['Hongkong','Sonderverwaltungsregion Hongkong','Hong Kong','HK'],
 ['Vereinigte Staaten','USA','United States','US'],['Kanada','Canada','CA'],['Indonesien','Indonesia','ID'],['Sambia','Zambia','ZM'],['Simbabwe','Zimbabwe','ZW'],
 ['DR Kongo','Demokratische Republik Kongo','Democratic Republic of the Congo','CD'],['Südafrika','South Africa','ZA'],['Mosambik','Mozambique','MZ'],['Tansania','Tanzania','TZ'],
 ['Namibia','NA'],['Angola','AO'],['Singapur','Singapore','SG'],['Chile','CL'],['Peru','PE'],['Argentinien','Argentina','AR'],['Kasachstan','Kazakhstan','KZ'],['Malaysia','MY'],['Südkorea','South Korea','KR'],['Mali','ML']];
const KANON=new Map(GLEICH.flatMap(g=>g.map(n=>[n,g[0]])));
const kanon=land=>KANON.get(land)||land;
const bekannt=land=>land&&!/^(UNKNOWN|unbekannt|weltweit)$/i.test(land);

export function region(land,regionHint){
 if(REGIONEN.includes(regionHint)&&regionHint!=='ohne Land')return regionHint;
 return KONTINENT.get(land||'')||'ohne Land';
}
export function rohstoffAusName(text){
 const t=text||'';
 if(/schrott|Sekundär.*Schrott/i.test(t))return 'Schrott';
 if(/Kupfer|copper/i.test(t))return 'Kupfer';
 if(/Kohle|coal/i.test(t))return 'Kohle';
 if(/Rohöl|Erdöl|crude/i.test(t))return 'Erdöl';
 if(/Bauxit|Alumin/i.test(t))return 'Bauxit/Aluminium';
 if(/Altpapier/i.test(t))return 'Altpapier';
 if(/Kunststoff/i.test(t))return 'Kunststoffabfälle';
 if(/Blei|Batterie/i.test(t))return 'Sekundärblei/Batterien';
 if(/Arzneimittel/i.test(t))return 'Arzneimittel';
 if(/Gold/i.test(t))return 'Gold';if(/Lithium/i.test(t))return 'Lithium';if(/Uran/i.test(t))return 'Uran';if(/Seltene Erden/i.test(t))return 'Seltene Erden';if(/Graphit/i.test(t))return 'Graphit';
 return 'anderer Stoff';
}
const EIGENTUM=/^(OWNS|PARTIALLY_OWNS|OPERATES|CONTROLS|Tochter|SUBSIDIARY_OF)$/;
const FOERDERUNG=/MINE|Mine|CONCENTRATOR/;
const HANDEL=/PORT|TERMINAL|Hafen|Terminal|Logistik/;
const ABNEHMER=/COMPANY|DOWNSTREAM|Unternehmen/;
// Kettenstufe einer Fachatlas-Verbindung, Regel wie im Annahmen-Atlas (werkzeuge/build_gesamtvernetzung.py):
// Handel, wenn ein Ende Hafen/Terminal ist, der Weg ein Transport/Vermarktung ist oder die Länder sicher verschieden sind;
// sonst Förderung (Start ist Mine), Abnehmer (Ziel ist Unternehmen), sonst Verarbeitung. Eigentum ist eine eigene Stufe.
export function stufeLink(type,fromKind,toKind,fromLand,toLand){
 if(EIGENTUM.test(type))return 'Eigentum & Kapital';
 if(/TRANSPORTS_TO|Transport|MARKETS_VIA/.test(type)||HANDEL.test(fromKind)||HANDEL.test(toKind)||(bekannt(fromLand)&&bekannt(toLand)&&kanon(fromLand)!==kanon(toLand)))return 'Handel';
 if(FOERDERUNG.test(fromKind))return 'Förderung';
 if(ABNEHMER.test(toKind))return 'Abnehmer';
 return 'Verarbeitung';
}
export function stufeBeziehung(d){
 if(['customs_trade','reported_trade'].includes(d.relationType))return 'Handel';
 if(d.relationType==='supply')return 'Abnehmer';
 return 'Eigentum & Kapital';
}
export function evidenz(status,audit){return (status||'UNKNOWN')+(audit==='FREIGEGEBEN'?' · freigegeben':'');}

/** Fraktionen einer Atlas-Beziehung (atlas-logic Kante) und einer Fachatlas-Verbindung (globe-sites Link). */
export function fraktionBeziehung(d,entities){
 const from=entities[d.buyerId]||{};
 const roh=d.area==='companies'?'Unternehmen (kein Stoff)':d.area==='money'?'Geld (kein Stoff)':rohstoffAusName(d.subtype);
 return {rohstoff:roh,stufe:stufeBeziehung(d),evidenz:evidenz(d.evidenceStatus),region:region(from.country,from.region)};
}
export function fraktionLink(l){
 const roh=l.dataset.id==='standorte'?'Standort-Vernetzung':l.dataset.id==='rohstoffwelt'?rohstoffAusName(l.from.name+' '+l.to.name):rohstoffAusName(l.dataset.label);
 return {rohstoff:roh,stufe:stufeLink(l.type,l.from.kind,l.to.kind,l.from.country,l.to.country),evidenz:evidenz(l.evidence,l.audit),region:region(l.from.country)};
}

const GRUPPEN=[['rohstoff','Rohstoff'],['stufe','Kettenstufe'],['evidenz','Evidenz'],['region','Region (Start)']];
const num=n=>new Intl.NumberFormat('de-DE').format(n);

/** Knopf "Gesamtvernetzung" neben Standorte/Verbindungen und die dauerhaft sichtbare VF-Legende (vf-legende.mjs, dieselbe Datei wie im
 *  Annahmen-Atlas): Klick auf eine Vernetzungsfraktion schaltet die Gesamtvernetzung ein, zeigt nur diese VF und fährt auf die
 *  Gesamtansicht (engine.home); Menü "+ VF" schaltet weitere hinzu, "Alle" stellt zurück. */
export function attachGesamt({engine,sites,getAtlas,toAtlas,host}){
 const sw=host.querySelector('.sites-toggle .layer-switch');if(!sw||!sites?.allLinks)return null;
 const button=document.createElement('button');button.type='button';button.dataset.gesamt='';button.setAttribute('aria-pressed','false');button.innerHTML='<i class="layer-net"></i>Gesamtvernetzung';sw.append(button);
 const panel=document.createElement('section');panel.className='gesamt-panel';panel.id='gesamt-panel';panel.setAttribute('aria-label','Gesamtvernetzung');host.append(panel);
 const off=Object.fromEntries(GRUPPEN.map(([g])=>[g,new Set()]));
 let kanten=[],aktiv=false,vf=null;
 const an=f=>GRUPPEN.every(([g])=>!off[g].has(f[g]));
 const farbe=f=>ROH.get(f.rohstoff)?.c??0xd9e5ed;
 function sammeln(){
  const atlas=getAtlas(),layer=atlas?.layer;
  const beziehungen=atlas?atlas.drawnEdges().map(d=>({art:'beziehung',id:d.id,f:fraktionBeziehung(d,layer.entities)})):[];
  const links=sites.allLinks.map(l=>({art:'link',link:l,f:fraktionLink(l)}));
  kanten=[...beziehungen,...links];
 }
 function zeichnen(){
  const sicht=kanten.filter(k=>an(k.f));
  const atlas=aktiv?getAtlas():null;
  if(atlas){const erlaubt=new Map(kanten.filter(k=>k.art==='beziehung').map(k=>[k.id,k.f]));atlas.setGesamt({zeigt:id=>{const f=erlaubt.get(id);return !f||an(f);},farbe:id=>{const f=erlaubt.get(id);return f?farbe(f):null;}});}
  if(aktiv)sites.setLinkFilter(l=>{const f=fraktionLink(l);return an(f)?farbe(f):null;});
  panel.querySelector('#gesamt-zahl').textContent=aktiv?`${num(sicht.length)} von ${num(kanten.length)} Verbindungen sichtbar`:'Gesamtvernetzung aus: Klick auf eine VF schaltet sie ein.';
  panel.dataset.sichtbar=String(sicht.length);panel.dataset.gesamt=String(kanten.length);
 }
 function tafel(){
  if(vf)return vf.zeichne();
  panel.innerHTML='<div id="vf-legende"></div><p class="gesamt-zahl" id="gesamt-zahl"></p>'+
   '<p class="gesamt-hinweis">Alle Verbindungen, die der Hauptatlas zeichnet: Atlas-Beziehungen und Fachatlas-Verbindungen. Nur belegte Einträge, keine Annahmen. Farbe = Rohstoff; Evidenz und Prüfstatus wie in der Quelle geführt. Kettenstufe nach Art und Endpunkten, Region = Kontinent des Startpunkts (Regeln in analysis/GESAMTVERNETZUNG.md).</p>';
  vf=vfLegende(panel.querySelector('#vf-legende'),{
   zu:matchMedia('(max-width: 760px)').matches,
   gruppen:()=>{if(!kanten.length)sammeln();const z={};for(const [g] of GRUPPEN){z[g]=new Map();for(const k of kanten)z[g].set(k.f[g],(z[g].get(k.f[g])||0)+1);}
    const ordnung={rohstoff:ROHSTOFFE.map(r=>r[0]),stufe:STUFEN,region:REGIONEN,evidenz:[...z.evidenz.keys()].sort()};
    return GRUPPEN.map(([g,titel])=>({id:g,titel,items:ordnung[g].filter(w=>z[g].get(w)).map(w=>({id:w,name:w,zahl:z[g].get(w),farbe:g==='rohstoff'?'#'+farbe({rohstoff:w}).toString(16).padStart(6,'0'):'#7f93a8'}))}));},
   istAn:(g,w)=>!aktiv||!off[g].has(w),
   schalte:ae=>{if(!aktiv)setze(true);for(const [g,w,on] of ae){if(on)off[g].delete(w);else off[g].add(w);}zeichnen();},
   fokus:()=>engine.home?.()});
 }
 function setze(on){
  aktiv=on;button.setAttribute('aria-pressed',String(on));panel.dataset.aktiv=String(on);document.body.classList.toggle('gesamt-aktiv',on);
  const url=new URL(location.href);if(on)url.searchParams.set('vernetzung','gesamt');else url.searchParams.delete('vernetzung');if(url.href!==location.href)history.replaceState(history.state,'',url);
  if(on){if(!getAtlas())toAtlas();getAtlas()?.showAll();sammeln();tafel();zeichnen();vf.zeichne();engine.setLayers?.({lines:true});sw.querySelector('[data-layer="lines"]')?.setAttribute('aria-pressed','true');}
  else{getAtlas()?.setGesamt(null);sites.setLinkFilter(null);zeichnen();vf.zeichne();}
 }
 button.onclick=()=>setze(!aktiv);
 tafel();if(new URLSearchParams(location.search).get('vernetzung')==='gesamt')setze(true);else zeichnen();
 return {setze,kanten:()=>kanten};
}
