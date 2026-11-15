/** Punktgröße nach Marktpräsenz in den Welten (Eddie 2026-11-14: "Die auf den Welten (nicht auf dem Gesamtatlas) sollen die
 *  Produzenten und Empfänger Standortpunktgrößen im Verhältnis zu Gewichtung der Marktpräsenz haben").
 *  Daten: assets/standort-mengen/<welt>.json (scripts/analysis/standort_mengen.py, Doku analysis/STANDORT_MENGEN.md).
 *  Nur belegte Jahresmengen in Tonnen (Förderung/Ausstoß oder Kapazität laut Quelle). Punktfläche proportional zur Menge,
 *  verglichen nur innerhalb derselben Mengenbasis (Gruppe). Ohne Beleg: Ring. Häfen und Eigentümer ohne Warenfluss: kleiner Punkt.
 *  Der Gesamtatlas lädt diese Datei nicht. */
import {escapeHtml as esc} from './map-logic.mjs';

export const KLEIN = 1.6, GROSS = 4.2, NEUTRAL = 1;
const zahl = (n, d = 0) => new Intl.NumberFormat('de-DE', {maximumFractionDigits: d}).format(n);

/** Tonnen lesbar: 1,3 Mio. t, 850.000 t, 5 t. */
export function tonnen(t) {
  if (t >= 1e6) return `${zahl(t / 1e6, t >= 1e7 ? 0 : 1)} Mio. t`;
  if (t >= 1e4) return `${zahl(Math.round(t / 1e3) * 1e3)} t`;
  return `${zahl(t, t < 10 ? 1 : 0)} t`;
}

/** Größe eines belegten Punkts: Fläche proportional zur Menge innerhalb der Gruppe, zwischen KLEIN und GROSS. */
export function groesse(t, max) {
  return KLEIN + (GROSS - KLEIN) * Math.sqrt(Math.max(0, Math.min(1, t / max)));
}

/** Lädt die Mengen der Welt und setzt r.scale an den Standorten (negativ = Ring, Menge unbekannt). null ohne Daten. */
export async function ladeMarktpraesenz(welt, records) {
  let doc;
  try {
    const res = await fetch(`/assets/standort-mengen/${encodeURIComponent(welt)}.json`);
    if (!res.ok) return null;
    doc = await res.json();
  } catch { return null; }
  if (doc.schema !== 'atlas.standort-mengen/1') return null;
  const max = doc.gruppen.map(() => 0), rang = new Map(), neutral = new Set(doc.neutral || []);
  const werte = Object.entries(doc.werte || {});
  for (const [, w] of werte) max[w[1]] = Math.max(max[w[1]], w[0]);
  doc.gruppen.forEach((_, g) => werte.filter(([, w]) => w[1] === g).sort((a, b) => b[1][0] - a[1][0])
    .forEach(([id], i, list) => rang.set(id, [i + 1, list.length])));
  const aktiv = !doc.ohne_quelle && werte.length > 0;
  const zaehl = {unbekannt: 0, belegt: 0};
  if (aktiv) for (const r of records) {
    if (!r) continue;
    const w = doc.werte[r.id];
    if (w) { r.scale = groesse(w[0], max[w[1]]); zaehl.belegt++; }
    else if (neutral.has(r.id)) r.scale = NEUTRAL;
    else { r.scale = -KLEIN; zaehl.unbekannt++; }
  }
  return {doc, max, rang, neutral, aktiv, zaehl};
}

const kreis = (px, ring) => `<i class="mp-kreis${ring ? ' mp-ring' : ''}" style="width:${px}px;height:${px}px"></i>`;
const PX = 4.2; // Legendenkreis je Größeneinheit, ungefähr wie auf dem Globus in Übersichtshöhe

export function marktLegendeHtml(m) {
  const {doc, max, aktiv} = m, ab = doc.abdeckung || {};
  if (!aktiv) return `<div class="mp-legende"><b>Punktgröße einheitlich</b> <small>${esc(doc.ohne_quelle || 'Keine belegte Menge je Standort in dieser Welt.')}</small></div>`;
  const gruppen = doc.gruppen.map((g, i) => {
    const stufen = [max[i], max[i] / 4, max[i] / 25].map(t => `<span class="mp-stufe">${kreis(Math.round(groesse(t, max[i]) * PX))}${tonnen(t)}</span>`).join('');
    return `<div class="mp-gruppe"><span class="mp-gruppe-name">${esc(g.label)}</span>${stufen}</div>`;
  }).join('');
  const quote = ([n, b]) => `${zahl(b)} von ${zahl(n)}`;
  return `<div class="mp-legende"><b>Punktgröße = Marktpräsenz</b> <small>belegte Jahresmenge in t (Förderung, Ausstoß oder Kapazität laut Quelle); Größen nur innerhalb einer Zeile vergleichbar</small>${gruppen}`
    + `<div class="mp-gruppe"><span class="mp-stufe">${kreis(Math.round(KLEIN * PX), true)}Menge unbekannt</span><span class="mp-stufe">${kreis(Math.round(NEUTRAL * PX))}Hafen, Eigentümer</span></div>`
    + `<small class="mp-abdeckung">Belegt: Produzenten ${quote(ab.produzenten || [0, 0])} · Empfänger ${quote(ab.empfaenger || [0, 0])}</small></div>`;
}

/** Zeile im Standortdialog: Menge mit Art, Jahr, Quelle und Rang, oder "Menge unbekannt". */
export function marktZeile(m, r) {
  if (!m?.aktiv || r.dataset?.id !== m.doc.welt) return '';
  const w = m.doc.werte[r.id];
  if (!w) return m.neutral.has(r.id) ? '' : 'Marktpräsenz: Menge unbekannt (keine belegte Förderung, Ausstoß oder Kapazität)<br>';
  const [t, g, art, jahr, qi, ni] = w, q = m.doc.quellen[qi], [rg, von] = m.rang.get(r.id) || [];
  const quelle = q && /^https:\/\//.test(q[1] || '') ? `<a href="${esc(q[1])}" target="_blank" rel="noopener">${esc(q[0])}</a>` : esc(q?.[0] || '');
  return `Marktpräsenz: ${tonnen(t)} pro Jahr, ${art === 'F' ? 'Förderung bzw. Ausstoß' : 'Kapazität'}${jahr ? ' ' + jahr : ''} · ${esc(m.doc.gruppen[g].label)}`
    + `${rg ? ` · Rang ${rg} von ${von} belegten Standorten` : ''}<br>Beleg: ${quelle}${ni != null ? ' · ' + esc(m.doc.notizen[ni]) : ''}<br>`;
}
