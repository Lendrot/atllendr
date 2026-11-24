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
  else if (v.menge_abgeleitet) out.push(T('Menge:', 'n', F.muted), T(v.menge_abgeleitet.text), M('R'));
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
  // Teilung, bei der die höhere Spalte am niedrigsten ist (Reihenfolge bleibt erhalten)
  const vw = (w - 12) / 2, hs = eintraege.map(l => fluss(null, l, 0, 0, vw, GR) + 2), ges = hs.reduce((n, h) => n + h, 0);
  let teil = hs.length, best = ges, links = 0;
  hs.forEach((h, i) => { const m = Math.max(links, ges - links); if (i > 0 && m < best) { best = m; teil = i; } links += h; });
  let cy = y, spalte = 0, hoch = 0;
  eintraege.forEach((l, i) => {
    if (i === teil) { spalte = 1; hoch = cy - y; cy = y; }
    if (seite) fluss(seite, l, x + spalte * (vw + 12), cy, vw, GR);
    cy += hs[i];
  });
  return Math.max(hoch, cy - y);
}

// k Spalten (2 oder 3), Einträge der Reihe nach; Teilung, bei der die höchste Spalte am niedrigsten ist; liefert Höhe
function spaltenSatz(seite, eintraege, x, y, w, k = 2) {
  if (k === 2) return zweiSpalten(seite, eintraege, x, y, w);
  const vw = (w - 12 * (k - 1)) / k, hs = eintraege.map(l => fluss(null, l, 0, 0, vw, GR) + 2), sum = (a, b) => hs.slice(a, b).reduce((n, h) => n + h, 0);
  let best = [Infinity, hs.length, hs.length];
  for (let i = 0; i <= hs.length; i++) for (let j = i; j <= hs.length; j++) {
    const m = Math.max(sum(0, i), sum(i, j), sum(j, hs.length));
    if (m < best[0]) best = [m, i, j];
  }
  const grenzen = [0, best[1], best[2], hs.length];
  if (seite) for (let sp = 0; sp < k; sp++) { let cy = y; for (let i = grenzen[sp]; i < grenzen[sp + 1]; i++) { fluss(seite, eintraege[i], x + sp * (vw + 12), cy, vw, GR); cy += hs[i]; } }
  return best[0];
}
// Spalten der Verbindungen: Seite 1 immer zwei, Seite 2 in Stufe 3 drei
const vSpalten = (I, seite) => seite === 2 && I.kompakt >= 3 ? 3 : 2;

// --- Seite 2: Ausfall ---------------------------------------------------------------------------------------------------------
// Tonnen und Mehrkosten ABGELEITET (Regel 4 gelockert, Eddie 2026-11-16): Ergebnis, Marke R (Rechnung), Rechenweg; sonst Grund
function abgeleitet(f, weg, ref = () => null) {
  if (f.evidenz !== 'ABGELEITET') return [T(f.grund)];
  return [B(f.text), T('(abgeleitet)', 'n', F.muted), ...f.posten.flatMap(p => [I(`= ${weg(p)}`), ref(p)])];
}
function ausfall(d, sid, qv, kompakt = false) {
  const S = Object.fromEntries(d.standorte.map(s => [s.id, s])), V = Object.fromEntries(d.verbindungen.map(v => [v.id, v])), a = d.ausfall[sid];
  const name = id => `${nr(S[id])}. ${S[id].kurz}`, liste = ids => ids.length ? ids.map(name).join(', ') : 'keines';
  // Kompakt (Seitenplanung Stufe 1): Fliesstext; aufeinanderfolgende Ausweichen gleicher Art (bei Netz: gleiche Richtung, gleiches
  // Glied) stehen unter einer gemeinsamen Angabe statt der Art in Klammern je Eintrag (gleiche Einträge, Mengen, Marken, Quellen).
  const gruppe = x => x.art === 'NETZ' ? `${x.richtung}|${x.fuer}` : x.art;
  const gkopf = x => x.art === 'NETZ' ? [B(`${x.richtung === 'ZUFLUSS' ? 'Weitere Zuflüsse' : 'Weitere Abnehmer'} für ${name(x.fuer)}`), T('(weitere erfasste Verbindungen):', 'n', F.muted)]
    : x.art === 'LAND' ? [B('Andere Förderländer'), T('(Landesebene):', 'n', F.muted)] : [B('Andere Standorte:')];
  const aw = a.ausweich.liste.length ? a.ausweich.liste.flatMap((x, i, l) => {
    const art = `(${AW_ART[x.art]}${x.art === 'NETZ' ? `, ${x.richtung === 'ZUFLUSS' ? 'weiterer Zufluss' : 'weiterer Abnehmer'} für ${name(x.fuer)}` : ''})`;
    const neu = i === 0 || gruppe(l[i - 1]) !== gruppe(x), nm = B(x.glied ? name(x.glied) : x.name);
    return [...(kompakt ? [i ? T(neu ? ';' : ',') : null, ...(neu ? gkopf(x) : []), nm] : [i ? NL : null, nm, T(art, 'n', F.muted)]),
      x.menge.evidenz === 'UNKNOWN' ? T('Menge') : T(x.menge.text), M(x.menge.evidenz === 'UNKNOWN' ? 'U' : x.art === 'LAND' ? 'L' : 'B'),
      x.freigabe ? M(fr(x)) : null, x.quelle ? qv.ref([x.quelle]) : null];
  }) : [M('U'), T(a.ausweich.grund || 'Keine Ausweichquelle erfasst.')];
  const mengen = a.mengen.length ? a.mengen.flatMap((m, i) => { const v = V[m.verbindung];
    return [i ? T(';') : null, T(`${v.id} ${S[v.von].kurz} -> ${S[v.nach].kurz}:`), m.evidenz === 'UNKNOWN' ? M('U') : T(m.text), m.evidenz === 'UNKNOWN' ? null : M(fr(v.menge))]; })
    : [T('keine')];
  const folgen = [
    [[B('Abgeschnitten')], [T('Verlieren jeden erfassten Zufluss:', 'n', F.muted), T(liste(a.ohne_zufluss)), NL, T('Verlieren jeden erfassten Abnehmer:', 'n', F.muted), T(liste(a.ohne_abfluss))]],
    [[B('Mengen der Bögen'), I('(nicht addiert)')], mengen],
    [[B('Fehlende Tonnen'), M(a.tonnen.evidenz === 'ABGELEITET' ? 'R' : 'U')], abgeleitet(a.tonnen, p => p.formel)],
    [[B('Mehrkosten'), M(a.mehrkosten.evidenz === 'ABGELEITET' ? 'R' : 'U')], abgeleitet(a.mehrkosten, p => `${p.formel} (Marktpreis minus Vertragspreis)`, p => qv.ref([{herausgeber: p.preis_quelle, url: p.preis_url}]))],
    [[B('Dauer'), M('U')], [T(a.dauer.grund)]],
    [[B('Ausweichquellen'), T(`${a.ausweich.mit_menge ?? 0} mit Menge`, 'n', F.muted)], [...aw, kompakt ? T('.') : NL, I('Keine bestätigte Ersatzlieferung, freie Kapazität nie belegt.')]],
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
// Inhalt einmal in Lesereihenfolge (Quellennummern nach erster Nennung: Antwort, Glieder, Verbindungen, Ausfall); Planung und
// Satz nutzen dasselbe Ergebnis, damit gemessene und gesetzte Höhen übereinstimmen.
function inhalt(d, o, kompakt = 0) {
  const an = o.ansicht === 'annahmen', qv = verzeichnis();
  const ant = antwort(d, an, qv), gl = glieder(d, qv), vz = verbindungen(d, an, qv), z2 = ausfall(d, o.ausfall, qv, kompakt >= 1);
  const betroffen = [B(`Betroffene Verbindungen: `), T(z2.weg), I(' Strukturfolge im erfassten Netz, Schlussfolgerung aus der Datenbank, kein Fakt.')];
  return {an, qv, ant, gl, vz, z2, betroffen, kompakt};
}
const FOLGE_SPALTEN = [{t: 'Folge', w: BR * 0.2}, {t: 'Ergebnis', w: BR * 0.8}];
const Y2 = 70;   // Oberkante Inhalt Seite 2
// Folgen des Ausfalls: Tabelle; in Stufe 2 als Fliesstext in zwei Spalten (spart die Bezeichnungsspalte, gleicher Inhalt), die
// Ausweichquellen (längster Eintrag) je nachdem, was flacher ist, in der Spalte oder darunter in voller Breite
function folgenSatz(seite, I, y) {
  if (I.kompakt < 2) return tabelle(seite, L, y, FOLGE_SPALTEN, I.z2.folgen, GR);
  const laeufe = I.z2.folgen.map(([bez, erg]) => [...bez, T(':'), ...erg]);
  const alle = sx => zweiSpalten(sx, laeufe, L, y, BR);
  const breit = sx => { const h = zweiSpalten(sx, laeufe.slice(0, -1), L, y, BR); return h + fluss(sx, laeufe.at(-1), L, y + h, BR, GR) + 2; };
  return (alle(null) <= breit(null) ? alle : breit)(seite);
}
// Seite 2 bis zur Überschrift der Quellenliste; k = Zahl der Verbindungen auf Seite 1
function hoeheSeite2(I, k, verbH) {
  return Y2 + fluss(null, I.betroffen, L, Y2, BR, GR) + 4 + folgenSatz(null, I, 0) + 6
    + (k < I.vz.length ? verbH(k, I.vz.length, 2) + 6 : 0) + 13;
}

// Quellenliste: 2 Spalten mit bis zu 3, 2, 1 Zeilen je Eintrag; reicht das nicht, 3, dann 4 Spalten zu je 1 Zeile. Jede Quelle bleibt
// mit Nummer und Link gelistet; nur überlange Titel werden mit … gekürzt (voller Titel in kette.json).
const Q_STUFEN = [[3, 2], [2, 2], [1, 2], [1, 3], [1, 4]];
function quellenSatz(liste, platz, cache = new Map()) {
  const lh = GR * 1.28;
  let erg = null;
  for (const [n, k] of Q_STUFEN) {
    const sw = (BR - 12 * (k - 1)) / k, key = `${n}/${k}`;
    if (!cache.has(key)) cache.set(key, liste.map((q, i) => {
      const laeufe = tt => [B(`[${i + 1}]`), T(tt, 'n', '#1d5f8f'), q.stand ? I(`· ${q.stand}`) : null];
      let t = `${q.herausgeber}${q.titel ? ': ' + q.titel : ''}`;
      if (fluss(null, laeufe(t), 0, 0, sw, GR) > n * lh + 0.1) {
        while (t.length > 4 && fluss(null, laeufe(t + '…'), 0, 0, sw, GR) > n * lh + 0.1) t = t.slice(0, -1);
        t = t.trimEnd() + '…';
      }
      return {laeufe: laeufe(t), h: fluss(null, laeufe(t), 0, 0, sw, GR) + 1, url: q.url};
    }));
    const zeilen = cache.get(key), spalten = Array.from({length: k}, () => []);
    let sp = 0, hoehe = 0;
    for (const e of zeilen) { if (hoehe + e.h > platz) { if (sp === k - 1) break; sp += 1; hoehe = 0; } if (hoehe + e.h > platz) break; spalten[sp].push(e); hoehe += e.h; }
    erg = {sw, zeilen, spalten, alle: spalten.flat().length === zeilen.length};
    if (erg.alle) break;
  }
  return erg;
}

// Feste Schrift 8 pt, genau 2 Seiten, für jedes wählbare Ausfallglied. Geplant wird mit beiden Seiten (Seite 2 hängt vom
// Ausfallglied ab: Folgen, Ausweichquellen, Quellen). Reihenfolge je Kartenbreite (100 %, 90 %, 80 %):
//   1. alle Verbindungen auf Seite 1, Karte so hoch wie möglich (bis 110 pt);
//   2. so viele Verbindungen auf Seite 1 wie passen, der Rest folgt auf Seite 2 (Karte so hoch wie möglich).
// Passt keine Variante, wird Seite 2 verdichtet und die Suche wiederholt: Stufe 1 setzt die Ausweichquellen im Fliesstext statt
// je Zeile, Stufe 2 zusätzlich die Folgen in zwei Spalten statt als Tabelle, Stufe 3 zusätzlich die Verbindungen auf Seite 2 in
// drei statt zwei Spalten. Inhalt, Marken und Quellen bleiben gleich.
function plan(d, o) {
  for (const kompakt of [0, 1, 2, 3]) {
    const I = inhalt(d, o, kompakt), n = I.vz.length, yk = 69 + legende(null, 69, I.an) + 5, hg = 13 + zweiSpalten(null, I.gl, 0, 0, BR) + 6;
    const vh = new Map(), verbH = (a, b, sn = 1) => { const k = `${a}-${b}-${sn}`; if (!vh.has(k)) vh.set(k, 13 + spaltenSatz(null, I.vz.slice(a, b), 0, 0, BR, vSpalten(I, sn))); return vh.get(k); };
    const qc = new Map(), s2passt = k => quellenSatz(I.qv.liste, UNTEN - hoeheSeite2(I, k, verbH), qc).alle;
    for (const anteil of [1, 0.9, 0.8]) {
      const kw = Math.round(BR * KARTE_ANTEIL * anteil), hr = fluss(null, I.ant, 0, 0, BR - kw - 10, GR), khs = [];
      for (let kh = Math.round(kw / 1.5); kh >= KARTE_MIN; kh -= 8) khs.push(kh);
      const oben = kh => yk + Math.max(kh + 18, hr + 8) + hg;
      for (const kh of khs) if (oben(kh) + verbH(0, n) <= UNTEN && s2passt(n)) return {kw, kh, k: n, kompakt};
      for (const kh of khs) {
        if (oben(kh) > UNTEN) continue;
        let k = n - 1; while (k > 0 && oben(kh) + verbH(0, k) > UNTEN) k--;
        if (s2passt(k)) return {kw, kh, k, kompakt};
      }
    }
  }
  return {kw: Math.round(BR * KARTE_ANTEIL * 0.8), kh: KARTE_MIN, k: 0, kompakt: 3};   // meldet ueberlauf
}
function baue(d, o, p, rahmen, bild) {
  const I = inhalt(d, o, p.kompakt), {an, qv, vz} = I, S = Object.fromEntries(d.standorte.map(s => [s.id, s]));
  const s1 = new Seite();
  kopf(s1, d, o, 1, `${d.rohstoff}: ${d.kette.text}`);
  let y = 69;
  y += legende(s1, y, an) + 5;
  const kd = {...d, standorte: d.standorte.map(s => ({...s, kurz: sauber(s.kurz), ort: {...s.ort, freigabe: s.ort.evidenz === 'BELEGT' ? 'FREIGEGEBEN' : null}}))};
  const nahe = st => `${st.map(nr).join(', ')}. ${kurz(st[0].kurz, 20)} u. a.`;
  karte(s1, kd, o, L, y, p.kw, p.kh, rahmen, bild, {nr, ballung: nahe, linien: LINIEN});
  const hr = fluss(s1, I.ant, L + p.kw + 10, y, BR - p.kw - 10, GR);
  y += Math.max(p.kh + 18, hr + 8);
  s1.text(L, y + 9, 'Glieder: Eigentümer bis oben und Risiko-Ebene', {gr: H2, f: 'b'}); y += 13;
  y += zweiSpalten(s1, I.gl, L, y, BR) + 6;
  const titel = `Verbindungen: Menge und Wert${an ? ' (mit Annahmen)' : ''}`;
  const verb = (seite, yy, a, b, t, sn) => { seite.text(L, yy + 9, t, {gr: H2, f: 'b'}); return 13 + spaltenSatz(seite, vz.slice(a, b), L, yy + 13, BR, vSpalten(I, sn)); };
  if (p.k > 0) y += verb(s1, y, 0, p.k, p.k < vz.length ? `${titel}, ${vz.length - p.k} weitere auf Seite 2` : titel, 1);
  const ueber1 = y > UNTEN, y1 = y;
  fuss(s1, d, o);
  // Seite 2
  const s2 = new Seite(), aus = S[o.ausfall], z2 = I.z2;
  kopf(s2, d, o, 2, `Ausfallszenario: ${nr(aus)}. ${aus.kurz} fällt aus`);
  y = Y2;
  y += fluss(s2, I.betroffen, L, y, BR, GR) + 4;
  y += folgenSatz(s2, I, y) + 6;
  if (p.k < vz.length) y += verb(s2, y, p.k, vz.length, p.k ? `${titel} (Fortsetzung von Seite 1)` : titel, 2) + 6;
  s2.text(L, y + 9, `Quellenliste (${qv.liste.length} Quellen, Nummern wie im Text; Zeile anklicken öffnet die Quelle)`, {gr: H2, f: 'b'}); y += 13;
  const q = quellenSatz(qv.liste, UNTEN - y);
  q.spalten.forEach((liste, sp) => { let cy = y; for (const e of liste) { const qx = L + sp * (q.sw + 12); fluss(s2, e.laeufe, qx, cy, q.sw, GR); if (e.url) s2.link(qx, cy, q.sw, e.h, e.url); cy += e.h; } });
  const gezeigt = q.spalten.flat().length, ueber2 = gezeigt < q.zeilen.length || y > UNTEN;
  if (gezeigt < q.zeilen.length) s2.text(L, UNTEN + 2, `… ${q.zeilen.length - gezeigt} weitere Quellen in /${d.slug}/kette/kette.json`, {gr: GR, f: 'i', c: F.muted});
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
    karte: !!bild, karte_hoehe: p.kh, verbindungen_seite: p.k < d.verbindungen.length ? 2 : 1, verbindungen_seite1: p.k, kompakt: p.kompakt, ansicht: o.ansicht, ausfall: o.ausfall, y1: Math.round(erg.y1), unten: Math.round(UNTEN),
    texte: erg.seiten.map(s => s.texte.join(' '))};
}
