/** Menge und Wert je Verbindung (Eddie 2026-11-11: "Die Bögen zeigen, dass eine Verbindung besteht, verraten aber nicht das
 *  Handelsvolumen, das Gewicht in Tonnen oder den Wert").
 *  Gemeinsame Datei, byte-gleich in Atlas-Lendrot dist/assets und atlaslendrot site/assets (Prüfung: test_menge_wert.mjs).
 *
 *  Bogenstärke: Menge pro Jahr in Tonnen, logarithmisch zwischen kleinster und größter Menge der Ansicht. Ohne Menge: dünn.
 *  Wert: Menge × Referenzpreis. Preise nur aus gelesener Quelle, hier USGS Mineral Commodity Summaries 2026 (Jahresmittel 2025,
 *  Schätzwerte der USGS; Abschriften der PDFs im Annahmen-Atlas unter daten/quellen/usgs-mcs-2026). Jeder Preis nennt Fundstelle
 *  und Umrechnung. Der Wert ist immer eine Schätzung: Weltmarkt- bzw. US-Preis, ohne Vertragskonditionen, Fracht, Gehaltsabschläge.
 *  Kein passender Preis = Wert unbekannt. Ein Wert, den die Quelle selbst nennt (z. B. Einkaufswert), steht als "laut Quelle".
 */
const USGS = 'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-';
const LB = 2204.62262; // lb je t
const OZ = 32150.7466; // Feinunzen je t
export const PREIS_QUELLE = 'USGS Mineral Commodity Summaries 2026, Jahresmittel 2025 (Schätzung der USGS)';

// je: worauf sich Preis und Menge beziehen. usd: [Preis] oder [von, bis]. stelle: Zeile der Quelle. rechnung: Umrechnung (nur Arithmetik).
export const PREISE = {
  kupfer: {je: 't Cu-Inhalt', usd: [4.40 * LB], url: USGS + 'copper.pdf', stelle: 'Salient Statistics: Price, London Metal Exchange, grade A, cash, 2025e: 440 cents per pound',
    rechnung: '440 US-Cent je lb × 2.204,6 lb/t'},
  gold: {je: 't Au', usd: [3300 * OZ], url: USGS + 'gold.pdf', stelle: 'Salient Statistics: Price, dollars per troy ounce, 2025e: 3,300',
    rechnung: '3.300 US$ je Feinunze × 32.150,7 oz/t'},
  lithiumcarbonat: {je: 't Lithiumcarbonat (LCE)', usd: [9000], url: USGS + 'lithium.pdf',
    stelle: 'Salient Statistics: Price, annual average-real, battery-grade lithium carbonate, 2025e: 9,000 dollars per metric ton'},
  lithium: {je: 't Li-Inhalt', usd: [9000 / 0.18787], url: USGS + 'lithium.pdf', stelle: 'Price, battery-grade lithium carbonate, 2025e: 9,000 dollars per metric ton',
    rechnung: '9.000 US$/t Lithiumcarbonat ÷ 0,1879 (Li-Anteil von Li2CO3)'},
  spodumen: {je: 't Spodumenkonzentrat (6 % Li2O)', usd: [800, 970], url: USGS + 'lithium.pdf',
    stelle: 'Events, Trends, and Issues: Spodumene (6% lithium oxide) prices in Australia (f.o.b.) increased from approximately $800 per ton in January to approximately $970 per ton in November',
    rechnung: 'Spanne Januar bis November 2025'},
  graphit: {je: 't Naturgraphit (Flocken)', usd: [1000], url: USGS + 'graphite.pdf',
    stelle: 'Salient Statistics: Price, average unit value of imports, dollars per metric ton at foreign ports, Flake, 2025e: 1,000'},
  wo3: {je: 't WO3-Inhalt', usd: [380 * 100], url: USGS + 'tungsten.pdf',
    stelle: 'Salient Statistics: Price, concentrate, average in-warehouse Rotterdam, dollars per dry metric ton unit of tungsten trioxide, 2025e: 380',
    rechnung: '380 US$ je mtu (10 kg WO3) × 100'},
  wolfram: {je: 't W-Inhalt', usd: [380 * 100 / 0.79297], url: USGS + 'tungsten.pdf', stelle: 'Price, concentrate, Rotterdam, per mtu WO3, 2025e: 380',
    rechnung: '38.000 US$/t WO3 ÷ 0,793 (W-Anteil von WO3)'},
  eisenerz: {je: 't Eisenerz (Feinerz 62 % Fe)', usd: [99.07], url: USGS + 'iron-ore.pdf',
    stelle: 'Events, Trends, and Issues: Global prices of iron ore averaged a unit value of $99.07 per ton (spot prices for imported iron ore fines, 62% iron content, c.i.f. Tianjin) in the first 9 months of 2025'},
  kobalt: {je: 't Co-Inhalt (zum Metallpreis)', usd: [15 * LB], url: USGS + 'cobalt.pdf', stelle: 'Salient Statistics: Price, London Metal Exchange (LME), cash, dollars per pound, 2025e: 15',
    rechnung: '15 US$ je lb × 2.204,6 lb/t; Zwischenprodukte (Hydroxid) werden mit Abschlag gehandelt'},
  bauxit: {je: 't Bauxit', usd: [32], url: USGS + 'bauxite-alumina.pdf', stelle: 'Salient Statistics: Bauxite, Price, average unit value of imports, f.a.s., dollars per metric ton, 2025e: 32'},
  tonerde: {je: 't Tonerde', usd: [590], url: USGS + 'bauxite-alumina.pdf', stelle: 'Salient Statistics: Alumina, Price, average unit value of imports, f.a.s., dollars per metric ton, 2025e: 590'},
  aluminium: {je: 't Aluminium', usd: [1.80 * LB], url: USGS + 'aluminum.pdf', stelle: 'Salient Statistics: Price, ingot, average U.S. market (spot), cents per pound, 2025e: 180',
    rechnung: '180 US-Cent je lb × 2.204,6 lb/t'},
  stahlschrott: {je: 't Stahlschrott', usd: [319], url: USGS + 'iron-steel-scrap.pdf',
    stelle: 'Salient Statistics: Price, average, delivered, No. 1 heavy melting composite price, dollars per metric ton, 2025e: 319'}
};

const fmt = (n, st) => new Intl.NumberFormat('de-DE', {maximumSignificantDigits: st || 3}).format(n);
/** 33.200 -> "33,2 kt"; 4 -> "4 t"; 69.900.000 -> "69,9 Mio. t". */
export function tonnenText(t) {
  if (t == null || !isFinite(t)) return 'unbekannt';
  if (t >= 1e6) return fmt(t / 1e6) + ' Mio. t';
  if (t >= 1e4) return fmt(t / 1e3) + ' kt';
  return fmt(t) + ' t';
}
/** 9,7e9 -> "9,7 Mrd. US$" */
export function geldText(usd, w = 'US$') {
  const a = Math.abs(usd);
  if (a >= 1e9) return fmt(usd / 1e9, 2) + ' Mrd. ' + w;
  if (a >= 1e6) return fmt(usd / 1e6, 2) + ' Mio. ' + w;
  if (a >= 1e3) return fmt(usd / 1e3, 2) + ' Tsd. ' + w;
  return fmt(usd, 2) + ' ' + w;
}
// [250 Mio., 310 Mio.] -> "250 bis 310 Mio. US$"
const spanne = usd => { const t = usd.map(x => geldText(x)); if (t.length < 2) return t[0];
  const e = /^(\S+) (.*)$/, a = e.exec(t[0]), b = e.exec(t[1]); return a[2] === b[2] ? a[1] + ' bis ' + b[1] + ' ' + a[2] : t.join(' bis '); };
const preisText = p => p.usd.map(x => fmt(x, x >= 1e5 ? 3 : 4)).join(' bis ') + ' US$ je ' + p.je;

/** Wert einer Menge: t Tonnen (auf der Basis des Preises), basis = Schlüssel in PREISE, jahr = Menge pro Jahr.
 *  Gibt {text, rechnung, quelle, url, usd:[…]} oder null (kein Preis = Wert unbekannt). */
export function wert(t, basis, jahr = true) {
  const p = PREISE[basis];
  if (!p || t == null || !isFinite(t) || t <= 0) return null;
  const usd = p.usd.map(x => x * t);
  return {usd, text: '≈ ' + spanne(usd) + (jahr ? ' pro Jahr' : ''),
    rechnung: tonnenText(t) + ' × ' + preisText(p) + (p.rechnung ? ' (' + p.rechnung + ')' : ''), quelle: PREIS_QUELLE, stelle: p.stelle, url: p.url};
}

/** Breitenskala für eine Ansicht: Mengen pro Jahr (t) der sichtbaren Bögen -> Faktor. Ohne Menge: UNBEKANNT. */
export const BREITE = {unbekannt: .7, min: 1, max: 3.2};
export function skala(mengen) {
  const w = mengen.filter(t => t != null && isFinite(t) && t > 0);
  if (!w.length) return {f: () => BREITE.unbekannt, stufen: [], n: 0};
  const lo = Math.min(...w), hi = Math.max(...w), a = Math.log10(lo), b = Math.log10(hi);
  const f = t => t == null || !isFinite(t) || t <= 0 ? BREITE.unbekannt : b - a < 1e-9 ? (BREITE.min + BREITE.max) / 2 : BREITE.min + (BREITE.max - BREITE.min) * (Math.log10(t) - a) / (b - a);
  const stufen = b - a < 1e-9 ? [lo] : [lo, Math.pow(10, (a + b) / 2), hi];
  return {f, stufen, n: w.length};
}

/** Legende "Bogenstärke" (gleich in beiden Atlanten). sk = skala(...), n = Zahl der Bögen in der Ansicht, annahme = Annahmen-Atlas. */
export function legendeHtml(sk, n, annahme) {
  const balken = (f, txt) => '<span class="mw-stufe"><i style="display:inline-block;vertical-align:middle;width:28px;height:' + Math.max(1, Math.round(f * 2.4)) + 'px;border-radius:2px;background:currentColor;opacity:.85;margin-right:6px"></i>' + txt + '</span>';
  return '<div class="mw-legende" data-mw-bekannt="' + sk.n + '"><b>Bogenstärke = Menge pro Jahr</b> ' +
    sk.stufen.map(t => balken(sk.f(t), tonnenText(t))).join(' ') + ' ' + balken(BREITE.unbekannt, 'Menge unbekannt') +
    '<small style="display:block;opacity:.8">' + (sk.n ? (sk.n === n ? 'Alle ' : sk.n.toLocaleString('de-DE') + ' von ') + n.toLocaleString('de-DE') + ' Bögen mit Menge' + (annahme ? ' (Annahme, außer belegte Wege)' : ' (laut Quelle)') + '. ' : 'Keine Menge in dieser Ansicht. ') +
    'Wert beim Antippen: Menge × Referenzpreis (' + PREIS_QUELLE + '), eine Schätzung.</small></div>';
}

/** Menge und Wert einer Verbindung. m = {t (Tonnen auf Preisbasis), jahr (pro Jahr?), text (Menge im Klartext), basis (Schlüssel in PREISE),
 *  umrechnung: Klartext, wie aus der Quellenangabe die Menge pro Jahr wurde, wertQuelle: [Betrag, Währung] wenn die Quelle selbst einen Wert nennt}. annahme = Menge ist eine Annahme.
 *  Gibt {zeilen: [[Bezeichnung, Klartext]], kurz: eine Zeile für Tooltip und Listen, quelleHtml: Link zur Preisquelle oder ''}. */
export function mengeWert(m, annahme) {
  const z = [['Menge', m.text || 'unbekannt']];
  let w = null, wt;
  if (m.wertQuelle) wt = geldText(m.wertQuelle[0], m.wertQuelle[1]) + ' laut Quelle';
  else {
    w = wert(m.t, m.basis, m.jahr);
    wt = w ? w.text + (annahme ? ' (Schätzung aus angenommener Menge)' : ' (Schätzung)') : 'unbekannt' + (m.t != null && !m.basis ? ' (kein Referenzpreis für diese Ware)' : '');
  }
  z.push(['Wert', wt]);
  if (w) z.push(['Rechnung', (m.umrechnung ? m.umrechnung + '; ' : '') + w.rechnung]);
  else if (m.umrechnung) z.push(['Rechnung', m.umrechnung]);
  const kurz = 'Menge ' + (m.text || 'unbekannt') + ' · Wert ' + wt;
  const quelleHtml = w ? '<span class="mw-quelle">Preis: <a href="' + w.url + '" target="_blank" rel="noopener">' + w.quelle + ' ↗</a></span>' : '';
  return {zeilen: z, kurz, quelleHtml, wert: w};
}
