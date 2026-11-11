// Quellen lesbar anzeigen statt als Kuerzel (Eddie 2026-11-10).
// Daten: quellen-katalog.mjs, erzeugt von scripts/analysis/quellen/quellen_katalog.py --baue.
import geladen from './quellen-katalog.mjs';
// Jede Quelle erscheint als Titel · Herausgeber · Datum mit Link; fehlt eine Angabe, steht "unbekannt" (nie geraten).
const katalog=geladen&&geladen.quellen?geladen:{quellen:{},domains:{}};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sicher=u=>/^https?:\/\//i.test(String(u||''))?String(u):'';
function host(u){try{return new URL(u).hostname.replace(/^www\./,'')}catch{return ''}}
function domainHerausgeber(u){let h=host(u);while(h){if(katalog.domains?.[h])return katalog.domains[h];h=h.includes('.')?h.slice(h.indexOf('.')+1):''}return ''}

// Lesbare Angaben zu einem Kuerzel und/oder Link. url aus dem Datensatz (z. B. mit #page=) hat Vorrang vor dem Katalog-Link.
export function quelleInfo(code,url){
  const k=(code&&katalog.quellen?.[code])||{};
  const link=sicher(url)||sicher(k.url);
  return {code:code||'',titel:k.titel||'',herausgeber:k.herausgeber||(link?domainHerausgeber(link):''),datum:k.datum||'',datum_art:k.datum_art||'',url:link};
}
function datumText(i){if(!i.datum)return 'Datum unbekannt';return (i.datum_art==='abgerufen'?'abgerufen ':'')+i.datum}

// Reiner Text: "Titel · Herausgeber · Datum"
export function quelleText(code,url,ersatz='Quelle'){
  const i=quelleInfo(code,url);
  const titel=i.titel||(i.herausgeber?'':ersatz);
  return [titel,i.herausgeber||'Herausgeber unbekannt',datumText(i)].filter(Boolean).join(' · ');
}
// HTML: verlinkter Titel · Herausgeber · Datum. ersatz = Titel, wenn der Katalog keinen kennt (z. B. "Originalquelle").
export function quelleHtml(code,url,ersatz='Quelle'){
  const i=quelleInfo(code,url);
  const titel=i.titel||ersatz;
  const kopf=i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${esc(titel)}</a>`:esc(titel);
  return `<span class="quelle-lesbar" title="${esc(i.code?'Kennung '+i.code:'')}">${kopf} · ${esc(i.herausgeber||'Herausgeber unbekannt')} · ${esc(datumText(i))}${i.url?'':' · Link unbekannt'}</span>`;
}
// Kurzform fuer Plaketten: "Titel (Herausgeber)"
export function quelleKurz(code,url,ersatz='Altbestand'){
  const i=quelleInfo(code,url);
  if(!i.titel&&!i.herausgeber)return ersatz;
  return i.titel?(i.herausgeber&&!i.titel.includes(i.herausgeber)?`${i.titel} (${i.herausgeber})`:i.titel):i.herausgeber;
}
export const quellenKatalog=()=>katalog;
