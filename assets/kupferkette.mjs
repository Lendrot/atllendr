// Kupferkette Ende-zu-Ende (Eddie 2026-11-11): rendert AUSSCHLIESSLICH /kupferkette/kette.json, den Export der Datenbank
// (scripts/analysis/kupferkette/kupferkette.py). Keine weiteren Daten, keine Berechnung von Mengen oder Werten.
// Unbekannte Angaben werden als "unbekannt" mit Grund gezeigt, nie als 0. Eine Datenbasis, zwei Ansichten (Eddie 2026-11-11):
// "Belegt" zeigt nur Ebene BELEGT, "Mit Annahmen" zusaetzlich Ebene ANNAHME, immer als Annahme markiert.
// Ausfall-Simulation: die Ergebnisse stehen fertig in kette.json (`ausfall`, gerechnet von scripts/analysis/kupferkette/ausfall.py);
// die Seite rechnet nichts nach, sie zeigt nur die Ansicht, die zum Umschalter passt.
// Ausweichquellen (Abnahmeliste "kontaktreif", Punkt 7): eigene Punkte auf dem Globus (türkis), Name und Bogen erscheinen, sobald
// das Glied oder die Ausweichquelle gewählt ist. Ein Bogen Glied -> Ausweichquelle heißt "könnte ersetzen", nicht "liefert".
// Risiko-Ebene (Abnahmeliste "kontaktreif", Punkt 8): ein-/ausschaltbar; je Glied vier Kategorien (Länderrisiko, Sanktionen,
// Naturgefahren, Konzentration). Farbe = Belegstand, nie Schwere: belegt am Standort/an der Firma, belegt nur auf Landesebene,
// Annahme (nur "Mit Annahmen") oder unbekannt. Die Seite bewertet nichts; Texte und Zitate stehen fertig in kette.json.
// Eigentümerkette (Abnahmeliste "kontaktreif", Punkt 4): je Glied ein aufklappbarer Baum bis zur obersten Gesellschaft bzw. zum
// letzten Eigentümer. Baum, effektive Anteile und Status rechnet kupferkette.py; die Seite zeigt sie nur. Endet die Kette ohne
// Beleg, steht "endet ohne Beleg" mit Grund da (UNKNOWN bleibt UNKNOWN). Annahmen gibt es in der Eigentümerkette nicht.
// Gesprächsausdruck (Abnahmeliste "kontaktreif", Punkt 10): Knopf "PDF erzeugen" baut im Browser ein PDF mit 2 Seiten aus derselben
// kette.json (Modul kupferkette-pdf.mjs, erst beim Klick geladen). Ansicht = Umschalter; Ausfall-Glied = Auswahl im Kasten.
// Menge und Wert je Bogen (Abnahmeliste "kontaktreif", Punkte 2, 5, 9): jeder Bogen trägt ein Schild mit Tonnen/Jahr und Euro/Jahr.
// "Belegt": nur Werte, die eine Quelle nennt, sonst "unbekannt" (Länderstrom als Obergrenze daneben). "Mit Annahmen": Menge aus dem
// Annahmen-Atlas, Wert als Rechnung Menge × LME-Kasse ÷ EZB-Kurs; Formel und Datenstand stehen fertig in kette.json (wert, rechnung).
import * as THREE from 'three';
import {OrbitControls} from './three/OrbitControls.js';

const FARBE = {VERARBEITUNG: 0xe39b3c, TRANSPORT: 0x38a8e0, HANDEL: 0x9a7fd6, LIEFERUNG: 0xe8643c};
const FARBE_ANNAHME = 0xd9dee3;
const FARBE_ALT = 0x26c6da;
const BEZUG_TEXT = {BELEGTE_BEZIEHUNG: 'belegte Beziehung zur Kette', GLEICHE_ART: 'gleiche Art, keine belegte Beziehung zur Kette'};
const ART_TEXT = {VERARBEITUNG: 'Weiterverarbeitung (Lieferbeziehung)', TRANSPORT: 'Transport', HANDEL: 'Handel (Verkauf)', LIEFERUNG: 'Lieferung'};
const FREIGABE_TEXT = {FREIGEGEBEN: 'freigegeben', KANDIDAT: 'Kandidat, nicht freigegeben', UNKNOWN: 'unbekannt', ANNAHME: 'nicht belegt'};
const EVIDENZ_TEXT = {FACT: 'Fakt laut Quelle', INFERENCE: 'Schlussfolgerung', CONFLICT: 'Quellen widersprechen sich', UNKNOWN: 'unbekannt', ANNAHME: 'Annahme',
  RECHNUNG: 'Rechnung aus belegten Werten', ABGLEICH: 'Abgleich mit gelesener Liste'};
const UMFANG_TEXT = {DIREKT: 'direkter Anteil', INDIREKT: 'indirekter Anteil (nicht zu direkten addieren)', ZUGEHOERIG: 'zugehörig laut Quelle',
  AKTIONAER: 'Aktionär', AKTIONAERSSTRUKTUR: 'Aktionärsstruktur'};
const prozent = a => a === null ? '' : ` ${zahl(a)} %`;
const konf = k => k.toLocaleString('de-DE', {minimumFractionDigits: 2});
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const zahl = w => Number(w).toLocaleString('de-DE', {maximumFractionDigits: 2});
const $ = id => document.getElementById(id);
// Anzeige-Nummer je Glied: gleiche Stufe (parallele Glieder) -> 5a, 5b
let NR = {};
const nr = s => NR[s.id] || String(s.stufe);
function nummern(daten) {
  const st = {};
  for (const s of daten.standorte) (st[s.stufe] ||= []).push(s);
  NR = Object.fromEntries(daten.standorte.map(s => [s.id, st[s.stufe].length > 1 ? `${s.stufe}${'abcdefgh'[st[s.stufe].indexOf(s)]}` : String(s.stufe)]));
}
const status = {geladen: false, knoten: 0, boegen: 0, boegen_sichtbar: 0, auswahl: null, ansicht: 'belegt', ausfallModus: false, rot: [], alt_knoten: 0, alt_sichtbar: [], alt_boegen: 0, kompakt: false, buendel: [], schilder_gezeigt: [],
  risiko: false, risikoKat: 'ALLE', risiko_ringe: 0, risiko_marken: 0};
// Risiko-Ebene: Status je Feld fuer die aktuelle Ansicht (BS = belegt am Standort/an der Firma, BL = belegt nur Landesebene, A = Annahme, U = unbekannt)
const RS = {BS: ['belegt', 'rs-bs', 0xe53935], BL: ['belegt (Land)', 'rs-bl', 0xffa726], A: ['Annahme', 'rs-a', 0xb0bec5], U: ['unbekannt', 'rs-u', 0x8a5a00]};
const RE_BEZUG = {STANDORT: 'Am Standort', LAND: 'Landesebene', FIRMA: 'Firma'};
const MATRIX_KOPF = {LAENDERRISIKO: 'Länder', SANKTIONEN: 'Sanktion', NATURGEFAHREN: 'Natur', KONZENTRATION: 'Konzentr.'};
const RS_KURZ = {BS: 'belegt', BL: 'Land', A: 'Annahme', U: 'unbekannt'};
const RE_KURZ = {LAENDERRISIKO: 'L', SANKTIONEN: 'S', NATURGEFAHREN: 'N', KONZENTRATION: 'K'};
function feldStatus(f) {
  if (f.belegt.length) return f.belegt.some(e => e.bezug !== 'LAND') ? 'BS' : 'BL';
  return status.ansicht === 'annahmen' && f.annahmen.length ? 'A' : 'U';
}
const rang = st => ['U', 'A', 'BL', 'BS'].indexOf(st);
function gliedStatus(s) {   // bester Belegstand ueber die gewaehlte(n) Kategorie(n)
  const ks = status.risikoKat === 'ALLE' ? Object.keys(s.risikoebene) : [status.risikoKat];
  return ks.map(k => feldStatus(s.risikoebene[k])).sort((a, b) => rang(b) - rang(a))[0];
}
const rsChip = st => `<span class="rs ${RS[st][1]}" data-rs="${st}">${esc(RS[st][0])}</span>`;
const zeigen = o => status.ansicht === 'annahmen' || o.ebene !== 'ANNAHME';
window.__kupferkette = status;

function wertText(m) {
  if (m.wert === null) return `<span class="unbekannt">unbekannt</span>`;
  const w = m.wert_von !== null ? `rund ${zahl(m.wert)} (${zahl(m.wert_von)} bis ${zahl(m.wert_bis)})`
    : m.wert_bis !== null ? `${zahl(m.wert)} bis ${zahl(m.wert_bis)}` : (m.ebene === 'ANNAHME' ? 'rund ' : '') + zahl(m.wert);
  return `${w} ${esc(m.einheit || '')}`;
}
const lm = (v, g, e) => v.mengen.find(m => m.groesse === g && m.ebene === e);
const kurzZahl = w => Number(w).toLocaleString('de-DE', {maximumFractionDigits: w >= 100 ? 0 : 1});
// Menge und Wert eines Bogens für die aktuelle Ansicht: {menge, wert, obergrenze, art: 'B' belegt | 'A' Annahme | 'U' unbekannt}
function bogenWerte(v) {
  const an = status.ansicht === 'annahmen', aus = (g, kurz) => {
    const b = lm(v, g, 'BELEGT'), a = lm(v, g, 'ANNAHME');
    const k = m => g === 'LIEFERWERT' ? `${kurzZahl(m.wert)} Mio. €/a` : (m.einheit || '').startsWith('kt') ? `${kurzZahl(m.wert)} kt/a` : `${kurzZahl(m.wert)} ${m.einheit}`;
    if (b && b.wert !== null) return {m: b, art: 'B', text: kurz ? k(b) : wertText(b)};
    if (an && a) return {m: a, art: 'A', text: kurz ? `≈ ${k(a)}` : wertText(a)};
    return {m: b, art: 'U', text: 'unbekannt'};
  };
  const og = lm(v, 'LAENDERSTROM_MENGE', 'BELEGT'), ow = lm(v, 'LAENDERSTROM_WERT', 'BELEGT');
  return {menge: aus('LIEFERMENGE'), wert: aus('LIEFERWERT'), kurzMenge: aus('LIEFERMENGE', true), kurzWert: aus('LIEFERWERT', true), og, ow};
}
function schildText(v) {   // Schild am Bogen: kurz, Ansicht beachten
  const w = bogenWerte(v), t = x => x.art === 'U' ? '?' : x.text;
  const mm = w.kurzMenge.art === 'U' ? 'Menge ?' : t(w.kurzMenge), ww = w.kurzWert.art === 'U' ? 'Wert ?' : t(w.kurzWert);
  return {text: `${mm} · ${ww}${w.og && w.kurzMenge.art !== 'B' ? ` (≤ ${kurzZahl(w.og.wert / 1000)} kt ${esc(w.og.einheit.split(' ').pop())})` : ''}`,
          art: w.kurzMenge.art === 'B' || w.kurzWert.art === 'B' ? 'B' : w.kurzMenge.art === 'A' || w.kurzWert.art === 'A' ? 'A' : 'U'};
}
function rechnungHtml(m, daten) {
  if (!m.rechnung) return '';
  const r = m.rechnung, Q = daten.quellen, q = id => `<a href="${esc(Q[id].url)}" target="_blank" rel="noopener">${esc(Q[id].herausgeber)}</a>`;
  return `<div class="rechnung" data-rechnung><b>Rechnung (keine Quelle nennt den Wert):</b> ${esc(r.text)}<br><small>${esc(r.formel)}</small><br>`
    + `<small>LME-Kasse ${esc(zahl(r.preis_usd_t))} US$/t, Handelstag ${esc(r.preis_datum)} (${q(r.quellen[0])}) · EZB-Referenzkurs ${esc(String(r.kurs_usd_je_eur).replace('.', ','))} US$ je €, ${esc(r.kurs_datum)} (${q(r.quellen[1])})</small></div>`;
}
function zeitraum(m) { return m.zeitraum ? `${m.zeitraum[0]} bis ${m.zeitraum[1]}` : ''; }
function chips(o) {
  if (o.ebene === 'ANNAHME') return `<span class="chip a">Annahme · ${esc(o.annahme.art)} · Konfidenz ${konf(o.annahme.konfidenz)}</span>`;
  const f = o.freigabe === 'FREIGEGEBEN' ? 'f' : o.freigabe === 'KANDIDAT' ? 'k' : '';
  return `<span class="chip">${esc(EVIDENZ_TEXT[o.evidenz] || o.evidenz)}</span><span class="chip ${f}">${esc(FREIGABE_TEXT[o.freigabe] || o.freigabe)}</span>`;
}
function belegeHtml(belege, quellen) {
  if (!belege.length) return '<p class="ub"><span class="unbekannt">Quelle: unbekannt</span></p>';
  return belege.map(b => {
    const q = quellen[b.quelle];
    const rolle = b.rolle === 'gegenprobe' ? 'Gegenprobe' : b.rolle === 'zusatzbeleg' ? 'Zusatzbeleg' : 'Beleg';
    return `<blockquote data-beleg>„${esc(b.zitat)}“<cite>${rolle} · Zitat aus: <a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.herausgeber)}: ${esc(q.titel)}</a>`
      + `${q.veroeffentlicht ? ` · veröffentlicht ${esc(q.veroeffentlicht)}` : ''} · gelesen ${esc(q.abgerufen)}${b.fundstelle ? ` · ${esc(b.fundstelle)}` : ''}</cite></blockquote>`;
  }).join('');
}
function annahmeHtml(a, quellen) {
  const q = quellen[a.quelle];
  return `<blockquote class="annahme" data-annahme>${esc(a.begruendung)}<cite>Annahme ${esc(a.id)} (${esc(a.art)}, Konfidenz ${konf(a.konfidenz)}) · `
    + `<a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.herausgeber)}</a>, Stand ${esc(q.veroeffentlicht)} · nicht belegt, nicht freigegeben</cite></blockquote>`;
}
function mengeHtml(m, quellen, daten) {
  if (m.ebene === 'ANNAHME' && m.rechnung) return `<div class="annahme-box" data-annahme-wert><b>${esc(m.groesse_text)} (Rechnung aus Annahme):</b> ${wertText(m)} ${chips(m)}`
    + `${rechnungHtml(m, daten)}${annahmeHtml(m.annahme, quellen)}</div>`;
  if (m.ebene === 'ANNAHME') return `<div class="annahme-box" data-annahme-menge><b>${esc(m.groesse_text)} (Annahme):</b> ${wertText(m)} ${chips(m)}`
    + `<div class="hinweis">${esc(m.freigabe_herkunft || '')}</div>${annahmeHtml(m.annahme, quellen)}</div>`;
  if (m.wert === null) return `<div class="ub" data-unbekannt><b>${esc(m.groesse_text)}:</b> <span class="unbekannt">unbekannt</span><br>${esc(m.grund_unbekannt)}</div>`;
  return `<div><b>${esc(m.groesse_text)}:</b> ${wertText(m)}${m.zeitraum ? ` <small>(${esc(zeitraum(m))})</small>` : ''} ${chips(m)}`
    + `<div class="hinweis">${esc(m.freigabe_herkunft || '')}</div>${belegeHtml(m.belege, quellen)}</div>`;
}

function gliedAnnahmenHtml(x, quellen) {   // nur "Mit Annahmen": Annahme für ein Feld, das belegt nur Kandidat ist
  if (status.ansicht !== 'annahmen' || !x.annahmen_glied?.length) return '';
  return x.annahmen_glied.map(g => `<div class="annahme-box" data-annahme-glied="${esc(g.feld)}"><b>${esc(g.feld_text)} (Annahme):</b> ${esc(g.text)} `
    + `<span class="chip a">Annahme · ${esc(g.annahme.art)} · Konfidenz ${konf(g.annahme.konfidenz)}</span>${annahmeHtml(g.annahme, quellen)}</div>`).join('');
}
function eigentumHtml(s, quellen) {
  if (!s.eigentum.length) return `<div class="ub" data-unbekannt><b>Eigentümer:</b> <span class="unbekannt">unbekannt</span><br>${esc(s.eigentum_unbekannt || 'Keine gelesene Quelle nennt einen Eigentümer.')}</div>`;
  return s.eigentum.map(e => `<div data-eigentum><b>${esc(e.eigentuemer)}</b>${prozent(e.anteil)} <small>(${esc(UMFANG_TEXT[e.umfang] || e.umfang)}, Stand ${esc(e.stand)})</small> ${chips(e)}`
    + `<div class="hinweis">${esc(e.freigabe_herkunft)}${e.einschraenkung ? ` · ${esc(e.einschraenkung)}` : ''}</div>${belegeHtml(e.belege, quellen)}</div>`).join('');
}
const EK_CHIP = {VOLLSTAENDIG_FREIGEGEBEN: 'f', VOLLSTAENDIG_KANDIDAT: 'k', OFFEN: 'u', UNBEKANNT: 'u'};
const EK_SCHLUSS_CHIP = {ENDE: 'f', OBERSTE: 'f', GESCHLOSSEN: '', OFFEN: 'u', UNTER_SCHWELLE: 'a'};
const ekProzent = a => a === null ? '' : `${zahl(a)} %`;
function ekBaumHtml(ek, b, quellen, stufe = 0) {
  const k = ek.knoten[b.knoten], e = b.kante ? ek.kanten.find(x => x.id === b.kante) : null;
  const anteil = e ? (e.anteil !== null ? `${ekProzent(e.anteil)} ${esc(e.mass_text)}` : esc(e.text || 'Anteil nicht genannt')) : '';
  const eff = e && b.effektiv !== null && stufe > 1 ? ` <small>(durchgerechnet ${ekProzent(b.effektiv)})</small>` : '';
  const kopf = `<b>${esc(k.name)}</b> <small>${esc(k.art_text)}${k.land ? ' · ' + esc(k.land) : ''}${k.lei ? ' · LEI ' + esc(k.lei) : ''}</small>`
    + (e ? ` <span data-ek-anteil>${anteil}</span>${eff}` : '') + ` <span class="chip ${EK_SCHLUSS_CHIP[b.schluss]}" data-ek-schluss="${esc(b.schluss)}">${esc(b.schluss_text)}</span>`
    + (e ? ` <span class="chip ${e.freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}">${esc(FREIGABE_TEXT[e.freigabe])}</span>` : '');
  const infos = [];
  if (e) infos.push(`<div class="hinweis">${e.text && e.anteil !== null ? esc(e.text) + ' · ' : ''}Stand ${esc(e.stand)} · ${esc(e.freigabe_herkunft)}${e.einschraenkung ? ` · ${esc(e.einschraenkung)}` : ''}</div>`
    + `<details class="ek-belege"><summary>Beleg Anteil (${e.belege.length})</summary>${belegeHtml(e.belege, quellen)}</details>`);
  if (k.oberste) infos.push(`<div class="hinweis"><b>Oberste Gesellschaft:</b> ${esc(k.oberste.text)} <span class="chip ${k.oberste.freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}" data-ek-oberste-freigabe>${esc(FREIGABE_TEXT[k.oberste.freigabe])}</span>${k.oberste.freigabe_herkunft ? ` · ${esc(k.oberste.freigabe_herkunft)}` : ''}</div>`
    + `<details class="ek-belege"><summary>Beleg oberste Gesellschaft (${k.oberste.belege.length})</summary>${belegeHtml(k.oberste.belege, quellen)}</details>`);
  if (k.belege.length) infos.push(`<details class="ek-belege"><summary>Beleg ${esc(k.art_text)} (${k.belege.length})</summary>${belegeHtml(k.belege, quellen)}</details>`);
  if (k.hinweis) infos.push(`<div class="hinweis">${esc(k.hinweis)}</div>`);
  if (b.schluss === 'OFFEN' || b.schluss === 'UNTER_SCHWELLE') infos.push(`<div class="ub" data-unbekannt><b>Eigentümer:</b> <span class="unbekannt">unbekannt</span><br>${esc(k.offen || 'Keine gelesene Quelle nennt die Eigentümer.')}</div>`);
  const kinder = b.kinder.map(c => ekBaumHtml(ek, c, quellen, stufe + 1)).join('');
  return `<details class="ek" data-ek-knoten="${esc(b.knoten)}" data-pflicht="${b.pflicht}"${stufe < 2 || (b.pflicht && stufe < 4) ? ' open' : ''}><summary>${kopf}</summary>`
    + `<div class="ek-inhalt">${infos.join('')}${kinder ? `<div class="ek-kinder">${kinder}</div>` : ''}</div></details>`;
}
function eigentumsketteHtml(daten, s) {
  const ek = daten.eigentumskette; if (!ek) return '';
  const g = ek.glieder[s.id], Q = daten.quellen;
  let h = `<div data-eigentumskette="${esc(s.id)}" data-ek-status="${esc(g.status)}"><p><span class="chip ${EK_CHIP[g.status]}">${esc(g.status_text)}</span>`
    + `${g.ebenen ? ` <small>${g.ebenen} Ebene${g.ebenen > 1 ? 'n' : ''} über dem Glied · Pflichtpfade ab ${zahl(ek.schwelle_prozent)} % durchgerechnetem Anteil</small>` : ''}</p>`;
  if (!g.baum) h += `<div class="ub" data-unbekannt><b>Eigentümer:</b> <span class="unbekannt">unbekannt</span><br>${esc(g.grund)}</div>`;
  else {
    if (g.bezug === 'ZUGEHOERIG') h += `<div class="hinweis">${esc(g.bezug_text)}: <b>${esc(ek.knoten[g.wurzel].name)}</b> <span class="chip ${g.bezug_freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}" data-ek-bezug-freigabe>${esc(FREIGABE_TEXT[g.bezug_freigabe])}</span>`
      + `${g.bezug_herkunft ? ` · ${esc(g.bezug_herkunft)}` : ''}${g.einschraenkung ? ` · ${esc(g.einschraenkung)}` : ''}</div><details class="ek-belege"><summary>Beleg Zugehörigkeit (${g.bezug_belege.length})</summary>${belegeHtml(g.bezug_belege, Q)}</details>`;
    h += `<div class="ek-baum">${ekBaumHtml(ek, g.baum, Q)}</div>`;
  }
  if (g.betreiber) h += `<p class="hinweis" style="margin-top:8px"><b>Betreiber (nicht Eigentümer):</b> ${esc(ek.knoten[g.betreiber.baum.knoten].name)} ${esc(g.betreiber.text)}</p>`
    + `<details class="ek-belege"><summary>Beleg Betreiber (${g.betreiber.belege.length})</summary>${belegeHtml(g.betreiber.belege, Q)}</details>`
    + `<div class="ek-baum" data-ek-betreiber>${ekBaumHtml(ek, g.betreiber.baum, Q)}</div>`;
  return h + '</div>';
}
function risikoHtml(s, quellen) {
  if (!s.risiken.length) return `<div class="ub" data-unbekannt><b>Risiko:</b> <span class="unbekannt">unbekannt</span><br>${esc(s.risiko_unbekannt || 'Für diesen Standort liegt kein belegtes Risiko vor.')}</div>`;
  return s.risiken.map(r => `<div data-risiko><b>${esc(r.art_text)}:</b> ${esc(r.text)} ${chips(r)}`
    + `<div class="hinweis">${r.rechnung ? `Rechnung: ${esc(r.rechnung)} · ` : ''}${esc(r.freigabe_herkunft)} · Stand ${esc(r.stand)}</div>${belegeHtml(r.belege, quellen)}</div>`).join('');
}
function gliederHtml(daten) {
  return daten.standorte.map(s => {
    const e = s.eigentum, h = daten.verbindungen.filter(v => v.ebene === 'BELEGT' && (v.von === s.id || v.nach === s.id)).reduce((n, v) => n + v.hinweise.length, 0);
    const g = daten.eigentumskette?.glieder[s.id], ek = daten.eigentumskette;
    // Ohne eigene Eigentumsangabe: Zugehoerigkeit aus der Eigentuemerkette nennen, statt "unbekannt" neben "bis oben belegt".
    const eig = e.length ? `${esc(e[0].eigentuemer)}${prozent(e[0].anteil)}${e.length > 1 ? ` und ${e.length - 1} weitere` : ''}`
      : g?.baum && g.bezug === 'ZUGEHOERIG' && ek.knoten[g.wurzel] ? `gehört zu ${esc(ek.knoten[g.wurzel].name)} (siehe Eigentümerkette)` : '<span class="unbekannt">unbekannt</span>';
    const ri = s.risiken.length ? s.risiken.map(r => esc(r.art_text)).join(', ') : '';
    const re = s.risikoebene ? Object.values(s.risikoebene) : [];
    const reText = re.length ? `Risiko-Ebene ${re.filter(x => x.status === 'BELEGT').length} von ${re.length} Kategorien belegt` : '';
    const risiko = ri || h || reText ? [ri, h ? `${h} Störungshinweis${h > 1 ? 'e' : ''} an Verbindungen` : '', reText].filter(Boolean).join(' · ') : '<span class="unbekannt">unbekannt</span>';
    const kette = g ? `<small data-ek-kurz="${esc(g.status)}">Eigentümerkette: ${g.baum ? esc(g.status_text) : '<span class="unbekannt">unbekannt</span>'}</small>` : '';
    return `<li><button type="button" data-glied="${esc(s.id)}" aria-pressed="false"><b>${esc(nr(s))}. ${esc(s.kurz)}</b><small>Eigentümer: ${eig}</small>${kette}<small>Risiko: ${risiko}</small></button></li>`;
  }).join('');
}

function kapazitaetKurz(a) {
  const b = a.mengen.find(m => m.ebene === 'BELEGT' && m.wert !== null), x = a.mengen.find(m => m.ebene === 'ANNAHME');
  if (b) return `${esc(b.groesse_text)}: ${wertText(b)}`;
  if (status.ansicht === 'annahmen' && x) return `${esc(x.groesse_text)}: ${wertText(x)} <i class="am">(Annahme)</i>`;
  return 'Kapazität: <span class="unbekannt">unbekannt</span>';
}
function alternativenHtml(daten) {
  const A = Object.fromEntries((daten.alternativen || []).map(a => [a.id, a]));
  return daten.standorte.filter(s => s.alternativen?.length).map(s => `<li data-alternativen-glied="${esc(s.id)}"><b>${esc(nr(s))}. ${esc(s.kurz)}</b> <small>(${s.alternativen.length})</small>`
    + s.alternativen.map(i => A[i]).map(a => `<button type="button" data-alternative="${esc(a.id)}" aria-pressed="false"><b>${esc(a.kurz)}</b> <small>${esc(a.rolle)} · ${kapazitaetKurz(a)}</small>`
      + `<span class="chip ${a.bezug.art === 'BELEGTE_BEZIEHUNG' ? 'f' : 'k'}">${esc(BEZUG_TEXT[a.bezug.art])}</span></button>`).join('') + '</li>').join('');
}
function alternativeDetail(daten, id) {
  const a = daten.alternativen.find(x => x.id === id), Q = daten.quellen, S = Object.fromEntries(daten.standorte.map(s => [s.id, s]));
  const ort = `${zahl(a.ort.lat)}, ${zahl(a.ort.lon)} (${esc(a.ort.genauigkeit)}, ${esc(FREIGABE_TEXT[a.ort.freigabe])})`;
  return `<h2>Ausweichquelle: ${esc(a.name)}</h2><p class="eyebrow">${esc(a.ersatz_text)} · könnte ersetzen: ${a.fuer.map(i => esc(`${nr(S[i])}. ${S[i].kurz}`)).join(', ')} · keine bestätigte Ersatzlieferung</p>`
    + `<dl><dt>Rolle</dt><dd>${esc(a.rolle)}</dd><dt>Land</dt><dd>${a.land ? esc(a.land) : '<span class="unbekannt">unbekannt</span>'}</dd><dt>Ort</dt><dd>${ort}${a.ort.hinweis ? ` <small>${esc(a.ort.hinweis)}</small>` : ''}</dd>`
    + `<dt>Bezug</dt><dd>${esc(a.bezug.text)} <span class="chip ${a.bezug.freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}">${esc(BEZUG_TEXT[a.bezug.art])} · ${esc(FREIGABE_TEXT[a.bezug.freigabe])}</span><div class="hinweis">${esc(a.bezug.freigabe_herkunft)}</div></dd>`
    + `<dt>Einschränkung</dt><dd>${esc(a.einschraenkung)}</dd></dl>`
    + `<h3 style="font-size:14px;margin:10px 0 2px">Kapazität</h3>` + a.mengen.filter(zeigen).map(m => mengeHtml(m, Q, daten)).join('')
    + `<h3 style="font-size:14px;margin:10px 0 2px">Beleg Bezug</h3>${belegeHtml(a.bezug.belege, Q)}<h3 style="font-size:14px;margin:10px 0 2px">Beleg Ort</h3>${belegeHtml(a.ort.belege, Q)}`;
}

// --- Globus ---------------------------------------------------------------------------------------------------------
function vec(lat, lon, r = 1) {
  const phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
function bogenPunkte(a, b) {
  const va = vec(a.lat, a.lon).normalize(), vb = vec(b.lat, b.lon).normalize();
  const winkel = va.angleTo(vb), hoehe = 0.01 + Math.min(0.16, winkel * 0.12), n = 64, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = new THREE.Vector3().copy(va).lerp(vb, t).normalize();
    if (winkel > 1e-6) { const s = Math.sin(winkel); p.copy(va).multiplyScalar(Math.sin((1 - t) * winkel) / s).add(vb.clone().multiplyScalar(Math.sin(t * winkel) / s)); }
    pts.push(p.multiplyScalar(1.003 + hoehe * Math.sin(Math.PI * t)));
  }
  return pts;
}

function baueGlobus(daten, waehle) {
  const host = $('globus');
  const renderer = new THREE.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x06121c);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = 1.25; controls.maxDistance = 6; controls.enablePan = false;
  const erde = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial({color: 0x2a4a63}));
  scene.add(erde);
  new THREE.TextureLoader().load('/assets/earth-blue-marble.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; erde.material.map = t; erde.material.color.set(0xffffff); erde.material.needsUpdate = true; zeichne(); });

  // Knoten: Standorte mit gleicher Koordinate teilen sich eine Marke (z. B. Mine, Aufbereitung und Huette am selben Ort).
  const gruppen = new Map();
  for (const s of daten.standorte) {
    if (s.ort.lat === null) continue;
    const k = `${s.ort.lat.toFixed(3)},${s.ort.lon.toFixed(3)}`;
    if (!gruppen.has(k)) gruppen.set(k, {lat: s.ort.lat, lon: s.ort.lon, standorte: []});
    gruppen.get(k).standorte.push(s);
  }
  const marken = [], ringe = [];
  for (const g of gruppen.values()) {
    const p = vec(g.lat, g.lon, 1.004);
    const kandidat = g.standorte.every(s => s.ort.freigabe !== 'FREIGEGEBEN');
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({color: kandidat ? 0xe8643c : 0xffd27a}));
    m.position.copy(p); scene.add(m);
    if (daten.risikoebene) {   // Ring der Risiko-Ebene: Farbe = bester Belegstand der Glieder an diesem Ort
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.019, 0.026, 40), new THREE.MeshBasicMaterial({color: RS.U[2], transparent: true, opacity: 0.95, side: THREE.DoubleSide}));
      ring.position.copy(vec(g.lat, g.lon, 1.005)); ring.lookAt(ring.position.clone().multiplyScalar(2)); ring.visible = false; scene.add(ring);
      ringe.push({ring, standorte: g.standorte});
    }
    for (const [i, s] of g.standorte.entries()) {
      const b = document.createElement('button');
      b.className = 'marke'; b.type = 'button'; b.dataset.standort = s.id; b.setAttribute('aria-pressed', 'false');
      b.textContent = `${nr(s)}. ${s.kurz}`; b.title = `${s.rolle}: ${s.name}`;
      b.addEventListener('click', () => waehle({typ: status.ausfallModus && s.id !== daten.ausfall?.kunde ? 'ausfall' : 'standort', id: s.id}));
      host.append(b); marken.push({el: b, pos: p, versatz: i, stufe: s.stufe, id: s.id, name: `${nr(s)}. ${s.kurz}`});
    }
  }
  status.knoten = marken.length;

  const boegen = [], schilder = [];
  const pos = Object.fromEntries(daten.standorte.map(s => [s.id, s.ort]));
  for (const v of daten.verbindungen) {
    const a = pos[v.von], b = pos[v.nach];
    if (a.lat === null || b.lat === null || (a.lat === b.lat && a.lon === b.lon)) continue;   // gleicher Ort: nur in der Liste
    // Roehre statt 1-px-Linie (gut sichtbar und antippbar); gestrichelt = Handel oder nicht freigegeben.
    const pts = bogenPunkte(a, b), gestrichelt = v.art === 'HANDEL' || v.freigabe !== 'FREIGEGEBEN';
    const mat = new THREE.MeshBasicMaterial({color: v.ebene === 'ANNAHME' ? FARBE_ANNAHME : FARBE[v.art], transparent: true, opacity: 1});
    const gruppe = new THREE.Group(); gruppe.userData.verbindung = v.id; gruppe.userData.ebene = v.ebene; gruppe.userData.farbe = mat.color.getHex(); gruppe.userData.mat = mat;
    const stuecke = gestrichelt ? [] : [pts];
    if (gestrichelt) for (let i = 0; i + 2 < pts.length; i += 4) stuecke.push(pts.slice(i, i + 3));
    for (const st of stuecke) {
      const r = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(st), Math.max(2, st.length * 2), 0.0055, 6, false), mat);
      r.userData.verbindung = v.id; gruppe.add(r);
    }
    scene.add(gruppe); boegen.push(gruppe);
    // Schild mit Menge und Wert pro Jahr an der Bogenmitte (Text je Ansicht, siehe hebe)
    const sch = document.createElement('button');
    sch.className = 'schild'; sch.type = 'button'; sch.dataset.schild = v.id;
    sch.addEventListener('click', () => waehle({typ: 'verbindung', id: v.id}));
    host.append(sch); schilder.push({el: sch, pos: pts[Math.floor(pts.length / 2)].clone(), versatz: 0, gruppe});
  }
  status.boegen = boegen.length;

  // Ausweichquellen: eigener Punkt je Ausweichquelle, Name und Bogen nur bei passender Auswahl.
  const altMarken = [], altBoegen = [];
  const ALT = Object.fromEntries((daten.alternativen || []).map(a => [a.id, a]));
  for (const a of daten.alternativen || []) {
    const p = vec(a.ort.lat, a.ort.lon, 1.004);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), new THREE.MeshBasicMaterial({color: FARBE_ALT}));
    m.position.copy(p); scene.add(m);
    const b = document.createElement('button');
    b.className = 'marke alt weg'; b.type = 'button'; b.dataset.alternative = a.id; b.setAttribute('aria-pressed', 'false');
    b.textContent = `möglich: ${a.kurz}`; b.title = `Mögliche Ausweichquelle, keine bestätigte Lieferung. ${a.rolle}: ${a.name}`;
    b.addEventListener('click', () => waehle({typ: 'alternative', id: a.id}));
    host.append(b); altMarken.push({el: b, pos: p, versatz: 0, alt: a.id});
    for (const sid of a.fuer) {
      const o = pos[sid];
      if (o.lat === null || (o.lat === a.ort.lat && o.lon === a.ort.lon)) continue;
      const pts = bogenPunkte(o, a.ort), mat = new THREE.MeshBasicMaterial({color: FARBE_ALT, transparent: true, opacity: 0.9});
      const g = new THREE.Group(); g.userData = {alt: a.id, glied: sid}; g.visible = false;
      for (let i = 0; i + 2 < pts.length; i += 4) g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(i, i + 3)), 4, 0.0035, 5, false), mat));
      scene.add(g); altBoegen.push(g);
    }
  }
  status.alt_knoten = altMarken.length; status.alt_boegen = altBoegen.length;
  const altFuer = auswahl => !auswahl ? [] : auswahl.typ === 'alternative' ? [auswahl.id]
    : ['standort', 'ausfall'].includes(auswahl.typ) ? (daten.standorte.find(s => s.id === auswahl.id)?.alternativen || []) : [];

  // Bogen antippen -> Verbindung waehlen
  const ray = new THREE.Raycaster();
  let unten = null;
  renderer.domElement.addEventListener('pointerdown', e => { unten = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!unten || Math.hypot(e.clientX - unten[0], e.clientY - unten[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const treffer = ray.intersectObjects(boegen.filter(g => g.visible), true)[0];
    if (treffer) waehle({typ: 'verbindung', id: treffer.object.userData.verbindung});
  });

  const blick = vec(8, 18, host.clientWidth < host.clientHeight * 1.1 ? 4.3 : 3.2); camera.position.copy(blick); controls.update();
  // Handy (schmaler Globus): Namensschilder, die sich ueberdecken, werden zu einem Buendel mit Knopf "+n";
  // Mengen-Schilder nur fuer den gewaehlten Bogen bzw. die Boegen am gewaehlten Glied.
  const offen = new Set(), buendelKnoepfe = [];
  let aktuelleAuswahl = null;
  const istKompakt = () => host.clientWidth < 600;
  function buendelKnopf(n) {
    while (buendelKnoepfe.length <= n) {
      const b = document.createElement('button');
      b.className = 'buendel weg'; b.type = 'button';
      b.addEventListener('click', ev => { ev.stopPropagation(); const k = b.dataset.buendel; offen.has(k) ? offen.delete(k) : offen.add(k); zeichne(); });
      host.append(b); buendelKnoepfe.push(b);
    }
    return buendelKnoepfe[n];
  }
  function schilderZeigen() {
    const kompakt = istKompakt(), a = aktuelleAuswahl;
    status.kompakt = kompakt; status.schilder_gezeigt = [];
    for (const sc of schilder) {
      const v = sc.gruppe.userData.verbindung, vb = daten.verbindungen.find(x => x.id === v);
      const amGlied = a && ['standort', 'ausfall'].includes(a.typ) && (vb.von === a.id || vb.nach === a.id);
      const zeigen = sc.gruppe.visible && (!kompakt || (a?.typ === 'verbindung' && a.id === v) || amGlied);
      sc.el.classList.toggle('weg', !zeigen); sc.gezeigt = zeigen;
      if (zeigen) status.schilder_gezeigt.push(v);
    }
  }
  let anforderung = 0;
  function zeichne() { if (!anforderung) anforderung = requestAnimationFrame(bild); }
  function bild() {
    anforderung = 0;
    const w = host.clientWidth, h = host.clientHeight;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const bewegt = controls.update();
    renderer.render(scene, camera);
    const cam = camera.position.clone().normalize();
    // Marken projizieren und ueberlappende nach oben schieben (gierig, von unten nach oben).
    const belegt = [];
    schilderZeigen();
    const liste = marken.concat(altMarken.filter(m => status.alt_sichtbar.includes(m.alt)), schilder.filter(m => m.gezeigt)).map(m => { const p = m.pos.clone().project(camera); return {m, x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, sichtbar: m.pos.clone().normalize().dot(cam) > 0.15}; })
      .sort((a, b) => b.y - a.y);
    // Buendel (nur Handy): Glied-Marken, deren Schilder sich an der Ausgangsstelle ueberdecken
    const versteckt = new Set(), koepfe = new Map();
    status.buendel = [];
    if (istKompakt()) {
      const sm = liste.filter(e => e.sichtbar && e.m.stufe !== undefined), mutter = sm.map((_, i) => i);
      const wurzel = i => mutter[i] === i ? i : (mutter[i] = wurzel(mutter[i]));
      for (let i = 0; i < sm.length; i++) for (let j = i + 1; j < sm.length; j++) {
        const a = sm[i], b = sm[j], bh = (a.m.el.offsetHeight || 20) + 3;
        if (Math.abs(a.x - b.x) < ((a.m.el.offsetWidth || 120) + (b.m.el.offsetWidth || 120)) / 2 && Math.abs(a.y - b.y) < bh) mutter[wurzel(i)] = wurzel(j);
      }
      const gruppen = new Map();
      sm.forEach((e, i) => { const r = wurzel(i); if (!gruppen.has(r)) gruppen.set(r, []); gruppen.get(r).push(e); });
      for (const g of gruppen.values()) {
        if (g.length < 2) continue;
        g.sort((a, b) => a.m.stufe - b.m.stufe || a.m.id.localeCompare(b.m.id));
        const key = g.map(e => e.m.id).join(','), auf = offen.has(key);
        const kopf = g.find(e => ['standort', 'ausfall'].includes(aktuelleAuswahl?.typ) && e.m.id === aktuelleAuswahl.id) || g[0];
        if (!auf) for (const e of g) if (e !== kopf) versteckt.add(e.m);
        koepfe.set(kopf.m, {key, auf, andere: g.filter(e => e !== kopf).map(e => e.m.name)});
        status.buendel.push({glieder: g.map(e => e.m.id), kopf: kopf.m.id, offen: auf});
      }
    }
    let nb = 0;
    for (const e of liste) {
      const imBuendel = versteckt.has(e.m);
      e.m.el.classList.toggle('weg', !e.sichtbar || imBuendel);
      e.m.el.classList.toggle('gebuendelt', imBuendel);
      if (!e.sichtbar || imBuendel) continue;
      const bw = e.m.el.offsetWidth || 120, bh = (e.m.el.offsetHeight || 20) + 3;
      let y = e.y;
      for (let n = 0; n < 12; n++) {
        const k = belegt.find(r => Math.abs(r.x - e.x) < (r.w + bw) / 2 && Math.abs(r.y - y) < bh);
        if (!k) break; y = k.y - bh;
      }
      const k = koepfe.get(e.m);
      if (k) {   // Knopf "+n" rechts neben dem Kopf des Buendels
        const b = buendelKnopf(nb++);
        b.dataset.buendel = k.key; b.textContent = k.auf ? '−' : `+${k.andere.length}`;
        b.title = k.auf ? 'Zuklappen' : `Hier auch: ${k.andere.join(', ')} (antippen zum Aufklappen)`;
        b.setAttribute('aria-expanded', String(k.auf)); b.setAttribute('aria-label', b.title);
        b.classList.remove('weg'); b.style.left = `${e.x + bw / 2 + 2}px`; b.style.top = `${y}px`;
        belegt.push({x: e.x + bw / 2 + 14, y, w: 26});
      }
      belegt.push({x: e.x, y, w: bw});
      e.m.el.style.left = `${e.x}px`; e.m.el.style.top = `${y}px`;
    }
    for (let i = nb; i < buendelKnoepfe.length; i++) buendelKnoepfe[i].classList.add('weg');
    if (bewegt) zeichne();
  }
  controls.addEventListener('change', zeichne);
  addEventListener('resize', zeichne);
  zeichne();
  return {
    risiko() {
      status.risiko_ringe = 0;
      for (const r of ringe) {
        r.ring.visible = status.risiko;
        const st = r.standorte.map(gliedStatus).sort((a, b) => rang(b) - rang(a))[0];
        r.ring.material.color.setHex(RS[st][2]); r.ring.material.opacity = st === 'U' ? 0.55 : 0.95;
        if (r.ring.visible) status.risiko_ringe++;
      }
      const S = Object.fromEntries(daten.standorte.map(s => [s.id, s]));
      status.risiko_marken = 0;
      for (const m of marken) {
        m.el.querySelector('.rbadge')?.remove();
        if (!status.risiko || !S[m.el.dataset.standort].risikoebene) continue;
        const re = S[m.el.dataset.standort].risikoebene, ks = status.risikoKat === 'ALLE' ? Object.keys(re) : [status.risikoKat];
        const b = document.createElement('span'); b.className = 'rbadge'; b.setAttribute('aria-hidden', 'true');
        b.innerHTML = ks.map(k => { const st = feldStatus(re[k]); return `<i class="rq ${RS[st][1]}" data-rq="${k}:${st}" title="${esc(k)}: ${esc(RS[st][0])}">${RE_KURZ[k]}</i>`; }).join('');
        m.el.append(b); status.risiko_marken++;
      }
      zeichne();
    },
    hebe(auswahl) {
      aktuelleAuswahl = auswahl;
      const aus = auswahl?.typ === 'ausfall' ? ausfallAnsicht(daten, auswahl.id) : null;
      status.rot = [];
      for (const g of boegen) {
        g.visible = zeigen(g.userData);
        const rot = aus ? aus.betroffene_wege.includes(g.userData.verbindung) : false;
        const blass = (auswahl?.typ === 'verbindung' && g.userData.verbindung !== auswahl.id) || (aus && !rot);
        g.userData.mat.color.setHex(rot ? 0xd32f2f : g.userData.farbe);
        g.userData.mat.opacity = blass ? 0.2 : 1;
        if (rot && g.visible) status.rot.push(g.userData.verbindung);
      }
      status.boegen_sichtbar = boegen.filter(g => g.visible).length;
      status.schilder = [];
      for (const sc of schilder) {
        const v = daten.verbindungen.find(x => x.id === sc.gruppe.userData.verbindung), t = schildText(v);
        sc.el.textContent = t.text; sc.el.dataset.art = t.art; sc.el.title = `${v.id}: Menge und Wert pro Jahr (${t.art === 'A' ? 'Annahme' : t.art === 'B' ? 'belegt' : 'unbekannt'}) – antippen für Quelle und Rechnung`;
        sc.el.setAttribute('aria-pressed', String(auswahl?.typ === 'verbindung' && auswahl.id === v.id));
        if (sc.gruppe.visible) status.schilder.push({id: v.id, text: t.text, art: t.art});
      }
      for (const m of marken) {
        m.el.setAttribute('aria-pressed', String((['standort', 'ausfall'].includes(auswahl?.typ) && m.el.dataset.standort === auswahl.id)
          || (auswahl?.typ === 'risiko' && m.el.dataset.standort === auswahl.id.split(':')[0])));
        m.el.classList.toggle('aus', auswahl?.typ === 'ausfall' && m.el.dataset.standort === auswahl.id);
      }
      status.alt_sichtbar = altFuer(auswahl);
      const glied = auswahl?.typ === 'alternative' ? null : auswahl?.id;
      for (const g of altBoegen) g.visible = status.alt_sichtbar.includes(g.userData.alt) && (!glied || g.userData.glied === glied);
      for (const m of altMarken) {
        m.el.classList.toggle('weg', !status.alt_sichtbar.includes(m.alt));
        m.el.setAttribute('aria-pressed', String(auswahl?.typ === 'alternative' && auswahl.id === m.alt));
      }
      zeichne();
    },
  };
}

// --- Ausfall-Simulation ----------------------------------------------------------------------------------------------
const STATUS_TEXT = {BELEGT: ['belegt', 'f'], RECHNUNG: ['Rechnung aus belegten Werten', 'r'], ANNAHME: ['Annahme', 'a'], UNBEKANNT: ['unbekannt', 'u']};
const statusChip = st => `<span class="chip ${STATUS_TEXT[st][1]}" data-status="${esc(st)}">${esc(STATUS_TEXT[st][0])}</span>`;
function ausfallAnsicht(daten, id) { return daten.ausfall.glieder.find(g => g.standort === id).ansichten[status.ansicht]; }
function ausfallKnoepfe(daten) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), m = daten.ausfall.messung;
  $('ausfall-text').textContent = daten.ausfall.frage + ' Ergebnisse gerechnet aus der Datenbank; Unbekanntes bleibt unbekannt.';
  $('ausfall-knoepfe').innerHTML = daten.ausfall.glieder.map(g => `<button type="button" data-ausfall="${esc(g.standort)}" aria-pressed="false">${esc(S[g.standort].stufe)}. ${esc(S[g.standort].kurz)}</button>`).join('');
  const an = status.ansicht === 'annahmen';
  $('ausfall-mess').innerHTML = `Simulierbar: <b>${m.simulierbar} von ${m.glieder}</b> Gliedern · belegte Eingaben ${m.eingaben_belegt} von ${m.eingaben_gesamt} (${zahl(m.anteil_belegt_prozent)} %)`
    + (an ? ` · <span class="am">mit Annahmen ${m.eingaben_mit_annahmen} von ${m.eingaben_gesamt} (${zahl(m.anteil_mit_annahmen_prozent)} %)</span>` : '');
}
function wegText(daten, w) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), V = Object.fromEntries(daten.verbindungen.map(v => [v.id, v]));
  return w.map(id => V[id]).map((v, i) => (i ? '' : esc(S[v.von].kurz)) + ` → ${esc(S[v.nach].kurz)}${v.ebene === 'ANNAHME' ? ' <i class="am">(Annahme)</i>' : ''}`).join('')
    + ` <small>(${w.map(esc).join(', ')})</small>`;
}
function ausfallHtml(daten, id) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), Q = daten.quellen, a = ausfallAnsicht(daten, id), g = daten.ausfall.glieder.find(x => x.standort === id);
  const R = Object.fromEntries(daten.standorte.flatMap(s => s.risiken.map(r => [r.id, r])));
  const X = Object.fromEntries(daten.standorte.flatMap(s => (s.ersatz || []).map(e => [e.id, e])));
  const V = Object.fromEntries(daten.verbindungen.map(v => [v.id, v]));
  const kunde = S[daten.ausfall.kunde].kurz;
  const einordnung = (ids, ohne) => ids.map(i => R[i]).map(r => `<div data-einordnung><b>${esc(r.art_text)} (belegt, ${ohne}):</b> ${esc(r.text)} ${chips(r)}${belegeHtml(r.belege, Q)}</div>`).join('');
  const t = a.tonnen;
  let tonnen = t.status === 'BELEGT' ? `<b>${zahl(t.kt)} kt</b>` : `<b>Belegt:</b> <span class="unbekannt">unbekannt</span>. ${esc(t.grund)}`;
  if (t.obergrenze) tonnen += `<div data-obergrenze>Obergrenze: höchstens <b>${zahl(t.obergrenze.kt)} kt</b> ${statusChip('RECHNUNG')}<div class="hinweis">${esc(t.obergrenze.rechnung)} · ${esc(t.obergrenze.hinweis)}</div></div>`;
  if (t.annahme) tonnen += `<div class="annahme-box" data-annahme-ausfall><b>Annahme:</b> rund ${zahl(t.annahme.kt)} ${esc(t.annahme.einheit)} (${zahl(t.annahme.von)} bis ${zahl(t.annahme.bis)}) `
    + `<span class="chip a">Annahme · ${t.annahme.annahmen.map(esc).join(', ')} · Konfidenz ${konf(t.annahme.konfidenz)}</span><div class="hinweis">Rechnung: ${esc(t.annahme.rechnung)} · nicht belegt, nicht freigegeben</div></div>`;
  const e = a.ersatz;
  let ersatz = e.wege.length ? `<p style="margin:2px 0">Erfasste Ausweichwege zu ${esc(kunde)}:</p><ul>${e.wege.map(w => `<li>${wegText(daten, w)}</li>`).join('')}</ul>` : '';
  ersatz += e.angaben.map(i => X[i]).map(x => `<div data-ersatz><b>${esc(S[x.id.split('-')[1]].kurz)}:</b> ${esc(x.text)} ${chips(x)}${belegeHtml(x.belege, Q)}</div>`).join('');
  if (e.status === 'UNBEKANNT') ersatz = `<div class="ub" data-unbekannt><b>Benannter Ersatzlieferant:</b> <span class="unbekannt">unbekannt</span><br>${esc(e.grund)}</div>` + ersatz;
  const ALT = Object.fromEntries((daten.alternativen || []).map(x => [x.id, x]));
  const altZeile = x => { const A = ALT[x.id], M = Object.fromEntries(A.mengen.map(m => [m.id, m]));
    return `<li data-ausfall-alternative="${esc(x.id)}"><button type="button" class="link" data-alternative="${esc(x.id)}">${esc(A.kurz)}</button> <small>(${esc(A.ersatz_text)}; ${esc(BEZUG_TEXT[A.bezug.art])})</small> ${statusChip(x.kapazitaet)}<br>`
      + x.mengen.map(i => M[i]).map(m => m.wert === null ? `${esc(m.groesse_text)}: <span class="unbekannt">unbekannt</span>` : `${esc(m.groesse_text)}${m.ebene === 'ANNAHME' ? ' <i class="am">(Annahme)</i>' : ''}: ${wertText(m)}`).join(' · ') + '</li>'; };
  const k = a.kapazitaet;
  const kapazitaet = e.alternativen.length ? `<p style="margin:2px 0">${e.alternativen.length} Ausweichquellen, türkis auf dem Globus:</p><ul>${e.alternativen.map(altZeile).join('')}</ul><p class="hinweis">${esc(k.grund)}</p>`
    : `<div class="ub" data-unbekannt><span class="unbekannt">unbekannt</span><br>${esc(k.grund)}</div>`;
  const folge = (titel, st, inhalt) => `<div class="folge" data-folge="${esc(titel)}"><h3>${esc(titel)} ${statusChip(st)}</h3>${inhalt}</div>`;
  // Ausfall-Annahmen (nur "Mit Annahmen"): Wert, Spanne, Kennung, Konfidenz, Rechnung und die zitierte Quelle der Annahme.
  const annQuelle = q => `<div class="beleg" data-beleg><b>Quelle der Annahme:</b> ${q.zitat.map(z => `„${esc(z)}“`).join(' … ')}<br><small>${esc(q.herausgeber)}: <a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.titel)}</a>${q.fundstelle ? ' · ' + esc(q.fundstelle) : ''} · ${esc(q.veroeffentlicht)}</small></div>`;
  const annBox = (x, kopf, rechnung) => `<div class="annahme-box" data-annahme-ausfall="${esc(x.id)}"><b>Annahme:</b> ${kopf} <span class="chip a">Annahme · ${esc(x.id)} · ${esc(x.art)} · Konfidenz ${konf(x.konfidenz)}</span>`
    + `<div class="hinweis">${rechnung ? 'Rechnung: ' + esc(rechnung) + ' · ' : ''}${esc(x.begruendung)} · nicht belegt, nicht freigegeben</div>${annQuelle(x.quelle)}</div>`;
  const m = a.mehrkosten, du = a.dauer;
  let mehr = esc(m.grund);
  if (m.status === 'ANNAHME') mehr = `<b>Belegt:</b> <span class="unbekannt">unbekannt</span>. ` + annBox(m.annahme,
    (m.ueber_dauer ? `rund <b>${zahl(m.ueber_dauer.mio_eur)} Mio. €</b> über die Ausfalldauer (${zahl(m.ueber_dauer.von)} bis ${zahl(m.ueber_dauer.bis)}), ` : '')
    + `rund <b>${zahl(m.je_jahr.mio_eur)} Mio. € je Jahr</b> Ausfall (${zahl(m.je_jahr.von)} bis ${zahl(m.je_jahr.bis)}); Mehrpreis ${zahl(m.annahme.wert)} ${esc(m.annahme.einheit)} (${zahl(m.annahme.von)} bis ${zahl(m.annahme.bis)})`,
    m.rechnung + ` · Kurs ${m.kurs.datum}`);
  let dauer = esc(du.grund);
  if (du.status === 'ANNAHME') dauer = `<b>Belegt:</b> <span class="unbekannt">unbekannt</span>. `
    + annBox(du.annahme, `rund <b>${zahl(du.annahme.wert)} ${esc(du.annahme.einheit)}</b> (${zahl(du.annahme.von)} bis ${zahl(du.annahme.bis)})`, null);
  const tst = t.status !== 'UNBEKANNT' ? t.status : t.annahme ? 'ANNAHME' : 'UNBEKANNT';
  return `<h2>Ausfall: ${esc(S[id].name)}</h2><p class="eyebrow">Ausfall-Simulation · Ansicht ${status.ansicht === 'annahmen' ? 'Mit Annahmen' : 'Belegt'} · Schlussfolgerung, kein Fakt</p>`
    + `<div class="lage" data-lage>${a.kunde_abgeschnitten ? '<b>Kette zu ' + esc(kunde) + ' unterbrochen.</b> ' : '<b>Kette zu ' + esc(kunde) + ' nicht unterbrochen.</b> '}${esc(a.lage)}</div>`
    + `<div class="folgen">`
    + folge(`Fehlende Tonnen bei ${kunde}`, tst, tonnen)
    + folge('Mehrkosten', m.status, `${mehr}${einordnung(m.einordnung, 'keine Mehrkosten-Zahl')}`)
    + folge('Dauer', du.status, `${dauer}${einordnung(du.einordnung, 'nennt keine Dauer')}`)
    + folge('Ersatz', e.status, ersatz)
    + folge('Ausweichquellen und Kapazität', k.status, kapazitaet)
    + `</div><h3 style="font-size:14px;margin:10px 0 2px">Betroffene Verbindungen (rot auf dem Globus)</h3>`
    + (a.betroffene_wege.length ? `<ul>${a.betroffene_wege.map(v => `<li>${esc(v)} ${esc(S[V[v].von].kurz)} → ${esc(S[V[v].nach].kurz)}${V[v].ebene === 'ANNAHME' ? ' <i class="am">(Annahme)</i>' : ''}</li>`).join('')}</ul>` : '<p class="hinweis">keine</p>')
    + (g.m6_betroffen.length ? `<h3 style="font-size:14px;margin:10px 0 2px">Regel Meilenstein 6: wer verliert einen erfassten Abnehmer</h3><ul>${g.m6_betroffen.map(b => `<li>${esc(S[b.standort].kurz)}: `
      + (b.andere_gleicher_art.length ? `weitere erfasste Wege gleicher Art: ${b.andere_gleicher_art.map(x => esc(S[x].kurz)).join(', ')}` : 'kein weiterer erfasster Weg gleicher Art') + '</li>').join('')}</ul>` : '')
    + `<h3 style="font-size:14px;margin:10px 0 2px">Eingaben dieser Simulation: ${a.eingaben_belegt} von ${a.eingaben.length} belegt</h3><ul data-eingaben>${a.eingaben.map(x => `<li>${esc(x.text)}: ${statusChip(x.status)}</li>`).join('')}</ul>`
    + `<p class="hinweis">${daten.ausfall.regeln.map(esc).join(' ')}</p>`;
}

// --- Risiko-Ebene ---------------------------------------------------------------------------------------------------
function risikoPanel(daten) {
  const R = daten.risikoebene; if (!R) { $('risiko').hidden = true; return; }
  const K = Object.fromEntries(R.kategorien.map(k => [k.id, k.text])), m = R.messung, an = status.ansicht === 'annahmen';
  $('risiko-an').setAttribute('aria-pressed', String(status.risiko));
  $('risiko-kategorien').innerHTML = [['ALLE', 'Alle']].concat(R.kategorien.map(k => [k.id, k.text]))
    .map(([id, t]) => `<button type="button" data-risiko-kat="${esc(id)}" aria-pressed="${status.risikoKat === id}">${esc(t)}</button>`).join('');
  $('risiko-mess').innerHTML = `Belegt: <b>${m.belegt} von ${m.felder}</b> Feldern (${zahl(m.anteil_belegt_prozent)} %; ${m.glieder} Glieder × ${m.kategorien} Kategorien), `
    + `davon ${m.belegt_standort_oder_firma} am Standort/an der Firma, ${m.belegt_nur_landesebene} nur Landesebene · `
    + (an ? `<span class="am">Annahme ${m.annahme}, mit Annahmen ${m.mit_annahmen} von ${m.felder}</span> · unbekannt ${m.unbekannt}` : `unbekannt ${m.unbekannt + m.annahme}`);
  $('risiko-matrix').innerHTML = `<thead><tr><th>Glied</th>${R.kategorien.map(k => `<th title="${esc(k.text)}">${esc(MATRIX_KOPF[k.id] || k.text)}</th>`).join('')}</tr></thead><tbody>`
    + daten.standorte.map(s => `<tr><th>${esc(nr(s))}. ${esc(s.kurz)}</th>${R.kategorien.map(k => { const st = feldStatus(s.risikoebene[k.id]);
      return `<td><button type="button" data-risiko-feld="${esc(s.id)}:${esc(k.id)}" aria-pressed="false" aria-label="${esc(s.kurz)}, ${esc(K[k.id])}: ${esc(RS[st][0])}"><span class="rs ${RS[st][1]}" data-rs="${st}">${esc(RS_KURZ[st])}</span></button></td>`; }).join('')}</tr>`).join('')
    + '</tbody>';
  $('risiko-regeln').textContent = R.regeln.join(' ');
}
function risikoFeldHtml(daten, sid, kat, titel = true) {
  const s = daten.standorte.find(x => x.id === sid), f = s.risikoebene[kat], Q = daten.quellen, an = status.ansicht === 'annahmen';
  const K = Object.fromEntries(daten.risikoebene.kategorien.map(k => [k.id, k.text])), st = feldStatus(f);
  let h = titel ? `<h2>${esc(K[kat])}: ${esc(nr(s))}. ${esc(s.kurz)}</h2><p class="eyebrow">Risiko-Ebene · Ansicht ${an ? 'Mit Annahmen' : 'Belegt'} · ${rsChip(st)}</p>`
    : `<h4 style="margin:8px 0 2px;font-size:13px">${esc(K[kat])} ${rsChip(st)}</h4>`;
  h += f.belegt.map(e => `<div data-risiko-eintrag="${esc(e.id)}"><b>${esc(RE_BEZUG[e.bezug])}${e.land && e.bezug === 'LAND' ? ` (${esc(daten.risikoebene.laender[e.land]?.name || e.land)})` : ''}:</b> ${esc(e.text)} ${chips(e)}`
    + `<div class="hinweis">${e.rechnung ? `Rechnung: ${esc(e.rechnung)} · ` : ''}${esc(e.freigabe_herkunft)} · Stand ${esc(e.stand)}</div>${belegeHtml(e.belege, Q)}</div>`).join('');
  if (!f.belegt.length) h += `<div class="ub" data-unbekannt><b>Belegt:</b> <span class="unbekannt">unbekannt</span><br>${esc(f.grund_unbekannt)}</div>`;
  if (an) h += f.annahmen.map(e => `<div class="annahme-box" data-annahme-risiko><b>Annahme:</b> ${esc(e.text)} ${chips(e)}<div class="hinweis">${esc(e.freigabe_herkunft)}</div>${annahmeHtml(e.annahme, Q)}</div>`).join('');
  if (f.hinweis) h += `<p class="hinweis" data-risiko-hinweis>${esc(f.hinweis)}</p>`;
  return h;
}

// --- Panel ----------------------------------------------------------------------------------------------------------
function listenMenge(v) {
  const w = bogenWerte(v), f = (x, wort) => x.art === 'U' ? '<span class="unbekannt">unbekannt</span>' : x.art === 'A' ? `${x.text} <i class="am">(${wort})</i>` : x.text;
  return `<span data-bogen-menge="${w.menge.art}">Menge: ${f(w.menge, 'Annahme')}</span> · <span data-bogen-wert="${w.wert.art}">Wert: ${f(w.wert, 'Rechnung aus Annahme')}</span>`
    + (w.og ? ` · <span data-obergrenze>Obergrenze Länderstrom: ${wertText(w.og)}, ${wertText(w.ow)}</span>` : '');
}
function wertPanel(daten) {
  const W = daten.wert, T = daten.tiefe, an = status.ansicht === 'annahmen';
  if (!W) return '';
  const pb = W.preisbasis, m = W.messung, Q = daten.quellen, q = id => `<a href="${esc(Q[id].url)}" target="_blank" rel="noopener">${esc(Q[id].herausgeber)}</a>`;
  return `<h2 id="wert-titel">Menge und Wert je Bogen</h2>`
    + `<p class="hinweis" data-preisbasis>Preisbasis: LME-Kupfer Kasse <b>${esc(zahl(pb.preis.wert))} US$/t</b> (Handelstag ${esc(pb.preis.datum)}, gelesen ${esc(pb.preis.abgerufen)}; ${q(pb.preis.quelle)}) · `
    + `EZB-Referenzkurs <b>${esc(String(pb.kurs.wert).replace('.', ','))} US$ je €</b> (${esc(pb.kurs.datum)}, gelesen ${esc(pb.kurs.abgerufen)}; ${q(pb.kurs.quelle)}) · täglich neu gelesen, kein Echtzeitkurs.</p>`
    + `<p class="hinweis" id="wert-mess">Bögen ${m.boegen}: Menge belegt <b>${m.menge_belegt}</b>, Wert belegt <b>${m.wert_belegt}</b>`
    + (an ? ` · <span class="am">mit Annahmen: Menge ${m.menge_annahme}, Wert als Rechnung ${m.wert_annahme}</span>` : ` · unbekannt: Menge ${m.menge_offen + m.menge_annahme}, Wert ${m.wert_offen + m.wert_annahme}`)
    + ` · Obergrenze aus Länderstrom an ${m.obergrenzen} Bogen.</p>`
    + `<p class="hinweis">${an ? `<span class="am">Wert = ${esc(pb.formel)}. Metallwert des enthaltenen Kupfers; echte Lieferpreise weichen ab.</span>` : 'Belegt: Wert nur, wenn eine Quelle ihn nennt; Menge × Preis ist hier gesperrt.'}</p>`
    + (T ? `<p class="hinweis" id="tiefe-mess">Datentiefe je Glied: belegt <b>${T.belegt} von ${T.zellen}</b> Feldern${an ? ` · <span class="am">mit Annahmen gefüllt ${T.mit_annahmen} von ${T.zellen}</span>` : ''}.</p>` : '');
}
// Kasten "In 2 Minuten": drei Saetze fuer jemanden, der das Projekt nicht kennt (Abnahmeliste Punkt 11).
const LAND = {CD: 'DR Kongo', AO: 'Angola', IT: 'Italien', DE: 'Deutschland', SG: 'Singapur'};
const mio = x => x.toLocaleString('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1});
function ebenen(daten, an) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), n = s => `${nr(s)}. ${s.kurz}`;
  const V = daten.verbindungen.filter(v => v.ebene === 'BELEGT' || (an && v.ebene === 'ANNAHME'));
  const ware = [S[daten.ausfall.mine]];
  for (let k = 0; k < 20; k++) {
    const v = V.find(x => x.ebene === 'BELEGT' && ['VERARBEITUNG', 'LIEFERUNG'].includes(x.art) && x.von === ware.at(-1).id);
    if (!v) break; ware.push(S[v.nach]);
  }
  const kante = v => `${n(S[v.von])} → ${n(S[v.nach])}${v.ebene === 'ANNAHME' ? ' (Annahme)' : ''}`;
  return {ware: ware.map(n).join(' → '), wareKurz: ware.map(s => s.kurz.replace(/ \(.*\)$/, '')).join(' → '),
    transport: V.filter(v => v.art === 'TRANSPORT').map(kante), handel: V.filter(v => v.art === 'HANDEL').map(kante)};
}
function kurzHtml(daten) {
  const an = status.ansicht === 'annahmen', A = daten.ausfall, S = Object.fromEntries(daten.standorte.map(s => [s.id, s]));
  const mine = S[A.mine], lief = S[A.lieferant], kunde = S[A.kunde];
  const stufen = [...new Set(daten.standorte.map(s => s.stufe))].sort((a, b) => a - b);
  const E = ebenen(daten, an);
  const g = A.glieder.find(x => x.standort === A.lieferant).ansichten[status.ansicht];
  const t = g.tonnen.annahme, mk = g.mehrkosten, du = g.dauer;
  let fehlt = `${esc(kunde.kurz)} verliert den einzigen erfassten Kupferlieferanten dieser Kette. `;
  if (an && t) {
    fehlt += `<span class="am">Annahme: ≈ ${esc(kurzZahl(t.kt))} kt ${esc(t.einheit.replace(/^kt /, '').replace('/Jahr', ''))} pro Jahr fehlen`;
    if (mk.status === 'ANNAHME') fehlt += `, Mehrkosten ≈ ${mio(mk.je_jahr.mio_eur)} Mio. € pro Jahr`;
    if (du.status === 'ANNAHME' && mk.ueber_dauer) fehlt += `, bei ≈ ${esc(String(du.annahme.wert).replace('.', ','))} Monaten Ausfall ≈ ${mio(mk.ueber_dauer.mio_eur)} Mio. €`;
    fehlt += '.</span> Belegt ist keine dieser Zahlen.';
  } else fehlt += 'Liefermenge, Mehrkosten und Dauer sind in keiner gelesenen Quelle genannt: <span class="unbekannt">unbekannt</span> (Ansicht „Mit Annahmen“ zeigt Schätzwerte).';
  const nAlt = S[A.lieferant].alternativen?.length || 0;
  fehlt += ` Ein bestätigter Ersatzlieferant ist <b>nicht bekannt</b>${nAlt ? `; ${nAlt} Hütten gleicher Art kämen in Frage (türkis, „möglich“), ob sie liefern würden, ist offen` : ''}.`;
  return `<p class="eyebrow">In 2 Minuten</p><ol>`
    + `<li data-kurz="herkunft"><b>Woher?</b> Aus der ${esc(mine.kurz)} (${esc(LAND[mine.land] || mine.land || 'Land unbekannt')}).</li>`
    + `<li data-kurz="weg"><b>Über welche Glieder?</b> Ware: ${esc(E.ware)}. `
    + `Transport der Anoden: ${esc(E.transport.join('; '))}${an ? '' : '; der Seeweg ab Lobito nach Hamburg ist nicht belegt'}. `
    + `Verkauf teils über den Händler: ${esc(E.handel.join('; '))}. `
    + `<small>Orange Bögen = Ware wird dort weiterverarbeitet (Liefer­beziehung, kein Fahrweg); blau = Transport; lila = Handel.</small></li>`
    + `<li data-kurz="ausfall"><b>Fällt ${esc(lief.kurz.replace(/ \(.*\)$/, ''))} aus?</b> ${fehlt}</li></ol>`
    + `<p class="hinweis">Gelb markiert = Annahme. Alles andere hat eine gelesene Quelle; was fehlt, steht als „unbekannt“ da.</p>`;
}
function antwort(daten) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s]));
  const ende = Math.max(...daten.standorte.map(s => s.stufe));
  const z = daten.zaehler, an = status.ansicht === 'annahmen';
  const zuKunde = daten.verbindungen.filter(v => S[v.nach].stufe === ende && v.ebene === 'BELEGT');
  const zeilen = [`Belegter Weg bis zum Kunden: ${z.verbindungen} Verbindungen, ${z.verbindungen_freigegeben} freigegeben, ${z.verbindungen_kandidat} Kandidat.`];
  for (const v of zuKunde) {
    zeilen.push(`${esc(S[v.von].kurz)} → ${esc(S[v.nach].kurz)}: ${esc(FREIGABE_TEXT[v.freigabe])}.`);
    const b = v.mengen.find(m => m.groesse === 'LIEFERMENGE' && m.ebene === 'BELEGT');
    zeilen.push(b.wert === null ? `Menge: <span class="unbekannt">unbekannt</span> (${esc(b.grund_unbekannt)})` : `Menge: ${wertText(b)}`);
    const a = v.mengen.find(m => m.groesse === 'LIEFERMENGE' && m.ebene === 'ANNAHME');
    if (an && a) zeilen.push(`<span class="am">Annahme: ${wertText(a)}, ${esc(a.annahme.art)}, Konfidenz ${konf(a.annahme.konfidenz)}.</span>`);
    const w = bogenWerte(v);
    zeilen.push(`Wert: ${w.wert.art === 'U' ? '<span class="unbekannt">unbekannt</span> (keine Quelle nennt ihn)' : w.wert.art === 'A' ? `<span class="am">${w.wert.text} (Rechnung aus der Annahme, LME-Kasse ÷ EZB-Kurs)</span>` : w.wert.text}`
      + (w.og ? `; Obergrenze Länderstrom ${esc(w.og.einheit.split(' ').pop())} ${esc(w.og.zeitraum[0].slice(0, 4))}: ${wertText(w.og)}, ${wertText(w.ow)} (alle Firmen).` : '.'));
  }
  if (an) zeilen.push(`<span class="am">Mit Annahmen: ${z.annahmen_verbindungen} angenommene Wege, ${z.annahmen_mengen} angenommene Mengen; Liefermenge an ${z.verbindungen_mit_liefermenge_inkl_annahmen} von ${z.verbindungen + z.annahmen_verbindungen} Verbindungen (belegt: ${z.verbindungen_mit_liefermenge}).</span>`);
  return `<div class="frage"><p class="eyebrow">Kundenfrage ${esc(daten.kundenfrage.kunde)}</p><p><b>${esc(daten.kundenfrage.frage)}</b></p><ul id="antwort">${zeilen.map(t => `<li>${t}</li>`).join('')}</ul></div>`;
}
function panel(daten) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s]));
  const z = daten.zaehler, an = status.ansicht === 'annahmen';
  $('titel').textContent = `${daten.rohstoff}: ${daten.kette.replaceAll('->', '→')}`;
  $('einleitung').textContent = daten.begruendung;
  for (const b of document.querySelectorAll('[data-ansicht]')) b.setAttribute('aria-pressed', String(b.dataset.ansicht === status.ansicht));
  $('ansicht-text').textContent = daten.ansichten[status.ansicht];
  $('kurz').innerHTML = kurzHtml(daten);
  $('frage').innerHTML = antwort(daten);
  $('kpis').innerHTML = [
    [an ? z.verbindungen + z.annahmen_verbindungen : z.verbindungen, an ? 'Verbindungen (inkl. Annahmen)' : 'Verbindungen'], [`${z.verbindungen_freigegeben}/${z.verbindungen}`, 'belegte freigegeben'], [z.standorte, 'Standorte'],
    [z.mengen_belegt, 'Mengenangaben belegt'], an ? [z.annahmen_mengen, 'Mengenangaben als Annahme'] : [z.mengen_unbekannt, 'Mengenangaben unbekannt'], [z.quellen, 'Quellen'],
  ].map(([w, t]) => `<div class="kpi"><strong>${esc(w)}</strong><span>${esc(t)}</span></div>`).join('');
  $('glieder').innerHTML = gliederHtml(daten);
  $('alternativen').innerHTML = alternativenHtml(daten);
  const am = daten.ausfall.messung.alternativen;
  $('alternativen-mess').innerHTML = `${am.ausweichquellen} Ausweichquellen · Glieder mit mindestens 2: <b>${am.glieder_mit_mind_2} von ${daten.ausfall.messung.glieder}</b> · Kapazität belegt bei ${am.kapazitaet_belegt}`
    + (an ? ` · <span class="am">nur als Annahme bei ${am.kapazitaet_nur_annahme}</span>` : ` · unbekannt bei ${am.ausweichquellen - am.kapazitaet_belegt}`);
  ausfallKnoepfe(daten);
  risikoPanel(daten);
  $('wert').innerHTML = wertPanel(daten);
  $('liste').innerHTML = daten.verbindungen.filter(zeigen).map(v => {
    const gleich = S[v.von].ort.lat === S[v.nach].ort.lat && S[v.von].ort.lon === S[v.nach].ort.lon;
    return `<li><button type="button" data-verbindung="${esc(v.id)}" data-ebene="${esc(v.ebene)}" aria-pressed="false"><b>${esc(v.id)}</b> ${esc(S[v.von].name)} → ${esc(S[v.nach].name)}`
      + `<small>${esc(ART_TEXT[v.art])} · ${esc(v.ware)} · ${listenMenge(v)}${gleich ? ' · am selben Standort' : ''}</small>${chips(v)}</button></li>`;
  }).join('');
  $('ausdruck-ansicht').textContent = an ? 'Mit Annahmen' : 'Belegt';
  $('fuss').innerHTML = `Stand ${esc(daten.stand)} · Daten: <a href="/kupferkette/kette.json">kette.json</a> (${esc(daten.schema)}, aus ${esc(daten.db_schema)}) · ${daten.regeln.map(esc).join(' ')}`;
}

function detail(daten, auswahl) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), Q = daten.quellen;
  for (const b of document.querySelectorAll('[data-verbindung]')) b.setAttribute('aria-pressed', String(auswahl?.typ === 'verbindung' && b.dataset.verbindung === auswahl.id));
  for (const b of document.querySelectorAll('[data-glied]')) b.setAttribute('aria-pressed', String(auswahl?.typ === 'standort' && b.dataset.glied === auswahl.id));
  for (const b of document.querySelectorAll('[data-ausfall]')) b.setAttribute('aria-pressed', String(auswahl?.typ === 'ausfall' && b.dataset.ausfall === auswahl.id));
  for (const b of document.querySelectorAll('#alternativen [data-alternative]')) b.setAttribute('aria-pressed', String(auswahl?.typ === 'alternative' && b.dataset.alternative === auswahl.id));
  for (const b of document.querySelectorAll('[data-risiko-feld]')) b.setAttribute('aria-pressed', String(auswahl?.typ === 'risiko' && b.dataset.risikoFeld === auswahl.id));
  if (!auswahl) { $('detail').innerHTML = '<p class="hinweis">Verbindung in der Liste, Bogen oder Ort auf dem Globus antippen: Quelle und Zitat erscheinen hier.</p>'; return; }
  if (auswahl.typ === 'ausfall') { $('detail').innerHTML = ausfallHtml(daten, auswahl.id); return; }
  if (auswahl.typ === 'alternative') { $('detail').innerHTML = alternativeDetail(daten, auswahl.id); return; }
  if (auswahl.typ === 'risiko') { const [sid, kat] = auswahl.id.split(':'); $('detail').innerHTML = risikoFeldHtml(daten, sid, kat); return; }
  if (auswahl.typ === 'verbindung') {
    const v = daten.verbindungen.find(x => x.id === auswahl.id);
    const quelle = v.ebene === 'ANNAHME' ? `<h3 style="font-size:14px;margin:10px 0 2px">Begründung (keine Quelle)</h3>${annahmeHtml(v.annahme, Q)}`
      : `<h3 style="font-size:14px;margin:10px 0 2px">Quelle</h3>${belegeHtml(v.belege, Q)}`;
    $('detail').innerHTML = `<h2>${esc(S[v.von].name)} → ${esc(S[v.nach].name)}</h2>${chips(v)}<dl>`
      + `<dt>Art</dt><dd>${esc(ART_TEXT[v.art])} (${esc(v.art_atlas)})${v.transportweg ? ', ' + esc(v.transportweg === 'RAIL' ? 'Bahn' : v.transportweg) : ''}</dd>`
      + `<dt>Ware</dt><dd>${esc(v.ware)}</dd><dt>Stand</dt><dd>${esc(v.stand)} (${v.ebene === 'ANNAHME' ? 'Stand des Annahmen-Atlas' : 'Datum der Quelle'})</dd>`
      + `<dt>Freigabe</dt><dd>${esc(v.freigabe_herkunft)}</dd>${v.einschraenkung ? `<dt>Einschränkung</dt><dd>${esc(v.einschraenkung)}</dd>` : ''}</dl>`
      + quelle
      + `<h3 style="font-size:14px;margin:10px 0 2px">Menge und Wert pro Jahr</h3>`
      + v.mengen.filter(zeigen).sort((a, b) => a.groesse.startsWith('LAENDERSTROM') - b.groesse.startsWith('LAENDERSTROM')).map(m => mengeHtml(m, Q, daten)).join('')
      + (status.ansicht === 'annahmen' ? (daten.wert?.hinweise || []).filter(h => h.verbindung === v.id).map(h => `<p class="lage" data-wert-hinweis>${esc(h.text)}</p>`).join('') : '')
      + gliedAnnahmenHtml(v, Q)
      + v.hinweise.map(h => `<div class="ub"><b>Hinweis (${esc(h.stand)}):</b> ${esc(h.text)}${belegeHtml(h.belege, Q)}</div>`).join('');
  } else {
    const s = S[auswahl.id];
    const ort = s.ort.lat === null ? '<span class="unbekannt">unbekannt</span>' : `${zahl(s.ort.lat)}, ${zahl(s.ort.lon)} (${esc(s.ort.genauigkeit)}, ${esc(FREIGABE_TEXT[s.ort.freigabe])})`;
    const mengen = s.mengen.filter(zeigen);
    $('detail').innerHTML = `<h2>${esc(s.name)}</h2><dl><dt>Rolle</dt><dd>${esc(nr(s))}. ${esc(s.rolle)}</dd><dt>Land</dt><dd>${s.land ? esc(s.land) : '<span class="unbekannt">unbekannt</span>'}</dd>`
      + `<dt>Unternehmen</dt><dd>${s.firma ? esc(s.firma) : '<span class="unbekannt">unbekannt</span>'}${s.betreiber_einschraenkung ? ` <small>(${esc(s.betreiber_einschraenkung)})</small>` : ''}</dd>`
      + `<dt>Ort</dt><dd>${ort}</dd></dl>` + gliedAnnahmenHtml(s, Q)
      + (mengen.length ? mengen.map(m => mengeHtml(m, Q, daten)).join('') : '<div class="ub" data-unbekannt><b>Menge:</b> <span class="unbekannt">unbekannt</span><br>Für diesen Standort nennt keine gelesene Quelle eine Menge.</div>')
      + (s.betreiber_belege.length ? `<h3 style="font-size:14px;margin:10px 0 2px">Beleg Betreiber</h3>${belegeHtml(s.betreiber_belege, Q)}` : '')
      + `<h3 style="font-size:14px;margin:10px 0 2px">Eigentümer</h3>${eigentumHtml(s, Q)}`
      + (daten.eigentumskette ? `<h3 style="font-size:14px;margin:10px 0 2px">Eigentümerkette bis oben</h3>${eigentumsketteHtml(daten, s)}` : '')
      + `<h3 style="font-size:14px;margin:10px 0 2px">Risiko</h3>${risikoHtml(s, Q)}`
      + (s.risikoebene ? `<h3 style="font-size:14px;margin:10px 0 2px">Risiko-Ebene</h3><div data-risiko-glied>${daten.risikoebene.kategorien.map(k => risikoFeldHtml(daten, s.id, k.id, false)).join('')}</div>` : '')
      + (s.alternativen?.length ? `<h3 style="font-size:14px;margin:10px 0 2px">Ausweichquellen (türkis auf dem Globus)</h3><ul>${s.alternativen.map(i => daten.alternativen.find(a => a.id === i)).map(a => `<li><button type="button" class="link" data-alternative="${esc(a.id)}">${esc(a.kurz)}</button> <small>${kapazitaetKurz(a)}</small></li>`).join('')}</ul>` : '')
      + `<h3 style="font-size:14px;margin:10px 0 2px">Beleg Ort</h3>${belegeHtml(s.ort.belege, Q)}`;
  }
}

// --- Gesprächsausdruck (PDF) ----------------------------------------------------------------------------------------------
function ausdruck(daten) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), sel = $('ausdruck-glied'), knopf = $('ausdruck-pdf');
  sel.innerHTML = daten.ausfall.glieder.map(g => `<option value="${esc(g.standort)}">${esc(S[g.standort].stufe)}. ${esc(S[g.standort].kurz)} fällt aus</option>`).join('');
  sel.value = daten.ausfall.glieder.some(g => g.standort === 'S7') ? 'S7' : daten.ausfall.glieder.at(-1).standort;   // Standard: direkter Lieferant des Kunden
  knopf.addEventListener('click', async () => {
    knopf.disabled = true; $('ausdruck-status').textContent = 'PDF wird erzeugt …';
    try {
      const {gespraechsausdruck} = await import('./kupferkette-pdf.mjs');
      const r = await gespraechsausdruck(daten, {ansicht: status.ansicht, ausfall: sel.value});
      const url = URL.createObjectURL(new Blob([r.bytes], {type: 'application/pdf'}));
      const a = document.createElement('a'); a.href = url; a.download = r.name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      status.pdf = {name: r.name, seiten: r.seiten, bytes: r.bytes.length, ansicht: r.ansicht, ausfall: r.ausfall, quellen: r.quellen, quellen_gezeigt: r.quellen_gezeigt,
        ueberlauf: r.ueberlauf, karte: r.karte, schrift_min: r.schrift_min, y1: r.y1, unten: r.unten};
      $('ausdruck-status').textContent = `${r.name} erzeugt (${r.seiten} Seiten, ${Math.round(r.bytes.length / 1024)} KB, ${r.quellen} Quellen).`;
    } catch (e) { $('ausdruck-status').textContent = 'PDF konnte nicht erzeugt werden: ' + e.message; status.pdf = {fehler: e.message}; }
    finally { knopf.disabled = false; }
  });
}

async function start() {
  let daten;
  try {
    const r = await fetch('/kupferkette/kette.json');
    if (!r.ok) throw Error('kette.json ' + r.status);
    daten = await r.json();
    if (daten.schema !== 'atlas.kupferkette-globus/7') throw Error('unbekanntes Schema ' + daten.schema);
  } catch (e) { $('titel').textContent = 'Kupferkette konnte nicht geladen werden'; $('detail').innerHTML = `<p class="fehler">${esc(e.message)}</p>`; return; }
  nummern(daten);
  const par = new URLSearchParams(location.search);
  status.ansicht = par.get('ansicht') === 'annahmen' ? 'annahmen' : 'belegt';
  panel(daten);
  let globus = null;
  const waehle = a => {
    if (a?.typ === 'verbindung' && !zeigen(daten.verbindungen.find(v => v.id === a.id))) a = null;
    status.auswahl = a; detail(daten, a); globus?.hebe(a);
    const url = new URL(location.href); url.searchParams.delete('w'); url.searchParams.delete('ausfall');
    if (a) url.searchParams.set(a.typ === 'ausfall' ? 'ausfall' : 'w', a.id);
    if (status.ansicht === 'annahmen') url.searchParams.set('ansicht', 'annahmen'); else url.searchParams.delete('ansicht');
    if (status.risiko) url.searchParams.set('risiko', status.risikoKat); else url.searchParams.delete('risiko');
    history.replaceState(null, '', url);
    if (a && ['ausfall', 'standort'].includes(a.typ) && daten.ausfall.glieder.some(g => g.standort === a.id)) $('ausdruck-glied').value = a.id;
  };
  const risikoAn = (an, kat = status.risikoKat) => {
    status.risiko = an; status.risikoKat = kat; risikoPanel(daten); globus?.risiko();
    $('globus').classList.toggle('mit-risiko', an); waehle(status.auswahl);
  };
  $('umschalter').addEventListener('click', e => {
    const b = e.target.closest('[data-ansicht]'); if (!b || b.dataset.ansicht === status.ansicht) return;
    status.ansicht = b.dataset.ansicht; panel(daten); globus?.risiko(); waehle(status.auswahl);
  });
  $('ausfall-knoepfe').addEventListener('click', e => { const b = e.target.closest('[data-ausfall]'); if (b) waehle({typ: 'ausfall', id: b.dataset.ausfall}); });
  $('ausfall-an').addEventListener('click', () => {
    status.ausfallModus = !status.ausfallModus; $('ausfall-an').setAttribute('aria-pressed', String(status.ausfallModus));
    if (!status.ausfallModus && status.auswahl?.typ === 'ausfall') waehle(null);
  });
  $('risiko-an').addEventListener('click', () => risikoAn(!status.risiko));
  $('risiko-kategorien').addEventListener('click', e => { const b = e.target.closest('[data-risiko-kat]'); if (b) risikoAn(true, b.dataset.risikoKat); });
  $('risiko-matrix').addEventListener('click', e => { const b = e.target.closest('[data-risiko-feld]'); if (b) waehle({typ: 'risiko', id: b.dataset.risikoFeld}); });
  $('glieder').addEventListener('click', e => { const b = e.target.closest('[data-glied]'); if (b) waehle({typ: 'standort', id: b.dataset.glied}); });
  $('liste').addEventListener('click', e => { const b = e.target.closest('[data-verbindung]'); if (b) waehle({typ: 'verbindung', id: b.dataset.verbindung}); });
  $('panel').addEventListener('click', e => { const b = e.target.closest('[data-alternative]'); if (b) waehle({typ: 'alternative', id: b.dataset.alternative}); });
  ausdruck(daten);
  $('legende-knopf')?.addEventListener('click', () => {
    const auf = $('globus').classList.toggle('legende-offen'); $('legende-knopf').setAttribute('aria-expanded', String(auf));
  });
  try { globus = baueGlobus(daten, waehle); } catch (e) { $('globus').insertAdjacentHTML('beforeend', `<p class="fehler">3D-Ansicht nicht verfügbar: ${esc(e.message)}</p>`); }
  const w = par.get('w'), af = par.get('ausfall'), rk = par.get('risiko');
  if (rk && daten.risikoebene) risikoAn(true, rk === 'ALLE' || daten.risikoebene.kategorien.some(k => k.id === rk) ? rk : 'ALLE');
  const rf = w && w.includes(':') && daten.risikoebene ? w.split(':') : null;
  if (af && daten.ausfall.glieder.some(g => g.standort === af)) { status.ausfallModus = true; $('ausfall-an').setAttribute('aria-pressed', 'true'); waehle({typ: 'ausfall', id: af}); }
  else if (rf && daten.standorte.some(s => s.id === rf[0]) && daten.risikoebene.kategorien.some(k => k.id === rf[1])) waehle({typ: 'risiko', id: w});
  else waehle(w && daten.verbindungen.some(v => v.id === w) ? {typ: 'verbindung', id: w} : w && daten.standorte.some(s => s.id === w) ? {typ: 'standort', id: w}
    : w && (daten.alternativen || []).some(a => a.id === w) ? {typ: 'alternative', id: w} : null);
  status.geladen = true;
  if (par.get('test') === '1') testmodus(daten);
}

// Testmodus ?test=1 (Abnahmeliste Punkt 11): drei Fragen, Zeit je Frage, Bildrate beim Drehen, Ergebniszeile zum Weitergeben.
// Speichert und sendet nichts; die Zeile zeigt nur die Seite selbst an.
function testmodus(daten) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), A = daten.ausfall;
  const mische = (arr, n) => { const k = (n * 2 + 1) % arr.length; return arr.slice(k).concat(arr.slice(0, k)); };   // richtige Antwort wandert
  const ohneKlammer = t => t.replace(/ \(.*\)$/, '');
  const E = ebenen(daten, false);
  const fragen = [
    {id: 'F1', text: 'Woher kommt das Kupfer?', richtig: `${S[A.mine].kurz} (${LAND[S[A.mine].land] || S[A.mine].land})`,
     falsch: [['chile', 'Escondida (Chile)'], ['aurubis', `${ohneKlammer(S[A.lieferant].kurz)} (Deutschland)`]]},
    {id: 'F2', text: 'Welchen Weg nimmt das Kupfer als Ware bis zum Kunden?',
     richtig: E.wareKurz + ' (Transport über Kolwezi und Lobito, Verkauf teils über Trafigura)',   // wie Kasten "In 2 Minuten"
     falsch: [['direkt', `${ohneKlammer(S[A.mine].kurz)} → ${ohneKlammer(S[A.kunde].kurz)} (direkt)`], ['umgekehrt', `${ohneKlammer(S[A.mine].kurz)} → Hafen Lobito → ${ohneKlammer(S[A.kunde].kurz)} → ${ohneKlammer(S[A.lieferant].kurz)}`]]},
    {id: 'F3', text: `Was fehlt ${ohneKlammer(S[A.kunde].kurz)}, wenn ${ohneKlammer(S[A.lieferant].kurz)} ausfällt?`,
     richtig: 'Der einzige erfasste Kupferlieferant dieser Kette; ein bestätigter Ersatz ist nicht bekannt',
     falsch: [['ersatz', 'Nichts, ein Ersatzlieferant ist bestätigt'], ['lobito', 'Nur der Hafen Lobito']]},
  ];
  const box = document.createElement('section');
  box.id = 'testmodus'; box.className = 'testmodus'; box.setAttribute('aria-label', 'Verständnistest');
  document.body.append(box);
  const geraet = innerWidth < 600 ? 'handy' : 'laptop', erg = [];
  let t0 = 0, tf = 0, i = 0;
  // Bildrate: Frames zaehlen, solange ein Finger/die Maus auf dem Globus gedrueckt ist (die Seite zeichnet dann jedes Bild neu).
  const fps = {bilder: 0, ms: 0, schlimmstes: 0}; let druck = false, letzt = 0;
  const schleife = t => { if (!druck) return; if (letzt) { const d = t - letzt; fps.bilder++; fps.ms += d; fps.schlimmstes = Math.max(fps.schlimmstes, d); } letzt = t; requestAnimationFrame(schleife); };
  const g = document.getElementById('globus');
  g.addEventListener('pointerdown', () => { if (!druck) { druck = true; letzt = 0; requestAnimationFrame(schleife); } });
  addEventListener('pointerup', () => { druck = false; });
  addEventListener('pointercancel', () => { druck = false; });
  const zeige = () => {
    if (!t0) {
      box.innerHTML = `<p><b>Verständnistest</b> (3 Fragen). Bitte ohne Hilfe beantworten; du darfst die Seite benutzen, den Globus drehen und antippen. Die Zeit läuft ab „Start“.</p><button type="button" id="test-start">Start</button>`;
      return;
    }
    if (i < fragen.length) {
      const f = fragen[i], opt = mische([['richtig', f.richtig], ...f.falsch], i);
      box.innerHTML = `<p class="eyebrow">Frage ${i + 1} von ${fragen.length}</p><p><b>${esc(f.text)}</b></p>`
        + opt.map(([code, o]) => `<button type="button" class="test-antwort" data-richtig="${code === 'richtig'}" data-code="${code}">${esc(o)}</button>`).join('')
        + `<button type="button" class="test-weiss-nicht" data-richtig="false" data-weiss-nicht>Weiß ich nicht</button>`
        + `<button type="button" class="test-zu" aria-expanded="true">einklappen</button>`;
      return;
    }
    const sek = Math.round((performance.now() - t0) / 1000), ok = erg.filter(e => e.ok).length;
    const f = fps.ms > 0 ? Math.round(fps.bilder / fps.ms * 1000) : null;
    const zeile = `K11 ${geraet} ${new Date().toISOString().slice(0, 16)}Z t=${sek}s richtig=${ok}/3 `
      + erg.map(e => `${e.id}${e.ok ? '+' : e.wn ? '?' : `-${e.code}-`}${e.s}s`).join(' ')
      + ` fps=${f === null ? 'nicht gedreht' : `${f} (gedreht ${(fps.ms / 1000).toFixed(1)}s, langsamstes Bild ${Math.round(fps.schlimmstes)}ms)`}`
      + ` ansicht=${status.ansicht} fenster=${innerWidth}x${innerHeight} dpr=${devicePixelRatio}`;
    status.test = {zeile, sek, richtig: ok, fps: f};
    box.innerHTML = `<p><b>Fertig.</b> ${ok} von 3 richtig in ${sek} s. Bitte diese Zeile an Claude schicken:</p><textarea readonly id="test-zeile" rows="3">${esc(zeile)}</textarea><button type="button" id="test-kopie">Kopieren</button>`;
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'test-start') { t0 = tf = performance.now(); zeige(); return; }
    if (b.id === 'test-kopie') { const t = document.getElementById('test-zeile'); t.select(); navigator.clipboard?.writeText(t.value).catch(() => {}); b.textContent = 'Kopiert'; return; }
    if (b.classList.contains('test-zu')) { const zu = box.classList.toggle('zu'); b.textContent = zu ? 'Frage zeigen' : 'einklappen'; b.setAttribute('aria-expanded', String(!zu)); return; }
    if (b.dataset.richtig !== undefined) {
      const jetzt = performance.now();
      erg.push({id: fragen[i].id, ok: b.dataset.richtig === 'true', wn: 'weissNicht' in b.dataset, code: b.dataset.code, s: Math.round((jetzt - tf) / 1000)});
      tf = jetzt; i++; box.classList.remove('zu'); zeige();
    }
  });
  status.test = {zeile: null};
  zeige();
}
start();
