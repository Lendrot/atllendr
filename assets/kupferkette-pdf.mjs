// Gesprächsausdruck der Kupferkette (Abnahmeliste "kontaktreif", Punkt 10; Eddie 2026-11-12): erzeugt im Browser ein PDF mit
// genau 2 Seiten aus derselben kette.json, die /kupferkette/ zeigt. Seite 1: Kette mit Kartenausschnitt, Mengen, Eigentümern,
// Risiken. Seite 2: Ausfallszenario (gewähltes Glied, Folgen für den Kunden, Ausweichquellen) und Quellenliste.
// Regeln wie auf der Seite: nichts wird gerechnet oder ergänzt; jede Angabe trägt ihren Stand (belegt, Kandidat, Rechnung,
// nur Land, Annahme, unbekannt); Annahmen erscheinen nur in der Ansicht "Mit Annahmen"; unbekannt bleibt unbekannt, nie 0.
// Kein fremdes Paket: ein kleiner PDF-1.4-Schreiber mit den Standardschriften Helvetica (WinAnsi) und dem schon geladenen
// Erdbild /assets/earth-blue-marble.jpg (NASA Blue Marble, plattkarte) als Kartenausschnitt. Es wird nichts nachgeladen.
const nrPdf = (daten, s) => { const g = daten.standorte.filter(x => x.stufe === s.stufe); return g.length > 1 ? `${s.stufe}${'abcdefgh'[g.indexOf(s)]}` : String(s.stufe); };

// --- Schrift: Breiten der Standardschriften (Adobe AFM, 1/1000 em) für WinAnsi-Codes 32..255 -----------------------------
const BREITE = {
  n: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  b: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],
};
BREITE.i = BREITE.n;   // Helvetica-Oblique hat die Breiten von Helvetica
const SCHRIFT = {n: 'F1', b: 'F2', i: 'F3'};
const CP1252 = {0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89,
  0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96,
  0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f};
const BASIS = {'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ı': 'i', 'ħ': 'h'};
const ERSATZ = {'→': '->', '←': '<-', '−': '-', '≥': '>=', '≤': '<=', '≈': '~', ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '\t': ' '};

// Text -> WinAnsi-Codes; Zeichen ausserhalb von WinAnsi werden ersetzt (Pfeil -> "->"), sonst "?"
function codes(s) {
  const out = [];
  for (const ch of String(s ?? '').normalize('NFC')) {
    if (ERSATZ[ch] !== undefined) { for (const c of ERSATZ[ch]) out.push(c.charCodeAt(0)); continue; }
    const u = ch.codePointAt(0);
    if (u >= 32 && u < 127) out.push(u);
    else if (u >= 160 && u <= 255) out.push(u);
    else if (CP1252[u]) out.push(CP1252[u]);
    else if (u === 10) out.push(32);
    else {   // Buchstaben ausserhalb von WinAnsi (z. B. polnisches l mit Strich): Grundbuchstabe statt "?"
      const basis = BASIS[ch] || ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const c = basis.length && [...basis].every(b => b.charCodeAt(0) < 127) ? basis : '?';
      for (const b of c) out.push(b.charCodeAt(0));
    }
  }
  return out;
}
const breiteVon = (s, f, gr) => codes(s).reduce((n, c) => n + (BREITE[f][c - 32] || 556), 0) * gr / 1000;
const pdfText = s => codes(s).map(c => c === 40 || c === 41 || c === 92 ? '\\' + String.fromCharCode(c) : c < 32 || c > 126 ? '\\' + c.toString(8).padStart(3, '0') : String.fromCharCode(c)).join('');
const latin1 = s => codes(s).map(c => String.fromCharCode(c)).join('');

// --- Farben und Stände ---------------------------------------------------------------------------------------------------
const F = {ink: '#14324a', muted: '#5b7488', line: '#d7e6ef', kopf: '#f1f6f9', cu: '#e39b3c', tr: '#38a8e0', ha: '#9a7fd6', li: '#e8643c', ann: '#9aa7b0',
  rot: '#c62828', nacht: '#06121c', weiss: '#ffffff', alt: '#26a6b8'};
// Stand einer Angabe. Die Farbe zeigt den Belegstand, nie die Schwere eines Risikos.
export const STAND = {
  B: {text: 'belegt', bg: '#dff1e4', fg: '#1d6a33', erkl: 'Quelle mit wörtlichem Zitat, freigegeben'},
  K: {text: 'Kandidat', bg: '#ffe6d6', fg: '#8a3a12', erkl: 'Quelle mit Zitat, Freigabe/Zweitprüfung offen'},
  R: {text: 'Rechnung', bg: '#e3eff7', fg: '#1d4f73', erkl: 'nur Arithmetik aus belegten Werten, Formel genannt'},
  L: {text: 'nur Land', bg: '#ffe7c2', fg: '#5a3700', erkl: 'Risiko nur auf Landesebene belegt'},
  A: {text: 'Annahme', bg: '#eceff1', fg: '#37474f', rand: '#90a4ae', erkl: 'begründete Annahme aus dem Annahmen-Atlas, nicht belegt'},
  U: {text: 'unbekannt', bg: '#fff1cc', fg: '#7a4f00', erkl: 'keine gelesene Quelle nennt den Wert; nie 0'},
};
const farbe = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(x => +x.toFixed(3)).join(' '); };
const z = (w, st = 2) => Number(w).toLocaleString('de-DE', {maximumFractionDigits: st});
const zeit = m => m.zeitraum ? `${m.zeitraum[0].slice(0, 7)} bis ${m.zeitraum[1].slice(0, 7)}` : '';

// --- Zeichenfläche einer Seite (Koordinaten von oben links, in pt) --------------------------------------------------------
const A4 = {w: 595.28, h: 841.89}, KARTE_ANTEIL = 0.5;
// Mindestschrift für den Kundenausdruck (Koordinator 2026-11-12): kein Text unter 8 pt, auch nicht in Marken, Karte, Fuss.
export const MINDESTSCHRIFT = 8;
class Seite {
  constructor() { this.ops = []; this.links = []; this.texte = []; }
  y(v) { return +(A4.h - v).toFixed(2); }
  text(x, y, s, {gr = 8, f = 'n', c = F.ink} = {}) {
    if (!s) return;
    if (gr < MINDESTSCHRIFT) throw Error(`Schrift ${gr} pt unter Mindestschrift`);
    this.ops.push(`BT /${SCHRIFT[f]} ${+gr.toFixed(2)} Tf ${farbe(c)} rg 1 0 0 1 ${+x.toFixed(2)} ${this.y(y)} Tm (${pdfText(s)}) Tj ET`);
    this.texte.push(s);
  }
  rechteck(x, y, w, h, {fuell = null, strich = null, lw = 0.5, strichel = null} = {}) {
    const o = [];
    if (fuell) o.push(`${farbe(fuell)} rg`);
    if (strich) o.push(`${farbe(strich)} RG ${lw} w ${strichel ? `[${strichel.join(' ')}] 0 d` : '[] 0 d'}`);
    o.push(`${+x.toFixed(2)} ${this.y(y + h)} ${+w.toFixed(2)} ${+h.toFixed(2)} re ${fuell && strich ? 'B' : fuell ? 'f' : 'S'}`);
    this.ops.push(o.join(' '));
  }
  linie(x1, y1, x2, y2, {c = F.ink, lw = 0.6, strichel = null} = {}) {
    this.ops.push(`${farbe(c)} RG ${lw} w ${strichel ? `[${strichel.join(' ')}] 0 d` : '[] 0 d'} 1 J ${+x1.toFixed(2)} ${this.y(y1)} m ${+x2.toFixed(2)} ${this.y(y2)} l S`);
  }
  bogen(x1, y1, cx, cy, x2, y2, {c = F.ink, lw = 1, strichel = null} = {}) {   // quadratische Kurve als kubische Bezier
    const k1x = x1 + 2 / 3 * (cx - x1), k1y = y1 + 2 / 3 * (cy - y1), k2x = x2 + 2 / 3 * (cx - x2), k2y = y2 + 2 / 3 * (cy - y2);
    this.ops.push(`${farbe(c)} RG ${lw} w ${strichel ? `[${strichel.join(' ')}] 0 d` : '[] 0 d'} 1 J ${+x1.toFixed(2)} ${this.y(y1)} m `
      + `${+k1x.toFixed(2)} ${this.y(k1y)} ${+k2x.toFixed(2)} ${this.y(k2y)} ${+x2.toFixed(2)} ${this.y(y2)} c S`);
  }
  kreis(x, y, r, {fuell = F.cu, strich = F.weiss, lw = 0.8} = {}) {
    const k = 0.5523 * r, Y = this.y(y), p = v => +v.toFixed(2);
    this.ops.push(`${farbe(fuell)} rg ${farbe(strich)} RG ${lw} w [] 0 d ${p(x + r)} ${p(Y)} m ${p(x + r)} ${p(Y + k)} ${p(x + k)} ${p(Y + r)} ${p(x)} ${p(Y + r)} c `
      + `${p(x - k)} ${p(Y + r)} ${p(x - r)} ${p(Y + k)} ${p(x - r)} ${p(Y)} c ${p(x - r)} ${p(Y - k)} ${p(x - k)} ${p(Y - r)} ${p(x)} ${p(Y - r)} c `
      + `${p(x + k)} ${p(Y - r)} ${p(x + r)} ${p(Y - k)} ${p(x + r)} ${p(Y)} c B`);
  }
  bild(name, x, y, w, h) { this.ops.push(`q ${+w.toFixed(2)} 0 0 ${+h.toFixed(2)} ${+x.toFixed(2)} ${this.y(y + h)} cm /${name} Do Q`); }
  link(x, y, w, h, url) { this.links.push({rect: [x, this.y(y + h), x + w, this.y(y)].map(v => +v.toFixed(2)), url}); }
}

// --- Fliesstext mit eingebetteten Stand-Marken ----------------------------------------------------------------------------
// Ein Lauf ist {s, f, c} (Text) oder {st} (Stand-Marke) oder {nl: true} (Zeilenumbruch).
const T = (s, f = 'n', c) => ({s: String(s ?? ''), f, c});
const B = s => T(s, 'b');
const I = s => T(s, 'i', F.muted);
const M = st => ({st});
const NL = {nl: true};
function marke(seite, x, y, st, gr) {   // y = Grundlinie
  const m = STAND[st], g = Math.max(MINDESTSCHRIFT, gr * 0.9), w = breiteVon(m.text, 'b', g) + 3, h = g * 1.08;
  if (seite) {
    seite.rechteck(x, y - g * 0.86, w, h, {fuell: m.bg, strich: m.rand || null, lw: 0.4, strichel: m.rand ? [1.2, 0.8] : null});
    seite.text(x + 1.5, y - g * 0.06, m.text, {gr: g, f: 'b', c: m.fg});
  }
  return w;
}
function fluss(seite, laeufe, x, y, w, gr, {zeilenhoehe = 1.28} = {}) {   // y = Oberkante; liefert die Höhe
  const lh = gr * zeilenhoehe, raum = breiteVon(' ', 'n', gr);
  const tokens = [];
  for (const l of laeufe) {
    if (!l) continue;
    if (l.nl) { tokens.push({nl: true}); continue; }
    if (l.st) { tokens.push({st: l.st, w: marke(null, 0, 0, l.st, gr), vor: true}); continue; }
    const teile = l.s.split(/(\s+)/);
    let vor = /^\s/.test(l.s) || l.leer !== false;
    for (const t of teile) {
      if (!t) continue;
      if (/^\s+$/.test(t)) { vor = true; continue; }
      tokens.push({s: t, f: l.f, c: l.c, w: breiteVon(t, l.f, gr), vor: vor && !/^[.,;:)]/.test(t)}); vor = false;
    }
  }
  let cx = 0, zeile = 0, erste = true;
  const setze = (tok, dx) => {
    if (!seite) return;
    const by = y + zeile * lh + gr * 0.95;
    if (tok.st) marke(seite, x + dx, by, tok.st, gr); else seite.text(x + dx, by, tok.s, {gr, f: tok.f, c: tok.c});
  };
  for (const tok of tokens) {
    if (tok.nl) { zeile++; cx = 0; erste = true; continue; }
    const abstand = !erste && tok.vor ? raum : 0;
    if (!erste && cx + abstand + tok.w > w) { zeile++; cx = 0; erste = true; }
    if (tok.w > w && tok.s) {   // überlanges Wort (z. B. Pfad) zeichenweise umbrechen
      let rest = tok.s;
      while (rest) {
        let n = rest.length;
        while (n > 1 && breiteVon(rest.slice(0, n), tok.f, gr) > w - cx) n--;
        setze({...tok, s: rest.slice(0, n)}, cx);
        rest = rest.slice(n);
        if (rest) { zeile++; cx = 0; } else cx += breiteVon(tok.s.slice(tok.s.length - n), tok.f, gr);
      }
      erste = false; continue;
    }
    cx += erste ? 0 : abstand;
    setze(tok, cx);
    cx += tok.w; erste = false;
  }
  return (zeile + 1) * lh;
}

// --- Tabelle --------------------------------------------------------------------------------------------------------------
function tabelle(seite, x, y, spalten, zeilen, gr, {kopf = true} = {}) {   // spalten: [{t, w}], zeilen: [[laeufe...]]; liefert Höhe
  const pad = 2.5; let h = 0;
  if (kopf) {
    const kh = gr * 1.35 + pad * 2;
    if (seite) {
      seite.rechteck(x, y, spalten.reduce((n, s) => n + s.w, 0), kh, {fuell: F.kopf});
      let cx = x; for (const s of spalten) { seite.text(cx + pad, y + pad + gr * 0.95, s.t, {gr, f: 'b', c: F.muted}); cx += s.w; }
    }
    h += kh;
  }
  for (const zeile of zeilen) {
    const hs = zeile.map((laeufe, i) => fluss(null, laeufe, 0, 0, spalten[i].w - pad * 2, gr));
    const zh = Math.max(...hs) + pad * 2;
    if (seite) {
      let cx = x;
      zeile.forEach((laeufe, i) => { fluss(seite, laeufe, cx + pad, y + h + pad, spalten[i].w - pad * 2, gr); cx += spalten[i].w; });
      seite.linie(x, y + h + zh, x + spalten.reduce((n, s) => n + s.w, 0), y + h + zh, {c: F.line, lw: 0.5});
    }
    h += zh;
  }
  return h;
}

// --- Stand einer Angabe aus kette.json ------------------------------------------------------------------------------------
function stand(o) {
  if (!o) return 'U';
  if (o.ebene === 'ANNAHME') return 'A';
  if (o.wert === null || o.evidenz === 'UNKNOWN' || o.freigabe === 'UNKNOWN') return 'U';
  if (o.evidenz === 'RECHNUNG') return 'R';
  return o.freigabe === 'FREIGEGEBEN' ? 'B' : 'K';
}
const AUSFALL_STAND = {BELEGT: 'B', RECHNUNG: 'R', ANNAHME: 'A', UNBEKANNT: 'U'};

// Quellenverzeichnis: Nummern in der Reihenfolge der ersten Nennung
function verzeichnis(daten) {
  const liste = [], nr = new Map();
  const ref = ids => {
    const n = [...new Set(ids.filter(Boolean))].filter(id => daten.quellen[id]).map(id => {
      if (!nr.has(id)) { liste.push(id); nr.set(id, liste.length); }
      return nr.get(id);
    }).sort((a, b) => a - b);
    const teile = [];
    for (const x of n) { const l = teile.at(-1); if (l && x === l[1] + 1) l[1] = x; else teile.push([x, x]); }
    return n.length ? T(` [${teile.map(([a, b]) => a === b ? a : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`).join(', ')}]`, 'n', F.muted) : null;
  };
  return {liste, ref, belege: bs => ref((bs || []).map(b => b.quelle))};
}

// --- Inhalt ----------------------------------------------------------------------------------------------------------------
function wert(m) {
  if (m.wert === null) return 'unbekannt';
  const w = m.wert_von !== null && m.wert_von !== undefined ? `rund ${z(m.wert)} (${z(m.wert_von)} bis ${z(m.wert_bis)})`
    : m.wert_bis !== null && m.wert_bis !== undefined ? `${z(m.wert)} bis ${z(m.wert_bis)}` : (m.ebene === 'ANNAHME' ? 'rund ' : '') + z(m.wert);
  return `${w} ${m.einheit || ''}`.trim();
}
function blaetter(ek, b, out = []) {   // Enden der Pflichtpfade: letzter Eigentümer oder oberste Gesellschaft
  if (!b) return out;
  const k = ek.knoten[b.knoten];
  if (b.pflicht && ['ENDE', 'OBERSTE'].includes(b.schluss) && b.kante) out.push({name: k.name, eff: b.effektiv, text: b.schluss_text});
  for (const c of b.kinder) blaetter(ek, c, out);
  if (b.pflicht && b.schluss === 'OBERSTE' && !b.kante) out.push({name: k.name, eff: null, text: b.schluss_text});
  return out;
}
function ekBelege(ek, b, out = []) {
  if (!b) return out;
  const e = b.kante ? ek.kanten.find(x => x.id === b.kante) : null;
  if (b.pflicht && e) out.push(...e.belege);
  const k = ek.knoten[b.knoten];
  if (b.pflicht && k.oberste) out.push(...k.oberste.belege);
  for (const c of b.kinder) ekBelege(ek, c, out);
  return out;
}
function kurzname(n) { return n.length > 48 ? n.slice(0, 46).replace(/\s+\S*$/, '') + ' …' : n; }

const MENGE_KURZ = {PRODUKTION: 'Förderung', NENNKAPAZITAET: 'Nennkapazität', PRODUKTION_QUARTAL: 'Anoden im Quartal', DRAHTPRODUKTION: 'Drahtproduktion',
  KONZENTRATDURCHSATZ: 'Konzentratdurchsatz', ANTEIL_WELTKUPFER: 'Bedarf in % der Weltproduktion'};
const jahr = m => !m.zeitraum ? '' : m.zeitraum[0].slice(0, 4) === m.zeitraum[1].slice(0, 4) && m.zeitraum[0].slice(5) === '01-01' && m.zeitraum[1].slice(5) === '12-31'
  ? m.zeitraum[0].slice(0, 4) : `${m.zeitraum[0].slice(0, 7)} bis ${m.zeitraum[1].slice(0, 7)}`;
function seiteEins(daten, opt, qv, S) {
  // Kompakt (Mindestschrift 8 pt): je Glied Menge, direkte Eigentümer mit Anteil, Risiko-Ebene als Kürzel L/S/N/K und die
  // Einzelrisiken mit Namen; Zitate und Details stehen in der Quellenliste bzw. auf /kupferkette/.
  const an = opt.ansicht === 'annahmen', zeigen = o => an || o.ebene !== 'ANNAHME', ek = daten.eigentumskette;
  const zeilen = daten.standorte.map(s => {
    const glied = [B(`${nrPdf(daten, s)}. ${s.kurz}`), s.land ? T(`(${s.land})`, 'n', F.muted) : null];
    const mengen = s.mengen.filter(zeigen).filter(m => m.groesse !== 'BETREIBER');
    const menge = mengen.length ? mengen.flatMap((m, i) => [i ? NL : null, T(`${MENGE_KURZ[m.groesse] || m.groesse_text}:`), m.wert === null ? null : B(wert(m)),
      m.zeitraum ? T(`(${jahr(m)})`, 'n', F.muted) : null, M(stand(m)), m.ebene === 'ANNAHME' ? qv.ref([m.annahme.quelle]) : qv.belege(m.belege)]) : [M('U')];
    const g = ek?.glieder[s.id];
    const eig = s.eigentum.filter(e => e.umfang !== 'INDIREKT').flatMap((e, i) => [i ? NL : null,
      T(`${kurzname(e.eigentuemer)}${e.anteil !== null ? ` ${z(e.anteil)} %` : ''}`), M(stand(e)), qv.belege(e.belege)]);
    if (!eig.length && g?.baum && g.bezug === 'ZUGEHOERIG') {
      const erstes = daten.standorte.find(x => ek.glieder[x.id]?.baum?.knoten === g.baum.knoten);
      eig.push(T(erstes && erstes.id !== s.id ? `wie Glied ${nrPdf(daten, erstes)}` : ek.knoten[g.wurzel].name), M('K'), qv.belege(g.bezug_belege));
    }
    if (!eig.length) eig.push(M('U'));
    const ri = [];
    if (s.risikoebene && daten.risikoebene) {
      for (const k of daten.risikoebene.kategorien) {
        const f = s.risikoebene[k.id];
        const st = f.belegt.length ? (f.belegt.some(e => e.bezug !== 'LAND') ? 'B' : 'L') : an && f.annahmen.length ? 'A' : 'U';
        ri.push(B(RE_KUERZEL[k.id] || k.id), M(st));
      }
      ri.push(qv.ref(Object.values(s.risikoebene).flatMap(f => [...f.belegt.flatMap(e => e.belege.map(b => b.quelle)), ...(an ? f.annahmen.map(e => e.annahme?.quelle) : [])])));
    }
    if (s.risiken.length) ri.push(NL, ...s.risiken.flatMap((r, i) => [T(`${r.art_text}${i < s.risiken.length - 1 ? '' : ''}`), M(stand(r)), qv.belege(r.belege)]));
    return [glied, menge, eig, ri];
  });
  const vz = daten.verbindungen.filter(zeigen).map(v => {
    const lm = v.mengen.filter(m => m.groesse === 'LIEFERMENGE');
    const b = lm.find(m => m.ebene === 'BELEGT'), a = lm.find(m => m.ebene === 'ANNAHME');
    const menge = [];
    if (b) menge.push(b.wert === null ? null : T(wert(b)), M(stand(b)), b.wert !== null ? qv.belege(b.belege) : null);
    if (an && a) menge.push(T(wert(a)), M('A'), qv.ref([a.annahme.quelle]));
    if (!menge.length) menge.push(M('U'));
    // Wert pro Jahr: belegt nur mit Quelle (sonst U); mit Annahmen als Rechnung Menge x LME-Kasse / EZB-Kurs (Stand A)
    const lw = v.mengen.filter(m => m.groesse === 'LIEFERWERT'), wb = lw.find(m => m.ebene === 'BELEGT'), wa = lw.find(m => m.ebene === 'ANNAHME');
    // Mit Annahmen: Menge und Wert in einem Lauf ("rund 8,5 kt Cu/Jahr = rund 106 Mio. €/Jahr", Stand A); belegt: eigener Wert oder U
    const zusammen = an && a && wa && !(wb && wb.wert !== null);
    if (zusammen) {   // kurz: "≈ 8,5 kt Cu/a · 106 Mio. €/a"; Spanne nur in der Seite und in kette.json
      const i = menge.findIndex(x => x && x.s === wert(a));
      if (i >= 0) menge.splice(i, 3, T(`~ ${z(a.wert, 1)} ${a.einheit.replace('/Jahr', '/a')} · ${z(wa.wert, 0)} Mio. €/a`), M('A'));
    }
    const wert_ = zusammen ? [] : wb && wb.wert !== null ? [T('Wert:', 'n', F.muted), T(wert(wb)), M(stand(wb)), qv.belege(wb.belege)] : [T('Wert:', 'n', F.muted), M('U')];
    const og = v.mengen.find(m => m.groesse === 'LAENDERSTROM_MENGE'), ow = v.mengen.find(m => m.groesse === 'LAENDERSTROM_WERT');
    const ober = og ? [T(`Obergrenze Länderstrom ${og.einheit.split(' ').pop()} ${og.zeitraum[0].slice(0, 4)}:`.replace(an ? 'Länderstrom ' : '\u0000', ''), 'n', F.muted), T(`${z(og.wert / 1000, 1)} kt, ${z(ow.wert, 0)} Mio. €`), M(stand(og)), qv.belege(og.belege)] : [];
    const status = v.ebene === 'ANNAHME' ? [M('A'), qv.ref([v.annahme?.quelle])] : [M(v.freigabe === 'FREIGEGEBEN' ? 'B' : 'K'), qv.belege(v.belege)];
    return [B(`${v.id} `), T(`${S[v.von].kurz} -> ${S[v.nach].kurz}`), ...status, zusammen ? null : T('Menge:', 'n', F.muted), ...menge, ...wert_, ...ober];
  });
  return {zeilen, vz};
}
const RE_KUERZEL = {LAENDERRISIKO: 'L', SANKTIONEN: 'S', NATURGEFAHREN: 'N', KONZENTRATION: 'K'};
const KAT_KURZ = {LAENDERRISIKO: 'Länder', SANKTIONEN: 'Sanktionen', NATURGEFAHREN: 'Natur', KONZENTRATION: 'Konzentration'};
const ART = {VERARBEITUNG: 'Verarbeitung', TRANSPORT: 'Transport', HANDEL: 'Handel (Verkauf, kein Warenweg)', LIEFERUNG: 'Lieferung'};

function seiteZwei(daten, opt, qv, S) {
  const an = opt.ansicht === 'annahmen';
  const g = daten.ausfall.glieder.find(x => x.standort === opt.ausfall), a = g.ansichten[opt.ansicht];
  const kunde = S[daten.ausfall.kunde].kurz;
  const R = Object.fromEntries(daten.standorte.flatMap(s => s.risiken.map(r => [r.id, r])));
  const X = Object.fromEntries(daten.standorte.flatMap(s => (s.ersatz || []).map(e => [e.id, e])));
  const ALT = Object.fromEntries((daten.alternativen || []).map(x => [x.id, x]));
  const V = Object.fromEntries(daten.verbindungen.map(v => [v.id, v]));
  const einordnung = ids => ids.map(i => R[i]).filter(Boolean).flatMap(r => [NL, I('Einordnung: '), T(`${r.art_text}: ${r.text}`), M(stand(r)), qv.belege(r.belege)]);
  const t = a.tonnen;
  const tonnen = [];
  if (t.status === 'BELEGT') tonnen.push(B(`${z(t.kt)} kt`), M('B'));
  else tonnen.push(T('Belegt:'), M('U'), T(t.grund));
  if (t.obergrenze) tonnen.push(NL, T('Obergrenze: höchstens '), B(`${z(t.obergrenze.kt)} kt`), M('R'), I(`${t.obergrenze.rechnung}. ${t.obergrenze.hinweis}`),
    qv.ref(t.obergrenze.posten.flatMap(p => { const m = [...daten.standorte.flatMap(s => s.mengen), ...daten.verbindungen.flatMap(v => v.mengen)].find(x => x.id === p.menge); return m ? m.belege.map(b => b.quelle) : []; })));
  if (an && t.annahme) tonnen.push(NL, T('Annahme: rund '), B(`${z(t.annahme.kt)} ${t.annahme.einheit}`), T(`(${z(t.annahme.von)} bis ${z(t.annahme.bis)})`), M('A'),
    I(`${t.annahme.annahmen.join(', ')}, Konfidenz ${z(t.annahme.konfidenz)}; Rechnung: ${t.annahme.rechnung}`), qv.ref(['annahmen-atlas']));
  const e = a.ersatz, ersatz = [];
  if (e.status === 'UNBEKANNT') ersatz.push(T('Benannter Ersatzlieferant:'), M('U'), T(e.grund));
  for (const w of e.wege) ersatz.push(ersatz.length ? NL : null, T('Erfasster Ausweichweg: ' + w.map(id => V[id]).map((v, i) => (i ? '' : S[v.von].kurz) + ` -> ${S[v.nach].kurz}`).join('')),
    M(w.some(id => V[id].ebene === 'ANNAHME') ? 'A' : 'B'));
  for (const x of e.angaben.map(i => X[i]).filter(Boolean)) ersatz.push(ersatz.length ? NL : null, T(x.text), M(stand(x)), qv.belege(x.belege));
  if (!ersatz.length) ersatz.push(M('U'));
  const kap = [];
  for (const x of e.alternativen) {
    const A = ALT[x.id]; if (!A) continue;
    const ms = x.mengen.map(i => A.mengen.find(m => m.id === i)).filter(m => m && (an || m.ebene !== 'ANNAHME'));
    kap.push(kap.length ? NL : null, B(A.kurz), T(`(${A.land ? A.land + ', ' : ''}${A.bezug.art === 'BELEGTE_BEZIEHUNG' ? 'belegte Beziehung zur Kette' : 'keine belegte Beziehung'})`, 'n', F.muted),
      M(A.bezug.freigabe === 'FREIGEGEBEN' ? 'B' : 'K'), qv.belege(A.bezug.belege));
    for (const m of ms) kap.push(T(`· ${wert(m)}`), M(stand(m)), m.ebene === 'ANNAHME' ? qv.ref([m.annahme?.quelle]) : qv.belege(m.belege));
    if (!ms.length) kap.push(T('· Kapazität'), M('U'));
  }
  if (!kap.length) kap.push(M('U'));
  kap.push(NL, I(a.kapazitaet.grund));
  const tst = t.status !== 'UNBEKANNT' ? t.status : an && t.annahme ? 'ANNAHME' : 'UNBEKANNT';
  // Ausfall-Annahmen (Mehrpreis, Dauer): nur "Mit Annahmen"; Quelle der Annahme steht kurz dabei (Herausgeber, Datum).
  const qa = x => `Quelle der Annahme: ${x.quelle.herausgeber}, ${x.quelle.veroeffentlicht}${x.quelle.fundstelle ? ', ' + x.quelle.fundstelle : ''}`;
  const mk = a.mehrkosten, du = a.dauer;
  const mehr = an && mk.status === 'ANNAHME'
    ? [T('Belegt:'), M('U'), NL, T('Annahme: '), ...(mk.ueber_dauer ? [B(`${z(mk.ueber_dauer.mio_eur)} Mio. EUR`), T(`über die Dauer (${z(mk.ueber_dauer.von)} bis ${z(mk.ueber_dauer.bis)}); `)] : []),
       B(`${z(mk.je_jahr.mio_eur)} Mio. EUR je Jahr`), T(`(${z(mk.je_jahr.von)} bis ${z(mk.je_jahr.bis)})`), M('A'),
       I(`${mk.annahmen.join(', ')}, Konfidenz ${z(mk.konfidenz)}; Rechnung: ${mk.rechnung}. ${qa(mk.annahme)}`), qv.ref(['annahmen-atlas']), ...einordnung(mk.einordnung)]
    : [T(mk.grund), ...einordnung(mk.einordnung)];
  const dauer = an && du.status === 'ANNAHME'
    ? [T('Belegt:'), M('U'), NL, T('Annahme: rund '), B(`${z(du.annahme.wert)} ${du.annahme.einheit}`), T(`(${z(du.annahme.von)} bis ${z(du.annahme.bis)})`), M('A'),
       I(`${du.annahme.id}, ${du.annahme.art}, Konfidenz ${z(du.annahme.konfidenz)}. ${qa(du.annahme)}`), qv.ref(['annahmen-atlas']), ...einordnung(du.einordnung)]
    : [T(du.grund), ...einordnung(du.einordnung)];
  const folgen = [
    [[B(`Fehlende Tonnen bei ${kunde}`), M(AUSFALL_STAND[tst])], tonnen],
    [[B('Mehrkosten'), M(AUSFALL_STAND[an ? mk.status : 'UNBEKANNT'])], mehr],
    [[B('Dauer'), M(AUSFALL_STAND[an ? du.status : 'UNBEKANNT'])], dauer],
    [[B('Ersatz'), M(AUSFALL_STAND[e.status])], ersatz],
    [[B('Ausweichquellen und Kapazität'), M(AUSFALL_STAND[a.kapazitaet.status])], kap],
  ];
  const betroffen = a.betroffene_wege.length ? a.betroffene_wege.map(v => `${v} ${S[V[v].von].kurz} -> ${S[V[v].nach].kurz}${V[v].ebene === 'ANNAHME' ? ' (Annahme)' : ''}`).join('; ') : 'keine';
  const eingaben = a.eingaben.flatMap(x => [T(x.text, 'n'), M(AUSFALL_STAND[x.status])]);
  return {g, a, kunde, folgen, betroffen, eingaben};
}

// --- Karte: Ausschnitt aus dem Erdbild (Plattkarte) + Kette als Vektor ---------------------------------------------------
function kartenRahmen(punkte, w, h) {
  const lons = punkte.map(p => p.lon), lats = punkte.map(p => p.lat);
  let lo0 = Math.min(...lons) - 12, lo1 = Math.max(...lons) + 12, la0 = Math.min(...lats) - 22, la1 = Math.max(...lats) + 8;
  const soll = w / h;
  if ((lo1 - lo0) / (la1 - la0) < soll) { const d = (la1 - la0) * soll - (lo1 - lo0); lo0 -= d / 2; lo1 += d / 2; }
  else { const d = (lo1 - lo0) / soll - (la1 - la0); la0 -= d / 2; la1 += d / 2; }
  if (la1 > 85) { la0 -= la1 - 85; la1 = 85; }
  if (la0 < -85) { la1 += -85 - la0; la0 = -85; }
  return {lo0, lo1, la0, la1};
}
export async function kartenBild(rahmen, quelle = '/assets/earth-blue-marble.jpg') {
  try {
    const img = new Image(); img.decoding = 'async'; img.src = quelle;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas');
    c.width = 900; c.height = Math.round(900 * (rahmen.la1 - rahmen.la0) / (rahmen.lo1 - rahmen.lo0));
    const sx = (rahmen.lo0 + 180) / 360 * W, sy = (90 - rahmen.la1) / 180 * H, sw = (rahmen.lo1 - rahmen.lo0) / 360 * W, sh = (rahmen.la1 - rahmen.la0) / 180 * H;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(6,18,28,0.18)'; ctx.fillRect(0, 0, c.width, c.height);   // etwas abdunkeln, damit Linien lesbar sind
    const b64 = c.toDataURL('image/jpeg', 0.82).split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return {bytes, w: c.width, h: c.height};
  } catch { return null; }
}
function karte(seite, daten, opt, x, y, w, h, rahmen, bild) {
  const an = opt.ansicht === 'annahmen';
  const px = lon => x + (lon - rahmen.lo0) / (rahmen.lo1 - rahmen.lo0) * w, py = lat => y + (rahmen.la1 - lat) / (rahmen.la1 - rahmen.la0) * h;
  if (bild) seite.bild('Karte', x, y, w, h); else seite.rechteck(x, y, w, h, {fuell: '#2a4a63'});
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s]));
  const farbeArt = {VERARBEITUNG: F.cu, TRANSPORT: F.tr, HANDEL: F.ha, LIEFERUNG: F.li};
  const reihen = daten.verbindungen.filter(v => an || v.ebene !== 'ANNAHME');
  for (const v of reihen) {
    const a = S[v.von].ort, b = S[v.nach].ort; if (a.lat === null || b.lat === null) continue;
    const x1 = px(a.lon), y1 = py(a.lat), x2 = px(b.lon), y2 = py(b.lat), d = Math.hypot(x2 - x1, y2 - y1);
    if (d < 3) continue;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -(y2 - y1) / d, ny = (x2 - x1) / d, k = Math.min(28, d * 0.18);
    const st = v.ebene === 'ANNAHME' ? {c: '#e6eaee', strichel: [2, 1.6], lw: 0.9} : v.freigabe !== 'FREIGEGEBEN' ? {c: F.li, strichel: [3, 1.6], lw: 1.4}
      : {c: farbeArt[v.art] || F.cu, strichel: v.art === 'HANDEL' ? [3, 1.6] : null, lw: 1.3};
    seite.bogen(x1, y1, mx + nx * k, my + ny * k, x2, y2, st);
  }
  // Punkte; nahe Standorte (unter 2 Grad) teilen sich eine Beschriftung
  const gruppen = [];
  for (const s of daten.standorte) {
    if (s.ort.lat === null) continue;
    const g = gruppen.find(q => Math.hypot(q.lat - s.ort.lat, q.lon - s.ort.lon) < 2);
    if (g) g.st.push(s); else gruppen.push({lat: s.ort.lat, lon: s.ort.lon, st: [s]});
  }
  const belegt = [[x, y + h - 12, 170, 12]];   // Bildnachweis unten links
  for (const g of gruppen) belegt.push([px(g.lon) - 4, py(g.lat) - 4, 8, 8]);
  for (const g of [...gruppen].sort((a, b) => a.st.length - b.st.length)) {   // kleine Beschriftungen zuerst, grosse finden dann ihren Platz
    const cx = px(g.lon), cy = py(g.lat);
    const st = [...new Set(g.st.map(s => s.stufe))].sort((a, b) => a - b);
    // Ballung (mehr als 2 Glieder am selben Ort): nur die Nummern, Namen stehen in der Tabelle darunter
    const zeilen = g.st.length > 2 ? [`${st[0]}.–${st.at(-1)}. ${g.st[0].kurz.replace(/^\S+\s/, '')} u. a.`] : g.st.map(s => `${nrPdf(daten, s)}. ${s.kurz}`), gr = MINDESTSCHRIFT, lw = Math.max(...zeilen.map(t => breiteVon(t, 'b', gr))) + 6, lh = zeilen.length * gr * 1.22 + 4;
    const lagen = [[cx + 7, cy - lh / 2], [cx - 7 - lw, cy - lh / 2], [cx - lw / 2, cy - 7 - lh], [cx - lw / 2, cy + 7], [cx + 7, cy - lh - 2], [cx + 7, cy + 2], [cx - 7 - lw, cy + 2], [cx - 7 - lw, cy - lh - 2]];
    const frei = ([lx, ly]) => lx >= x + 1 && ly >= y + 1 && lx + lw <= x + w - 1 && ly + lh <= y + h - 1
      && !belegt.some(r => lx < r[0] + r[2] + 2 && lx + lw + 2 > r[0] && ly < r[1] + r[3] + 2 && ly + lh + 2 > r[1]);
    const klemm = ([lx, ly]) => [Math.min(Math.max(lx, x + 1), x + w - 1 - lw), Math.min(Math.max(ly, y + 1), y + h - 1 - lh)];   // nie über den Kartenrand
    const [lx, ly] = lagen.find(frei) || lagen.map(klemm).find(frei) || klemm(lagen[0]);
    belegt.push([lx, ly, lw, lh]);
    seite.rechteck(lx, ly, lw, lh, {fuell: F.nacht, strich: '#8fa6b8', lw: 0.4});
    zeilen.forEach((t, i) => seite.text(lx + 3, ly + 2 + gr * (1.22 * i + 0.95), t, {gr, f: 'b', c: F.weiss}));
  }
  for (const g of gruppen) seite.kreis(px(g.lon), py(g.lat), 3.2, {fuell: g.st.every(s => s.ort.freigabe !== 'FREIGEGEBEN') ? F.li : '#ffd27a', strich: F.weiss});
  // Legende und Bildnachweis
  // Legende der Linien: eine Zeile unter der Karte (über der Karte würde sie Beschriftungen verdecken)
  const lg = [[F.cu, null, 'Verarbeitung'], [F.tr, null, 'Transport'], [F.ha, [3, 1.6], 'Handel (kein Warenweg)'], [F.li, [3, 1.6], 'Lieferung, Kandidat']];
  if (an) lg.push(['#9aa7b0', [2, 1.6], 'Annahme']);
  let lx = x;
  for (const [c, sd, t] of lg) { seite.linie(lx, y + h + 7, lx + 16, y + h + 7, {c, lw: 1.6, strichel: sd}); seite.text(lx + 19, y + h + 10, t, {gr: MINDESTSCHRIFT, c: F.muted}); lx += 19 + breiteVon(t, 'n', MINDESTSCHRIFT) + 10; }
  seite.text(x + 4, y + h - 3, bild ? 'Karte: NASA Blue Marble 2002 (historisch)' : 'Kartenbild nicht verfügbar', {gr: MINDESTSCHRIFT, c: F.weiss});
  seite.rechteck(x, y, w, h, {strich: F.line, lw: 0.6});
}

// --- Kopf und Fuss ---------------------------------------------------------------------------------------------------------
function kopf(seite, daten, opt, nr, titel) {
  const L = 36, R = A4.w - 36;
  seite.text(L, 44, titel, {gr: 14.5, f: 'b'});
  seite.text(R - breiteVon('marktatlas', 'b', 9), 30, 'marktatlas', {gr: 9, f: 'b', c: F.cu});
  const zeile = `Gesprächsausdruck · Ansicht: ${opt.ansicht === 'annahmen' ? 'Mit Annahmen' : 'Belegt'} · Datenstand ${daten.stand} · erstellt ${opt.erstellt} · Seite ${nr} von 2`;
  seite.text(L, 57, zeile, {gr: MINDESTSCHRIFT, c: F.muted});
  seite.linie(L, 63, R, 63, {c: F.line, lw: 0.8});
}
function fuss(seite, daten, opt) {
  const L = 36, R = A4.w - 36;
  seite.linie(L, A4.h - 34, R, A4.h - 34, {c: F.line, lw: 0.6});
  fluss(seite, [I(`Daten: /kupferkette/kette.json, Datenstand ${daten.stand}. Nichts nachgerechnet oder ergänzt; unbekannt bleibt unbekannt, nie 0. `
    + (opt.ansicht === 'annahmen' ? 'Annahmen stammen aus dem Annahmen-Atlas und sind nie belegt oder freigegeben.' : 'Ansicht „Belegt“: Annahmen ausgeblendet.'))],
  L, A4.h - 31, R - L, MINDESTSCHRIFT);
}
const KURZERKL = {B: 'Quelle + Zitat, freigegeben', K: 'Quelle + Zitat, Prüfung offen', R: 'Arithmetik aus Belegen', L: 'Risiko nur für das Land belegt', A: 'Annahme-Atlas, nicht belegt', U: 'keine Quelle, nie 0'};
function legende(seite, x, y, w, gr, an) {
  const laeufe = [];
  for (const k of ['B', 'K', 'R', 'L', 'A', 'U']) {
    if (k === 'A' && !an) continue;
    laeufe.push(M(k), T(`${KURZERKL[k]}${k === 'U' ? '.' : ';'}`, 'n', F.muted));
  }
  return fluss(seite, [B('Kennzeichnung:'), ...laeufe, NL, B('Risiko-Ebene:'), T('L Länderrisiko, S Sanktionen, N Naturgefahren, K Konzentration. [n] = Nummer in der Quellenliste (Seite 2).', 'n', F.muted)], x, y, w, gr);
}

// --- Seitenaufbau: feste Schrift (Mindestschrift 8 pt), alles muss auf genau 2 Seiten passen ---------------------------
function baue(daten, opt, rahmen, bild) {
  const S = Object.fromEntries(daten.standorte.map(s => [s.id, s])), an = opt.ansicht === 'annahmen';
  const qv = verzeichnis(daten), L = 36, BR = A4.w - 72, UNTEN = A4.h - 38, gr = MINDESTSCHRIFT, H2 = 10.5;
  const titel = `${daten.rohstoff}: ${daten.kette}`;
  // Seite 1
  const s1 = new Seite();
  kopf(s1, daten, opt, 1, titel);
  let y = 69;
  y += legende(s1, L, y, BR, gr, an) + 5;
  const kw = Math.round(BR * KARTE_ANTEIL), kh = Math.round(kw / 1.5);
  karte(s1, daten, opt, L, y, kw, kh, rahmen, bild);
  // rechts neben der Karte: Kundenfrage und Antwort aus den Zählern
  const rx = L + kw + 10, rw = BR - kw - 10, zz = daten.zaehler, V8 = daten.verbindungen.find(v => v.nach === daten.ausfall.kunde && v.ebene === 'BELEGT');
  const lm = V8?.mengen.find(m => m.groesse === 'LIEFERMENGE' && m.ebene === 'BELEGT'), la = V8?.mengen.find(m => m.groesse === 'LIEFERMENGE' && m.ebene === 'ANNAHME');
  const ekm = daten.eigentumskette?.messung, rem = daten.risikoebene?.messung, afm = daten.ausfall.messung;
  const antwort = [I(`Kundenfrage ${daten.kundenfrage.kunde}`), NL, B(daten.kundenfrage.frage), NL,
    T(`• ${zz.verbindungen} belegte Verbindungen: ${zz.verbindungen_freigegeben} freigegeben, ${zz.verbindungen_kandidat} Kandidat.`), NL];
  if (V8) antwort.push(T(`• ${S[V8.von].kurz} -> ${S[V8.nach].kurz}`), M(V8.freigabe === 'FREIGEGEBEN' ? 'B' : 'K'), T('Menge'), lm && lm.wert !== null ? B(wert(lm)) : M('U'),
    an && la ? T(`Annahme: rund ${z(la.wert)} ${la.einheit}`) : null, an && la ? M('A') : null, NL);
  const pb = daten.wert?.preisbasis, wa8 = V8?.mengen.find(m => m.groesse === 'LIEFERWERT' && m.ebene === 'ANNAHME');
  if (V8 && pb) antwort.push(T('  Wert'), M('U'), an && wa8 ? T(`Rechnung aus Annahme: rund ${z(wa8.wert, 1)} Mio. €/Jahr`) : null, an && wa8 ? M('A') : null,
    an ? T(`(Menge x LME-Kasse ${z(pb.preis.wert)} US$/t vom ${pb.preis.datum} ÷ EZB ${z(pb.kurs.wert, 4)} US$/€ vom ${pb.kurs.datum})`, 'n', F.muted) : null, an ? qv.ref([pb.preis.quelle, pb.kurs.quelle]) : null, NL);
  if (ekm) antwort.push(T(`• Eigentümer bis oben: ${ekm.vollstaendig} von ${ekm.glieder} Gliedern (${ekm.vollstaendig_freigegeben} freigegeben).`), NL);
  if (rem) antwort.push(T(`• Risiko-Ebene: ${rem.belegt} von ${rem.felder} Feldern belegt.`), NL);
  antwort.push(T(`• Ausfall: ${afm.simulierbar} von ${afm.glieder} Gliedern simulierbar; Seite 2:`), B(`${nrPdf(daten, S[opt.ausfall])}. ${S[opt.ausfall].kurz}.`));
  fluss(s1, antwort, rx, y, rw, gr);
  y += kh + 18;
  const inhalt = seiteEins(daten, opt, qv, S);
  s1.text(L, y + 9, 'Glieder der Kette: Menge, Eigentümer, Risiken', {gr: H2, f: 'b'}); y += 13;
  const sp = [{t: 'Glied', w: BR * 0.2}, {t: 'Menge am Standort', w: BR * 0.26}, {t: 'Eigentümer (direkt)', w: BR * 0.27}, {t: 'Risiken', w: BR * 0.27}];
  y += tabelle(s1, L, y, sp, inhalt.zeilen, gr) + 6;
  s1.text(L, y + 9, 'Verbindungen: Liefermenge und Wert pro Jahr', {gr: H2, f: 'b'});
  if (an && daten.wert) s1.text(L + 242, y + 9, `~ = Annahme; Wert = Menge × LME-Kasse ÷ EZB-Kurs (${daten.wert.preisbasis.preis.datum})`, {gr, c: F.muted});
  y += 13;
  {   // zwei Spalten, erst links, dann rechts
    const vw = (BR - 12) / 2, hs = inhalt.vz.map(l => fluss(null, l, 0, 0, vw, gr) + 2), haelfte = hs.reduce((n, h) => n + h, 0) / 2;
    let cy = y, spalte = 0, hoch = 0, summe = 0;
    inhalt.vz.forEach((l, i) => {
      if (spalte === 0 && summe > 0 && summe + hs[i] / 2 > haelfte) { spalte = 1; hoch = cy - y; cy = y; }
      fluss(s1, l, L + spalte * (vw + 12), cy, vw, gr); cy += hs[i]; summe += hs[i];
    });
    y += Math.max(hoch, cy - y);
  }
  const ueber1 = y > UNTEN, y1 = y;
  fuss(s1, daten, opt);
  // Seite 2
  const s2 = new Seite(), z2 = seiteZwei(daten, opt, qv, S), aus = S[opt.ausfall];
  kopf(s2, daten, opt, 2, `Ausfallszenario: ${nrPdf(daten, aus)}. ${aus.kurz} fällt aus`);
  y = 70;
  y += fluss(s2, [B(z2.a.kunde_abgeschnitten ? `Kette zu ${z2.kunde} unterbrochen. ` : `Kette zu ${z2.kunde} nicht unterbrochen. `), T(z2.a.lage),
    I(' Schlussfolgerung aus der Datenbank, kein Fakt.')], L, y, BR, gr) + 5;
  y += tabelle(s2, L, y, [{t: `Folge für ${z2.kunde}`, w: BR * 0.22}, {t: 'Ergebnis', w: BR * 0.78}], z2.folgen, gr) + 4;
  y += fluss(s2, [B('Betroffene Verbindungen: '), T(z2.betroffen)], L, y, BR, gr) + 2;
  y += fluss(s2, [B(`Eingaben (${z2.a.eingaben_belegt} von ${z2.a.eingaben.length} belegt${an ? `, mit Annahmen ${z2.a.eingaben_mit_annahmen}` : ''}): `), ...z2.eingaben], L, y, BR, gr) + 6;
  // Quellenliste: eine Zeile je Quelle (gekürzt, ganze Zeile verlinkt), zwei Spalten
  s2.text(L, y + 9, `Quellenliste (${qv.liste.length} Quellen, Nummern wie im Text; Zeile anklicken öffnet die Quelle)`, {gr: H2, f: 'b'}); y += 13;
  // so viele Zeilen je Quelle wie Platz ist (3, 2 oder 1); längere Titel werden mit … gekürzt, der Link führt zur ganzen Quelle
  const sw = (BR - 12) / 2, lh = gr * 1.28, platz = UNTEN - y;
  const eintrag = (id, i, n) => {
    const q = daten.quellen[id], nr = `[${i + 1}]`, stand = `· ${q.veroeffentlicht || q.abgerufen}`;
    let t = `${q.herausgeber}: ${q.titel}`;
    const laeufe = tt => [B(nr), T(tt, 'n', '#1d5f8f'), I(stand)];
    if (fluss(null, laeufe(t), 0, 0, sw, gr) > n * lh + 0.1) {
      while (t.length > 4 && fluss(null, laeufe(t + '…'), 0, 0, sw, gr) > n * lh + 0.1) t = t.slice(0, -1);
      t = t.trimEnd() + '…';
    }
    return {laeufe: laeufe(t), h: fluss(null, laeufe(t), 0, 0, sw, gr) + 1, url: q.url};
  };
  let zeilen = [], spalten = [[], []];
  for (const n of [3, 2, 1]) {
    zeilen = qv.liste.map((id, i) => eintrag(id, i, n));
    spalten = [[], []]; let sp = 0, hoehe = 0;
    for (const e of zeilen) { if (hoehe + e.h > platz) { if (sp === 1) break; sp = 1; hoehe = 0; } if (hoehe + e.h > platz) break; spalten[sp].push(e); hoehe += e.h; }
    if (spalten[0].length + spalten[1].length === zeilen.length) break;
  }
  spalten.forEach((liste, sp) => { let cy = y; for (const e of liste) { const qx = L + sp * (sw + 12); fluss(s2, e.laeufe, qx, cy, sw, gr); if (e.url) s2.link(qx, cy, sw, e.h, e.url); cy += e.h; } });
  const gezeigt = spalten[0].length + spalten[1].length;
  const ueber2 = gezeigt < zeilen.length;
  if (ueber2) s2.text(L, UNTEN + 2, `… ${zeilen.length - gezeigt} weitere Quellen in /kupferkette/kette.json`, {gr, f: 'i', c: F.muted});
  fuss(s2, daten, opt);
  return {seiten: [s1, s2], y1, ueber1, ueber2, ueberlauf: ueber1 || ueber2, quellen: qv.liste.length, quellen_gezeigt: gezeigt};
}

// --- PDF-Datei schreiben --------------------------------------------------------------------------------------------------
function pdfDatei(seiten, bild, info) {
  const teile = [], offs = [];
  let laenge = 0;
  const raus = x => { const b = typeof x === 'string' ? Uint8Array.from(x, c => c.charCodeAt(0) & 255) : x; teile.push(b); laenge += b.length; };
  const objekte = [];   // [nr, inhalt (string oder [string, bytes, string])]
  let n = 0; const neu = () => ++n;
  const KAT = neu(), SEITEN = neu(), F1 = neu(), F2 = neu(), F3 = neu(), INFO = neu(), BILD = bild ? neu() : 0;
  const seitenNr = [];
  for (const s of seiten) {
    const inhalt = s.ops.join('\n'), cn = neu(), annots = s.links.map(l => {
      const an = neu();
      objekte.push([an, `<< /Type /Annot /Subtype /Link /Rect [${l.rect.join(' ')}] /Border [0 0 0] /A << /S /URI /URI (${pdfText(l.url)}) >> >>`]);
      return an;
    });
    const pn = neu(); seitenNr.push(pn);
    objekte.push([cn, `<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`]);
    objekte.push([pn, `<< /Type /Page /Parent ${SEITEN} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Contents ${cn} 0 R /Resources << /Font << /F1 ${F1} 0 R /F2 ${F2} 0 R /F3 ${F3} 0 R >>`
      + `${bild ? ` /XObject << /Karte ${BILD} 0 R >>` : ''} >>${annots.length ? ` /Annots [${annots.map(a => `${a} 0 R`).join(' ')}]` : ''} >>`]);
  }
  objekte.push([KAT, `<< /Type /Catalog /Pages ${SEITEN} 0 R >>`]);
  objekte.push([SEITEN, `<< /Type /Pages /Kids [${seitenNr.map(p => `${p} 0 R`).join(' ')}] /Count ${seitenNr.length} >>`]);
  objekte.push([F1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
  objekte.push([F2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
  objekte.push([F3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>']);
  objekte.push([INFO, `<< /Title (${pdfText(info.titel)}) /Subject (${pdfText(info.thema)}) /Creator (marktatlas /kupferkette/) /Producer (kupferkette-pdf.mjs) /CreationDate (D:${info.datum}) >>`]);
  if (bild) objekte.push([BILD, [`<< /Type /XObject /Subtype /Image /Width ${bild.w} /Height ${bild.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bild.bytes.length} >>\nstream\n`, bild.bytes, '\nendstream']]);
  objekte.sort((a, b) => a[0] - b[0]);
  raus('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n');
  for (const [nr, inhalt] of objekte) {
    offs[nr] = laenge;
    raus(`${nr} 0 obj\n`);
    if (Array.isArray(inhalt)) inhalt.forEach(raus); else raus(inhalt);
    raus('\nendobj\n');
  }
  const xref = laenge;
  raus(`xref\n0 ${n + 1}\n0000000000 65535 f \n` + Array.from({length: n}, (_, i) => `${String(offs[i + 1]).padStart(10, '0')} 00000 n \n`).join(''));
  raus(`trailer\n<< /Size ${n + 1} /Root ${KAT} 0 R /Info ${INFO} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(laenge); let o = 0;
  for (const t of teile) { out.set(t, o); o += t.length; }
  return out;
}

// --- Öffentliche Funktion -------------------------------------------------------------------------------------------------
// opt: {ansicht: 'belegt'|'annahmen', ausfall: Standort-ID eines Ausfall-Glieds, jetzt: Date}
export async function gespraechsausdruck(daten, opt) {
  const jetzt = opt.jetzt || new Date(), p2 = v => String(v).padStart(2, '0');
  const o = {ansicht: opt.ansicht === 'annahmen' ? 'annahmen' : 'belegt',
    ausfall: daten.ausfall.glieder.some(g => g.standort === opt.ausfall) ? opt.ausfall : daten.ausfall.glieder.at(-1).standort,
    erstellt: `${p2(jetzt.getDate())}.${p2(jetzt.getMonth() + 1)}.${jetzt.getFullYear()} ${p2(jetzt.getHours())}:${p2(jetzt.getMinutes())}`};
  const punkte = daten.standorte.filter(s => s.ort.lat !== null).map(s => s.ort);
  const kw = Math.round((A4.w - 72) * KARTE_ANTEIL), rahmen = kartenRahmen(punkte, kw, kw / 1.5);
  const bild = await kartenBild(rahmen, opt.kartenQuelle);
  const erg = baue(daten, o, rahmen, bild);
  const datum = `${jetzt.getFullYear()}${p2(jetzt.getMonth() + 1)}${p2(jetzt.getDate())}${p2(jetzt.getHours())}${p2(jetzt.getMinutes())}${p2(jetzt.getSeconds())}`;
  const titel = `${daten.rohstoff}: ${daten.kette} (Gesprächsausdruck, ${o.ansicht === 'annahmen' ? 'Mit Annahmen' : 'Belegt'})`;
  const bytes = pdfDatei(erg.seiten, bild, {titel, thema: daten.kundenfrage.frage, datum});
  const name = `Kupferkette-${daten.kundenfrage.kunde}-${o.ansicht === 'annahmen' ? 'mit-Annahmen' : 'belegt'}-Ausfall-${o.ausfall}-${daten.stand}.pdf`;
  return {bytes, name, seiten: erg.seiten.length, schrift_min: MINDESTSCHRIFT, ueberlauf: erg.ueberlauf, quellen: erg.quellen, quellen_gezeigt: erg.quellen_gezeigt,
    karte: !!bild, ansicht: o.ansicht, ausfall: o.ausfall, y1: Math.round(erg.y1), unten: Math.round(A4.h - 38), texte: erg.seiten.map(s => s.texte.join(" "))};
}
export const _intern = {codes, breiteVon, latin1};
