// Gesprächsausdruck der Rohstoffketten (Abnahmeliste "kontaktreif", Punkt 10; Auftrag 2026-11-16 "jede VF auf den Stand von
// Kupfer"): erzeugt im Browser ein PDF mit genau 2 Seiten aus derselben kette.json, die /<rohstoff>/kette/ zeigt.
// Seite 1: Kette mit Kartenausschnitt, Kundenfrage, Glieder (Eigentümer bis oben, Risiko-Ebene), Verbindungen (Menge, Wert).
// Seite 2: Ausfallszenario (gewähltes Glied: Folgen, Mengen der Bögen, Ausweichquellen), Tagespreis und Quellenliste.
// Regeln wie auf der Seite und im Kupfer-Ausdruck: nichts wird gerechnet oder ergänzt; jede Angabe trägt ihren Stand (belegt,
// Kandidat, nur Land, Annahme, unbekannt); Annahmen nur in der Ansicht "Mit Annahmen"; unbekannt bleibt unbekannt, nie 0.
// PDF-Schreiber, Marken, Karte und Mindestschrift 8 pt kommen aus kupferkette-pdf.mjs (_werkzeug); kein fremdes Paket.
import {_werkzeug as W, kartenBild, MINDESTSCHRIFT} from './kupferkette-pdf.mjs';

const {Seite, M, NL, F, A4, KARTE_ANTEIL, fluss, tabelle, breiteVon, z, blaetter, kartenRahmen, karte, pdfDatei} = W;
// WinAnsi kennt keine chinesischen Zeichen: Klammern mit solchen Zeichen fallen weg, übrige Zeichen ausserhalb Latein auch
// (sonst stünde "????" im Ausdruck). Name und Quelle bleiben vollständig in kette.json und auf der Seite.
const sauber = s => String(s ?? '').replace(/\s*[(（][^()（）]*[^\u0000-\u024f\u2000-\u22ff][^()（）]*[)）]/g, '').replace(/[^\u0000-\u024f\u2000-\u22ff]+/g, '').replace(/\s{2,}/g, ' ').trim();
const T = (s, f, c) => W.T(sauber(s), f, c), B = s => W.B(sauber(s)), I = s => W.I(sauber(s));
const L = 36, BR = A4.w - 72, UNTEN = A4.h - 38, GR = MINDESTSCHRIFT, H2 = 10.5, KARTE_MIN = 110;
const nr = s => s.id.slice(1);
const ART = {VERARBEITUNG: 'Weiterverarbeitung', TRANSPORT: 'Transport', HANDEL: 'Abnahmevertrag', LIEFERUNG: 'Lieferung'};
const EK_STAND = {VOLLSTAENDIG_FREIGEGEBEN: 'B', VOLLSTAENDIG_KANDIDAT: 'K', OFFEN: 'U', UNBEKANNT: 'U'};
const AW_ART = {NETZ: 'weitere erfasste Verbindung', LAND: 'anderes Förderland, Landesebene', STANDORT: 'anderer Standort'};
const LINIEN = [[F.cu, null, 'Weiterverarbeitung'], [F.tr, null, 'Transport'], [F.ha, [3, 1.6], 'Abnahmevertrag (kein Warenweg)'], [F.li, null, 'Lieferung']];
const fr = x => x?.freigabe === 'FREIGEGEBEN' ? 'B' : 'K';
const kurz = (s, n = 46) => s.length > n ? s.slice(0, n - 2).replace(/\s+\S*$/, '') + ' …' : s;

// Quellenverzeichnis: eine Nummer je Quelle (Adresse ohne Seitenanker), Reihenfolge der ersten Nennung
function verzeichnis() {
  const liste = [], nrn = new Map();
  const ref = qs => {
    const n = [...new Set(qs.filter(q => q && (q.url || q.herausgeber)).map(q => {
      const key = (q.url || '').replace(/#.*$/, '') || `${q.herausgeber}|${q.titel}`;
      if (!nrn.has(key)) { liste.push({herausgeber: q.herausgeber || '', titel: q.titel || q.fundstelle || '', url: q.url || null, stand: q.stand || q.abgerufen || ''}); nrn.set(key, liste.length); }
      return nrn.get(key);
    }))].sort((a, b) => a - b);
    const teile = [];
    for (const x of n) { const l = teile.at(-1); if (l && x === l[1] + 1) l[1] = x; else teile.push([x, x]); }
    return n.length ? T(` [${teile.map(([a, b]) => a === b ? a : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`).join(', ')}]`, 'n', F.muted) : null;
  };
  return {liste, ref};
}

// --- Inhalt Seite 1 ---------------------------------------------------------------------------------------------------------
function glieder(d, qv) {
  const ek = d.eigentumskette;
  return d.standorte.map(s => {
    const g = ek.glieder[s.id], out = [B(`${nr(s)}. ${s.kurz}`), T(`(${s.land === 'UNKNOWN' ? 'Land unbekannt' : s.land}, ${s.rolle})`, 'n', F.muted)];
    if (s.ort.lat === null) out.push(T('Standort'), M('U'));
    out.push(NL, T('Eigentümer:', 'n', F.muted));
    if (g.baum) {
      const oben = blaetter(ek, g.baum).map(x => x.name).filter(n => n !== ek.knoten[g.wurzel].name);
      out.push(T(kurz(ek.knoten[g.wurzel].name, 40) + (oben.length ? ` -> ${oben.map(n => kurz(n, 34)).join(', ')}` : '')), M(EK_STAND[g.status]));
      if (g.status === 'OFFEN') out.push(I('Kette endet ohne Beleg'));
      out.push(qv.ref(ekQuellen(ek, g.baum)));
    } else if (g.betreiber) {
      out.push(T(`Betreiber ${kurz(ek.knoten[g.betreiber.baum.knoten].name, 40)}`), M('B'), qv.ref(g.betreiber.belege.map(b => ek.quellen[b.quelle])), T('Anteil'), M('U'));
    } else out.push(M('U'));
    const re = Object.values(s.risikoebene), bel = re.filter(f => f.status === 'BELEGT'), land = bel.filter(f => f.belegt.every(e => e.bezug === 'LAND')).length;
    out.push(T(`· Risiko ${bel.length}/${re.length} belegt${land ? `, ${land} nur Land` : ''}`, 'n', F.muted), M(!bel.length ? 'U' : land === bel.length ? 'L' : 'B'),
      qv.ref(bel.flatMap(f => f.belegt.flatMap(e => e.quellen))));
    return out;
  });
}
function ekQuellen(ek, b, out = []) {
  if (!b) return out;
  const e = b.kante ? ek.kanten.find(x => x.id === b.kante) : null;
  if (b.pflicht && e) out.push(...e.belege.map(x => ek.quellen[x.quelle]));
  for (const c of b.kinder) ekQuellen(ek, c, out);
  return out;
}
function mengeLauf(v, an, qv) {
  const m = v.menge, w = v.wert, out = [];
  if (m.evidenz !== 'UNKNOWN') out.push(T('Menge:', 'n', F.muted), B(m.text), M(fr(m)), qv.ref(m.belege || []));
  else if (an && v.menge_annahme) out.push(T('Menge:', 'n', F.muted), T(v.menge_annahme.text), M('A'));
  else out.push(T('Menge:', 'n', F.muted), M('U'));
  if (w.evidenz !== 'UNKNOWN') out.push(T('Wert:', 'n', F.muted), B(w.text), M(w.freigabe ? fr(w) : 'B'), w.belege ? qv.ref(w.belege) : qv.ref(v.belege));
  else if (v.wert_abgeleitet) out.push(T('Wert:', 'n', F.muted), T(v.wert_abgeleitet.text), I('(abgeleitet: Menge × Marktpreis ÷ EZB, kein Beleg)'), qv.ref([{url: v.wert_abgeleitet.preis_url, herausgeber: v.wert_abgeleitet.preis_quelle}]));
  else if (an && v.wert_annahme?.evidenz === 'ANNAHME') out.push(T('Wert:', 'n', F.muted), T(v.wert_annahme.text), M('A'), qv.ref([{url: v.wert_annahme.preis_url, herausgeber: v.wert_annahme.preis_quelle}]));
  else out.push(T('Wert:', 'n', F.muted), M('U'));
  for (const b of v.menge_bezug || []) out.push(I(`(${b.art === 'OBERGRENZE' ? 'Obergrenze' : 'Ausstoß des Lieferanten'} ${b.text}, zählt nicht)`), M(fr(b)), qv.ref(b.belege));
  return out;
}
function verbindungen(d, an, qv) {
  const S = Object.fromEntries(d.standorte.map(s => [s.id, s]));
  return d.verbindungen.map(v => [B(`${v.id} `), T(`${nr(S[v.von])}. ${S[v.von].kurz} -> ${nr(S[v.nach])}. ${S[v.nach].kurz}`), T(`(${ART[v.art]})`, 'n', F.muted),
    M('B'), qv.ref(v.belege), NL, ...mengeLauf(v, an, qv)]);
}
function preisLauf(d, qv) {
  const pb = d.preisbasis;
  if (!pb) return [B('Tagespreis:'), M('U'), T(d.preisbasis_grund)];
  const p = pb.preis, k = pb.kurs;
  return [B('Tagespreis:'), T(`${p.art} ${z(p.wert)} ${p.einheit}, Handelstag ${p.datum}`), M('B'), qv.ref([{herausgeber: p.herausgeber, titel: `${p.art}, ${p.einheit}, täglich`, url: p.url, stand: p.abgerufen}]),
    T(`; ${k.art} ${k.wert.toLocaleString('de-DE', {minimumFractionDigits: 4})} ${k.einheit} vom ${k.datum}`), M('B'), qv.ref([{herausgeber: k.herausgeber, titel: 'US$ je Euro, täglich', url: k.url, stand: k.abgerufen}]),
    I(`= ${z(Math.round(pb.eur_je_t), 0)} € je t. ${pb.formel}.`)];
}

// zwei Spalten, erst links, dann rechts; liefert Höhe
function zweiSpalten(seite, eintraege, x, y, w) {
  const vw = (w - 12) / 2, hs = eintraege.map(l => fluss(null, l, 0, 0, vw, GR) + 2), haelfte = hs.reduce((n, h) => n + h, 0) / 2;
  let cy = y, spalte = 0, hoch = 0, summe = 0;
  eintraege.forEach((l, i) => {
    if (spalte === 0 && summe > 0 && summe + hs[i] / 2 > haelfte) { spalte = 1; hoch = cy - y; cy = y; }
    if (seite) fluss(seite, l, x + spalte * (vw + 12), cy, vw, GR);
    cy += hs[i]; summe += hs[i];
  });
  return Math.max(hoch, cy - y);
}

// --- Seite 2: Ausfall ---------------------------------------------------------------------------------------------------------
// Tonnen und Mehrkosten ABGELEITET (Regel 4 gelockert, Eddie 2026-11-16): Ergebnis, Marke R (Rechnung), Rechenweg; sonst Grund
function abgeleitet(f, weg, ref = () => null) {
  if (f.evidenz !== 'ABGELEITET') return [T(f.grund)];
  return [B(f.text), T('(abgeleitet)', 'n', F.muted), ...f.posten.flatMap(p => [I(`= ${weg(p)}`), ref(p)])];
}
function ausfall(d, sid, qv) {
  const S = Object.fromEntries(d.standorte.map(s => [s.id, s])), V = Object.fromEntries(d.verbindungen.map(v => [v.id, v])), a = d.ausfall[sid];
  const name = id => `${nr(S[id])}. ${S[id].kurz}`, liste = ids => ids.length ? ids.map(name).join(', ') : 'keines';
  const aw = a.ausweich.liste.length ? a.ausweich.liste.flatMap((x, i) => [i ? NL : null, B(x.glied ? name(x.glied) : x.name),
    T(`(${AW_ART[x.art]}${x.art === 'NETZ' ? `, ${x.richtung === 'ZUFLUSS' ? 'weiterer Zufluss' : 'weiterer Abnehmer'} für ${name(x.fuer)}` : ''})`, 'n', F.muted),
    x.menge.evidenz === 'UNKNOWN' ? T('Menge') : T(x.menge.text), M(x.menge.evidenz === 'UNKNOWN' ? 'U' : x.art === 'LAND' ? 'L' : 'B'),
    x.freigabe ? M(fr(x)) : null, x.quelle ? qv.ref([x.quelle]) : null])
    : [M('U'), T(a.ausweich.grund || 'Keine Ausweichquelle erfasst.')];
  const mengen = a.mengen.length ? a.mengen.flatMap((m, i) => { const v = V[m.verbindung];
    return [i ? T(';') : null, T(`${v.id} ${S[v.von].kurz} -> ${S[v.nach].kurz}:`), m.evidenz === 'UNKNOWN' ? M('U') : T(m.text), m.evidenz === 'UNKNOWN' ? null : M(fr(v.menge))]; })
    : [T('keine')];
  const folgen = [
    [[B('Abgeschnitten')], [T('Verlieren jeden erfassten Zufluss:', 'n', F.muted), T(liste(a.ohne_zufluss)), NL, T('Verlieren jeden erfassten Abnehmer:', 'n', F.muted), T(liste(a.ohne_abfluss))]],
    [[B('Mengen der Bögen'), I('(nicht addiert)')], mengen],
    [[B('Fehlende Tonnen'), M(a.tonnen.evidenz === 'ABGELEITET' ? 'R' : 'U')], abgeleitet(a.tonnen, p => p.formel)],
    [[B('Mehrkosten'), M(a.mehrkosten.evidenz === 'ABGELEITET' ? 'R' : 'U')], abgeleitet(a.mehrkosten, p => `${p.formel} (Marktpreis minus Vertragspreis)`, p => qv.ref([{herausgeber: p.preis_quelle, url: p.preis_url}]))],
    [[B('Dauer'), M('U')], [T(a.dauer.grund)]],
    [[B('Ausweichquellen'), T(`${a.ausweich.mit_menge ?? 0} mit Menge`, 'n', F.muted)], [...aw, NL, I('Keine bestätigte Ersatzlieferung, freie Kapazität nie belegt.')]],
  ];
  const weg = a.verbindungen_weg.map(id => `${id} ${S[V[id].von].kurz} -> ${S[V[id].nach].kurz}`).join('; ') || 'keine';
  return {folgen, weg, a};
}

// --- Kopf, Fuss, Legende --------------------------------------------------------------------------------------------------------
function kopf(seite, d, o, n, titel) {
  const R = A4.w - 36;
  seite.text(L, 44, sauber(titel), {gr: 14.5, f: 'b'});
  seite.text(R - breiteVon('marktatlas', 'b', 9), 30, 'marktatlas', {gr: 9, f: 'b', c: F.cu});
  const preis = d.preisbasis ? `Preis ${d.preisbasis.preis.datum}` : 'kein Tagespreis';
  seite.text(L, 57, `Gesprächsausdruck · Ansicht: ${o.ansicht === 'annahmen' ? 'Mit Annahmen' : 'Belegt'} · Datenstand ${d.stand} · ${preis} · erstellt ${o.erstellt} · Seite ${n} von 2`, {gr: GR, c: F.muted});
  seite.linie(L, 63, R, 63, {c: F.line, lw: 0.8});
}
function fuss(seite, d, o) {
  seite.linie(L, A4.h - 34, A4.w - 36, A4.h - 34, {c: F.line, lw: 0.6});
  fluss(seite, [I(`Daten: /${d.slug}/kette/kette.json, Datenstand ${d.stand}. Nichts nachgerechnet oder ergänzt; unbekannt bleibt unbekannt, nie 0. `
    + (o.ansicht === 'annahmen' ? 'Annahmen stammen aus dem Annahmen-Atlas und sind nie belegt oder freigegeben.' : 'Ansicht „Belegt“: Annahmen ausgeblendet.'))], L, A4.h - 31, BR, GR);
}
const KURZERKL = {B: 'Quelle + Zitat, freigegeben', K: 'Quelle + Zitat, Prüfung offen', L: 'nur Landesebene belegt', A: 'Annahme-Atlas, nicht belegt', U: 'keine Quelle, nie 0'};
function legende(seite, y, an) {
  const laeufe = [B('Kennzeichnung:')];
  for (const k of ['B', 'K', 'L', 'A', 'U']) if (k !== 'A' || an) laeufe.push(M(k), T(`${KURZERKL[k]}${k === 'U' ? '.' : ';'}`, 'n', F.muted));
  laeufe.push(T('[n] = Nummer in der Quellenliste (Seite 2). Risiko = Länderrisiko, Sanktionen, Naturgefahren, Konzentration.', 'n', F.muted));
  return fluss(seite, laeufe, L, y, BR, GR);
}
function antwort(d, an, qv) {
  const z_ = d.zaehler, S = Object.fromEntries(d.standorte.map(s => [s.id, s])), em = d.eigentumskette.messung, rm = d.risikoebene.messung;
  return [I(`Kundenfrage ${S[d.kundenfrage.kunde].kurz}`), NL, B(d.kundenfrage.frage), NL, T(d.kundenfrage.antwort), NL,
    T(`• ${z_.verbindungen} Verbindungen, ${z_.verbindungen_freigegeben} freigegeben.`), NL,
    T(`• Menge belegt ${z_.mengen_in_tonnen}/${z_.verbindungen}, Wert belegt ${z_.werte_in_euro}/${z_.verbindungen}${an ? `; mit Annahmen ${z_.mengen_mit_annahmen} bzw. ${z_.werte_mit_annahmen}` : ''}.`), NL,
    T(`• Eigentümer bis oben ${z_.eigentumskette_vollstaendig} von ${em.glieder} Gliedern (${z_.eigentumskette_freigegeben} freigegeben).`), NL,
    T(`• Risiko-Ebene ${rm.belegt} von ${rm.felder} Feldern belegt (${rm.belegt_nur_landesebene} nur Land).`), NL,
    T(`• Ausfälle mit Ausweichquelle samt Menge: ${z_.ausfall_mit_ausweich_menge} von ${z_.standorte}.`), NL, ...preisLauf(d, qv)];
}

// --- Seitenaufbau ---------------------------------------------------------------------------------------------------------------
// Feste Schrift 8 pt; passt Seite 1 nicht, wird erst die Karte flacher (bis 110 pt), dann wandern die Verbindungen auf Seite 2.
function plan(d, o) {
  const an = o.ansicht === 'annahmen', qv = verzeichnis(), kw = Math.round(BR * KARTE_ANTEIL);
  const yk = 69 + legende(null, 69, an) + 5, rw = BR - kw - 10, hr = fluss(null, antwort(d, an, qv), 0, 0, rw, GR);
  const hg = 13 + zweiSpalten(null, glieder(d, qv), 0, 0, BR) + 6, hv = 13 + zweiSpalten(null, verbindungen(d, an, qv), 0, 0, BR);
  const passt = (kh, mitV) => yk + Math.max(kh + 18, hr + 8) + hg + (mitV ? hv : 0) <= UNTEN;
  for (const mitV of [true, false])
    for (let kh = Math.round(kw / 1.5); kh >= KARTE_MIN; kh -= 8) if (passt(kh, mitV)) return {kw, kh, verbS2: !mitV};
  return {kw, kh: KARTE_MIN, verbS2: true};
}
function baue(d, o, p, rahmen, bild) {
  const an = o.ansicht === 'annahmen', qv = verzeichnis(), S = Object.fromEntries(d.standorte.map(s => [s.id, s]));
  const s1 = new Seite();
  kopf(s1, d, o, 1, `${d.rohstoff}: ${d.kette.text}`);
  let y = 69;
  y += legende(s1, y, an) + 5;
  const kd = {...d, standorte: d.standorte.map(s => ({...s, kurz: sauber(s.kurz), ort: {...s.ort, freigabe: s.ort.evidenz === 'BELEGT' ? 'FREIGEGEBEN' : null}}))};
  const nahe = st => `${st.map(nr).join(', ')}. ${kurz(st[0].kurz, 20)} u. a.`;
  karte(s1, kd, o, L, y, p.kw, p.kh, rahmen, bild, {nr, ballung: nahe, linien: LINIEN});
  const hr = fluss(s1, antwort(d, an, qv), L + p.kw + 10, y, BR - p.kw - 10, GR);
  y += Math.max(p.kh + 18, hr + 8);
  s1.text(L, y + 9, 'Glieder: Eigentümer bis oben und Risiko-Ebene', {gr: H2, f: 'b'}); y += 13;
  y += zweiSpalten(s1, glieder(d, qv), L, y, BR) + 6;
  const vz = verbindungen(d, an, qv);
  const verb = (seite, yy) => {
    seite.text(L, yy + 9, `Verbindungen: Menge und Wert${an ? ' (mit Annahmen)' : ''}`, {gr: H2, f: 'b'});
    return 13 + zweiSpalten(seite, vz, L, yy + 13, BR);
  };
  if (!p.verbS2) y += verb(s1, y);
  const ueber1 = y > UNTEN, y1 = y;
  fuss(s1, d, o);
  // Seite 2
  const s2 = new Seite(), aus = S[o.ausfall], z2 = ausfall(d, o.ausfall, qv);
  kopf(s2, d, o, 2, `Ausfallszenario: ${nr(aus)}. ${aus.kurz} fällt aus`);
  y = 70;
  y += fluss(s2, [B(`Betroffene Verbindungen: `), T(z2.weg), I(' Strukturfolge im erfassten Netz, Schlussfolgerung aus der Datenbank, kein Fakt.')], L, y, BR, GR) + 4;
  y += tabelle(s2, L, y, [{t: 'Folge', w: BR * 0.2}, {t: 'Ergebnis', w: BR * 0.8}], z2.folgen, GR) + 6;
  if (p.verbS2) y += verb(s2, y) + 6;
  s2.text(L, y + 9, `Quellenliste (${qv.liste.length} Quellen, Nummern wie im Text; Zeile anklicken öffnet die Quelle)`, {gr: H2, f: 'b'}); y += 13;
  const sw = (BR - 12) / 2, lh = GR * 1.28, platz = UNTEN - y;
  const eintrag = (q, i, n) => {
    const laeufe = tt => [B(`[${i + 1}]`), T(tt, 'n', '#1d5f8f'), q.stand ? I(`· ${q.stand}`) : null];
    let t = `${q.herausgeber}${q.titel ? ': ' + q.titel : ''}`;
    if (fluss(null, laeufe(t), 0, 0, sw, GR) > n * lh + 0.1) {
      while (t.length > 4 && fluss(null, laeufe(t + '…'), 0, 0, sw, GR) > n * lh + 0.1) t = t.slice(0, -1);
      t = t.trimEnd() + '…';
    }
    return {laeufe: laeufe(t), h: fluss(null, laeufe(t), 0, 0, sw, GR) + 1, url: q.url};
  };
  let zeilen = [], spalten = [[], []];
  for (const n of [3, 2, 1]) {
    zeilen = qv.liste.map((q, i) => eintrag(q, i, n));
    spalten = [[], []]; let sp = 0, hoehe = 0;
    for (const e of zeilen) { if (hoehe + e.h > platz) { if (sp === 1) break; sp = 1; hoehe = 0; } if (hoehe + e.h > platz) break; spalten[sp].push(e); hoehe += e.h; }
    if (spalten[0].length + spalten[1].length === zeilen.length) break;
  }
  spalten.forEach((liste, sp) => { let cy = y; for (const e of liste) { const qx = L + sp * (sw + 12); fluss(s2, e.laeufe, qx, cy, sw, GR); if (e.url) s2.link(qx, cy, sw, e.h, e.url); cy += e.h; } });
  const gezeigt = spalten[0].length + spalten[1].length, ueber2 = gezeigt < zeilen.length || y > UNTEN;
  if (gezeigt < zeilen.length) s2.text(L, UNTEN + 2, `… ${zeilen.length - gezeigt} weitere Quellen in /${d.slug}/kette/kette.json`, {gr: GR, f: 'i', c: F.muted});
  fuss(s2, d, o);
  return {seiten: [s1, s2], y1, ueberlauf: ueber1 || ueber2, quellen: qv.liste.length, quellen_gezeigt: gezeigt};
}

// --- Öffentliche Funktion ---------------------------------------------------------------------------------------------------------
// opt: {ansicht: 'belegt'|'annahmen', ausfall: Standort-ID, jetzt: Date, kartenQuelle}
export function standardAusfall(d) {   // direkter Lieferant des Kunden der Hauptkette, sonst erstes Glied
  const g = d.kette.glieder;
  return g.length > 1 ? g.at(-2) : d.standorte[0].id;
}
export async function gespraechsausdruck(d, opt = {}) {
  const jetzt = opt.jetzt || new Date(), p2 = v => String(v).padStart(2, '0');
  const o = {ansicht: opt.ansicht === 'annahmen' ? 'annahmen' : 'belegt', ausfall: d.ausfall[opt.ausfall] ? opt.ausfall : standardAusfall(d),
    erstellt: `${p2(jetzt.getDate())}.${p2(jetzt.getMonth() + 1)}.${jetzt.getFullYear()} ${p2(jetzt.getHours())}:${p2(jetzt.getMinutes())}`};
  const p = plan(d, o);
  const punkte = d.standorte.filter(s => s.ort.lat !== null).map(s => s.ort);
  const rahmen = kartenRahmen(punkte.length ? punkte : [{lat: 0, lon: 0}], p.kw, p.kh);
  const bild = await kartenBild(rahmen, opt.kartenQuelle);
  const erg = baue(d, o, p, rahmen, bild);
  const datum = `${jetzt.getFullYear()}${p2(jetzt.getMonth() + 1)}${p2(jetzt.getDate())}${p2(jetzt.getHours())}${p2(jetzt.getMinutes())}${p2(jetzt.getSeconds())}`;
  const kunde = d.standorte.find(s => s.id === d.kundenfrage.kunde).kurz;
  const titel = `${d.rohstoff}: ${d.kette.text} (Gesprächsausdruck, ${o.ansicht === 'annahmen' ? 'Mit Annahmen' : 'Belegt'})`;
  const bytes = pdfDatei(erg.seiten, bild, {titel, thema: d.kundenfrage.frage, datum});
  const sicher = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const name = `Rohstoffkette-${d.slug}-${sicher(kunde)}-${o.ansicht === 'annahmen' ? 'mit-Annahmen' : 'belegt'}-Ausfall-${o.ausfall}-${d.stand}.pdf`;
  return {bytes, name, seiten: erg.seiten.length, schrift_min: MINDESTSCHRIFT, ueberlauf: erg.ueberlauf, quellen: erg.quellen, quellen_gezeigt: erg.quellen_gezeigt,
    karte: !!bild, karte_hoehe: p.kh, verbindungen_seite: p.verbS2 ? 2 : 1, ansicht: o.ansicht, ausfall: o.ausfall, y1: Math.round(erg.y1), unten: Math.round(UNTEN),
    texte: erg.seiten.map(s => s.texte.join(' '))};
}
