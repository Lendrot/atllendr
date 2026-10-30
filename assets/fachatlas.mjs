/** Fachatlas mode of the main globe (analysis/FACHATLANTEN.md step D, Eddie 2026-10-28): /atlas/?fach=<id> is the main
 *  globe with every feature, limited to one area. Relations come from the same atlas data (area/subtype filter), sites from
 *  assets/globe-sites.json (one dataset). The Fachatlas page keeps its own tools; nothing here is a separate truth. */
import {escapeHtml as esc} from './map-logic.mjs';
import {GENERATED} from './fachatlas-rohstoffe.mjs';  // scripts/rohstoffe/neuer_rohstoff.py

export const FACHATLANTEN={
 rohstoffwelt:{label:'Rohstoffwelt',area:'resources',subtype:null,sites:'rohstoffwelt',tools:[['/minen/','Rohstoffwelt-Werkzeuge']]},
 kupfer:{label:'Kupfer',area:'resources',subtype:'Kupferkathoden',sites:'kupfer',tools:[['/kupfer/','Kupfer Intelligence'],['/kupfer/markt/','Kupfermarkt']]},
 abfall:{label:'Abfallwirtschaft Europa',area:'waste',subtype:null,sites:'abfall',focus:[50,10,190],tools:[['/abfall/','Abfall-Kennzahlen']]},
 // EPA TRI: no evidenced recipient routes (themen card), so the main globe shows no relations in this Fachatlas.
 anlagen:{label:'EPA-Anlagen',area:null,subtype:null,sites:'anlagen',focus:[39,-97,230],tools:[['/anlagen/','EPA-Anlagen-Recherche']]},
 // Generated commodities (analysis/ROHSTOFF_GENERATOR.md); the generator refuses ids of the built-in entries above.
 ...GENERATED,
};
export function currentFach(search=location.search){
 const id=new URLSearchParams(search).get('fach');
 return Object.hasOwn(FACHATLANTEN,id||'')?{id,...FACHATLANTEN[id]}:null;
}
export function installFachSwitch({host,fach}){
 const root=document.getElementById(host);if(!root)return;
 root.innerHTML=`<nav class="world-switch fach-switch" aria-label="Fachatlas"><a href="/atlas/">Hauptglobus</a><a href="/atlas/?fach=${esc(fach.id)}" aria-current="page">Fachatlas ${esc(fach.label)}</a>${fach.tools.map(([url,label])=>`<a href="${esc(url)}">${esc(label)}</a>`).join('')}</nav>`;
 document.title=`Fachatlas ${fach.label} · Marktatlas`;
}
