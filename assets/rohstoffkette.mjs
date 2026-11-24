// Rohstoffkette (Eddie 2026-11-16: "Bring jede VF auf den Stand von Kupfer"): rendert AUSSCHLIESSLICH ./kette.json, den Export
// von scripts/analysis/rohstoffe/rohstoffkette.py. Gleiche Sicht wie /kupferkette/: Glieder mit Eigentümer und Risiko, jede
// Verbindung mit Zitat und Quelle, Menge und Wert je Bogen, Ausfall-Simulation, Ausweichquellen, Datentiefe je Glied.
// Die Seite rechnet und bewertet nichts; alle Texte, Folgen und Zähler stehen fertig in kette.json. Globus = Motor des
// Hauptglobus (globe-scene.js), die Kette ist eine eigene Ebene (engine.addLayer), wie bei der Kupferkette.
import * as THREE from 'three';
import {createGlobe} from './globe-scene.js';
import {geoVector, vectorGeo} from './globe-math.mjs';

const FARBE = {VERARBEITUNG: 0xe39b3c, TRANSPORT: 0x38a8e0, HANDEL: 0x9a7fd6, LIEFERUNG: 0xe8643c};
const ART_TEXT = {VERARBEITUNG: 'Weiterverarbeitung (Lieferbeziehung)', TRANSPORT: 'Transport', HANDEL: 'Abnahmevertrag', LIEFERUNG: 'Lieferung'};
const EVIDENZ_TEXT = {FACT: 'Fakt laut Quelle (freigegebener Fluss)', CANDIDATE: 'laut Quelle, Evidenzstatus vorläufig (Generator setzt nie FACT)', INFERENCE: 'Schlussfolgerung', UNKNOWN: 'unbekannt'};
const KOPF = {'Eigentümer/Betreiber': 'Eigent.', 'Lieferbeziehung': 'Liefer.'};
const TS = {belegt: 'belegt', kandidat: 'Kandidat', unbekannt: 'unbekannt'};
const FREIGABE_TEXT = {FREIGEGEBEN: 'freigegeben', KANDIDAT: 'Kandidat, Zweitprüfung offen'};
const zahl = w => Number(w).toLocaleString('de-DE', {maximumFractionDigits: 2});
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const $ = id => document.getElementById(id);
// Eigentümerkette je Glied (Paket 3): Baum fertig aus kette.json, gleiche Darstellung wie /kupferkette/.
const EK_CHIP = {VOLLSTAENDIG_FREIGEGEBEN: 'f', VOLLSTAENDIG_KANDIDAT: 'k', OFFEN: 'u', UNBEKANNT: 'u'};
const EK_SCHLUSS_CHIP = {ENDE: 'f', OBERSTE: 'f', GESCHLOSSEN: '', OFFEN: 'u', UNTER_SCHWELLE: 'a'};
const ekProzent = a => a === null ? '' : `${zahl(a)} %`;
function ekBelege(belege, Q) {
  if (!belege.length) return '<p class="ub"><span class="unbekannt">Quelle: unbekannt</span></p>';
  return belege.map(b => { const q = Q[b.quelle];
    return `<blockquote data-beleg>„${esc(b.zitat)}“<cite>${b.rolle === 'zusatzbeleg' ? 'Zusatzbeleg' : 'Beleg'} · Zitat aus: <a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.herausgeber)}: ${esc(q.titel)}</a>`
      + ` · gelesen ${esc(q.abgerufen)}${b.fundstelle ? ` · ${esc(b.fundstelle)}` : ''}</cite></blockquote>`; }).join('');
}
function ekBaumHtml(ek, b, stufe = 0) {
  const Q = ek.quellen, k = ek.knoten[b.knoten], e = b.kante ? ek.kanten.find(x => x.id === b.kante) : null;
  const anteil = e ? (e.anteil !== null ? `${ekProzent(e.anteil)} ${esc(e.mass_text)}` : esc(e.text || 'Anteil nicht genannt')) : '';
  const eff = e && b.effektiv !== null && stufe > 1 ? ` <small>(durchgerechnet ${ekProzent(b.effektiv)})</small>` : '';
  const kopf = `<b>${esc(k.name)}</b> <small>${esc(k.art_text)}${k.land ? ' · ' + esc(k.land) : ''}${k.lei ? ' · LEI ' + esc(k.lei) : ''}</small>`
    + (e ? ` <span data-ek-anteil>${anteil}</span>${eff}` : '') + ` <span class="chip ${EK_SCHLUSS_CHIP[b.schluss]}" data-ek-schluss="${esc(b.schluss)}">${esc(b.schluss_text)}</span>`
    + (e ? ` <span class="chip ${e.freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}">${esc(FREIGABE_TEXT[e.freigabe])}</span>` : '');
  const infos = [];
  if (e) infos.push(`<div class="hinweis">${e.text && e.anteil !== null ? esc(e.text) + ' · ' : ''}Stand ${esc(e.stand)}${e.zu_pruefen ? ' <span class="chip k" data-r8="zu-pruefen" title="Datenregel R8: Eigentümer-Angabe älter als 18 Monate; wird nicht gelöscht oder herabgestuft">zu prüfen (älter als 18 Monate)</span>' : ''} · ${esc(e.freigabe_herkunft)}${e.einschraenkung ? ` · ${esc(e.einschraenkung)}` : ''}</div>`
    + `<details class="ek-belege"><summary>Beleg Anteil (${e.belege.length})</summary>${ekBelege(e.belege, Q)}</details>`);
  if (k.oberste) infos.push(`<div class="hinweis"><b>Oberste Gesellschaft:</b> ${esc(k.oberste.text)} <span class="chip ${k.oberste.freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}" data-ek-oberste-freigabe>${esc(FREIGABE_TEXT[k.oberste.freigabe])}</span>`
    + (k.oberste.geschlossen ? ` <span class="chip d" data-ek-geschlossen="${esc(k.oberste.geschlossen.schlussart)}" title="${esc(k.oberste.geschlossen.schlussart_text)}">${k.oberste.geschlossen.gilt ? 'geschlossen' : 'Schluss offen'}: ${esc(k.oberste.geschlossen.schlussart_text)}</span>` : '') + '</div>'
    + `<details class="ek-belege"><summary>Beleg oberste Gesellschaft (${k.oberste.belege.length})</summary>${ekBelege(k.oberste.belege, Q)}</details>`);
  if (k.belege.length) infos.push(`<details class="ek-belege"><summary>Beleg ${esc(k.art_text)} (${k.belege.length})</summary>${ekBelege(k.belege, Q)}</details>`);
  if (k.hinweis) infos.push(`<div class="hinweis">${esc(k.hinweis)}</div>`);
  if (b.schluss === 'OFFEN' || b.schluss === 'UNTER_SCHWELLE') infos.push(`<div class="ub" data-unbekannt><b>Eigentümer:</b> <span class="unbekannt">unbekannt</span><br>${esc(k.offen || 'Keine gelesene Quelle nennt die Eigentümer.')}</div>`);
  const kinder = b.kinder.map(c => ekBaumHtml(ek, c, stufe + 1)).join('');
  return `<details class="ek" data-ek-knoten="${esc(b.knoten)}" data-pflicht="${b.pflicht}"${stufe < 2 || (b.pflicht && stufe < 4) ? ' open' : ''}><summary>${kopf}</summary>`
    + `<div class="ek-inhalt">${infos.join('')}${kinder ? `<div class="ek-kinder">${kinder}</div>` : ''}</div></details>`;
}
function eigentumsketteHtml(ek, s) {
  const g = ek.glieder[s.id], Q = ek.quellen;
  let h = `<div data-eigentumskette="${esc(s.id)}" data-ek-status="${esc(g.status)}"><p><span class="chip ${EK_CHIP[g.status]}">${esc(g.status_text)}</span>`
    + `${g.ebenen ? ` <small>${g.ebenen} Ebene${g.ebenen > 1 ? 'n' : ''} über dem Glied · Pflichtpfade ab ${zahl(ek.schwelle_prozent)} % durchgerechnetem Anteil</small>` : ''}</p>`;
  if (!g.baum) h += `<div class="ub" data-unbekannt><b>Eigentümer:</b> <span class="unbekannt">unbekannt</span><br>${esc(g.grund)}</div>`;
  else {
    if (g.bezug === 'ZUGEHOERIG') h += `<div class="hinweis">${esc(g.bezug_text)}: <b>${esc(ek.knoten[g.wurzel].name)}</b> <span class="chip ${g.bezug_freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}" data-ek-bezug-freigabe>${esc(FREIGABE_TEXT[g.bezug_freigabe])}</span>`
      + `${g.einschraenkung ? ` · ${esc(g.einschraenkung)}` : ''}</div><details class="ek-belege"><summary>Beleg Zugehörigkeit (${g.bezug_belege.length})</summary>${ekBelege(g.bezug_belege, Q)}</details>`;
    else if (g.einschraenkung) h += `<div class="hinweis">${esc(g.einschraenkung)}</div>`;
    h += `<div class="ek-baum">${ekBaumHtml(ek, g.baum)}</div>`;
  }
  if (g.betreiber) h += `<p class="hinweis" style="margin-top:8px"><b>Betreiber (nicht Eigentümer):</b> ${esc(ek.knoten[g.betreiber.baum.knoten].name)} ${esc(g.betreiber.text)}</p>`
    + `<details class="ek-belege"><summary>Beleg Betreiber (${g.betreiber.belege.length})</summary>${ekBelege(g.betreiber.belege, Q)}</details>`
    + `<div class="ek-baum" data-ek-betreiber>${ekBaumHtml(ek, g.betreiber.baum)}</div>`;
  return h + '</div>';
}
function eigentumKurz(ek, s) {
  const g = ek.glieder[s.id];
  const wer = g.baum ? esc(ek.knoten[g.wurzel].name) + (g.bezug === 'ZUGEHOERIG' ? ' (Zugehörigkeit)' : '') : g.betreiber ? esc(ek.knoten[g.betreiber.baum.knoten].name) + ' (Betreiber)' : '<span class="unbekannt">unbekannt</span>';
  return `${wer} <span class="chip ${EK_CHIP[g.status]}" data-ek-kurz="${esc(g.status)}">${esc(g.status_text)}</span>`;
}
// Risiko-Ebene je Glied (Paket 4): 4 Kategorien wie /kupferkette/, Texte fertig aus kette.json.
const RE_BEZUG = {STANDORT: 'Standort', FIRMA: 'Firma', LAND: 'Landesebene'};
function risikoKurz(s) {
  const f = s.risikoebene, n = Object.values(f).filter(x => x.status === 'BELEGT').length;
  return `<span class="chip ${n ? 'f' : 'u'}" data-re-kurz="${n}">${n}/4 belegt</span>`;
}
function risikoFeldInhalt(f) {
  return f.status === 'BELEGT' ? f.belegt.map(e => `${esc(e.text)} <span class="chip f">belegt (${esc(RE_BEZUG[e.bezug])})</span>`
    + e.quellen.map(q => q.zitat ? `<blockquote data-beleg>„${esc(q.zitat)}“<cite>${link(q.url, (q.herausgeber || '') + ': ' + (q.titel || ''))}${q.stand ? ` · Stand ${esc(q.stand)}` : ''}${q.fundstelle ? ` · ${esc(q.fundstelle)}` : ''}</cite></blockquote>` : ` ${link(q.url, q.herausgeber || 'Quelle')}`).join('')).join('<br>')
    : `<span class="unbekannt">unbekannt</span> – ${esc(f.grund)}`;
}
function risikoLand(s) {
  const L = s.risiko_land;
  return `<p class="hinweis" data-re-land="${esc(L.iso2 || 'UNKNOWN')}">Land für die Risiko-Ebene: ${L.iso2 ? `<b>${esc(L.name)}</b> – ${esc(L.herkunft)}` : `<span class="unbekannt">unbekannt</span> – ${esc(L.herkunft)}`}</p>`;
}
function risikoHtml(d, s) {
  let h = risikoLand(s) + '<dl class="re">';
  for (const k of d.risikoebene.kategorien) {
    const f = s.risikoebene[k.id];
    h += `<dt>${esc(k.text)}</dt><dd data-re="${k.id}" data-re-status="${f.status}">${risikoFeldInhalt(f)}</dd>`;
  }
  return h + '</dl>';
}
// Risiko-Ebene auf dem Globus (Abnahmeliste "kontaktreif" Punkt 8, wie /kupferkette/): ein-/ausschaltbar, Kategorie wählbar,
// Ring je Ort und Buchstaben je Glied. Farbe = Belegstand, nicht Schwere. BS = belegt am Standort/an der Firma, BL = belegt nur
// Landesebene, U = unbekannt. Die Rohstoffketten haben keine Risiko-Annahmen, daher kein Status "Annahme".
const RS = {BS: ['belegt', 'rs-bs', 0xe53935], BL: ['belegt (Land)', 'rs-bl', 0xffa726], U: ['unbekannt', 'rs-u', 0x8a5a00]};
const RS_KURZ = {BS: 'belegt', BL: 'Land', U: 'unbekannt'};
const RE_KURZ = {LAENDERRISIKO: 'L', SANKTIONEN: 'S', NATURGEFAHREN: 'N', KONZENTRATION: 'K'};
const MATRIX_KOPF = {LAENDERRISIKO: 'Länder', SANKTIONEN: 'Sanktion', NATURGEFAHREN: 'Natur', KONZENTRATION: 'Konzentr.'};
const feldStatus = f => f.status === 'BELEGT' && f.belegt.length ? (f.belegt.some(e => e.bezug !== 'LAND') ? 'BS' : 'BL') : 'U';
const rang = st => ['U', 'BL', 'BS'].indexOf(st);
const katListe = re => status.risikoKat === 'ALLE' ? Object.keys(RE_KURZ).filter(k => k in re) : [status.risikoKat];   // Reihenfolge L S N K wie die Matrix
const gliedStatus = s => katListe(s.risikoebene).map(k => feldStatus(s.risikoebene[k])).sort((a, b) => rang(b) - rang(a))[0];
function ausweichHtml(d, a, name) {
  if (!a.liste.length) return `<p data-ausweich="0"><b>Ausweichquellen:</b> <span class="unbekannt">keine erfasst</span> – ${esc(a.grund)}</p>`;
  const art = {NETZ: 'weitere erfasste Verbindung', LAND: 'anderes Förderland (Weltreferenz)', STANDORT: 'anderer Standort'};
  return `<p data-ausweich="${a.liste.length}"><b>Ausweichquellen mit Menge</b> (${a.mit_menge} von ${a.liste.length} mit belegter Menge; nicht addiert, keine bestätigte Ersatzlieferung):</p><ul class="aw">`
    + a.liste.map(x => `<li data-aw-art="${x.art}"><b>${x.glied ? name(x.glied) : esc(x.name)}</b> <small>${esc(art[x.art])}${x.art === 'NETZ' ? ` für ${name(x.fuer)} (${x.richtung === 'ZUFLUSS' ? 'weiterer Zufluss' : 'weiterer Abnehmer'})` : ''}</small>: `
      + (x.menge.evidenz === 'UNKNOWN' ? `<span class="unbekannt">Menge unbekannt</span>` : `${esc(x.menge.text)} <span class="chip f">belegt</span>`)
      + (x.lage ? ` · <span data-aw-lage title="${esc(x.lage.quelle)}">Lage ${lageText(x.lage)}</span>` : '')
      + (x.freigabe ? ` <span class="chip ${x.freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}" data-aw-freigabe="${x.freigabe}" title="${esc(x.freigabe_herkunft)}">${esc(FREIGABE_TEXT[x.freigabe])}</span>` : '')
      + (x.quelle ? ` · ${link(x.quelle.url, x.quelle.herausgeber)}${x.quelle.zitat ? `<blockquote data-beleg>„${esc(x.quelle.zitat)}“</blockquote>` : ''}` : '')
      + (x.hinweis ? `<br><span class="hinweis">${esc(x.hinweis)}</span>` : '') + '</li>').join('') + '</ul>';
}
const SUCHSTELLE = {jahresbericht: 'Jahresbericht', quartalsberichte_4: '4 Quartalsberichte', boersenmitteilungen_12_monate: 'Börsenmitteilungen 12 Monate', behoerde_register: 'Behörde/Register'};
const lageText = l => `${Math.abs(l.lat).toFixed(2).replace('.', ',')}° ${l.lat < 0 ? 'S' : 'N'}, ${Math.abs(l.lon).toFixed(2).replace('.', ',')}° ${l.lon < 0 ? 'W' : 'O'}`;
const link = (url, text) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text || 'Quelle')}</a>` : esc(text || '');
export const status = {geladen: false, knoten: 0, boegen: 0, auswahl: null, ausfall: null, rot: [], schilder: 0, ansicht: 'belegt',
  risiko: false, risikoKat: 'ALLE', risiko_ringe: 0, risiko_marken: 0};
// Menge und Wert je Bogen (Paket 5): "Belegt" zeigt nur Angaben laut Quelle, "Mit Annahmen" zusätzlich die Annahmen-Ebene,
// immer als Annahme markiert (wie /kupferkette/). Ausstoß und Obergrenze des liefernden Glieds stehen in beiden Ansichten daneben.
const an = () => status.ansicht === 'annahmen';
// Datenregel R5 (Eddie 2026-11-24): Schätzungen (GESCHAETZT) nur in der Ansicht „Mit Schätzungen“, nie als belegt, nie mit Annahmen gemischt.
const sch = () => status.ansicht === 'schaetzungen';
const ANSICHT_NAME = {belegt: 'Belegt', annahmen: 'Mit Annahmen', schaetzungen: 'Mit Schätzungen'};
// Abgeleitete Menge (Regel 4 gelockert): Rechnung aus freigegebenen Zitat-Zahlen, in beiden Ansichten, nie als belegt.
function schildArt(v) { return v.menge.evidenz !== 'UNKNOWN' ? 'B' : v.menge_abgeleitet ? 'D' : an() && v.menge_annahme ? 'A' : 'U'; }
function schildText(v) { return v.menge.evidenz !== 'UNKNOWN' ? v.menge.text : v.menge_abgeleitet ? v.menge_abgeleitet.text : an() && v.menge_annahme ? v.menge_annahme.text : '? t'; }
function mengeKurz(v) {
  if (v.menge.evidenz !== 'UNKNOWN') return esc(v.menge.text);
  if (v.menge_abgeleitet) return `${esc(v.menge_abgeleitet.text)} <i class="ab">(abgeleitet)</i>`;
  if (an() && v.menge_annahme) return `${esc(v.menge_annahme.text)} <i class="am">(Annahme)</i>`;
  return '<span class="unbekannt">unbekannt</span>';
}
function wertKurz(v) {
  if (v.wert.evidenz !== 'UNKNOWN') return esc(v.wert.text);
  if (v.wert_abgeleitet) return `${esc(v.wert_abgeleitet.text)} <i class="ab">(abgeleitet)</i>`;
  if (an() && v.wert_annahme?.evidenz === 'ANNAHME') return `${esc(v.wert_annahme.text)} <i class="am">(Annahme)</i>`;
  return '<span class="unbekannt">unbekannt</span>';
}
function belegeHtml(belege) {
  return (belege || []).map(b => `<blockquote data-beleg>„${esc(b.zitat)}“<cite>${esc(b.herausgeber || '')}, ${link(b.url, b.fundstelle)}${b.abgerufen ? ` · gelesen ${esc(b.abgerufen)}` : ''}</cite></blockquote>`).join('');
}
function frChip(x, attr) {
  return x.freigabe ? ` <span class="chip ${x.freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}" ${attr}="${x.freigabe}" title="${esc(x.freigabe_herkunft || '')}">${esc(FREIGABE_TEXT[x.freigabe])}</span>` : '';
}
function mengeWertDetail(v) {
  const m = v.menge, w = v.wert;
  let h = `<dt>Menge</dt><dd data-menge="${m.evidenz}">${m.evidenz === 'UNKNOWN' ? `<span class="unbekannt">unbekannt</span> – ${esc(m.grund)}` : `${esc(m.text)} <span class="chip f">belegt</span>${frChip(m, 'data-menge-freigabe')}${m.quelle_text && m.quelle_text !== m.text ? ` (Quelle: ${esc(m.quelle_text)})` : ''}${m.rechnung ? `<br><span class="hinweis">${esc(m.rechnung)}</span>` : ''}${m.hinweis ? `<br><span class="hinweis">${esc(m.hinweis)}</span>` : ''}`}</dd>`
    + `<dt>Wert</dt><dd data-wert="${w.evidenz}">${w.evidenz === 'UNKNOWN' ? `<span class="unbekannt">unbekannt</span> – ${esc(w.grund)}` : `${esc(w.text)} <span class="chip f">belegt</span>${w.quelle_text && w.quelle_text !== w.text ? ` (${esc(w.quelle_text)})` : ''}${w.rechnung ? `<br><span class="hinweis">${esc(w.rechnung)}</span>` : ''}`}</dd></dl>`;
  // Regel 4 gelockert (Eddie 2026-11-16): Ableitung aus freigegebenen Werten, in beiden Ansichten, nie als belegt
  const ab = v.wert_abgeleitet;
  if (ab && w.evidenz === 'UNKNOWN') h += `<div class="abgeleitet-box" data-wert-abgeleitet><b>Wert (abgeleitet):</b> ${esc(ab.text)} <span class="chip d">abgeleitet · Menge × Preis ÷ EZB</span>`
    + `<br><span class="hinweis">Rechenweg: ${esc(ab.rechenweg)}. ${esc(ab.hinweis || '')} Eingänge: ${ab.eingaenge.map(e => `${esc(e.name)} (${e.freigabe === 'AMTLICH' ? 'amtlich' : 'freigegeben'})`).join(', ')} · Preis: ${link(ab.preis_url, ab.preis_quelle)}</span>`
    + `<blockquote>„${esc(ab.preis_zitat)}“</blockquote></div>`;
  const ma = v.menge_abgeleitet;
  if (ma && m.evidenz === 'UNKNOWN') h += `<div class="abgeleitet-box" data-menge-abgeleitet><b>Menge (abgeleitet):</b> ${esc(ma.text)} <span class="chip d">abgeleitet · ${esc(ma.qualifier)}</span>`
    + `<br><span class="hinweis">Rechenweg: ${esc(ma.rechenweg)} = ${esc(ma.quelle_text)}. ${esc(ma.hinweis || '')} Eingänge: ${ma.eingaenge.map(e => `${esc(e.name)} (freigegeben)`).join(', ')}</span>`
    + `<details class="ek-belege"><summary>Belege der Eingänge (${ma.belege.length})</summary>${belegeHtml(ma.belege)}</details></div>`;
  if (m.belege?.length) h += `<details class="ek-belege" open><summary>Beleg Menge${w.beleg_id ? ' und Wert' : ''} (${m.belege.length})</summary>${belegeHtml(m.belege)}</details>`;
  for (const b of v.menge_bezug || [])
    h += `<div class="bezug-box" data-bezug="${b.art}"><b>${b.art === 'OBERGRENZE' ? 'Obergrenze' : 'Ausstoß des liefernden Glieds'}:</b> ${esc(b.text)} <span class="chip">${esc(b.art_text)}</span>${frChip(b, 'data-bezug-freigabe')}<br><span class="hinweis">${esc(b.quelle_text)}${b.rechnung ? ` · ${esc(b.rechnung)}` : ''}${b.hinweis ? ` · ${esc(b.hinweis)}` : ''}</span>`
      + `<details class="ek-belege"><summary>Beleg (${b.belege.length})</summary>${belegeHtml(b.belege)}</details></div>`;
  if (an()) {
    const am = v.menge_annahme, aw = v.wert_annahme;
    if (am) h += `<div class="annahme-box" data-annahme-menge><b>Menge (Annahme):</b> ${esc(am.text)} <span class="chip a">Annahme · ${esc(am.annahme_id)}${am.konfidenz_text ? ' · Konfidenz ' + esc(am.konfidenz_text) : ''}</span><br><span class="hinweis">${esc(am.grund)} · ${link(am.quelle_url, am.quelle)}</span></div>`;
    if (aw?.evidenz === 'ANNAHME' && !ab) h += `<div class="annahme-box" data-annahme-wert><b>Wert (Rechnung mit Annahme):</b> ${esc(aw.text)} <span class="chip a">Annahme · Menge × Preis ÷ EZB</span><br><span class="hinweis">${esc(aw.rechnung)} · Preis: ${link(aw.preis_url, aw.preis_quelle)}</span><blockquote class="annahme">„${esc(aw.preis_zitat)}“</blockquote></div>`;
    else if (aw && w.evidenz === 'UNKNOWN') h += `<div class="annahme-box" data-annahme-wert="UNKNOWN"><b>Wert mit Annahmen:</b> <span class="unbekannt">unbekannt</span> – ${esc(aw.grund)}</div>`;
    if (!am && !ma && m.evidenz === 'UNKNOWN') h += `<div class="annahme-box" data-annahme-menge="UNKNOWN"><b>Menge mit Annahmen:</b> <span class="unbekannt">unbekannt</span> – keine Annahme im Annahmen-Atlas für diese Fluss-ID.</div>`;
  }
  return h;
}
// Tagespreis (Abnahmeliste Punkt 9): Notierung mit Handelstag und EZB-Kurs, fertig aus kette.json; ohne Tagesnotierung der Grund.
function preisbasisHtml(d) {
  const pb = d.preisbasis;
  if (!pb) return `<p class="hinweis" id="preisbasis" data-preisbasis="KEIN"><b>Tagespreis:</b> <span class="unbekannt">keiner</span> – ${esc(d.preisbasis_grund)}</p>`;
  const p = pb.preis, k = pb.kurs, v = p.veraenderung_pct;
  return `<p class="hinweis" id="preisbasis" data-preisbasis="TAG" data-handelstag="${esc(p.datum)}"><b>Tagespreis:</b> ${esc(p.art)} <b>${zahl(p.wert)} ${esc(p.einheit)}</b>, Handelstag ${esc(p.datum)}`
    + `${v !== null && v !== undefined ? ` (${v > 0 ? '+' : ''}${zahl(v)} % zum Vortag)` : ''} · ${link(p.url, p.herausgeber)}, gelesen ${esc(p.abgerufen)} · `
    + `${esc(k.art)} ${k.wert.toLocaleString('de-DE', {minimumFractionDigits: 4})} ${esc(k.einheit)} vom ${esc(k.datum)} (${link(k.url, 'EZB über Eurostat')}) = ${zahl(Math.round(pb.eur_je_t))} € je t.`
    + ` Wert „mit Annahmen“: ${esc(pb.formel)}; ersetzt den ${esc(pb.ersetzt)}.</p>`;
}
window.__rohstoffkette = status;

const R = 100;
const vec = (lat, lon, r = 1) => new THREE.Vector3(...geoVector(lat, lon, r * R));
function bogenPunkte(a, b) {
  const va = vec(a.lat, a.lon).normalize(), vb = vec(b.lat, b.lon).normalize();
  const w = va.angleTo(vb), hoehe = 0.01 + Math.min(0.16, w * 0.12), pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64, p = new THREE.Vector3();
    if (w > 1e-6) { const s = Math.sin(w); p.copy(va).multiplyScalar(Math.sin((1 - t) * w) / s).add(vb.clone().multiplyScalar(Math.sin(t * w) / s)); } else p.copy(va);
    pts.push(p.multiplyScalar(R * (1.003 + hoehe * Math.sin(Math.PI * t))));
  }
  return pts;
}

function baueGlobus(d, waehle) {
  const host = $('globus');
  const engine = createGlobe($('globus-flaeche'), {space: true});
  let scene, camera, renderer, neu;
  engine.addLayer(m => { ({scene, camera, renderer} = m); neu = m.invalidate; });
  const S = Object.fromEntries(d.standorte.map(s => [s.id, s]));
  const gruppen = new Map();
  for (const s of d.standorte) {
    if (s.ort.lat === null) continue;
    const k = `${s.ort.lat.toFixed(3)},${s.ort.lon.toFixed(3)}`;
    if (!gruppen.has(k)) gruppen.set(k, {lat: s.ort.lat, lon: s.ort.lon, standorte: []});
    gruppen.get(k).standorte.push(s);
  }
  const marken = [], ringe = [];
  for (const g of gruppen.values()) {
    const p = vec(g.lat, g.lon, 1.004);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshBasicMaterial({color: 0xffd27a}));
    m.position.copy(p); scene.add(m);
    // Ring der Risiko-Ebene: Farbe = bester Belegstand der Glieder an diesem Ort (aus, bis der Schalter an ist)
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.6, 40), new THREE.MeshBasicMaterial({color: RS.U[2], transparent: true, opacity: 0.95, side: THREE.DoubleSide}));
    ring.position.copy(vec(g.lat, g.lon, 1.005)); ring.lookAt(ring.position.clone().multiplyScalar(2)); ring.visible = false; scene.add(ring);
    ringe.push({ring, standorte: g.standorte});
    g.standorte.forEach(s => {
      const b = document.createElement('button');
      b.className = 'marke'; b.type = 'button'; b.dataset.standort = s.id; b.setAttribute('aria-pressed', 'false');
      b.textContent = `${s.id.slice(1)}. ${s.kurz}`; b.title = `${s.rolle}: ${s.name}`;
      b.addEventListener('click', () => waehle({typ: 'standort', id: s.id}));
      host.append(b); marken.push({el: b, pos: p, id: s.id});
    });
  }
  const boegen = [], schilder = [];
  for (const v of d.verbindungen) {
    const a = S[v.von].ort, b = S[v.nach].ort;
    if (a.lat === null || b.lat === null || (a.lat === b.lat && a.lon === b.lon)) continue;
    const pts = bogenPunkte(a, b), gestrichelt = v.art === 'HANDEL';
    const mat = new THREE.MeshBasicMaterial({color: FARBE[v.art], transparent: true, opacity: 1});
    const gr = new THREE.Group(); gr.userData = {verbindung: v.id, farbe: FARBE[v.art], mat};
    const stuecke = gestrichelt ? [] : [pts];
    if (gestrichelt) for (let i = 0; i + 2 < pts.length; i += 4) stuecke.push(pts.slice(i, i + 3));
    for (const st of stuecke) { const r = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(st), Math.max(2, st.length * 2), 0.55, 6, false), mat); r.userData.verbindung = v.id; gr.add(r); }
    scene.add(gr); boegen.push(gr);
    const sch = document.createElement('button');
    sch.className = 'schild'; sch.type = 'button'; sch.dataset.schild = v.id; sch.dataset.art = schildArt(v);
    sch.textContent = schildText(v);
    sch.title = `${S[v.von].kurz} → ${S[v.nach].kurz}: ${schildText(v)}${schildArt(v) === 'A' ? ' (Annahme)' : schildArt(v) === 'D' ? ' (abgeleitet)' : ''}`;
    sch.addEventListener('click', () => waehle({typ: 'verbindung', id: v.id}));
    host.append(sch); schilder.push({el: sch, pos: pts[32].clone(), id: v.id});
  }
  status.knoten = marken.length; status.boegen = boegen.length;
  const ray = new THREE.Raycaster(); let unten = null;
  renderer.domElement.addEventListener('pointerdown', e => { unten = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!unten || Math.hypot(e.clientX - unten[0], e.clientY - unten[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    const t = ray.intersectObjects(boegen, true)[0];
    if (t) waehle({typ: 'verbindung', id: t.object.userData.verbindung});
  });
  // Blick: Mittelpunkt der verorteten Glieder
  const orte = d.standorte.filter(s => s.ort.lat !== null);
  if (orte.length) {
    const m = orte.reduce((v, s) => v.add(vec(s.ort.lat, s.ort.lon).normalize()), new THREE.Vector3()).normalize();
    const {lat, lon} = vectorGeo(m.toArray());
    const weit = orte.some(s => vec(s.ort.lat, s.ort.lon).normalize().dot(m) < 0.3);
    engine.focusLocation(lat, lon, weit ? 380 : 300);
  }
  const kompakt = () => host.clientWidth < 600;
  function bild() {
    const w = host.clientWidth, h = host.clientHeight, cam = camera.position.clone().normalize(), belegt = [];
    const a = status.auswahl, zeigeSchild = sc => !kompakt() || (a && (a.id === sc.id || (a.typ === 'standort' && d.verbindungen.some(v => v.id === sc.id && (v.von === a.id || v.nach === a.id)))));
    status.schilder = 0;
    const liste = marken.concat(schilder.filter(zeigeSchild)).map(m => { const p = m.pos.clone().project(camera); return {m, x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, sichtbar: m.pos.clone().normalize().dot(cam) > 0.15 && Math.abs(p.x) <= 1.05 && Math.abs(p.y) <= 1.05}; }).sort((p, q) => q.y - p.y);
    for (const sc of schilder) sc.el.classList.add('weg');
    for (const e of liste) {
      e.m.el.classList.toggle('weg', !e.sichtbar);
      if (!e.sichtbar) continue;
      if (e.m.el.classList.contains('schild')) status.schilder++;
      const bw = e.m.el.offsetWidth || 120, bh = (e.m.el.offsetHeight || 20) + 3; let y = e.y;
      for (let n = 0; n < 12; n++) { const k = belegt.find(r => Math.abs(r.x - e.x) < (r.w + bw) / 2 && Math.abs(r.y - y) < bh); if (!k) break; y = k.y - bh; }
      belegt.push({x: e.x, y, w: bw}); e.m.el.style.left = `${e.x}px`; e.m.el.style.top = `${y}px`;
    }
  }
  engine.onCameraView(bild); neu();
  return {
    risiko() {
      status.risiko_ringe = 0;
      for (const r of ringe) {
        r.ring.visible = status.risiko;
        const st = r.standorte.map(gliedStatus).sort((a, b) => rang(b) - rang(a))[0];
        r.ring.material.color.setHex(RS[st][2]); r.ring.material.opacity = st === 'U' ? 0.55 : 0.95;
        if (r.ring.visible) status.risiko_ringe++;
      }
      status.risiko_marken = 0;
      for (const m of marken) {
        m.el.querySelector('.rbadge')?.remove();
        if (!status.risiko) continue;
        const re = S[m.id].risikoebene, b = document.createElement('span');
        b.className = 'rbadge'; b.setAttribute('aria-hidden', 'true');
        b.innerHTML = katListe(re).map(k => { const st = feldStatus(re[k]); return `<i class="rq ${RS[st][1]}" data-rq="${k}:${st}" title="${esc(k)}: ${esc(RS[st][0])}">${RE_KURZ[k]}</i>`; }).join('');
        m.el.append(b); status.risiko_marken++;
      }
      $('globus').classList.toggle('mit-risiko', status.risiko);
      neu();
    },
    hebe() {
      const a = status.auswahl, rot = new Set(status.rot), aid = a?.typ === 'risiko' ? a.id.split(':')[0] : a?.id;
      for (const g of boegen) {
        const v = g.userData.verbindung, an = !a || a.id === v || (a.typ === 'standort' && d.verbindungen.some(x => x.id === v && (x.von === a.id || x.nach === a.id)));
        g.userData.mat.color.setHex(rot.has(v) ? 0xc62828 : g.userData.farbe); g.userData.mat.opacity = an || rot.has(v) ? 1 : 0.25;
      }
      for (const m of marken) {
        m.el.setAttribute('aria-pressed', String(!!a && aid === m.id));
        m.el.classList.toggle('aus', status.ausfall === m.id);
        m.el.classList.toggle('betroffen', !!status.ausfall && (d.ausfall[status.ausfall].ohne_zufluss.includes(m.id) || d.ausfall[status.ausfall].ohne_abfluss.includes(m.id)));
      }
      for (const s of schilder) {
        const v = d.verbindungen.find(x => x.id === s.id);
        s.el.setAttribute('aria-pressed', String(!!a && a.id === s.id)); s.el.dataset.art = schildArt(v); s.el.textContent = schildText(v);
        s.el.title = `${S[v.von].kurz} → ${S[v.nach].kurz}: ${schildText(v)}${schildArt(v) === 'A' ? ' (Annahme)' : schildArt(v) === 'D' ? ' (abgeleitet)' : ''}`;
      }
      neu();
    },
  };
}

function render(d) {
  const S = Object.fromEntries(d.standorte.map(s => [s.id, s])), z = d.zaehler;
  const name = id => `${id.slice(1)}. ${esc(S[id].kurz)}`;
  document.title = `${d.rohstoff}kette ${d.kette.text} · Marktatlas`;
  $('titel').textContent = `${d.rohstoff}kette: ${d.kette.text}`;
  $('frage').innerHTML = `<p><b>Kundenfrage:</b> ${esc(d.kundenfrage.frage)}</p><p><b>Antwort aus den Daten:</b> ${esc(d.kundenfrage.antwort)}</p>`
    + `<p class="hinweis">Weltreferenz: ${d.weltreferenz.status === 'FREIGEGEBEN' ? link(d.weltreferenz.url, d.weltreferenz.quelle) + ' (freigegeben)' : `<span class="unbekannt">keine</span> – ${esc(d.weltreferenz.grund)}`}</p>`
    + preisbasisHtml(d);
  const kpi = (w, t) => `<div class="kpi"><strong>${esc(w)}</strong><span>${esc(t)}</span></div>`;
  const kpis = () => { $('kpis').innerHTML = kpi(`${z.verbindungen_freigegeben}/${z.verbindungen}`, 'Verbindungen freigegeben')
    + kpi(`${z.standorte_mit_ort}/${z.standorte}`, 'Glieder verortet')
    + (an() ? kpi(`${z.mengen_mit_annahmen}/${z.verbindungen}`, `Bögen mit Menge in t, mit Annahmen (belegt ${z.mengen_in_tonnen})`) + kpi(`${z.werte_mit_annahmen}/${z.verbindungen}`, `Bögen mit Wert in €, mit Annahmen (belegt ${z.werte_in_euro})`)
      : kpi(`${z.mengen_in_tonnen}/${z.verbindungen}`, `Bögen mit Menge in t laut Quelle${z.mengen_belegt > z.mengen_in_tonnen ? ` (+${z.mengen_belegt - z.mengen_in_tonnen} nur als Text)` : ''}`) + kpi(`${z.werte_in_euro}/${z.verbindungen}`, 'Bögen mit Wert in € laut Quelle'))
    + kpi(`${z.eigentum_belegt}/${z.standorte}`, `Glieder mit belegtem Eigentümer (bis oben ${z.eigentumskette_vollstaendig}, freigegeben ${z.eigentumskette_freigegeben})`)
    + kpi(an() ? `${z.tiefe_mit_annahmen}/${z.tiefe_gesamt}` : `${z.tiefe_belegt}/${z.tiefe_gesamt}`, an() ? `Datentiefe mit Mengen-/Wert-Annahmen (belegt ${z.tiefe_belegt})` : 'Datentiefe belegt (Felder)')
    + kpi(`${z.risikoebene_belegt}/${z.risikoebene_felder}`, 'Risiko-Ebene belegt (Glieder × 4)') + kpi(`${z.ausfall_mit_ausweich_menge}/${z.standorte}`, 'Ausfälle mit Ausweichquelle samt Menge'); };
  kpis();
  // Datentiefe
  $('tiefe-text').textContent = `${d.tiefe.belegt} von ${d.tiefe.gesamt} Feldern belegt (${d.standorte.length} Glieder × 6 Dimensionen, gleiche Zählung wie die Kupferkette). Kandidaten zählen nicht als belegt.`;
  $('tiefe-matrix').innerHTML = `<thead><tr><th>Glied</th>${d.tiefe.dimensionen.map(x => `<th title="${esc(x)}">${esc(KOPF[x] || x)}</th>`).join('')}</tr></thead><tbody>`
    + d.tiefe.zeilen.map(r => `<tr><th>${name(r.id)}</th>${d.tiefe.dimensionen.map(x => `<td><span class="ts ts-${r.felder[x]}">${TS[r.felder[x]]}</span></td>`).join('')}</tr>`).join('') + '</tbody>';
  // Ausfall-Knoepfe
  $('ausfall-knoepfe').innerHTML = d.standorte.map(s => `<button type="button" data-ausfall="${s.id}" aria-pressed="false">${name(s.id)}</button>`).join('');
  $('ausfall-knoepfe').addEventListener('click', e => { const b = e.target.closest('button[data-ausfall]'); if (b) waehle({typ: 'standort', id: b.dataset.ausfall, ausfall: true}); });
  // Glieder
  $('glieder').innerHTML = d.standorte.map(s => `<li><button type="button" data-standort="${s.id}" aria-pressed="false"><b>${name(s.id)}</b> · ${esc(s.rolle)} · ${esc(s.land)}`
    + `<small>Eigentümer: ${eigentumKurz(d.eigentumskette, s)}`
    + ` · Risiko: ${risikoKurz(s)}`
    + `${s.ort.lat === null ? ' · <span class="chip u">ohne Koordinate</span>' : ''}</small></button></li>`).join('');
  $('glieder').addEventListener('click', e => { const b = e.target.closest('button[data-standort]'); if (b) waehle({typ: 'standort', id: b.dataset.standort}); });
  // Verbindungen
  const liste = () => { $('liste').innerHTML = d.verbindungen.map(v => `<li><button type="button" data-verbindung="${v.id}" aria-pressed="${String(status.auswahl?.id === v.id)}"><b>${name(v.von)} → ${name(v.nach)}</b>`
    + `<small>${esc(ART_TEXT[v.art])} · ${esc(v.ware || '')} · Menge: ${mengeKurz(v)} · Wert: ${wertKurz(v)}`
    + `${v.menge_bezug?.length ? ` · <i class="am">${v.menge_bezug.map(b => (b.art === 'OBERGRENZE' ? 'Obergrenze ' : 'Ausstoß ') + esc(b.text)).join(', ')}</i>` : ''}`
    + ` <span class="chip f">freigegeben</span>${v.auf_globus ? '' : '<span class="chip u">nicht auf dem Globus</span>'}</small></button></li>`).join(''); };
  liste();
  $('liste').addEventListener('click', e => { const b = e.target.closest('button[data-verbindung]'); if (b) waehle({typ: 'verbindung', id: b.dataset.verbindung}); });
  $('fuss').innerHTML = `Stand ${esc(d.stand || 'unbekannt')} · Daten: <a href="./kette.json">kette.json</a> (${esc(d.schema)}) · ${d.regeln.map(esc).join(' ')}`;

  function detailVerbindung(v) {
    return `<h2>${name(v.von)} → ${name(v.nach)}</h2><p>${esc(v.aussage || '')}</p><dl>`
      + `<dt>Art</dt><dd>${esc(ART_TEXT[v.art])} (${esc(v.art_atlas)})</dd><dt>Ware</dt><dd>${esc(v.ware || 'unbekannt')}</dd>`
      + `<dt>Stand</dt><dd>${esc(v.stand || 'unbekannt')}</dd><dt>Evidenz</dt><dd>${esc(EVIDENZ_TEXT[v.evidenz] || v.evidenz)}</dd>`
      + `<dt>Freigabe</dt><dd>freigegeben (${esc(v.freigabe_herkunft)}), Fluss ${esc(v.flow_id)}</dd>`
      + mengeWertDetail(v) + '<p class="hinweis" style="margin:8px 0 2px"><b>Beleg der Verbindung</b></p>'
      + v.belege.map(b => `<blockquote>„${esc(b.zitat)}“<cite>${esc(b.herausgeber || '')}, ${link(b.url, b.fundstelle)}</cite></blockquote>`).join('');
  }
  // Standortrisiken mit Zitat (Störung/Betriebsrisiko, Naturgefahr am Standort; Paket A7), Freigabe sichtbar
  function standortRisikenHtml(s) {
    const r = (s.risiko || []).filter(x => x.art === 'BETRIEB' || x.art === 'NATURGEFAHR');
    if (!r.length) return '';
    return `<h3 style="font-size:14px;margin:10px 0 2px">Störungen und Standortrisiken (mit Quelle)</h3>` + r.map(x =>
      `<p data-standortrisiko="${esc(x.id)}" style="margin:6px 0 2px"><b>${esc(x.art_text)}:</b> ${esc(x.text)} <span class="chip ${x.freigabe === 'FREIGEGEBEN' ? 'f' : 'k'}">${x.freigabe === 'FREIGEGEBEN' ? 'freigegeben' : 'Kandidat'}</span></p>`
      + x.belege.map(b => `<blockquote>„${esc(b.zitat)}“<cite>${esc(b.herausgeber || '')}, ${link(b.url, b.titel)}</cite></blockquote>`).join('')
      + `<p class="hinweis">${esc(x.freigabe_herkunft)}</p>`).join('');
  }
  function detailStandort(s) {
    return `<h2>${name(s.id)}</h2><p class="hinweis">${esc(s.name)}</p><dl><dt>Rolle</dt><dd>${esc(s.rolle)} (Stufe ${s.stufe})</dd><dt>Land</dt><dd>${esc(s.land)}</dd>`
      + `<dt>Standort</dt><dd>${s.ort.lat === null ? `<span class="unbekannt">unbekannt</span> – ${esc(s.ort.grund)}` : `${s.ort.lat.toFixed(3)}, ${s.ort.lon.toFixed(3)} · ${link(s.ort.url, s.ort.quelle || 'Quelle')}`}</dd>`
      + `</dl><h3 style="font-size:14px;margin:10px 0 2px">Risiko-Ebene</h3>${risikoHtml(d, s)}`
      + standortRisikenHtml(s)
      + `<h3 style="font-size:14px;margin:10px 0 2px">Eigentümerkette bis oben</h3>${eigentumsketteHtml(d.eigentumskette, s)}`
      + (s.eigentuemer.length ? `<p class="hinweis" style="margin-top:8px"><b>Altliste (nicht geprüft):</b> ${s.eigentuemer.map(e => `${esc(e.name)} <span class="chip k">Kandidat</span> ${link(e.url, 'Altliste')}`).join('; ')}</p>` : '');
  }
  function risikoPanel() {
    const R = d.risikoebene, m = R.messung, K = Object.fromEntries(R.kategorien.map(k => [k.id, k.text]));
    $('risiko-an').setAttribute('aria-pressed', String(status.risiko));
    $('risiko-kategorien').innerHTML = [['ALLE', 'Alle']].concat(R.kategorien.map(k => [k.id, k.text]))
      .map(([id, t]) => `<button type="button" data-risiko-kat="${esc(id)}" aria-pressed="${status.risikoKat === id}">${esc(t)}</button>`).join('');
    $('risiko-mess').innerHTML = `Belegt: <b>${m.belegt} von ${m.felder}</b> Feldern (${zahl(m.anteil_belegt_prozent)} %; ${m.glieder} Glieder × ${R.kategorien.length} Kategorien), `
      + `davon ${m.belegt_standort_oder_firma} am Standort/an der Firma, ${m.belegt_nur_landesebene} nur Landesebene · unbekannt ${m.unbekannt}`;
    $('risiko-matrix').innerHTML = `<thead><tr><th>Glied</th>${R.kategorien.map(k => `<th title="${esc(k.text)}">${esc(MATRIX_KOPF[k.id] || k.text)}</th>`).join('')}</tr></thead><tbody>`
      + d.standorte.map(s => `<tr><th title="${esc(s.name)}">${name(s.id)}</th>${R.kategorien.map(k => { const st = feldStatus(s.risikoebene[k.id]);
        return `<td><button type="button" data-risiko-feld="${esc(s.id)}:${esc(k.id)}" aria-pressed="${String(status.auswahl?.typ === 'risiko' && status.auswahl.id === `${s.id}:${k.id}`)}" aria-label="${esc(s.kurz)}, ${esc(K[k.id])}: ${esc(RS[st][0])}"><span class="rs ${RS[st][1]}" data-rs="${st}">${esc(RS_KURZ[st])}</span></button></td>`; }).join('')}</tr>`).join('')
      + '</tbody>';
    $('risiko-regeln').textContent = R.regeln.join(' ');
  }
  function detailRisiko(id) {
    const [sid, kat] = id.split(':'), s = S[sid], f = s.risikoebene[kat], st = feldStatus(f);
    const k = d.risikoebene.kategorien.find(x => x.id === kat);
    return `<h2>${esc(k.text)}: ${name(sid)}</h2><p class="eyebrow">Risiko-Ebene · <span class="rs ${RS[st][1]}" data-rs="${st}">${esc(RS[st][0])}</span></p>${risikoLand(s)}`
      + `<div data-re="${kat}" data-re-status="${f.status}">${risikoFeldInhalt(f)}</div>`;
  }
  function folgen(id) {
    const a = d.ausfall[id], liste = ids => ids.length ? ids.map(name).join(', ') : 'keines';
    return `<div class="folge"><h3>Ausfall ${name(id)}</h3><p>Betroffene Verbindungen: ${a.verbindungen_weg.length}.</p>`
      + `<p><b>Verlieren jeden erfassten Zufluss:</b> ${liste(a.ohne_zufluss)}</p><p><b>Verlieren jeden erfassten Abnehmer:</b> ${liste(a.ohne_abfluss)}</p>`
      + `<p><b>Mengen der betroffenen Bögen</b> (nicht addiert): ${a.mengen.map(m => `${name(d.verbindungen.find(v => v.id === m.verbindung).von)}→${name(d.verbindungen.find(v => v.id === m.verbindung).nach)}: ${m.evidenz === 'UNKNOWN' ? '<span class="unbekannt">unbekannt</span>' : esc(m.text)}`).join(' · ')}</p>`
      + ausweichHtml(d, a.ausweich, name)
      + ausfallRechnung('Fehlende Tonnen', 'tonnen', a.tonnen, p => `${esc(p.rechenweg)}. ${esc(p.hinweis || '')}`)
      + ausfallRechnung('Mehrkosten', 'mehrkosten', a.mehrkosten, p => `${esc(p.rechenweg)}. ${esc(p.hinweis || '')} Preis: ${link(p.preis_url, p.preis_quelle)}<blockquote>„${esc(p.preis_zitat)}“</blockquote>`)
      + dauerHtml(a.dauer) + '</div>';
  }
  function dauerHtml(f) {
    const s = f.schaetzung;
    if (!s || !sch()) return `<p data-ausfall-feld="dauer" data-evidenz="UNKNOWN" data-wissen="${f.evidenz}" data-luecke-grund="${esc(f.luecke_grund || '')}"><b>Dauer:</b> <span class="unbekannt">unbekannt</span> – ${esc(f.grund)}`
      + (s ? ' <span class="hinweis">Schätzung vorhanden: Ansicht „Mit Schätzungen“.</span>' : '') + '</p>';
    const z = x => String(x).replace('.', ',');
    return `<div class="schaetz-box" data-ausfall-feld="dauer" data-evidenz="GESCHAETZT" data-methode="${esc(s.methode)}"><b>Dauer (geschätzt):</b> ${z(s.spanne[0])}–${z(s.spanne[1])} ${esc(s.einheit)} <span class="chip g">geschätzt</span>`
      + `<br><span class="hinweis">Ursache: ${esc(s.ursache_text || s.ursache)} · Methode: Vergleichsfall (${esc(s.methode)}) · Konfidenz ${esc(s.konfidenz.toLowerCase())} · erneut suchen ab ${esc(s.pruefen_ab)}. Nie belegt, nie freigegeben, kein Eingang einer Rechnung.</span>`
      + `<br><span class="hinweis">Rechenweg: ${esc(s.rechenweg)}</span>`
      + s.anker.map(x => `<br><span class="hinweis">Anker: ${esc(x.name)} · ${link(x.url, x.quelle)} · blind zweitgeprüft (${esc(x.zweitpruefung?.pruefmodell || '')}, ${esc(x.zweitpruefung?.geprueft_am || '')})</span><blockquote data-beleg>„${esc(x.zitat)}“</blockquote>`).join('')
      + `<br><span class="hinweis">Suchprotokoll (Lückengrund nicht veröffentlicht): ${Object.entries(f.suchprotokoll || {}).map(([k, v]) => `${link(v.url, SUCHSTELLE[k] || k)} (${esc(v.abgerufen)})`).join(' · ')}</span></div>`;
  }
  // Regel 4 gelockert (Eddie 2026-11-16): Tonnen und Mehrkosten ABGELEITET aus freigegebenen Eingängen, Rechenweg sichtbar, nie belegt
  function ausfallRechnung(titel, feld, f, weg) {
    if (f.evidenz !== 'ABGELEITET') return `<p data-ausfall-feld="${feld}" data-evidenz="${f.evidenz}"><b>${titel}:</b> <span class="unbekannt">unbekannt</span> – ${esc(f.grund)}</p>`;
    return `<div class="abgeleitet-box" data-ausfall-feld="${feld}" data-evidenz="ABGELEITET"><b>${titel} (abgeleitet):</b> ${esc(f.text)} <span class="chip d">abgeleitet</span>`
      + f.posten.map(p => `<br><span class="hinweis">Rechenweg: ${weg(p)} Eingänge: ${p.eingaenge.map(e => `${esc(e.name)} (${e.freigabe === 'AMTLICH' ? 'amtlich' : 'freigegeben'})`).join(', ')}</span>`).join('')
      + (f.kapazitaet ? `<br><span class="hinweis">${esc(f.kapazitaet)}</span>` : '') + (f.grund ? `<br><span class="hinweis">${esc(f.grund)}</span>` : '') + '</div>';
  }
  let globus = null;
  function waehle(a) {
    status.auswahl = a;
    status.ausfall = a && a.typ === 'standort' ? a.id : null;
    status.rot = status.ausfall ? d.ausfall[status.ausfall].verbindungen_weg : [];
    for (const b of document.querySelectorAll('[data-standort],[data-verbindung],[data-ausfall],[data-risiko-feld]'))
      b.setAttribute('aria-pressed', String(!!a && (b.dataset.standort === a.id || b.dataset.verbindung === a.id || b.dataset.ausfall === a.id || b.dataset.risikoFeld === a.id)));
    $('detail').innerHTML = !a ? '' : a.typ === 'verbindung' ? detailVerbindung(d.verbindungen.find(v => v.id === a.id)) : a.typ === 'risiko' ? detailRisiko(a.id) : detailStandort(S[a.id]);
    if (a?.typ === 'risiko') $('detail').scrollIntoView({block: 'nearest'});
    $('ausfall-folgen').innerHTML = status.ausfall ? folgen(status.ausfall) : '';
    if (status.ausfall) $('ausdruck-glied').value = status.ausfall;   // Ausdruck übernimmt das gewählte Glied
    if (a?.ausfall) $('ausfall-folgen').scrollIntoView({block: 'nearest'});
    globus?.hebe();
    const u = new URL(location.href);
    const P = {verbindung: 'v', standort: 's', risiko: 'w'};
    for (const k of Object.values(P)) if (!a || P[a.typ] !== k) u.searchParams.delete(k);
    if (a) u.searchParams.set(P[a.typ], a.id);
    if (status.risiko) u.searchParams.set('risiko', status.risikoKat); else u.searchParams.delete('risiko');
    history.replaceState(null, '', u);
  }
  const nGesch = Object.values(d.ausfall).filter(a => a.dauer.evidenz === 'GESCHAETZT').length;
  const ansichtText = () => { $('ansicht-text').textContent = sch()
    ? `Mit Schätzungen: zusätzlich zu den belegten Angaben verankerte Schätzungen (Spanne, Methode aus festem Katalog, gelesene und blind zweitgeprüfte Anker-Quelle, nur wo das Suchprotokoll keinen veröffentlichten Wert fand). Schätzungen zählen nie als belegt. Wiederanlaufdauer geschätzt bei ${nGesch} von ${Object.keys(d.ausfall).length} Gliedern.`
    : an() ? `Mit Annahmen: Bögen ohne belegte Menge zeigen die Menge des Annahmen-Atlas (≈, gestrichelt), Wert = Menge × Preis ÷ EZB-Jahresmittel. Annahmen zählen nie als belegt. Menge mit Annahmen ${z.mengen_mit_annahmen}/${z.verbindungen}, Wert ${z.werte_mit_annahmen}/${z.verbindungen}.`
    : `Belegt: nur Mengen und Werte laut gelesener Quelle (${z.mengen_in_tonnen}/${z.verbindungen} Bögen mit Tonnen, ${z.werte_in_euro}/${z.verbindungen} mit Euro). Ausstoß oder Obergrenze des liefernden Glieds steht daneben und zählt nicht.`;
    $('legende-annahme').hidden = !an(); };
  ansichtText();
  $('umschalter').addEventListener('click', e => {
    const b = e.target.closest('button[data-ansicht]'); if (!b || b.dataset.ansicht === status.ansicht) return;
    status.ansicht = b.dataset.ansicht;
    for (const x of $('umschalter').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.ansicht === status.ansicht));
    kpis(); liste(); ansichtText(); waehle(status.auswahl); $('ausdruck-ansicht').textContent = an() ? 'Mit Annahmen' : 'Belegt' + (sch() ? ' (Schätzungen stehen nicht im PDF)' : '');
    const u = new URL(location.href); status.ansicht !== 'belegt' ? u.searchParams.set('ansicht', status.ansicht) : u.searchParams.delete('ansicht'); history.replaceState(null, '', u);
  });
  const risikoAn = (ein, kat = status.risikoKat) => { status.risiko = ein; status.risikoKat = kat; risikoPanel(); globus?.risiko(); waehle(status.auswahl); };
  risikoPanel();
  $('risiko-an').addEventListener('click', () => risikoAn(!status.risiko));
  $('risiko-kategorien').addEventListener('click', e => { const b = e.target.closest('[data-risiko-kat]'); if (b) risikoAn(true, b.dataset.risikoKat); });
  $('risiko-matrix').addEventListener('click', e => { const b = e.target.closest('[data-risiko-feld]'); if (b) waehle({typ: 'risiko', id: b.dataset.risikoFeld}); });
  $('legende-knopf').addEventListener('click', () => { const o = $('globus').classList.toggle('legende-offen'); $('legende-knopf').setAttribute('aria-expanded', String(o)); });
  try { globus = baueGlobus(d, waehle); } catch (e) { $('globus').insertAdjacentHTML('beforeend', `<p class="fehler">3D-Ansicht nicht verfügbar: ${esc(e.message)}</p>`); }
  const p = new URLSearchParams(location.search);
  if (['annahmen', 'schaetzungen'].includes(p.get('ansicht'))) $('umschalter').querySelector(`[data-ansicht=${p.get('ansicht')}]`).click();
  const rk = p.get('risiko'), w = p.get('w');
  if (rk) risikoAn(true, d.risikoebene.kategorien.some(k => k.id === rk) ? rk : 'ALLE');
  if (w && S[w.split(':')[0]] && d.risikoebene.kategorien.some(k => k.id === w.split(':')[1])) waehle({typ: 'risiko', id: w});
  else if (p.get('v') && d.verbindungen.some(v => v.id === p.get('v'))) waehle({typ: 'verbindung', id: p.get('v')});
  else if (p.get('s') && S[p.get('s')]) waehle({typ: 'standort', id: p.get('s')});
  status.geladen = true; document.documentElement.dataset.geladen = 'ja';
}

// --- Gesprächsausdruck (PDF, Abnahmeliste Punkt 10) ---------------------------------------------------------------------------
// Knopf "PDF erzeugen": Modul rohstoffkette-pdf.mjs wird erst beim Klick geladen und liest nur die schon geladene kette.json.
// Ansicht = Umschalter; Ausfall-Glied = Auswahl im Kasten (Standard: direkter Lieferant des Kunden; Antippen eines Glieds übernimmt es).
function ausdruck(d) {
  const sel = $('ausdruck-glied'), knopf = $('ausdruck-pdf');
  sel.innerHTML = d.standorte.map(s => `<option value="${esc(s.id)}">${esc(s.id.slice(1))}. ${esc(s.kurz)} fällt aus</option>`).join('');
  const g = d.kette.glieder; sel.value = status.ausfall || (g.length > 1 ? g.at(-2) : d.standorte[0].id);
  knopf.addEventListener('click', async () => {
    knopf.disabled = true; $('ausdruck-status').textContent = 'PDF wird erzeugt …';
    try {
      const {gespraechsausdruck} = await import('./rohstoffkette-pdf.mjs');
      const r = await gespraechsausdruck(d, {ansicht: status.ansicht, ausfall: sel.value});
      const url = URL.createObjectURL(new Blob([r.bytes], {type: 'application/pdf'}));
      const a = document.createElement('a'); a.href = url; a.download = r.name; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      status.pdf = {name: r.name, seiten: r.seiten, bytes: r.bytes.length, ansicht: r.ansicht, ausfall: r.ausfall, quellen: r.quellen, quellen_gezeigt: r.quellen_gezeigt,
        ueberlauf: r.ueberlauf, karte: r.karte, schrift_min: r.schrift_min, verbindungen_seite: r.verbindungen_seite};
      $('ausdruck-status').textContent = `${r.name} erzeugt (${r.seiten} Seiten, ${Math.round(r.bytes.length / 1024)} KB, ${r.quellen} Quellen).`;
    } catch (e) { $('ausdruck-status').textContent = 'PDF konnte nicht erzeugt werden: ' + e.message; status.pdf = {fehler: e.message}; }
    finally { knopf.disabled = false; }
  });
}

(async () => {
  let d;
  try {
    const r = await fetch('./kette.json');
    if (!r.ok) throw Error('kette.json ' + r.status);
    d = await r.json();
  } catch (e) { $('titel').textContent = 'Kette konnte nicht geladen werden'; $('detail').innerHTML = `<p class="fehler">${esc(e.message)}</p>`; return; }
  render(d);
  ausdruck(d);
})();
